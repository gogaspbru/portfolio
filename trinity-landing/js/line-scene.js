/**
 * «Линия» на первом экране (index-line.html) — по мотивам santalarch.com.
 * Экран «залипает»; по мере прокрутки синяя диагональ (наклон как у слэша «/»)
 * поворачивается к горизонтали, параллелограмм улетает вверх-вправо, а когда линия
 * легла горизонтально — она раскрывается в полосу и заливает экран фирменным синим.
 * Дальше идёт секция на синем (.blue-section) того же цвета — переход бесшовный.
 *
 * Только transform — без WebGL и библиотек; работает с file://.
 *
 * Разметка:
 *   <section class="line-scene" data-line-scene>        — «дорожка» прокрутки (высота в CSS)
 *     <div class="line-scene__stage">                   — залипающий экран
 *       <span class="line-scene__line"></span>
 *       <span class="line-scene__plane"><span></span></span>  — внутренний span скошен (CSS)
 *       <div class="line-scene__content">…</div>
 */
(function (Trinity) {
  'use strict';

  // ---------- таймлайн (доли прогресса прокрутки 0..1) ----------
  const ANGLE_FROM = -59;        // наклон линии в начале, ° (как в эскизе Figma «Frame 31»)
  const ROTATE = [0, 0.55];      // поворот линии к горизонтали
  const PLANE_FLY = [0.04, 0.4]; // параллелограмм улетает
  const BAND = [0.55, 1];        // линия раскрывается в полосу и заливает экран
  // точка вращения линии: в начале — как в эскизе, к горизонтали — центр экрана
  const PIVOT_FROM = [0.51, 0.58];
  const PIVOT_TO = [0.5, 0.5];

  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const range = (p, [a, b]) => clamp((p - a) / (b - a));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const easeIn = (t) => t * t * t;

  function initLineScene(scene) {
    if (!scene) return;
    const stage = scene.querySelector('.line-scene__stage');
    const line = scene.querySelector('.line-scene__line');
    const plane = scene.querySelector('.line-scene__plane');
    const content = scene.querySelector('.line-scene__content');
    if (!stage || !line) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      scene.classList.add('line-scene--static');
      return;
    }

    let ticking = false;

    function update() {
      ticking = false;
      const r = scene.getBoundingClientRect();
      const W = stage.clientWidth, H = stage.clientHeight;
      const p = clamp(-r.top / Math.max(1, r.height - H));

      const rot = easeInOut(range(p, ROTATE));
      const fly = easeIn(range(p, PLANE_FLY));
      const band = easeInOut(range(p, BAND));

      // линия: поворот вокруг точки, которая сползает к центру экрана
      const px = lerp(PIVOT_FROM[0], PIVOT_TO[0], rot) * W;
      const py = lerp(PIVOT_FROM[1], PIVOT_TO[1], rot) * H;
      const thick = line.offsetHeight || 8;
      const scaleY = 1 + band * ((H * 1.15) / thick);   // до толщины больше экрана
      line.style.transform =
        `translate(${px}px, ${py}px) translate(-50%, -50%) rotate(${lerp(ANGLE_FROM, 0, rot)}deg) scaleY(${scaleY})`;

      // параллелограмм улетает вдоль своего наклона (вверх-вправо)
      if (plane) {
        plane.style.transform = `translate(${fly * W * 0.45}px, ${-fly * H * 0.8}px)`;
        plane.style.opacity = String(1 - clamp((fly - 0.6) / 0.4));
      }

      // заголовок чуть уходит вверх, пока его накрывает синий
      if (content) content.style.transform = `translateY(${-band * 60}px)`;

      scene.classList.toggle('is-band', band > 0);   // полоса растёт — линия поверх заголовка
      scene.classList.toggle('is-filled', band >= 0.999);
    }

    const request = () => {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    };
    window.addEventListener('scroll', request, { passive: true });
    window.addEventListener('resize', request);
    update();
    // появление при загрузке (линия «прорисовывается», параллелограмм выезжает) — в CSS
    requestAnimationFrame(() => scene.classList.add('is-ready'));
  }

  Trinity.initLineScene = initLineScene;
})(window.Trinity = window.Trinity || {});
