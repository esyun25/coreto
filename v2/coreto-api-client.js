/**
 * coreto-api-client.js
 * COREBLDG v2 フロントエンド → Vercel API 呼び出しクライアント
 *
 * 使い方:
 *   <script src="coreto-api-client.js"></script>
 *
 *   // バーチャル口座発行
 *   const va = await CORETO_API.issueVirtualAccount('RENT-0194', '田中 優子', 165000);
 *   // → { bankName, branchName, accountNo, accountHolder, amount, expiresAt }
 *
 *   // 入金確認
 *   const status = await CORETO_API.checkPayment('RENT-0194');
 *   // → { status: 'waiting'|'paid', paidAmount, paidAt }
 *
 *   // 送金実行（HQのみ）
 *   await CORETO_API.executeRemit({ caseId, toBank, amount, memo });
 */

window.CORETO_API = (function() {

  // ─── 設定 ────────────────────────────────────────────────────────────────
  // Vercel APIのベースURLと内部APIキーは
  // admin-rbac-v2.html の「API設定」タブで設定 → localStorage に保存される
  function getConfig() {
    try {
      return JSON.parse(localStorage.getItem('CORETO_API_CONFIG') || '{}');
    } catch(e) { return {}; }
  }

  function getBaseUrl() {
    const cfg = getConfig();
    return (cfg.baseUrl || '').replace(/\/$/, '');
  }

  function getApiKey() {
    const cfg = getConfig();
    return cfg.internalKey || '';
  }

  // ─── 共通フェッチ ─────────────────────────────────────────────────────────
  async function apiFetch(path, options = {}) {
    const baseUrl = getBaseUrl();
    if (!baseUrl) {
      console.warn('[CORETO_API] baseURL が未設定です。admin-rbac-v2 の API設定タブで設定してください。');
      throw new Error('API_NOT_CONFIGURED');
    }
    const res = await fetch(baseUrl + path, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'x-coreto-key': getApiKey(),
        ...(options.headers || {}),
      },
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      throw Object.assign(new Error(data.error || 'API_ERROR'), { status: res.status, data });
    }
    return data;
  }

  // ─── バーチャル口座発行 ───────────────────────────────────────────────────
  async function issueVirtualAccount(caseId, clientName, amount) {
    // 既に発行済みなら返す
    const stored = _loadVA(caseId);
    if (stored) return stored;

    const data = await apiFetch('/api/gmo/issue-virtual-account', {
      method: 'POST',
      body: JSON.stringify({ caseId, clientName, amount }),
    });

    _saveVA(caseId, data.virtualAccount);
    return data.virtualAccount;
  }

  // ─── 入金確認 ────────────────────────────────────────────────────────────
  async function checkPayment(caseId) {
    const data = await apiFetch('/api/gmo/check-payment?caseId=' + encodeURIComponent(caseId));
    // 入金済みならlocalStorageに記録
    if (data.status === 'paid') {
      _savePayment(caseId, data);
    }
    return data;
  }

  // ─── 送金実行（HQ用）────────────────────────────────────────────────────
  async function executeRemit({ caseId, toBank, amount, memo }) {
    const data = await apiFetch('/api/remit/execute', {
      method: 'POST',
      body: JSON.stringify({ caseId, toBank, amount, memo }),
    });
    _saveRemit(caseId, data);
    return data;
  }

  // ─── [開発用] 入金シミュレート ────────────────────────────────────────────
  async function mockSimulatePayment(caseId, amount) {
    return apiFetch('/api/gmo/mock-simulate-payment', {
      method: 'POST',
      body: JSON.stringify({ caseId, amount }),
    });
  }

  // ─── localStorage ヘルパー ───────────────────────────────────────────────
  function _saveVA(caseId, va) {
    try { localStorage.setItem('CORETO_VA_' + caseId, JSON.stringify(va)); } catch(e) {}
  }
  function _loadVA(caseId) {
    try {
      const r = localStorage.getItem('CORETO_VA_' + caseId);
      return r ? JSON.parse(r) : null;
    } catch(e) { return null; }
  }
  function _savePayment(caseId, data) {
    try { localStorage.setItem('CORETO_PAYMENT_' + caseId, JSON.stringify(data)); } catch(e) {}
  }
  function _saveRemit(caseId, data) {
    try { localStorage.setItem('CORETO_REMIT_' + caseId, JSON.stringify(data)); } catch(e) {}
  }

  // ─── 設定確認ユーティリティ ───────────────────────────────────────────────
  function isConfigured() {
    const cfg = getConfig();
    return !!(cfg.baseUrl && cfg.internalKey);
  }

  return {
    issueVirtualAccount,
    checkPayment,
    executeRemit,
    mockSimulatePayment,
    isConfigured,
    getConfig,
  };
})();
