/**
 * データ分析エンジン
 * 蓄積されたシミュレーションデータから洞察を抽出する
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '../reports/simulation-data.json');

class AnalyticsEngine {
  constructor() {
    this.data = this.load();
  }

  load() {
    try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
    catch { return { scenarios: [], clients: [], issues: [], flows: [] }; }
  }

  save() {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(this.data, null, 2));
  }

  // シナリオ結果を記録
  recordScenario(scenario, result) {
    this.data.scenarios.push({
      id:          scenario.id,
      caseType:    scenario.caseType,
      difficulty:  scenario.difficulty,
      flow:        scenario.flow,
      issue:       scenario.issue,
      hasPT:       scenario.hasPT,
      fee:         scenario.fee,
      client:      scenario.client,
      success:     result.success,
      duration:    result.duration,
      stepsCompleted: result.stepsCompleted || [],
      stuckAt:     result.stuckAt || null,
      observations: result.observations?.length || 0,
      timestamp:   new Date().toISOString(),
    });

    // クライアントデータ蓄積
    if (scenario.client) {
      const existing = this.data.clients.find(c => c.name === scenario.client.name);
      if (existing) {
        existing.interactions = (existing.interactions || 0) + 1;
        existing.lastSeen = new Date().toISOString();
        if (result.success) existing.closedDeals = (existing.closedDeals || 0) + 1;
      } else {
        this.data.clients.push({
          ...scenario.client,
          caseType:    scenario.caseType,
          interactions: 1,
          closedDeals:  result.success ? 1 : 0,
          firstSeen:   new Date().toISOString(),
          lastSeen:    new Date().toISOString(),
        });
      }
    }

    // 問題データ記録
    if (result.observations) {
      for (const obs of result.observations) {
        this.data.issues.push({
          ...obs,
          scenarioId: scenario.id,
          caseType:   scenario.caseType,
          timestamp:  new Date().toISOString(),
        });
      }
    }

    this.save();
  }

  // ────────────────────────────────────────────────────────
  // 分析レポート生成
  // ────────────────────────────────────────────────────────

  generateReport() {
    const s = this.data.scenarios;
    if (s.length === 0) return '分析データがまだありません。';

    const report = {
      summary:        this.summarize(s),
      byType:         this.analyzeByType(s),
      flowAnalysis:   this.analyzeFlows(s),
      clientInsights: this.analyzeClients(),
      topIssues:      this.rankIssues(),
      dataUtilization: this.proposeDataUtilization(),
    };

    return report;
  }

  summarize(scenarios) {
    const total    = scenarios.length;
    const success  = scenarios.filter(s => s.success).length;
    const withPT   = scenarios.filter(s => s.hasPT).length;
    const hasIssue = scenarios.filter(s => s.issue !== 'none').length;
    const avgFee   = scenarios.reduce((sum, s) => sum + (s.fee || 0), 0) / total;
    const avgDur   = scenarios.reduce((sum, s) => sum + (s.duration || 0), 0) / total;

    return {
      total,
      successRate:   `${((success/total)*100).toFixed(1)}%`,
      ptRate:        `${((withPT/total)*100).toFixed(1)}%`,
      issueRate:     `${((hasIssue/total)*100).toFixed(1)}%`,
      avgFee:        `¥${Math.round(avgFee).toLocaleString()}`,
      avgDuration:   `${(avgDur/1000).toFixed(1)}秒`,
    };
  }

  analyzeByType(scenarios) {
    const types = {};
    for (const s of scenarios) {
      if (!types[s.caseType]) types[s.caseType] = { total:0, success:0, fees:[], stuck:[] };
      types[s.caseType].total++;
      if (s.success) types[s.caseType].success++;
      types[s.caseType].fees.push(s.fee || 0);
      if (s.stuckAt) types[s.caseType].stuck.push(s.stuckAt);
    }
    const result = {};
    for (const [type, data] of Object.entries(types)) {
      const avgFee = data.fees.reduce((a,b)=>a+b,0) / data.fees.length;
      const stuckFreq = data.stuck.reduce((acc, step) => {
        acc[step] = (acc[step]||0)+1; return acc;
      }, {});
      const mostStuck = Object.entries(stuckFreq).sort((a,b)=>b[1]-a[1])[0];
      result[type] = {
        total:       data.total,
        successRate: `${((data.success/data.total)*100).toFixed(1)}%`,
        avgFee:      `¥${Math.round(avgFee).toLocaleString()}`,
        bottleneck:  mostStuck ? `${mostStuck[0]}（${mostStuck[1]}回）` : 'なし',
      };
    }
    return result;
  }

  analyzeFlows(scenarios) {
    // ステップごとの完了率・詰まり頻度を分析
    const stepCounts = {};
    const stuckCounts = {};
    for (const s of scenarios) {
      for (const step of (s.stepsCompleted || [])) {
        stepCounts[step] = (stepCounts[step]||0)+1;
      }
      if (s.stuckAt) stuckCounts[s.stuckAt] = (stuckCounts[s.stuckAt]||0)+1;
    }

    const bottlenecks = Object.entries(stuckCounts)
      .sort((a,b) => b[1]-a[1])
      .slice(0,5)
      .map(([step, count]) => ({
        step,
        count,
        rate: `${((count/scenarios.length)*100).toFixed(1)}%`,
        suggestion: this.getStepSuggestion(step),
      }));

    return { stepCompletion: stepCounts, bottlenecks };
  }

  getStepSuggestion(step) {
    const suggestions = {
      matching:    'マッチングUIを改善・候補を自動提示する',
      itsetsu:     'IT重説の宅建士割当をワンクリック化する',
      screening:   '書類チェックリストを自動化する',
      payment:     '支払フローをシンプル化・ワンクリック承認を追加する',
      contract:    '契約書テンプレートを自動入力化する',
      instant_pay: '即時払い申請を残高確認込みでワンクリック化する',
    };
    return suggestions[step] || 'フローの見直しが必要';
  }

  analyzeClients() {
    const clients = this.data.clients;
    if (clients.length === 0) return {};

    // リピーター分析
    const repeaters = clients.filter(c => c.interactions > 1);
    // 高価値クライアント（成約率・金額）
    const byType = {};
    for (const c of clients) {
      if (!byType[c.caseType]) byType[c.caseType] = [];
      byType[c.caseType].push(c);
    }

    // 活用提案
    const utilization = this.proposeDataUtilization();

    return {
      total:         clients.length,
      repeaterRate:  `${((repeaters.length/clients.length)*100).toFixed(1)}%`,
      byType:        Object.fromEntries(Object.entries(byType).map(([t,arr])=>[t,arr.length])),
      utilization,
    };
  }

  rankIssues() {
    const issues = this.data.issues;
    const freq = {};
    for (const iss of issues) {
      const key = `${iss.category}_${(iss.message||'').slice(0,40)}`;
      freq[key] = { count: (freq[key]?.count||0)+1, sample: iss };
    }
    return Object.entries(freq)
      .sort((a,b) => b[1].count - a[1].count)
      .slice(0, 10)
      .map(([key, val]) => ({
        issue:   val.sample.message,
        category: val.sample.category,
        count:   val.count,
      }));
  }

  proposeDataUtilization() {
    const clientCount   = this.data.clients.length;
    const scenarioCount = this.data.scenarios.length;

    const proposals = [];

    if (clientCount > 10) {
      proposals.push({
        title:   'クライアント属性分析',
        detail:  `${clientCount}件のクライアントデータから、成約率の高い属性パターンを抽出できます`,
        benefit: 'AGがターゲット層に集中してアプローチできる',
        data:    'client.age, client.job, client.income vs closedDeals',
      });
    }

    if (scenarioCount > 50) {
      proposals.push({
        title:   '案件フロー最適化',
        detail:  'フロー詰まりポイントを特定し、ボトルネック解消を優先できます',
        benefit: '成約までの平均期間を短縮',
        data:    'stuckAt分析',
      });
    }

    proposals.push({
      title:   'AGマッチング精度向上',
      detail:  '案件タイプ×AG得意分野×成約率データでベストマッチを自動提案',
      benefit: 'マッチング画面の精度向上・無駄な転送を削減',
      data:    'ag.role × caseType × successRate',
    });

    proposals.push({
      title:   'PT紹介効率化',
      detail:  'PT経由案件の成約率・単価を直接案件と比較',
      benefit: 'PT向けインセンティブ設計の最適化',
      data:    'hasPT × fee × successRate',
    });

    proposals.push({
      title:   'リピーター優遇フロー',
      detail:  '2回以上来訪のクライアントを自動認識・過去データを事前入力',
      benefit: 'クライアント体験向上・AG工数削減',
      data:    'client.interactions > 1',
    });

    return proposals;
  }

  // Markdown形式でレポートを出力
  toMarkdown(report) {
    const md = [];
    md.push(`# COREBLDG シミュレーション分析レポート`);
    md.push(`\n生成日時: ${new Date().toLocaleString('ja-JP')}`);
    md.push(`シナリオ数: ${report.summary.total}件\n`);

    md.push(`## サマリー`);
    for (const [k,v] of Object.entries(report.summary)) {
      md.push(`- **${k}**: ${v}`);
    }

    md.push(`\n## 案件タイプ別分析`);
    for (const [type, data] of Object.entries(report.byType || {})) {
      md.push(`\n### ${type}`);
      for (const [k,v] of Object.entries(data)) md.push(`- ${k}: ${v}`);
    }

    md.push(`\n## フロー分析 - ボトルネック`);
    for (const bt of report.flowAnalysis?.bottlenecks || []) {
      md.push(`- **${bt.step}** (${bt.count}回/${bt.rate}): ${bt.suggestion}`);
    }

    md.push(`\n## 頻出問題 Top10`);
    for (const iss of report.topIssues || []) {
      md.push(`- [${iss.category}] ${iss.issue} (${iss.count}回)`);
    }

    md.push(`\n## クライアントデータ活用提案`);
    for (const p of report.clientInsights?.utilization || []) {
      md.push(`\n### ${p.title}`);
      md.push(`${p.detail}\n> **効果**: ${p.benefit}`);
    }

    return md.join('\n');
  }
}

module.exports = AnalyticsEngine;
