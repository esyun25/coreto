/**
 * ============================================================
 *  CORETO — db.js  v1.0  データアクセス層
 * ============================================================
 *
 *  【目的】
 *  全画面のlocalStorage読み書きをこの1ファイルに集約。
 *  4ヶ月後にKintone APIへ切り替える際は、このファイルのみ
 *  書き換えれば全画面が自動的に本番データを参照するようになる。
 *
 *  【使い方（各HTMLファイルから）】
 *    <script src="db.js"></script>
 *    const cases = DB.getCases();
 *    DB.saveCase(updatedCase);
 *
 *  【Kintone移行時（このファイルのみ変更）】
 *    getCases: async () => {
 *      const res = await kintone.api('/k/v1/records.json','GET',{app: DB.KINTONE_APPS.cases});
 *      return res.records.map(DB._fromKintone);
 *    }
 * ============================================================
 */

// ── Kintone接続設定（本番移行時に記入） ────────────────────────
const DB_CONFIG = {
  // Kintone接続設定（本番移行時に設定）
  KINTONE_DOMAIN: '',          // 例: 'your-domain.cybozu.com'
  KINTONE_APPS: {
    cases:    null,            // 案件管理アプリのID
    bookings: null,            // IT重説予約アプリのID
    slots:    null,            // IT重説スロットアプリのID
    agents:   null,            // エージェント台帳アプリのID
  },
  USE_KINTONE: false,          // true にするとKintone APIを使用（本番移行時）
};

// ── SlackのWebhook URL設定 ────────────────────────────────────
const SLACK_CONFIG = {
  // 各チャンネルのWebhook URLを設定（Slackアプリ → Incoming Webhooks）
  GENERAL:     'YOUR_SLACK_WEBHOOK_GENERAL',     // #general または通知チャンネル
  SIGNUP:      'YOUR_SLACK_WEBHOOK_SIGNUP',       // #エージェント登録通知
  KYC:         'YOUR_SLACK_WEBHOOK_KYC',          // #kyc-審査
  PAYMENT:     'YOUR_SLACK_WEBHOOK_PAYMENT',      // #入金確認
  BOOKING:     'YOUR_SLACK_WEBHOOK_BOOKING',      // #重説予約
  ENABLED: false,   // true にするとSlack通知が実際に送信される（本番移行時）
};

// ── Zapier Webhook URL設定 ──────────────────────────────────
const ZAPIER_CONFIG = {
  SIGNUP:  'YOUR_ZAPIER_WEBHOOK_SIGNUP',    // エージェント申込 → Kintone/スプレッドシート
  ENABLED: false,   // true にすると実際に送信される
  // ── スパム対策: 共有シークレット（Zapierの受信フィルターで照合） ──
  // Zapier設定: Filter step → "x-coreto-secret" equals このトークン
  SECRET: 'YOUR_ZAPIER_SHARED_SECRET',  // ランダムな文字列を設定（例: openssl rand -hex 16）
};

// ============================================================
//  DB — データアクセス関数
// ============================================================
const DB = {

  // ── 案件（CASES） ──────────────────────────────────────────

  /** 全案件を取得（整合性チェック付き） */
  getCases() {
    try {
      const raw = localStorage.getItem('coreto_cases');
      if (!raw) return [];
      const stored = JSON.parse(raw);
      // 整合性チェック: 保存時のハッシュと照合
      const checksum = localStorage.getItem('coreto_cases_cs');
      if (checksum && checksum !== this._simpleChecksum(raw)) {
        console.warn('[DB] ⚠️ coreto_cases の整合性チェック失敗 — データが改ざんされた可能性があります');
        // 改ざん検知時: データは返すが警告を記録
        // 本番では Slack通知を送る
        if (typeof notifySlack !== 'undefined') {
          notifySlack('⚠️ [SECURITY] coreto_cases の整合性チェック失敗 — データ改ざんの疑い');
        }
      }
      return stored;
    } catch(e) {
      console.error('[DB] getCases error:', e);
      return [];
    }
  },

  /** 案件IDで1件取得 */
  getCaseById(id) {
    return this.getCases().find(c => c.id === id) || null;
  },

  /** 案件を全件保存（チェックサム付き） */
  saveCases(cases) {
    try {
      const raw = JSON.stringify(cases);
      localStorage.setItem('coreto_cases', raw);
      // チェックサムを同時保存（改ざん検知用）
      localStorage.setItem('coreto_cases_cs', this._simpleChecksum(raw));
      return true;
    } catch(e) {
      console.error('[DB] saveCases error:', e);
      return false;
    }
  },

  /** 簡易チェックサム（改ざん検知用） */
  _simpleChecksum(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const chr = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + chr;
      hash |= 0;
    }
    return hash.toString(36);
  },

  /** 1件の案件を追加または更新（idで照合） */
  saveCase(caseObj) {
    const cases = this.getCases();
    const idx = cases.findIndex(c => c.id === caseObj.id);
    if (idx >= 0) {
      cases[idx] = caseObj;
    } else {
      cases.unshift(caseObj);
    }
    return this.saveCases(cases);
  },

  /** 案件を削除 */
  deleteCase(id) {
    const cases = this.getCases().filter(c => c.id !== id);
    return this.saveCases(cases);
  },

  // ── IT重説予約（BOOKINGS） ────────────────────────────────

  /** 全予約を取得 */
  getBookings() {
    try {
      return JSON.parse(localStorage.getItem('coreto_itsetsu_bookings') || '[]');
    } catch(e) {
      console.error('[DB] getBookings error:', e);
      return [];
    }
  },

  /** 予約を全件保存（上書き） */
  saveBookings(bookings) {
    try {
      localStorage.setItem('coreto_itsetsu_bookings', JSON.stringify(bookings));
      return true;
    } catch(e) {
      console.error('[DB] saveBookings error:', e);
      return false;
    }
  },

  /** 1件の予約を追加または更新 */
  saveBooking(booking) {
    const bookings = this.getBookings();
    const idx = bookings.findIndex(b => b.id === booking.id);
    if (idx >= 0) {
      bookings[idx] = booking;
    } else {
      bookings.unshift(booking);
    }
    return this.saveBookings(bookings);
  },

  // ── IT重説スロット（SLOTS） ───────────────────────────────

  /** 全スロットを取得 */
  getSlots() {
    try {
      return JSON.parse(localStorage.getItem('coreto_itsetsu_slots') || '[]');
    } catch(e) {
      console.error('[DB] getSlots error:', e);
      return [];
    }
  },

  /** スロットを全件保存 */
  saveSlots(slots) {
    try {
      localStorage.setItem('coreto_itsetsu_slots', JSON.stringify(slots));
      return true;
    } catch(e) {
      console.error('[DB] saveSlots error:', e);
      return false;
    }
  },

  // ── オンボーディング進捗（ONBOARDING） ──────────────────

  /** ユーザーIDのオンボーディング進捗を取得 */
  getOnboardingProgress(userId) {
    try {
      const all = JSON.parse(localStorage.getItem('coreto_onboarding') || '{}');
      return all[userId] || {};
    } catch(e) {
      return {};
    }
  },

  /** ユーザーIDのオンボーディング進捗を保存 */
  saveOnboardingProgress(userId, progress) {
    try {
      const all = JSON.parse(localStorage.getItem('coreto_onboarding') || '{}');
      all[userId] = progress;
      localStorage.setItem('coreto_onboarding', JSON.stringify(all));
      return true;
    } catch(e) {
      console.error('[DB] saveOnboardingProgress error:', e);
      return false;
    }
  },

  // ── ラベル履歴 ────────────────────────────────────────────

  getLabelHistory() {
    try {
      return JSON.parse(localStorage.getItem('coreto_label_history') || '[]');
    } catch(e) { return []; }
  },

  saveLabelHistory(history) {
    try {
      localStorage.setItem('coreto_label_history', JSON.stringify(history));
      return true;
    } catch(e) { return false; }
  },

  getLabelPresets() {
    try {
      return JSON.parse(localStorage.getItem('coreto_label_presets') || '[]');
    } catch(e) { return []; }
  },

  saveLabelPresets(presets) {
    try {
      localStorage.setItem('coreto_label_presets', JSON.stringify(presets));
      return true;
    } catch(e) { return false; }
  },

  // ── 専任宅建士オーバーライド ─────────────────────────────

  getSenninOverrides() {
    try {
      return JSON.parse(localStorage.getItem('coreto_sennin_overrides') || '{}');
    } catch(e) { return {}; }
  },

  saveSenninOverrides(overrides) {
    try {
      localStorage.setItem('coreto_sennin_overrides', JSON.stringify(overrides));
      return true;
    } catch(e) { return false; }
  },

  // ── セッション ────────────────────────────────────────────

  getSession() {
    try {
      return JSON.parse(sessionStorage.getItem('coreto_session') || 'null');
    } catch(e) { return null; }
  },

  saveSession(session) {
    try {
      sessionStorage.setItem('coreto_session', JSON.stringify(session));
      return true;
    } catch(e) { return false; }
  },

  clearSession() {
    sessionStorage.removeItem('coreto_session');
  },

  // ── Slack通知 ─────────────────────────────────────────────

  /**
   * Slackに通知を送信
   * @param {string} channel - SLACK_CONFIG のキー（'GENERAL', 'KYC' etc.）
   * @param {string} text    - 通知テキスト
   */
  async notifySlack(channel, text) {
    const url = SLACK_CONFIG[channel];
    if (!SLACK_CONFIG.ENABLED || !url || url.startsWith('YOUR_')) {
      console.log(`[Slack → #${channel}]`, text);
      return false;
    }
    try {
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
        mode: 'no-cors'
      });
      return true;
    } catch(e) {
      console.error('[DB] Slack notify failed:', e);
      return false;
    }
  },

  // ── Zapier Webhook ────────────────────────────────────────

  /**
   * Zapier Webhookにデータを送信
   * @param {string} webhook - ZAPIER_CONFIG のキー（'SIGNUP' etc.）
   * @param {object} data    - 送信データ
   */
  async sendToZapier(webhook, data) {
    const url = ZAPIER_CONFIG[webhook];
    if (!ZAPIER_CONFIG.ENABLED || !url || url.startsWith('YOUR_')) {
      console.log(`[Zapier → ${webhook}]`, data);
      return false;
    }
    try {
      const headers = { 'Content-Type': 'application/json' };
      // スパム対策: 共有シークレットをヘッダーに付与
      if (ZAPIER_CONFIG.SECRET && !ZAPIER_CONFIG.SECRET.startsWith('YOUR_')) {
        headers['x-coreto-secret'] = ZAPIER_CONFIG.SECRET;
      }
      await fetch(url, { method: 'POST', headers, body: JSON.stringify(data), mode: 'no-cors' });
      return true;
    } catch(e) {
      console.error('[DB] Zapier send failed:', e);
      return false;
    }
  },

  // ── ユーティリティ ────────────────────────────────────────

  /** 今日の日付をYYYY-MM-DD形式で返す */
  today() {
    return new Date().toISOString().slice(0, 10);
  },

  /** 一意のIDを生成 */
  generateId(prefix = 'C') {
    return prefix + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase();
  },

};

// ── バージョン表示（デバッグ用） ───────────────────────────────

// ── ユーザーマスタ（認証ガードが参照するため db.js に集約） ────────────
// pwHash = SHA-256(pwSalt + ':' + password) で生成
// IMPORTANT: pwHash・pwSaltはブラウザから見えるため、この情報でパスワード
// を逆算することはできないが、Kintone移行後はサーバー側に移動すること。
const USERS = {
  '00001':{ name:'HQ 統括', type:'hq', hqRole:'exec', pwHash:'4338366c8624f75aa9c098b1965a1973ac1458e4c3fe57e33d4a2ec499f440b2', pwSalt:'0224d4d914c01a78', color:'var(--gold)', avatar:'統' },
  '00347':{ name:'HQ マネージャー', type:'hq', hqRole:'manager', pwHash:'823d13a4b70586ab254c10c24c7299f7fc88e75686dc0827a925d52053fdf399', pwSalt:'f185e59e401b0a29', color:'var(--blue)', avatar:'マ' },
  '00891':{ name:'HQ スタッフ', type:'hq', hqRole:'staff', pwHash:'67ad0d8e84d8729c58583395870978d06a7b001a63555fbbab4ed24ca0bdc2f3', pwSalt:'b7a739cf4dafbe32', color:'var(--green)', avatar:'ス' },
  '10008':{ name:'佐藤 花子', type:'re', pwHash:'357683ce522895330228c70453fb40463ade36ddc29076fe5e12ed39f1b82932', pwSalt:'ce2301e88db30992', rank:'Platinum', rankKey:'platinum', sennin:true, color:'var(--purple)', avatar:'佐' },
  '10012':{ name:'山田 誠', type:'re', pwHash:'4af458635d2243ce54e3c22e16f71815900853e18453efdebb35a705ef8fddc6', pwSalt:'7c183f447de9c7dc', rank:'Gold',     rankKey:'gold', sennin:true, color:'var(--gold)', avatar:'山' },
  '10023':{ name:'鈴木 健太', type:'re', pwHash:'b96aeafc6405706d0c0119eeb32ba04591bb002edf00a1e33201cb92d3d75142', pwSalt:'b8e2175c27cbcd2a', rank:'Silver',   rankKey:'silver', sennin:false, color:'var(--green)', avatar:'鈴' },
  '10041':{ name:'渡辺 隆', type:'re', pwHash:'a436112f3915834860870cce2f7f4950b619a323f9682b0c54d89efc416b2bc1', pwSalt:'5a2e4323892f21dd', rank:'Bronze',   rankKey:'bronze', sennin:true, color:'var(--orange)', avatar:'渡' },
  '20005':{ name:'田中 美穂', type:'hr', pwHash:'be6357bc5362548690c7b64752243df86ed462a79ebdc477abc20e113673318d', pwSalt:'3f97c5aac9b4e6ec', rank:'Gold',     rankKey:'gold', sennin:false, color:'var(--green)', avatar:'田' },
  '30007':{ name:'佐藤 美咲', type:'pt', pwHash:'7f76abae55958f55c9904b6d860cf5117c8c26c541b2774b2478cedaabd4f167', pwSalt:'23f2095e3e65052f', rank:'Partner',  rankKey:'pt', color:'var(--purple)', avatar:'佐' },
};

// ── sessionToken 再計算・検証 ─────────────────────────────────────────
// token = SHA-256(userId + ':' + loginAt + ':' + pwHash)
// 各認証ガードがこの関数でトークンを再計算し、偽造セッションを検知する
DB.verifySessionToken = async function(session) {
  if (!session || !session.userId || !session.loginAt || !session.sessionToken) return false;
  const user = USERS[session.userId];
  if (!user) return false;
  if (user.type !== session.type) return false;

  // トークンを再計算して比較
  const encoder = new TextEncoder();
  const data = encoder.encode(session.userId + ':' + session.loginAt + ':' + user.pwHash);
  const buf = await crypto.subtle.digest('SHA-256', data);
  const computed = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
  return computed === session.sessionToken;
};

// 同期版（非同期が使えないコンテキスト用 — tokenの長さ+USERSマッチのみ）
DB.verifySessionSync = function(session) {
  if (!session || !session.userId || !session.type) return false;
  if (!session.sessionToken || session.sessionToken.length !== 64) return false;
  const user = USERS[session.userId];
  if (!user) return false;
  if (user.type !== session.type) return false;
  // hqRole整合性（HQがhqRole偽造するのを防ぐ）
  if (session.type === 'hq' && session.hqRole && user.hqRole !== session.hqRole) return false;
  return true;
};

console.log('[CORETO db.js v1.0] データ層ロード完了 | Kintone移行:', DB_CONFIG.USE_KINTONE ? '有効' : '無効（localStorage使用中）');
