/**
 * AIマネージャー
 * 全エージェントの観察を受け取り、Claude APIで分析・優先度付けして
 * Timへの変更提案を生成する
 */

const fs   = require('fs');
const path = require('path');
const config = require('../config');

const C = {
  red:    s => `\x1b[31m${s}\x1b[0m`,
  yellow: s => `\x1b[33m${s}\x1b[0m`,
  green:  s => `\x1b[32m${s}\x1b[0m`,
  cyan:   s => `\x1b[36m${s}\x1b[0m`,
  bold:   s => `\x1b[1m${s}\x1b[0m`,
  dim:    s => `\x1b[2m${s}\x1b[0m`,
  magenta:s => `\x1b[35m${s}\x1b[0m`,
};

class AIManager {
  constructor() {
    this.allObservations = [];
    this.proposals = [];
  }

  addObservations(observations) {
    this.allObservations.push(...observations);
  }

  // Claude APIで分析・提案を生成
  async analyze(scenarioName) {
    console.log(C.cyan('\n🤖 AIマネージャーが分析中...'));

    // 観察を集約・グループ化
    const grouped = {};
    for (const obs of this.allObservations) {
      const key = `${obs.category}_${obs.severityLabel}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(obs);
    }

    // 重複を除いてサマリー作成
    const deduped = this.deduplicateObservations(this.allObservations);

    // Claude APIで分析
    const analysisPrompt = `あなたはCOREBLDG（不動産仲介・人材・光通信のエージェント管理SaaS）の
品質管理マネージャーです。

以下は「${scenarioName}」シナリオでのロール別テスト結果です。

## テスト観察結果（${deduped.length}件）

${deduped.map((obs, i) => `
### ${i+1}. [${obs.severityLabel}][${obs.category}] ${obs.agent}ロール
- 問題: ${obs.message}
- URL: ${obs.context?.url || '—'}
`).join('')}

## あなたのタスク

上記の観察を分析して、以下のJSON形式で変更提案を出力してください。
観察の重複を排除し、本質的な問題に絞り込んでください。

{
  "summary": "シナリオ全体のサマリー（2〜3文）",
  "proposals": [
    {
      "id": "P001",
      "priority": 1,
      "title": "問題のタイトル（20文字以内）",
      "category": "UI|UX|BUG|DATA|MISSING|CONFUSING",
      "severity": "CRITICAL|HIGH|MEDIUM|LOW",
      "problem": "具体的な問題の説明",
      "impact": "誰にどんな影響があるか",
      "proposal": "具体的な修正提案",
      "affected_files": ["ファイル名.html"],
      "effort": "small|medium|large",
      "quick_win": true
    }
  ]
}

- 優先度は1（最重要）から順に番号を付ける
- quick_win: 1時間以内に修正できるものをtrue
- affected_filesは空でも可
- 最大15件まで`;

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4000,
          messages: [{ role: 'user', content: analysisPrompt }],
        }),
      });

      const data = await response.json();
      const text = data.content?.[0]?.text || '';

      // JSONを抽出
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        this.proposals = result.proposals || [];
        this.summary   = result.summary || '';
        console.log(C.green('✅ AI分析完了'));
        return result;
      }
    } catch (e) {
      console.log(C.yellow('⚠️ Claude API未接続 - ローカル分析モードで実行'));
    }

    // フォールバック: ローカル集計
    return this.localAnalyze(deduped);
  }

  // Claude API不使用のローカル集計
  localAnalyze(observations) {
    const byCat = {};
    for (const obs of observations) {
      if (!byCat[obs.category]) byCat[obs.category] = [];
      byCat[obs.category].push(obs);
    }

    const proposals = [];
    let id = 1;

    for (const [cat, obs] of Object.entries(byCat)) {
      for (const o of obs) {
        proposals.push({
          id: `P${String(id).padStart(3,'0')}`,
          priority: id,
          title: o.message.slice(0, 30),
          category: cat,
          severity: o.severityLabel,
          problem: o.message,
          impact: `${o.agent}ロールが影響を受ける`,
          proposal: '要調査・修正',
          affected_files: [],
          effort: 'medium',
          quick_win: o.severityLabel === 'LOW',
        });
        id++;
      }
    }

    this.proposals = proposals;
    this.summary = `${observations.length}件の観察から${proposals.length}件の改善提案を生成しました。`;
    return { summary: this.summary, proposals };
  }

  // 重複排除
  deduplicateObservations(observations) {
    const seen = new Set();
    return observations.filter(obs => {
      // メッセージの最初の30文字で重複判定
      const key = `${obs.category}_${obs.message.slice(0,30)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  // Timへの提案をターミナルに表示
  presentToTim(scenarioName) {
    console.log('\n' + C.bold('╔══════════════════════════════════════════════════════════════╗'));
    console.log(C.bold('║  📋 マネージャーレポート  ') + C.dim(`シナリオ: ${scenarioName}`) + ' '.repeat(Math.max(0, 32-scenarioName.length)) + C.bold('║'));
    console.log(C.bold('╚══════════════════════════════════════════════════════════════╝'));

    if (this.summary) {
      console.log('\n' + C.cyan('【総評】'));
      console.log(`  ${this.summary}\n`);
    }

    const byPriority = this.proposals.sort((a,b) => a.priority - b.priority);

    console.log(C.bold(`改善提案 ${byPriority.length}件:`));
    console.log('');

    for (const p of byPriority) {
      const sev  = { CRITICAL: C.red('🔴 CRITICAL'), HIGH: C.red('🟠 HIGH'), MEDIUM: C.yellow('🟡 MEDIUM'), LOW: C.dim('🔵 LOW') }[p.severity] || p.severity;
      const eff  = { small: '⚡短時間', medium: '⏱中程度', large: '⏳長時間' }[p.effort] || p.effort;
      const qw   = p.quick_win ? C.green(' [クイックウィン]') : '';
      const cat  = config.ISSUE_CATEGORIES[p.category] || p.category;

      console.log(`  ${C.bold(p.id)} ${sev} ${C.cyan(`[${cat}]`)}${qw}`);
      console.log(`  ${C.bold('問題:')} ${p.problem}`);
      console.log(`  ${C.bold('影響:')} ${p.impact}`);
      console.log(`  ${C.bold('提案:')} ${p.proposal}`);
      if (p.affected_files?.length) {
        console.log(`  ${C.dim('対象:')} ${p.affected_files.join(', ')}`);
      }
      console.log(`  ${C.dim('工数:')} ${eff}`);
      console.log('');
    }

    // クイックウィン一覧
    const quickWins = byPriority.filter(p => p.quick_win);
    if (quickWins.length > 0) {
      console.log(C.green(`\n⚡ クイックウィン（すぐ修正可能）: ${quickWins.length}件`));
      quickWins.forEach(p => console.log(`   ${p.id}: ${p.title}`));
    }
  }

  // レポートをJSONとMarkdownで保存
  saveReport(scenarioName) {
    const ts      = new Date().toISOString().replace(/[:.]/g,'-').slice(0,19);
    const dir     = path.join(__dirname, '../reports');
    fs.mkdirSync(dir, { recursive: true });

    // JSON
    const jsonPath = path.join(dir, `${ts}_${scenarioName}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify({
      scenario: scenarioName,
      timestamp: new Date().toISOString(),
      totalObservations: this.allObservations.length,
      summary: this.summary,
      proposals: this.proposals,
      rawObservations: this.allObservations,
    }, null, 2));

    // Markdown
    const mdPath = path.join(dir, `${ts}_${scenarioName}.md`);
    const md = `# COREBLDG 検証レポート
シナリオ: **${scenarioName}**
実行日時: ${new Date().toLocaleString('ja-JP')}
観察件数: ${this.allObservations.length}件 → 提案 ${this.proposals.length}件

## 総評
${this.summary}

## 改善提案

${this.proposals.map(p => `
### ${p.id} [${p.severity}][${p.category}] ${p.title}

- **問題:** ${p.problem}
- **影響:** ${p.impact}
- **提案:** ${p.proposal}
- **対象ファイル:** ${p.affected_files?.join(', ') || '—'}
- **工数:** ${p.effort}
- **クイックウィン:** ${p.quick_win ? 'はい' : 'いいえ'}
`).join('')}

## 全観察ログ

| エージェント | カテゴリ | 重要度 | メッセージ |
|---|---|---|---|
${this.allObservations.map(o => `| ${o.agent} | ${o.category} | ${o.severityLabel} | ${o.message} |`).join('\n')}
`;
    fs.writeFileSync(mdPath, md);

    console.log(C.dim(`\n📁 レポート保存:`));
    console.log(C.dim(`   ${jsonPath}`));
    console.log(C.dim(`   ${mdPath}`));

    return { jsonPath, mdPath };
  }
}

module.exports = AIManager;
