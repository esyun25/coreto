# COREBLDG v2 — 本番移行チェックリスト
**作成日**: 2026年3月15日  
**対象**: Kintone連携・SMS API連携・その他外部サービス接続時の作業一覧

---

## 凡例
- 🔴 **必須** — これをしないと機能が動かない
- 🟡 **推奨** — しなくてもデモ動作するが本番品質に必要
- 🟢 **任意** — 将来的な拡張・改善

---

## 1. SMS / OTP 認証（Twilio または類似サービス）

### 対象ページ
| ページ | 該当箇所 | 優先度 |
|---|---|---|
| `coreto-agent-signup-v2.html` | Step3 SMS認証（OTPコード生成・再送） | 🔴 必須 |
| `coreto-partner-signup-v2.html` | Step3 SMS認証（OTPコード生成・再送） | 🔴 必須 |
| `coreto-account-v2.html` | 電話番号変更時のOTP認証 | 🟡 推奨 |
| `coreto-id-manager-v2.html` | 招待コードのSMS送付 | 🟡 推奨 |

### 作業内容

#### agent-signup-v2 / partner-signup-v2
```javascript
// 現状: クライアント側でランダム6桁を生成し画面に表示（デモ）
_otpCode = String(Math.floor(100000 + Math.random() * 900000));
showToast(`📱 再送しました\nデモコード: ${_otpCode}`);

// 本番: バックエンドAPIでSMS送信
// 1. Twilio / AWS SNS / NTTドコモ SMS API等でサーバーサイドOTP生成・送信
// 2. フロントからAPIを叩き、セッションID/OTPハッシュを受け取る
// 3. 検証時にサーバーサイドで照合（フロントにOTPを渡さない）
// 対象関数: sendOtp(), resendOtp(), verifyOtp()
```

**変更箇所**:
- `coreto-agent-signup-v2.html` L765〜L850 — `sendOtp()`, `resendOtp()`, `verifyOtp()` 関数
- `coreto-partner-signup-v2.html` — 同様の関数群
- `coreto-account-v2.html` L800〜 — `_otpCode`, `requestOtp()`, `verifyOtp()`

**削除するUI**:
```html
<!-- デモ用OTPコード表示（本番では削除）-->
<div id="otp-demo" style="...">【デモ用コード: XXXXXX】</div>
```

---

## 2. Kintone REST API 連携

### 対象機能マッピング

| Kintoneアプリ | 対応V2ページ | 現状 | 優先度 |
|---|---|---|---|
| 案件管理（賃貸） | `coreto-rental-v2.html`, `coreto-cases-v2.html` | localStorage | 🔴 |
| 案件管理（売買） | `coreto-sale-report-v2.html` | localStorage | 🔴 |
| 人材案件 | `coreto-hr-matching-v2.html` | localStorage | 🔴 |
| 成約報告 | `coreto-contract-report-v2.html` | CORETO_REPORTS (localStorage) | 🔴 |
| 申込者管理 | `coreto-applicants-v2.html`, `coreto-id-manager-v2.html` | DEMO_APPS (ハードコード) | 🔴 |
| KYC書類 | `coreto-kyc-v2.html` | localStorage | 🔴 |
| ユーザーマスタ（AG/PT） | `coreto-user-mgmt-v2.html` | HQ_USERS_RAW (ハードコード) | 🔴 |
| 宅建士マスタ | `coreto-takken-v2.html` | ハードコード | 🔴 |
| IT重説予約 | `coreto-itsetsu-v2.html`, `coreto-itsetsu-hq-v2.html` | CORETO_ITSETSU_BOOKINGS | 🟡 |
| 早期退職・返金 | `coreto-early-quit-v2.html` | ハードコード | 🟡 |
| 士業連携 | `coreto-judicial-v2.html` | ハードコード | 🟡 |
| 入金管理 | `coreto-remittance-v2.html` | ハードコード | 🟡 |
| 光通信SFA | `coreto-utility-v2.html` | ハードコード | 🟡 |
| 研修コンテンツ | `coreto-training-mgmt-v2.html` | ハードコード | 🟢 |

### 具体的な置換作業

#### 2-1. id-manager-v2 — `DEMO_APPS` をKintone「申込者」アプリに置換
```javascript
// 現状（L598〜）
const DEMO_APPS = [
  { id:'APP-0041', name:'田中 誠一', ... },
  ...
];

// 本番
async function loadAppsFromKintone() {
  const resp = await fetch('https://{subdomain}.cybozu.com/k/v1/records.json?app={APP_ID}', {
    headers: { 'X-Cybozu-API-Token': KINTONE_CONFIG.APPLICANT_APP_TOKEN }
  });
  const data = await resp.json();
  return data.records.map(r => ({
    id:     r['申込ID'].value,
    name:   r['氏名'].value,
    status: r['ステータス'].value,
    // ...
  }));
}
```
**対象関数**: `renderPending()`, `renderApproved()`, `issueId()`, `sendSms()`, `approveApp()`

#### 2-2. user-mgmt-v2 — `HQ_USERS_RAW` をKintone「ユーザーマスタ」アプリに置換
```javascript
// 現状（L338〜）
const HQ_USERS_RAW = [
  { id:'HQ-00001', name:'田中 誠一', email:'tanaka@coreto.jp', ... },
];

// 本番: KintoneのHQマスタアプリから取得
// acctSearch() もKintone検索APIに変更
```

#### 2-3. contract-report-v2 — CORETO_REPORTSをKintone「成約報告」アプリに同期
```javascript
// 現状: localStorage.setItem('CORETO_REPORTS', ...)
// 本番: 承認後にKintone成約報告アプリへPOST
// また既存のlocalStorageからKintoneへのマイグレーションが必要
```

#### 2-4. applicants-v2 — 書類審査チェック結果をKintoneに保存
```javascript
// 現状: localStorage.setItem('CORETO_SCREENING_RESULTS', ...)
// 本番: 審査完了後にKintone「申込者」アプリの「書類審査」フィールドを更新
```

#### 2-5. crm-v2 — CSVエクスポートをKintone検索連携に変更
```javascript
// 現状
function exportCSV() { showToast('Kintone連携後に有効になります', 'am'); }

// 本番: Kintone「クライアント」アプリからレコード取得→CSV変換
// または Kintoneの一括ダウンロードAPIを利用
```

#### 2-6. kyc-v2 — 書類ビューワーをKintone添付ファイルAPIに接続
```javascript
// 現状
function viewDoc(label) { showToast('Kintone連携後にビューワーで閲覧可能', 'sk'); }

// 本番: Kintone「KYC」アプリの添付ファイルフィールドからファイルキーを取得
// → GET /k/v1/file.json?fileKey={key} でファイル取得
```

#### 2-7. user-mgmt-v2 — 検索・一括ロール変更・CSVエクスポートを実装
```javascript
// 現状
function acctSearch(v) { /* フィルタ省略：本番Kintone連携 */ }
function bulkRoleChange() { toast('ロール変更機能（本番環境で実装）'); }
function exportCSV() { toast('CSVエクスポート（本番環境で実装）'); }

// 本番:
// acctSearch → Kintone検索APIで氏名/ID検索
// bulkRoleChange → 選択レコードを一括更新
// exportCSV → Kintoneレコード全件取得→CSV
```

#### 2-8. training-mgmt-v2 — 研修完了率をKintoneから動的取得
```javascript
// 現状: completedRate は各CONTENTオブジェクトにハードコード
// 本番: Kintone「研修管理」アプリから完了状況を取得
// CORETO_TRAINING_COMPLETE (localStorage) → Kintone「研修ログ」アプリに移行
```

---

## 3. CloudSign（電子契約）URL差し替え

### 対象ページ
| ページ | 対象 | 現状 |
|---|---|---|
| `coreto-onboarding-v2.html` | CONTRACTS配列の`cloudsignUrl` | `'https://www.cloudsign.jp/'`（仮） |
| `coreto-agent-signup-v2.html` | 契約書リンク（Step7） | `showToast('本番環境では正式なPDF文書URLが設定されます')` |
| `coreto-partner-signup-v2.html` | 契約書リンク（Step7） | 同上 |

### 作業内容
```javascript
// onboarding-v2.html の CONTRACTS配列を更新
var CONTRACTS = [
  {
    id: 'doc-ag',
    cloudsignUrl: 'https://app.cloudsign.jp/documents/XXXXXXXXXX',  // ← 実際のURL
    // ...
  },
  // ...
];

// agent-signup-v2.html のcontract-link-1, contract-link-2
document.getElementById('contract-link-1').href = 'https://app.cloudsign.jp/documents/XXXXXXXXXX';
document.getElementById('contract-link-2').href = 'https://app.cloudsign.jp/documents/YYYYYYYYYY';
```

---

## 4. メール送信（SendGrid / AWS SES）

### 対象ページ
| ページ | 現状 | 優先度 |
|---|---|---|
| `coreto-applicants-v2.html` | LINE通知に変更済み。メール送信は「本番ではSendGrid/AWS SESと連携」コメントのみ | 🟡 |

### 作業内容
```javascript
// 現状: LINE Broadcast で代替
// 本番: SendGrid または AWS SES APIで個別メールを送信
// applicants-v2.html の sendInviteMail() 関数内
// → fetch('https://api.sendgrid.com/v3/mail/send', { headers: { Authorization: 'Bearer ' + SENDGRID_KEY }, ... })
// 対象メール:
//   - 入会案内メール（applicants-v2の「📧 入会案内メールを送信する」）
//   - パスワードリセットメール（account-v2）
//   - 月次明細通知メール（payroll-v2）
```

---

## 5. Stripe 決済連携（月会費課金）

### 対象ページ
| ページ | 現状 | 優先度 |
|---|---|---|
| `coreto-agent-signup-v2.html` | Stripe Elementsのデモ表示 | 🟡 |
| `coreto-admin-rbac-v2.html` | Stripeサブスク管理パネル（デモ表示） | 🟡 |

### 作業内容
```javascript
// agent-signup-v2.html Step8「お支払い情報」
// 現状: Stripe Elementsのデモ表示のみ
// 本番:
//   1. Stripe Publishable Key を設定
//   2. stripe.elements() で実際のカードフォームを表示
//   3. stripe.confirmCardSetup() でSetupIntent完了
//   4. PaymentMethodをバックエンドに送信 → Subscriptionを作成

// ブロンズは月額¥980 / シルバーは¥490 / ゴールド・プラチナ・Founderは無料
// 月会費免除コード（特別紹介コード）の適用も考慮
```

---

## 6. LINE公式アカウント設定

### 対象ページ
| ページ | 現状 | 優先度 |
|---|---|---|
| `coreto-line-auth-v2.html` | LINE WORKS IDが`@coreto-works`（仮） | 🔴 |
| `coreto-hub-v2.html` | LINE再連携ボタン未実装 | 🔴 |

### 作業内容
1. **LINE公式アカウント①（AGへの通知用）** の Channel Access Token を  
   `line-auth-v2.html` → 「🔧 LINE通知 API設定」 → AG_CHANNEL_TOKEN に設定
2. **LINE Messaging APIのWebhook URL** を設定（LINEからのメッセージ受信用）
3. `coreto-line-auth-v2.html` の LINE WORKS ID (`@coreto-works`) を正式アカウントIDに変更
4. `coreto-hub-v2.html` の LINE再連携ボタン（`showToast('LINE開設後に有効')` → 実連携処理）を実装

---

## 7. Kintone API 設定ファイルの作成

Slack設定（`coreto-slack-config-v2.js`）と同様に、**Kintone設定ファイル** の作成が必要です。

```javascript
// coreto-kintone-config-v2.js（作成が必要）
window.KINTONE_CONFIG = {
  SUBDOMAIN: 'your-subdomain',
  // 各アプリのAPIトークン（読み取り専用）
  APPLICANT_APP_TOKEN:   'YOUR_TOKEN',
  CASE_RE_APP_TOKEN:     'YOUR_TOKEN',
  CASE_HR_APP_TOKEN:     'YOUR_TOKEN',
  CONTRACT_APP_TOKEN:    'YOUR_TOKEN',
  KYC_APP_TOKEN:         'YOUR_TOKEN',
  USER_MASTER_TOKEN:     'YOUR_TOKEN',
  TAKKEN_MASTER_TOKEN:   'YOUR_TOKEN',
  TRAINING_LOG_TOKEN:    'YOUR_TOKEN',
  // 各アプリのID
  APPLICANT_APP_ID:   1,
  CASE_RE_APP_ID:     2,
  // ...
  ENABLED: false,  // trueにした時点からKintone APIを使用
};
```

`admin-rbac-v2.html` または専用の「システム設定」ページでUIから設定・保存できるようにする。

---

## 8. Google Drive 連携（書類保存）

### 対象ページ
| ページ | 現状 | 優先度 |
|---|---|---|
| `coreto-barcode-scan-v2.html` | 「本番ではGoogle Driveに保存」コメント | 🟢 |
| `coreto-kyc-v2.html` | 書類アップロード → base64でlocalStorageに仮保存 | 🟡 |

### 作業内容
```
- Google Drive API / Service Account の設定
- KYCアップロード → Google Drive の「KYC書類」フォルダに自動保存
- barcode-scan でスキャンしたPDF → 「書類スキャン」フォルダに保存
- Kintoneの添付ファイルフィールドにリンクを登録
```

---

## 9. localStorage → Kintone のデータマイグレーション手順

本番切替時に既存のlocalStorageデータをKintoneに移行する必要があります。

### 対象キーと移行先

| localStorageキー | 移行先Kintoneアプリ |
|---|---|
| `CORETO_REPORTS` | 成約報告アプリ |
| `CORETO_APPLICANTS` | 申込者管理アプリ |
| `CORETO_SCREENING_RESULTS` | 申込者管理アプリ（書類審査フィールド） |
| `CORETO_ITSETSU_BOOKINGS` | IT重説予約アプリ |
| `CORETO_CLIENTS` | クライアント管理アプリ |
| `CORETO_HQ_ACCOUNTS` | HQユーザーマスタ |
| `CORETO_TRAINING_COMPLETE` | 研修ログアプリ |
| `CORETO_SPECIAL_CODES` | 特別紹介コードアプリ |
| `CORETO_IT_CHECKLIST_{bkId}` | IT重説チェックシートアプリ |
| `CORETO_SCAN_{caseId}` | 書類スキャン管理アプリ |

### マイグレーションスクリプトの作成が必要
```javascript
// migration-to-kintone.js（別途作成）
// 1. localStorageから各キーを読み込み
// 2. Kintone REST APIでレコードをPOST
// 3. 成功したキーはlocalStorageから削除（または移行済みフラグを立てる）
```

---

## 10. 環境変数 / シークレット管理

本番移行時にハードコードを避けるべき値の一覧です。

| 変数名 | 用途 | 設定場所 |
|---|---|---|
| `KINTONE_SUBDOMAIN` | KintoneのサブドメインURL | coreto-kintone-config-v2.js |
| `KINTONE_API_TOKEN_*` | 各KintoneアプリのAPIトークン | coreto-kintone-config-v2.js |
| `SLACK_WEBHOOK_*` | Slack Incoming Webhook URL（10チャンネル） | admin-rbac-v2 の「Slack設定」タブ |
| `LINE_AG_CHANNEL_TOKEN` | LINE Messaging API トークン（AG通知） | line-auth-v2 の「LINE通知 API設定」 |
| `CLOUDSIGN_DOC_URL_*` | CloudSign 各契約書のURL | onboarding-v2の CONTRACTS配列 |
| `TWILIO_ACCOUNT_SID` | Twilio SMS送信用 | バックエンドAPI（フロントに置かない） |
| `TWILIO_AUTH_TOKEN` | Twilio認証 | バックエンドAPI（フロントに置かない） |
| `SENDGRID_API_KEY` | SendGrid メール送信 | バックエンドAPI（フロントに置かない） |
| `STRIPE_PUBLISHABLE_KEY` | Stripe Elements 表示用 | agent-signup-v2（公開鍵のみ） |
| `STRIPE_SECRET_KEY` | Stripe サブスク管理 | バックエンドAPI（フロントに置かない） |

> ⚠️ **セキュリティ注意**: `TWILIO_AUTH_TOKEN`, `SENDGRID_API_KEY`, `STRIPE_SECRET_KEY` は  
> **フロントエンド（HTMLファイル）には絶対に置かないこと**。  
> バックエンドAPIサーバー（または Cloudflare Workers / Vercel Functions 等）経由で使用すること。

---

## 11. 本番切替チェックリスト（最終確認）

```
□ Kintone API トークンを全アプリ分発行・設定
□ coreto-kintone-config-v2.js を作成・デプロイ
□ Slack Webhook URL を10チャンネル分設定（admin-rbac-v2）→ テスト送信確認
□ LINE Channel Access Token を設定（line-auth-v2）→ テスト送信確認
□ CloudSign 各契約書のURLを差し替え（onboarding-v2 / agent-signup-v2）
□ SMS API（Twilio等）のバックエンドAPIエンドポイントを用意・接続
□ メール送信API（SendGrid/AWS SES）のバックエンドAPIを用意・接続
□ Stripe Publishable Key を設定・Subscriptionプランを作成
□ LINE公式アカウント（AG通知用①・HQ用②）を開設
□ LINE WORKS ID を正式アカウントIDに変更（line-auth-v2）
□ localStorageデータをKintoneへマイグレーション
□ 全ページのデモデータ定数（DEMO_APPS等）をKintone API呼び出しに置換
□ USER_CREDENTIALS（hub-v2）をKintoneユーザーマスタから動的生成に変更
□ CORETO_HQ_ACCOUNTS（localStorage）をKintoneに移行後、hub-v2のマージ処理を廃止
□ 本番URLで全ページの動作確認・スモークテスト
```

---

*このドキュメントはCOREBLDG v2開発セッションで自動生成されました。*  
*最終更新: 2026年3月15日*
