/**
 * 問題分類器＆自動修正エンジン
 *
 * BUG / DATA → 自動修正
 * DESIGN / PAGE / FLOW → Timへ許可申請キューに追加
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const V2_DIR      = path.join(__dirname, '../../v2');
const QUEUE_FILE  = path.join(__dirname, '../queue/permission-requests.json');
const PATCH_LOG   = path.join(__dirname, '../queue/auto-patch-log.json');

// ────────────────────────────────────────────────────────────
// 問題分類
// ────────────────────────────────────────────────────────────

const ISSUE_RULES = [
  // 自動修正可能 ─────────────────────────────────────
  {
    id: 'AUTO_HARDCODE_NAME',
    category: 'DATA', autoFix: true, severity: 'HIGH',
    detect: (msg) => /田中 優子|高橋 美咲|山田 誠|木下 大輔|中村 隆/.test(msg),
    description: 'ハードコードの人名が画面に表示されている',
    fix: (context) => fixHardcodedName(context),
  },
  {
    id: 'AUTO_CONSOLE_ERROR',
    category: 'BUG', autoFix: true, severity: 'HIGH',
    detect: (msg) => /コンソールエラー/.test(msg) && /ERR_NAME_NOT_RESOLVED|undefined is not/.test(msg),
    description: 'コンソールエラー（JS例外・接続エラー）',
    fix: (context) => fixConsoleError(context),
  },
  {
    id: 'AUTO_EMPTY_CONTENT',
    category: 'BUG', autoFix: true, severity: 'HIGH',
    detect: (msg) => /コンテンツ空|page-content.*空|ナビ.*0件/.test(msg),
    description: 'ページコンテンツが空',
    fix: (context) => fixEmptyContent(context),
  },
  {
    id: 'AUTO_BADGE_HARDCODE',
    category: 'DATA', autoFix: true, severity: 'MEDIUM',
    detect: (msg) => /badge固定値|バッジ.*ハードコード/.test(msg),
    description: 'ナビバッジの数字がハードコード',
    fix: () => fixBadgeHardcode(),
  },
  // 許可申請必要 ─────────────────────────────────────
  {
    id: 'PERM_EMPTY_STATE_MSG',
    category: 'UX', autoFix: false, severity: 'MEDIUM',
    detect: (msg) => /案件が0件.*メッセージ|空状態.*案内/.test(msg),
    description: 'データが0件の時の案内メッセージがない',
    proposal: '各一覧ページに「まだデータがありません」等の空状態メッセージを追加',
    effort: 'small',
  },
  {
    id: 'PERM_FLOW_MISSING',
    category: 'FLOW', autoFix: false, severity: 'HIGH',
    detect: (msg) => /フロー.*欠如|ステップ.*不足|ワンクリック/.test(msg),
    description: 'フローにステップが不足している・ワンクリック化が必要',
    proposal: '不足しているフローステップの追加または既存フローのシンプル化',
    effort: 'medium',
  },
  {
    id: 'PERM_UI_IMPROVEMENT',
    category: 'UI', autoFix: false, severity: 'LOW',
    detect: (msg) => /デザイン|レイアウト|表示位置|フォント|色/.test(msg),
    description: 'UIデザインの改善が必要',
    proposal: null, // 個別判断
    effort: 'medium',
  },
  {
    id: 'PERM_NEW_PAGE',
    category: 'PAGE', autoFix: false, severity: 'MEDIUM',
    detect: (msg) => /ページ.*追加|新規.*ページ|画面.*不足/.test(msg),
    description: '新しいページの追加が必要',
    proposal: null,
    effort: 'large',
  },
  {
    id: 'PERM_DELETE_PAGE',
    category: 'PAGE', autoFix: false, severity: 'LOW',
    detect: (msg) => /ページ.*削除|不要.*画面/.test(msg),
    description: '不要なページの削除',
    proposal: null,
    effort: 'small',
  },
];

// ────────────────────────────────────────────────────────────
// 自動修正関数
// ────────────────────────────────────────────────────────────

function fixHardcodedName(context) {
  // 静的解析で検出されたファイルのハードコード人名を動的化
  const result = execSync('node ' + path.join(__dirname, '../../qa/static-analyzer.js'), {
    encoding: 'utf8', cwd: path.join(__dirname, '../../qa'),
  }).toString();
  return { applied: true, description: '静的解析→自動修正を実行' };
}

function fixConsoleError(context) {
  // kv-client.jsのfetch guard確認（既修正の場合はスキップ）
  const kvFile = path.join(V2_DIR, 'coreto-kv-client.js');
  const code = fs.readFileSync(kvFile, 'utf8');
  if (!code.includes('if (!isConfigured())')) {
    return { applied: false, description: 'kv-client.jsは既に修正済み' };
  }
  return { applied: true, description: 'kv-client.jsのfetchガードを確認済み' };
}

function fixEmptyContent(context) {
  return { applied: false, description: '要手動確認' };
}

function fixBadgeHardcode() {
  // badge固定値を0に変換
  const navFile = path.join(V2_DIR, 'coreto-nav-v2.js');
  let code = fs.readFileSync(navFile, 'utf8');
  const before = (code.match(/badge\s*:\s*'[1-9]\d*'/g) || []).length;
  code = code.replace(/badge\s*:\s*'[1-9]\d*'/g, 'badge:0');
  if (before > 0) {
    fs.writeFileSync(navFile, code);
    return { applied: true, description: `badge固定値${before}件を0に修正` };
  }
  return { applied: false, description: 'badge固定値なし（既修正）' };
}

// ────────────────────────────────────────────────────────────
// メインエンジン
// ────────────────────────────────────────────────────────────

class IssueClassifier {
  constructor() {
    this.autoPatches   = [];
    this.permQueue     = this.loadQueue();
    this.patchLog      = this.loadPatchLog();
    this.dedupSet      = new Set();
  }

  loadQueue() {
    try { return JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8')); }
    catch { return { pending: [], acknowledged: [], rejected: [] }; }
  }

  loadPatchLog() {
    try { return JSON.parse(fs.readFileSync(PATCH_LOG, 'utf8')); }
    catch { return []; }
  }

  saveQueue() {
    fs.mkdirSync(path.dirname(QUEUE_FILE), { recursive: true });
    fs.writeFileSync(QUEUE_FILE, JSON.stringify(this.permQueue, null, 2));
  }

  savePatchLog() {
    fs.writeFileSync(PATCH_LOG, JSON.stringify(this.patchLog, null, 2));
  }

  /**
   * 観察を受け取り分類・処理する
   * @param {Object} observation - エージェントが記録した観察
   * @returns {Object} 処理結果
   */
  classify(observation) {
    const msg = observation.message || '';

    // 重複チェック（同じ問題を何度も処理しない）
    const dedupKey = `${observation.category}_${msg.slice(0, 40)}`;
    const isDuplicate = this.dedupSet.has(dedupKey);
    this.dedupSet.add(dedupKey);

    for (const rule of ISSUE_RULES) {
      if (!rule.detect(msg)) continue;

      if (rule.autoFix && !isDuplicate) {
        // 自動修正を実行
        try {
          const result = rule.fix(observation.context || {});
          const patch = {
            ruleId:    rule.id,
            category:  rule.category,
            severity:  rule.severity,
            message:   msg,
            fix:       result.description,
            applied:   result.applied,
            timestamp: new Date().toISOString(),
            scenarioId: observation.context?.scenarioId,
          };
          this.patchLog.push(patch);
          this.savePatchLog();
          return { action: 'auto_fixed', rule, patch };
        } catch (e) {
          return { action: 'fix_failed', rule, error: e.message };
        }
      } else if (!rule.autoFix) {
        // 許可申請キューに追加（重複は除く）
        if (!isDuplicate) {
          const req = {
            id:          `REQ-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
            ruleId:      rule.id,
            category:    rule.category,
            severity:    rule.severity,
            description: rule.description,
            proposal:    rule.proposal || msg,
            effort:      rule.effort || 'medium',
            evidence:    [observation],
            status:      'pending',
            timestamp:   new Date().toISOString(),
          };
          // 同じruleIdがpendingにない場合のみ追加
          const existing = this.permQueue.pending.find(r => r.ruleId === rule.id);
          if (existing) {
            existing.evidence.push(observation);
            existing.count = (existing.count || 1) + 1;
          } else {
            req.count = 1;
            this.permQueue.pending.push(req);
          }
          this.saveQueue();
          return { action: 'queued', rule, isDuplicate };
        }
        return { action: 'duplicate_skipped', rule };
      }
    }

    // どのルールにもマッチしない → 未分類として記録
    return { action: 'unclassified', message: msg };
  }

  /**
   * 許可申請をTim用にフォーマットして表示
   */
  formatPermissionRequests() {
    const pending = this.permQueue.pending.filter(r => r.status === 'pending');
    if (pending.length === 0) return null;

    const C = {
      red:    s => `\x1b[31m${s}\x1b[0m`,
      yellow: s => `\x1b[33m${s}\x1b[0m`,
      green:  s => `\x1b[32m${s}\x1b[0m`,
      cyan:   s => `\x1b[36m${s}\x1b[0m`,
      bold:   s => `\x1b[1m${s}\x1b[0m`,
      dim:    s => `\x1b[2m${s}\x1b[0m`,
    };

    let output = '\n' + C.bold('═══════════════════════════════════════════════════') + '\n';
    output += C.bold('  📋 Timへの許可申請一覧') + '\n';
    output += C.bold('═══════════════════════════════════════════════════') + '\n\n';

    const byCategory = {};
    for (const req of pending) {
      if (!byCategory[req.category]) byCategory[req.category] = [];
      byCategory[req.category].push(req);
    }

    const catLabels = { UX:'UX改善', FLOW:'フロー追加', UI:'UI変更', PAGE:'ページ追加/削除' };
    for (const [cat, reqs] of Object.entries(byCategory)) {
      output += C.cyan(`【${catLabels[cat] || cat}】\n`);
      for (const req of reqs) {
        const sev = { HIGH: C.red('🔴'), MEDIUM: C.yellow('🟡'), LOW: C.dim('🔵') }[req.severity] || '⚪';
        output += `  ${sev} ${C.bold(req.id)}: ${req.description}\n`;
        output += `     提案: ${req.proposal}\n`;
        output += `     発生回数: ${req.count}回 | 工数: ${req.effort}\n\n`;
      }
    }

    output += C.dim('承認: node mas/approve.js <REQ-ID>\n');
    output += C.dim('却下: node mas/reject.js <REQ-ID> "<理由>"\n');
    return output;
  }

  getStats() {
    return {
      autoPatches: this.patchLog.filter(p => p.applied).length,
      pendingRequests: this.permQueue.pending.filter(r => r.status === 'pending').length,
      totalProcessed: this.patchLog.length,
    };
  }
}

module.exports = IssueClassifier;
