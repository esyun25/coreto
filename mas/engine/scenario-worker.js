/**
 * シナリオワーカー
 * 1つのシナリオを全ロール（Client→PT→AG→HQ）で実行する
 * Claude APIで各ロールの意思決定をシミュレートする
 */

'use strict';

const { chromium } = require('playwright');
const config = require('../config') || {
  BASE_URL: 'http://localhost:8765',
  ROLES: {
    hq_exec: { userId:'HQ-00001', pw:'Coreto2026!', role:'hq', label:'HQ統括' },
    re_ag:   { userId:'AG-0042',  pw:'agent2026',   role:'re_ag', label:'不動産AG' },
    hr_ag:   { userId:'AG-0103',  pw:'agent2026',   role:'hr_ag', label:'人材AG' },
    pt:      { userId:'PT-0015',  pw:'partner26',   role:'pt',   label:'PT' },
  },
};

// ────────────────────────────────────────────────────────────
// 軽量ブラウザエージェント（Playwright）
// ────────────────────────────────────────────────────────────

class LightAgent {
  constructor(roleKey, browser, context) {
    this.roleKey  = roleKey;
    this.roleInfo = config.ROLES[roleKey] || config.ROLES.re_ag;
    this.label    = this.roleInfo.label;
    this.page     = null;
    this.context  = context;
    this.observations = [];
    this.consoleErrors = [];
  }

  async init() {
    this.page = await this.context.newPage();
    this.page.on('console', msg => {
      if (msg.type() === 'error') this.consoleErrors.push(msg.text().slice(0, 100));
    });
    return this;
  }

  async login() {
    try {
      await this.page.goto(`${config.BASE_URL}/coreto-hub-v2.html`, { timeout: 15000 });
      await this.page.waitForTimeout(500);
      await this.page.fill('#login-id', this.roleInfo.userId);
      await this.page.fill('#login-pw', this.roleInfo.pw);
      await this.page.click('button[onclick*="doLogin"]');
      await this.page.waitForTimeout(1000);
      return true;
    } catch(e) {
      this.observe('BUG','HIGH',`ログイン失敗: ${e.message.slice(0,60)}`);
      return false;
    }
  }

  async goto(path) {
    try {
      const url = path.startsWith('http') ? path : `${config.BASE_URL}/${path}`;
      await this.page.goto(url, { timeout: 12000 });
      await this.page.waitForTimeout(600);
      return true;
    } catch(e) {
      this.observe('BUG','HIGH',`ページ遷移失敗: ${path} - ${e.message.slice(0,50)}`);
      return false;
    }
  }

  // ページ基本チェック
  async quickCheck(stepName) {
    try {
      const title = await this.page.locator('#page-title').textContent({ timeout:3000 }).catch(()=>null);
      const navCnt = await this.page.locator('.cnav-item').count().catch(()=>0);
      const sbOk   = await this.page.locator('.sb').isVisible().catch(()=>false);
      const body   = await this.page.locator('body').textContent({ timeout:3000 }).catch(()=>'');

      if (!sbOk)     this.observe('BUG','HIGH',`[${stepName}] サイドバーが非表示`);
      if (navCnt===0) this.observe('BUG','HIGH',`[${stepName}] ナビアイテム0件`);
      if (!title)    this.observe('BUG','MEDIUM',`[${stepName}] ページタイトル未取得`);

      // ハードコードデモデータ検出
      const demoNames = ['田中 優子','高橋 美咲','山田 誠','木下 大輔','佐藤 健'];
      for (const name of demoNames) {
        if (body.includes(name)) {
          this.observe('DATA','HIGH',`[${stepName}] ハードコードデモ人名: "${name}"`);
        }
      }

      // コンソールエラーを観察に追加
      for (const err of this.consoleErrors.splice(0)) {
        if (!err.includes('net::ERR_BLOCKED')) { // テスト環境のブロックは無視
          this.observe('BUG','HIGH',`コンソールエラー: ${err}`);
        }
      }

      return { title, navCnt, sbOk };
    } catch(e) {
      return {};
    }
  }

  // フォームフィールドを入力する
  async fillField(selectors, value, fieldName) {
    for (const sel of selectors) {
      try {
        const el = this.page.locator(sel).first();
        if (await el.isVisible({ timeout:2000 })) {
          await el.fill(String(value));
          return true;
        }
      } catch {}
    }
    this.observe('BUG','HIGH',`フィールド未発見: ${fieldName} (${selectors.join(', ')})`);
    return false;
  }

  // ボタンをクリックする
  async clickButton(selectors, btnName) {
    for (const sel of selectors) {
      try {
        const el = this.page.locator(sel).first();
        if (await el.isVisible({ timeout:2000 })) {
          await el.click();
          await this.page.waitForTimeout(500);
          return true;
        }
      } catch {}
    }
    this.observe('UX','MEDIUM',`ボタン未発見: ${btnName} (${selectors.join(', ')})`);
    return false;
  }

  // 空状態チェック
  async checkEmptyState(containerSel, itemSel, pageLabel) {
    const items = await this.page.locator(itemSel).count().catch(()=>0);
    if (items === 0) {
      const hasEmptyMsg = await this.page.locator(
        '.empty-msg, .empty-state, [class*="empty"], text="データがありません", text="まだ"'
      ).count().catch(()=>0);
      if (!hasEmptyMsg) {
        this.observe('UX','MEDIUM',`案件が0件のとき空状態メッセージがない: ${pageLabel}`);
      }
    }
    return items;
  }

  observe(category, severity, message) {
    const entry = { category, severity, message, agent: this.label,
                    roleKey: this.roleKey, context: { url: this.page?.url?.() || '' } };
    this.observations.push(entry);
  }

  getObservations() { return this.observations; }
}

// ────────────────────────────────────────────────────────────
// シナリオステップ実行
// ────────────────────────────────────────────────────────────

class ScenarioWorker {
  constructor(scenario, opts = {}) {
    this.scenario = scenario;
    this.opts     = opts;
    this.result   = { success: false, duration: 0, stepsCompleted: [], stuckAt: null, observations: [] };
    this.browser  = null;
  }

  async run() {
    const t0 = Date.now();
    try {
      this.browser = await chromium.launch({ headless: this.opts.headless !== false });
      const ctx = await this.browser.newContext({ viewport:{width:1280, height:800} });

      // ロールに応じたエージェントを初期化
      const agRole = this.scenario.agRole || 're_ag';
      const agents = {};
      agents.hq = new LightAgent('hq_exec', this.browser, ctx);
      agents.ag = new LightAgent(agRole,     this.browser, ctx);
      if (this.scenario.hasPT) agents.pt = new LightAgent('pt', this.browser, ctx);

      for (const [key, agent] of Object.entries(agents)) {
        await agent.init();
        const ok = await agent.login();
        if (!ok) { this.result.stuckAt = 'login'; return this.result; }
      }

      // フローを実行
      for (const step of this.scenario.flow) {
        const ok = await this.executeStep(step, agents);
        if (ok) {
          this.result.stepsCompleted.push(step);
        } else {
          this.result.stuckAt = step;
          break;
        }
      }

      // 全ステップ完了=成功
      this.result.success = (this.result.stuckAt === null);

      // 全エージェントの観察を収集
      for (const agent of Object.values(agents)) {
        this.result.observations.push(...agent.getObservations());
      }

    } catch(e) {
      this.result.observations.push({
        category:'BUG', severity:'CRITICAL',
        message: `ワーカー例外: ${e.message.slice(0,80)}`,
        agent: 'worker', context:{}
      });
    } finally {
      if (this.browser) await this.browser.close().catch(()=>{});
      this.result.duration = Date.now() - t0;
    }
    return this.result;
  }

  async executeStep(step, agents) {
    const { ag, hq, pt } = agents;
    const scenario = this.scenario;
    const prop = scenario.property || {};
    const client = scenario.client || {};

    try {
      switch(step) {

        case 'inquiry': {
          // クライアントが案件を問い合わせる（AGダッシュ確認）
          await ag.goto('coreto-hub-v2.html');
          await ag.quickCheck('inquiry');
          return true;
        }

        case 'matching': {
          // AG/PTがマッチングシステムを確認
          if (pt) {
            await pt.goto('coreto-pt-portal-v2.html');
            await pt.quickCheck('pt-portal');
          }
          await ag.goto('coreto-cases-v2.html');
          await ag.quickCheck('matching');
          await ag.checkEmptyState('#dynamic-cases-list', '.case-row', '担当案件一覧');
          return true;
        }

        case 'showing': {
          // 内見管理
          await ag.goto('coreto-showing-v2.html');
          await ag.quickCheck('showing');
          return true;
        }

        case 'screening': {
          // 書類審査
          await ag.goto('coreto-screening-v2.html');
          await ag.quickCheck('screening');
          return true;
        }

        case 'itsetsu': {
          // IT重説予約
          await ag.goto('coreto-itsetsu-booking-v2.html');
          await ag.quickCheck('itsetsu-booking');
          // 予約フォームのチェック
          const dateField = await ag.page.locator('input[type="date"], #preferred-date').count().catch(()=>0);
          if (!dateField) ag.observe('UX','MEDIUM','[itsetsu] 日程入力フィールドが見当たらない');
          return true;
        }

        case 'contract': {
          // 成約報告
          await ag.goto('coreto-contract-report-v2.html');
          await ag.quickCheck('contract-report');
          // フォーム入力テスト
          await ag.fillField(['#client-name','[data-field="client-name"]'], client.name || 'テスト太郎', 'クライアント名');
          await ag.fillField(['#fee-input','[data-field="amount"]','#monthly-rent'], String(prop.rent || prop.price || 100000), '金額');
          // 送信ボタン確認
          const submitOk = await ag.clickButton([
            'button[onclick*="submitReport"]','button:has-text("報告を送信")','button:has-text("成約報告")'
          ], '成約報告送信');
          if (!submitOk) ag.observe('BUG','HIGH','成約報告の送信ボタンが機能しない');
          return true;
        }

        case 'payment': {
          // HQが承認・送金処理
          await hq.goto('coreto-remittance-v2.html');
          await hq.quickCheck('remittance');
          // KPI動的化チェック
          const kpiTexts = await hq.page.locator('#rm-kpi-overdue, #rm-kpi-pending').allTextContents().catch(()=>[]);
          for (const t of kpiTexts) {
            if (t && t !== '—' && !/^\d+件$/.test(t.trim())) {
              hq.observe('DATA','MEDIUM',`入金確認KPIが不正な値: "${t}"`);
            }
          }
          return true;
        }

        case 'instant_pay': {
          // AG即時払い申請
          await ag.goto('coreto-instant-pay-v2.html');
          await ag.quickCheck('instant-pay');
          // 残高不足シミュレーション
          if (scenario.issue === 'insufficient_balance') {
            const applyBtn = await ag.page.locator(
              'button[onclick*="applyInstantPay"], button:has-text("申請"), button:has-text("出金")'
            ).first();
            if (await applyBtn.isVisible().catch(()=>false)) {
              await applyBtn.click().catch(()=>{});
              await ag.page.waitForTimeout(500);
              // エラーメッセージが表示されるか
              const errMsg = await ag.page.locator('.error-msg, .toast-err, [class*="error"]').count().catch(()=>0);
              if (!errMsg) ag.observe('UX','MEDIUM','残高不足時のエラーメッセージが表示されない');
            }
          }
          return true;
        }

        case 'cancel': {
          // キャンセルフロー
          await ag.goto('coreto-cases-v2.html');
          await ag.quickCheck('cancel');
          const cancelBtn = await ag.page.locator(
            'button:has-text("キャンセル"), button:has-text("取消")'
          ).count().catch(()=>0);
          if (!cancelBtn) ag.observe('FLOW','HIGH','案件キャンセルフローが存在しない');
          return true;
        }

        default:
          return true;
      }
    } catch(e) {
      (agents.ag || agents.hq)?.observe('BUG','HIGH',`ステップ[${step}]例外: ${e.message.slice(0,60)}`);
      return false;
    }
  }
}

module.exports = ScenarioWorker;
