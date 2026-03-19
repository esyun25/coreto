// ============================================================
//  CORETO KV クライアント v1
//  coreto-kv-client.js
//
//  使い方:
//    <script src="coreto-kv-client.js"></script>
//    → window.KV.get(key)        Promise<value | null>
//    → window.KV.set(key, value) Promise<void>
//    → window.KV.del(key)        Promise<void>
//    → window.KV.isRemote()      true = Vercel KV / false = localStorage
//
//  設定: localStorage の CORETO_API_CONFIG に保存
//    { baseUrl, internalKey }
//  管理UI: coreto-admin-rbac-v2.html の「⚙️ API設定」タブ
//
//  ── モード切り替え ──────────────────────────────────────────
//  CORETO_API_CONFIG が未設定 → localStorage（既存動作を維持）
//  CORETO_API_CONFIG が設定済み → Vercel KV REST API 経由
//
//  ── localStorage との互換性 ──────────────────────────────────
//  Vercel KV 未設定時は localStorage をそのまま使うため
//  既存コードへの影響ゼロ。設定を入れると自動でクラウドに切り替わる。
// ============================================================

(function () {
  'use strict';

  function loadApiConfig() {
    try {
      return JSON.parse(localStorage.getItem('CORETO_API_CONFIG') || '{}');
    } catch (e) { return {}; }
  }

  function isConfigured() {
    var cfg = loadApiConfig();
    return !!(cfg.baseUrl && cfg.internalKey);
  }

  // ── Vercel KV REST 呼び出し ───────────────────────────────
  async function remoteGet(key) {
    var cfg = loadApiConfig();
    var resp = await fetch(cfg.baseUrl + '/api/kv/get?key=' + encodeURIComponent(key), {
      headers: { 'x-coreto-key': cfg.internalKey }
    });
    if (!resp.ok) throw new Error('[KV] GET failed: ' + resp.status);
    var data = await resp.json();
    if (!data.ok) throw new Error('[KV] ' + data.error);
    // Vercel KV は JSON 文字列で返す場合があるのでパース試行
    if (typeof data.value === 'string') {
      try { return JSON.parse(data.value); } catch (e) {}
    }
    return data.value;
  }

  async function remoteSet(key, value, ttl) {
    var cfg = loadApiConfig();
    var body = { key: key, value: value };
    if (ttl) body.ttl = ttl;
    var resp = await fetch(cfg.baseUrl + '/api/kv/set', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-coreto-key': cfg.internalKey,
      },
      body: JSON.stringify(body),
    });
    if (!resp.ok) throw new Error('[KV] SET failed: ' + resp.status);
    var data = await resp.json();
    if (!data.ok) throw new Error('[KV] ' + data.error);
  }

  async function remoteDel(key) {
    var cfg = loadApiConfig();
    var resp = await fetch(cfg.baseUrl + '/api/kv/delete?key=' + encodeURIComponent(key), {
      method: 'DELETE',
      headers: { 'x-coreto-key': cfg.internalKey },
    });
    if (!resp.ok) throw new Error('[KV] DELETE failed: ' + resp.status);
  }

  // ── localStorage フォールバック ────────────────────────────
  function localGet(key) {
    try {
      var v = localStorage.getItem(key);
      if (v === null) return Promise.resolve(null);
      try { return Promise.resolve(JSON.parse(v)); } catch (e) { return Promise.resolve(v); }
    } catch (e) { return Promise.resolve(null); }
  }

  function localSet(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {}
    return Promise.resolve();
  }

  function localDel(key) {
    try { localStorage.removeItem(key); } catch (e) {}
    return Promise.resolve();
  }

  // ── 公開API ─────────────────────────────────────────────
  window.KV = {
    isRemote: isConfigured,

    get: function (key) {
      if (isConfigured()) {
        return remoteGet(key).catch(function (e) {
          console.warn('[KV] remote GET 失敗 → localStorage にフォールバック:', e.message);
          return localGet(key);
        });
      }
      return localGet(key);
    },

    set: function (key, value, ttl) {
      if (isConfigured()) {
        // Vercel KV に書き込みつつ localStorage にも同期（オフライン耐性）
        return remoteSet(key, value, ttl).then(function () {
          localSet(key, value);
        }).catch(function (e) {
          console.warn('[KV] remote SET 失敗 → localStorage にフォールバック:', e.message);
          return localSet(key, value);
        });
      }
      return localSet(key, value);
    },

    del: function (key) {
      if (isConfigured()) {
        return remoteDel(key).then(function () {
          localDel(key);
        }).catch(function (e) {
          console.warn('[KV] remote DEL 失敗:', e.message);
          return localDel(key);
        });
      }
      return localDel(key);
    },
  };

  // ── 主要キーの定義（ドキュメント兼務）────────────────────
  window.KV.KEYS = {
    REPORTS:            'CORETO_REPORTS',               // 成約報告リスト
    HQ_TASKS:           'CORETO_HQ_TASKS',              // HQタスクキュー
    CASES:              'CORETO_CASES',                  // 案件リスト
    BALANCE:            function(agId){ return 'CORETO_COMPLETED_BALANCE_' + agId.replace(/[^A-Za-z0-9\-]/g,'_'); },
    INSTANT_HISTORY:    function(agId){ return 'CORETO_INSTANT_PAY_HISTORY_' + agId; },
    COMPLETED_CASES:    function(agId){ return 'CORETO_COMPLETED_CASES_' + agId.replace(/[^A-Za-z0-9\-]/g,'_'); },
    VA:                 function(caseId){ return 'CORETO_VA_' + caseId; },
    PAYMENT:            function(caseId){ return 'CORETO_PAYMENT_' + caseId; },
  };

  console.info('[KV] モード:', isConfigured() ? 'Vercel KV（リモート）' : 'localStorage（ローカル）');
})();
