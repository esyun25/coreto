# 契約書送付・追跡フロー仕様
最終更新: 2026-03-03

## 1. 賃貸契約書フロー
1. 管理会社から書類到着
2. HQ/AGがbarcode-scan.htmlで受取登録・バーコードラベル印刷
3. スキャン → Google Drive アップロード → Slack通知
4. クライアントへの送付方法を選択（来店受取 or レターパック郵送）
5. 郵送の場合: 追跡番号を登録 → 郵便局API自動追跡 → 配達完了Slack通知
6. 署名済み書類受取 → 管理会社に返送
7. 完了登録 → pipelineのステップを「契約完了」に更新

## 2. 売買・三為契約書
pipeline.htmlの契約ステップで管理。
- 売買契約日の入力
- 契約書PDFのアップロード（Google Drive連携）

## 3. 関連ファイル
- coreto-barcode-scan.html: バーコード発行・追跡管理
- coreto-contract.html: 契約書管理
- coreto-pipeline.html: ステップ進行
