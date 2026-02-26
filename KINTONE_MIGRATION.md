# CORETO × Kintone 本番移行設計書
**作成日**: 2026年2月26日  
**対象フェーズ**: 4ヶ月後（宅建事業開始時）までに完了

---

## 契約すべきサービス一覧

| サービス | プラン | 月額 | 契約先 | 優先度 |
|---------|--------|------|--------|--------|
| **Kintone スタンダード** | HQユーザー数（想定10名） | 約¥15,000 | cybozu.com | 🔴 最優先 |
| **Form Bridge** | エージェント入力フォーム | 約¥6,600 | toyokumo.com | 🔴 最優先 |
| **kViewer** | マイページ・紹介コード | 約¥4,400 | toyokumo.com | 🟠 2ヶ月以内 |
| **Print Creator** | 支払通知書PDF | 約¥3,300 | toyokumo.com | 🟡 4ヶ月以内 |
| **Zapier Starter** | 自動化ハブ | 約¥3,000 | zapier.com | 🟠 2ヶ月以内 |
| **GMO BaaS API** | 入金webhook | **無料** | gmo-aozora.com | 🟡 申請に2ヶ月 |

---

## Kintone アプリ設計

### アプリ1: エージェント台帳（AGENTS）
*2ヶ月後のエージェント登録フェーズから必要*

| フィールド名 | フィールドタイプ | 備考 |
|------------|---------------|------|
| エージェントID | 文字列 | 10001〜 (RE), 20001〜 (HR) |
| 氏名 | 文字列 | |
| 氏名カナ | 文字列 | |
| 電話番号 | 電話番号 | |
| メールアドレス | メールアドレス | |
| エージェント種別 | ドロップダウン | RE / HR |
| ランク | ドロップダウン | Bronze/Silver/Gold/Platinum |
| 専任宅建士 | チェックボックス | |
| 宅建士登録番号 | 文字列 | |
| KYC状態 | ドロップダウン | 未提出/審査中/承認/否認 |
| 紹介コード | 文字列 | 紹介者のエージェントID |
| 口座情報（銀行名） | 文字列 | |
| 口座情報（支店名） | 文字列 | |
| 口座情報（口座番号） | 文字列 | |
| 口座情報（口座名義） | 文字列 | |
| Stripe顧客ID | 文字列 | 月会費決済用 |
| 入会日 | 日付 | |
| 状態 | ドロップダウン | 申込中/KYC審査中/稼働中/休止/退会 |
| パスワードハッシュ | 文字列 | ※Kintone移行時に実装 |

### アプリ2: 案件管理（CASES）
*4ヶ月後の宅建事業開始時から必要*

| フィールド名 | フィールドタイプ | 備考 |
|------------|---------------|------|
| 案件ID | 文字列 | pipeline.html の c.id |
| 担当エージェントID | 文字列 | |
| クライアント名 | 文字列 | |
| 物件名 | 文字列 | |
| ステータス | ドロップダウン | inquiry/matching/... |
| 報酬種別 | ドロップダウン | RE/三為/HR |
| 報酬金額 | 数値 | |
| 入金確認済み | チェックボックス | |
| 振込日 | 日付 | |
| 入金確認者 | 文字列 | |
| 備考 | 文字列（複数行） | |
| 作成日 | 日付 | |
| 更新日時 | 日時 | |

### アプリ3: IT重説予約（BOOKINGS）
*4ヶ月後の宅建事業開始時から必要*

| フィールド名 | フィールドタイプ |
|------------|---------------|
| 予約ID | 文字列 |
| 案件ID | 文字列 |
| クライアント名 | 文字列 |
| クライアント電話 | 電話番号 |
| 希望日時 | 日時 |
| 確定日時 | 日時 |
| ステータス | ドロップダウン |
| 担当エージェントID | 文字列 |

---

## CORETO ↔ Kintone 接続方式

### 2ヶ月後（エージェント登録フェーズ）
```
エージェント申込（agent-signup.html）
    ↓ Zapier Webhook（ZAPIER_CONFIG.SIGNUP に設定）
    ↓ Zapier
    ↓ Kintone REST API（エージェント台帳アプリに新規レコード作成）
    ↓ Slack #エージェント登録通知（Zapier経由）
```

### 4ヶ月後（宅建事業開始）
```
1. db.js の USE_KINTONE = true に変更
2. getCases() / saveCase() を Kintone API に書き換え
3. GMO BaaS webhook → Zapier → Kintone（入金フラグ自動更新）
```

---

## db.js 切り替え手順（4ヶ月後）

`db.js` の以下の部分を書き換えるだけで全画面が本番になります：

```javascript
// ── 変更前（localStorage）──
getCases() {
  return JSON.parse(localStorage.getItem('coreto_cases') || '[]');
},

// ── 変更後（Kintone）──
async getCases() {
  const res = await fetch(
    `https://${DB_CONFIG.KINTONE_DOMAIN}/k/v1/records.json?app=${DB_CONFIG.KINTONE_APPS.cases}`,
    { headers: { 'X-Cybozu-API-Token': KINTONE_API_TOKEN } }
  );
  const data = await res.json();
  return data.records.map(r => ({
    id:         r.案件ID.value,
    agentId:    r.担当エージェントID.value,
    clientName: r.クライアント名.value,
    // ... フィールドマッピング
  }));
},
```

---

## 今すぐ着手できること（Kintone契約前）

1. **Zapier アカウント作成**（無料プランで開始可能）
   - エージェント申込 Webhook を設定
   - 申込データをGoogleスプレッドシートに自動記録（Kintone契約前の暫定）

2. **GMO BaaS API 申請**（審査に2ヶ月かかる）
   - 今すぐ申請を開始することで4ヶ月後に間に合う
   - URL: https://gmo-aozora.com/business/baas/

3. **Kintoneトライアル申請**（30日無料）
   - アプリ設計をこの設計書をもとに構築・テスト
   - URL: https://kintone.cybozu.co.jp/trial/

4. **Form Bridge評価**
   - エージェント登録フォームをKintone連携でテスト

---

*このドキュメントは CORETO System Audit 2026.02.26 に基づき作成*
