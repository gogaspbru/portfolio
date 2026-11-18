/**
 * Плавный инерционный скролл колесом мыши — перенос с goga.spb.ru (js/app.js, initSmoothScroll).
 * Только десктоп с мышью; отключается при prefers-reduced-motion и на слабых машинах
 * (там нативный скролл плавнее). Липкие блоки (position: sticky) работают как обычно —
 * прокручивается сам window.
 */
(function (Trinity) {
  'use strict';

  const EASE = 0.1; // меньше — плавнее и инерционнее

  function isLowPower() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return true;
    const cores = navigator.hardwareConcurrency;
    if (typeof cores === 'number' && cores > 0 && cores <= 2) return true;
    const mem = navigator.deviceMemory;
    if (typeof mem === 'number' && mem > 0 && mem <= 2) return true;
    return false;
  }

  function initSmoothScroll() {
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    if (isLowPower()) return;

    let current = window.scrollY;
    let target = current;
    let running = false;

    const maxScroll = () => Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    const clamp = (v) => Math.max(0, Math.min(v, maxScroll()));

    const raf = () => {
      current += (target - current) * EASE;
      if (Math.abs(target - current) < 0.4) {
        current = target;
        window.scrollTo(0, current);
        running = false;
        return;
      }
      window.scrollTo(0, current);
      requestAnimationFrame(raf);
    };
    const start = () => {
      if (!running) { running = true; requestAnimationFrame(raf); }
    };

    window.addEventListener('wheel', (e) => {
      if (e.ctrlKey) return;                                          // пинч-зум — браузеру
      if (document.body.classList.contains('is-menu-open')) return;  // в открытом меню — нативно
      e.preventDefault();
      const unit = e.deltaMode === 1 ? 16 : (e.deltaMode === 2 ? window.innerHeight : 1);
      target = clamp(target + e.deltaY * unit);
      start();
    }, { passive: false });

    // синхронизация, если страницу прокрутили иначе (клавиатура, скроллбар, якорь)
    window.addEventListener('scroll', () => {
      if (!running) current = target = window.scrollY;
    }, { passive: true });

    window.addEventListener('resize', () => {
      target = clamp(target);
      current = clamp(current);
    });
  }

  Trinity.initSmoothScroll = initSmoothScroll;
})(window.Trinity = window.Trinity || {});
