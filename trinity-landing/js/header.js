/**
 * Прилипающая шапка: после начала скролла добавляем .header--stuck
 * (состояние из Figma «Frame 22»: прижата к верху, ячейки 54px, белые 90%).
 */
(function (Trinity) {
  'use strict';

  const THRESHOLD = 20; // px скролла до переключения

  function initStickyHeader(header) {
    if (!header) return;

    let stuck = false;
    let ticking = false;

    const update = () => {
      ticking = false;
      const next = window.scrollY > THRESHOLD;
      if (next !== stuck) {
        stuck = next;
        header.classList.toggle('header--stuck', stuck);
      }
    };

    window.addEventListener('scroll', () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    }, { passive: true });

    update();
  }

  Trinity.initStickyHeader = initStickyHeader;
})(window.Trinity = window.Trinity || {});
