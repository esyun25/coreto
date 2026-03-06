# セキュリティ監査 仕様書（2026年3月）

> ステータス: 実装済み  
> 最終更新: 2026-03-06  
> 確認者: Tim

---

## 概要

AGおよびPT向けページを対象に、ロールベースアクセス制御（RBAC）の脆弱性を
自動スキャン＋手動精査で全件洗い出し、パッチを適用した。

コミット: `5c3eea0`（AG向け修正）→ `8d0bf84`（PT向け修正）

---

## AGページ向け修正（コミット 5c3eea0）

### 修正した10件の脆弱性

| ファイル | 問題 | 修正内容 |
|---|---|---|
| coreto-agent-mypage.html | PTがAGのマイページ（収益・案件）にアクセス可能 | PTを `coreto-partner.html` へリダイレクト |
| coreto-pipeline.html | 認証ガードなし（誰でもアクセス可） | セッションガード追加 |
| coreto-batch-close.html | 認証ガードなし | セッションガード追加 |
| coreto-it-setsu.html | 認証ガードなし | セッションガード追加 |
| coreto-naiken.html | 認証ガードなし | セッションガード追加 |
| coreto-sale-report.html | 認証ガードなし | セッションガード追加 |
| coreto-takken.html | 認証ガードなし | セッションガード追加 |
| coreto-rank.html | PTがAGメンター配下情報（MENTEES）を閲覧可能 | PTにはメンターセクション非表示 |
| coreto-receipt.html | MEオブジェクトがハードコード（山田誠名義で発行可） | `_SESSION` から動的取得 |
| coreto-account-settings.html | MEオブジェクトがハードコード | `_SESSION` から動的取得 |

---

## PTページ向け修正（コミット 8d0bf84）

### CRITICALの修正3件

| ファイル | 問題 | 修正内容 |
|---|---|---|
| coreto-partner-feed.html | typeガードが `!=='hq'` だけでPTも弾いていた（逆バグ） | `!=='hq' && !=='pt'` に変更 |
| coreto-agent-mypage.html | PTがAGマイページにアクセス可能 | PTリダイレクトガード追加 |
| coreto-rank.html | PTがMENTEES（AG育成情報）を閲覧可能 | PTにはメンターセクション非表示 |

### データ漏洩の修正2件

| ファイル | 問題 | 修正内容 |
|---|---|---|
| coreto-receipt.html | 他人（山田誠）名義の領収書・源泉徴収票を発行可能 | `_SESSION` から動的取得 |
| coreto-account-settings.html | 他人のアカウント設定が表示・編集可能 | `_SESSION` から動的取得 |

### 誤検知（問題なしと確認した項目）

| ファイル | 指摘 | 判定理由 |
|---|---|---|
| coreto-partner.html | apply.htmlへのリンク | PTが顧客に渡す招待リンク生成（正当） |
| coreto-partner-signup.html | 認証ガードなし | トークンゲート方式（`?token=`必須）で保護済み |
| coreto-onboarding.html | pipeline.htmlリンク | TASKS_REとTASKS_HRにのみ存在、TASKS_PTには含まれない |
| coreto-receipt.html | bulkPrint/exportAllCSV | HTMLボタンなし（デッドコード） |
| coreto-contract.html | 全エージェント配布UI | pageHQ()関数内にのみ存在、PTには表示されない |

---

## セキュリティモデルの設計原則

### ロール別アクセス権限

```
HQ    → 全ページアクセス可
RE    → AG向けページのみ（HQページは不可）
HR    → AG向けページのみ（HQページは不可）
PT    → PTポータル（hub内）のみ。AGページ・HQページへのアクセス不可
```

### 認証ガードのパターン（標準実装）

```javascript
// 全ページ共通ガード（セッション検証）
(function() {
  var s;
  try { s = JSON.parse(sessionStorage.getItem('coreto_session') || 'null'); } catch(e) { s = null; }
  if (!s || !s.userId || !s.type) {
    sessionStorage.setItem('coreto_redirect', window.location.href);
    window.location.replace('coreto-login.html');
    return;
  }
  if (!s.sessionToken || s.sessionToken.length !== 64) {
    sessionStorage.removeItem('coreto_session');
    window.location.replace('coreto-login.html');
    return;
  }
  var loginAt = new Date(s.loginAt).getTime();
  if (isNaN(loginAt) || (Date.now() - loginAt) > 28800000) { // 8時間
    sessionStorage.removeItem('coreto_session');
    alert('セッションの有効期限が切れました。再度ログインしてください。');
    window.location.replace('coreto-login.html');
    return;
  }
  // ロール別制限（例: AG専用ページ）
  if (s.type === 'pt') {
    window.location.replace('coreto-hub.html');
    return;
  }
  window._SESSION = s;
})();
```

### ME オブジェクトの正しい実装（ハードコード禁止）

```javascript
// ❌ 禁止: ハードコード
const ME = { id:'10012', name:'山田 誠', ... };

// ✅ 正しい: セッションから取得
const _sess = window._SESSION || {};
const ME = {
  id:       _sess.userId   || 'FALLBACK',
  name:     _sess.name     || 'デモユーザー',
  type:     _sess.type     || 're',
  rank:     _sess.rankKey  || 'bronze',
};
```

---

## 今後新規ページを追加する際のチェックリスト

- [ ] 認証ガード（セッション検証）を最初に実装する
- [ ] ロール制限（`s.type`チェック）を明示的に実装する
- [ ] MEオブジェクトは必ず `_SESSION` から取得する（ハードコード禁止）
- [ ] 全員が見える配列（AGSなど）にロールフィルタを適用する
- [ ] PTがアクセスすべきでないAG専用ページへのリンクを含めない
