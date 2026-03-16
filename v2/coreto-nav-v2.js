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
  // HQは全業務を監督・管理する立場。ドメイン別に業務フローで並べる。
  hq: [
    {
      section: '概要',
      items: [
        { icon:'🏠', label:'HQダッシュボード',    href:'coreto-hub-v2.html',             key:'dashboard'       },
        { icon:'📊', label:'経営ダッシュボード',   href:'coreto-dashboard-exec-v2.html',  key:'exec_dashboard'  },
        { icon:'📈', label:'案件パイプライン',     href:'coreto-pipeline-v2.html',        key:'pipeline'        },
      ],
    },
    {
      // 不動産業務：案件受付 → 書類審査 → IT重説 → 初期費用確認 → 成約報告
      section: '不動産業務',
      items: [
        { icon:'🏘️', label:'不動産案件（全体）',  href:'coreto-cases-v2.html',           key:'cases',           badge:'8'           },
        { icon:'🏠', label:'内見管理（全体）',     href:'coreto-showing-v2.html',         key:'showing_hq'      },
        { icon:'📋', label:'申込書類管理',     href:'coreto-screening-v2.html',       key:'screening',       badge:'5', badgeColor:'amber' },
        { icon:'🔑', label:'IT重説管理（全体）',   href:'coreto-itsetsu-v2.html',         key:'itsetsu',         badge:'2', badgeColor:'amber' },
        { icon:'🏦', label:'初期費用明細チェック', href:'coreto-invoice-check-v2.html',   key:'invoice_check'   },
        { icon:'📷', label:'バーコードスキャン',   href:'coreto-barcode-scan-v2.html',    key:'barcode_scan'    },
        { icon:'📝', label:'成約報告一覧',         href:'coreto-contract-report-v2.html', key:'contract_report' },
        { icon:'⚖️', label:'士業連携管理',         href:'coreto-judicial-v2.html',        key:'judicial'        },
      ],
    },
    {
      // 人材業務：案件受付 → マッチング → 成約
      section: '人材業務',
      items: [
        { icon:'👤', label:'人材案件（全体）',     href:'coreto-hr-matching-v2.html',     key:'hr_cases_all',    badge:'4'           },
        { icon:'🔗', label:'PTマッチング',         href:'coreto-matching-v2.html',        key:'matching',        badge:'3', badgeColor:'red' },
      ],
    },
    {
      // 光通信業務：SFA管理のみ（案件はAGが入力）
      section: '光通信業務',
      items: [
        { icon:'⚡', label:'光通信SFA（全体）',    href:'coreto-utility-v2.html',         key:'utility'         },
      ],
    },
    {
      // CRM：全ドメイン共通のクライアント管理
      section: 'CRM・クライアント',
      items: [
        { icon:'👥', label:'クライアント管理',     href:'coreto-crm-v2.html',             key:'crm'             },
        { icon:'⚠️', label:'HR早期退職（返金管理）',href:'coreto-early-quit-v2.html',      key:'early_quit'      },
      ],
    },
    {
      // 財務・入金：入金確認 → 即時払い審査 → 月次報酬 → 締め → CSV出力
      section: '財務・入金',
      items: [
        { icon:'💰', label:'入金監視',             href:'coreto-remittance-v2.html',      key:'remit',           badge:'3', badgeColor:'amber' },
        { icon:'⚡', label:'即時払い審査',          href:'coreto-instant-pay-v2.html',     key:'instant_pay',     badge:'1', badgeColor:'amber' },
        { icon:'💴', label:'月次報酬確定・振込',   href:'coreto-payroll-v2.html',         key:'payroll'         },
        { icon:'🏦', label:'月次締め・全銀出力',   href:'coreto-batch-close-v2.html',     key:'batch_close'     },
        { icon:'📋', label:'月次報酬レポート',     href:'coreto-monthly-report-v2.html',  key:'monthly_report'  },
        { icon:'🧾', label:'請求書・領収書発行',   href:'coreto-hq-receipt-v2.html',      key:'receipt'         },
      ],
    },
    {
      // スタッフ・採用：採用から入会・育成まで
      section: 'スタッフ・採用',
      items: [
        { icon:'📝', label:'応募者管理',           href:'coreto-applicants-v2.html',      key:'applicants'      },
        { icon:'🔗', label:'リクルートリンク発行', href:'coreto-recruit-link-v2.html',    key:'recruit_link'    },
        { icon:'🎫', label:'特別紹介コード管理',     href:'coreto-special-code-v2.html',    key:'special_code'    },
        { icon:'📨', label:'AG招待・新規登録',     href:'coreto-agent-signup-v2.html',    key:'agent_invite'    },
        { icon:'📨', label:'PT招待・新規登録',     href:'coreto-partner-signup-v2.html',  key:'pt_invite'       },
        { icon:'🎓', label:'インターン管理',       href:'coreto-intern-v2.html',          key:'intern'          },
        { icon:'📍', label:'訪問記録・エリアマップ', href:'coreto-intern-visit-v2.html',   key:'intern_visit'    },
        { icon:'📉', label:'AG離脱リスク管理',     href:'coreto-agent-retention-v2.html', key:'agent_retention' },
        { icon:'🏅', label:'AGランクダッシュボード',  href:'coreto-rank-dashboard-v2.html',  key:'rank_dashboard'  },
        { icon:'🌐', label:'紹介ネットワーク図',   href:'coreto-network-v2.html',         key:'network'         },
        { icon:'🏢', label:'ユーザー・権限管理',   href:'coreto-user-mgmt-v2.html',       key:'hq_mgmt'         },
        { icon:'🆕', label:'HQメンバー招待・登録',  href:'coreto-hq-onboarding-v2.html',   key:'hq_onboarding'   },
      ],
    },
    {
      // 通知・連携：LINE・通知系をまとめる
      section: '通知・連携',
      items: [
        { icon:'📲', label:'LINE認証管理',         href:'coreto-line-auth-v2.html',       key:'line_auth'       },
        { icon:'🤖', label:'LINE AIチャット管理',  href:'coreto-line-ai-v2.html',         key:'line_ai'         },
        { icon:'🔔', label:'通知ログ',             href:'coreto-notification-v2.html',    key:'notif'           },
      ],
    },
    {
      // システム：管理者のみが触る設定系
      section: 'システム',
      items: [
        { icon:'🔐', label:'ID・アカウント管理',   href:'coreto-id-manager-v2.html',      key:'id_manager'      },
        { icon:'🛡️', label:'権限マトリクス',       href:'coreto-admin-rbac-v2.html',      key:'rbac'            },
        { icon:'🏛️', label:'宅建業者登録管理',    href:'coreto-takken-v2.html',          key:'takken'          },
        { icon:'📚', label:'研修コンテンツ管理',   href:'coreto-training-mgmt-v2.html',   key:'onboard_mgmt'    },
      ],
    },
  ],

  // ════════════════ RE-AG（不動産エージェント）════════════════
  // 主業務は不動産（賃貸・売買）。光通信もAG権限あり。人材はPT扱い。
  re_ag: [
    {
      section: 'マイページ',
      items: [
        { icon:'🏠', label:'ダッシュボード',       href:'coreto-hub-v2.html',             key:'dashboard'       },
        { icon:'🏅', label:'ランク・コミッション', href:'coreto-rank-v2.html',            key:'rank'            },
        { icon:'💴', label:'報酬明細',             href:'coreto-payment-v2.html',         key:'payment'         },
      ],
    },
    {
      // 不動産AG業務：案件受付から成約・入金まで一連のフロー
      section: '不動産業務（AG権限）',
      items: [
        { icon:'🏘️', label:'担当案件一覧',         href:'coreto-cases-v2.html',           key:'cases',          badge:'4'            },
        { icon:'👥', label:'クライアント管理',     href:'coreto-crm-v2.html',             key:'crm'             },
        { icon:'🏠', label:'内見管理',             href:'coreto-showing-v2.html',         key:'showing'         },
        { icon:'📋', label:'申込書類管理',         href:'coreto-screening-v2.html',       key:'screening'       },
        { icon:'🔑', label:'IT重説を予約する',     href:'coreto-itsetsu-booking-v2.html', key:'itsetsu_booking' },
        { icon:'🏆', label:'賃貸 成約報告',        href:'coreto-contract-report-v2.html', key:'contract_report' },
        { icon:'🏢', label:'売買・三為 成約報告',  href:'coreto-sale-report-v2.html',     key:'sale_report'     },
      ],
    },
    {
      section: '入金・支払い',
      items: [
        { icon:'💰', label:'入金確認',             href:'coreto-remittance-v2.html',      key:'remit'           },
        { icon:'⚡', label:'即時払い申請',          href:'coreto-instant-pay-v2.html',     key:'instant_pay'     },
      ],
    },
    {
      // 光通信：RE-AGもAG権限で案件入力・成約報告が可能
      section: '光通信業務（AG権限）',
      items: [
        { icon:'⚡', label:'担当案件（光通信）',   href:'coreto-utility-v2.html',         key:'utility',         badge:'2', badgeColor:'gold' },
      ],
    },
    {
      // 人材：RE-AGはPT扱い（紹介投げと進捗確認のみ）
      section: '人材紹介（閲覧のみ）',
      items: [
        { icon:'🔒', label:'人材紹介 進捗確認',   href:'coreto-pt-portal-v2.html#hr',    key:'hr_ref',          note:'PT扱い'        },
      ],
    },
    {
      // 採用：自分のリクルートリンクで仲間を増やす
      section: '採用',
      items: [
        { icon:'🔗', label:'リクルートリンク発行', href:'coreto-recruit-link-v2.html',    key:'recruit_link'    },
        { icon:'🎫', label:'特別紹介コード管理',     href:'coreto-special-code-v2.html',    key:'special_code'    },
      ],
    },
    {
      section: 'マイアカウント',
      items: [
        { icon:'⚙️', label:'アカウント設定',       href:'coreto-account-v2.html',         key:'account'         },
        { icon:'📃', label:'業務委託契約書',       href:'coreto-contract-v2.html',        key:'contract'        },
        { icon:'🪪', label:'eKYC・口座登録',       href:'coreto-kyc-v2.html',             key:'kyc'             },
        { icon:'📚', label:'マニュアル・FAQ',     href:'coreto-faq-v2.html',             key:'faq'             },
        { icon:'📲', label:'LINE再連携',           href:'coreto-hub-v2.html#line_relink', key:'line_relink'     },
        { icon:'🎓', label:'オンボーディング',     href:'coreto-onboarding-v2.html',      key:'onboarding'      },
      ],
    },
  ],

  // ════════════════ HR-AG（人材エージェント）════════════════
  // 主業務は人材紹介。光通信もAG権限あり。不動産はPT扱い。
  hr_ag: [
    {
      section: 'マイページ',
      items: [
        { icon:'🏠', label:'ダッシュボード',       href:'coreto-hub-v2.html',             key:'dashboard'       },
        { icon:'🏅', label:'ランク・コミッション', href:'coreto-rank-v2.html',            key:'rank'            },
        { icon:'💴', label:'報酬明細',             href:'coreto-payment-v2.html',         key:'payment'         },
      ],
    },
    {
      // 人材AG業務：求人受付・候補者マッチング（成約報告は案件フロー内）
      section: '人材業務（AG権限）',
      items: [
        { icon:'👤', label:'担当案件一覧',         href:'coreto-hr-matching-v2.html',     key:'hr_matching',     badge:'3', badgeColor:'amber' },
        { icon:'👥', label:'クライアント管理',     href:'coreto-crm-v2.html',             key:'crm'             },
        { icon:'🏆', label:'成約報告（人材）',      href:'coreto-contract-report-v2.html?biz=hr', key:'contract_report' },
      ],
    },
    {
      section: '入金・支払い',
      items: [
        { icon:'⚡', label:'即時払い申請',          href:'coreto-instant-pay-v2.html',     key:'instant_pay'     },
      ],
    },
    {
      // 光通信：HR-AGもAG権限で案件入力が可能
      section: '光通信業務（AG権限）',
      items: [
        { icon:'⚡', label:'担当案件（光通信）',   href:'coreto-utility-v2.html',         key:'utility',         badge:'1', badgeColor:'gold' },
      ],
    },
    {
      // 不動産：HR-AGはPT扱い（紹介投げと進捗確認のみ）
      section: '不動産紹介（閲覧のみ）',
      items: [
        { icon:'🔒', label:'不動産紹介 進捗確認', href:'coreto-pt-portal-v2.html#re',    key:'re_ref',          note:'PT扱い'        },
      ],
    },
    {
      section: '採用',
      items: [
        { icon:'🔗', label:'リクルートリンク発行', href:'coreto-recruit-link-v2.html',    key:'recruit_link'    },
        { icon:'🎫', label:'特別紹介コード管理',     href:'coreto-special-code-v2.html',    key:'special_code'    },
      ],
    },
    {
      section: 'マイアカウント',
      items: [
        { icon:'⚙️', label:'アカウント設定',       href:'coreto-account-v2.html',         key:'account'         },
        { icon:'📃', label:'業務委託契約書',       href:'coreto-contract-v2.html',        key:'contract'        },
        { icon:'🪪', label:'eKYC・口座登録',       href:'coreto-kyc-v2.html',             key:'kyc'             },
        { icon:'📚', label:'マニュアル・FAQ',     href:'coreto-faq-v2.html',             key:'faq'             },
        { icon:'📲', label:'LINE再連携',           href:'coreto-hub-v2.html#line_relink', key:'line_relink'     },
        { icon:'🎓', label:'オンボーディング',     href:'coreto-onboarding-v2.html',      key:'onboarding'      },
      ],
    },
  ],

  // ════════════════ 光通信AG ════════════════
  // 主業務は光通信のみ（フルAG）。不動産・人材は両方PT扱い。
  hikari_ag: [
    {
      section: 'マイページ',
      items: [
        { icon:'🏠', label:'ダッシュボード',       href:'coreto-hub-v2.html',             key:'dashboard'       },
        { icon:'🏅', label:'ランク・コミッション', href:'coreto-rank-v2.html',            key:'rank'            },
        { icon:'💴', label:'報酬明細',             href:'coreto-payment-v2.html',         key:'payment'         },
      ],
    },
    {
      // 光通信AG業務：案件入力・フォロー（成約報告は案件フロー内）
      section: '光通信業務（AG権限）',
      items: [
        { icon:'⚡', label:'担当案件一覧',         href:'coreto-utility-v2.html',         key:'utility',         badge:'3', badgeColor:'gold' },
        { icon:'👥', label:'クライアント管理',     href:'coreto-crm-v2.html',             key:'crm'             },
        { icon:'🏆', label:'成約報告（光通信）',    href:'coreto-contract-report-v2.html?biz=util', key:'contract_report' },
      ],
    },
    {
      section: '入金・支払い',
      items: [
        { icon:'⚡', label:'即時払い申請',          href:'coreto-instant-pay-v2.html',     key:'instant_pay'     },
      ],
    },
    {
      // 不動産・人材はPT扱い（紹介して進捗を見るだけ）
      section: '他事業への紹介（閲覧のみ）',
      items: [
        { icon:'🔒', label:'不動産紹介 進捗確認', href:'coreto-pt-portal-v2.html#re',    key:'re_ref',          note:'PT扱い'        },
        { icon:'🔒', label:'人材紹介 進捗確認',   href:'coreto-pt-portal-v2.html#hr',    key:'hr_ref',          note:'PT扱い'        },
      ],
    },
    {
      section: '採用',
      items: [
        { icon:'🔗', label:'リクルートリンク発行', href:'coreto-recruit-link-v2.html',    key:'recruit_link'    },
        { icon:'🎫', label:'特別紹介コード管理',     href:'coreto-special-code-v2.html',    key:'special_code'    },
      ],
    },
    {
      section: 'マイアカウント',
      items: [
        { icon:'⚙️', label:'アカウント設定',       href:'coreto-account-v2.html',         key:'account'         },
        { icon:'📃', label:'業務委託契約書',       href:'coreto-contract-v2.html',        key:'contract'        },
        { icon:'🪪', label:'eKYC・口座登録',       href:'coreto-kyc-v2.html',             key:'kyc'             },
        { icon:'📚', label:'マニュアル・FAQ',     href:'coreto-faq-v2.html',             key:'faq'             },
        { icon:'📲', label:'LINE再連携',           href:'coreto-hub-v2.html#line_relink', key:'line_relink'     },
        { icon:'🎓', label:'オンボーディング',     href:'coreto-onboarding-v2.html',      key:'onboarding'      },
      ],
    },
  ],

  // ════════════════ PT（パートナー）════════════════
  // 各ドメインへの紹介投げと進捗確認がメイン。光通信は案件投稿も可能。
  pt: [
    {
      section: 'ポータル',
      items: [
        { icon:'🏠', label:'PTポータル',           href:'coreto-hub-v2.html',               key:'dashboard'    },
        { icon:'🔑', label:'紹介コード・QR',       href:'coreto-hub-v2.html#code',          key:'code'         },
        { icon:'💴', label:'報酬明細',             href:'coreto-payment-v2.html',           key:'payment'      },
        { icon:'📊', label:'紹介案件の進捗',       href:'coreto-pt-portal-v2.html#progress',key:'progress'     },
      ],
    },
    {
      // 不動産への紹介：クライアントを紹介して進捗を確認する
      section: '不動産紹介',
      items: [
        { icon:'🏘️', label:'不動産案件を紹介する', href:'coreto-pt-portal-v2.html#re',      key:'re_refer'     },
      ],
    },
    {
      // 人材への紹介：転職希望者を紹介して進捗を確認する
      section: '人材紹介',
      items: [
        { icon:'👤', label:'人材案件を紹介する',   href:'coreto-pt-portal-v2.html#hr',      key:'hr_refer'     },
      ],
    },
    {
      // 光通信：PTは案件投稿まで可能（紹介コミッション発生）
      section: '光通信（案件投稿可）',
      items: [
        { icon:'⚡', label:'光通信案件を投稿する', href:'coreto-pt-portal-v2.html#util',    key:'util_submit',  badge:'NEW', badgeColor:'gold' },
      ],
    },
    {
      section: 'ツール',
      items: [
        { icon:'🔗', label:'リクルートリンク発行', href:'coreto-recruit-link-v2.html',      key:'recruit_link' },
        { icon:'📚', label:'マニュアル・FAQ',     href:'coreto-faq-v2.html',               key:'faq'          },
        { icon:'📲', label:'LINE再連携',           href:'coreto-hub-v2.html#line_relink',   key:'line_relink'  },
        { icon:'🎓', label:'オンボーディング',     href:'coreto-onboarding-v2.html',        key:'onboarding'   },
      ],
    },
  ],

  // ════════════════ インターン ════════════════
  // 訪問活動と光通信リード投げに特化。シンプルに保つ。
  intern: [
    {
      section: '本日の業務',
      items: [
        { icon:'📊', label:'当日の実績',               href:'coreto-hub-v2.html',              key:'dashboard'    },
        { icon:'📍', label:'訪問記録・エリアマップ',   href:'coreto-intern-visit-v2.html',     key:'visit'        },
        { icon:'⚡', label:'光通信リードを投稿する',   href:'coreto-intern-visit-v2.html#lead',key:'lead_submit'  },
      ],
    },
    {
      section: '個人',
      items: [
        { icon:'💴', label:'報酬確認',             href:'coreto-payment-v2.html',         key:'payment'      },
        { icon:'🏆', label:'ランキング',           href:'coreto-intern-v2.html',          key:'rank'         },
        { icon:'📚', label:'マニュアル・FAQ',     href:'coreto-faq-v2.html',             key:'faq'          },
        { icon:'📲', label:'LINE再連携',           href:'coreto-hub-v2.html#line_relink', key:'line_relink'  },
      ],
    },
  ],
};

const USERS = {
  hq:        { name:'田中 誠一（統括）',       role:'CORETO / exec',      av:'HQ' },
  re_ag:     { name:'山田 誠（RE-AG）',        role:'AG-0042 / Gold',     av:'AG' },
  hr_ag:     { name:'鈴木 花子（HR-AG）',      role:'AG-0088 / Silver',   av:'AG' },
  hikari_ag: { name:'山田 光太（光通信AG）',   role:'AG-0103 / Bronze',   av:'AG' },
  pt:        { name:'佐藤 健一（PT）',         role:'PT-0015 / active',   av:'PT' },
  intern:    { name:'渡辺 大輝（インターン）', role:'INT-0007 / active',  av:'IN' },
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
  ['sb-av','sb-name','sb-role','sb-un','sb-ur'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    if (id === 'sb-av') el.textContent = user.av;
    else if (id === 'sb-name' || id === 'sb-un') el.textContent = user.name;
    else el.textContent = user.role;
  });
  const navEl = document.getElementById('sb-nav');
  if (!navEl) return;
  navEl.innerHTML = sections.map(sec => `
    <div class="cnav-section">
      <div class="cnav-section-label">${sec.section}</div>
      ${sec.items.map(item => {
        const isActive = item.key === activeKey;
        const badgeCls = item.badgeColor === 'amber' ? 'amber'
                       : item.badgeColor === 'gold'  ? 'gold' : '';
        return `<a href="${item.href}" class="cnav-item${isActive ? ' active' : ''}" data-key="${item.key || ''}">
          <div class="cnav-icon">${item.icon}</div>
          <div class="cnav-label">${item.label}</div>
          ${item.note  ? `<div class="cnav-note">${item.note}</div>` : ''}
          <div class="cnav-badge ${badgeCls}"${item.badge ? '' : ' style="display:none"'}>${item.badge || ''}</div>
        </a>`;
      }).join('')}
    </div>`).join('');
  renderFooter();
  // 残-10: ナビ描画後にlocalStorageからバッジを動的更新
  setTimeout(updateNavBadges, 50);
  const legacyFooter = navEl.closest('nav')
    ? navEl.closest('nav').querySelector('[class*="footer"]:not(.cnav-footer)')
    : null;
  if (legacyFooter) legacyFooter.style.display = 'none';
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

return { init, openSettings, closeSettings, logout, session };
})();

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
    // HQタスク（承認待ち）
    var hqTasks = JSON.parse(localStorage.getItem('CORETO_HQ_TASKS') || '[]');
    var pendingTasks = hqTasks.length;
    
    // 即時払い申請待ち
    var pendingInstant = 0;
    try {
      var ikey = localStorage.getItem('CORETO_INSTANT_PAY_PENDING');
      if (ikey) pendingInstant = 1;
    } catch(e) {}
    
    // HR在籍確認リマインダー
    var reminders = JSON.parse(localStorage.getItem('CORETO_HR_REMINDERS') || '[]');
    var dueReminders = reminders.filter(function(r) { return r.status === 'pending'; }).length;
    
    // 成約報告（承認待ち）
    var reports = JSON.parse(localStorage.getItem('CORETO_REPORTS') || '[]');
    var pendingReports = reports.filter(function(r) { return r.status === '承認待ち'; }).length;
    
    // ナビの各バッジ要素を更新
    var badges = {
      'instant_pay': pendingInstant,
      'hr_matching': dueReminders || undefined,
      'remit': pendingTasks || undefined,
    };
    
    // ナビアイテムのbadgeを更新
    document.querySelectorAll('.cnav-badge').forEach(function(el) {
      var item = el.closest('[data-key]');
      if (!item) return;
      var key = item.dataset.key;
      if (badges[key] !== undefined) {
        el.textContent = badges[key];
        el.style.display = badges[key] > 0 ? '' : 'none';
      }
    });
  } catch(e) {}
}

// CNAV.init後にバッジ更新
var _originalInit = (typeof CNAV !== 'undefined' && CNAV.init) ? CNAV.init : null;
