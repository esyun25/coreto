/**
 * PTエージェント
 */
const BaseAgent = require('./base-agent');

class PTAgent extends BaseAgent {
  constructor(options = {}) {
    super('pt', options);
  }

  async checkPortal() {
    this.log('PTポータル確認中...');
    await this.goto('coreto-pt-portal-v2.html');
    await this.checkCurrentPage();
    await this.checkForHardcodedData();

    // 紹介フォームの確認
    const referForms = await this.page.locator('form, [id*="refer"], [id*="submit"]').count().catch(() => 0);
    if (!referForms) {
      this.observe('UX', 'MEDIUM', 'PTポータルで紹介フォームが見当たらない');
    }

    // 進捗確認リンク
    const progressLink = await this.page.locator('a[href*="progress"], button:has-text("進捗")').count().catch(() => 0);
    if (!progressLink) {
      this.observe('UX', 'MEDIUM', '紹介した案件の進捗確認ボタンが見当たらない');
    }
  }

  async checkReferralCode() {
    this.log('紹介コード確認中...');
    await this.goto('coreto-recruit-link-v2.html');
    await this.checkCurrentPage();

    const codeDisplay = await this.page.locator('[id*="code"], [class*="ref-code"], [class*="qr"]').count().catch(() => 0);
    if (!codeDisplay) {
      this.observe('UX', 'LOW', '紹介コード・QRコードの表示エリアが見当たらない');
    }
  }

  async checkRewardHistory() {
    this.log('報酬明細確認中...');
    await this.goto('coreto-rank-v2.html');
    await this.checkCurrentPage();
    await this.checkForHardcodedData();
  }

  async runFullCheck() {
    await this.goto('coreto-hub-v2.html');
    await this.checkCurrentPage();
    await this.checkForHardcodedData();
    await this.checkPortal();
    await this.checkReferralCode();
    await this.checkRewardHistory();
  }
}

module.exports = PTAgent;
