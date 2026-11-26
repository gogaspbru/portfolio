/**
 * Линия на первом экране (Line 80 из макета: 5px, наклон 59°) — сценарий как в варианте «линия».
 * Экран «залипает» внутри .hero-track. По мере прокрутки:
 *   1) линия поворачивается к горизонтали и «закрывает» фигуры справа —
 *      видна только часть фигур по другую сторону линии;
 *   2) когда линия легла горизонтально, она раскрывается в полосу и заливает экран синим;
 *   3) экран залит — на .hero-track ставится .is-filled, и проявляются блоки на синем (.main).
 * Пока линия стоит (прокрутки ещё не было), по ней снизу вверх пробегает блик (.hero__line-glow).
 *
 * Линия и полоса — clip-path: polygon(...) у слоя во весь экран (пересчёт каждый кадр):
 * без огромных повёрнутых слоёв, поэтому не «ломается». Без библиотек, работает с file://.
 *
 * Разметка: .hero-track[data-hero-track] > .hero > .hero__line, .hero__shapes; следом — .main
 */
(function (Trinity) {
  'use strict';

  const ANGLE = -59;              // наклон в покое, ° (−59° — «/»: вверх-вправо)
  const WIDTH = 5;                // толщина линии, px (stroke-width в макете)
  const ROTATE = [0, 0.55];       // поворот к горизонтали (доли прогресса прокрутки)
  const BAND = [0.55, 1];         // раскрытие в синюю полосу на весь экран
  // точка, через которую в макете идёт линия: (637, 770) при рамке фигур 650 × 571 с (833.7, 136) —
  // в долях рамки фигур, чтобы точка следовала за ними на любой ширине
  const PIVOT_X = -196.7 / 650;
  const PIVOT_Y = 634 / 571;
  const GLOW_RUN = 2.4;           // блик пробегает линию за, с
  const GLOW_PAUSE = 1.8;         // пауза между пробегами, с
  const GLOW_FADE = 0.04;         // блик гаснет, как только прокрутили 4% анимации

  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const range = (p, [a, b]) => clamp((p - a) / (b - a));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const poly = (pts) => `polygon(${pts.map(([x, y]) => `${x.toFixed(1)}px ${y.toFixed(1)}px`).join(', ')})`;

  function initLineHero(track) {
    if (!track) return;
    const hero = track.querySelector('.hero');
    const line = track.querySelector('.hero__line');
    const shapes = track.querySelector('.hero__shapes');
    const glow = track.querySelector('.hero__line-glow');
    if (!hero || !line || !shapes) return;
    const geo = { cx: 0, cy: 0, dx: 1, dy: 0, deg: 0, H: 1, p: 0 }; // для блика

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) track.classList.add('hero-track--static');
    let ticking = false;

    function update() {
      ticking = false;
      const W = hero.clientWidth, H = hero.clientHeight;
      const r = track.getBoundingClientRect();
      const p = reduce ? 0 : clamp(-r.top / Math.max(1, r.height - H));
      const rot = easeInOut(range(p, ROTATE));
      const band = easeInOut(range(p, BAND));

      const deg = ANGLE * (1 - rot);
      const a = (deg * Math.PI) / 180;
      const dx = Math.cos(a), dy = Math.sin(a);   // вдоль линии
      const nx = -dy, ny = dx;                    // поперёк, в сторону фигур

      // точка поворота: из макета → к центру экрана (там линия раскрывается в полосу)
      const sx = shapes.offsetLeft, sy = shapes.offsetTop;
      const sw = shapes.offsetWidth, sh = shapes.offsetHeight;
      const cx = lerp(sx + PIVOT_X * sw, W / 2, rot);
      const cy = lerp(sy + PIVOT_Y * sh, H / 2, rot);
      const half = lerp(WIDTH / 2, H * 0.6, band);
      const L = 2 * (W + H);

      const shape = poly([
        [cx - dx * L + nx * half, cy - dy * L + ny * half],
        [cx + dx * L + nx * half, cy + dy * L + ny * half],
        [cx + dx * L - nx * half, cy + dy * L - ny * half],
        [cx - dx * L - nx * half, cy - dy * L - ny * half],
      ]);
      line.style.clipPath = shape;
      line.style.webkitClipPath = shape;

      // фигуры видны только по свою сторону линии (координаты — в рамке фигур)
      const lx = cx - sx, ly = cy - sy;
      const keep = poly([
        [lx - dx * L, ly - dy * L],
        [lx + dx * L, ly + dy * L],
        [lx + dx * L + nx * L, ly + dy * L + ny * L],
        [lx - dx * L + nx * L, ly - dy * L + ny * L],
      ]);
      shapes.style.clipPath = keep;
      shapes.style.webkitClipPath = keep;

      Object.assign(geo, { cx, cy, dx, dy, deg, H, p });

      track.classList.toggle('is-band', band > 0);               // полоса растёт — поверх всего
      track.classList.toggle('is-filled', half >= H * 0.52);     // экран залит — блоки на синем
    }

    // блик: бежит вдоль линии снизу вверх (от нижнего края экрана до верхнего), потом пауза
    let glowVisible = true;
    if ('IntersectionObserver' in window) {
      new IntersectionObserver((es) => { glowVisible = es[0].isIntersecting; }).observe(hero);
    }
    function glowFrame(now) {
      requestAnimationFrame(glowFrame);
      if (!glowVisible) return;
      const fade = 1 - clamp(geo.p / GLOW_FADE);
      if (fade <= 0 || Math.abs(geo.dy) < 0.2) { glow.style.opacity = '0'; return; }
      const t = (now / 1000) % (GLOW_RUN + GLOW_PAUSE);
      if (t > GLOW_RUN) { glow.style.opacity = '0'; return; }
      const k = t / GLOW_RUN;
      // параметр вдоль линии: от точки ниже экрана до точки выше экрана
      const sFrom = (geo.H + 160 - geo.cy) / geo.dy;
      const sTo = (-160 - geo.cy) / geo.dy;
      const s = lerp(sFrom, sTo, k * k * (3 - 2 * k));   // плавный разгон и торможение
      const x = geo.cx + geo.dx * s, y = geo.cy + geo.dy * s;
      glow.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -50%) rotate(${geo.deg}deg)`;
      glow.style.opacity = String(fade * Math.sin(Math.PI * k) ** 0.5);  // мягко появляется и гаснет
    }
    if (glow && !reduce) requestAnimationFrame(glowFrame);

    const request = () => {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    };
    if (!reduce) window.addEventListener('scroll', request, { passive: true });
    window.addEventListener('resize', request);
    window.addEventListener('load', request);
    update();
  }

  Trinity.initLineHero = initLineHero;
})(window.Trinity = window.Trinity || {});
