/**
 * AGエージェント（不動産・人材・光通信）
 * 案件受付から成約報告・即時払い申請まで
 */

const BaseAgent = require('./base-agent');

class AGAgent extends BaseAgent {
  constructor(agType = 're_ag', options = {}) {
    const keyMap = { re_ag: 're_ag', hr_ag: 'hr_ag', hikari_ag: 'hikari_ag' };
    super(keyMap[agType] || 're_ag', options);
    this.agType = agType;
  }

  // ダッシュボード確認
  async checkDashboard() {
    this.log('マイダッシュボード確認中...');
    await this.goto('coreto-hub-v2.html');
    await this.checkCurrentPage();
    await this.checkForHardcodedData();

    // ナビバッジ確認
    const badges = await this.page.locator('.cnav-badge:visible').allTextContents().catch(() => []);
    this.log(`表示中のバッジ: ${badges.join(', ') || 'なし'}`);

    // ページタイトル
    const title = await this.page.locator('#page-title').textContent().catch(() => '');
    if (title === 'ダッシュボード' && this.agType !== 'hq') {
      this.observe('UI', 'LOW', `ページタイトルが「ダッシュボード」のまま（「マイダッシュボード」であるべき）`);
    }
  }

  // 担当案件一覧確認
  async checkCases() {
    this.log('担当案件一覧確認中...');
    const page = this.agType === 'hr_ag' ? 'coreto-hr-matching-v2.html' : 'coreto-cases-v2.html';
    await this.goto(page);
    await this.checkCurrentPage();
    await this.checkForHardcodedData();

    // タブカウント確認
    const counts = {
      all:     await this.page.locator('#count-all').textContent().catch(() => null),
      rental:  await this.page.locator('#count-rental').textContent().catch(() => null),
      sale:    await this.page.locator('#count-sale').textContent().catch(() => null),
      utility: await this.page.locator('#count-utility').textContent().catch(() => null),
    };
    this.log(`案件数: 全体=${counts.all} 賃貸=${counts.rental} 売買=${counts.sale}`);

    // 空リスト時のメッセージ確認
    const isEmpty = await this.page.locator('.empty-state, .no-cases, [class*="empty"]').isVisible().catch(() => false);
    const caseRows = await this.page.locator('.case-row').count().catch(() => 0);
    if (caseRows === 0 && !isEmpty) {
      this.observe('UX', 'MEDIUM', '案件が0件のとき「まだ案件がありません」等の案内メッセージがない');
    }

    return { counts, caseRows };
  }

  // 成約報告ページ確認・入力テスト
  async checkContractReport() {
    this.log('成約報告ページ確認中...');
    const page = this.agType === 'hr_ag' ? 'coreto-contract-report-v2.html' : 'coreto-contract-report-v2.html';
    await this.goto(page);
    await this.checkCurrentPage();
    await this.checkForHardcodedData();

    // フォームフィールドの存在確認
    const fields = {
      clientName: await this.page.locator('#client-name, [name="clientName"], input[placeholder*="クライアント"]').count().catch(() => 0),
      amount:     await this.page.locator('#amount, [name="amount"], input[placeholder*="金額"]').count().catch(() => 0),
      submitBtn:  await this.page.locator('button[type="submit"], button:has-text("報告"), button:has-text("送信")').count().catch(() => 0),
    };
    this.log(`フォームフィールド: ${JSON.stringify(fields)}`);

    if (!fields.submitBtn) {
      this.observe('BUG', 'HIGH', '成約報告フォームに送信ボタンが見当たらない');
    }

    // 必須フィールドのバリデーション表示確認
    const requiredMarks = await this.page.locator('.req, [class*="required"], span:has-text("*")').count().catch(() => 0);
    if (!requiredMarks) {
      this.observe('UX', 'LOW', '成約報告フォームに必須項目マーク（*）がない');
    }
  }

  // 入金確認ページを確認
  async checkRemittance() {
    this.log('入金確認ページ確認中...');
    await this.goto('coreto-remittance-v2.html');
    await this.checkCurrentPage();
    await this.checkForHardcodedData();
  }

  // 即時払い申請ページを確認
  async checkInstantPay() {
    this.log('即時払い申請ページ確認中...');
    await this.goto('coreto-instant-pay-v2.html');
    await this.checkCurrentPage();
    await this.checkForHardcodedData();

    // 残高表示確認
    const balance = await this.page.locator('#balance-display, [id*="balance"], .balance-amount').first().textContent().catch(() => null);
    if (!balance) {
      this.observe('UX', 'MEDIUM', '即時払い可能残高の表示が見当たらない');
    }

    // 申請ボタン
    const applyBtn = await this.page.locator('button:has-text("申請"), button:has-text("出金"), button[onclick*="apply"]').count().catch(() => 0);
    if (!applyBtn) {
      this.observe('BUG', 'HIGH', '即時払い申請ボタンが見当たらない');
    }
  }

  // ランク・報酬明細確認
  async checkRank() {
    this.log('ランク・報酬明細確認中...');
    await this.goto('coreto-rank-v2.html');
    await this.checkCurrentPage();
    await this.checkForHardcodedData();

    // コミッション率の表示
    const rateEl = await this.page.locator('[class*="rate"], [class*="commission"], [class*="percent"]').count().catch(() => 0);
    if (!rateEl) {
      this.observe('UX', 'LOW', 'コミッション率が明確に表示されていない（AGにとって重要な情報）');
    }
  }

  // 成約報告フォームに実際に入力してみる
  async submitContractReport(data) {
    this.log(`成約報告入力テスト: ${JSON.stringify(data)}`);
    await this.goto('coreto-contract-report-v2.html');

    const tryFill = async (selectors, value) => {
      for (const sel of selectors) {
        const el = this.page.locator(sel).first();
        if (await el.isVisible().catch(() => false)) {
          await el.fill(value);
          return true;
        }
      }
      return false;
    };

    const filled = {
      client:   await tryFill(['#client-name','#clientName','[name="clientName"]'], data.clientName || 'テスト 太郎'),
      amount:   await tryFill(['#fee-input','[data-field="amount"]','#monthly-rent','#amount'], String(data.amount || 150000)),
      caseType: false,
    };

    // 賃貸/売買セレクト
    const typeSelect = this.page.locator('select[name="caseType"], select[name="type"], #case-type').first();
    if (await typeSelect.isVisible().catch(() => false)) {
      await typeSelect.selectOption({ index: 1 });
      filled.caseType = true;
    }

    this.log(`入力結果: ${JSON.stringify(filled)}`);

    // 入力されていないフィールドを報告
    if (!filled.client) this.observe('BUG', 'HIGH', '成約報告: クライアント名フィールドが見つからない');
    if (!filled.amount) this.observe('BUG', 'HIGH', '成約報告: 金額フィールドが見つからない');

    return filled;
  }

  // 全体フロー確認
  async runFullCheck() {
    await this.checkDashboard();
    await this.checkCases();
    await this.checkContractReport();
    await this.checkRemittance();
    await this.checkInstantPay();
    await this.checkRank();
  }
}

module.exports = AGAgent;
