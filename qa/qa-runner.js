#!/usr/bin/env node
/**
 * COREBLDG v2 QA統合ランナー
 * 静的解析 → ブラウザテスト → レポート生成
 *
 * 使い方:
 *   node qa/qa-runner.js            # 静的+ブラウザ両方
 *   node qa/qa-runner.js --static   # 静的解析のみ（高速）
 *   node qa/qa-runner.js --browser  # ブラウザのみ
 *   node qa/qa-runner.js --fix      # 修正可能な問題を自動修正
 */

const { execSync, spawnSync } = require('child_process');
const path = require('path');
const fs   = require('fs');

const args    = process.argv.slice(2);
const STATIC  = args.includes('--static') || (!args.includes('--browser'));
const BROWSER = args.includes('--browser') || (!args.includes('--static'));
const AUTO_FIX = args.includes('--fix');

const C = {
  red:    s => `\x1b[31m${s}\x1b[0m`,
  yellow: s => `\x1b[33m${s}\x1b[0m`,
  green:  s => `\x1b[32m${s}\x1b[0m`,
  cyan:   s => `\x1b[36m${s}\x1b[0m`,
  bold:   s => `\x1b[1m${s}\x1b[0m`,
  dim:    s => `\x1b[2m${s}\x1b[0m`,
};

console.log('\n' + C.bold('╔══════════════════════════════════════════════════════╗'));
console.log(C.bold('║  COREBLDG v2  自動QA システム                         ║'));
console.log(C.bold('╚══════════════════════════════════════════════════════╝\n'));
console.log(C.dim(`  実行モード: ${STATIC?'静的解析 ':''}${BROWSER?'ブラウザテスト ':''}`));
console.log(C.dim(`  自動修正: ${AUTO_FIX ? 'ON' : 'OFF'}\n`));

const QA_DIR = __dirname;
const V2_DIR = path.join(__dirname, '../v2');

// ────────────────────────────────────────────────────────────
// 自動修正（--fixオプション時）
// ────────────────────────────────────────────────────────────
async function autoFix(staticReport) {
  if (!staticReport || !staticReport.report) return;
  const files = fs.readdirSync(V2_DIR).filter(f => f.endsWith('.html') || f.endsWith('.js'));

  console.log(C.bold('\n── 自動修正 ──────────────────────────────────'));
  let fixCount = 0;

  for (const { fname, issues } of staticReport.report) {
    const fpath = path.join(V2_DIR, fname);
    let code    = fs.readFileSync(fpath, 'utf8');
    let changed = false;

    for (const iss of issues) {
      // badge固定値を0に自動修正
      if (iss.type === 'badge固定値' || iss.type === 'badge固定値(JS)') {
        const newCode = code.replace(/badge\s*:\s*'[1-9]\d*'/g, 'badge:0')
                            .replace(/badge\s*:\s*"[1-9]\d*"/g, 'badge:0');
        if (newCode !== code) { code = newCode; changed = true; fixCount++; console.log(`  ✅ ${fname}: badge固定値を0に修正`); }
      }
      // .nav-item CSS残存を削除（hub-v2以外）
      if (iss.type === '.nav-item CSS残存' && fname !== 'coreto-hub-v2.html') {
        const newCode = code
          .replace(/\.nav-item\s*\{[^}]+\}/g, '')
          .replace(/\.nav-item:[a-z]+\s*\{[^}]+\}/g, '')
          .replace(/\.nav-item\.[a-z]+[^{]*\{[^}]+\}/g, '')
          .replace(/\.nav-icon\s*\{[^}]+\}/g, '')
          .replace(/\.nav-text\s*\{[^}]+\}/g, '')
          .replace(/\.nav-section[^{]*\{[^}]+\}/g, '');
        if (newCode !== code) { code = newCode; changed = true; fixCount++; console.log(`  ✅ ${fname}: .nav-item CSS削除`); }
      }
    }

    if (changed) fs.writeFileSync(fpath, code);
  }

  if (fixCount === 0) console.log(C.dim('  自動修正対象なし'));
  else console.log(C.green(`\n  ${fixCount}件修正。git add v2/ してコミットしてください。`));
}

// ────────────────────────────────────────────────────────────
// メイン実行
// ────────────────────────────────────────────────────────────
(async () => {
  const start = Date.now();
  let staticIssues = 0;
  let browserIssues = 0;

  // ── 静的解析 ──────────────────────────────────────────────
  if (STATIC) {
    console.log(C.bold('① 静的解析を実行中...'));
    const res = spawnSync('node', [path.join(QA_DIR, 'static-analyzer.js')], {
      encoding: 'utf8', cwd: QA_DIR
    });
    process.stdout.write(res.stdout || '');
    if (res.stderr) process.stderr.write(C.dim(res.stderr));
    staticIssues = res.status || 0;

    if (AUTO_FIX && fs.existsSync(path.join(QA_DIR, 'static-report.json'))) {
      const report = JSON.parse(fs.readFileSync(path.join(QA_DIR, 'static-report.json'), 'utf8'));
      await autoFix(report);
    }
  }

  // ── ブラウザテスト ────────────────────────────────────────
  if (BROWSER) {
    console.log(C.bold('\n② ブラウザテストを実行中...'));
    console.log(C.dim('  (HQ/AG/PT の全ロールでログインしてページを巡回します)\n'));
    const res = spawnSync('node', [path.join(QA_DIR, 'browser-tester.js')], {
      encoding: 'utf8', cwd: QA_DIR, timeout: 300000
    });
    process.stdout.write(res.stdout || '');
    if (res.stderr && res.stderr.trim()) process.stderr.write(C.dim(res.stderr));
    browserIssues = res.status || 0;
  }

  // ── サマリー ──────────────────────────────────────────────
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  const total   = (STATIC ? staticIssues : 0) + (BROWSER ? browserIssues : 0);

  console.log('\n' + C.bold('╔══════════════════════════════════════════════════════╗'));
  console.log(C.bold('║  最終結果                                             ║'));
  console.log(C.bold('╚══════════════════════════════════════════════════════╝'));
  console.log(`  静的解析:     ${staticIssues  > 0 ? C.red('❌ ' + staticIssues  + '件') : C.green('✅ クリア')}`);
  console.log(`  ブラウザ:     ${browserIssues > 0 ? C.red('❌ ' + browserIssues + '件') : C.green('✅ クリア')}`);
  console.log(`  実行時間:     ${C.dim(elapsed + '秒')}`);
  console.log('');
  if (total > 0) {
    console.log(C.yellow('  修正が必要な問題があります。上記のレポートを確認してください。'));
    console.log(C.dim('  自動修正可能な問題: node qa/qa-runner.js --fix'));
  } else {
    console.log(C.green('  全テスト通過 🎉'));
  }
  console.log('');

  process.exit(total > 0 ? 1 : 0);
})();
