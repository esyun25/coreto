# COREBLDG v2 — 外部連携 実装TODO

作成日: 2026年3月
対象バージョン: COREBLDG v2（esyun25.github.io/coreto/v2/）

---

## 1. Kintone 連携

### 1-1. 前提設定（共通）
- [ ] Kintone ドメイン・APIトークンを取得
- [ ] `coreto-slack-config-v2.js` と同様に `coreto-kintone-config-v2.js` を作成
  - `window.KINTONE.get(appId, query)` / `window.KINTONE.post(appId, record)` などの共通関数
  - `CORETO_KINTONE_CONFIG`（localStorage）でURL・APIトークンを管理
  - `admin-rbac-v2.html` に「Kintone設定」タブを追加（Slack設定タブと同様）

### 1-2. ページ別 変更箇所

#### hub-v2.html（HQダッシュボード）
- HQメンバー一覧（`HQ_MEMBERS_LIST`）を `localStorage` → Kintone APIに変更
  - コメント: `// HQメンバー一覧（実運用ではKintoneから取得）`
- USER_CREDENTIALS の HQ アカウント情報をKintone照合に変更

#### user-mgmt-v2.html（ユーザー・権限管理）
- `HQ_USERS_RAW` をKintone「HQユーザーマスター」アプリから取得
  - コメント: `// 実運用ではKintoneのマスターデータから取得`
- AGユーザー一覧・PTユーザー一覧もKintoneから取得

#### payroll-v2.html（月次報酬確定）
- `PAYOUTS`（振込対象者データ）をKintone「成約報告」アプリから動的生成
  - `buildPayoutsFromLS()` → `buildPayoutsFromKintone()` に置き換え

#### agent-retention-v2.html（AG離脱リスク管理）
- `AG_DATA` をKintone「AGマスター」＋「案件」アプリから取得
  - コメント: `// AGデモデータ（実運用: Kintone APIから取得）`
- `// UIへの反映はKintone連携後` 箇所（行476）: AIスコア算出後にKintoneに書き戻す

#### rank-dashboard-v2.html（AGランクダッシュボード）
- `ALL_AGs` をKintone「AGマスター」アプリから取得
  - コメント: `// データ定義（本番: Kintoneから取得）`

#### kyc-v2.html（KYC審査）
- 審査対象AGデータをKintone「KYC申請」アプリから取得
  - コメント: `// 実運用: Kintone APIから取得 / デモ: セッションまたは固定値`

#### applicants-v2.html（応募者管理）
- `APPLICANTS`（応募者リスト）をKintone「AG応募」アプリと双方向同期
  - localStorageへの書き込みをKintone POST に変更
  - statusの更新もKintoneに反映

#### pipeline-v2.html（案件パイプライン）
- `CASES` をKintone「不動産案件」アプリから取得

#### id-manager-v2.html（ID管理台帳）
- 発行済みID一覧をKintone「IDマスター」アプリから取得・書き込み
  - コメント: `// 発行済みID管理（本番ではKintoneから取得）`

#### batch-close-v2.html（月次締め）
- 振込対象データをKintone「成約報告」アプリから取得
  - コメント: `// 対象月ごとのデータ（実運用: Kintone APIから取得）`

#### training-mgmt-v2.html（研修コンテンツ管理）
- `CONTENTS`の`completedRate`をKintone「研修完了」アプリから動的更新
  - コメント: `// CONTENTS自体のcompletedRateはKintone連携後に更新`

#### barcode-scan-v2.html（書類スキャン管理）
- バーコードスキャン後の案件照合をKintone「案件」アプリとの突合に変更
  - コメント: `// デモ: コードに対応する案件を特定（実際はKintone照合）`

#### account-v2.html（アカウント設定）
- パスワード変更をKintone「HQユーザー」アプリに反映
  - コメント: `// localStorageにパスワード変更を保存（Kintone連携後はAPIで更新）`

### 1-3. localStorageキーのKintone移行一覧

| localStorageキー | 現状 | Kintone移行後 |
|---|---|---|
| `CORETO_REPORTS` | 成約報告をローカル保存 | Kintone「成約報告」アプリへPOST |
| `CORETO_APPLICANTS` | 応募者をローカル保存 | Kintone「AG応募」アプリと同期 |
| `CORETO_HQ_TASKS` | HQタスクをローカル管理 | Kintone「HQタスク」アプリと同期 |
| `CORETO_CLIENTS` | クライアントをローカル保存 | Kintone「クライアント」アプリと同期 |
| `CORETO_TRAINING_COMPLETE` | 研修完了をローカル保存 | Kintone「研修完了」アプリへPOST |
| `CORETO_HQ_ACCOUNTS` | HQアカウントをローカル保存 | Kintone「HQユーザー」アプリと同期 |
| `CORETO_SPECIAL_CODES` | 特別コードをローカル保存 | Kintone「特別コード」アプリと同期 |
| `CORETO_IT_CHECKLIST_*` | IT重説チェックリストをローカル保存 | Kintone「IT重説」アプリへPOST |
| `CORETO_SCAN_*` | 書類スキャン状態をローカル保存 | Kintone「書類管理」アプリへPOST |

---

## 2. SMS API 連携（Twilio 推奨）

### 2-1. 前提設定（共通）
- [ ] Twilioアカウント作成・Account SID・Auth Token・送信元電話番号を取得
- [ ] サーバーサイドのSMS送信エンドポイントを用意（Twilio SDKを使用）
  - 推奨: Firebase Functions / Vercel / Netlify Functions
  - エンドポイント例: `POST /api/sms/send` → `{ to, message }` を受け取りTwilio経由で送信
- [ ] CORS設定（COREBLDGのドメインからのリクエストを許可）

### 2-2. ページ別 変更箇所

#### agent-signup-v2.html（AG入会申込）
- **STEP3 SMS認証**のOTPコード送信をTwilio経由に変更
  - 変更箇所: `_otpCode = String(Math.floor(...))` のデモコード生成部分
  - 変更後: `/api/sms/send` にPOSTしてTwilioでSMS送信
  - コード: `// DEMO TOKENS (本番はKintone/DB照合)`
  - デモコード表示 `showToast('デモコード: ' + _otpCode)` を削除
  - 再送ボタン `showToast('📱 再送しました（デモ）')` を実SMS再送に変更

#### partner-signup-v2.html（PT入会申込）
- agent-signup-v2と同様（STEP2 SMS認証）
  - `showToast('📲 コードを再送しました（デモ）')` を実SMS再送に変更

#### id-manager-v2.html（ID管理台帳）
- 招待コードのSMS送付を実装
  - `showToast('📱 ${app.phone} にSMSを送信しました（デモ）')` を実SMS送信に変更

#### instant-pay-v2.html（即時払い審査）
- OTP認証をSMS経由に変更
  - 現状: OTPコードをコンソール出力のみ
  - 変更後: 登録電話番号にTwilio経由でSMS送信

#### account-v2.html（アカウント設定）
- 電話番号変更・二要素認証のOTP送信をSMS経由に変更
  - コメント: `// デモ: 本番ではメール/SMS送信後に認証コード確認フローへ`

### 2-3. SMS送信の共通関数（実装イメージ）

```javascript
// coreto-sms-v2.js として作成
async function sendSMS(phone, message) {
  const cfg = JSON.parse(localStorage.getItem('CORETO_SMS_CONFIG') || '{}');
  if (!cfg.ENABLED || !cfg.ENDPOINT) {
    console.log('[SMS デモ]', phone, message);
    return { demo: true };
  }
  const res = await fetch(cfg.ENDPOINT + '/api/sms/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': cfg.API_KEY || '' },
    body: JSON.stringify({ to: phone, message }),
  });
  return res.json();
}
```

---

## 3. その他外部API連携（優先度低）

### 3-1. クラウドサイン（電子契約書送付）
- **onboarding-v2.html** の `sendContractHQ()` 関数
  - 現状: LINE通知＋localStorageに送付記録を保存
  - 本番: クラウドサインAPIで契約書送付 → 署名完了Webhookを受け取り
  - 変更箇所: `coreto-onboarding-v2.html` の `sendContractHQ` 関数 + `CORETO_CONTRACT_SEND`

### 3-2. SendGrid / AWS SES（メール送信）
- **applicants-v2.html** の入会案内メール送信
  - 現状: LINE通知に変更済み（LINE未設定時はログのみ）
  - 本番: SendGrid / SESのAPIで実メール送信
  - 変更箇所: `applicants-v2.html` の送信処理（`// デモ環境のため実際のメール送信は行いません`）

### 3-3. GMO（銀行振込）
- **payroll-v2.html** の `exportCSV()` で出力したCSVをGMO振込APIに直接POST
  - 現状: CSVダウンロードのみ
  - 本番: GMO全銀API連携でCSVを直接アップロード

---

## 4. admin-rbac-v2 設定画面 追加項目

現在の設定タブ: Slack設定のみ
追加が必要なタブ:
- [ ] **Kintone設定**（ドメイン・アプリID・APIトークン）
- [ ] **SMS設定**（送信APIエンドポイント・APIキー）
- [ ] **クラウドサイン設定**（APIキー・テンプレートURL）
- [ ] **LINE設定** → line-auth-v2.html に実装済み ✅
- [ ] **Slack設定** → admin-rbac-v2.html に実装済み ✅

---

## 5. 移行手順（推奨順序）

```
STEP 1: Kintone契約・アプリ設計
  → AGマスター / 案件 / 成約報告 / KYC / ID管理 アプリを作成

STEP 2: coreto-kintone-config-v2.js 作成
  → 共通APIラッパー + admin-rbac-v2に設定タブ追加

STEP 3: CORETO_REPORTSのKintone同期
  → contract-report-v2でPOST → payroll-v2でGET に変更
  → 最重要フローのため最初に移行

STEP 4: AGマスター・ユーザーのKintone化
  → user-mgmt / hub / rank-dashboardのデータをKintoneから取得

STEP 5: SMS API連携
  → Twilio設定 + サーバーエンドポイント作成
  → agent-signup / partner-signup のOTP送信を実装

STEP 6: 残りのページを順次移行
```

---

*最終更新: 2026年3月 / COREBLDG v2 開発セッション*
