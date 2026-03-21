#!/usr/bin/env node
/**
 * COREBLDG MAS オーケストレーター
 *
 * 使い方:
 *   node mas/run.js                     # デフォルト100件
 *   node mas/run.js --count 1000        # 1000件実行
 *   node mas/run.js --count 50 --concurrency 3  # 50件を3並列
 *   node mas/run.js --resume            # 前回の続きから
 *   node mas/run.js --report-only       # 実行なし・レポートのみ生成
 */

'use strict';

const path       = require('path');
const fs         = require('fs');
const http       = require('http');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');

const ScenarioGenerator = require('./engine/scenario-generator');
const IssueClassifier   = require('./engine/issue-classifier');
const AnalyticsEngine   = require('./analytics/analytics-engine');

// ────────────────────────────────────────────────────────────
// コンフィグ
// ────────────────────────────────────────────────────────────
const BASE_URL   = 'http://localhost:8765';
const args       = process.argv.slice(2);
const COUNT      = parseInt(args.find(a=>a.startsWith('--count='))?.split('=')[1] || '100');
const CONCURRENCY = Math.min(parseInt(args.find(a=>a.startsWith('--concurrency='))?.split('=')[1] || '3'), 5);
const RESUME     = args.includes('--resume');
const REPORT_ONLY = args.includes('--report-only');
const HEADLESS   = !args.includes('--show');

const PROGRESS_FILE = path.join(__dirname, 'queue/progress.json');
const MAS_DIR       = __dirname;

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
// Worker Thread エントリーポイント
// ────────────────────────────────────────────────────────────
if (!isMainThread) {
  const ScenarioWorker = require('./engine/scenario-worker');
  (async () => {
    const { scenario, headless } = workerData;
    const worker = new ScenarioWorker(scenario, { headless });
    const result = await worker.run();
    parentPort.postMessage({ scenarioId: scenario.id, scenario, result });
  })();
  return;
}

// ────────────────────────────────────────────────────────────
// メインプロセス
// ────────────────────────────────────────────────────────────

async function checkServer() {
  return new Promise(resolve => {
    http.get(`${BASE_URL}/coreto-hub-v2.html`, r => resolve(r.statusCode === 200))
        .on('error', () => resolve(false));
  });
}

function loadProgress() {
  try { return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8')); }
  catch { return { completed: [], failed: [], total: 0, startedAt: null }; }
}

function saveProgress(progress) {
  fs.mkdirSync(path.dirname(PROGRESS_FILE), { recursive: true });
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

// プログレスバー表示
function renderProgress(done, total, success, failed, elapsed) {
  const pct   = Math.round((done / total) * 100);
  const bar   = '█'.repeat(Math.floor(pct/5)) + '░'.repeat(20-Math.floor(pct/5));
  const eta   = done > 0 ? Math.round((elapsed / done) * (total - done) / 1000) : '?';
  const rate  = done > 0 ? `${((success/done)*100).toFixed(0)}%` : '—';
  process.stdout.write(
    `\r  [${C.cyan(bar)}] ${C.bold(pct+'%')} ${done}/${total} | ✅${success} ❌${failed} | 成功率:${rate} | ETA:${eta}s   `
  );
}

async function runWorker(scenario) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(__filename, {
      workerData: { scenario, headless: HEADLESS }
    });
    const timeout = setTimeout(() => {
      worker.terminate();
      resolve({ scenarioId: scenario.id, scenario, result: {
        success: false, duration: 30000, stepsCompleted: [],
        stuckAt: 'timeout', observations: [{
          category:'BUG', severity:'HIGH', message:'タイムアウト（30秒）',
          agent:'worker', context:{}
        }]
      }});
    }, 30000);

    worker.on('message', msg => { clearTimeout(timeout); resolve(msg); });
    worker.on('error', err => { clearTimeout(timeout); resolve({
      scenarioId: scenario.id, scenario,
      result: { success:false, duration:0, stepsCompleted:[], stuckAt:'worker_error',
        observations:[{category:'BUG',severity:'CRITICAL',message:err.message.slice(0,80),agent:'worker',context:{}}] }
    }); });
  });
}

// ────────────────────────────────────────────────────────────
// メイン実行
// ────────────────────────────────────────────────────────────
(async () => {
  console.log('\n' + C.bold('╔══════════════════════════════════════════════════════════════╗'));
  console.log(C.bold('║  🎭 COREBLDG MAS  マルチエージェント検証システム              ║'));
  console.log(C.bold('╚══════════════════════════════════════════════════════════════╝'));
  console.log(C.dim(`  シナリオ数: ${COUNT}件 | 並列数: ${CONCURRENCY} | モード: ${HEADLESS?'ヘッドレス':'表示'}\n`));

  // ── レポートのみモード ──────────────────────────────────
  if (REPORT_ONLY) {
    await generateFinalReport(new IssueClassifier(), new AnalyticsEngine());
    return;
  }

  // ── サーバー確認 ──────────────────────────────────────
  console.log(C.dim(`📡 ${BASE_URL} 確認中...`));
  const serverOk = await checkServer();
  if (!serverOk) {
    console.log(C.red(`\n❌ ${BASE_URL} に接続できません`));
    console.log(C.yellow(`  cd v2 && python3 -m http.server 8765`));
    process.exit(1);
  }
  console.log(C.green('✅ サーバー接続OK\n'));

  // ── 静的解析（先行実行） ──────────────────────────────
  console.log(C.bold('① 静的解析を実行...'));
  try {
    const { spawnSync } = require('child_process');
    const r = spawnSync('node', [path.join(MAS_DIR,'../qa/static-analyzer.js')], { encoding:'utf8', timeout:30000 });
    const lines = (r.stdout||'').split('\n');
    const summary = lines.find(l => l.includes('件')) || '';
    console.log(C.dim('   ' + summary.trim()));
  } catch(e) { console.log(C.dim('   静的解析スキップ')); }

  // ── シナリオ生成 ──────────────────────────────────────
  console.log(C.bold('\n② シナリオ生成...'));
  const progress    = RESUME ? loadProgress() : { completed:[], failed:[], total: COUNT, startedAt: new Date().toISOString() };
  const allScenarios = ScenarioGenerator.generateScenarioBatch(COUNT);
  const doneIds      = new Set([...progress.completed, ...progress.failed]);
  const pending      = allScenarios.filter(s => !doneIds.has(s.id));

  console.log(C.dim(`   生成: ${allScenarios.length}件 | 残り: ${pending.length}件`));

  // ── 並列実行 ──────────────────────────────────────────
  const classifier = new IssueClassifier();
  const analytics  = new AnalyticsEngine();
  let done = progress.completed.length, success = 0, failed = 0;
  const startTime  = Date.now();

  console.log(C.bold('\n③ シナリオ実行開始...\n'));

  // キューを並列処理
  const queue = [...pending];
  const running = new Set();

  const processNext = async () => {
    if (queue.length === 0) return;
    const scenario = queue.shift();
    running.add(scenario.id);

    const { result } = await runWorker(scenario);

    // 結果処理
    if (result.success) success++;
    else failed++;
    done++;

    // 問題を分類・修正
    for (const obs of result.observations || []) {
      obs.context = obs.context || {};
      obs.context.scenarioId = scenario.id;
      classifier.classify(obs);
    }

    // データ記録
    analytics.recordScenario(scenario, result);

    // 進捗更新
    if (result.success) progress.completed.push(scenario.id);
    else progress.failed.push(scenario.id);
    saveProgress(progress);

    running.delete(scenario.id);
    renderProgress(done, pending.length + progress.completed.length, success, failed, Date.now() - startTime);
  };

  // 並列実行ループ
  while (queue.length > 0 || running.size > 0) {
    while (running.size < CONCURRENCY && queue.length > 0) {
      processNext(); // awaitしない（並列化のため）
    }
    await new Promise(r => setTimeout(r, 200));
  }

  console.log('\n');

  // ── 最終レポート ──────────────────────────────────────
  await generateFinalReport(classifier, analytics, { done, success, failed, elapsed: Date.now()-startTime });

})();

// ────────────────────────────────────────────────────────────
// 最終レポート生成
// ────────────────────────────────────────────────────────────
async function generateFinalReport(classifier, analytics, stats = {}) {
  const C = {
    red: s=>`\x1b[31m${s}\x1b[0m`, yellow: s=>`\x1b[33m${s}\x1b[0m`,
    green: s=>`\x1b[32m${s}\x1b[0m`, cyan: s=>`\x1b[36m${s}\x1b[0m`,
    bold: s=>`\x1b[1m${s}\x1b[0m`, dim: s=>`\x1b[2m${s}\x1b[0m`,
  };

  console.log('\n' + C.bold('═══════════════════════════════════════════════════════════════'));
  console.log(C.bold('  📊 検証完了 - 最終サマリー'));
  console.log(C.bold('═══════════════════════════════════════════════════════════════'));

  if (stats.done) {
    console.log(`\n  実行: ${C.bold(stats.done+'件')} | ✅成功: ${C.green(stats.success+'件')} | ❌失敗: ${C.red(stats.failed+'件')}`);
    console.log(`  成功率: ${C.bold(((stats.success/stats.done)*100).toFixed(1)+'%')} | 実行時間: ${(stats.elapsed/1000).toFixed(0)}秒`);
  }

  // 自動修正サマリー
  const patchStats = classifier.getStats();
  console.log(`\n  🔧 自動修正: ${C.green(patchStats.autoPatches+'件')} 適用`);
  console.log(`  📋 許可申請: ${C.yellow(patchStats.pendingRequests+'件')} 待機中`);

  // データ分析
  const report = analytics.generateReport();
  if (report && report.summary) {
    console.log(`\n${C.bold('  📈 データ分析サマリー')}`);
    for (const [k,v] of Object.entries(report.summary)) {
      console.log(`  ${k}: ${C.cyan(String(v))}`);
    }

    if (report.flowAnalysis?.bottlenecks?.length > 0) {
      console.log(`\n${C.bold('  🚧 フロー ボトルネック Top5')}`);
      for (const bt of report.flowAnalysis.bottlenecks.slice(0,5)) {
        console.log(`  - ${bt.step}（${bt.rate}で詰まる）: ${bt.suggestion}`);
      }
    }
  }

  // 許可申請表示
  const permOutput = classifier.formatPermissionRequests();
  if (permOutput) {
    console.log(permOutput);
  } else {
    console.log(C.green('\n  ✅ 許可申請待ちなし'));
  }

  // Markdownレポート保存
  if (report) {
    const ts    = new Date().toISOString().replace(/[:.]/g,'-').slice(0,19);
    const rdir  = path.join(__dirname, 'reports');
    fs.mkdirSync(rdir, { recursive: true });
    const mdPath = path.join(rdir, `${ts}_mas-report.md`);
    fs.writeFileSync(mdPath, analytics.toMarkdown(report));
    console.log(C.dim(`\n  📁 レポート: ${mdPath}`));
  }

  console.log('\n' + C.yellow('  👆 上記「許可申請」の対応をお知らせください。'));
  console.log(C.dim('  自動修正済みBUGはgit diffで確認: git diff v2/\n'));
}
