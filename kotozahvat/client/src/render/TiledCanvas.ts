/**
 * Большой холст, нарезанный на плитки 256×256.
 * Зачем: один холст размером со страницу (1280×2400+) — это одна огромная
 * текстура; при каждом отколотом кусочке браузер её обновляет, а часть
 * мобильных GPU и headless Chromium обращаются с такими текстурами ненадёжно.
 * Плитки обновляются и рисуются по отдельности, только видимые.
 */
export class TiledCanvas {
  static readonly TILE = 256;
  readonly cols: number;
  readonly rows: number;
  private tiles: HTMLCanvasElement[] = [];
  private ctxs: CanvasRenderingContext2D[] = [];

  constructor(readonly width: number, readonly height: number) {
    const T = TiledCanvas.TILE;
    this.cols = Math.ceil(width / T);
    this.rows = Math.ceil(height / T);
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const cv = document.createElement('canvas');
        cv.width = Math.min(T, width - c * T);
        cv.height = Math.min(T, height - r * T);
        this.tiles.push(cv);
        this.ctxs.push(cv.getContext('2d')!);
      }
    }
  }

  /** Выполнить рисование в мировых координатах на всех плитках, задевающих прямоугольник */
  paint(x1: number, y1: number, x2: number, y2: number, fn: (ctx: CanvasRenderingContext2D) => void) {
    const T = TiledCanvas.TILE;
    const c0 = Math.max(0, Math.floor(x1 / T));
    const c1 = Math.min(this.cols - 1, Math.floor(x2 / T));
    const r0 = Math.max(0, Math.floor(y1 / T));
    const r1 = Math.min(this.rows - 1, Math.floor(y2 / T));
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const ctx = this.ctxs[r * this.cols + c];
        ctx.save();
        ctx.translate(-c * T, -r * T);
        fn(ctx);
        ctx.restore();
      }
    }
  }

  clearRect(x: number, y: number, w: number, h: number) {
    this.paint(x, y, x + w - 1, y + h - 1, (ctx) => ctx.clearRect(x, y, w, h));
  }

  /** Нарисовать видимые плитки. ctx — уже в мировых координатах */
  draw(ctx: CanvasRenderingContext2D, view: { x: number; y: number; w: number; h: number }) {
    const T = TiledCanvas.TILE;
    const c0 = Math.max(0, Math.floor(view.x / T));
    const c1 = Math.min(this.cols - 1, Math.floor((view.x + view.w) / T));
    const r0 = Math.max(0, Math.floor(view.y / T));
    const r1 = Math.min(this.rows - 1, Math.floor((view.y + view.h) / T));
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) ctx.drawImage(this.tiles[r * this.cols + c], c * T, r * T);
    }
  }
}
