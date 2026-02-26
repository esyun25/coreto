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
};

// ============================================================
//  DB — データアクセス関数
// ============================================================
const DB = {

  // ── 案件（CASES） ──────────────────────────────────────────

  /** 全案件を取得 */
  getCases() {
    try {
      return JSON.parse(localStorage.getItem('coreto_cases') || '[]');
    } catch(e) {
      console.error('[DB] getCases error:', e);
      return [];
    }
  },

  /** 案件IDで1件取得 */
  getCaseById(id) {
    return this.getCases().find(c => c.id === id) || null;
  },

  /** 案件を全件保存（上書き） */
  saveCases(cases) {
    try {
      localStorage.setItem('coreto_cases', JSON.stringify(cases));
      return true;
    } catch(e) {
      console.error('[DB] saveCases error:', e);
      return false;
    }
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
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        mode: 'no-cors'
      });
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
console.log('[CORETO db.js v1.0] データ層ロード完了 | Kintone移行:', DB_CONFIG.USE_KINTONE ? '有効' : '無効（localStorage使用中）');
