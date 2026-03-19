// ============================================================
//  CORETO KV クライアント v2
//  coreto-kv-client.js
//
//  【動作原理】
//  CORETO_API_CONFIG が設定済みの場合、
//  localStorage の CORETO_* キーへの getItem/setItem を
//  透過的に Upstash KV と同期する。
//
//  各ページのコードを変更せずに全ページがKV共有になる。
//
//  ┌────────────────────────────────────────┐
//  │  localStorage.setItem('CORETO_REPORTS', ...)
//  │    → localStorage に書く（即時）
//  │    → KV にも書く（非同期・fire-and-forget）
//  │
//  │  localStorage.getItem('CORETO_REPORTS')
//  │    → KV キャッシュがあればそちらを返す
//  │    → なければ localStorage の値を返す
//  └────────────────────────────────────────┘
//
//  使い方: 各ページの <head> に読み込むだけでOK
//    <script src="coreto-kv-client.js"></script>
// ============================================================

(function () {
  'use strict';

  // KV同期対象のキープレフィックス
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

  // ── 設定読み込み ────────────────────────────────────────────
  function loadConfig() {
    try { return JSON.parse(localStorage.getItem('CORETO_API_CONFIG') || '{}'); }
    catch(e) { return {}; }
  }

  function isConfigured() {
    var c = loadConfig();
    return !!(c.baseUrl && c.internalKey);
  }

  // ── インメモリKVキャッシュ ──────────────────────────────────
  // KVから取得した最新値をキャッシュし、getItemで即座に返す
  var _cache = {};
  var _fetching = {};

  // ── Vercel API 呼び出し ──────────────────────────────────────
  function apiGet(key, cb) {
    if (_fetching[key]) return;
    _fetching[key] = true;
    var cfg = loadConfig();
    fetch(cfg.baseUrl + '/api/kv/get?key=' + encodeURIComponent(key), {
      headers: { 'x-coreto-key': cfg.internalKey }
    })
    .then(function(r){ return r.json(); })
    .then(function(data){
      _fetching[key] = false;
      if (data.ok && data.value !== null && data.value !== undefined) {
        var val = typeof data.value === 'string' ? data.value : JSON.stringify(data.value);
        _cache[key] = val;
        // localStorageにも同期して次回の同期的getItemでも取得できるようにする
        try { _origSetItem.call(localStorage, key, val); } catch(e) {}
        if (cb) cb(val);
      }
    })
    .catch(function(){ _fetching[key] = false; });
  }

  function apiSet(key, value) {
    var cfg = loadConfig();
    var parsed;
    try { parsed = JSON.parse(value); } catch(e) { parsed = value; }
    fetch(cfg.baseUrl + '/api/kv/set', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-coreto-key': cfg.internalKey,
      },
      body: JSON.stringify({ key: key, value: parsed }),
    }).catch(function(e){ console.warn('[KV] set失敗:', e.message); });
  }

  // ── localStorage モンキーパッチ ──────────────────────────────
  var _origGetItem = localStorage.getItem.bind(localStorage);
  var _origSetItem = localStorage.setItem.bind(localStorage);

  localStorage.getItem = function(key) {
    var lsVal = _origGetItem(key);
    if (!isConfigured() || !isKVKey(key)) return lsVal;

    // キャッシュがあればキャッシュを返す（最新のKV値）
    if (_cache[key] !== undefined) return _cache[key];

    // バックグラウンドでKVから取得してキャッシュを更新
    apiGet(key, function(val) {
      // 取得完了後にページを再描画（renderAll等が定義されていれば呼ぶ）
      if (val !== lsVal) {
        try { if (typeof renderAll === 'function') renderAll(); } catch(e) {}
        try { if (typeof renderPage === 'function') renderPage(); } catch(e) {}
      }
    });

    return lsVal;
  };

  localStorage.setItem = function(key, value) {
    _origSetItem(key, value);
    if (!isConfigured() || !isKVKey(key)) return;
    // キャッシュを即時更新
    _cache[key] = value;
    // KVに非同期書き込み
    apiSet(key, value);
  };

  // ── ページロード時にKVから一括プリフェッチ ────────────────────
  // 重要キーを事前取得してキャッシュに入れることで
  // getItemが即座に最新値を返せるようにする
  var PREFETCH_KEYS = ['CORETO_REPORTS', 'CORETO_HQ_TASKS'];

  function prefetch() {
    if (!isConfigured()) return;
    PREFETCH_KEYS.forEach(function(key) {
      apiGet(key, function(val) {
        try { if (typeof renderAll === 'function') renderAll(); } catch(e) {}
      });
    });
    // AGごとの残高も取得
    var agId = sessionStorage.getItem('coreto_user_id');
    if (agId) {
      var balKey = 'CORETO_COMPLETED_BALANCE_' + agId.replace(/[^A-Za-z0-9\-]/g,'_');
      apiGet(balKey);
      apiGet('CORETO_INSTANT_PAY_HISTORY_' + agId);
    }
  }

  // ── 公開API ─────────────────────────────────────────────────
  window.KV = {
    isRemote: isConfigured,
    get: function(key) {
      if (!isConfigured()) {
        try { var v = _origGetItem(key); return Promise.resolve(v ? JSON.parse(v) : null); }
        catch(e) { return Promise.resolve(null); }
      }
      var cfg = loadConfig();
      return fetch(cfg.baseUrl + '/api/kv/get?key=' + encodeURIComponent(key), {
        headers: { 'x-coreto-key': cfg.internalKey }
      })
      .then(function(r){ return r.json(); })
      .then(function(data){
        if (!data.ok || data.value === null) return null;
        var val = typeof data.value === 'string' ? data.value : JSON.stringify(data.value);
        _cache[key] = val;
        try { _origSetItem.call(localStorage, key, val); } catch(e) {}
        try { return JSON.parse(val); } catch(e) { return val; }
      })
      .catch(function(){
        try { var v = _origGetItem(key); return v ? JSON.parse(v) : null; }
        catch(e) { return null; }
      });
    },
    set: function(key, value) {
      var str = JSON.stringify(value);
      _cache[key] = str;
      try { _origSetItem(key, str); } catch(e) {}
      if (isConfigured()) apiSet(key, str);
      return Promise.resolve();
    },
    del: function(key) {
      delete _cache[key];
      try { localStorage.removeItem(key); } catch(e) {}
      if (!isConfigured()) return Promise.resolve();
      var cfg = loadConfig();
      return fetch(cfg.baseUrl + '/api/kv/delete?key=' + encodeURIComponent(key), {
        method: 'DELETE',
        headers: { 'x-coreto-key': cfg.internalKey },
      }).catch(function(){});
    },
    prefetch: prefetch,
    cache: _cache,
  };

  // DOMContentLoaded後にプリフェッチ実行
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      setTimeout(prefetch, 100);
    });
  } else {
    setTimeout(prefetch, 100);
  }

  var mode = isConfigured() ? 'Vercel KV（リモート・localStorage透過パッチ）' : 'localStorage（ローカルのみ）';
  console.info('[KV] モード:', mode);
})();
