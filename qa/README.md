# COREBLDG v2 自動QAシステム

## セットアップ（初回のみ）

```bash
cd qa
npm install
npx playwright install chromium
```

## 使い方

### 🔍 静的解析（高速・数秒）
ハードコード・CSS競合・構文エラーを61ファイル全てチェック。
```bash
node qa/static-analyzer.js
```

### 🌐 ブラウザテスト（約2〜3分）
HQ/AG/PT全ロールで実際にログインし主要ページを巡回してチェック。
```bash
node qa/browser-tester.js
```

### 🚀 両方まとめて実行
```bash
node qa/qa-runner.js
```

### 🔧 自動修正モード
badge固定値・.nav-item CSS残存などを自動修正。
```bash
node qa/qa-runner.js --static --fix
git add v2/ && git commit -m "fix: QA自動修正"
```

---

## 検査項目一覧

### 静的解析（static-analyzer.js）

| # | 検査内容 | レベル |
|---|---|---|
| ① | 構文エラー（node --check） | ERROR |
| ② | ハードコードデモ人名・案件ID・AG-ID・固定KPI | WARN |
| ③ | badge固定値（'1'〜'9'等） | WARN |
| ④ | .nav-item CSS残存（CNAVと競合） | WARN |
| ⑤ | サイドバー構造（`<nav class="sb">`がない） | WARN |
| ⑥ | sb-nameハードコード | WARN |

### ブラウザテスト（browser-tester.js）

| # | 検査内容 | 対象ロール |
|---|---|---|
| A | デモテキスト実表示（田中優子等） | 全ロール |
| B | サイドバー表示確認 | 全ロール |
| C | sb-nameハードコード | 全ロール |
| D | ナビバッジ件数記録 | 全ロール |
| E | コンテンツ空確認（#page-content） | 全ロール |
| F | コンソールエラー収集 | 全ロール |
| G | ナビアイテム数確認（0件アラート） | 全ロール |
| H | ページタイトル統一確認 | AG系 |

---

## CI/CD組み込み

GitHub Actionsに組み込む場合：

```yaml
# .github/workflows/qa.yml
name: QA
on: [push, pull_request]
jobs:
  static:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22' }
      - run: node qa/static-analyzer.js
```

---

## レポートファイル

実行後に以下のJSONが出力されます：
- `qa/static-report.json` — 静的解析結果
- `qa/browser-report.json` — ブラウザテスト結果
