# CORETO セキュリティポリシー

## 脆弱性の報告

セキュリティ上の問題を発見した場合は、GitHub Issueではなく以下に報告してください:

- **メール**: security@coreto.jp（設定後）
- **対応期限**: 報告から7営業日以内に初回返答

## 既知のセキュリティ制約

本システムは現在フロントエンドのみで動作しています。以下は既知の制約です:

1. **認証**: クライアントサイド認証（SHA-256ハッシュ）。Kintone移行後にサーバーサイド認証へ移行予定。
2. **データ永続化**: localStorage使用中。Kintone移行後にクラウドDBへ移行予定。

## セキュリティ設定（本番前チェックリスト）

- [ ] `STRIPE_PUBLISHABLE_KEY` を正式キーに設定
- [ ] `SLACK_CONFIG` Webhook URLを設定し `ENABLED: true` に変更
- [ ] `ZAPIER_CONFIG` Webhook URLを設定し `ENABLED: true` に変更
- [ ] 全エージェントの初期パスワードを個別通知後に変更を依頼
- [ ] GitHubリポジトリをprivateに変更（推奨）
- [ ] 独自ドメインを取得しGitHub Pagesに設定

## Webhook URLの管理

Slack・ZapierのWebhook URLは **絶対にGitHubにコミットしない** こと。

```bash
# db.jsのWebhook URLを設定する場合は、コミット前に必ずプレースホルダーに戻す
git diff db.js  # コミット前に確認
```
