# CORETO 実装ロードマップ

> ステータス: 確定  
> 最終更新: 2026-03-06  
> 確認者: Tim

---

## 現状（2026年3月時点）

**現在のシステムはデモ・モックアップ版**。以下の制約がある。

| 制約 | 内容 |
|---|---|
| データ | 全ページにハードコード（山田誠・佐藤美咲等のデモユーザー） |
| 永続化 | sessionStorage / localStorage のみ。ブラウザを閉じると消える |
| 外部連携 | Slack・Zapier・Stripe・Kyash は `ENABLED: false` で未接続 |
| 認証 | クライアントサイドのSHA-256ハッシュのみ。サーバーサイド認証なし |
| Kintone | 未契約・未構築 |

**フェーズ1〜3の外部サービス申請・契約はすべて未着手。** 登記完了（2026年3月末）以降から着手可能。

---

## タイムライン（Tim確認済み）

```
2026年3月31日  法人登記完了
      ↓
2026年4月1日〜  宅建業者登録申請
              エージェント募集開始
              ← この時点でエージェント入会・審査フローが稼働必須
      ↓
      （申請から約2ヶ月）
      ↓
2026年5月11日  ✅ システム全機能完成期限（免許取得3週間前）
              ← 慣熟訓練開始のためシステムが完成している必要あり
      ↓
      （慣熟訓練 約3週間）
      ↓
2026年6月1日   宅建業免許取得・業務開始
```

**今日（2026-03-06）からシステム完成期限（5/11）まで：約9週間**

---

## マイルストーン詳細

### 🔴 2026年4月1日（募集開始時点）に必須の機能

エージェントが申込→審査→面接→入会→研修という流れが動くこと。

| 機能 | ページ | 現状 | 必要な対応 |
|---|---|---|---|
| エージェント入会申込フォーム | coreto-agent-signup.html | デモ動作 | Zapier Webhook接続・メール通知 |
| 書類審査 | coreto-screening.html | デモ動作 | Kintone連携・実データ保存 |
| KYC・本人確認 | coreto-kyc.html | デモ動作 | eKYC APIまたは手動確認フロー |
| Slack通知（申込受付） | db.js SLACK_CONFIG | `ENABLED: false` | Webhook URL設定・有効化 |
| Kintone エージェント台帳 | — | 未構築 | Kintone契約・アプリ構築 |
| オンボーディング研修コンテンツ | coreto-onboarding.html | 枠のみ（コンテンツ未実装） | Tim確認後にClaude実装 |

### 🟡 2026年4月中旬〜（審査があるため早めに申請）

| 手続き | 審査期間 | 期限 |
|---|---|---|
| GMOあおぞらネット銀行 法人口座開設 | 約2週間 | 4月中旬までに申込 |
| Kyash法人送金 オンライン申込 | 約2週間 | 4月中旬までに申込 |
| **GMO BaaS API 申請（最優先）** | **約2ヶ月** | **4月1日に即申請** |
| Stripe 月会費サブスク設定 | 即時 | 4月末まで |

> ⚠️ GMO BaaS APIは審査に2ヶ月かかる。4月1日に申請しても免許取得（6月）ギリギリのため、登記完了翌日に即申請すること。

### ✅ 2026年5月11日（システム完成期限）までに完了すべき全機能

| カテゴリ | 機能 | 現状 |
|---|---|---|
| **認証** | サーバーサイド認証（またはKintone API認証） | クライアントサイドのみ |
| **データ** | db.js のKintone切替（USE_KINTONE = true） | localStorage |
| **案件管理** | Kintone 案件管理・IT重説予約アプリ構築 | 未構築 |
| **入金** | GMO BaaS API webhook → Kintone入金フラグ更新 | 未実装 |
| **報酬支払い** | Kyash API自動送金フロー | 未実装 |
| **研修** | onboarding.html 研修コンテンツ本文 | 枠のみ |
| **PT** | 紹介コードのセッション動的化 | ハードコード |
| **SP対応** | partner-signup.html / partner-feed.html | MQなし |

---

## フロントエンド（デモ→本番化）の切替方針

### `db.js` 1ファイルの切替で全画面が本番になる設計

```javascript
// ── 現在（localStorage）──
getCases() {
  return JSON.parse(localStorage.getItem('coreto_cases') || '[]');
},

// ── 切替後（Kintone）── USE_KINTONE = true にするだけ
async getCases() {
  const res = await fetch(
    `https://${DB_CONFIG.KINTONE_DOMAIN}/k/v1/records.json?app=${DB_CONFIG.KINTONE_APPS.cases}`,
    { headers: { 'X-Cybozu-API-Token': KINTONE_API_TOKEN } }
  );
  const data = await res.json();
  return data.records.map(r => ({ /* フィールドマッピング */ }));
},
```

### 現在デモデータがハードコードされている主要箇所

| 場所 | 内容 | 本番化方法 |
|---|---|---|
| 各ページ `const ME = {...}` | ログインユーザー情報 | `_SESSION` から取得（一部修正済み） |
| 各ページ `const CASES = [...]` | 案件一覧 | `db.getCases()` に置換 |
| 各ページ `const AGENTS = [...]` | エージェント一覧 | `db.getAgents()` に置換 |
| hub.html `PT-SATO2026` | PTの紹介コード | `_SESSION.userId` から生成 |
| hub.html 各ページの数値 | KPI・報酬額 | APIから取得 |

---

## 決定済み事項（変更不可）

| 事項 | 内容 | 決定日 |
|---|---|---|
| PTポータルはhub.html一本化 | coreto-partner.html は廃止 | 2026-03-06 |
| coreto-partner.html 廃止 | hub一本化に伴い完全廃止 | 2026-03-06 |
| 報酬支払いはKyash（〜99万円）+ GMO（100万円〜） | payment-infrastructure.md 参照 | 2026-02-28 |
| 月会費はStripeで自動引き落とし | Bronze:¥980/月、Silver:¥490/月、Gold以上:無料 | 2026-02-28 |
| デモ版のまま募集は開始しない | 4月1日時点でKintone連携済みの本番システムが必要 | 2026-03-06 |

---

## 今後のClaudeへの作業優先順位

### 登記完了（3月末）前にClaudeが着手できること

1. **PTの残課題**（フロントエンドのみで完結するもの）
   - 紹介コードのセッション動的化（A）
   - SP対応（B/C）
   - commission-simulator PTタブ非表示（F）
   - 案件詳細モーダル（G）
   - coreto-partner.html 廃止（関連リンクのクリーンアップ）

2. **onboarding.html 研修コンテンツ**
   - Timから研修内容・ルール本文を受け取り次第実装

3. **フロントエンドのハードコード解消**
   - 全ページの `const AGENTS = [...]` / `const CASES = [...]` を `db.get*()` 呼び出しに統一

### 登記完了（4月〜）以降にTimが手続きすること

1. Kintone スタンダード契約・アプリ構築
2. GMO BaaS API 申請（即日）
3. Kyash法人送金 申込
4. GMOあおぞらネット銀行 口座開設
5. Zapier Starter 契約・Webhook設定
6. Stripe 月会費サブスク設定

### Timの手続き完了後にClaudeが実装すること

1. db.js Kintone連携実装（USE_KINTONE = true）
2. Zapier Webhook URL の設定・有効化
3. 本番認証フロー（Kintone API認証）
4. GMO BaaS webhook → 入金フラグ自動更新
5. Kyash API自動送金フロー
