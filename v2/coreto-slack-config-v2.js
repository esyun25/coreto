// ============================================================
//  CORETO SLACK 通知モジュール v2
//  coreto-slack-config-v2.js
//
//  使い方:
//    <script src="coreto-slack-config-v2.js"></script>
//    → window.SLACK (設定オブジェクト)
//    → window.slackPost(channel, payload) で送信
//    → window.slackNotifyXxx(data) で各通知
//
//  設定はlocalStorage: CORETO_SLACK_CONFIG
//  管理UI: coreto-admin-rbac-v2.html の「Slack設定」タブ
// ============================================================

(function() {
  'use strict';

  // ── デフォルト設定（localStorageで上書き可能）────────────────
  var DEFAULTS = {
    ENABLED: false,
    GENERAL:    '',   // #general / 汎用通知
    SIGNUP:     '',   // #ag-signup  AG/PT入会申込
    KYC:        '',   // #kyc-審査   本人確認審査
    CONTRACT:   '',   // #成約報告   成約・契約書
    ITSETSU:    '',   // #重説管理   IT重説
    HR:         '',   // #hr-案件    人材案件
    PAYMENT:    '',   // #入金管理   即時払い・振込
    PAYROLL:    '',   // #月次給与   月次報酬確定
    RANK:       '',   // #ランク管理 ランク変更
    HQ_ONBOARD: '',   // #hq-内部    HQ新規入会
  };

  // localStorage から設定を読み込む
  function loadConfig() {
    try {
      var stored = JSON.parse(localStorage.getItem('CORETO_SLACK_CONFIG') || '{}');
      var cfg = {};
      Object.keys(DEFAULTS).forEach(function(k) {
        cfg[k] = (stored[k] !== undefined) ? stored[k] : DEFAULTS[k];
      });
      return cfg;
    } catch(e) { return Object.assign({}, DEFAULTS); }
  }

  // ── 共通POST関数 ──────────────────────────────────────────
  window.slackPost = function(channel, payload) {
    var cfg = loadConfig();
    if (!cfg.ENABLED) return Promise.resolve();
    var url = cfg[channel] || cfg.GENERAL || '';
    if (!url || url.startsWith('YOUR_') || url.length < 20) return Promise.resolve();
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      mode: 'no-cors',
    }).catch(function(e) { console.warn('[SLACK]', channel, e); });
  };

  // ── ブロックヘルパー ─────────────────────────────────────
  function hdr(t)  { return { type:'header',  text:{ type:'plain_text', text:t, emoji:true } }; }
  function sec(m)  { return { type:'section', text:{ type:'mrkdwn', text:m } }; }
  function flds(p) { return { type:'section', fields: p.map(function(x){ return { type:'mrkdwn', text:'*'+x[0]+'*\n'+x[1] }; }) }; }
  function ctx(t)  { return { type:'context', elements:[{ type:'mrkdwn', text:t }] }; }
  function div()   { return { type:'divider' }; }
  function now()   { return new Date().toLocaleString('ja-JP'); }

  // ══════════════════════════════════════════════════════════
  //  通知関数
  // ══════════════════════════════════════════════════════════

  // ── AG/PT 入会申込 ────────────────────────────────────────
  window.slackNotifySignup = function(data) {
    // data: { name, id, type, rankLabel, email, tel, inviteCode, ts }
    return slackPost('SIGNUP', {
      text: '🆕 入会申込: ' + data.name,
      blocks: [
        hdr('🆕 入会申込を受け付けました'),
        flds([
          ['氏名',       data.name],
          ['種別',       data.type],
          ['ランク',     data.rankLabel || '—'],
          ['連絡先',     data.email || '—'],
        ]),
        ctx('招待コード: ' + (data.inviteCode||'—') + '　|　' + (data.ts||now()) + '　|　COREBLDGシステム'),
      ],
    });
  };

  // ── KYC 申請 ─────────────────────────────────────────────
  window.slackNotifyKycSubmit = function(data) {
    // data: { name, id, docType, ts }
    return slackPost('KYC', {
      text: '📋 KYC申請: ' + data.name,
      blocks: [
        hdr('📋 本人確認書類が提出されました'),
        flds([
          ['氏名 / ID', data.name + ' / ' + data.id],
          ['書類種別',  data.docType || '—'],
        ]),
        sec('AIによる解析後、HQで最終確認してください。'),
        ctx(now() + '　|　COREBLDGシステム'),
      ],
    });
  };

  // ── KYC 承認 ─────────────────────────────────────────────
  window.slackNotifyKycApprove = function(data) {
    // data: { name, id, reviewer, ts }
    return slackPost('KYC', {
      text: '✅ KYC承認: ' + data.name,
      blocks: [
        hdr('✅ 本人確認が承認されました'),
        flds([
          ['氏名 / ID', data.name + ' / ' + data.id],
          ['承認者',    data.reviewer || '—'],
        ]),
        ctx(now() + '　|　COREBLDGシステム'),
      ],
    });
  };

  // ── KYC 否認 ─────────────────────────────────────────────
  window.slackNotifyKycReject = function(data) {
    // data: { name, id, reason, reviewer }
    return slackPost('KYC', {
      text: '❌ KYC否認: ' + data.name,
      blocks: [
        hdr('❌ 本人確認が否認されました'),
        flds([
          ['氏名 / ID', data.name + ' / ' + data.id],
          ['否認理由',  data.reason || '—'],
          ['担当者',    data.reviewer || '—'],
        ]),
        ctx(now() + '　|　COREBLDGシステム'),
      ],
    });
  };

  // ── 成約報告 ─────────────────────────────────────────────
  window.slackNotifyContractReport = function(data) {
    // data: { caseId, clientName, type, fee, agName, agId, ts }
    return slackPost('CONTRACT', {
      text: '🏆 成約報告: ' + data.clientName + ' 様',
      blocks: [
        hdr('🏆 成約報告が提出されました'),
        flds([
          ['案件ID',     data.caseId],
          ['クライアント', data.clientName + ' 様'],
          ['種別',       data.type],
          ['仲介料',     '¥' + Math.round(data.fee||0).toLocaleString()],
          ['担当AG',     data.agName + ' (' + data.agId + ')'],
        ]),
        ctx(now() + '　|　COREBLDGシステム'),
      ],
    });
  };

  // ── 成約報告 承認 ────────────────────────────────────────
  window.slackNotifyContractApprove = function(data) {
    // data: { caseId, clientName, fee, agName, reviewer }
    return slackPost('CONTRACT', {
      text: '✅ 成約承認: ' + data.clientName + ' 様（' + data.caseId + '）',
      blocks: [
        hdr('✅ 成約報告が承認されました'),
        flds([
          ['案件ID',   data.caseId],
          ['仲介料',   '¥' + Math.round(data.fee||0).toLocaleString()],
          ['担当AG',   data.agName],
          ['承認者',   data.reviewer || '—'],
        ]),
        ctx(now() + '　|　COREBLDGシステム'),
      ],
    });
  };

  // ── IT重説 予約 ──────────────────────────────────────────
  window.slackNotifyItsetsuBooking = function(data) {
    // data: { caseId, clientName, date, start, agName }
    return slackPost('ITSETSU', {
      text: '📅 IT重説予約: ' + data.clientName + ' 様',
      blocks: [
        hdr('📅 IT重説予約が入りました'),
        flds([
          ['案件ID',        data.caseId],
          ['クライアント',  data.clientName + ' 様'],
          ['希望日時',      (data.date||'—') + ' ' + (data.start||'')],
          ['担当AG',        data.agName || '—'],
        ]),
        sec('宅建士の割当をお願いします。'),
        ctx(now() + '　|　COREBLDGシステム'),
      ],
    });
  };

  // ── IT重説 完了 ──────────────────────────────────────────
  window.slackNotifyItsetsuComplete = function(data) {
    // data: { caseId, clientName, takkName, completedAt }
    return slackPost('ITSETSU', {
      text: '✅ IT重説完了: ' + data.clientName + ' 様',
      blocks: [
        hdr('✅ IT重説が完了しました'),
        flds([
          ['案件ID',        data.caseId],
          ['クライアント',  data.clientName + ' 様'],
          ['担当宅建士',    data.takkName || '—'],
          ['完了日時',      data.completedAt || now()],
        ]),
        ctx('COREBLDGシステム'),
      ],
    });
  };

  // ── HR 案件 HQ対応依頼 ──────────────────────────────────
  window.slackNotifyHrNeedsHQ = function(data) {
    // data: { caseId, clientName, agName, reason }
    return slackPost('HR', {
      text: '🆘 HR HQ対応依頼: ' + data.clientName,
      blocks: [
        hdr('🆘 HR案件でHQ対応が必要です'),
        flds([
          ['案件ID',   data.caseId || '—'],
          ['担当AG',   data.agName || '—'],
          ['理由',     data.reason || '—'],
        ]),
        ctx(now() + '　|　COREBLDGシステム'),
      ],
    });
  };

  // ── 即時払い 申請 ────────────────────────────────────────
  window.slackNotifyInstantPayRequest = function(data) {
    // data: { reqId, agName, agId, amount, fee, payout, ts }
    return slackPost('PAYMENT', {
      text: '💸 即時払い申請: ' + data.agName,
      blocks: [
        hdr('💸 即時払い申請が届きました'),
        flds([
          ['AG',       data.agName + ' (' + (data.agId||'—') + ')'],
          ['申請額',   '¥' + Math.round(data.amount||0).toLocaleString()],
          ['手数料',   '¥' + Math.round(data.fee||0).toLocaleString()],
          ['振込予定', '¥' + Math.round(data.payout||0).toLocaleString()],
        ]),
        ctx('申請ID: ' + (data.reqId||'—') + '　|　' + (data.ts||now()) + '　|　COREBLDGシステム'),
      ],
    });
  };

  // ── 即時払い 振込完了 ────────────────────────────────────
  window.slackNotifyInstantPayDone = function(data) {
    // data: { id, agName, amount, ts }
    return slackPost('PAYMENT', {
      text: '✅ 即時払い振込: ' + data.agName + ' ¥' + Math.round(data.amount||0).toLocaleString(),
      blocks: [
        hdr('✅ 即時払い振込完了'),
        flds([
          ['AG',     data.agName],
          ['振込額', '¥' + Math.round(data.amount||0).toLocaleString()],
        ]),
        ctx('申請ID: ' + (data.id||'—') + '　|　' + (data.ts||now()) + '　|　COREBLDGシステム'),
      ],
    });
  };

  // ── 月次報酬 確定 ────────────────────────────────────────
  window.slackNotifyPayroll = function(data) {
    // data: { month, count, total }
    return slackPost('PAYROLL', {
      text: '💴 月次報酬確定: ' + data.month,
      blocks: [
        hdr('💴 月次報酬が確定されました'),
        flds([
          ['対象月',   data.month],
          ['振込件数', (data.count||0) + '名'],
          ['振込総額', '¥' + Math.round(data.total||0).toLocaleString()],
        ]),
        ctx(now() + '　|　COREBLDGシステム'),
      ],
    });
  };

  // ── ランク変更 ───────────────────────────────────────────
  window.slackNotifyRankChange = function(data) {
    // data: { agName, agId, oldRank, newRank, reviewer }
    var up = data.newRank > data.oldRank;
    return slackPost('RANK', {
      text: (up?'🎉':'📉') + ' ランク変更: ' + data.agName + ' ' + data.oldRank + ' → ' + data.newRank,
      blocks: [
        hdr((up?'🎉 ランク昇格':'📉 ランク変更')),
        flds([
          ['AG',         data.agName + ' (' + (data.agId||'—') + ')'],
          ['変更',       data.oldRank + '  →  ' + data.newRank],
          ['担当HQ',     data.reviewer || '—'],
        ]),
        ctx(now() + '　|　COREBLDGシステム'),
      ],
    });
  };

  // ── HQ新規入会 ──────────────────────────────────────────
  window.slackNotifyHqOnboard = function(data) {
    // data: { id, name, hqRole }
    var roleLabel = {exec:'👑 経営者',manager:'🔑 マネージャー',staff:'👤 社員',part:'⏰ パート'}[data.hqRole] || data.hqRole;
    return slackPost('HQ_ONBOARD', {
      text: '🆕 HQ入会: ' + data.name + ' (' + data.id + ')',
      blocks: [
        hdr('🆕 HQメンバーが初回登録を完了しました'),
        flds([
          ['HQ ID',  data.id],
          ['氏名',   data.name],
          ['役職',   roleLabel],
        ]),
        ctx(now() + '　|　COREBLDGシステム'),
      ],
    });
  };

  // ── 設定確認テスト送信 ──────────────────────────────────
  window.slackTestSend = function(channel) {
    var cfg = loadConfig();
    var url = cfg[channel] || '';
    if (!url || url.length < 20) return Promise.reject(new Error('URL未設定'));
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: '🔔 COREBLDGシステム — Slack通知テスト（チャンネル: ' + channel + '）',
        blocks: [
          { type:'section', text:{ type:'mrkdwn', text:'✅ *Slack通知の接続テストです。*\nCOREBLDGシステムから送信されました。\nチャンネル: `' + channel + '`' } },
          { type:'context', elements:[{ type:'mrkdwn', text:now() + '　|　COREBLDGシステム' }] },
        ],
      }),
      mode: 'no-cors',
    });
  };

  // ── SLACK 設定アクセサ ──────────────────────────────────
  window.SLACK = {
    load:    loadConfig,
    save:    function(cfg) {
      localStorage.setItem('CORETO_SLACK_CONFIG', JSON.stringify(cfg));
    },
    isEnabled: function() { return loadConfig().ENABLED; },
    CHANNELS: {
      GENERAL: '#general / 汎用通知',
      SIGNUP:  '#ag-signup（入会申込）',
      KYC:     '#kyc-審査（本人確認）',
      CONTRACT:'#成約報告',
      ITSETSU: '#重説管理',
      HR:      '#hr-案件',
      PAYMENT: '#入金管理（即時払い）',
      PAYROLL: '#月次給与',
      RANK:    '#ランク管理',
      HQ_ONBOARD:'#hq-内部（HQ入会）',
    },
  };

})();
