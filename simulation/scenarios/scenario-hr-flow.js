/**
 * シナリオ: 人材案件フルフロー
 */
module.exports = {
  name: '人材案件フルフロー',
  description: '転職希望者をAGが受付→企業マッチング→内定→在籍確認→コミッション',
  testData: {
    applicant: { name: 'テスト 次郎', age: 28, jobType: 'エンジニア', salary: 5500000 },
    company: { name: '株式会社テスト', industry: 'IT', location: '渋谷区' },
  },
  steps: [
    { id:'H01', name:'HR-AG: ダッシュボード確認', roles:['ag'],
      action: async(a,d) => { await a.ag.checkDashboard(); } },
    { id:'H02', name:'HR-AG: 担当案件一覧', roles:['ag'],
      action: async(a,d) => { await a.ag.checkCases(); } },
    { id:'H03', name:'HR-AG: 成約報告フォーム確認', roles:['ag'],
      action: async(a,d) => {
        await a.ag.checkContractReport();
        await a.ag.submitContractReport({ clientName: d.applicant.name, amount: 550000, type:'HR' });
      } },
    { id:'H04', name:'HQ: 承認ワークフロー確認', roles:['hq'],
      action: async(a,d) => { await a.hq.checkPendingApprovals(); } },
    { id:'H05', name:'HR-AG: ランク・報酬確認', roles:['ag'],
      action: async(a,d) => { await a.ag.checkRank(); } },
  ],
};