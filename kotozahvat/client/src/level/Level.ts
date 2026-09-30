import { CONFIG } from '../config';
import type { ElementType, LevelData } from '../../../shared/types';
import { TiledCanvas } from '../render/TiledCanvas';

/** Элемент страницы во время игры */
export interface RuntimeElement {
  index: number;
  id: number;
  type: ElementType;
  x: number;
  y: number;
  w: number;
  h: number;
  cellsTotal: number;
  cellsAlive: number;
  hp: number;
  maxHp: number;
  dead: boolean;
  /** Остаток времени белой вспышки после удара */
  flash: number;
  /** Сколько порогов трещин уже нарисовано */
  cracks: number;
}

export interface LevelEvents {
  /** Клетка разрушена: (x, y) — левый верхний угол клетки, (ix, iy) — импульс осколков */
  onCellDestroyed(x: number, y: number, ix: number, iy: number): void;
  onCollapse(el: RuntimeElement): void;
}

/**
 * Уровень: сетка «чьих» клеток поверх скриншота.
 * Клетка принадлежит верхнему элементу, который её накрывает; -1 — пусто.
 * Все элементы — платформы «снизу насквозь»: стоять можно на клетке, над которой пусто.
 */
export class Level {
  readonly width: number;
  readonly pageHeight: number;
  readonly worldHeight: number;
  readonly cs = CONFIG.world.cellSize;
  readonly cols: number;
  readonly rows: number;
  readonly owner: Int16Array;
  readonly elements: RuntimeElement[] = [];
  readonly background: string;

  /** Передний план: скриншот, вырезанный по элементам; сюда же рисуются царапины и трещины */
  readonly fg: TiledCanvas;
  /** Затемнённый фон (половинное разрешение) */
  readonly bg: HTMLCanvasElement;
  readonly bgScale = 0.5;
  /** Пиксели скриншота для цвета осколков */
  private pixels: Uint32Array;

  totalCells = 0;
  destroyedCells = 0;
  /** Растёт при любом изменении сетки — по нему навигация понимает, что граф устарел */
  version = 0;

  private queueCells: number[] = [];
  private queueHead = 0;
  private events: LevelEvents;

  constructor(data: LevelData, image: CanvasImageSource, events: LevelEvents) {
    this.events = events;
    this.width = data.width;
    this.pageHeight = data.height;
    this.worldHeight = data.height + CONFIG.world.floorPadding;
    this.background = data.background ?? '#ffffff';
    this.cols = Math.ceil(this.width / this.cs);
    this.rows = Math.ceil(this.pageHeight / this.cs);
    this.owner = new Int16Array(this.cols * this.rows).fill(-1);

    // Пиксели скриншота
    const tmp = document.createElement('canvas');
    tmp.width = this.width;
    tmp.height = this.pageHeight;
    const tctx = tmp.getContext('2d', { willReadFrequently: true })!;
    tctx.fillStyle = this.background;
    tctx.fillRect(0, 0, this.width, this.pageHeight);
    tctx.drawImage(image, 0, 0);
    this.pixels = new Uint32Array(tctx.getImageData(0, 0, this.width, this.pageHeight).data.buffer);

    this.buildGrid(data);

    // Передний план
    this.fg = new TiledCanvas(this.width, this.pageHeight);
    this.fg.paint(0, 0, this.width, this.pageHeight, (ctx) => ctx.drawImage(tmp, 0, 0));
    this.clearUnownedCells();

    // Фон (полразмера): тёмная «изнанка» сайта в клетку и еле заметный призрак страницы —
    // разрушенное должно читаться как дыра, а не как «то же самое, но темнее»
    this.bg = document.createElement('canvas');
    this.bg.width = Math.ceil(this.width * this.bgScale);
    this.bg.height = Math.ceil(this.pageHeight * this.bgScale);
    const bctx = this.bg.getContext('2d')!;
    bctx.fillStyle = '#1d1925';
    bctx.fillRect(0, 0, this.bg.width, this.bg.height);
    bctx.globalAlpha = 0.07;
    bctx.drawImage(tmp, 0, 0, this.bg.width, this.bg.height);
    bctx.globalAlpha = 1;
    bctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    const step = 16 * this.bgScale;
    for (let y = 0; y < this.bg.height; y += step) for (let x = 0; x < this.bg.width; x += step) bctx.fillRect(x, y, 1, 1);
  }

  private buildGrid(data: LevelData) {
    const { cs, cols, rows, owner } = this;
    data.elements.forEach((e, index) => {
      this.elements.push({
        index, id: e.id, type: e.type, x: e.x, y: e.y, w: e.w, h: e.h,
        cellsTotal: 0, cellsAlive: 0, hp: 0, maxHp: 0, dead: false, flash: 0, cracks: 0,
      });
      // клетка принадлежит элементу, если её центр внутри прямоугольника
      const c0 = Math.max(0, Math.round(e.x / cs));
      const c1 = Math.min(cols - 1, Math.round((e.x + e.w) / cs) - 1);
      const r0 = Math.max(0, Math.round(e.y / cs));
      const r1 = Math.min(rows - 1, Math.round((e.y + e.h) / cs) - 1);
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) owner[r * cols + c] = index;
    });
    for (let i = 0; i < owner.length; i++) if (owner[i] >= 0) this.elements[owner[i]].cellsTotal++;
    const hc = CONFIG.health;
    for (const el of this.elements) {
      el.cellsAlive = el.cellsTotal;
      if (el.cellsTotal === 0) el.dead = true; // целиком перекрыт другими
      const area = el.cellsTotal * cs * cs;
      el.maxHp = el.hp = hc.typeMultiplier[el.type] * (hc.base + hc.perSqrtArea * Math.sqrt(area));
      this.totalCells += el.cellsTotal;
    }
  }

  private clearUnownedCells() {
    const { cs, cols, rows, owner } = this;
    for (let r = 0; r < rows; r++) {
      let start = -1;
      for (let c = 0; c <= cols; c++) {
        const empty = c < cols && owner[r * cols + c] < 0;
        if (empty && start < 0) start = c;
        if (!empty && start >= 0) {
          this.fg.clearRect(start * cs, r * cs, (c - start) * cs, cs);
          start = -1;
        }
      }
    }
  }

  // ---------- запросы ----------

  isSolid(c: number, r: number): boolean {
    return c >= 0 && r >= 0 && c < this.cols && r < this.rows && this.owner[r * this.cols + c] >= 0;
  }

  /** Поверхность: твёрдая клетка, над которой пусто */
  isSurface(c: number, r: number): boolean {
    return this.isSolid(c, r) && !this.isSolid(c, r - 1);
  }

  elementAt(x: number, y: number): RuntimeElement | null {
    const c = Math.floor(x / this.cs);
    const r = Math.floor(y / this.cs);
    if (!this.isSolid(c, r)) return null;
    return this.elements[this.owner[r * this.cols + c]];
  }

  /** Цвет пикселя скриншота (ABGR для ImageData) */
  colorAt(x: number, y: number): number {
    const xi = Math.min(this.width - 1, Math.max(0, x | 0));
    const yi = Math.min(this.pageHeight - 1, Math.max(0, y | 0));
    return this.pixels[yi * this.width + xi] | 0xff000000;
  }

  get progress(): number {
    return this.totalCells ? this.destroyedCells / this.totalCells : 1;
  }

  get crumbling(): boolean {
    return this.queueHead < this.queueCells.length;
  }

  aliveElements(): RuntimeElement[] {
    return this.elements.filter((e) => !e.dead && e.cellsAlive > 0);
  }

  // ---------- разрушение ----------

  /**
   * Урон по кругу: всем элементам, чьи клетки попали в radius, наносится damage;
   * клетки этих элементов в chipRadius откалываются сразу.
   */
  damageArea(
    x: number, y: number, radius: number, damage: number, chipRadius: number,
    ix: number, iy: number, flash = true,
  ): RuntimeElement[] {
    const hit = new Set<number>();
    this.forCellsInCircle(x, y, radius, (idx) => {
      const o = this.owner[idx];
      if (o >= 0) hit.add(o);
    });
    const list = [...hit].map((i) => this.elements[i]);
    if (damage > 0) for (const el of list) this.applyDamage(el, damage, x, y, flash);
    if (chipRadius > 0) {
      this.forCellsInCircle(x, y, chipRadius, (idx) => {
        if (hit.has(this.owner[idx])) this.destroyCell(idx, ix, iy);
      });
    }
    return list;
  }

  applyDamage(el: RuntimeElement, damage: number, hx: number, hy: number, flash = true) {
    if (el.dead) return;
    el.hp -= damage;
    if (flash) el.flash = CONFIG.destruction.flashTime;
    const th = CONFIG.health.crackThresholds;
    while (el.cracks < th.length && el.hp / el.maxHp < th[el.cracks]) {
      this.drawCrack(el, hx, hy);
      el.cracks++;
    }
    if (el.hp <= 0) this.collapse(el, hx, hy);
  }

  /** Элемент рассыпается: клетки уходят в очередь, ближние к удару — первыми */
  collapse(el: RuntimeElement, hx: number, hy: number) {
    if (el.dead) return;
    el.dead = true;
    const { cs, cols } = this;
    const cells: { idx: number; d: number }[] = [];
    const c0 = Math.max(0, Math.floor(el.x / cs));
    const c1 = Math.min(cols - 1, Math.ceil((el.x + el.w) / cs));
    const r0 = Math.max(0, Math.floor(el.y / cs));
    const r1 = Math.min(this.rows - 1, Math.ceil((el.y + el.h) / cs));
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const idx = r * cols + c;
        if (this.owner[idx] !== el.index) continue;
        const dx = c * cs - hx;
        const dy = r * cs - hy;
        cells.push({ idx, d: dx * dx + dy * dy + Math.random() * 400 });
      }
    }
    cells.sort((a, b) => a.d - b.d);
    for (const c of cells) this.queueCells.push(c.idx);
    this.events.onCollapse(el);
  }

  collapseAll() {
    for (const el of this.aliveElements()) this.collapse(el, el.x + el.w / 2, el.y + el.h / 2);
  }

  destroyCell(idx: number, ix: number, iy: number) {
    const o = this.owner[idx];
    if (o < 0) return;
    const el = this.elements[o];
    this.owner[idx] = -1;
    el.cellsAlive--;
    if (el.cellsAlive <= 0) el.dead = true;
    this.destroyedCells++;
    this.version++;
    const x = (idx % this.cols) * this.cs;
    const y = Math.floor(idx / this.cols) * this.cs;
    this.fg.clearRect(x, y, this.cs, this.cs);
    this.events.onCellDestroyed(x, y, ix, iy);
  }

  update(dt: number) {
    for (const el of this.elements) if (el.flash > 0) el.flash -= dt;
    if (!this.crumbling) return;
    let n = Math.ceil(CONFIG.destruction.crumbleCellsPerSecond * dt);
    while (n-- > 0 && this.queueHead < this.queueCells.length) {
      const idx = this.queueCells[this.queueHead++];
      this.destroyCell(idx, (Math.random() - 0.5) * 120, -Math.random() * 120);
    }
    if (!this.crumbling) {
      this.queueCells = [];
      this.queueHead = 0;
    }
  }

  private forCellsInCircle(x: number, y: number, radius: number, fn: (idx: number) => void) {
    const { cs, cols, rows } = this;
    const c0 = Math.max(0, Math.floor((x - radius) / cs));
    const c1 = Math.min(cols - 1, Math.floor((x + radius) / cs));
    const r0 = Math.max(0, Math.floor((y - radius) / cs));
    const r1 = Math.min(rows - 1, Math.floor((y + radius) / cs));
    const r2 = radius * radius;
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const dx = (c + 0.5) * cs - x;
        const dy = (r + 0.5) * cs - y;
        if (dx * dx + dy * dy <= r2) fn(r * cols + c);
      }
    }
  }

  // ---------- следы на элементах ----------

  private inkFor(x: number, y: number, alpha: number): string {
    const c = this.colorAt(x, y);
    const lum = (c & 0xff) * 0.3 + ((c >> 8) & 0xff) * 0.59 + ((c >> 16) & 0xff) * 0.11;
    return lum > 110 ? `rgba(40, 25, 20, ${alpha})` : `rgba(255, 245, 230, ${alpha})`;
  }

  /** Следы когтей: три параллельные черты. source-atop — рисуем только по «живым» пикселям */
  scratch(x: number, y: number, dirX: number, dirY: number) {
    const ink = this.inkFor(x, y, 0.55);
    // черты поперёк направления взгляда, с наклоном
    const px = -dirY;
    const py = dirX;
    const len = 9 + Math.random() * 6;
    const lines: number[][] = [];
    for (let i = -1; i <= 1; i++) {
      const ox = x + dirX * i * 4 + (Math.random() - 0.5) * 2;
      const oy = y + dirY * i * 4 + (Math.random() - 0.5) * 2;
      lines.push([ox - px * len * 0.5 - dirX * 3, oy - py * len * 0.5 - dirY * 3, ox + px * len * 0.5 + dirX * 3, oy + py * len * 0.5 + dirY * 3]);
    }
    this.fg.paint(x - 20, y - 20, x + 20, y + 20, (ctx) => {
      ctx.globalCompositeOperation = 'source-atop';
      ctx.strokeStyle = ink;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (const [x1, y1, x2, y2] of lines) {
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
      }
      ctx.stroke();
    });
  }

  private drawCrack(el: RuntimeElement, hx: number, hy: number) {
    const ink = this.inkFor(el.x + el.w / 2, el.y + el.h / 2, 0.7);
    const branches = 2 + el.cracks;
    const polylines: number[][] = [];
    for (let b = 0; b < branches; b++) {
      let x = Math.min(el.x + el.w - 2, Math.max(el.x + 2, hx + (Math.random() - 0.5) * 20));
      let y = Math.min(el.y + el.h - 2, Math.max(el.y + 2, hy + (Math.random() - 0.5) * 20));
      let a = Math.random() * Math.PI * 2;
      const pts = [x, y];
      const steps = 3 + Math.floor(Math.random() * 4);
      for (let i = 0; i < steps; i++) {
        a += (Math.random() - 0.5) * 1.4;
        const len = 8 + Math.random() * Math.min(40, Math.max(el.w, el.h) * 0.15);
        x += Math.cos(a) * len;
        y += Math.sin(a) * len;
        pts.push(Math.round(x), Math.round(y));
      }
      polylines.push(pts);
    }
    // source-atop — трещины только по «живым» пикселям элемента
    this.fg.paint(el.x, el.y, el.x + el.w, el.y + el.h, (ctx) => {
      ctx.globalCompositeOperation = 'source-atop';
      ctx.strokeStyle = ink;
      ctx.lineWidth = 2;
      ctx.lineJoin = 'bevel';
      for (const pts of polylines) {
        ctx.beginPath();
        ctx.moveTo(pts[0], pts[1]);
        for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
        ctx.stroke();
      }
    });
  }
}
