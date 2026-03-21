/**
 * ベースエージェント
 * 各ロールエージェントが継承する基底クラス
 */

const { chromium } = require('playwright');
const config = require('../config');

class BaseAgent {
  constructor(roleKey, options = {}) {
    this.roleKey    = roleKey;
    this.roleInfo   = config.ROLES[roleKey];
    this.label      = this.roleInfo.label;
    this.page       = null;
    this.browser    = null;
    this.context    = null;
    this.observations = [];  // このエージェントが記録した観察
    this.headless   = options.headless !== false;
    this.screenshots = [];
  }

  // ────── ブラウザ操作 ──────────────────────────────────

  async init() {
    this.browser = await chromium.launch({ headless: this.headless });
    this.context = await this.browser.newContext({
      viewport: { width: 1280, height: 800 },
    });
    this.page = await this.context.newPage();

    // コンソールエラーを自動記録（外部API到達不可は除外）
    this.page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();
        // ローカルテスト環境では外部API(Anthropic/LINE/KV)への接続失敗は予想内
        const EXPECTED_ERRORS = [
          'api.anthropic.com',
          'api.line.me',
          'upstash.io',
          'vercel.app',
          'cybozu.com',
          'net::ERR_NAME_NOT_RESOLVED',
          'net::ERR_FAILED',
          'net::ERR_CONNECTION_REFUSED',
        ];
        if (EXPECTED_ERRORS.some(e => text.includes(e))) {
          // ローカル環境での外部API接続エラーはINFOとして記録
          // this.log(`[外部API] ${text.slice(0, 60)}`);
          return;
        }
        this.observe('BUG', 'HIGH',
          `コンソールエラー: ${text.slice(0, 100)}`,
          { page: this.page.url() }
        );
      }
    });
    return this;
  }

  async login() {
    await this.page.goto(`${config.BASE_URL}/coreto-hub-v2.html`, { timeout: 20000 });
    await this.page.waitForTimeout(800);
    await this.page.fill('#login-id', this.roleInfo.userId);
    await this.page.fill('#login-pw', this.roleInfo.pw);
    await this.page.click('button[onclick*="doLogin"]');
    await this.page.waitForTimeout(1500);

    const loggedIn = await this.page.locator('#app').isVisible().catch(() => false);
    if (!loggedIn) throw new Error(`${this.label}: ログイン失敗`);
    this.log(`✅ ログイン完了`);
    return this;
  }

  async goto(path) {
    const url = path.startsWith('http') ? path : `${config.BASE_URL}/${path}`;
    await this.page.goto(url, { timeout: 15000 });
    await this.page.waitForTimeout(1000);
    return this;
  }

  async screenshot(name) {
    const ts = Date.now();
    const fpath = `/home/claude/coreto-fixed/simulation/reports/screenshots/${this.roleKey}_${name}_${ts}.png`;
    await this.page.screenshot({ path: fpath, fullPage: false }).catch(() => {});
    this.screenshots.push(fpath);
    return fpath;
  }

  async close() {
    if (this.browser) await this.browser.close();
  }

  // ────── 観察記録 ──────────────────────────────────────

  observe(category, severity, message, context = {}) {
    const entry = {
      agent:    this.label,
      roleKey:  this.roleKey,
      category,
      severity: config.SEVERITY[severity] || 3,
      severityLabel: severity,
      message,
      context: {
        url:       this.page?.url?.() || '',
        timestamp: new Date().toISOString(),
        ...context,
      },
    };
    this.observations.push(entry);
    const sev = { CRITICAL: '🔴', HIGH: '🟠', MEDIUM: '🟡', LOW: '🔵' }[severity] || '⚪';
    console.log(`  ${sev} [${this.label}][${category}] ${message}`);
    return entry;
  }

  // ────── UI状態チェック ────────────────────────────────

  async checkCurrentPage() {
    const checks = [];

    // サイドバー表示
    const sbOk = await this.page.locator('.sb').isVisible().catch(() => false);
    if (!sbOk) {
      this.observe('BUG', 'HIGH', 'サイドバーが表示されていない');
    }

    // ナビアイテム数
    const navCount = await this.page.locator('.cnav-item').count().catch(() => 0);
    if (navCount === 0) {
      this.observe('BUG', 'HIGH', 'ナビゲーションアイテムが0件');
    }

    // ページコンテンツの存在
    const title = await this.page.locator('#page-title').textContent().catch(() => null);
    if (!title) {
      this.observe('BUG', 'HIGH', 'ページタイトルが取得できない（コンテンツ未描画の可能性）');
    }

    return { sbOk, navCount, title };
  }

  async checkForHardcodedData() {
    const bodyText = await this.page.locator('body').textContent().catch(() => '');
    const demoPatterns = [
      { pattern: /田中 優子|高橋 美咲|鈴木 健太|山田 誠|木下 大輔/, label: 'デモ人名' },
      { pattern: /RENT-0[1-9]\d{2}|RC-10\d{3}/, label: 'デモ案件ID' },
      { pattern: /AG-00(42|55|88)/, label: 'デモAG-ID' },
      { pattern: /¥3,840,000|¥6,820,000|¥926,250/, label: 'デモ固定金額' },
    ];
    for (const { pattern, label } of demoPatterns) {
      if (pattern.test(bodyText)) {
        this.observe('DATA', 'HIGH', `ハードコードデータが表示されている: ${label}`, {
          url: this.page.url()
        });
      }
    }
  }

  // ────── ユーティリティ ────────────────────────────────

  log(msg) {
    console.log(`  [${this.label}] ${msg}`);
  }

  async wait(ms) {
    await this.page.waitForTimeout(ms);
  }

  getObservations() {
    return this.observations;
  }
}

module.exports = BaseAgent;
