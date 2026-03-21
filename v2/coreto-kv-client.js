// ── デモデータ自動クリア（v2.1以降） ──────────────────────────
// 以前のバージョンでlocalStorageに保存されたハードコードデモデータを削除
(function clearOldDemoData() {
  try {
    // v22: フラグバージョンを上げて強制再クリア
    if (localStorage.getItem('DEMO_DATA_CLEARED_v22')) return;

    // 古いフラグも削除
    localStorage.removeItem('DEMO_DATA_CLEARED_v21');

    var keysToReset = [
      'CORETO_ITSETSU_BOOKINGS',
      'CORETO_ITSETSU_LINKS',
      'CORETO_CRM_CLIENTS',
      'CORETO_CASE_DB_LOCAL',
      'CORETO_BARCODE_SCAN',
    ];
    keysToReset.forEach(function(k) { localStorage.removeItem(k); });

    // CORETO_REPORTSからデモデータを完全削除
    // 削除対象: RC-10xxx / RPT-2026xxxx形式のデモID
    // ただしユーザーが自分で登録した RPT-2026xxxx は残す判定が難しいため
    // ハードコードのデモ人名が含まれるものだけ削除
    var DEMO_NAMES = ['田中 優子','高橋 美咲','鈴木 健太','山田 誠','大橋 幸代',
                      '渡辺 誠','伊藤 花子','佐藤 健','木下','田中 誠一'];
    try {
      var reports = JSON.parse(localStorage.getItem('CORETO_REPORTS') || '[]');
      var cleaned = reports.filter(function(r) {
        // RC-10xxx形式のデモIDを削除
        if (r.case && /^RC-10\d{3}$/.test(r.case)) return false;
        // デモ人名を含むものを削除（agIdもagNameも空 = 明らかなデモデータ）
        if (!r.agId && !r.id) return false;
        return true;
      });
      localStorage.setItem('CORETO_REPORTS', JSON.stringify(cleaned));
    } catch(e) {}

    localStorage.setItem('DEMO_DATA_CLEARED_v22', '1');
  } catch(e) {}
})();

// ============================================================
//  CORETO KV クライアント v3
//  coreto-kv-client.js
//
//  【設計方針】
//  - localStorage を単一の真実の源（Source of Truth）として維持
//  - KVはlocalStorageのリモートミラー（マルチデバイス同期用）
//  - setItem: localStorage書き込み → KV書き込み（非同期）
//  - getItem: localStorageを返す（同期・信頼できる）
//            + バックグラウンドでKVと同期（マージ方式・上書きなし）
//
//  【Race Condition 対策】
//  - KVから取得したデータでlocalStorageを上書きしない
//  - KVデータはlocalStorageにない新規アイテムのみをマージ
//  - ペンディング書き込みタイムスタンプで競合を回避
// ============================================================

(function () {
  'use strict';

  var KV_PREFIXES = [
    'CORETO_REPORTS',
    'CORETO_HQ_TASKS',
    'CORETO_COMPLETED_BALANCE',
    'CORETO_INSTANT_PAY_HISTORY',
    'CORETO_COMPLETED_CASES',
    'CORETO_VA_',
    'CORETO_PAYMENT_',
    'CORETO_CASE_STATUS_',
    'CORETO_REMIT_',
  ];

  function isKVKey(key) {
    return KV_PREFIXES.some(function(p){ return key && key.indexOf(p) === 0; });
  }

  function loadConfig() {
    try { return JSON.parse(localStorage.getItem('CORETO_API_CONFIG') || '{}'); }
    catch(e) { return {}; }
  }

  function isConfigured() {
    var c = loadConfig();
    return !!(c.baseUrl && c.internalKey);
  }

  // ── ペンディング書き込みの管理 ────────────────────────────
  // setItemで書き込んだキーのタイムスタンプを記録
  // このキーについてはKV取得結果でlocalStorageを上書きしない
  var _pendingWrites = {};
  var PENDING_TTL = 10000; // 10秒間はKVの古いデータで上書きしない

  function markPending(key) {
    _pendingWrites[key] = Date.now();
  }

  function isPending(key) {
    var ts = _pendingWrites[key];
    if (!ts) return false;
    if (Date.now() - ts > PENDING_TTL) {
      delete _pendingWrites[key];
      return false;
    }
    return true;
  }

  // ── Vercel API 呼び出し ──────────────────────────────────────
  function parseKVValue(raw) {
    if (raw === null || raw === undefined) return null;
    if (typeof raw === 'string') {
      try { return JSON.parse(raw); } catch(e) { return raw; }
    }
    return raw;
  }

  function apiGet(key, cb) {
    var cfg = loadConfig();
    if (!cfg.baseUrl || !cfg.internalKey) return;
    fetch(cfg.baseUrl + '/api/kv/get?key=' + encodeURIComponent(key), {
      headers: { 'x-coreto-key': cfg.internalKey }
    })
    .then(function(r){ return r.json(); })
    .then(function(data){
      if (!data.ok || data.value === null || data.value === undefined) return;
      var parsed = parseKVValue(data.value);
      if (cb) cb(parsed);
    })
    .catch(function(e){ console.warn('[KV] get失敗:', key, e.message); });
  }

  function apiSet(key, value) {
    var cfg = loadConfig();
    if (!cfg.baseUrl || !cfg.internalKey) return;
    var parsed;
    try { parsed = typeof value === 'string' ? JSON.parse(value) : value; }
    catch(e) { parsed = value; }
    fetch(cfg.baseUrl + '/api/kv/set', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-coreto-key': cfg.internalKey,
      },
      body: JSON.stringify({ key: key, value: parsed }),
    })
    .then(function(){ delete _pendingWrites[key]; }) // 書き込み完了でペンディング解除
    .catch(function(e){ console.warn('[KV] set失敗:', e.message); });
  }

  // ── KVとlocalStorageのマージ（上書きしない・新規アイテムのみ追加）──
  function mergeKVToLocal(key, kvData) {
    if (!kvData) return false;

    // ペンディング中のキーは上書き禁止
    if (isPending(key)) return false;

    var lsRaw = _origGetItem.call(localStorage, key);

    // 配列の場合: IDベースでマージ（localStorageにないものだけ追加）
    if (Array.isArray(kvData)) {
      var lsData = [];
      try { lsData = lsRaw ? JSON.parse(lsRaw) : []; } catch(e) {}
      if (!Array.isArray(lsData)) return false;

      var lsIds = new Set();
      lsData.forEach(function(item){
        if (item && item.id) lsIds.add(item.id);
      });

      var toAdd = kvData.filter(function(item){
        return item && item.id && !lsIds.has(item.id);
      });

      if (toAdd.length === 0) return false; // 追加するものがない

      // KVにあってlocalStorageにない新規アイテムを末尾に追加
      var merged = lsData.concat(toAdd);
      _origSetItem.call(localStorage, key, JSON.stringify(merged));
      return true;
    }

    // 文字列・数値・オブジェクトの場合: localStorageが空の場合のみ上書き
    if (lsRaw === null || lsRaw === undefined || lsRaw === '') {
      _origSetItem.call(localStorage, key, JSON.stringify(kvData));
      return true;
    }

    return false;
  }

  // ── localStorage モンキーパッチ ──────────────────────────────
  var _origGetItem = Storage.prototype.getItem;
  var _origSetItem = Storage.prototype.setItem;

  Storage.prototype.getItem = function(key) {
    // localStorage以外（sessionStorageなど）はそのまま通す
    if (this !== localStorage) return _origGetItem.call(this, key);
    return _origGetItem.call(this, key);
  };

  Storage.prototype.setItem = function(key, value) {
    _origSetItem.call(this, key, value);
    // localStorage以外（sessionStorageなど）はKV同期しない
    if (this !== localStorage) return;
    if (!isConfigured() || !isKVKey(key)) return;
    // ペンディングを記録してKVに非同期書き込み
    markPending(key);
    apiSet(key, value);
  };

  // ── ページロード時のKV同期（マージ方式）─────────────────────
  var SYNC_KEYS = ['CORETO_REPORTS', 'CORETO_HQ_TASKS'];

  function syncFromKV() {
    if (!isConfigured()) return;

    SYNC_KEYS.forEach(function(key) {
      apiGet(key, function(kvData) {
        var changed = mergeKVToLocal(key, kvData);
        if (changed) {
          // 新規アイテムが追加された場合のみ再描画
          try { if (typeof renderAll === 'function') renderAll(); } catch(e) {}
          try { if (typeof renderHistory === 'function') renderHistory(); } catch(e) {}
          try { if (typeof renderPage === 'function') renderPage(); } catch(e) {}
        }
      });
    });

    // AGの残高キーも同期
    var agId = sessionStorage.getItem('coreto_user_id');
    if (agId) {
      var balKey = 'CORETO_COMPLETED_BALANCE_' + agId.replace(/[^A-Za-z0-9\-]/g,'_');
      apiGet(balKey, function(val) {
        if (val !== null && !isPending(balKey)) {
          var lsVal = _origGetItem.call(localStorage, balKey);
          if (!lsVal) {
            _origSetItem.call(localStorage, balKey, String(val));
          }
        }
      });
    }
  }

  // ── 公開API (window.KV) ──────────────────────────────────────
  window.KV = {
    isRemote: isConfigured,

    get: function(key) {
      if (!isConfigured()) {
        try {
          var v = _origGetItem.call(localStorage, key);
          return Promise.resolve(v ? JSON.parse(v) : null);
        } catch(e) { return Promise.resolve(null); }
      }
      // KVから直接取得（設定済みの場合のみ）
      if (!isConfigured()) {
        var fallbackVal = _origGetItem.call(localStorage, key);
        return Promise.resolve(fallbackVal !== null ? { ok:true, value:fallbackVal } : null);
      }
      var cfg = loadConfig();
      return fetch(cfg.baseUrl + '/api/kv/get?key=' + encodeURIComponent(key), {
        headers: { 'x-coreto-key': cfg.internalKey }
      })
      .then(function(r){ return r.json(); })
      .then(function(data){
        if (!data.ok || data.value === null) {
          // KVにない場合はlocalStorageを返す
          try {
            var v = _origGetItem.call(localStorage, key);
            return v ? JSON.parse(v) : null;
          } catch(e) { return null; }
        }
        return parseKVValue(data.value);
      })
      .catch(function(){
        try {
          var v = _origGetItem.call(localStorage, key);
          return v ? JSON.parse(v) : null;
        } catch(e) { return null; }
      });
    },

    set: function(key, value) {
      var str = JSON.stringify(value);
      try { _origSetItem.call(localStorage, key, str); } catch(e) {}
      if (isConfigured()) {
        markPending(key);
        apiSet(key, str);
      }
      return Promise.resolve();
    },

    del: function(key) {
      try { localStorage.removeItem(key); } catch(e) {}
      if (!isConfigured()) return Promise.resolve();
      var cfg = loadConfig();
      return fetch(cfg.baseUrl + '/api/kv/delete?key=' + encodeURIComponent(key), {
        method: 'DELETE',
        headers: { 'x-coreto-key': cfg.internalKey },
      }).catch(function(){});
    },

    // 強制的にKVからマージ同期（手動呼び出し用）
    sync: syncFromKV,
  };

  // ── 初期同期 ────────────────────────────────────────────────
  // DOMContentLoaded後に少し遅延させてから同期
  // （ページのDOMContentLoadedハンドラが先に走るように）
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      setTimeout(syncFromKV, 500);
    });
  } else {
    setTimeout(syncFromKV, 500);
  }

  var mode = isConfigured()
    ? 'Vercel KV（リモート同期・マージ方式）'
    : 'localStorage（ローカルのみ）';
  console.info('[KV v3] モード:', mode);
})();

// ── CORETO_REPORTS更新時にnavバッジを自動更新 ──────────
(function() {
  var _origSet = Storage.prototype.setItem;
  Storage.prototype.setItem = function(key, value) {
    _origSet.call(this, key, value);
    if (this === localStorage && (key === 'CORETO_REPORTS' || key === 'CORETO_HQ_TASKS')) {
      if (typeof updateNavBadges === 'function') {
        setTimeout(updateNavBadges, 100);
      } else if (typeof CNAV !== 'undefined' && CNAV.updateBadges) {
        setTimeout(CNAV.updateBadges, 100);
      }
    }
  };
})();
