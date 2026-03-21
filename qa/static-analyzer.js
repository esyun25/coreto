/**
 * COREBLDG v2 静的解析ツール
 * ハードコードデータ / CSS重複 / 構文エラー / badge固定値 / サイドバー統一 を検出
 */

const fs   = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const V2_DIR = path.join(__dirname, '../v2');
const files  = fs.readdirSync(V2_DIR).filter(f => f.endsWith('.html') || f.endsWith('.js')).sort();

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
// 検査定義
// ────────────────────────────────────────────────────────────

// ① ハードコードされたデモデータ
const DUMMY_PATTERNS = [
  { name:'デモ人名',   re:/田中 優子|高橋 美咲|鈴木 健太|山田 誠|大橋 幸代|渡辺 誠|伊藤 花子|木下 大輔|田中 誠一/ },
  { name:'デモ案件ID', re:/RENT-0[1-9]\d{2}|SALE-0\d{3}|HR-0\d{3}|UTL-0\d{3}|RC-10\d{3}/ },
  { name:'デモAG-ID',  re:/AG-0(?:042|055|088|033|071|021|034|038|056)\b/ },
  { name:'デモPT-ID',  re:/PT-0(?:015|022|007)\b/ },
  { name:'デモ固定KPI',re:/¥3,840,000|¥540,000|¥2,[0-9]{3},000|47名\b|28件\b|22 pt\b/ },
  { name:'デモ報告ID', re:/RPT-20260[0-9]{8}/ },
];
const DUMMY_EXCLUDE = /USER_CREDENTIALS|sessionStorage|demoLogin|placeholder=|\/\*|pw:|Coreto2026!|agent2026|partner26|intern26|data-kpi=|coreto_user_id|coreto_name|coreto_rank|DEMO_DATA_CLEARED|id="(?:ai-notify|slip-to)|class="bc-total|class="sb-uname.*><script|CORETO-DEMO|demoInit/;

// ② badge固定値（0以外の数字）
const BADGE_FIXED = /badge\s*:\s*'[1-9]\d*'|badge\s*:\s*"[1-9]\d*"/;

// ③ 独自.nav-item CSSが残存（hub-v2以外）
const NAV_ITEM_CSS = /\.nav-item\s*\{/;

// ④ サイドバーHTML標準構造
const SB_STANDARD = /<nav class="sb">/;

// ⑤ CNAV.init呼び出し
const CNAV_INIT = /CNAV\.init\(/;

// ────────────────────────────────────────────────────────────
// 各ファイルを検査
// ────────────────────────────────────────────────────────────

let totalIssues = 0;
const report = [];

for (const fname of files) {
  const fpath = path.join(V2_DIR, fname);
  const code  = fs.readFileSync(fpath, 'utf8');
  const lines = code.split('\n');
  const issues = [];

  // ── 1. 構文チェック ──────────────────────────────────────
  if (fname.endsWith('.js')) {
    fs.writeFileSync('/tmp/qa_sc.js', code);
    try { execSync('node --check /tmp/qa_sc.js', { stdio: 'pipe' }); }
    catch (e) {
      const msg = e.stderr.toString().split('\n')[0];
      if (!msg.match(/Unexpected end|end of input/)) {
        issues.push({ level: 'ERROR', type: '構文エラー', line: '—', detail: msg });
      }
    }
  } else {
    const scriptBlocks = [...code.matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g)];
    for (let i = 0; i < scriptBlocks.length; i++) {
      fs.writeFileSync('/tmp/qa_sc.js', scriptBlocks[i][1]);
      try { execSync('node --check /tmp/qa_sc.js', { stdio: 'pipe' }); }
      catch (e) {
        const msg = e.stderr.toString().split('\n')[0];
        if (!msg.match(/Unexpected end|end of input/)) {
          issues.push({ level: 'ERROR', type: '構文エラー', line: `script#${i}`, detail: msg });
        }
      }
    }
  }

  if (fname.endsWith('.html')) {
    // ── 2. ハードコードデータ ──────────────────────────────
    // HTML部分とJS部分を別々にチェック
    const htmlOnly = code.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<!--[\s\S]*?-->/g, '');
    const jsOnly   = (code.match(/<script[^>]*>([\s\S]*?)<\/script>/g) || []).join('\n');

    for (const p of DUMMY_PATTERNS) {
      for (const [idx, line] of lines.entries()) {
        if (!p.re.test(line)) continue;
        if (DUMMY_EXCLUDE.test(line)) continue;
        const s = line.trim();
        if (s.startsWith('//') || s.startsWith('*') || s.startsWith('/*')) continue;
        if (/pw:|Coreto2026!|agent2026/.test(s)) continue;
        issues.push({ level: 'WARN', type: `ハードコード[${p.name}]`, line: idx + 1, detail: s.slice(0, 80) });
      }
    }

    // ── 3. badge固定値 ────────────────────────────────────
    for (const [idx, line] of lines.entries()) {
      if (BADGE_FIXED.test(line) && !line.trim().startsWith('//')) {
        issues.push({ level: 'WARN', type: 'badge固定値', line: idx + 1, detail: line.trim().slice(0, 80) });
      }
    }

    // ── 4. nav-item残存CSS（hub-v2除く）──────────────────
    if (fname !== 'coreto-hub-v2.html') {
      const styleBlocks = [...code.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)];
      for (const sm of styleBlocks) {
        if (NAV_ITEM_CSS.test(sm[1])) {
          const lineNo = code.slice(0, sm.index).split('\n').length;
          issues.push({ level: 'WARN', type: '.nav-item CSS残存', line: lineNo, detail: '.nav-item{...} → CNAVのINJECT_CSSと競合' });
        }
      }
    }

    // ── 5. サイドバー構造チェック ────────────────────────
    const hasSb   = SB_STANDARD.test(code);
    const hasCnav = CNAV_INIT.test(code);
    if (!hasSb && hasCnav) {
      issues.push({ level: 'WARN', type: 'サイドバー構造', line: '—', detail: '<nav class="sb">がない / CNAV.initは呼んでいる' });
    }

    // ── 6. sb-unameのハードコード ────────────────────────
    for (const [idx, line] of lines.entries()) {
      if (/id="sb-(?:uname|name|un)"/.test(line) && />[^<]{2,20}<\//.test(line)) {
        const m = line.match(/>(.*?)<\//);
        if (m && m[1].trim() !== '—' && m[1].trim() !== '' && !/<script/.test(m[1])) {
          issues.push({ level: 'WARN', type: 'sb-nameハードコード', line: idx + 1, detail: `"${m[1].trim()}" → sessionStorage動的取得に` });
        }
      }
    }
  }

  if (fname.endsWith('.js') && fname !== 'coreto-nav-v2.js') {
    // ── 7. JS内のbadge固定値 ──────────────────────────────
    for (const [idx, line] of lines.entries()) {
      if (BADGE_FIXED.test(line) && !line.trim().startsWith('//')) {
        issues.push({ level: 'WARN', type: 'badge固定値(JS)', line: idx + 1, detail: line.trim().slice(0, 80) });
      }
    }
  }

  if (issues.length) {
    totalIssues += issues.length;
    report.push({ fname, issues });
  }
}

// ────────────────────────────────────────────────────────────
// レポート出力
// ────────────────────────────────────────────────────────────

console.log('\n' + C.bold('═══════════════════════════════════════════════════'));
console.log(C.bold(' COREBLDG v2 静的解析レポート'));
console.log(C.bold('═══════════════════════════════════════════════════'));
console.log(C.dim(`  対象ファイル: ${files.length}件  |  検出: ${totalIssues}件\n`));

for (const { fname, issues } of report) {
  const errCount  = issues.filter(i => i.level === 'ERROR').length;
  const warnCount = issues.filter(i => i.level === 'WARN').length;
  const prefix    = errCount > 0 ? C.red('❌') : C.yellow('⚠️ ');
  console.log(`${prefix} ${C.bold(fname)}  ${C.dim(`(エラー:${errCount} / 警告:${warnCount})`)}`);
  for (const iss of issues) {
    const lv   = iss.level === 'ERROR' ? C.red('[ERR]') : C.yellow('[WRN]');
    const type = C.cyan(`[${iss.type}]`);
    const line = iss.line !== '—' ? C.dim(`L${iss.line}: `) : '       ';
    console.log(`   ${lv} ${type} ${line}${iss.detail}`);
  }
  console.log('');
}

if (totalIssues === 0) {
  console.log(C.green('✅ 問題なし'));
} else {
  const errs = report.flatMap(r => r.issues).filter(i => i.level === 'ERROR').length;
  console.log(C.bold(`合計: エラー ${C.red(errs + '件')} / 警告 ${C.yellow((totalIssues - errs) + '件')}`));
}
console.log('');

// JSON出力（CI用）
const jsonPath = path.join(__dirname, 'static-report.json');
fs.writeFileSync(jsonPath, JSON.stringify({ totalIssues, report }, null, 2));
console.log(C.dim(`JSONレポート: ${jsonPath}`));

process.exit(totalIssues > 0 ? 1 : 0);
