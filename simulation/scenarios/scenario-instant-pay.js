/**
 * シナリオ: 即時払い申請フロー
 */
module.exports = {
  name: '即時払い申請フロー',
  description: 'AGが即時払い申請→HQが審査→振込実行',
  testData: { amount: 200000 },
  steps: [
    { id:'I01', name:'AG: 即時払いページ確認', roles:['ag'],
      action: async(a,d) => { await a.ag.checkInstantPay(); } },
    { id:'I02', name:'HQ: 即時払い審査ページ確認', roles:['hq'],
      action: async(a,d) => {
        await a.hq.goto('coreto-instant-pay-v2.html');
        await a.hq.checkCurrentPage();
        await a.hq.checkForHardcodedData();
        // HQ視点でKPIを確認
        const locked = await a.hq.page.locator('#ip-kpi-locked').textContent().catch(()=>null);
        const done   = await a.hq.page.locator('#ip-kpi-done').textContent().catch(()=>null);
        a.hq.log(\`即時払いKPI: ロック=\${locked} 完了=\${done}\`);
      } },
    { id:'I03', name:'AG: ランク明細で報酬確認', roles:['ag'],
      action: async(a,d) => { await a.ag.checkRank(); } },
  ],
};