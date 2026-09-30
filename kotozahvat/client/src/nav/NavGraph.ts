import { CONFIG } from '../config';
import type { Debris } from '../debris/Debris';
import type { Level } from '../level/Level';

/** Горизонтальная площадка, на которой кот может стоять */
export interface Segment {
  id: number;
  x1: number;
  x2: number;
  /** Высота поверхности (для кучи — вычисляется по месту, см. NavGraph.yOf) */
  y: number;
  row: number;
  pile: boolean;
}

/**
 * Граф площадок для автопилота на телефоне.
 * Вершины — непрерывные куски поверхностей в одной строке сетки + куча внизу.
 * Рёбра не хранятся: достижимость считается на лету грубой оценкой
 * по высоте прыжка/кульбита и дальности полёта. Идеальной точности не нужно —
 * если кот приземлится не туда, автопилот просто перестроит путь.
 */
export class NavGraph {
  readonly segments: Segment[] = [];
  readonly pile: Segment;
  readonly version: number;
  private byRow = new Map<number, Segment[]>();

  // Грубые возможности кота (с запасом)
  private readonly singleRise: number;
  private readonly maxRise: number;

  constructor(private level: Level, private debris: Debris) {
    const g = CONFIG.physics.gravity;
    const { jumpVelocity, doubleJumpVelocity } = CONFIG.cat;
    this.singleRise = ((jumpVelocity * jumpVelocity) / (2 * g)) * 0.85;
    this.maxRise = ((jumpVelocity * jumpVelocity + doubleJumpVelocity * doubleJumpVelocity) / (2 * g)) * 0.82;
    this.version = level.version;
    this.pile = { id: 0, x1: 0, x2: level.width, y: debris.floorY, row: -1, pile: true };
    this.segments.push(this.pile);
    this.build();
  }

  private build() {
    const { level } = this;
    const cs = level.cs;
    for (let r = 0; r < level.rows; r++) {
      let start = -1;
      for (let c = 0; c <= level.cols; c++) {
        const s = c < level.cols && level.isSurface(c, r);
        if (s && start < 0) start = c;
        if (!s && start >= 0) {
          const seg: Segment = { id: this.segments.length, x1: start * cs, x2: c * cs, y: r * cs, row: r, pile: false };
          this.segments.push(seg);
          let list = this.byRow.get(r);
          if (!list) this.byRow.set(r, (list = []));
          list.push(seg);
          start = -1;
        }
      }
    }
  }

  yOf(seg: Segment, x: number): number {
    return seg.pile ? this.debris.pileTopAt(x) : seg.y;
  }

  /** Площадка, на которой стоит кот */
  segmentUnder(x: number, feetY: number, halfW: number, onPile: boolean): Segment | null {
    if (onPile) return this.pile;
    const row = Math.round(feetY / this.level.cs);
    const list = this.byRow.get(row);
    if (!list) return null;
    for (const s of list) if (s.x2 > x - halfW && s.x1 < x + halfW) return s;
    return null;
  }

  /** Первая площадка под точкой (или куча) */
  segmentBelow(x: number, y: number): Segment {
    const cs = this.level.cs;
    const c = Math.floor(x / cs);
    const pileY = this.debris.pileTopAt(x);
    for (let r = Math.max(0, Math.floor(y / cs)); r < this.level.rows && r * cs < pileY; r++) {
      const list = this.byRow.get(r);
      if (!list) continue;
      for (const s of list) if (s.x1 <= (c + 2) * cs && s.x2 >= (c - 1) * cs) return s;
    }
    return this.pile;
  }

  /** Верх элемента, по которому тапнули: поднимаемся по твёрдым клеткам до поверхности */
  segmentOnTopOf(x: number, y: number): Segment {
    const cs = this.level.cs;
    const c = Math.floor(x / cs);
    let r = Math.floor(y / cs);
    while (r > 0 && this.level.isSolid(c, r - 1)) r--;
    return this.segmentBelow(x, r * cs);
  }

  /** Можно ли допрыгнуть/дойти/упасть с a на b, и сколько это «стоит» */
  private edgeCost(a: Segment, b: Segment): number {
    const bx = (b.x1 + b.x2) / 2;
    const ay = this.yOf(a, Math.max(a.x1, Math.min(a.x2, bx)));
    const by = this.yOf(b, Math.max(b.x1, Math.min(b.x2, (a.x1 + a.x2) / 2)));
    const gap = Math.max(0, b.x1 - a.x2, a.x1 - b.x2);
    const overlap = Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1);
    const dy = by - ay;
    const dx = Math.abs(bx - (a.x1 + a.x2) / 2);
    let ok: boolean;
    if (dy > 2) {
      // вниз: спрыгнуть сквозь, сойти с края или перепрыгнуть
      if (b.pile) ok = true;
      else if (overlap > 12) ok = !a.pile;
      else ok = gap <= 200 + Math.min(200, dy * 0.6);
    } else if (dy < -2) {
      const rise = -dy;
      if (rise > this.maxRise && !CONFIG.climb.enabled) ok = false;
      else ok = gap <= (rise < this.singleRise ? 190 : 120);
      // лезть дольше, чем прыгать
      if (ok && rise > this.maxRise) return dx + this.maxRise * 1.2 + (rise - this.maxRise) * 3 + 40;
    } else {
      ok = gap <= 200;
    }
    return ok ? dx + Math.abs(dy) * 1.2 + 40 : Infinity;
  }

  /** Дейкстра по площадкам. Возвращает путь от from до to включительно или null */
  findPath(from: Segment, to: Segment): Segment[] | null {
    if (from.id === to.id) return [from];
    const n = this.segments.length;
    const dist = new Float64Array(n).fill(Infinity);
    const prev = new Int32Array(n).fill(-1);
    const done = new Uint8Array(n);
    dist[from.id] = 0;
    for (let iter = 0; iter < n; iter++) {
      let u = -1;
      let best = Infinity;
      for (let i = 0; i < n; i++) if (!done[i] && dist[i] < best) { best = dist[i]; u = i; }
      if (u < 0 || u === to.id) break;
      done[u] = 1;
      const su = this.segments[u];
      for (let v = 0; v < n; v++) {
        if (done[v] || v === u) continue;
        const sv = this.segments[v];
        if (!sv.pile && !su.pile && Math.abs(sv.y - su.y) > 700) continue;
        const cost = this.edgeCost(su, sv);
        if (best + cost < dist[v]) { dist[v] = best + cost; prev[v] = u; }
      }
    }
    if (!isFinite(dist[to.id])) return null;
    const path: Segment[] = [];
    for (let v = to.id; v >= 0; v = prev[v]) path.push(this.segments[v]);
    return path.reverse();
  }
}
