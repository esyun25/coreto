/**
 * coreto-sp-init.js
 * CORETO スマートフォン自動検知・初期化エンジン
 * 全エージェント・パートナー向けページに共通適用
 *
 * 使い方:
 *   <script src="coreto-sp-init.js" data-nav="sp-bottom-nav"></script>
 *   ※ data-nav 属性に表示するボトムナビのIDを指定
 */

(function () {
  'use strict';

  /* ── 検知ロジック ──────────────────────────────────────────── */
  function isMobile() {
    // 1. 画面幅（最優先）
    if (window.innerWidth <= 768) return true;
    // 2. User-agent（タブレット除外）
    const ua = navigator.userAgent || '';
    const isMobileUA = /iPhone|Android.*Mobile|Windows Phone|BlackBerry|IEMobile/i.test(ua);
    // 3. タッチポイント数（タッチスクリーン且つ幅が小さい）
    const isTouch = navigator.maxTouchPoints > 1 && window.innerWidth <= 1024;
    return isMobileUA || isTouch;
  }

  /* ── 初期化 ─────────────────────────────────────────────────── */
  function init() {
    if (!isMobile()) return;

    // body に sp-mode クラスを付与
    document.documentElement.classList.add('sp-mode');
    document.body.classList.add('sp-mode');

    // data-nav で指定されたボトムナビを表示
    var scripts = document.querySelectorAll('script[data-nav]');
    scripts.forEach(function (s) {
      var navId = s.getAttribute('data-nav');
      if (navId) {
        var nav = document.getElementById(navId);
        if (nav) {
          nav.style.display = 'flex';
        }
      }
    });

    // 同一ページ内の全ボトムナビを検索して表示
    var navEls = document.querySelectorAll('.sp-bottom-nav');
    navEls.forEach(function (nav) { nav.style.display = 'flex'; });

    // body のボトムパディング（ナビ高さ分）
    document.body.style.paddingBottom = 'calc(68px + env(safe-area-inset-bottom))';

    // main / wrap / page / content コンテナにもパディング
    var containers = document.querySelectorAll('.main, .wrap, .page, .content, .sp-safe-bottom');
    containers.forEach(function (el) {
      var current = getComputedStyle(el).paddingBottom;
      var currentPx = parseInt(current) || 0;
      if (currentPx < 80) {
        el.style.paddingBottom = '88px';
      }
    });

    // iOS Safari のバウンススクロール対策
    document.documentElement.style.webkitOverflowScrolling = 'touch';

    // input の font-size 強制（iOS ズーム防止）
    var inputs = document.querySelectorAll('input:not([type=checkbox]):not([type=radio]), select, textarea');
    inputs.forEach(function (el) {
      if (parseInt(getComputedStyle(el).fontSize) < 16) {
        el.style.fontSize = '16px';
      }
    });

    // サイドバーを非表示にしてメインを全幅に
    var sidebars = document.querySelectorAll('.sidebar');
    sidebars.forEach(function (sb) { sb.style.display = 'none'; });

    var mains = document.querySelectorAll('.main');
    mains.forEach(function (m) {
      m.style.marginLeft = '0';
      m.style.width = '100%';
    });

    // tablet / PC 向け2〜4カラムグリッドを1〜2カラムに
    var grids = document.querySelectorAll('.g2, .g3, .g4, .fg-row, .fg-row3');
    grids.forEach(function (g) {
      g.style.gridTemplateColumns = '1fr';
      g.style.gap = '0';
    });
  }

  /* ── リサイズ対応 ──────────────────────────────────────────── */
  var resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      if (isMobile()) {
        document.body.classList.add('sp-mode');
        document.documentElement.classList.add('sp-mode');
      } else {
        document.body.classList.remove('sp-mode');
        document.documentElement.classList.remove('sp-mode');
      }
    }, 150);
  });

  /* ── 画面向き変更対応 ───────────────────────────────────────── */
  if (window.screen && window.screen.orientation) {
    screen.orientation.addEventListener('change', function () {
      setTimeout(init, 200);
    });
  } else {
    window.addEventListener('orientationchange', function () {
      setTimeout(init, 200);
    });
  }

  /* ── DOMContentLoaded で実行 ──────────────────────────────── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  /* ── グローバル公開（他スクリプトから利用可能に） ─────────── */
  window.CORETO_SP = {
    isMobile: isMobile,
    init: init,
  };
})();
