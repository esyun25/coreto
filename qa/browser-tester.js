/**
 * COREBLDG v2 ブラウザテスト (Playwright)
 * 実際にログインして全ページを巡回し、問題を検出する
 */

const { chromium } = require('playwright');
const path = require('path');
const fs   = require('fs');

// 環境変数またはコマンドライン引数でURLを上書き可能
// 例: BASE_URL=http://localhost:8765 node browser-tester.js
const BASE_URL = process.env.BASE_URL
  || process.argv.find(a => a.startsWith('--url='))?.split('=')[1]
  || 'https://esyun25.github.io/coreto/v2';

// ────────────────────────────────────────────────────────────
// カラー出力
// ────────────────────────────────────────────────────────────
const C = {
  red:    s => `\x1b[31m${s}\x1b[0m`,
  yellow: s => `\x1b[33m${s}\x1b[0m`,
  green:  s => `\x1b[32m${s}\x1b[0m`,
  cyan:   s => `\x1b[36m${s}\x1b[0m`,
  bold:   s => `\x1b[1m${s}\x1b[0m`,
  dim:    s => `\x1b[2m${s}\x1b[0m`,
};

// ────────────────────────────────────────────────────────────
// テスト対象ロール
// ────────────────────────────────────────────────────────────
const TEST_ROLES = [
  { userId: 'HQ-00001', pw: 'Coreto2026!', role: 'hq',       label: 'HQ統括' },
  { userId: 'AG-0042',  pw: 'agent2026',   role: 're_ag',    label: '不動産AG' },
  { userId: 'AG-0103',  pw: 'agent2026',   role: 'hr_ag',    label: '人材AG' },
  { userId: 'AG-0071',  pw: 'agent2026',   role: 'hikari_ag',label: '光通信AG' },
  { userId: 'PT-0015',  pw: 'partner26',   role: 'pt',       label: 'PT' },
];

// ────────────────────────────────────────────────────────────
// 検査内容
// ────────────────────────────────────────────────────────────

// デモデータパターン（ブラウザで実際に表示されているテキスト）
const DEMO_TEXTS = [
  '田中 優子', '高橋 美咲', '鈴木 健太', '山田 誠', '大橋 幸代',
  '渡辺 誠', '伊藤 花子', '佐藤 健', '木下 大輔', '田中 誠一',
  'RENT-0194', 'RENT-0192', 'RENT-0190', 'RENT-0193',
  'AG-0042', 'AG-0055', 'AG-0088',
  '¥3,840,000', '¥540,000',
];

// ハードコードbadge（1以上の数字が表示されていてデータがない場合）
async function checkPage(page, url, roleName) {
  const issues = [];

  try {
    await page.goto(url, { timeout: 15000, waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    // ── A. デモテキスト検出 ──────────────────────────────
    for (const text of DEMO_TEXTS) {
      const found = await page.locator(`text="${text}"`).first().isVisible().catch(() => false);
      if (found) {
        issues.push({ level: 'WARN', type: 'デモデータ表示', detail: `"${text}" が表示されている` });
      }
    }

    // ── B. サイドバー表示確認 ────────────────────────────
    const sbVisible = await page.locator('.sb').first().isVisible().catch(() => false);
    if (!sbVisible) {
      issues.push({ level: 'ERROR', type: 'サイドバー非表示', detail: '.sbが表示されていない' });
    }

    // ── C. sb-nameがハードコード ─────────────────────────
    const sbName = await page.locator('#sb-name').first().textContent().catch(() => null);
    if (sbName && !['—', '', roleName].some(v => sbName.includes(v))) {
      const demoNames = ['田中 誠一', '山田 誠', '鈴木 花子', '佐藤 健一', '渡辺 大輝', '中村 陽子'];
      if (demoNames.some(n => sbName.includes(n))) {
        issues.push({ level: 'WARN', type: 'sb-nameハードコード', detail: `"${sbName}" が表示 (${roleName}でログイン中)` });
      }
    }

    // ── D. ナビバッジのハードコード確認 ──────────────────
    const badges = await page.locator('.cnav-badge:visible').allTextContents().catch(() => []);
    for (const badge of badges) {
      const num = parseInt(badge);
      if (!isNaN(num) && num > 0) {
        // ゼロより大きいbadgeが表示されている → データが0件でも表示?
        // NOTE: 実データがあれば問題ない。件数だけ記録
        issues.push({ level: 'INFO', type: 'バッジ表示確認', detail: `"${badge}" → 実データで確認推奨` });
      }
    }

    // ── E. コンテンツ空確認 ──────────────────────────────
    const pageContent = await page.locator('#page-content').first().textContent().catch(() => null);
    if (pageContent !== null && pageContent.trim() === '') {
      issues.push({ level: 'ERROR', type: 'コンテンツ空', detail: '#page-contentが空' });
    }

    // ── F. コンソールエラー ──────────────────────────────
    // (リスナーは起動時に設定するため個別では確認しない)

    // ── G. ナビアイテム数確認 ────────────────────────────
    const navItems = await page.locator('.cnav-item').count().catch(() => 0);
    if (navItems === 0) {
      issues.push({ level: 'ERROR', type: 'ナビ空', detail: '.cnav-itemが0件' });
    }

    // ── H. ページタイトル確認 ────────────────────────────
    const title = await page.locator('#page-title').first().textContent().catch(() => null);
    if (title === 'ダッシュボード' && roleName !== 'HQ統括') {
      issues.push({ level: 'WARN', type: 'タイトル不統一', detail: `"ダッシュボード" → "マイダッシュボード" であるべき` });
    }

  } catch (e) {
    issues.push({ level: 'ERROR', type: 'ページロードエラー', detail: e.message.slice(0, 100) });
  }

  return issues;
}

// ────────────────────────────────────────────────────────────
// テスト実行
// ────────────────────────────────────────────────────────────

async function login(page, userId, pw) {
  await page.goto(`${BASE_URL}/coreto-hub-v2.html`, { timeout: 20000 });
  await page.waitForTimeout(1000);
  await page.fill('#login-id', userId);
  await page.fill('#login-pw', pw);
  await page.click('button[onclick*="doLogin"]');
  await page.waitForTimeout(1500);
}

async function runBrowserTests() {
  console.log('\n' + C.bold('═══════════════════════════════════════════════════'));
  console.log(C.bold(' COREBLDG v2 ブラウザテスト'));
  console.log(C.bold('═══════════════════════════════════════════════════'));
  console.log(C.dim(`  対象: ${BASE_URL}\n`));

  const browser = await chromium.launch({ headless: true });
  const allResults = [];
  let totalIssues = 0;

  for (const roleInfo of TEST_ROLES) {
    console.log(C.cyan(`\n▶ ロール: ${roleInfo.label} (${roleInfo.userId})`));
    const context = await browser.newContext();
    const page    = await context.newPage();

    // コンソールエラーを収集
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 100));
    });

    // ── ログイン ──────────────────────────────────────────
    try {
      await login(page, roleInfo.userId, roleInfo.pw);
      const appVisible = await page.locator('#app').first().isVisible().catch(() => false);
      if (!appVisible) {
        console.log(C.red(`  ❌ ログイン失敗`));
        await context.close();
        continue;
      }
      console.log(C.green(`  ✅ ログイン成功`));
    } catch (e) {
      console.log(C.red(`  ❌ ログインエラー: ${e.message.slice(0, 60)}`));
      await context.close();
      continue;
    }

    // ── ダッシュボード確認 ────────────────────────────────
    const dashIssues = await checkPage(page, `${BASE_URL}/coreto-hub-v2.html`, roleInfo.label);
    const pageResult = { page: 'マイダッシュボード', url: 'coreto-hub-v2.html', issues: dashIssues };
    allResults.push({ role: roleInfo.label, results: [pageResult] });

    const errCount  = dashIssues.filter(i => i.level === 'ERROR').length;
    const warnCount = dashIssues.filter(i => i.level === 'WARN').length;
    const infoCount = dashIssues.filter(i => i.level === 'INFO').length;
    totalIssues += errCount + warnCount;

    if (errCount > 0 || warnCount > 0) {
      console.log(`  ${C.yellow('⚠')} ダッシュボード: エラー${errCount} 警告${warnCount} 情報${infoCount}`);
      for (const iss of dashIssues.filter(i => i.level !== 'INFO')) {
        const lv = iss.level === 'ERROR' ? C.red('[ERR]') : C.yellow('[WRN]');
        console.log(`     ${lv} ${C.cyan(`[${iss.type}]`)} ${iss.detail}`);
      }
    } else {
      console.log(`  ${C.green('✅')} ダッシュボード: 問題なし (バッジ情報${infoCount}件)`);
    }

    // ── 主要ページ巡回 ───────────────────────────────────
    const pagesToCheck = roleInfo.role === 'hq'
      ? [
          ['担当案件一覧',     'coreto-cases-v2.html'],
          ['パイプライン',     'coreto-pipeline-v2.html'],
          ['成約報告一覧',     'coreto-contract-report-v2.html'],
          ['送金管理',         'coreto-remittance-v2.html'],
          ['給与明細',         'coreto-payment-v2.html'],
          ['ユーザー管理',     'coreto-user-mgmt-v2.html'],
          ['IT重説管理',       'coreto-itsetsu-hq-v2.html'],
          ['CRM',              'coreto-crm-v2.html'],
        ]
      : roleInfo.role === 'pt'
      ? [
          ['PTポータル',       'coreto-pt-portal-v2.html'],
          ['ランク・報酬',     'coreto-rank-v2.html'],
        ]
      : [
          ['担当案件一覧',     'coreto-cases-v2.html'],
          ['成約報告',         'coreto-contract-report-v2.html'],
          ['内見管理',         'coreto-showing-v2.html'],
          ['書類審査',         'coreto-screening-v2.html'],
          ['ランク・報酬',     'coreto-rank-v2.html'],
        ];

    const roleResults = [];
    for (const [pageName, pageFile] of pagesToCheck) {
      const url    = `${BASE_URL}/${pageFile}`;
      const issues = await checkPage(page, url, roleInfo.label);
      roleResults.push({ page: pageName, url: pageFile, issues });
      totalIssues += issues.filter(i => i.level !== 'INFO').length;

      const e = issues.filter(i => i.level === 'ERROR').length;
      const w = issues.filter(i => i.level === 'WARN').length;
      if (e > 0 || w > 0) {
        console.log(`  ${C.yellow('⚠')} ${pageName}: エラー${e} 警告${w}`);
        for (const iss of issues.filter(i => i.level !== 'INFO')) {
          const lv = iss.level === 'ERROR' ? C.red('[ERR]') : C.yellow('[WRN]');
          console.log(`     ${lv} ${C.cyan(`[${iss.type}]`)} ${iss.detail}`);
        }
      } else {
        console.log(`  ${C.green('✅')} ${pageName}`);
      }
    }

    // コンソールエラー
    if (consoleErrors.length > 0) {
      console.log(`  ${C.red('⚠')} コンソールエラー${consoleErrors.length}件:`);
      for (const e of consoleErrors.slice(0, 3)) {
        console.log(`     ${C.dim(e)}`);
      }
    }

    allResults[allResults.length - 1].results.push(...roleResults);
    await context.close();
  }

  await browser.close();

  // ────────────────────────────────────────────────────────
  // サマリー
  // ────────────────────────────────────────────────────────
  console.log('\n' + C.bold('═══════════════════════════════════════════════════'));
  if (totalIssues === 0) {
    console.log(C.green('✅ 全ロール・全ページで問題なし'));
  } else {
    console.log(C.bold(`合計問題数: ${C.red(totalIssues + '件')}`));
  }
  console.log('');

  // JSON出力
  const jsonPath = path.join(__dirname, 'browser-report.json');
  fs.writeFileSync(jsonPath, JSON.stringify(allResults, null, 2));
  console.log(C.dim(`JSONレポート: ${jsonPath}`));
  return totalIssues;
}

runBrowserTests().then(n => process.exit(n > 0 ? 1 : 0)).catch(e => {
  console.error(C.red('致命的エラー:'), e);
  process.exit(1);
});
