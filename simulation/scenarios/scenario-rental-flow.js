/**
 * シナリオ: 賃貸案件フルフロー
 * クライアントが物件を探す → AGが対応 → 成約 → HQ承認 → コミッション支払い
 */

module.exports = {
  name: '賃貸案件フルフロー',
  description: 'クライアントの物件探しから成約・コミッション支払いまでの一連フロー',

  // テストデータ
  testData: {
    client: { name: 'テスト 花子', phone: '090-0000-0001', email: 'test@example.com' },
    property: { type: '賃貸', area: '渋谷区', budget: 150000, rooms: '1LDK' },
    contract: { rent: 148000, deposit: 296000, fee: 148000 },
  },

  // シナリオステップ定義
  steps: [
    {
      id: 'S01',
      name: '初期確認 - 全ロールダッシュボード',
      roles: ['hq', 'ag', 'pt'],
      action: async (agents, data) => {
        const { hq, ag, pt } = agents;

        // 全ロールで同時にダッシュボードを確認
        await hq.checkDashboard();
        await ag.checkDashboard();
        if (pt) await pt.goto('coreto-hub-v2.html').then(() => pt.checkCurrentPage());
      },
    },
    {
      id: 'S02',
      name: 'AG: 担当案件一覧の確認',
      roles: ['ag'],
      action: async (agents, data) => {
        await agents.ag.checkCases();
      },
    },
    {
      id: 'S03',
      name: 'AG: 成約報告フォームの確認・入力テスト',
      roles: ['ag'],
      action: async (agents, data) => {
        await agents.ag.checkContractReport();
        await agents.ag.submitContractReport({
          clientName: data.client.name,
          amount: data.contract.fee,
          type: '賃貸',
        });
      },
    },
    {
      id: 'S04',
      name: 'HQ: 承認待ち一覧の確認',
      roles: ['hq'],
      action: async (agents, data) => {
        await agents.hq.checkPendingApprovals();
      },
    },
    {
      id: 'S05',
      name: 'AG: 即時払い申請の確認',
      roles: ['ag'],
      action: async (agents, data) => {
        await agents.ag.checkInstantPay();
        await agents.ag.checkRank();
      },
    },
    {
      id: 'S06',
      name: 'HQ: 送金管理・入金確認',
      roles: ['hq'],
      action: async (agents, data) => {
        await agents.hq.checkRemittance();
      },
    },
    {
      id: 'S07',
      name: 'PT: ポータル・紹介フロー確認',
      roles: ['pt'],
      action: async (agents, data) => {
        if (agents.pt) await agents.pt.runFullCheck();
      },
    },
    {
      id: 'S08',
      name: 'HQ: CRM・ユーザー管理確認',
      roles: ['hq'],
      action: async (agents, data) => {
        await agents.hq.checkCRM();
        await agents.hq.checkUserManagement();
      },
    },
  ],
};
