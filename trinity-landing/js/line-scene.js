/**
 * «Линия» на первом экране (index-line.html) — по мотивам santalarch.com.
 * Экран «залипает»; по мере прокрутки синяя диагональ (наклон как у слэша «/»)
 * поворачивается к горизонтали. Синий параллелограмм (с видео) стоит на месте; когда линия
 * заходит в него, часть над линией скрывается — линия «закрывает» блок по мере движения
 * (край блока идёт прямо по линии, без зазора). Когда линия легла горизонтально,
 * она раскрывается в полосу и заливает экран фирменным синим; дальше идёт секция
 * на синем (.blue-section) того же цвета — переход бесшовный.
 *
 * Линия и полоса — это clip-path: polygon(...) у слоёв размером с экран: многоугольник
 * пересчитывается каждый кадр. Огромных повёрнутых/растянутых слоёв нет — линия
 * не «ломается» на тайлы. Без WebGL и библиотек; работает с file://.
 *
 * Разметка:
 *   <section class="line-scene" data-line-scene>          — «дорожка» прокрутки (высота в CSS)
 *     <div class="line-scene__stage">                     — залипающий экран
 *       <div class="line-scene__content">…</div>
 *       <span class="line-scene__plane">                     — рамка блока (обрезка по линии — JS)
 *         <span class="line-scene__plane-shape"><video…></span>  — форма параллелограмма
 *       </span>
 *       <span class="line-scene__line"></span>                 — линия / полоса заливки
 */
(function (Trinity) {
  'use strict';

  // ---------- параметры ----------
  const ANGLE_FROM = -59;          // наклон линии в начале, ° (эскиз Figma «Frame 31»)
  const LINE_WIDTH = 8;            // толщина линии, px
  const ROTATE = [0, 0.55];        // поворот к горизонтали (доли прогресса прокрутки)
  const BAND = [0.55, 1];          // раскрытие в полосу на весь экран
  const PIVOT_FROM = [0.51, 0.58]; // точка вращения в начале (доли экрана) — как в эскизе
  const PIVOT_TO = [0.5, 0.5];     // к горизонтали — центр экрана
  const INTRO_MS = 1100;           // «прорисовка» линии при загрузке
  const PLANE_SIDE = 0.494;        // верхняя грань параллелограмма — доля ширины (290 / 587)
  const PLANE_SKEW = Math.tan((30 * Math.PI) / 180); // скос граней: 30° от вертикали

  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const range = (p, [a, b]) => clamp((p - a) / (b - a));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const poly = (pts) => `polygon(${pts.map(([x, y]) => `${x.toFixed(1)}px ${y.toFixed(1)}px`).join(', ')})`;

  // полоса шириной 2·half вдоль прямой через (cx, cy) под углом deg, длиной 2·len
  function bandPolygon(cx, cy, deg, half, len) {
    const a = (deg * Math.PI) / 180;
    const dx = Math.cos(a), dy = Math.sin(a);   // вдоль линии
    const nx = -dy, ny = dx;                    // поперёк
    return poly([
      [cx - dx * len + nx * half, cy - dy * len + ny * half],
      [cx + dx * len + nx * half, cy + dy * len + ny * half],
      [cx + dx * len - nx * half, cy + dy * len - ny * half],
      [cx - dx * len - nx * half, cy - dy * len - ny * half],
    ]);
  }

  function initLineScene(scene) {
    if (!scene) return;
    const stage = scene.querySelector('.line-scene__stage');
    const line = scene.querySelector('.line-scene__line');
    const plane = scene.querySelector('.line-scene__plane');
    const shapeEl = plane && plane.querySelector('.line-scene__plane-shape');
    const content = scene.querySelector('.line-scene__content');
    if (!stage || !line) return;

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) scene.classList.add('line-scene--static');

    let ticking = false;
    let introStart = null;

    function update(now) {
      ticking = false;
      if (introStart === null) introStart = now;
      const intro = reduce ? 1 : easeOut(clamp((now - introStart) / INTRO_MS));

      const r = scene.getBoundingClientRect();
      const W = stage.clientWidth, H = stage.clientHeight;
      const p = reduce ? 0 : clamp(-r.top / Math.max(1, r.height - H));
      const rot = easeInOut(range(p, ROTATE));
      const band = easeInOut(range(p, BAND));

      const cx = lerp(PIVOT_FROM[0], PIVOT_TO[0], rot) * W;
      const cy = lerp(PIVOT_FROM[1], PIVOT_TO[1], rot) * H;
      const deg = lerp(ANGLE_FROM, 0, rot);
      const half = lerp(LINE_WIDTH / 2, H * 0.6, band);
      const len = (W + H) * intro;               // при загрузке линия растёт из центра
      const shape = bandPolygon(cx, cy, deg, half, len);

      line.style.clipPath = shape;
      line.style.webkitClipPath = shape;

      // блок: точная форма параллелограмма + обрезка по линии (видна только сторона «под» линией)
      if (plane && shapeEl) {
        const x = plane.offsetLeft, y = plane.offsetTop;   // без учёта transform появления
        const w = plane.offsetWidth, h = plane.offsetHeight;
        const k = PLANE_SKEW * h, side = w * PLANE_SIDE;
        const shape2 = poly([[w - side, 0], [w, 0], [w - k, h], [w - side - k, h]]);
        shapeEl.style.clipPath = shape2;
        shapeEl.style.webkitClipPath = shape2;

        const a = (deg * Math.PI) / 180;
        const dx = Math.cos(a), dy = Math.sin(a), nx = -dy, ny = dx; // n — «под» линией
        const off = 0, far = 2 * (W + H);                  // край блока — по оси линии, без зазора
        const lx = cx - x, ly = cy - y;                    // центр линии в координатах блока
        const keep = poly([
          [lx - dx * far + nx * off, ly - dy * far + ny * off],
          [lx + dx * far + nx * off, ly + dy * far + ny * off],
          [lx + dx * far + nx * (off + far), ly + dy * far + ny * (off + far)],
          [lx - dx * far + nx * (off + far), ly - dy * far + ny * (off + far)],
        ]);
        plane.style.clipPath = keep;
        plane.style.webkitClipPath = keep;
      }

      // заголовок чуть уходит вверх, пока его накрывает синий
      if (content) content.style.transform = `translateY(${-band * 60}px)`;

      scene.classList.toggle('is-band', band > 0);       // полоса растёт — поверх всего
      // экран залит целиком (полоса шире экрана) — показываем блоки на синем
      scene.classList.toggle('is-filled', half >= H * 0.52);

      if (intro < 1) request();
    }

    function request() {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }

    if (!reduce) {
      window.addEventListener('scroll', request, { passive: true });
    }
    window.addEventListener('resize', request);
    request();
    // появление параллелограмма при загрузке — в CSS
    requestAnimationFrame(() => scene.classList.add('is-ready'));
  }

  Trinity.initLineScene = initLineScene;
})(window.Trinity = window.Trinity || {});
