#!/usr/bin/env node
/**
 * COREBLDG シミュレーションランナー
 *
 * 使い方:
 *   node simulation/run.js                    # 全シナリオ実行
 *   node simulation/run.js --scenario rental  # 特定シナリオのみ
 *   node simulation/run.js --headless false   # ブラウザを表示して実行
 *   node simulation/run.js --quick            # クイックチェック（主要ページのみ）
 *
 * 事前準備:
 *   cd simulation && npm install
 *   # 別ターミナルでローカルサーバー起動:
 *   cd v2 && python3 -m http.server 8765
 */

const { spawnSync } = require('child_process');
const path = require('path');
const fs   = require('fs');
const http = require('http');

const HQAgent   = require('./agents/hq-agent');
const AGAgent   = require('./agents/ag-agent');
const PTAgent   = require('./agents/pt-agent');
const AIManager = require('./agents/ai-manager');
const config    = require('./config');

const args = process.argv.slice(2);
const HEADLESS   = !args.includes('--headless=false') && !args.includes('--show');
const SCENARIO   = args.find(a => a.startsWith('--scenario='))?.split('=')[1];
const QUICK      = args.includes('--quick');

const C = {
  red:    s => `\x1b[31m${s}\x1b[0m`,
  yellow: s => `\x1b[33m${s}\x1b[0m`,
  green:  s => `\x1b[32m${s}\x1b[0m`,
  cyan:   s => `\x1b[36m${s}\x1b[0m`,
  bold:   s => `\x1b[1m${s}\x1b[0m`,
  dim:    s => `\x1b[2m${s}\x1b[0m`,
  magenta:s => `\x1b[35m${s}\x1b[0m`,
};

// ────────────────────────────────────────────────────────────
// サーバー疎通確認
// ────────────────────────────────────────────────────────────
async function waitForServer(retries = 10) {
  for (let i = 0; i < retries; i++) {
    const ok = await new Promise(resolve => {
      http.get(`${config.BASE_URL}/coreto-hub-v2.html`, r => resolve(r.statusCode === 200))
          .on('error', () => resolve(false));
    });
    if (ok) return true;
    await new Promise(r => setTimeout(r, 1000));
  }
  return false;
}

// ────────────────────────────────────────────────────────────
// エージェントの初期化・ログイン
// ────────────────────────────────────────────────────────────
async function initAgents() {
  console.log(C.dim('  エージェントを初期化中...'));
  const opts = { headless: HEADLESS };

  const hq = new HQAgent(opts);
  const ag = new AGAgent('re_ag', opts);
  const pt = new PTAgent(opts);

  await hq.init(); await hq.login();
  console.log(C.green(`  ✅ ${hq.label} ログイン完了`));

  await ag.init(); await ag.login();
  console.log(C.green(`  ✅ ${ag.label} ログイン完了`));

  await pt.init(); await pt.login();
  console.log(C.green(`  ✅ ${pt.label} ログイン完了`));

  return { hq, ag, pt };
}

// ────────────────────────────────────────────────────────────
// シナリオ実行
// ────────────────────────────────────────────────────────────
async function runScenario(scenario, agents, manager) {
  console.log(C.bold(`\n📋 シナリオ: ${scenario.name}`));
  console.log(C.dim(`   ${scenario.description || ''}`));
  console.log('');

  const steps = QUICK ? scenario.steps.slice(0, 3) : scenario.steps;

  for (const step of steps) {
    console.log(C.cyan(`  ▶ [${step.id}] ${step.name}`));
    try {
      await step.action(agents, scenario.testData);
      console.log(C.green(`     ✅ 完了`));
    } catch (e) {
      console.log(C.red(`     ❌ エラー: ${e.message.slice(0, 80)}`));
      // エラーも観察として記録
      for (const [key, agent] of Object.entries(agents)) {
        if (agent && step.roles.includes(key === 'hq' ? 'hq' : key === 'ag' ? 'ag' : 'pt')) {
          agent.observe('BUG', 'HIGH', `ステップ[${step.id}]でエラー: ${e.message.slice(0, 80)}`);
        }
      }
    }
  }

  // 全エージェントの観察をマネージャーに集約
  for (const agent of Object.values(agents)) {
    if (agent) manager.addObservations(agent.getObservations());
  }
}

// ────────────────────────────────────────────────────────────
// クイックチェック（ローカルサーバー不要の静的確認）
// ────────────────────────────────────────────────────────────
function runStaticCheck() {
  console.log(C.bold('\n🔍 静的解析を実行中...'));
  const result = spawnSync('node', [
    path.join(__dirname, '../qa/static-analyzer.js')
  ], { encoding: 'utf8' });
  process.stdout.write(result.stdout || '');
  return result.status === 0;
}

// ────────────────────────────────────────────────────────────
// メイン
// ────────────────────────────────────────────────────────────
(async () => {
  console.log('\n' + C.bold('╔══════════════════════════════════════════════════════════════╗'));
  console.log(C.bold('║  🎭 COREBLDG マルチロール シミュレーション                    ║'));
  console.log(C.bold('╚══════════════════════════════════════════════════════════════╝'));
  console.log(C.dim(`  モード: ${HEADLESS?'ヘッドレス':'ブラウザ表示'} | ${QUICK?'クイック':'フル'}チェック\n`));

  // ── 静的解析を先に実行 ───────────────────────────────────
  const staticOk = runStaticCheck();
  if (!staticOk) {
    console.log(C.yellow('\n⚠️  静的解析で問題が検出されました。先に修正することを推奨します。'));
    console.log(C.dim('   続行しますか？ (10秒後に自動続行)'));
    await new Promise(r => setTimeout(r, 10000));
  }

  // ── サーバー確認 ─────────────────────────────────────────
  console.log(C.dim(`\n📡 ${config.BASE_URL} に接続確認中...`));
  const serverOk = await waitForServer(5);
  if (!serverOk) {
    console.log(C.red('❌ ローカルサーバーに接続できません'));
    console.log(C.yellow('  以下のコマンドでサーバーを起動してください:'));
    console.log(C.cyan('  cd /path/to/coreto/v2 && python3 -m http.server 8765'));
    process.exit(1);
  }
  console.log(C.green('✅ サーバー接続OK'));

  // ── エージェント初期化 ───────────────────────────────────
  console.log(C.dim('\n👥 エージェントを起動中...'));
  let agents;
  try {
    agents = await initAgents();
  } catch (e) {
    console.log(C.red(`❌ エージェント起動失敗: ${e.message}`));
    process.exit(1);
  }

  const manager = new AIManager();

  // ── シナリオ実行 ─────────────────────────────────────────
  const scenarios = [];
  const scenarioDir = path.join(__dirname, 'scenarios');
  for (const f of fs.readdirSync(scenarioDir).filter(f => f.endsWith('.js'))) {
    const s = require(path.join(scenarioDir, f));
    if (!SCENARIO || s.name.includes(SCENARIO) || f.includes(SCENARIO)) {
      scenarios.push(s);
    }
  }

  for (const scenario of scenarios) {
    await runScenario(scenario, agents, manager);
  }

  // ── ブラウザ終了 ─────────────────────────────────────────
  for (const agent of Object.values(agents)) {
    if (agent) await agent.close().catch(() => {});
  }

  // ── AI分析 ───────────────────────────────────────────────
  console.log('');
  const scenarioNames = scenarios.map(s => s.name).join(' / ');
  const analysis = await manager.analyze(scenarioNames);

  // ── Timへの提案表示 ──────────────────────────────────────
  manager.presentToTim(scenarioNames);

  // ── レポート保存 ─────────────────────────────────────────
  const { jsonPath, mdPath } = manager.saveReport(scenarioNames.replace(/[/ ]/g, '_').slice(0, 30));

  // ── 終了サマリー ─────────────────────────────────────────
  const total    = manager.allObservations.length;
  const critical = manager.proposals.filter(p => p.severity === 'CRITICAL').length;
  const high     = manager.proposals.filter(p => p.severity === 'HIGH').length;
  const qw       = manager.proposals.filter(p => p.quick_win).length;

  console.log('\n' + C.bold('══════════════════════════════════'));
  console.log(C.bold('  実行完了'));
  console.log(`  観察: ${C.cyan(total+'件')} | 提案: ${C.cyan(manager.proposals.length+'件')}`);
  console.log(`  重大: ${critical>0?C.red(critical+'件'):C.dim('0件')} | 高: ${high>0?C.yellow(high+'件'):C.dim('0件')}`);
  console.log(`  クイックウィン: ${C.green(qw+'件')}`);
  console.log(C.bold('══════════════════════════════════\n'));

  console.log(C.yellow('👆 上記の提案をご確認いただき、修正すべき項目をお知らせください。'));
  console.log(C.dim('   レポート: ' + mdPath + '\n'));

  process.exit(0);
})();
