/**
 * COREBLDG シミュレーション設定
 */

module.exports = {
  BASE_URL: 'http://localhost:8765',

  // ロール別ログイン情報
  ROLES: {
    hq_exec:  { userId: 'HQ-00001', pw: 'Coreto2026!', role: 'hq',        label: 'HQ統括' },
    hq_staff: { userId: 'HQ-00001', pw: 'Coreto2026!', role: 'hq',        label: 'HQ担当' },
    re_ag:    { userId: 'AG-0042',  pw: 'agent2026',   role: 're_ag',     label: '不動産AG' },
    hr_ag:    { userId: 'AG-0103',  pw: 'agent2026',   role: 'hr_ag',     label: '人材AG' },
    pt:       { userId: 'PT-0015',  pw: 'partner26',   role: 'pt',        label: 'PT' },
  },

  // 観察記録のカテゴリ
  ISSUE_CATEGORIES: {
    UI:       'UIデザイン・表示',
    UX:       'ユーザー体験・フロー',
    BUG:      'バグ・動作不良',
    DATA:     'データ・情報',
    MISSING:  '機能不足・未実装',
    CONFUSING:'分かりにくい・説明不足',
    PERF:     'パフォーマンス',
  },

  SEVERITY: {
    CRITICAL: 1, // 業務が止まる
    HIGH:     2, // 重要な機能が使えない
    MEDIUM:   3, // 不便だが回避可能
    LOW:      4, // 軽微な改善
  },
};
