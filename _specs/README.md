# CORETO 仕様書ライブラリ

このディレクトリはCORETOの未実装・実装済み機能の仕様・設計決定事項を保管します。  
実装時・会話が途切れた際は **このディレクトリを最初に確認してください**。

---

## 仕様書一覧

| ファイル | 内容 | ステータス |
|---|---|---|
| [email-provisioning.md](./email-provisioning.md) | メールアドレス自動発行システム（Zoho Mail + Zapier + Kintone） | 設計済み・未実装 |
| [rental-flow.md](./rental-flow.md) | 賃貸仲介フロー（エージェント/パートナー/HQ × 自己持込/マッチング） | 確定 |
- [itsetsu-flow.md](itsetsu-flow.md) — IT重説 日程調整・マッチング仕様
| [commission-rank-mentor.md](./commission-rank-mentor.md) | 報酬分配・ランク制度・メンターコミッション・システム利用料 | 確定 |
| [payment-infrastructure.md](./payment-infrastructure.md) | 資金フロー・GMOバーチャル口座・Kyash・Stripe・即時払い運用 | 設計確定・一部未実装 |
| [payment-schedule.md](./payment-schedule.md) | 入出金タイミング・月次スケジュール・即時払い・HR分割払い | 確定（要確認4点あり） |
| [incoming-payments.md](./incoming-payments.md) | 手数料入金フロー・請求書発行・案件種別ごとの入金タイミング | 確定 |
| [onboarding-flow.md](./onboarding-flow.md) | 入会フロー・書類審査・オンボーディング4フェーズ | 確定（研修コンテンツ未実装） |
| [sale-sannai-flow.md](./sale-sannai-flow.md) | 売買・三為成約報告フロー（ステップ・報酬計算トリガー・Slack通知） | 確定 |
| [early-quit-flow.md](./early-quit-flow.md) | 早期退職アラート・返金フロー（HR専用・在籍確認・控除処理） | 確定 |
| [naiken-flow.md](./naiken-flow.md) | 内見依頼フロー | 確定 |
| [contract-flow.md](./contract-flow.md) | 契約書送付・追跡フロー | 確定 |
| [screening-flow.md](./screening-flow.md) | KYC・書類審査フロー（チェック項目・AI活用ポイント） | 確定 |
| [payment-statement-flow.md](./payment-statement-flow.md) | 支払明細書ジェネレーター フロー | 確定 |
| [rank-flow.md](./rank-flow.md) | ランク昇格・降格フロー | 確定 |
| [barcode-tracking-flow.md](./barcode-tracking-flow.md) | バーコード・書類追跡 運用フロー | 確定 |
| [hq-intervention-flow.md](./hq-intervention-flow.md) | HQ案件介入・強制変更フロー | 確定 |
| [sale-hr-pipeline-flow.md](./sale-hr-pipeline-flow.md) | 案件管理フロー（売買・三為・HR） | 確定 |

---

## 記載ルール

- ステータスは `設計済み・未実装` / `実装中` / `実装済み` / `保留` のいずれかを使う
- 決定事項が変更された場合は上書きせず、変更日と変更理由を追記する
- 実装完了後も削除せず、ステータスを `実装済み` に更新して残す

---

## 未実装タスク一覧（CORETO全体）

hub.html内のコメントより転載：

1. ③ 書類審査チェックシート
2. ④ エージェントランクダッシュボード
3. ⑤ IT重説チェックリスト＋契約書スキャン管理
4. ⑥ 支払明細書ジェネレーター
5. ⑦ 特別紹介コード管理
6. ⑧ 早期退職アラート一覧
7. ⑨ パートナー向けポータル
8. onboarding.html 研修内容・ルール（コンテンツ未実装）
9. **メールアドレス自動発行システム** → [詳細](./email-provisioning.md)
- [matching-flow.md](matching-flow.md) — エージェント・パートナー案件マッチング仕様
