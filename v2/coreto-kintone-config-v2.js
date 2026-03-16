// ============================================================
//  CORETO Kintone データアクセスモジュール v1
//  coreto-kintone-config-v2.js
//
//  使い方:
//    <script src="coreto-kintone-config-v2.js"></script>
//    → window.KINTONE.getUsers()       ユーザー一覧
//    → window.KINTONE.getReports()     成約報告一覧
//    → window.KINTONE.getCases()       案件一覧
//    → window.KINTONE.getPayouts()     振込対象データ
//    → window.KINTONE.post(appKey, record)  レコード登録
//
//  設定: localStorage の CORETO_KINTONE_CONFIG に保存
//    { subdomain, apiToken, apps: { users, reports, cases, ... } }
//  管理UI: coreto-admin-rbac-v2.html の「Kintone設定」タブ
//
//  ── モード切り替え ──────────────────────────────────────────
//  CORETO_KINTONE_CONFIG が未設定 → デモデータ（localStorage/固定値）を返す
//  CORETO_KINTONE_CONFIG が設定済み → Kintone REST APIを叩く
//
//  各関数は共通シグネチャ:
//    async KINTONE.getXxx(params) → { ok: true, records: [...] }
//                                 | { ok: false, error: '...' }
// ============================================================

(function () {
  'use strict';

  // ── Kintoneアプリキー定義（連携時にアプリIDを設定）──────────
  // 各アプリキーに対応するKintone APP IDをadmin設定タブで設定する
  var APP_KEYS = {
    users:       'KINTONE_APP_USERS',        // AGマスター・HQユーザーマスター
    reports:     'KINTONE_APP_REPORTS',      // 成約報告
    cases:       'KINTONE_APP_CASES',        // 案件（不動産パイプライン）
    payouts:     'KINTONE_APP_PAYOUTS',      // 支払い履歴（即時払い・通常振込）
    kyc:         'KINTONE_APP_KYC',          // KYC申請
    applicants:  'KINTONE_APP_APPLICANTS',   // AG応募者
    payments:    'KINTONE_APP_PAYMENTS',     // クライアント入金管理
    training:    'KINTONE_APP_TRAINING',     // 研修完了記録
  };

  // ── 設定読み込み ─────────────────────────────────────────────
  function loadConfig() {
    try {
      return JSON.parse(localStorage.getItem('CORETO_KINTONE_CONFIG') || '{}');
    } catch (e) { return {}; }
  }

  function isConfigured() {
    var cfg = loadConfig();
    return !!(cfg.subdomain && cfg.apiToken);
  }

  // ── Kintone REST API 共通フェッチ ────────────────────────────
  async function kintoneGet(appKey, query, fields) {
    var cfg = loadConfig();
    var appId = cfg.apps && cfg.apps[appKey];
    if (!appId) throw new Error('AppID未設定: ' + appKey + ' — admin設定タブで設定してください');

    var params = new URLSearchParams({ app: appId });
    if (query)  params.set('query', query);
    if (fields) params.set('fields[0]', fields.join(','));

    var resp = await fetch(
      'https://' + cfg.subdomain + '.cybozu.com/k/v1/records.json?' + params,
      { headers: { 'X-Cybozu-API-Token': cfg.apiToken } }
    );
    if (!resp.ok) throw new Error('Kintone API error: ' + resp.status);
    var data = await resp.json();
    return data.records || [];
  }

  async function kintonePost(appKey, record) {
    var cfg = loadConfig();
    var appId = cfg.apps && cfg.apps[appKey];
    if (!appId) throw new Error('AppID未設定: ' + appKey);

    var resp = await fetch(
      'https://' + cfg.subdomain + '.cybozu.com/k/v1/record.json',
      {
        method: 'POST',
        headers: {
          'X-Cybozu-API-Token': cfg.apiToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ app: appId, record: record }),
      }
    );
    if (!resp.ok) throw new Error('Kintone POST error: ' + resp.status);
    return await resp.json();
  }

  async function kintonePut(appKey, id, record) {
    var cfg = loadConfig();
    var appId = cfg.apps && cfg.apps[appKey];
    if (!appId) throw new Error('AppID未設定: ' + appKey);

    var resp = await fetch(
      'https://' + cfg.subdomain + '.cybozu.com/k/v1/record.json',
      {
        method: 'PUT',
        headers: {
          'X-Cybozu-API-Token': cfg.apiToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ app: appId, id: id, record: record }),
      }
    );
    if (!resp.ok) throw new Error('Kintone PUT error: ' + resp.status);
    return await resp.json();
  }

  // ── デモデータ読み込みヘルパー ───────────────────────────────
  // Kintone未接続時は localStorage または 固定値を返す
  function demoWarn(fnName) {
    console.info('[KINTONE] ' + fnName + ': デモモード（Kintone未接続）。admin設定タブでKintoneを設定すると実データを取得します。');
  }

  // ============================================================
  //  各データ取得関数
  //  ── フィールドマッピングコメントを必ず記載 ──
  //  Kintone連携時はdemoブロックを削除し、kintoneGetの結果を
  //  同じ形式にマッピングして返す
  // ============================================================

  // ── ユーザー一覧（AGマスター） ───────────────────────────────
  // Kintoneアプリ: AGマスター（APP_KEY: users）
  // フィールドマッピング:
  //   userId     ← ユーザーID（文字列型）
  //   pw         ← パスワード（文字列型）※Kintone連携後は認証APIに移行
  //   role       ← ロール（文字列型: re_ag/hr_ag/hikari_ag/pt/hq/intern）
  //   name       ← 氏名（文字列型）
  //   nameKana   ← 氏名カナ（文字列型）
  //   rank       ← ランク（文字列型: Bronze/Silver/Gold/Platinum/Founder）
  //   phone      ← 電話番号（文字列型）
  //   email      ← メールアドレス（文字列型）
  //   lineUserId ← LINE UserID（文字列型）
  //   bankCode   ← 銀行コード（文字列型）
  //   branchCode ← 支店コード（文字列型）
  //   accountNo  ← 口座番号（文字列型）
  //   accountHolder ← 口座名義カナ（文字列型）
  //   legal      ← 法人フラグ（チェックボックス）
  //   joinedAt   ← 登録日（日付型）
  async function getUsers(params) {
    params = params || {};
    if (!isConfigured()) {
      demoWarn('getUsers');
      // デモ: hub-v2.html の USER_CREDENTIALS をそのまま使用
      var creds = (typeof USER_CREDENTIALS !== 'undefined') ? USER_CREDENTIALS : {};
      return { ok: true, records: Object.values(creds), _demo: true };
    }
    try {
      var query = params.role ? 'role = "' + params.role + '"' : '';
      var raw = await kintoneGet('users', query);
      var records = raw.map(function (r) {
        return {
          userId:    r.userId?.value    || '',
          role:      r.role?.value      || '',
          name:      r.name?.value      || '',
          nameKana:  r.nameKana?.value  || '',
          rank:      r.rank?.value      || '',
          phone:     r.phone?.value     || '',
          email:     r.email?.value     || '',
          legal:     r.legal?.value     === 'true',
          bankCode:  r.bankCode?.value  || '',
          branchCode:r.branchCode?.value|| '',
          accountNo: r.accountNo?.value || '',
          accountHolder: r.accountHolder?.value || '',
          lineUserId:r.lineUserId?.value|| '',
          joinedAt:  r.joinedAt?.value  || '',
          _kintoneId: r['$id']?.value,
        };
      });
      return { ok: true, records: records };
    } catch (e) {
      console.error('[KINTONE] getUsers:', e.message);
      return { ok: false, error: e.message, records: [] };
    }
  }

  // ── 成約報告一覧 ─────────────────────────────────────────────
  // Kintoneアプリ: 成約報告（APP_KEY: reports）
  // フィールドマッピング:
  //   id         ← 報告ID（文字列型: RPT-XXXXXXXX）
  //   case       ← 案件番号（文字列型: RENT-XXXX）
  //   client     ← クライアント氏名（文字列型）
  //   type       ← 種別（文字列型: 賃貸/売買/人材/光通信）
  //   fee        ← 仲介料（数値型）
  //   adFee      ← 広告料（数値型）
  //   reward     ← AG報酬（数値型）
  //   date       ← 成約日（日付型）
  //   ag         ← 担当AG氏名（文字列型）
  //   agId       ← 担当AG ID（文字列型）
  //   status     ← ステータス（文字列型: 承認待ち/承認済み/修正依頼）
  //   approvedAt ← 承認日時（日時型）
  async function getReports(params) {
    params = params || {};
    if (!isConfigured()) {
      demoWarn('getReports');
      var stored = [];
      try { stored = JSON.parse(localStorage.getItem('CORETO_REPORTS') || '[]'); } catch (e) {}
      if (params.agId) stored = stored.filter(function (r) { return r.agId === params.agId; });
      if (params.status) stored = stored.filter(function (r) { return r.status === params.status; });
      return { ok: true, records: stored, _demo: true };
    }
    try {
      var conditions = [];
      if (params.agId)   conditions.push('agId = "' + params.agId + '"');
      if (params.status) conditions.push('status = "' + params.status + '"');
      var query = conditions.join(' and ');
      var raw = await kintoneGet('reports', query);
      var records = raw.map(function (r) {
        return {
          id:        r.reportId?.value   || '',
          case:      r.caseId?.value     || '',
          client:    r.clientName?.value || '',
          type:      r.reportType?.value || '',
          fee:       Number(r.fee?.value)       || 0,
          adFee:     Number(r.adFee?.value)     || 0,
          reward:    Number(r.agCommission?.value) || 0,
          date:      r.closedAt?.value   || '',
          ag:        r.agName?.value     || '',
          agId:      r.agId?.value       || '',
          status:    r.status?.value     || '',
          approvedAt:r.approvedAt?.value || '',
          _kintoneId: r['$id']?.value,
        };
      });
      return { ok: true, records: records };
    } catch (e) {
      console.error('[KINTONE] getReports:', e.message);
      return { ok: false, error: e.message, records: [] };
    }
  }

  // ── 案件一覧（パイプライン） ──────────────────────────────────
  // Kintoneアプリ: 案件（APP_KEY: cases）
  // フィールドマッピング:
  //   id         ← 案件番号（文字列型: RENT-XXXX）
  //   client     ← クライアント氏名（文字列型）
  //   type       ← 種別（文字列型: 賃貸/売買/人材/光通信）
  //   agId       ← 担当AG ID（文字列型）
  //   step       ← パイプラインステップ（数値型: 1〜6）
  //   rent       ← 月額賃料（数値型）
  //   fee        ← 仲介料（数値型）
  //   propName   ← 物件名（文字列型）
  //   propAddr   ← 物件住所（文字列型）
  //   mgmtCo     ← 管理会社（文字列型）
  //   status     ← ステータス（文字列型: active/completed/cancelled）
  //   createdAt  ← 登録日時（日時型）
  async function getCases(params) {
    params = params || {};
    if (!isConfigured()) {
      demoWarn('getCases');
      var stored = [];
      try { stored = JSON.parse(localStorage.getItem('CORETO_CASES') || '[]'); } catch (e) {}
      if (!stored.length) stored = (typeof DEMO_CASES !== 'undefined') ? DEMO_CASES : [];
      if (params.agId) stored = stored.filter(function (r) { return r.agId === params.agId; });
      return { ok: true, records: stored, _demo: true };
    }
    try {
      var conditions = [];
      if (params.agId)   conditions.push('agId = "' + params.agId + '"');
      if (params.status) conditions.push('status = "' + params.status + '"');
      var query = conditions.join(' and ');
      var raw = await kintoneGet('cases', query);
      var records = raw.map(function (r) {
        return {
          id:       r.caseId?.value     || '',
          client:   r.clientName?.value || '',
          type:     r.caseType?.value   || '',
          agId:     r.agId?.value       || '',
          step:     Number(r.pipelineStep?.value) || 1,
          rent:     Number(r.monthlyRent?.value)  || 0,
          fee:      Number(r.fee?.value)           || 0,
          propName: r.propertyName?.value          || '',
          propAddr: r.propertyAddress?.value       || '',
          mgmtCo:  r.managementCompany?.value      || '',
          status:   r.status?.value                || '',
          createdAt:r.createdAt?.value             || '',
          _kintoneId: r['$id']?.value,
        };
      });
      return { ok: true, records: records };
    } catch (e) {
      console.error('[KINTONE] getCases:', e.message);
      return { ok: false, error: e.message, records: [] };
    }
  }

  // ── 月次振込データ（全銀・payroll用） ───────────────────────
  // Kintoneアプリ: 成約報告 + AGマスター を結合して生成
  // フィールドマッピング: getReports + getUsers を参照
  // NOTE: Kintone連携後は buildPayoutsFromKintone() として実装
  async function getMonthPayouts(month) {
    if (!isConfigured()) {
      demoWarn('getMonthPayouts');
      // デモ: batch-close-v2.html / payroll-v2.html の MONTH_PAYOUTS を使用
      var mp = (typeof MONTH_PAYOUTS !== 'undefined') ? MONTH_PAYOUTS : {};
      return { ok: true, records: mp[month] || [], _demo: true };
    }
    try {
      // 対象月の成約報告（承認済み）を取得
      var yyyymm = month.replace('-', '/');
      var reps = await kintoneGet('reports',
        'status = "承認済み" and closedAt >= "' + yyyymm + '/01" and closedAt <= "' + yyyymm + '/31"'
      );
      // AGマスターを取得してマージ
      var users = await kintoneGet('users', '');
      var userMap = {};
      users.forEach(function (u) { userMap[u.agId?.value] = u; });

      // AGごとに集計
      var byAg = {};
      reps.forEach(function (r) {
        var agId = r.agId?.value || '';
        if (!byAg[agId]) {
          var u = userMap[agId] || {};
          // 即時払い履歴を取得
          var histKey = 'CORETO_INSTANT_PAY_HISTORY_' + agId;
          var hist = [];
          try { hist = JSON.parse(localStorage.getItem(histKey) || '[]'); } catch (e) {}
          var instantPay = hist
            .filter(function (h) { return h.date && h.date.startsWith(month) && h.status === 'completed'; })
            .reduce(function (s, h) { return s + (Number(h.amount) || 0); }, 0);

          byAg[agId] = {
            id:   agId,
            name: u.name?.value || agId,
            kana: u.nameKana?.value || '',
            rank: (u.rank?.value || 'gold').toLowerCase(),
            type: u.role?.value === 'hr_ag' ? 'HR' : u.role?.value === 'pt' ? 'PT' : 'RE',
            legal:u.legal?.value === 'true',
            cases: [],
            instantPay: instantPay,
            bank: {
              bankCode:   u.bankCode?.value    || '',
              branchCode: u.branchCode?.value  || '',
              accountType:1,
              accountNo:  u.accountNo?.value   || '',
              accountHolder: u.accountHolder?.value || '',
            },
          };
        }
        byAg[agId].cases.push({
          id:    r['$id']?.value,
          label: r.reportType?.value || '賃貸',
          fee:   Number(r.fee?.value) + Number(r.adFee?.value || 0),
          sys:   20000, // システム費（固定 or フィールド追加）
          pt:    false,
        });
      });

      return { ok: true, records: Object.values(byAg) };
    } catch (e) {
      console.error('[KINTONE] getMonthPayouts:', e.message);
      return { ok: false, error: e.message, records: [] };
    }
  }

  // ── 入金確認データ（remittance用） ───────────────────────────
  // Kintoneアプリ: 案件（APP_KEY: cases）+ 入金管理（APP_KEY: payments）
  // フィールドマッピング:
  //   caseId        ← 案件番号
  //   clientName    ← クライアント氏名
  //   agId          ← 担当AG ID
  //   fee           ← 請求額
  //   paymentStatus ← 入金ステータス（waiting/paid/overdue）
  //   dueDate       ← 入金期限（日付型）
  //   paidAt        ← 入金日（日付型）
  //   virtualAccountNo ← GMOバーチャル口座番号
  async function getPaymentCases(params) {
    params = params || {};
    if (!isConfigured()) {
      demoWarn('getPaymentCases');
      // デモ: remittance-v2.html の静的HTMLをそのまま使用
      return { ok: true, records: [], _demo: true };
    }
    try {
      var conditions = ['paymentStatus != "cancelled"'];
      if (params.agId) conditions.push('agId = "' + params.agId + '"');
      var raw = await kintoneGet('payments', conditions.join(' and '));
      var records = raw.map(function (r) {
        return {
          caseId:          r.caseId?.value           || '',
          clientName:      r.clientName?.value        || '',
          agId:            r.agId?.value              || '',
          fee:             Number(r.clientPaymentAmount?.value) || 0,
          paymentStatus:   r.paymentStatus?.value     || 'waiting',
          dueDate:         r.paymentDueDate?.value    || '',
          paidAt:          r.paidAt?.value            || '',
          virtualAccountNo:r.virtualAccountNo?.value  || '',
          _kintoneId:      r['$id']?.value,
        };
      });
      return { ok: true, records: records };
    } catch (e) {
      console.error('[KINTONE] getPaymentCases:', e.message);
      return { ok: false, error: e.message, records: [] };
    }
  }

  // ── 成約報告の承認（ステータス更新） ────────────────────────
  // Kintone連携後: kintonePut('reports', kintoneId, { status: { value: '承認済み' }, approvedAt: ... })
  async function approveReport(reportId, agId, reward) {
    if (!isConfigured()) {
      demoWarn('approveReport');
      // デモ: localStorage の CORETO_REPORTS を直接更新
      try {
        var reps = JSON.parse(localStorage.getItem('CORETO_REPORTS') || '[]');
        var idx = reps.findIndex(function (r) { return r.id === reportId; });
        if (idx >= 0) {
          reps[idx].status = '承認済み';
          reps[idx].approvedAt = new Date().toISOString();
          localStorage.setItem('CORETO_REPORTS', JSON.stringify(reps));
        }
        // 確定残高に加算
        var agKey = agId.replace(/[^A-Za-z0-9\-]/g, '_');
        var balKey = 'CORETO_COMPLETED_BALANCE_' + agKey;
        var cur = parseInt(localStorage.getItem(balKey) || '0');
        localStorage.setItem(balKey, String(cur + reward));
      } catch (e) {}
      return { ok: true, _demo: true };
    }
    try {
      // Kintone連携後: レコードIDを検索してステータスを更新
      var raw = await kintoneGet('reports', 'reportId = "' + reportId + '"', ['$id']);
      if (!raw.length) throw new Error('報告が見つかりません: ' + reportId);
      var kintoneId = raw[0]['$id'].value;
      await kintonePut('reports', kintoneId, {
        status:     { value: '承認済み' },
        approvedAt: { value: new Date().toISOString() },
      });
      return { ok: true };
    } catch (e) {
      console.error('[KINTONE] approveReport:', e.message);
      return { ok: false, error: e.message };
    }
  }

  // ── 即時払い実行履歴の記録 ───────────────────────────────────
  // Kintoneアプリ: 支払い履歴（APP_KEY: payouts）
  // フィールドマッピング:
  //   reqId         ← 申請ID（文字列型）
  //   agId          ← AG ID（文字列型）
  //   amount        ← 申請額（数値型）
  //   payoutAmount  ← 振込額（数値型）
  //   payoutType    ← 種別（文字列型: instant/normal）
  //   remittanceId  ← GMO振込ID（文字列型）
  //   executedAt    ← 実行日時（日時型）
  async function recordInstantPay(data) {
    if (!isConfigured()) {
      demoWarn('recordInstantPay');
      // デモ: localStorage の CORETO_INSTANT_PAY_HISTORY_{agId} に記録
      try {
        var histKey = 'CORETO_INSTANT_PAY_HISTORY_' + data.agId;
        var hist = JSON.parse(localStorage.getItem(histKey) || '[]');
        hist.unshift({
          id:          data.reqId,
          amount:      data.amount,
          payout:      data.payoutAmount,
          date:        new Date().toISOString(),
          status:      'completed',
          remittanceId:data.remittanceId || null,
        });
        localStorage.setItem(histKey, JSON.stringify(hist));
        // 残高控除
        var agKey = data.agId.replace(/[^A-Za-z0-9\-]/g, '_');
        var balKey = 'CORETO_COMPLETED_BALANCE_' + agKey;
        var cur = parseInt(localStorage.getItem(balKey) || '0');
        localStorage.setItem(balKey, String(Math.max(0, cur - data.amount)));
      } catch (e) {}
      return { ok: true, _demo: true };
    }
    try {
      await kintonePost('payouts', {
        reqId:        { value: data.reqId },
        agId:         { value: data.agId },
        requestAmount:{ value: String(data.amount) },
        payoutAmount: { value: String(data.payoutAmount) },
        payoutType:   { value: 'instant' },
        remittanceId: { value: data.remittanceId || '' },
        status:       { value: 'completed' },
        executedAt:   { value: new Date().toISOString() },
      });
      return { ok: true };
    } catch (e) {
      console.error('[KINTONE] recordInstantPay:', e.message);
      return { ok: false, error: e.message };
    }
  }

  // ── 設定保存・テスト接続 ────────────────────────────────────
  function saveConfig(cfg) {
    try {
      localStorage.setItem('CORETO_KINTONE_CONFIG', JSON.stringify(cfg));
      return true;
    } catch (e) { return false; }
  }

  async function testConnection() {
    if (!isConfigured()) return { ok: false, error: '設定が未完了です' };
    try {
      var cfg = loadConfig();
      var appId = cfg.apps && Object.values(cfg.apps)[0];
      if (!appId) return { ok: false, error: 'アプリIDが未設定です' };
      var resp = await fetch(
        'https://' + cfg.subdomain + '.cybozu.com/k/v1/app.json?id=' + appId,
        { headers: { 'X-Cybozu-API-Token': cfg.apiToken } }
      );
      return resp.ok
        ? { ok: true, message: '接続成功' }
        : { ok: false, error: 'HTTP ' + resp.status };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  // ── 公開API ─────────────────────────────────────────────────
  window.KINTONE = {
    // データ取得
    getUsers:        getUsers,
    getReports:      getReports,
    getCases:        getCases,
    getMonthPayouts: getMonthPayouts,
    getPaymentCases: getPaymentCases,

    // データ更新
    approveReport:   approveReport,
    recordInstantPay:recordInstantPay,

    // 設定・ユーティリティ
    isConfigured:    isConfigured,
    saveConfig:      saveConfig,
    testConnection:  testConnection,
    APP_KEYS:        APP_KEYS,
  };

  console.info('[KINTONE] モジュール読み込み完了。設定済み:', isConfigured());
})();
