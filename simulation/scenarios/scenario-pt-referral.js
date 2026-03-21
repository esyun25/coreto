/**
 * シナリオ: PT紹介フロー
 */
module.exports = {
  name: 'PT紹介フロー',
  description: 'PTがクライアントを紹介→AGが案件化→PT紹介報酬発生',
  testData: {
    client: { name: 'テスト 三郎', type: '賃貸', area: '新宿区' },
  },
  steps: [
    { id:'PT01', name:'PT: ポータル確認', roles:['pt'],
      action: async(a,d) => { await a.pt.runFullCheck(); } },
    { id:'PT02', name:'AG: PTからの紹介案件確認', roles:['ag'],
      action: async(a,d) => {
        await a.ag.checkCases();
        await a.ag.checkContractReport();
      } },
    { id:'PT03', name:'HQ: PT紹介の管理確認', roles:['hq'],
      action: async(a,d) => {
        await a.hq.goto("coreto-user-mgmt-v2.html");
        await a.hq.checkCurrentPage();
        await a.hq.checkForHardcodedData();
      } },
    { id:'PT04', name:'PT: 報酬履歴確認', roles:['pt'],
      action: async(a,d) => { await a.pt.checkRewardHistory(); } },
  ],
};