/**
 * HQエージェント
 * 承認・管理・支払い処理を担当
 */

const BaseAgent = require('./base-agent');

class HQAgent extends BaseAgent {
  constructor(options = {}) {
    super('hq_exec', options);
  }

  // ダッシュボードを確認して問題を記録
  async checkDashboard() {
    this.log('ダッシュボード確認中...');
    await this.goto('coreto-hub-v2.html');
    await this.checkCurrentPage();
    await this.checkForHardcodedData();

    // KPIが動的か確認
    const kpiVals = await this.page.locator('.kpi-value, .kpi-val').allTextContents().catch(() => []);
    const suspicious = kpiVals.filter(v => v && v !== '—' && v !== '0' && /^[\d,¥]+$/.test(v.trim()));
    if (suspicious.length > 0) {
      this.observe('DATA', 'MEDIUM', `KPIに数値が表示中（実データ or ハードコード確認推奨）: ${suspicious.slice(0,3).join(', ')}`);
    }

    // タスク一覧
    const taskItems = await this.page.locator('.task-item, .task-name').count().catch(() => 0);
    if (taskItems > 0) {
      const taskTexts = await this.page.locator('.task-name').allTextContents().catch(() => []);
      this.observe('DATA', 'LOW', `タスク${taskItems}件表示中: ${taskTexts.slice(0,2).join(' / ')}`);
    }
  }

  // 承認待ち案件を確認
  async checkPendingApprovals() {
    this.log('承認待ち案件確認中...');
    await this.goto('coreto-contract-report-v2.html');
    await this.checkCurrentPage();
    await this.checkForHardcodedData();

    // 承認ボタンの存在確認
    const approveButtons = await this.page.locator('button:has-text("承認"), button:has-text("確認"), [onclick*="approve"]').count().catch(() => 0);
    this.log(`承認ボタン: ${approveButtons}件`);

    // テーブルに行があるか
    const rows = await this.page.locator('table tr, .report-row, .case-row').count().catch(() => 0);
    if (rows === 0) {
      this.observe('UX', 'LOW', '承認待ち一覧が空（実データがない場合は正常）');
    }
    return { approveButtons, rows };
  }

  // 送金管理を確認
  async checkRemittance() {
    this.log('入金確認ページ確認中...');
    await this.goto('coreto-remittance-v2.html');
    await this.checkCurrentPage();
    await this.checkForHardcodedData();

    // KPI値の確認
    const kpis = {
      overdue: await this.page.locator('#rm-kpi-overdue').textContent().catch(() => null),
      pending: await this.page.locator('#rm-kpi-pending').textContent().catch(() => null),
    };
    this.log(`入金KPI: 超過=${kpis.overdue} 待ち=${kpis.pending}`);

    // ページのUX問題を確認
    const hasFilter = await this.page.locator('input[type="search"], .filter-input, select').count().catch(() => 0);
    if (!hasFilter) {
      this.observe('UX', 'LOW', '入金確認ページにフィルター機能がない（件数が増えると探しにくい）');
    }
  }

  // ユーザー管理を確認
  async checkUserManagement() {
    this.log('ユーザー管理確認中...');
    await this.goto('coreto-user-mgmt-v2.html');
    await this.checkCurrentPage();
    await this.checkForHardcodedData();
  }

  // CRMを確認
  async checkCRM() {
    this.log('CRM確認中...');
    await this.goto('coreto-crm-v2.html');
    await this.checkCurrentPage();
    await this.checkForHardcodedData();

    const totalCount = await this.page.locator('#crm-total-count').textContent().catch(() => null);
    if (totalCount && totalCount !== '—' && parseInt(totalCount) > 0) {
      this.observe('DATA', 'LOW', `CRMクライアント数: ${totalCount}件表示`);
    }
  }

  // 成約承認ワークフローを実行
  async approveReport(reportId) {
    this.log(`成約承認: ${reportId}`);
    await this.goto('coreto-contract-report-v2.html');

    // 承認ボタンを探してクリック
    const approveBtn = await this.page.locator(`[data-id="${reportId}"] button:has-text("承認"), #approve-${reportId}`).first();
    if (await approveBtn.isVisible().catch(() => false)) {
      await approveBtn.click();
      await this.wait(800);
      this.log(`✅ 承認実行: ${reportId}`);
      return true;
    }
    this.observe('UX', 'MEDIUM', `承認ボタンが見つからない (${reportId}) - 一覧の表示・検索が不十分`);
    return false;
  }

  // 全体フロー確認
  async checkInstantPayAdmin() {
    this.log('即時払い審査ページ確認中...');
    await this.goto('coreto-instant-pay-v2.html');
    await this.checkCurrentPage();
    await this.checkForHardcodedData();
    // 全社KPIの確認
    const locked = await this.page.locator('#ip-kpi-locked').textContent().catch(()=>null);
    const done   = await this.page.locator('#ip-kpi-done').textContent().catch(()=>null);
    const total  = await this.page.locator('#ip-kpi-total').textContent().catch(()=>null);
    this.log(`即時払いKPI: ロック=${locked} 完了=${done} 総額=${total}`);
  }

  async checkPayroll() {
    this.log('給与明細ページ確認中...');
    await this.goto('coreto-payroll-v2.html');
    await this.checkCurrentPage();
    await this.checkForHardcodedData();
  }

  async runFullCheck() {
    await this.checkDashboard();
    await this.checkPendingApprovals();
    await this.checkRemittance();
    await this.checkInstantPayAdmin();
    await this.checkCRM();
    await this.checkUserManagement();
    await this.checkPayroll();
  }
}

module.exports = HQAgent;
