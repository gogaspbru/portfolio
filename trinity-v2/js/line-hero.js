/**
 * Линия на первом экране (макет Figma «Frame 42», Line 80: 5px, наклон 59°).
 * В покое — диагональ, которая проходит левее параллелограмма и «уходит» под синий блок.
 * При прокрутке линия поворачивается вокруг точки, где она пересекает верхний край
 * синего блока, и ложится горизонтально на этот край. Проходя по фигурам справа,
 * она их «закрывает»: видна только часть фигур по другую сторону линии.
 *
 * Линия — clip-path: polygon(...) у слоя во весь первый экран (пересчёт каждый кадр):
 * без огромных повёрнутых слоёв, поэтому не «ломается». Без библиотек, работает с file://.
 *
 * Разметка: .hero > .hero__line, .hero__shapes
 */
(function (Trinity) {
  'use strict';

  const ANGLE = -59;            // наклон в покое, ° (−59° — «/»: вверх-вправо)
  const WIDTH = 5;              // толщина линии, px (stroke-width в макете)
  const PIVOT_OFFSET = 196.7;   // точка на краю синего блока левее рамки фигур: 833.7 − 637 (при ширине фигур 650)
  const SHAPES_W = 650;
  const END = 0.85;             // поворот заканчивается, когда прокручено 85% высоты первого экрана

  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const poly = (pts) => `polygon(${pts.map(([x, y]) => `${x.toFixed(1)}px ${y.toFixed(1)}px`).join(', ')})`;

  function initLineHero(hero) {
    if (!hero) return;
    const line = hero.querySelector('.hero__line');
    const shapes = hero.querySelector('.hero__shapes');
    if (!line || !shapes) return;

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let ticking = false;

    function update() {
      ticking = false;
      const W = hero.clientWidth, H = hero.clientHeight;
      const r = hero.getBoundingClientRect();
      const p = reduce ? 0 : clamp(-r.top / (H * END));
      const deg = ANGLE * (1 - easeInOut(p));
      const a = (deg * Math.PI) / 180;
      const dx = Math.cos(a), dy = Math.sin(a);   // вдоль линии
      const nx = -dy, ny = dx;                    // поперёк, в сторону фигур

      // точка поворота — на нижней границе первого экрана, левее фигур (масштаб — по ширине фигур)
      const sx = shapes.offsetLeft, sy = shapes.offsetTop, sw = shapes.offsetWidth;
      const cx = sx - PIVOT_OFFSET * (sw / SHAPES_W);
      const cy = H;
      const L = 2 * (W + H), h = WIDTH / 2;

      const band = poly([
        [cx - dx * L + nx * h, cy - dy * L + ny * h],
        [cx + dx * L + nx * h, cy + dy * L + ny * h],
        [cx + dx * L - nx * h, cy + dy * L - ny * h],
        [cx - dx * L - nx * h, cy - dy * L - ny * h],
      ]);
      line.style.clipPath = band;
      line.style.webkitClipPath = band;

      // фигуры видны только по свою сторону линии (в координатах рамки фигур)
      const lx = cx - sx, ly = cy - sy;
      const keep = poly([
        [lx - dx * L, ly - dy * L],
        [lx + dx * L, ly + dy * L],
        [lx + dx * L + nx * L, ly + dy * L + ny * L],
        [lx - dx * L + nx * L, ly - dy * L + ny * L],
      ]);
      shapes.style.clipPath = keep;
      shapes.style.webkitClipPath = keep;
    }

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
