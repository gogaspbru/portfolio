/**
 * Построчное «выплывание» заголовков снизу вверх (механика как на goga.spb.ru).
 * Разметка: [data-reveal] > .reveal-line > .reveal-line__inner
 *   data-reveal="load" — анимация сразу после загрузки шрифтов (первый экран),
 *   data-reveal        — когда блок появляется в окне при скролле.
 * Стили — css/main.css, раздел «Построчное появление».
 */
const STAGGER = 0.09; // секунд между строками

export function initReveal() {
  window.__revealInit = true;
  if (!document.documentElement.classList.contains('reveal-ready')) return; // reduced motion

  const els = [...document.querySelectorAll('[data-reveal]')];

  els.forEach((el) => {
    el.querySelectorAll('.reveal-line__inner').forEach((inner, i) => {
      inner.style.transitionDelay = `${i * STAGGER}s`;
    });
  });

  const fire = (el) => el.classList.add('is-in');

  // Первый экран — после загрузки шрифтов, чтобы строки не прыгали
  const onLoad = els.filter((el) => el.dataset.reveal === 'load');
  const fontsReady = document.fonts ? document.fonts.ready : Promise.resolve();
  fontsReady.then(() => requestAnimationFrame(() => onLoad.forEach(fire)));

  // Остальные — по скроллу
  const onScroll = els.filter((el) => el.dataset.reveal !== 'load');
  if (!('IntersectionObserver' in window)) { onScroll.forEach(fire); return; }

  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      io.unobserve(entry.target);
      fire(entry.target);
    });
  }, { rootMargin: '0px 0px -12% 0px' });

  onScroll.forEach((el) => io.observe(el));
}
