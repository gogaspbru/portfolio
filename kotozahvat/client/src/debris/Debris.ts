import { CONFIG } from '../config';

/**
 * Пиксельные осколки и куча.
 *
 * Летящие осколки — массивы фиксированного размера (без аллокаций в кадре).
 * Упавший осколок перестаёт быть частицей: он «впекается» в кучу —
 * карту высот по колонкам + маленькую картинку. Поэтому куча может расти
 * сколько угодно, а стоимость кадра зависит только от числа летящих осколков.
 *
 * Осколки летят сквозь платформы (так дешевле и не бывает «висящих» куч
 * на разрушенных элементах) и копятся только внизу.
 */
export class Debris {
  readonly px = CONFIG.debris.pixel;
  readonly cols: number;
  readonly maxRows: number;
  readonly floorY: number;
  private readonly worldWidth: number;

  private max: number;
  private x: Float32Array;
  private y: Float32Array;
  private vx: Float32Array;
  private vy: Float32Array;
  private color: Uint32Array;
  count = 0;

  /** Высота кучи в каждой колонке, в осколках */
  readonly pileH: Int16Array;
  private pileData: Uint32Array;
  private pileImage: ImageData;
  private pileCanvas: HTMLCanvasElement;
  private pileCtx: CanvasRenderingContext2D;
  private pileDirty = false;
  /** Вероятность, что осевший осколок добавит высоты (чтобы куча не выросла выше maxPileHeight) */
  private pileChance = 1;

  private viewCanvas: HTMLCanvasElement;
  private viewCtx: CanvasRenderingContext2D;
  private viewImage: ImageData | null = null;
  private viewData: Uint32Array | null = null;

  constructor(worldWidth: number, floorY: number, expectedParticles: number, maxLive: number = CONFIG.debris.maxLive) {
    this.worldWidth = worldWidth;
    this.floorY = floorY;
    this.cols = Math.ceil(worldWidth / this.px);
    this.maxRows = Math.ceil((CONFIG.debris.maxPileHeight * 1.3) / this.px);
    this.max = maxLive;
    this.x = new Float32Array(this.max);
    this.y = new Float32Array(this.max);
    this.vx = new Float32Array(this.max);
    this.vy = new Float32Array(this.max);
    this.color = new Uint32Array(this.max);

    this.pileH = new Int16Array(this.cols);
    this.pileCanvas = document.createElement('canvas');
    this.pileCanvas.width = this.cols;
    this.pileCanvas.height = this.maxRows;
    this.pileCtx = this.pileCanvas.getContext('2d')!;
    this.pileImage = this.pileCtx.createImageData(this.cols, this.maxRows);
    this.pileData = new Uint32Array(this.pileImage.data.buffer);

    const capacity = this.cols * (CONFIG.debris.maxPileHeight / this.px);
    this.pileChance = Math.min(1, capacity / Math.max(1, expectedParticles));

    this.viewCanvas = document.createElement('canvas');
    this.viewCtx = this.viewCanvas.getContext('2d')!;
  }

  get capacity() {
    return this.max;
  }

  /** Верх кучи в точке x (мировые координаты) */
  pileTopAt(x: number): number {
    const c = Math.min(this.cols - 1, Math.max(0, Math.floor(x / this.px)));
    return this.floorY - this.pileH[c] * this.px;
  }

  /** Самая высокая точка кучи на отрезке [x1, x2] */
  pileTopIn(x1: number, x2: number): number {
    const c1 = Math.max(0, Math.floor(x1 / this.px));
    const c2 = Math.min(this.cols - 1, Math.floor(x2 / this.px));
    let h = 0;
    for (let c = c1; c <= c2; c++) if (this.pileH[c] > h) h = this.pileH[c];
    return this.floorY - h * this.px;
  }

  spawn(x: number, y: number, vx: number, vy: number, color: number) {
    if (this.count >= this.max) {
      // лимит — осколок сразу ложится в кучу, чтобы она всё равно росла
      this.settle(x, color);
      return;
    }
    const i = this.count++;
    this.x[i] = x;
    this.y[i] = y;
    this.vx[i] = vx;
    this.vy[i] = vy;
    this.color[i] = color;
  }

  update(dt: number) {
    const g = CONFIG.debris.gravity * dt;
    const maxX = this.worldWidth - 1;
    const bounce = CONFIG.debris.wallBounce;
    const { x, y, vx, vy, px, pileH, floorY } = this;
    let i = 0;
    while (i < this.count) {
      vy[i] += g;
      x[i] += vx[i] * dt;
      y[i] += vy[i] * dt;
      if (x[i] < 0) { x[i] = 0; vx[i] = -vx[i] * bounce; }
      else if (x[i] > maxX) { x[i] = maxX; vx[i] = -vx[i] * bounce; }
      const c = (x[i] / px) | 0;
      if (y[i] >= floorY - pileH[c] * px) {
        this.settle(x[i], this.color[i]);
        // удаление: последний на место текущего
        const last = --this.count;
        x[i] = x[last]; y[i] = y[last]; vx[i] = vx[last]; vy[i] = vy[last];
        this.color[i] = this.color[last];
        continue;
      }
      i++;
    }
  }

  /** Осколок ложится в кучу; как песок — скатывается, если сосед ниже */
  private settle(wx: number, color: number) {
    const { pileH, cols } = this;
    let c = Math.min(cols - 1, Math.max(0, (wx / this.px) | 0));
    for (let step = 0; step < 8; step++) {
      const h = pileH[c];
      const l = c > 0 ? pileH[c - 1] : 1e9;
      const r = c < cols - 1 ? pileH[c + 1] : 1e9;
      const canL = l < h - 1;
      const canR = r < h - 1;
      if (canL && canR) c += Math.random() < 0.5 ? -1 : 1;
      else if (canL) c -= 1;
      else if (canR) c += 1;
      else break;
    }
    if (Math.random() < this.pileChance && pileH[c] < this.maxRows) {
      pileH[c]++;
      this.pileData[(this.maxRows - pileH[c]) * cols + c] = color;
      this.pileDirty = true;
    } else if (pileH[c] > 0 && Math.random() < 0.5) {
      // не растим, а перекрашиваем верхушку — куча «шевелится»
      this.pileData[(this.maxRows - pileH[c]) * cols + c] = color;
      this.pileDirty = true;
    }
  }

  /** Рисует кучу и осколки. ctx уже в мировых координатах. view — видимая область мира */
  render(ctx: CanvasRenderingContext2D, view: { x: number; y: number; w: number; h: number }) {
    const px = this.px;
    ctx.imageSmoothingEnabled = false;

    if (this.pileDirty) {
      this.pileCtx.putImageData(this.pileImage, 0, 0);
      this.pileDirty = false;
    }
    ctx.drawImage(this.pileCanvas, 0, this.floorY - this.maxRows * px, this.cols * px, this.maxRows * px);

    if (this.count === 0) return;
    // Осколки пишем прямо в буфер размером с видимую область (1 пиксель = 1 осколок)
    const gx0 = Math.floor(view.x / px);
    const gy0 = Math.floor(view.y / px);
    const gw = Math.ceil(view.w / px) + 2;
    const gh = Math.ceil(view.h / px) + 2;
    if (!this.viewImage || this.viewImage.width !== gw || this.viewImage.height !== gh) {
      this.viewCanvas.width = gw;
      this.viewCanvas.height = gh;
      this.viewImage = this.viewCtx.createImageData(gw, gh);
      this.viewData = new Uint32Array(this.viewImage.data.buffer);
    }
    const data = this.viewData!;
    data.fill(0);
    const { x, y, color } = this;
    for (let i = 0; i < this.count; i++) {
      const gx = ((x[i] / px) | 0) - gx0;
      const gy = ((y[i] / px) | 0) - gy0;
      if (gx < 0 || gy < 0 || gx >= gw || gy >= gh) continue;
      data[gy * gw + gx] = color[i];
    }
    this.viewCtx.putImageData(this.viewImage, 0, 0);
    ctx.drawImage(this.viewCanvas, gx0 * px, gy0 * px, gw * px, gh * px);
  }
}
