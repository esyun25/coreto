/**
 * COREBLDG v2 — 共有ナビゲーションモジュール
 * 各外部ページに <script src="coreto-nav-v2.js"></script>
 * <script>CNAV.init('PAGE_KEY');</script> で呼び出す
 */
const CNAV = (() => {

// ──────────────────────────────────────────────────────
// CSS injection（外部ページに不足しているスタイルを補完）
// ──────────────────────────────────────────────────────
const INJECT_CSS = `
.cnav-section { margin-bottom:4px; }
.cnav-section-label {
  font-size:9px; font-weight:600; letter-spacing:2px; text-transform:uppercase;
  color:rgba(255,255,255,.18); padding:10px 8px 4px;
  font-family:'DM Mono',monospace;
}
.cnav-item {
  display:flex; align-items:center; gap:9px; padding:7px 9px;
  border-radius:7px; cursor:pointer; transition:all .13s;
  text-decoration:none; position:relative; margin-bottom:1px;
}
.cnav-item:hover { background:rgba(255,255,255,.06); }
.cnav-item.active { background:rgba(200,169,81,.1); }
.cnav-item.active::before {
  content:''; position:absolute; left:0; top:50%; transform:translateY(-50%);
  width:3px; height:16px; background:#C8A951; border-radius:0 2px 2px 0;
}
.cnav-icon {
  width:26px; height:26px; display:flex; align-items:center; justify-content:center;
  font-size:13px; border-radius:6px; flex-shrink:0;
  background:rgba(255,255,255,.04);
}
.cnav-item.active .cnav-icon { background:rgba(200,169,81,.12); }
.cnav-label { font-size:11px; font-weight:500; color:rgba(255,255,255,.55); flex:1; }
.cnav-item.active .cnav-label { color:#C8A951; }
.cnav-item:hover .cnav-label { color:rgba(255,255,255,.82); }
.cnav-badge {
  font-size:9px; font-weight:700; padding:1px 6px; border-radius:10px;
  background:#DC2626; color:#fff; font-family:'Outfit',sans-serif;font-feature-settings:'tnum';
}
.cnav-badge.amber { background:#D97706; }
.cnav-badge.gold  { background:#C8A951; color:#0D1A2D; }
.cnav-note {
  font-size:9px; padding:1px 5px; border-radius:4px;
  background:rgba(255,255,255,.08); color:rgba(255,255,255,.3);
  font-family:'DM Mono',monospace;
}
.cnav-footer {
  padding:10px 14px 18px;
  border-top:1px solid rgba(255,255,255,.05);
}
.cnav-footer-item {
  display:flex; align-items:center; gap:8px; padding:7px 8px;
  border-radius:8px; cursor:pointer; transition:all .15s;
  font-size:12px; color:rgba(255,255,255,.35);
}
.cnav-footer-item:hover { background:rgba(255,255,255,.05); color:rgba(255,255,255,.65); }
`;

function injectCSS() {
  if (document.getElementById('cnav-style')) return;
  const s = document.createElement('style');
  s.id = 'cnav-style';
  s.textContent = INJECT_CSS;
  document.head.appendChild(s);
}

// ──────────────────────────────────────────────────────
// ナビ定義（hub と完全同期）
// ──────────────────────────────────────────────────────
const NAV = {
  hq: [
    { section:'ダッシュボード', items:[
      { icon:'🏠', label:'HQダッシュボード',      href:'coreto-hub-v2.html',          key:'dashboard' },
      { icon:'📊', label:'経営レポート',           href:'coreto-hub-v2.html#exec',     key:'exec' },
    ]},
    { section:'CRM / 案件', items:[
      { icon:'👥', label:'クライアント管理',       href:'coreto-crm-v2.html',          key:'crm' },
      { icon:'🏘️', label:'不動産案件（全体）',     href:'coreto-cases-v2.html',        key:'cases',    badge:'8' },
      { icon:'👤', label:'人材案件（全体）',       href:'coreto-cases-v2.html',        key:'hr_cases_all', badge:'4' },
      { icon:'💰', label:'入金監視',               href:'coreto-remittance-v2.html',   key:'remit',    badge:'3', badgeColor:'amber' },
      { icon:'📋', label:'書類審査',               href:'coreto-screening-v2.html',    key:'screening',badge:'5', badgeColor:'amber' },
      { icon:'🔑', label:'IT重説管理',             href:'coreto-itsetsu-v2.html',      key:'itsetsu',  badge:'2', badgeColor:'amber' },
    ]},
    { section:'スタッフ管理', items:[
      { icon:'🏢', label:'AG管理',                 href:'coreto-hub-v2.html#agents',   key:'agents' },
      { icon:'🤝', label:'PT管理',                 href:'coreto-hub-v2.html#pt_mgmt',  key:'pt_mgmt' },
      { icon:'🎓', label:'インターン管理',          href:'coreto-intern-v2.html',       key:'intern' },
    ]},
    { section:'報酬 / 通知', items:[
      { icon:'💴', label:'報酬・支払い（全体）',   href:'coreto-payment-v2.html',      key:'payment' },
      { icon:'📲', label:'LINE認証管理',           href:'coreto-line-auth-v2.html',    key:'line_auth' },
      { icon:'🔔', label:'通知ログ',               href:'coreto-hub-v2.html#notif',    key:'notif' },
    ]},
    { section:'事業SFA', items:[
      { icon:'⚡', label:'光通信SFA（全体）',      href:'coreto-utility-v2.html',      key:'utility' },
    ]},
    { section:'システム', items:[
      { icon:'🔐', label:'ユーザー管理',           href:'coreto-hub-v2.html#users',    key:'users' },
      { icon:'📚', label:'研修コンテンツ管理',     href:'coreto-hub-v2.html#onboard_mgmt', key:'onboard_mgmt' },
    ]},
  ],
  re_ag: [
    { section:'マイページ', items:[
      { icon:'🏠', label:'マイダッシュボード',     href:'coreto-hub-v2.html',          key:'dashboard' },
      { icon:'🏅', label:'ランク・報酬明細',       href:'coreto-payment-v2.html',      key:'payment' },
    ]},
    { section:'不動産（AG権限）', items:[
      { icon:'🏘️', label:'担当案件',               href:'coreto-cases-v2.html',        key:'cases',    badge:'4' },
      { icon:'👥', label:'クライアント管理',       href:'coreto-crm-v2.html',          key:'crm' },
      { icon:'📋', label:'書類審査（担当分）',     href:'coreto-screening-v2.html',    key:'screening' },
      { icon:'🔑', label:'IT重説チェック',         href:'coreto-itsetsu-v2.html',      key:'itsetsu' },
      { icon:'💰', label:'入金確認',               href:'coreto-remittance-v2.html',   key:'remit' },
    ]},
    { section:'光通信（AG権限）', items:[
      { icon:'⚡', label:'光通信 担当案件',        href:'coreto-utility-v2.html',      key:'utility',  badge:'2', badgeColor:'gold' },
    ]},
    { section:'人材（PT扱い・閲覧のみ）', items:[
      { icon:'🔒', label:'人材紹介 進捗確認',      href:'coreto-hub-v2.html#hr_ref',   key:'hr_ref',   note:'PT扱い' },
    ]},
    { section:'ツール', items:[
      { icon:'📚', label:'マニュアル・研修',       href:'coreto-hub-v2.html#onboard',  key:'onboard' },
      { icon:'📲', label:'LINE再連携',             href:'coreto-hub-v2.html#line_relink', key:'line_relink' },
    ]},
  ],
  hr_ag: [
    { section:'マイページ', items:[
      { icon:'🏠', label:'マイダッシュボード',     href:'coreto-hub-v2.html',          key:'dashboard' },
      { icon:'🏅', label:'ランク・報酬明細',       href:'coreto-payment-v2.html',      key:'payment' },
    ]},
    { section:'人材（AG権限）', items:[
      { icon:'👤', label:'担当案件（HR）',         href:'coreto-cases-v2.html',        key:'cases',    badge:'3' },
      { icon:'👥', label:'クライアント管理',       href:'coreto-crm-v2.html',          key:'crm' },
      { icon:'📋', label:'書類審査（担当分）',     href:'coreto-screening-v2.html',    key:'screening' },
    ]},
    { section:'光通信（AG権限）', items:[
      { icon:'⚡', label:'光通信 担当案件',        href:'coreto-utility-v2.html',      key:'utility',  badge:'1', badgeColor:'gold' },
    ]},
    { section:'不動産（PT扱い・閲覧のみ）', items:[
      { icon:'🔒', label:'不動産紹介 進捗確認',    href:'coreto-hub-v2.html#re_ref',   key:'re_ref',   note:'PT扱い' },
    ]},
    { section:'ツール', items:[
      { icon:'📚', label:'マニュアル・研修',       href:'coreto-hub-v2.html#onboard',  key:'onboard' },
      { icon:'📲', label:'LINE再連携',             href:'coreto-hub-v2.html#line_relink', key:'line_relink' },
    ]},
  ],
  pt: [
    { section:'ポータル', items:[
      { icon:'🏠', label:'PTポータル',             href:'coreto-hub-v2.html',          key:'dashboard' },
      { icon:'🔑', label:'紹介コード',             href:'coreto-hub-v2.html#code',     key:'code' },
      { icon:'💴', label:'報酬明細',               href:'coreto-payment-v2.html',      key:'payment' },
    ]},
    { section:'不動産（紹介・閲覧のみ）', items:[
      { icon:'🏘️', label:'不動産案件を紹介する',   href:'coreto-hub-v2.html#re_refer', key:'re_refer' },
      { icon:'📊', label:'紹介案件の進捗',         href:'coreto-hub-v2.html#re_progress', key:'re_progress' },
    ]},
    { section:'人材（紹介・閲覧のみ）', items:[
      { icon:'👤', label:'人材案件を紹介する',     href:'coreto-hub-v2.html#hr_refer', key:'hr_refer' },
      { icon:'📊', label:'紹介案件の進捗',         href:'coreto-hub-v2.html#hr_progress', key:'hr_progress' },
    ]},
    { section:'光通信（案件投げ可）', items:[
      { icon:'⚡', label:'光通信案件を投げる',     href:'coreto-hub-v2.html#util_submit', key:'util_submit', badge:'NEW', badgeColor:'gold' },
      { icon:'📊', label:'投げた案件の進捗',       href:'coreto-hub-v2.html#util_progress', key:'util_progress' },
    ]},
    { section:'ツール', items:[
      { icon:'📚', label:'マニュアル・研修',       href:'coreto-hub-v2.html#onboard',  key:'onboard' },
      { icon:'📲', label:'LINE再連携',             href:'coreto-hub-v2.html#line_relink', key:'line_relink' },
    ]},
  ],
  intern: [
    { section:'本日の業務', items:[
      { icon:'📊', label:'当日の実績',             href:'coreto-hub-v2.html',          key:'dashboard' },
      { icon:'📍', label:'訪問を記録する',         href:'coreto-hub-v2.html#visit',    key:'visit' },
      { icon:'🗺️', label:'担当エリアマップ',       href:'coreto-hub-v2.html#map',      key:'map' },
    ]},
    { section:'光通信リード', items:[
      { icon:'⚡', label:'リードを投げる',         href:'coreto-hub-v2.html#lead_submit', key:'lead_submit' },
    ]},
    { section:'個人', items:[
      { icon:'💴', label:'報酬確認',               href:'coreto-payment-v2.html',      key:'payment' },
      { icon:'🏆', label:'ランキング',             href:'coreto-intern-v2.html',       key:'rank' },
      { icon:'📚', label:'マニュアル・研修',       href:'coreto-hub-v2.html#onboard',  key:'onboard' },
      { icon:'📲', label:'LINE再連携',             href:'coreto-hub-v2.html#line_relink', key:'line_relink' },
    ]},
  ],
};

const USERS = {
  hq:    { name:'田中 誠一（統括）', role:'CORETO / exec',    av:'HQ' },
  re_ag: { name:'山田 誠（RE-AG）',  role:'AG-0042 / Gold',   av:'AG' },
  hr_ag: { name:'鈴木 花子（HR-AG）',role:'AG-0088 / Silver', av:'AG' },
  pt:    { name:'佐藤 健一（PT）',   role:'PT-0015 / active', av:'PT' },
  intern:{ name:'渡辺 大輝（インターン）', role:'INT-0007 / active', av:'IN' },
};

// ──────────────────────────────────────────────────────
// 設定モーダル
// ──────────────────────────────────────────────────────
function openSettings() {
  if (document.getElementById('cnav-s-modal')) return;

  const role = sessionStorage.getItem('coreto_role') || 'hq';
  const user = USERS[role] || USERS.hq;

  const overlay = document.createElement('div');
  overlay.id = 'cnav-s-overlay';
  overlay.onclick = closeSettings;
  Object.assign(overlay.style, {
    position:'fixed', inset:'0', background:'rgba(0,0,0,.45)',
    zIndex:'9998', backdropFilter:'blur(2px)'
  });

  const modal = document.createElement('div');
  modal.id = 'cnav-s-modal';
  Object.assign(modal.style, {
    position:'fixed', top:'50%', left:'50%',
    transform:'translate(-50%,-50%)', zIndex:'9999',
    width:'420px', background:'#fff', borderRadius:'14px',
    overflow:'hidden', boxShadow:'0 20px 60px rgba(0,0,0,.22)',
    fontFamily:"'Outfit','Noto Sans JP',sans-serif"
  });
  modal.innerHTML = `
    <div style="background:#0D1A2D;padding:18px 22px;display:flex;align-items:center;justify-content:space-between">
      <div style="font-family:'Cormorant Garamond',serif;font-size:16px;font-weight:700;letter-spacing:3px;color:#C8A951">設定</div>
      <button id="cnav-s-close" style="background:rgba(255,255,255,.1);border:none;width:28px;height:28px;border-radius:50%;color:rgba(255,255,255,.6);font-size:16px;cursor:pointer;line-height:1">✕</button>
    </div>
    <div style="padding:20px 22px">
      <div style="font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#6B7280;margin-bottom:10px">表示設定</div>
      <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:20px">
        <label style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:#F7F4EE;border-radius:8px;cursor:pointer;font-size:13px;color:#1A1A2E">
          デスクトップ通知
          <input type="checkbox" checked style="accent-color:#0D1A2D;width:14px;height:14px">
        </label>
        <label style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:#F7F4EE;border-radius:8px;cursor:pointer;font-size:13px;color:#9CA3AF">
          ダークモード（開発中）
          <input type="checkbox" disabled style="width:14px;height:14px">
        </label>
      </div>
      <div style="font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#6B7280;margin-bottom:10px">アカウント</div>
      <div style="display:flex;flex-direction:column;gap:8px">
        <div style="padding:10px 14px;background:#F7F4EE;border-radius:8px;display:flex;justify-content:space-between;font-size:13px">
          <span style="color:#6B7280">ログイン中</span>
          <span style="font-weight:600;color:#1A1A2E">${user.name}</span>
        </div>
        <div style="padding:10px 14px;background:#F7F4EE;border-radius:8px;display:flex;justify-content:space-between;font-size:13px">
          <span style="color:#6B7280">バージョン</span>
          <span style="font-family:'DM Mono',monospace;color:#9CA3AF">COREBLDG v2.0</span>
        </div>
      </div>
    </div>
    <div style="padding:0 22px 22px;display:flex;gap:8px">
      <button id="cnav-s-btn-close" style="flex:1;padding:11px;background:#F7F4EE;border:1px solid #E5E0D5;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;color:#6B7280">閉じる</button>
      <button id="cnav-s-btn-logout" style="flex:1;padding:11px;background:#DC2626;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;color:#fff">ログアウト</button>
    </div>`;

  document.body.appendChild(overlay);
  document.body.appendChild(modal);

  document.getElementById('cnav-s-close').onclick = closeSettings;
  document.getElementById('cnav-s-btn-close').onclick = closeSettings;
  document.getElementById('cnav-s-btn-logout').onclick = logout;
}

function closeSettings() {
  ['cnav-s-overlay','cnav-s-modal'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.remove();
  });
}

function logout() {
  if (!confirm('ログアウトしますか？')) return;
  sessionStorage.removeItem('coreto_role');
  window.location.href = 'coreto-hub-v2.html';
}

// ──────────────────────────────────────────────────────
// フッター描画
// ──────────────────────────────────────────────────────
function renderFooter() {
  // sb-navの後に挿入（nav要素内の末尾）
  const sbNav = document.getElementById('sb-nav');
  if (!sbNav) return;
  const nav = sbNav.closest('nav') || sbNav.parentElement;

  // 既存のfooter相当divを探して置き換える
  let footer = nav.querySelector('.cnav-footer');
  if (!footer) {
    footer = document.createElement('div');
    footer.className = 'cnav-footer';
    nav.appendChild(footer);
  }
  footer.innerHTML = `
    <div class="cnav-footer-item" onclick="CNAV.openSettings()">
      <span>⚙️</span><span>設定</span>
    </div>
    <div class="cnav-footer-item" onclick="CNAV.logout()">
      <span>🚪</span><span>ログアウト</span>
    </div>`;
}

// ──────────────────────────────────────────────────────
// メイン初期化
// ──────────────────────────────────────────────────────
function init(activeKey) {
  injectCSS();

  const role = sessionStorage.getItem('coreto_role') || 'hq';
  const user = USERS[role] || USERS.hq;
  const sections = NAV[role] || NAV.hq;

  // ユーザー情報を更新
  ['sb-av','sb-name','sb-role',
   'sb-un','sb-ur'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    if (id === 'sb-av') el.textContent = user.av;
    else if (id === 'sb-name' || id === 'sb-un') el.textContent = user.name;
    else el.textContent = user.role;
  });

  // ナビ描画
  const navEl = document.getElementById('sb-nav');
  if (!navEl) return;

  navEl.innerHTML = sections.map(sec => `
    <div class="cnav-section">
      <div class="cnav-section-label">${sec.section}</div>
      ${sec.items.map(item => {
        const isActive = item.key === activeKey;
        const badgeCls = item.badgeColor === 'amber' ? 'amber'
                       : item.badgeColor === 'gold'  ? 'gold' : '';
        return `<a href="${item.href}" class="cnav-item${isActive ? ' active' : ''}">
          <div class="cnav-icon">${item.icon}</div>
          <div class="cnav-label">${item.label}</div>
          ${item.note ? `<div class="cnav-note">${item.note}</div>` : ''}
          ${item.badge ? `<div class="cnav-badge ${badgeCls}">${item.badge}</div>` : ''}
        </a>`;
      }).join('')}
    </div>`).join('');

  // フッター（設定・ログアウト）を描画
  renderFooter();

  // 既存フッター要素（旧 .sf ボタン等）を非表示にする
  const legacyFooter = navEl.closest('nav')
    ? navEl.closest('nav').querySelector('[class*="footer"]:not(.cnav-footer)')
    : null;
  if (legacyFooter) legacyFooter.style.display = 'none';
}

return { init, openSettings, closeSettings, logout };
})();
