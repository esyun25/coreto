/**
 * COREBLDG v2 — 共有ナビゲーションモジュール
 * <script src="coreto-nav-v2.js"></script>
 * <script>CNAV.init('PAGE_KEY');</script>
 *
 * ナビゲーション設計方針 (v2.4):
 *   - 業務ドメイン別にセクションを分割（不動産 / 人材 / 光通信）
 *   - 各ドメイン内は業務フロー順（案件 → 書類 → IT重説 → 成約 → 入金）
 *   - 管理・システム系は最下部
 *   - ロール別に「できること」のみ表示（PT扱いは別セクション）
 */
const CNAV = (() => {

const INJECT_CSS = `
/* ── サイドバー共通スタイル (全ページ統一) ── */
.sb{width:var(--sw,240px);background:#0D1A2D;display:flex;flex-direction:column;flex-shrink:0;position:relative;height:100%}
.sb::after{content:'';position:absolute;top:0;right:0;width:1px;height:100%;background:linear-gradient(180deg,rgba(200,169,81,.25) 0%,rgba(200,169,81,.06) 50%,transparent 100%)}
.sb-head{padding:24px 20px 18px;border-bottom:1px solid rgba(255,255,255,.06)}
.sb-logo{font-family:'Cormorant Garamond',serif;font-size:20px;font-weight:600;letter-spacing:5px;color:#C8A951}
.sb-ver{font-size:9px;letter-spacing:2px;color:rgba(200,169,81,.3);font-family:'DM Mono',monospace;margin-top:2px}
.sb-user{margin:14px 14px 10px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);border-radius:9px;padding:9px 11px;display:flex;align-items:center;gap:9px}
.sb-av{width:28px;height:28px;border-radius:50%;background:rgba(200,169,81,.15);border:1px solid rgba(200,169,81,.25);display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#C8A951;flex-shrink:0}
.sb-uname{font-size:11px;font-weight:600;color:rgba(255,255,255,.8)}
.sb-ur{font-size:9px;color:rgba(255,255,255,.3);font-family:'DM Mono',monospace}
.sb-nav{flex:1;overflow-y:auto;padding:6px 10px}
.sb-nav::-webkit-scrollbar{width:3px}
.sb-nav::-webkit-scrollbar-thumb{background:rgba(255,255,255,.1);border-radius:2px}

.cnav-section { margin-bottom:2px; }
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
.cnav-icon { width:18px; height:18px; display:flex; align-items:center; justify-content:center; flex-shrink:0; opacity:.75; }
.cnav-item:hover .cnav-icon, .cnav-item.active .cnav-icon { opacity:1; }
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
/* Mobile menu */
.sb-menu-btn { display: none; background: none; border: none; color: rgba(255,255,255,.7); font-size: 22px; cursor: pointer; padding: 4px 8px; margin-left: auto; }
@media (max-width: 768px) {
  .sb { position: fixed !important; left: -260px; top: 0; bottom: 0; z-index: 100; width: 240px; transition: left .25s ease; flex-direction: column !important; height: 100vh !important; }
  .sb.open { left: 0; }
  .sb-menu-btn { display: block; position: fixed; top: 8px; left: 8px; z-index: 99; background: var(--navy); border-radius: 8px; padding: 6px 10px; }
  .sb-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,.4); z-index: 99; }
  .sb-overlay.show { display: block; }
  .sb-head { display: flex !important; }
  .sb-nav { display: block !important; }
  .content { margin-left: 0 !important; }
}
.breadcrumb { display: flex; align-items: center; gap: 4px; padding: 8px 0 8px; font-size: 12px; color: var(--muted, #6B7280); font-family: 'Outfit', 'Noto Sans JP', sans-serif; }
.bc-item { color: var(--muted, #6B7280); text-decoration: none; }
.bc-item:hover { color: var(--ink, #111827); }
.bc-sep { color: var(--faint, #9CA3AF); }
.bc-current { color: var(--ink, #111827); font-weight: 600; }
.cnav-section { cursor:pointer; user-select:none; display:flex; align-items:center; justify-content:space-between; }
.cnav-section::after { content:'▾'; font-size:10px; color:rgba(255,255,255,.3); transition:transform .2s; }
.cnav-section.collapsed::after { transform:rotate(-90deg); }
.cnav-section-items.collapsed { max-height:0 !important; overflow:hidden; }
.cmd-overlay { position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:9000; display:flex; align-items:flex-start; justify-content:center; padding-top:15vh; backdrop-filter:blur(2px); }
.cmd-palette { width:min(560px,90vw); background:#fff; border-radius:16px; box-shadow:0 20px 60px rgba(0,0,0,.25); overflow:hidden; }
.cmd-input-wrap { display:flex; align-items:center; padding:14px 16px; border-bottom:1px solid #E5E7EB; gap:10px; }
.cmd-input { flex:1; border:none; outline:none; font-size:16px; font-family:'Outfit','Noto Sans JP',sans-serif; background:transparent; color:#111827; }
.cmd-results { max-height:360px; overflow-y:auto; padding:6px; }
.cmd-item { display:flex; align-items:center; gap:10px; padding:10px 12px; border-radius:8px; cursor:pointer; transition:background .1s; }
.cmd-item:hover, .cmd-item.selected { background:rgba(200,169,81,.12); }
.cmd-item-label { font-size:14px; font-weight:500; color:#111827; }
.cmd-item-section { font-size:11px; color:#6B7280; margin-left:auto; }
.cmd-empty { padding:24px; text-align:center; color:#6B7280; font-size:13px; }
.cmd-footer { padding:8px 14px; border-top:1px solid #E5E7EB; display:flex; gap:12px; font-size:11px; color:#6B7280; }
.cmd-key { background:#F3F4F6; border:1px solid #E5E7EB; border-radius:4px; padding:1px 5px; font-family:'DM Mono',monospace; font-size:10px; }
`;

function injectCSS() {
  if (document.getElementById('cnav-style')) return;
  const s = document.createElement('style');
  s.id = 'cnav-style';
  s.textContent = INJECT_CSS;
  document.head.appendChild(s);
}

// ════════════════════════════════════════════════════════════════
//  NAV 定義
//
//  【設計原則】
//  HQ    : 全業務・全管理機能。ドメイン別（不動産/人材/光通信）に分割
//  RE-AG : 不動産業務フロー順。光通信AG権限。人材はPT扱い（閲覧）
//  HR-AG : 人材業務フロー順。光通信AG権限。不動産はPT扱い（閲覧）
//  光通信AG: 光通信業務のみフルAG。不動産・人材はPT扱い（閲覧）
//  PT    : 各ドメインへの紹介投げ・進捗閲覧のみ
//  インターン: 訪問記録・光通信リード投げのみ
// ════════════════════════════════════════════════════════════════
const NAV = {

  // ════════════════ HQ ════════════════
  // HQは全業務を監督・管理する立場。統合ページへ集約（~12項目）。
  hq: [
    {
      section: '概要',
      items: [
        { icon:'🏠', label:'HQダッシュボード',    href:'coreto-hub-v2.html',             key:'dashboard',      iconKey:'home' },
        { icon:'📊', label:'経営ダッシュボード',   href:'coreto-dashboard-exec-v2.html',  key:'exec_dash',      iconKey:'exec_dash' },
      ],
    },
    {
      section: '案件管理',
      items: [
        { icon:'📋', label:'案件一覧',             href:'coreto-cases-v2.html',           key:'cases',           badge:0, iconKey:'cases' },
        { icon:'📈', label:'パイプライン',          href:'coreto-pipeline-v2.html',        key:'pipeline',       iconKey:'pipeline' },
        { icon:'🔑', label:'IT重説管理',            href:'coreto-itsetsu-mgmt-v2.html',    key:'itsetsu_mgmt',   iconKey:'itsetsu' },
        { icon:'👥', label:'CRM',                   href:'coreto-crm-v2.html',             key:'crm',            iconKey:'crm' },
      ],
    },
    {
      section: '財務・人事',
      items: [
        { icon:'💰', label:'財務管理',             href:'coreto-remittance-v2.html',      key:'finance',        iconKey:'finance' },
        { icon:'👔', label:'AG管理',               href:'coreto-rank-dashboard-v2.html',  key:'ag_mgmt',        iconKey:'ag_mgmt' },
        { icon:'🔐', label:'ユーザー・権限',       href:'coreto-user-mgmt-v2.html',       key:'user_mgmt',      iconKey:'users' },
      ],
    },
    {
      section: 'ツール',
      items: [
        { icon:'📚', label:'研修管理',             href:'coreto-training-mgmt-v2.html',   key:'training',       iconKey:'training' },
        { icon:'🔔', label:'通知・LINE連携',       href:'coreto-notification-v2.html',    key:'notification',   iconKey:'notification' },
        { icon:'⚙️', label:'システム設定',          href:'coreto-takken-v2.html',          key:'system',         iconKey:'settings' },
      ],
    },
  ],

  // ════════════════ RE-AG（不動産エージェント）════════════════
  // 主業務は不動産（賃貸・売買）。統合ページへ集約（~8項目）。
  re_ag: [
    {
      section: 'マイページ',
      items: [
        { icon:'🏠', label:'マイダッシュボード',    href:'coreto-hub-v2.html',             key:'dashboard',      iconKey:'home' },
      ],
    },
    {
      section: '不動産業務',
      items: [
        { icon:'📋', label:'担当案件',             href:'coreto-cases-v2.html',           key:'cases',           badge:0, iconKey:'cases' },
        { icon:'👥', label:'クライアント管理',     href:'coreto-crm-v2.html',             key:'crm',            iconKey:'crm' },
        { icon:'🏆', label:'成約報告',             href:'coreto-contract-report-v2.html', key:'contract_report', iconKey:'contract' },
      ],
    },
    {
      section: '報酬・支払い',
      items: [
        { icon:'💰', label:'報酬・支払い',         href:'coreto-payment-v2.html',         key:'payment',        iconKey:'payment' },
        { icon:'🔄', label:'PTマッチング',         href:'coreto-matching-v2.html',        key:'matching',       iconKey:'matching' },
      ],
    },
    {
      section: 'マイアカウント',
      items: [
        { icon:'⚙️', label:'マイアカウント',       href:'coreto-account-v2.html',         key:'my_account',     iconKey:'account' },
        { icon:'📖', label:'FAQ・マニュアル',     href:'coreto-faq-v2.html',             key:'faq',            iconKey:'faq' },
      ],
    },
  ],

  // ════════════════ HR-AG（人材エージェント）════════════════
  // 主業務は人材紹介。統合ページへ集約（~7項目）。
  hr_ag: [
    {
      section: 'マイページ',
      items: [
        { icon:'🏠', label:'マイダッシュボード',    href:'coreto-hub-v2.html',             key:'dashboard',      iconKey:'home' },
      ],
    },
    {
      section: '人材業務',
      items: [
        { icon:'📋', label:'担当案件',             href:'coreto-hr-matching-v2.html',     key:'hr_cases',       iconKey:'crm' },
        { icon:'👥', label:'クライアント管理',     href:'coreto-crm-v2.html',             key:'crm',            iconKey:'crm' },
        { icon:'🏆', label:'成約報告',             href:'coreto-contract-report-v2.html?biz=hr', key:'contract_report', iconKey:'contract' },
      ],
    },
    {
      section: '報酬・設定',
      items: [
        { icon:'💰', label:'報酬・支払い',         href:'coreto-payment-v2.html',         key:'payment',        iconKey:'payment' },
        { icon:'⚙️', label:'マイアカウント',       href:'coreto-account-v2.html',         key:'my_account',     iconKey:'account' },
        { icon:'📖', label:'FAQ・マニュアル',     href:'coreto-faq-v2.html',             key:'faq',            iconKey:'faq' },
      ],
    },
  ],

  // ════════════════ 光通信AG ════════════════
  // 主業務は光通信のみ（フルAG）。統合ページへ集約（~7項目）。
  hikari_ag: [
    {
      section: 'マイページ',
      items: [
        { icon:'🏠', label:'マイダッシュボード',    href:'coreto-hub-v2.html',             key:'dashboard',      iconKey:'home' },
      ],
    },
    {
      section: '光通信業務',
      items: [
        { icon:'⚡', label:'担当案件',             href:'coreto-utility-v2.html',         key:'utility',         badge:0, badgeColor:'gold', iconKey:'cases' },
        { icon:'👥', label:'クライアント管理',     href:'coreto-crm-v2.html',             key:'crm',            iconKey:'crm' },
        { icon:'🏆', label:'成約報告',             href:'coreto-contract-report-v2.html?biz=util', key:'contract_report', iconKey:'contract' },
      ],
    },
    {
      section: '報酬・設定',
      items: [
        { icon:'💰', label:'報酬・支払い',         href:'coreto-payment-v2.html',         key:'payment',        iconKey:'payment' },
        { icon:'⚙️', label:'マイアカウント',       href:'coreto-account-v2.html',         key:'my_account',     iconKey:'account' },
        { icon:'📖', label:'FAQ・マニュアル',     href:'coreto-faq-v2.html',             key:'faq',            iconKey:'faq' },
      ],
    },
  ],

  // ════════════════ PT（パートナー）════════════════
  // 紹介と進捗確認に特化。統合ページへ集約（4項目）。
  pt: [
    {
      section: 'ポータル',
      items: [
        { icon:'🏠', label:'PTポータル',           href:'coreto-pt-portal-v2.html',         key:'dashboard',   iconKey:'portal' },
        { icon:'📊', label:'紹介案件の進捗',       href:'coreto-matching-v2.html',          key:'progress',    iconKey:'progress' },
      ],
    },
    {
      section: '報酬・設定',
      items: [
        { icon:'💰', label:'報酬明細',             href:'coreto-payment-v2.html',           key:'payment',     iconKey:'payment' },
        { icon:'⚙️', label:'マイアカウント',       href:'coreto-account-v2.html',           key:'my_account',  iconKey:'account' },
      ],
    },
  ],

  // ════════════════ インターン ════════════════
  // 訪問活動と光通信リード投げに特化。シンプルに保つ。
  intern: [
    {
      section: '本日の業務',
      items: [
        { icon:'📊', label:'当日の実績',               href:'coreto-hub-v2.html',              key:'dashboard',   iconKey:'home' },
        { icon:'📍', label:'訪問記録・エリアマップ',   href:'coreto-intern-visit-v2.html',     key:'visit',       iconKey:'cases' },
        { icon:'⚡', label:'光通信リードを投稿する',   href:'coreto-intern-visit-v2.html#lead',key:'lead_submit', iconKey:'notification' },
      ],
    },
    {
      section: '個人',
      items: [
        { icon:'💴', label:'報酬確認',             href:'coreto-payment-v2.html',         key:'payment',     iconKey:'payment' },
        { icon:'🏆', label:'ランキング',           href:'coreto-intern-v2.html',          key:'rank',        iconKey:'progress' },
        { icon:'📚', label:'マニュアル・FAQ',     href:'coreto-faq-v2.html',             key:'faq',         iconKey:'faq' },
        { icon:'📲', label:'LINE再連携',           href:'coreto-hub-v2.html#line_relink', key:'line_relink', iconKey:'settings' },
      ],
    },
  ],
};

// USERSはsessionStorageから動的取得
function getUser(role) {
  var name   = sessionStorage.getItem('coreto_name')    || '—';
  var userId = sessionStorage.getItem('coreto_user_id') || '—';
  var rank   = sessionStorage.getItem('coreto_rank')    || '';
  var avMap  = { hq:'HQ', re_ag:'AG', hr_ag:'AG', hikari_ag:'AG', pt:'PT', intern:'IN' };
  var av     = avMap[role] || 'AG';
  var roleLabel = userId + (rank ? ' / ' + rank.charAt(0).toUpperCase() + rank.slice(1) : '');
  return { name: name, role: roleLabel, av: av };
}
const USERS = {
  hq:        { get name(){ return getUser('hq').name; },        get role(){ return getUser('hq').role; },        av:'HQ' },
  re_ag:     { get name(){ return getUser('re_ag').name; },     get role(){ return getUser('re_ag').role; },     av:'AG' },
  hr_ag:     { get name(){ return getUser('hr_ag').name; },     get role(){ return getUser('hr_ag').role; },     av:'AG' },
  hikari_ag: { get name(){ return getUser('hikari_ag').name; }, get role(){ return getUser('hikari_ag').role; }, av:'AG' },
  pt:        { get name(){ return getUser('pt').name; },        get role(){ return getUser('pt').role; },        av:'PT' },
  intern:    { get name(){ return getUser('intern').name; },    get role(){ return getUser('intern').role; },    av:'IN' },
};

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
      <div style="font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#5F6368;margin-bottom:10px">表示設定</div>
      <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:20px">
        <label style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:#F8F9FA;border-radius:8px;cursor:pointer;font-size:13px;color:#202124">
          デスクトップ通知
          <input type="checkbox" checked style="accent-color:#0D1A2D;width:14px;height:14px">
        </label>
        <label style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:#F8F9FA;border-radius:8px;cursor:pointer;font-size:13px;color:#80868B">
          ダークモード（開発中）
          <input type="checkbox" disabled style="width:14px;height:14px">
        </label>
      </div>
      <div style="font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#5F6368;margin-bottom:10px">アカウント</div>
      <div style="display:flex;flex-direction:column;gap:8px">
        <div style="padding:10px 14px;background:#F8F9FA;border-radius:8px;display:flex;justify-content:space-between;font-size:13px">
          <span style="color:#5F6368">ログイン中</span>
          <span style="font-weight:600;color:#202124">${user.name}</span>
        </div>
        <div style="padding:10px 14px;background:#F8F9FA;border-radius:8px;display:flex;justify-content:space-between;font-size:13px">
          <span style="color:#5F6368">バージョン</span>
          <span style="font-family:'DM Mono',monospace;color:#80868B">COREBLDG v2.0</span>
        </div>
      </div>
    </div>
    <div style="padding:0 22px 22px;display:flex;gap:8px">
      <button id="cnav-s-btn-close" style="flex:1;padding:11px;background:#F8F9FA;border:1px solid #E8EAED;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;color:#5F6368">閉じる</button>
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
  // 全セッション情報をクリア（残-2修正）
  ['coreto_role','coreto_user_id','coreto_name','coreto_rank','coreto_balance','coreto_hq_role'].forEach(function(k) {
    sessionStorage.removeItem(k);
  });
  window.location.href = 'coreto-hub-v2.html';
}

function renderFooter() {
  const sbNav = document.getElementById('sb-nav');
  if (!sbNav) return;
  const nav = sbNav.closest('nav') || sbNav.parentElement;
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

function init(activeKey) {
  injectCSS();
  const role = sessionStorage.getItem('coreto_role') || 'hq';
  const user = USERS[role] || USERS.hq;
  const sections = NAV[role] || NAV.hq;
  // サイドバーユーザー情報を設定（全ページ統一）
  const avEl = document.getElementById('sb-av');
  if (avEl) avEl.textContent = user.av;
  const nameEl = document.getElementById('sb-name');
  if (nameEl) nameEl.textContent = user.name;
  const roleEl = document.getElementById('sb-role');
  if (roleEl) roleEl.textContent = user.role;
  const navEl = document.getElementById('sb-nav');
  if (!navEl) return;
  navEl.innerHTML = sections.map(function(sec, sectionIndex) {
    return '<div class="cnav-section" onclick="CNAV.toggleSection(\'' + sectionIndex + '\')" data-section="' + sectionIndex + '">' +
      '<div class="cnav-section-label">' + sec.section + '</div>' +
    '</div>' +
    '<div class="cnav-section-items" id="cnav-sec-' + sectionIndex + '">' +
      sec.items.map(function(item) {
        var isActive = item.key === activeKey;
        var badgeCls = item.badgeColor === 'amber' ? 'amber'
                     : item.badgeColor === 'gold'  ? 'gold' : '';
        return '<a href="' + item.href + '" class="cnav-item' + (isActive ? ' active' : '') + '" data-key="' + (item.key || '') + '">' +
          '<span class="cnav-icon">' + (typeof icon === 'function' && item.iconKey ? icon(item.iconKey, 16) : (item.icon || '')) + '</span>' +
          '<div class="cnav-label">' + item.label + '</div>' +
          (item.note ? '<div class="cnav-note">' + item.note + '</div>' : '') +
          '<div class="cnav-badge ' + badgeCls + '"' + (item.badge ? '' : ' style="display:none"') + '>' + (item.badge || '') + '</div>' +
        '</a>';
      }).join('') +
    '</div>';
  }).join('');

  // Restore collapsed state
  try {
    var colRole = sessionStorage.getItem('coreto_role') || '';
    var colKey = 'CORETO_NAV_COLLAPSED_' + colRole;
    var colState = JSON.parse(localStorage.getItem(colKey) || '{}');
    Object.keys(colState).forEach(function(idx) {
      if (colState[idx]) {
        var el = document.getElementById('cnav-sec-' + idx);
        var hdr = document.querySelector('[data-section="' + idx + '"]');
        if (el) el.classList.add('collapsed');
        if (hdr) hdr.classList.add('collapsed');
      }
    });
  } catch(e){}

  // Store sections for Command Palette
  window._cnavSections = sections;

  // Record current page as recent
  try {
    var recent = JSON.parse(localStorage.getItem('CORETO_RECENT_PAGES') || '[]');
    var currentItem = null;
    sections.forEach(function(sec) {
      if (sec.items) sec.items.forEach(function(item) {
        if (item.key === activeKey) currentItem = item;
      });
    });
    if (currentItem) {
      recent = recent.filter(function(r) { return r.href !== currentItem.href; });
      recent.unshift({ label: currentItem.label, href: currentItem.href, iconKey: currentItem.iconKey });
      if (recent.length > 10) recent = recent.slice(0, 10);
      localStorage.setItem('CORETO_RECENT_PAGES', JSON.stringify(recent));
    }
  } catch(e){}

  renderFooter();
  // 残-10: ナビ描画後にlocalStorageからバッジを動的更新
  setTimeout(updateNavBadges, 50);
  const legacyFooter = navEl.closest('nav')
    ? navEl.closest('nav').querySelector('[class*="footer"]:not(.cnav-footer)')
    : null;
  if (legacyFooter) legacyFooter.style.display = 'none';

  // Mobile menu button
  var menuBtn = document.createElement('button');
  menuBtn.className = 'sb-menu-btn';
  menuBtn.innerHTML = '☰';
  menuBtn.onclick = function() {
    var sb = document.querySelector('.sb');
    var ov = document.querySelector('.sb-overlay');
    if (sb) sb.classList.toggle('open');
    if (ov) ov.classList.toggle('show');
  };
  document.body.appendChild(menuBtn);

  var overlay = document.createElement('div');
  overlay.className = 'sb-overlay';
  overlay.onclick = function() {
    document.querySelector('.sb')?.classList.remove('open');
    this.classList.remove('show');
  };
  document.body.appendChild(overlay);

  // Breadcrumb
  if (activeKey && activeKey !== 'dashboard') {
    var bcSection = '';
    var bcPage = '';
    var navItems = sections;
    for (var si = 0; si < navItems.length; si++) {
      var sec = navItems[si];
      if (sec.items) {
        for (var ii = 0; ii < sec.items.length; ii++) {
          if (sec.items[ii].key === activeKey) {
            bcSection = sec.section;
            bcPage = sec.items[ii].label;
            break;
          }
        }
      }
      if (bcPage) break;
    }
    if (bcPage) {
      var bcEl = document.createElement('nav');
      bcEl.className = 'breadcrumb';
      bcEl.setAttribute('aria-label', 'パンくず');
      bcEl.innerHTML = '<a href="coreto-hub-v2.html" class="bc-item">🏠</a><span class="bc-sep">›</span>' +
        (bcSection ? '<span class="bc-item">' + bcSection + '</span><span class="bc-sep">›</span>' : '') +
        '<span class="bc-item bc-current">' + bcPage + '</span>';
      var content = document.querySelector('.content') || document.querySelector('.shell-content') || document.querySelector('.main');
      if (content) {
        var topbar = content.querySelector('.topbar');
        if (topbar) topbar.parentNode.insertBefore(bcEl, topbar);
        else content.insertBefore(bcEl, content.firstChild);
      }
    }
  }
}

function session() {
  const role = sessionStorage.getItem('coreto_role') || null;
  if (!role) return null;
  // #2修正: sessionStorageから実際のログインユーザー情報を取得
  const name   = sessionStorage.getItem('coreto_name')    || role;
  const userId = sessionStorage.getItem('coreto_user_id') || role;
  const rank   = sessionStorage.getItem('coreto_rank')    || null;
  return { name, type: role, userId, rank };
}

function toggleSection(idx) {
  var el = document.getElementById('cnav-sec-' + idx);
  var hdr = document.querySelector('[data-section="' + idx + '"]');
  if (!el) return;
  el.classList.toggle('collapsed');
  if (hdr) hdr.classList.toggle('collapsed');
  try {
    var role = sessionStorage.getItem('coreto_role') || '';
    var key = 'CORETO_NAV_COLLAPSED_' + role;
    var state = JSON.parse(localStorage.getItem(key) || '{}');
    state[idx] = el.classList.contains('collapsed');
    localStorage.setItem(key, JSON.stringify(state));
  } catch(e){}
}

return { init, openSettings, closeSettings, logout, session, updateBadges: updateNavBadges, toggleSection };
})();

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Command Palette (Cmd+K / Ctrl+K)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
var _cmdOpen = false;
var _cmdItems = [];
var _cmdSelected = 0;

function openCommandPalette() {
  if (_cmdOpen) return;
  _cmdOpen = true;

  var overlay = document.createElement('div');
  overlay.className = 'cmd-overlay';
  overlay.id = 'cmd-overlay';
  overlay.onclick = function(e) { if (e.target === overlay) closeCommandPalette(); };
  overlay.innerHTML =
    '<div class="cmd-palette">' +
      '<div class="cmd-input-wrap">' +
        (typeof icon === 'function' ? icon('search', 18) : '🔍') +
        '<input class="cmd-input" id="cmd-input" placeholder="ページ名を検索..." autofocus>' +
      '</div>' +
      '<div class="cmd-results" id="cmd-results"></div>' +
      '<div class="cmd-footer"><span><span class="cmd-key">↑↓</span> 移動</span><span><span class="cmd-key">Enter</span> 開く</span><span><span class="cmd-key">Esc</span> 閉じる</span></div>' +
    '</div>';
  document.body.appendChild(overlay);

  var input = document.getElementById('cmd-input');
  input.addEventListener('input', function() { filterCommandResults(this.value); });
  input.addEventListener('keydown', function(e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); _cmdSelected = Math.min(_cmdSelected + 1, _cmdItems.length - 1); highlightCmd(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); _cmdSelected = Math.max(_cmdSelected - 1, 0); highlightCmd(); }
    if (e.key === 'Enter') { e.preventDefault(); execCmd(); }
    if (e.key === 'Escape') { closeCommandPalette(); }
  });

  filterCommandResults('');
  setTimeout(function() { input.focus(); }, 50);
}

function closeCommandPalette() {
  _cmdOpen = false;
  var ov = document.getElementById('cmd-overlay');
  if (ov) ov.remove();
}

function filterCommandResults(query) {
  var results = document.getElementById('cmd-results');
  if (!results) return;

  var allItems = [];
  if (window._cnavSections) {
    window._cnavSections.forEach(function(sec) {
      if (sec.items) {
        sec.items.forEach(function(item) {
          allItems.push({ label: item.label, href: item.href, section: sec.section, iconKey: item.iconKey });
        });
      }
    });
  }

  var recent = [];
  try { recent = JSON.parse(localStorage.getItem('CORETO_RECENT_PAGES') || '[]'); } catch(e){}

  var q = query.toLowerCase().trim();
  var filtered;
  if (!q) {
    var recentSet = {};
    recent.forEach(function(r){ recentSet[r.href] = true; });
    var recentItems = recent.slice(0, 5).map(function(r) { return { label: r.label, href: r.href, section: '最近のページ', iconKey: r.iconKey }; });
    filtered = recentItems.concat(allItems.filter(function(i) { return !recentSet[i.href]; }));
  } else {
    filtered = allItems.filter(function(i) {
      return i.label.toLowerCase().indexOf(q) !== -1 || (i.section && i.section.toLowerCase().indexOf(q) !== -1);
    });
  }

  _cmdItems = filtered;
  _cmdSelected = 0;

  if (filtered.length === 0) {
    results.innerHTML = '<div class="cmd-empty">該当するページがありません</div>';
    return;
  }

  results.innerHTML = filtered.map(function(item, idx) {
    return '<div class="cmd-item' + (idx === 0 ? ' selected' : '') + '" data-idx="' + idx + '" onclick="execCmd(' + idx + ')" onmouseenter="_cmdSelected=' + idx + ';highlightCmd()">' +
      '<span style="width:18px;height:18px;display:flex;align-items:center;color:#6B7280">' + (typeof icon === 'function' && item.iconKey ? icon(item.iconKey, 16) : '') + '</span>' +
      '<span class="cmd-item-label">' + item.label + '</span>' +
      '<span class="cmd-item-section">' + (item.section || '') + '</span>' +
    '</div>';
  }).join('');
}

function highlightCmd() {
  var items = document.querySelectorAll('.cmd-item');
  for (var i = 0; i < items.length; i++) {
    if (i === _cmdSelected) items[i].classList.add('selected');
    else items[i].classList.remove('selected');
  }
}

function execCmd(idx) {
  if (idx !== undefined) _cmdSelected = idx;
  var item = _cmdItems[_cmdSelected];
  if (!item) return;
  try {
    var recent = JSON.parse(localStorage.getItem('CORETO_RECENT_PAGES') || '[]');
    recent = recent.filter(function(r) { return r.href !== item.href; });
    recent.unshift({ label: item.label, href: item.href, iconKey: item.iconKey });
    if (recent.length > 10) recent = recent.slice(0, 10);
    localStorage.setItem('CORETO_RECENT_PAGES', JSON.stringify(recent));
  } catch(e){}
  closeCommandPalette();
  window.location.href = item.href;
}

document.addEventListener('keydown', function(e) {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault();
    if (_cmdOpen) closeCommandPalette();
    else openCommandPalette();
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 残-6: confirm()代替 — ネイティブダイアログの排除
// 使い方: showConfirm('タイトル', '本文', () => { 実行処理 })
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function showConfirm(title, body, onOk, opts) {
  opts = opts || {};
  var okLabel   = opts.okLabel   || '実行する';
  var okStyle   = opts.danger    ? 'background:#DC2626;color:#fff;border:none' : 'background:#0D1A2D;color:#C8A951;border:none';
  var cancelLabel = opts.cancelLabel || 'キャンセル';
  var overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(2px)';
  overlay.innerHTML =
    '<div style="background:#fff;border-radius:12px;width:100%;max-width:420px;padding:24px;box-shadow:0 20px 60px rgba(0,0,0,.2);font-family:Outfit,sans-serif">' +
      '<div style="font-size:15px;font-weight:700;color:#0D1A2D;margin-bottom:10px">' + title + '</div>' +
      '<div style="font-size:12px;color:#5F6368;line-height:1.8;margin-bottom:20px;white-space:pre-wrap">' + body + '</div>' +
      '<div style="display:flex;gap:10px;justify-content:flex-end">' +
        '<button id="sc-cancel" style="padding:9px 20px;background:transparent;border:1.5px solid #E8EAED;border-radius:8px;cursor:pointer;font-family:Outfit,sans-serif;font-size:13px">' + cancelLabel + '</button>' +
        '<button id="sc-ok" style="padding:9px 22px;border-radius:8px;font-weight:700;cursor:pointer;font-family:Outfit,sans-serif;font-size:13px;' + okStyle + '">' + okLabel + '</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(overlay);
  overlay.querySelector('#sc-cancel').onclick = function() { overlay.remove(); };
  overlay.querySelector('#sc-ok').onclick = function() { overlay.remove(); if(onOk) onOk(); };
  overlay.onclick = function(e) { if(e.target===overlay) overlay.remove(); };
  setTimeout(function(){ overlay.querySelector('#sc-ok').focus(); }, 50);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 残-6: coretoConfirm — confirm()の代替モーダル
// 使い方: coretoConfirm({ title, message, detail, okLabel, danger, onOk })
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function coretoConfirm(opts) {
  var existing = document.getElementById('coreto-confirm-overlay');
  if (existing) existing.remove();

  var overlay = document.createElement('div');
  overlay.id = 'coreto-confirm-overlay';
  overlay.innerHTML =
    '<div id="coreto-confirm-box">' +
      '<div id="coreto-confirm-header">' +
        '<div id="coreto-confirm-title">' + (opts.title || '確認') + '</div>' +
      '</div>' +
      '<div id="coreto-confirm-body">' +
        '<div>' + (opts.message || '実行しますか？') + '</div>' +
        (opts.detail ? '<div id="coreto-confirm-detail">' + opts.detail + '</div>' : '') +
      '</div>' +
      '<div id="coreto-confirm-actions">' +
        '<button id="coreto-confirm-cancel">キャンセル</button>' +
        '<button id="coreto-confirm-ok' + (opts.danger ? '" class="danger"' : '"') + '>' + (opts.okLabel || '実行する') + '</button>' +
      '</div>' +
    '</div>';

  document.body.appendChild(overlay);

  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) overlay.remove();
  });
  document.getElementById('coreto-confirm-cancel').addEventListener('click', function() {
    overlay.remove();
    if (opts.onCancel) opts.onCancel();
  });
  document.getElementById('coreto-confirm-ok').addEventListener('click', function() {
    overlay.remove();
    if (opts.onOk) opts.onOk();
  });

  // フォーカス
  setTimeout(function() {
    var okBtn = document.getElementById('coreto-confirm-ok');
    if (okBtn) okBtn.focus();
  }, 50);
}

// CNAV に公開
if (typeof CNAV !== 'undefined') CNAV.confirm = coretoConfirm;


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 残-10: ナビバッジをlocalStorageから動的計算
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function updateNavBadges() {
  try {
    var reports  = JSON.parse(localStorage.getItem('CORETO_REPORTS')  || '[]');
    var hqTasks  = JSON.parse(localStorage.getItem('CORETO_HQ_TASKS') || '[]');
    var myId     = sessionStorage.getItem('coreto_user_id') || '';
    var myRole   = sessionStorage.getItem('coreto_role')    || 'hq';
    var isHQ     = myRole === 'hq';
    var isPT     = myRole === 'pt';
    var isIntern = myRole === 'intern';

    // ── ロール別フィルタ ──
    var myReports;
    if (isHQ) {
      myReports = reports;
    } else if (isPT) {
      // PTは自分が紹介した案件（ptId === myId）
      myReports = reports.filter(function(r){ return r.ptId === myId; });
    } else {
      // AG・インターン
      myReports = reports.filter(function(r){ return !r.agId || r.agId === myId; });
    }

    // ── 進行中案件（承認待ち・未承認）──
    var activeCases   = myReports.filter(function(r){ return r.status !== '承認済み'; });
    var reActive      = activeCases.filter(function(r){ return r.type === '賃貸' || r.type === '売買'; });
    var hrActive      = activeCases.filter(function(r){ return r.type === '人材'; });
    var utilActive    = activeCases.filter(function(r){ return r.type === '光通信'; });

    // HQ承認待ち
    var pendingApproval = reports.filter(function(r){ return r.status === '承認待ち'; });
    // 即時払い申請待ち
    var pendingInstant  = localStorage.getItem('CORETO_INSTANT_PAY_PENDING') ? 1 : 0;
    // IT重説待ち
    var itsetsuPending  = reports.filter(function(r){
      return r.status === 'IT重説待ち' || (r.itsetsuStatus && r.itsetsuStatus === 'pending');
    });
    // 書類審査待ち
    var screeningPending = reports.filter(function(r){
      return r.status === '書類審査中' || r.status === '書類待ち';
    });

    // PT向け: 紹介中の全案件数
    var ptActiveRe   = reActive.length;
    var ptActiveHR   = hrActive.length;
    var ptActiveUtil = utilActive.length;
    var ptTotal      = activeCases.length;

    // ── バッジ定義（key → count） ──
    var badges = {
      // HQ
      'cases':        isHQ ? reports.filter(function(r){return r.type!=='光通信'&&r.type!=='人材';}).length : reActive.length,
      'hr_cases_all': isHQ ? reports.filter(function(r){return r.type==='人材';}).length : hrActive.length,
      'utility':      isHQ ? reports.filter(function(r){return r.type==='光通信';}).length : utilActive.length,
      'screening':    screeningPending.length,
      'itsetsu':      itsetsuPending.length,
      'itsetsu_booking': itsetsuPending.length,
      'remit':        pendingApproval.length,
      'instant_pay':  pendingInstant,
      'matching':     reports.filter(function(r){return r.ptId && r.status === '承認待ち';}).length,
      // AG個別
      're_cases':     reActive.length,
      'hr_matching':  hrActive.length,
      'hr_cases':     hrActive.length,
      'util_cases':   utilActive.length,
      // PT向け（紹介中案件数）
      'progress':     isPT ? ptTotal : undefined,
      're_refer':     isPT ? ptActiveRe   : undefined,
      'hr_refer':     isPT ? ptActiveHR   : undefined,
      'util_submit':  isPT ? ptActiveUtil : undefined,
    };

    // ── DOM更新 ──
    document.querySelectorAll('.cnav-item[data-key]').forEach(function(item) {
      var key   = item.dataset.key;
      var badge = item.querySelector('.cnav-badge');
      if (!badge) return;
      var count = badges[key];
      if (count === undefined) return;
      if (!count || count === 0) {
        // 'NEW'バッジはそのまま維持
        if (badge.textContent === 'NEW') return;
        badge.style.display = 'none';
      } else {
        badge.textContent = count;
        badge.style.display = '';
      }
    });
  } catch(e) { console.warn('updateNavBadges:', e); }

}

// CNAV.init後にバッジ更新
var _originalInit = (typeof CNAV !== 'undefined' && CNAV.init) ? CNAV.init : null;
