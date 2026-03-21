/**
 * シナリオジェネレーター
 * 1000パターンの案件シナリオを自動生成する
 */

'use strict';

// ────────────────────────────────────────────────────────────
// マスターデータ
// ────────────────────────────────────────────────────────────

const CLIENTS = [
  { name:'田村 光司', age:32, job:'会社員', income:450, needs:'1LDK 渋谷区', type:'賃貸' },
  { name:'岡本 恵美', age:28, job:'フリーランス', income:380, needs:'1K 新宿区', type:'賃貸' },
  { name:'松田 誠二', age:45, job:'経営者', income:1200, needs:'3LDK 港区', type:'売買' },
  { name:'中島 由美', age:35, job:'医師', income:950, needs:'2LDK 文京区', type:'賃貸' },
  { name:'吉田 隆', age:29, job:'エンジニア', income:600, needs:'光通信 戸建て', type:'光通信' },
  { name:'山口 真奈', age:31, job:'営業', income:420, needs:'転職 IT業界', type:'人材' },
  { name:'小林 健太', age:38, job:'メーカー', income:550, needs:'転職 管理職', type:'人材' },
  { name:'加藤 美穂', age:26, job:'新卒', income:280, needs:'1K 江東区', type:'賃貸' },
  { name:'鈴木 正一', age:52, job:'自営業', income:800, needs:'事務所兼用 2LDK', type:'賃貸' },
  { name:'石川 裕子', age:40, job:'公務員', income:530, needs:'光通信 マンション', type:'光通信' },
  { name:'森田 大輔', age:33, job:'デザイナー', income:480, needs:'1LDK 中目黒', type:'賃貸' },
  { name:'高木 春奈', age:27, job:'看護師', income:420, needs:'1K 世田谷区', type:'賃貸' },
  { name:'池田 修平', age:41, job:'管理職', income:750, needs:'4LDK 郊外 売買', type:'売買' },
  { name:'西村 美咲', age:30, job:'主婦', income:320, needs:'2LDK 子育て向け', type:'賃貸' },
  { name:'斉藤 浩二', age:48, job:'経理', income:620, needs:'転職 同業種', type:'人材' },
];

const PROPERTIES = {
  賃貸: [
    { addr:'渋谷区神宮前2-3-4', name:'パークアクシス神宮前', rent:165000, floor:'8F', rooms:'1LDK' },
    { addr:'新宿区西新宿5-1-2', name:'スカイレジデンス西新宿', rent:88000, floor:'3F', rooms:'1K' },
    { addr:'港区三田3-7-2', name:'グランドメゾン三田', rent:248000, floor:'15F', rooms:'3LDK' },
    { addr:'文京区本郷4-2-1', name:'本郷グリーンヒルズ', rent:178000, floor:'6F', rooms:'2LDK' },
    { addr:'江東区豊洲3-1-5', name:'プラウドタワー豊洲', rent:92000, floor:'12F', rooms:'1K' },
    { addr:'世田谷区三軒茶屋1-8', name:'コート三軒茶屋', rent:112000, floor:'2F', rooms:'1LDK' },
    { addr:'目黒区中目黒2-15', name:'リバーサイド中目黒', rent:145000, floor:'4F', rooms:'1LDK' },
  ],
  売買: [
    { addr:'港区赤坂7-3-1', name:'パークコート赤坂', price:85000000, rooms:'3LDK', year:2018 },
    { addr:'千代田区麹町5-2', name:'麹町プレミアムレジデンス', price:120000000, rooms:'4LDK', year:2020 },
    { addr:'郊外 川崎市中原区', name:'グランドヒル武蔵小杉', price:45000000, rooms:'4LDK', year:2015 },
  ],
  光通信: [
    { provider:'NTTフレッツ光', speed:'10Gbps', monthly:5500, area:'東京都' },
    { provider:'au光', speed:'1Gbps', monthly:4400, area:'東京都' },
    { provider:'ソフトバンク光', speed:'1Gbps', monthly:5720, area:'東京都' },
  ],
  人材: [
    { job:'ITエンジニア（Java）', company:'IT系スタートアップ', salary:600, area:'東京' },
    { job:'営業マネージャー', company:'外資系メーカー', salary:800, area:'東京' },
    { job:'経理・財務', company:'上場企業', salary:500, area:'東京' },
    { job:'看護師', company:'総合病院', salary:420, area:'東京' },
  ],
};

const FLOW_VARIANTS = {
  simple:   { steps: ['inquiry','matching','contract','payment'], probability: 0.5 },
  with_viewing: { steps: ['inquiry','matching','showing','contract','payment'], probability: 0.25 },
  with_itsetsu: { steps: ['inquiry','matching','showing','itsetsu','contract','payment'], probability: 0.15 },
  complex:  { steps: ['inquiry','matching','showing','screening','itsetsu','contract','payment','instant_pay'], probability: 0.08 },
  cancel:   { steps: ['inquiry','matching','showing','cancel'], probability: 0.02 },
};

const ISSUES = {
  none:           { probability: 0.6 },
  slow_client:    { probability: 0.1, delay: 3000 },
  wrong_doc:      { probability: 0.1 },
  budget_over:    { probability: 0.08 },
  duplicate:      { probability: 0.05 },
  insufficient_balance: { probability: 0.04 },
  overdue_payment: { probability: 0.03 },
};

// ────────────────────────────────────────────────────────────
// シナリオ生成
// ────────────────────────────────────────────────────────────

function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function weightedRandom(obj) {
  const r = Math.random();
  let cum = 0;
  for (const [key, val] of Object.entries(obj)) {
    cum += val.probability;
    if (r < cum) return key;
  }
  return Object.keys(obj)[0];
}

function generateScenario(index, difficulty = 'simple') {
  const client   = randomFrom(CLIENTS);
  const caseType = client.type;
  const propList = PROPERTIES[caseType] || PROPERTIES['賃貸'];
  const property = randomFrom(propList);
  const flowKey  = difficulty === 'simple'   ? weightedRandom({ simple: {probability:0.7}, with_viewing:{probability:0.3} })
                 : difficulty === 'medium'   ? weightedRandom({ with_viewing:{probability:0.4}, with_itsetsu:{probability:0.4}, complex:{probability:0.2} })
                 : difficulty === 'hard'     ? weightedRandom({ complex:{probability:0.6}, cancel:{probability:0.2}, with_itsetsu:{probability:0.2} })
                 : weightedRandom(FLOW_VARIANTS);

  const issueKey  = weightedRandom(ISSUES);
  const agRole    = caseType === '人材' ? 'hr_ag' : caseType === '光通信' ? 'hikari_ag' : 're_ag';
  const hasPT     = Math.random() < 0.25; // 25%の確率でPT経由

  const fee = caseType === '賃貸' ? (property.rent || 100000)
            : caseType === '売買' ? Math.round((property.price || 5000000) * 0.03)
            : caseType === '人材' ? Math.round((property.salary || 500) * 10000 * 0.25)
            : (property.monthly || 5000) * 12 * 0.1;

  return {
    id:         `SC-${String(index).padStart(4,'0')}`,
    difficulty,
    caseType,
    agRole,
    hasPT,
    flow:       FLOW_VARIANTS[flowKey]?.steps || ['inquiry','contract','payment'],
    issue:      issueKey,
    client: {
      name:     client.name,
      age:      client.age,
      job:      client.job,
      income:   client.income,
      needs:    client.needs,
    },
    property,
    fee,
    expectedDuration: FLOW_VARIANTS[flowKey]?.steps.length * 2000 || 6000,
    tags: [caseType, difficulty, issueKey !== 'none' ? 'has_issue' : 'clean', hasPT ? 'via_pt' : 'direct'],
  };
}

function generateScenarioBatch(total = 100) {
  const scenarios = [];
  const dist = {
    simple: Math.floor(total * 0.50),
    medium: Math.floor(total * 0.30),
    hard:   Math.floor(total * 0.15),
    edge:   Math.ceil(total  * 0.05),
  };

  let idx = 1;
  for (const [diff, count] of Object.entries(dist)) {
    for (let i = 0; i < count; i++) {
      scenarios.push(generateScenario(idx++, diff));
    }
  }

  // シャッフル
  for (let i = scenarios.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [scenarios[i], scenarios[j]] = [scenarios[j], scenarios[i]];
  }

  return scenarios;
}

module.exports = { generateScenario, generateScenarioBatch, CLIENTS, PROPERTIES, FLOW_VARIANTS };
