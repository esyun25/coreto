#!/usr/bin/env node
/**
 * 許可申請 承認/却下スクリプト
 *
 * 使い方:
 *   node mas/approve.js REQ-xxxx         # 承認
 *   node mas/approve.js all              # 全件承認
 *   node mas/reject.js REQ-xxxx "理由"   # 却下
 *   node mas/review.js                   # 一覧表示
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const QUEUE_FILE = path.join(__dirname, 'queue/permission-requests.json');

const C = {
  red:    s => `\x1b[31m${s}\x1b[0m`,
  yellow: s => `\x1b[33m${s}\x1b[0m`,
  green:  s => `\x1b[32m${s}\x1b[0m`,
  cyan:   s => `\x1b[36m${s}\x1b[0m`,
  bold:   s => `\x1b[1m${s}\x1b[0m`,
  dim:    s => `\x1b[2m${s}\x1b[0m`,
};

function loadQueue() {
  try { return JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8')); }
  catch { return { pending: [], acknowledged: [], rejected: [] }; }
}
function saveQueue(q) { fs.writeFileSync(QUEUE_FILE, JSON.stringify(q, null, 2)); }

const script = path.basename(process.argv[1]);
const arg    = process.argv[2];
const reason = process.argv[3] || '';

const queue = loadQueue();

if (script === 'review.js' || (!arg && script !== 'approve.js')) {
  // 一覧表示
  const pending = queue.pending.filter(r => r.status === 'pending');
  console.log(C.bold(`\n許可申請一覧 (${pending.length}件)\n`));
  for (const req of pending) {
    const sev = { HIGH: C.red('🔴'), MEDIUM: C.yellow('🟡'), LOW: C.dim('🔵') }[req.severity] || '⚪';
    console.log(`  ${sev} ${C.bold(req.id)} [${req.category}] ${req.description}`);
    console.log(`     提案: ${req.proposal}`);
    console.log(`     発生: ${req.count}回 | 工数: ${req.effort}`);
    console.log('');
  }
  if (pending.length === 0) console.log(C.green('  許可申請なし\n'));
  process.exit(0);
}

if (script === 'approve.js') {
  if (arg === 'all') {
    let cnt = 0;
    for (const req of queue.pending) {
      if (req.status === 'pending') { req.status = 'approved'; req.approvedAt = new Date().toISOString(); cnt++; }
    }
    saveQueue(queue);
    console.log(C.green(`✅ ${cnt}件を全て承認しました`));
  } else {
    const req = queue.pending.find(r => r.id === arg);
    if (!req) { console.log(C.red(`❌ ${arg} が見つかりません`)); process.exit(1); }
    req.status = 'approved'; req.approvedAt = new Date().toISOString();
    saveQueue(queue);
    console.log(C.green(`✅ ${req.id} を承認: ${req.description}`));
    console.log(C.dim('  → 次回のシミュレーション実行時に修正が適用されます'));
  }
} else if (script === 'reject.js') {
  const req = queue.pending.find(r => r.id === arg);
  if (!req) { console.log(C.red(`❌ ${arg} が見つかりません`)); process.exit(1); }
  req.status = 'rejected'; req.rejectedAt = new Date().toISOString(); req.rejectReason = reason;
  saveQueue(queue);
  console.log(C.yellow(`⏭ ${req.id} を却下: ${reason || '理由なし'}`));
}
