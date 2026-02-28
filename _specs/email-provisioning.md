# メールアドレス自動発行システム 仕様書

> ステータス: 設計済み・未実装  
> 最終更新: 2026-02-28  
> 実装時はこのファイルを参照すること

---

## 概要

KYC承認をトリガーに、エージェント・名刺希望パートナーへ `@coreto.co.jp` のメールアドレスを自動発行するシステム。

---

## インフラ構成

| 役割 | サービス |
|---|---|
| メールサーバー | **Zoho Mail**（@coreto.co.jp のMXレコードをZohoに向ける） |
| HQの業務ツール | Google Workspace（Drive/Docs/Meet/Calendar）※メールはZoho |
| 自動化ハブ | **Zapier**（既存） |
| エージェント管理DB | **Kintone**（既存） |
| ドメイン | coreto.co.jp（現在Xサーバーで管理） |

### DNS移行について
- 現在のMXレコード（Xサーバー）→ ZohoのMXレコードに切り替える
- HQ用Google WorkspaceはGmailを使わず、DriveやDocsのみ利用
- 切り替え前に既存メールをZohoにインポートすること

---

## メールアドレス命名規則

### 基本形式

```
{ファーストネームの頭文字}-{ファミリーネーム}@coreto.co.jp
```

**例：山田 誠 → `m-yamada@coreto.co.jp`**

### ローマ字表記ルール

- ヘボン式ローマ字を使用
- 全て小文字
- ファミリーネームにスペース・特殊文字が含まれる場合は除去
  - 例：「小田切」→ `odagiri`

### 重複時のフォールバック

同じアドレスが既に存在する場合、ファーストネームの文字数を1文字ずつ増やす。

| 試行 | アドレス例 | 条件 |
|---|---|---|
| 1回目 | `m-yamada@coreto.co.jp` | デフォルト |
| 2回目 | `ma-yamada@coreto.co.jp` | 1回目が重複 |
| 3回目 | `mak-yamada@coreto.co.jp` | 2回目が重複 |
| 4回目〜 | ファーストネーム全文字まで続ける | 以降同様 |
| 全て重複 | `m-yamada2@coreto.co.jp` | 数字サフィックス |

### 重複チェック方法

ZapierからZoho Mail APIで既存アカウント一覧を取得し、生成したアドレスが含まれないことを確認してから作成。

---

## 入会フォームへの追加事項

### 追加フィールド（coreto-agent-signup.html）

| フィールド名 | 入力例 | バリデーション |
|---|---|---|
| ファーストネーム（ローマ字） | `Makoto` | 半角英字のみ、必須 |
| ファミリーネーム（ローマ字） | `Yamada` | 半角英字のみ、必須 |

- 上記フィールドをStep 1（基本情報）に追加
- 入力はヘボン式を案内文として表示する
- Kintoneに `name_roma_first` / `name_roma_last` フィールドとして保存

---

## Zapierフロー設計

### トリガー

```
Kintone — レコード更新
  条件: KYCステータス = "承認済み"
  かつ: メールアドレスフィールド = 空（再実行防止）
```

### ステップ構成

```
Step 1: Kintone — 対象レコード取得
          name_roma_first, name_roma_last を取得

Step 2: Zoho Mail API — 既存アカウント一覧取得
          GET /api/accounts
          → 重複チェック用リストを取得

Step 3: Zapier Code (JavaScript) — メールアドレス生成
          ┌ ファーストネームの頭1文字 + "-" + ファミリーネーム を生成
          ├ 重複チェック → 重複なら文字数を増やして再試行
          └ 最終的なアドレスを出力

Step 4: Zoho Mail API — アカウント作成
          POST /api/accounts
          Body:
            email: {生成アドレス}@coreto.co.jp
            firstName: {name_roma_first}
            lastName: {name_roma_last}
            password: {ランダム12文字・英数字記号}
            forcePasswordReset: true  ← 初回ログイン時に変更強制

Step 5: Kintone — レコード更新
          coreto_email フィールドに発行アドレスを書き戻し

Step 6: Slack通知 (#入会申請チャンネル)
          ✅ メール発行完了
          名前: {氏名}（#{エージェントID}）
          発行アドレス: {email}

Step 7: SendGrid or Zoho Mail — 案内メール送信
          宛先: 登録時の個人メールアドレス
          内容: (下記テンプレート参照)
```

### 案内メールテンプレート

```
件名: 【CORETO】メールアドレスのご案内

{氏名} さん

KYC審査が完了しました。
以下のメールアドレスを発行しましたのでご確認ください。

━━━━━━━━━━━━━━━━━━━━
メールアドレス: {email}@coreto.co.jp
初期パスワード: {password}
━━━━━━━━━━━━━━━━━━━━

※初回ログイン時にパスワードの変更が必要です。
※スマホ・PCどちらからもご利用いただけます。

【スマホ設定手順】
 → https://www.zoho.com/mail/mobile-apps.html

【PCでのログイン】
 → https://mail.zoho.com

ご不明な点はSlackまたは下記までご連絡ください。
```

---

## 退会時の自動停止（追加Zapierフロー）

```
トリガー: Kintone — ステータス = "退会済み"
Step 1: Zoho Mail API — アカウント停止
          PUT /api/accounts/{accountId}/status
          Body: { "status": "inactive" }
Step 2: Kintone — coreto_email フィールドをクリア
Step 3: Slack通知 (#退会チャンネル)
          🔴 メールアカウント停止: {email}
```

---

## Kintoneフィールド追加仕様

既存のエージェントアプリに以下フィールドを追加：

| フィールド名（日本語） | フィールドコード | タイプ | 備考 |
|---|---|---|---|
| ファーストネーム（ローマ字） | name_roma_first | 文字列（1行） | 入会フォームから連携 |
| ファミリーネーム（ローマ字） | name_roma_last | 文字列（1行） | 入会フォームから連携 |
| CORETOメールアドレス | coreto_email | 文字列（1行） | Zapierが自動入力 |
| メール発行日時 | email_issued_at | 日時 | Zapierが自動入力 |

---

## コスト試算

| 項目 | 単価 | 100人 | 500人 | 1000人 |
|---|---|---|---|---|
| Zoho Mail（5GBプラン） | ¥150/人/月 | ¥15,000 | ¥75,000 | ¥150,000 |
| Zoho Mail（50GBプラン） | ¥300/人/月 | ¥30,000 | ¥150,000 | ¥300,000 |
| Google Workspace（HQのみ10人） | ¥900/人/月 | ¥9,000 | ¥9,000 | ¥9,000 |
| **合計（5GBプラン）** | | **¥24,000** | **¥84,000** | **¥159,000** |

---

## 実装チェックリスト

### 事前準備
- [ ] Zoho Mail 30日トライアル開始
- [ ] `coreto.co.jp` ドメインをZohoで認証
- [ ] DNSのMXレコードをZohoに変更（Xサーバーから移行）
- [ ] Xサーバーの既存メールをZohoにインポート
- [ ] Zoho API キー取得（管理コンソール → 開発者設定）
- [ ] ZapierにZoho Mailコネクター追加

### Kintone
- [ ] `name_roma_first` フィールド追加
- [ ] `name_roma_last` フィールド追加
- [ ] `coreto_email` フィールド追加
- [ ] `email_issued_at` フィールド追加
- [ ] KYCステータスフィールドの値を確認（承認済みの文字列）

### 入会フォーム（coreto-agent-signup.html）
- [ ] ローマ字ファーストネームフィールド追加（Step 1）
- [ ] ローマ字ファミリーネームフィールド追加（Step 1）
- [ ] バリデーション追加（半角英字のみ）
- [ ] Kintone連携のPOSTボディに追加

### Zapier
- [ ] フロー作成（発行フロー）
- [ ] 重複チェックロジックのCodeステップ実装
- [ ] 案内メールテンプレート設定
- [ ] フロー作成（退会停止フロー）
- [ ] テスト実行（テストエージェントで確認）

### テスト
- [ ] 重複なし → 正常発行
- [ ] 重複あり → フォールバック動作確認
- [ ] Kintoneへの書き戻し確認
- [ ] Slack通知確認
- [ ] 案内メール受信確認（個人メール）
- [ ] Zohoにログインできることを確認
- [ ] 初回パスワード変更強制の動作確認

---

## 関連仕様書

- `_specs/README.md` — 仕様書一覧
- （今後追加予定）

---

*このファイルはCORETOシステム仕様の正式記録です。実装前に必ず最新版を確認してください。*
