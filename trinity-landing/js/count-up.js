/**
 * «Набегание» цифр: при появлении блока в окне число растёт от 0 до значения.
 * Разметка: <p data-count="80000" data-suffix="+">80 000</p>
 * В HTML лежит итоговое значение — без JS и при prefers-reduced-motion оно и показывается.
 */
const DURATION = 1600; // мс
const STAGGER = 120;   // мс между блоками

const format = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); // 80 000
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

function run(el, delay) {
  const to = Number(el.dataset.count);
  const suffix = el.dataset.suffix || '';
  let start = null;
  el.classList.add('is-counting');

  const step = (now) => {
    if (start === null) start = now + delay;
    const t = Math.min(1, Math.max(0, (now - start) / DURATION));
    el.textContent = format(Math.round(to * easeOutCubic(t))) + suffix;
    if (t < 1) requestAnimationFrame(step);
    else el.classList.remove('is-counting');
  };
  requestAnimationFrame(step);
}

export function initCountUp(root = document) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!('IntersectionObserver' in window)) return;

  const els = [...root.querySelectorAll('[data-count]')];
  if (!els.length) return;

  // стартовое состояние — нули
  els.forEach((el) => { el.textContent = '0' + (el.dataset.suffix || ''); });

  const io = new IntersectionObserver((entries) => {
    const visible = entries.filter((e) => e.isIntersecting).map((e) => e.target);
    visible.forEach((el) => {
      io.unobserve(el);
      run(el, els.indexOf(el) * STAGGER);
    });
  }, { rootMargin: '0px 0px -15% 0px' });

  els.forEach((el) => io.observe(el));
}
