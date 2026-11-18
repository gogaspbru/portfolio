/**
 * «Пиксельный прожектор» на карточках направлений (.direction-card).
 * Поверх фото — сетка квадратиков; рядом с курсором они загораются
 * (яркость спадает к краю круга), за курсором остаётся затухающий след.
 *
 * Настройка на карточке: data-pixels="R,G,B" — цвет квадратиков.
 * Только мышь (hover: hover); при prefers-reduced-motion не включается.
 * Рисует только пока есть что анимировать, потом останавливается.
 */
const CELL = 6;        // размер квадратика, px
const PITCH = 14;      // шаг сетки, px
const RADIUS = 150;    // радиус «прожектора», px
const DECAY = 0.9;     // затухание следа за кадр (меньше — быстрее гаснет)
const MAX_ALPHA = 0.9; // максимальная непрозрачность квадратика

function setupCard(card) {
  const media = card.querySelector('.direction-card__media');
  if (!media) return;

  const rgb = card.dataset.pixels || '255,255,255';
  const canvas = document.createElement('canvas');
  canvas.className = 'direction-card__pixels';
  canvas.setAttribute('aria-hidden', 'true');
  media.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  let w = 0, h = 0, cols = 0, rows = 0, offX = 0, offY = 0;
  let levels = new Float32Array(0);
  let mouse = null;     // {x, y} внутри media или null
  let running = false;

  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = media.clientWidth;
    h = media.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cols = Math.floor((w - CELL) / PITCH) + 1;
    rows = Math.floor((h - CELL) / PITCH) + 1;
    offX = (w - ((cols - 1) * PITCH + CELL)) / 2; // сетка по центру
    offY = (h - ((rows - 1) * PITCH + CELL)) / 2;
    levels = new Float32Array(cols * rows);
  };

  const frame = () => {
    ctx.clearRect(0, 0, w, h);
    let active = false;

    for (let r = 0; r < rows; r++) {
      const y = offY + r * PITCH;
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        const x = offX + c * PITCH;
        let target = 0;
        if (mouse) {
          const dx = x + CELL / 2 - mouse.x;
          const dy = y + CELL / 2 - mouse.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < RADIUS) {
            const k = 1 - d / RADIUS;
            target = k * k; // мягкий спад к краю
          }
        }
        const level = Math.max(target, levels[i] * DECAY);
        levels[i] = level < 0.01 ? 0 : level;
        if (levels[i] > 0) {
          active = true;
          ctx.fillStyle = `rgba(${rgb},${(levels[i] * MAX_ALPHA).toFixed(3)})`;
          ctx.fillRect(x, y, CELL, CELL);
        }
      }
    }

    if (active || mouse) {
      requestAnimationFrame(frame);
    } else {
      running = false;
    }
  };

  const start = () => {
    if (!running) { running = true; requestAnimationFrame(frame); }
  };

  card.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    const rect = media.getBoundingClientRect();
    mouse = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    start();
  });
  card.addEventListener('pointerleave', () => { mouse = null; start(); });

  new ResizeObserver(resize).observe(media);
  resize();
}

export function initCardPixels() {
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  document.querySelectorAll('.direction-card').forEach(setupCard);
}
