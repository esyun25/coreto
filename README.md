# CORETO — 内部管理システム

> ⚠️ **重要**: このリポジトリはCORETO社内向けシステムです。
> 本番運用前に必ず `SECURITY.md` のチェックリストを確認してください。

## セットアップ

1. `db.js` の各種Webhook URLを設定
2. `coreto-agent-signup.html` の `STRIPE_PUBLISHABLE_KEY` を設定
3. `SECURITY.md` のチェックリストを完了

## ファイル構成

- `db.js` — データアクセス層（Kintone移行時はこのファイルのみ変更）
- `KINTONE_MIGRATION.md` — Kintone移行設計書
- `SECURITY.md` — セキュリティポリシー
