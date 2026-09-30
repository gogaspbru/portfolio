import type { AnimName, AnimationDef, SpriteSheet } from './spriteSheet';

/*
 * Встроенный кот: оригинальный рыжий полосатый, нарисован кодом по «позам».
 * Каждая поза — положения тела, головы, лап и хвоста в пикселях кадра 32×26.
 * После рисования обводка добавляется автоматически.
 * Кот смотрит вправо; земля — строка G.
 */

const FW = 32;
const FH = 26;
const G = 24; // нижняя строка лап

// индексы палитры
const E = 0; // пусто
const K = 1; // обводка
const F = 2; // шерсть
const D = 3; // тёмные полоски, дальние лапы
const L = 4; // светлое: грудка, морда, лапки
const P = 5; // розовое: нос, уши, язык
const Y = 6; // глаза
const C = 7; // когти

const PALETTE = ['', '#2b1d2e', '#f2994a', '#c4622d', '#fde8d0', '#f48fb1', '#1f1a24', '#ffffff'];

type Leg = [hipX: number, hipY: number, footX: number, footY: number];

interface Pose {
  body: [cx: number, cy: number, rx: number, ry: number];
  head: [cx: number, cy: number];
  farLegs: Leg[];
  nearLegs: Leg[];
  tail: [number, number][];
  eyes?: 'open' | 'closed' | 'wide';
  tongue?: boolean;
  /** Лапа, которой бьют/точат, рисуется поверх всего */
  strike?: Leg;
  farStrike?: Leg;
  claws?: boolean;
  /** Сидячая поза: тело вертикальное, грудка шире */
  sitting?: boolean;
}

class Grid {
  d = new Uint8Array(FW * FH);
  set(x: number, y: number, c: number) {
    x = Math.round(x);
    y = Math.round(y);
    if (x >= 0 && y >= 0 && x < FW && y < FH) this.d[y * FW + x] = c;
  }
  get(x: number, y: number) {
    return x >= 0 && y >= 0 && x < FW && y < FH ? this.d[y * FW + x] : E;
  }
  ellipse(cx: number, cy: number, rx: number, ry: number, c: number) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x + 0.5 - cx) / rx;
        const dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.set(x, y, c);
      }
    }
  }
  line(x0: number, y0: number, x1: number, y1: number, c: number, thick = 1) {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1) * 2;
    for (let i = 0; i <= steps; i++) {
      const x = x0 + ((x1 - x0) * i) / steps;
      const y = y0 + ((y1 - y0) * i) / steps;
      for (let ty = 0; ty < thick; ty++) for (let tx = 0; tx < thick; tx++) this.set(Math.floor(x) + tx, Math.floor(y) + ty, c);
    }
  }
  tri(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, c: number) {
    const minX = Math.floor(Math.min(ax, bx, cx));
    const maxX = Math.ceil(Math.max(ax, bx, cx));
    const minY = Math.floor(Math.min(ay, by, cy));
    const maxY = Math.ceil(Math.max(ay, by, cy));
    const s = (px: number, py: number, qx: number, qy: number, rx: number, ry: number) => (px - rx) * (qy - ry) - (qx - rx) * (py - ry);
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const px = x + 0.5;
        const py = y + 0.5;
        const d1 = s(px, py, ax, ay, bx, by);
        const d2 = s(px, py, bx, by, cx, cy);
        const d3 = s(px, py, cx, cy, ax, ay);
        const neg = d1 < 0 || d2 < 0 || d3 < 0;
        const pos = d1 > 0 || d2 > 0 || d3 > 0;
        if (!(neg && pos)) this.set(x, y, c);
      }
    }
  }
  outline() {
    const src = this.d.slice();
    for (let y = 0; y < FH; y++) {
      for (let x = 0; x < FW; x++) {
        if (src[y * FW + x] !== E) continue;
        const n = [this.at(src, x - 1, y), this.at(src, x + 1, y), this.at(src, x, y - 1), this.at(src, x, y + 1)];
        if (n.some((v) => v !== E && v !== K)) this.d[y * FW + x] = K;
      }
    }
  }
  private at(src: Uint8Array, x: number, y: number) {
    return x >= 0 && y >= 0 && x < FW && y < FH ? src[y * FW + x] : E;
  }
}

function leg(g: Grid, [hx, hy, fx, fy]: Leg, color: number) {
  g.line(hx, hy, fx, fy, color, 2);
  g.set(fx, fy + 1, L);
  g.set(fx + 1, fy + 1, L);
}

function drawPose(p: Pose): Grid {
  const g = new Grid();
  // хвост
  for (let i = 0; i < p.tail.length - 1; i++) {
    const [x0, y0] = p.tail[i];
    const [x1, y1] = p.tail[i + 1];
    g.line(x0, y0, x1, y1, i >= p.tail.length - 2 ? D : F, 2);
  }
  // дальние лапы — темнее, для объёма
  for (const l of p.farLegs) leg(g, l, D);
  if (p.farStrike) leg(g, p.farStrike, D);
  // тело
  const [bx, by, brx, bry] = p.body;
  g.ellipse(bx, by, brx, bry, F);
  if (p.sitting) {
    g.ellipse(bx + 2, by + 1, brx - 3, bry - 2, L);
    g.line(bx - 4, by - bry + 3, bx - 3, by - bry + 4, D);
    g.line(bx - 5, by - 1, bx - 4, by, D);
  } else {
    g.ellipse(bx + 1, by + bry - 1.2, brx - 3, 1.5, L);
    for (const ox of [-4, -1, 2]) g.line(bx + ox, by - bry + 0.5, bx + ox, by - bry + 2, D);
  }
  // ближние лапы
  for (const l of p.nearLegs) leg(g, l, F);
  // голова
  const [hx, hy] = p.head;
  g.tri(hx - 5.5, hy - 1, hx - 4.5, hy - 7.5, hx - 0.5, hy - 3.5, F);
  g.tri(hx + 0.5, hy - 3.5, hx + 3.5, hy - 7.5, hx + 5.5, hy - 1, F);
  g.set(hx - 4, hy - 5, P);
  g.set(hx + 3, hy - 5, P);
  g.ellipse(hx, hy, 5.6, 4.6, F);
  g.set(hx, hy - 4, D);
  g.set(hx - 1, hy - 3, D);
  g.set(hx + 1, hy - 3, D);
  g.ellipse(hx + 2.6, hy + 2, 2.6, 1.7, L);
  g.set(hx + 4, hy + 1, P);
  const eyes = p.eyes ?? 'open';
  for (const ex of [hx - 1.5, hx + 2.5]) {
    if (eyes === 'closed') {
      g.set(ex - 0.5, hy, Y);
      g.set(ex + 0.5, hy, Y);
    } else {
      g.set(ex, hy - 1, Y);
      g.set(ex, hy, Y);
      if (eyes === 'wide') {
        g.set(ex + 1, hy - 1, Y);
        g.set(ex + 1, hy, Y);
      }
    }
  }
  if (p.tongue) g.set(hx + 4, hy + 3, P);
  // ударная лапа
  if (p.strike) {
    const [sx, sy, fx, fy] = p.strike;
    g.line(sx, sy, fx, fy, F, 2);
    g.set(fx, fy, L);
    g.set(fx + 1, fy, L);
    g.set(fx, fy + 1, L);
    g.set(fx + 1, fy + 1, L);
  }
  g.outline();
  // когти — после обводки, чтобы торчали белыми
  const clawsAt = (l?: Leg) => {
    if (!l) return;
    const [, , fx, fy] = l;
    g.set(fx + 2, fy - 1, C);
    g.set(fx + 2, fy + 1, C);
    g.set(fx + 3, fy, C);
  };
  if (p.claws) {
    clawsAt(p.strike);
    clawsAt(p.farStrike);
  }
  return g;
}

// ---------- позы ----------

const standTail: [number, number][] = [[7, G - 9], [5, G - 11], [4, G - 14], [5, G - 17], [7, G - 18]];

function stand(o: Partial<Pose> = {}): Pose {
  return {
    body: [15, G - 8, 8.5, 4.5],
    head: [24, G - 15],
    farLegs: [[10, G - 5, 10, G - 1], [19, G - 5, 19, G - 1]],
    nearLegs: [[12, G - 5, 12, G - 1], [21, G - 5, 21, G - 1]],
    tail: standTail,
    ...o,
  };
}

function runPose(i: number, n: number): Pose {
  const ph = (i / n) * Math.PI * 2;
  const bob = Math.round(Math.sin(ph * 2) * 0.8) - 1;
  const legAt = (hipX: number, phase: number): Leg => [
    hipX, G - 5 + bob,
    hipX + Math.round(Math.cos(phase) * 3),
    G - 1 - Math.max(0, Math.round(Math.sin(phase) * 2)),
  ];
  const wave = Math.round(Math.sin(ph) * 1.5);
  return {
    body: [15, G - 8 + bob, 9, 4.3],
    head: [24, G - 15 + bob],
    farLegs: [legAt(10, ph + 0.7), legAt(19, ph + Math.PI + 0.7)],
    nearLegs: [legAt(12, ph), legAt(21, ph + Math.PI)],
    tail: [[7, G - 9 + bob], [4, G - 11 + bob], [2, G - 13 + wave], [1, G - 15 + wave]],
  };
}

const POSES: Record<AnimName, { poses: Pose[]; def: Omit<AnimationDef, 'frames'> }> = {
  idle: {
    def: { fps: 4, loop: true },
    poses: [
      stand(),
      stand({ tail: [[7, G - 9], [5, G - 11], [4, G - 14], [4, G - 17], [6, G - 19]] }),
      stand(),
      stand({ eyes: 'closed' }),
    ],
  },
  run: { def: { fps: 14, loop: true }, poses: [0, 1, 2, 3, 4, 5].map((i) => runPose(i, 6)) },
  jump: {
    def: { fps: 1, loop: false },
    poses: [{
      body: [15, G - 10, 9, 4],
      head: [25, G - 16],
      farLegs: [[10, G - 7, 5, G - 3], [20, G - 8, 25, G - 9]],
      nearLegs: [[12, G - 7, 8, G - 2], [22, G - 8, 27, G - 8]],
      tail: [[7, G - 10], [3, G - 12], [1, G - 13]],
    }],
  },
  fall: {
    def: { fps: 1, loop: false },
    poses: [{
      body: [15, G - 9, 8.5, 4.5],
      head: [24, G - 16],
      farLegs: [[10, G - 6, 9, G - 1], [19, G - 6, 21, G - 2]],
      nearLegs: [[12, G - 6, 11, G - 1], [21, G - 6, 23, G - 2]],
      tail: [[7, G - 10], [5, G - 14], [5, G - 18], [7, G - 20]],
      eyes: 'wide',
    }],
  },
  flip: {
    def: { fps: 1, loop: false },
    poses: [{
      body: [16, G - 9, 7, 5.5],
      head: [22, G - 12],
      farLegs: [[13, G - 5, 16, G - 4]],
      nearLegs: [[18, G - 5, 20, G - 5]],
      tail: [[10, G - 6], [9, G - 10], [11, G - 14]],
      eyes: 'closed',
    }],
  },
  land: {
    def: { fps: 14, loop: false },
    poses: [
      {
        body: [15, G - 6, 9.5, 3.6],
        head: [24, G - 12],
        farLegs: [[9, G - 3, 8, G - 1], [20, G - 3, 21, G - 1]],
        nearLegs: [[12, G - 3, 11, G - 1], [22, G - 3, 23, G - 1]],
        tail: [[6, G - 7], [3, G - 8], [1, G - 10]],
      },
      stand({ body: [15, G - 7, 9, 4], head: [24, G - 14] }),
    ],
  },
  paw: {
    def: { fps: 22, loop: false },
    poses: [
      stand({ body: [15, G - 9, 8.5, 4.5], head: [23, G - 16], nearLegs: [[12, G - 5, 12, G - 1]], strike: [20, G - 8, 22, G - 15] }),
      stand({ body: [15, G - 9, 8.5, 4.5], head: [23, G - 16], nearLegs: [[12, G - 5, 12, G - 1]], strike: [21, G - 9, 28, G - 11], claws: true }),
      stand({ body: [15, G - 8, 8.5, 4.5], head: [23, G - 15], nearLegs: [[12, G - 5, 12, G - 1]], strike: [21, G - 7, 27, G - 5], claws: true }),
    ],
  },
  scratch: {
    def: { fps: 14, loop: true },
    poses: [0, 1, 2, 3].map((i) => {
      const up = i % 2 === 0;
      return {
        body: [14, G - 9, 8, 4.8] as Pose['body'],
        head: [22, G - 16] as Pose['head'],
        farLegs: [[9, G - 6, 9, G - 1]] as Leg[],
        nearLegs: [[11, G - 6, 11, G - 1]] as Leg[],
        strike: [20, G - 9, 27, up ? G - 13 : G - 8] as Leg,
        farStrike: [19, G - 9, 26, up ? G - 8 : G - 13] as Leg,
        claws: true,
        tail: [[6, G - 9], [4, G - 12], [4, G - 16], [6 + (i % 2), G - 18]] as [number, number][],
        eyes: i === 3 ? 'closed' : 'open',
      } satisfies Pose;
    }),
  },
  climb: {
    def: { fps: 8, loop: true },
    poses: [0, 1].map((i) => ({
      body: [15, G - 9, 5, 7.5] as Pose['body'],
      head: [18, G - 18] as Pose['head'],
      farLegs: [[13, G - 4, 12 + i, G - 1]] as Leg[],
      nearLegs: [[16, G - 4, 17 - i, G - 1]] as Leg[],
      strike: [18, G - 12, 23, i ? G - 18 : G - 15] as Leg,
      farStrike: [17, G - 12, 22, i ? G - 14 : G - 18] as Leg,
      claws: true,
      tail: [[12, G - 3], [9, G - 1], [6, G - 1], [5, G - 3]] as [number, number][],
    } satisfies Pose)),
  },
  sit: { def: { fps: 1, loop: false }, poses: [sitPose()] },
  wash: {
    def: { fps: 5, loop: true },
    poses: [
      sitPose({ eyes: 'closed', strike: [17, G - 7, 20, G - 13] }),
      sitPose({ eyes: 'closed', strike: [17, G - 7, 20, G - 14], tongue: true }),
      sitPose({ eyes: 'closed', strike: [17, G - 7, 19, G - 12], head: [18, G - 15] }),
      sitPose({ eyes: 'closed', strike: [17, G - 7, 20, G - 14], tongue: true }),
    ],
  },
};

function sitPose(o: Partial<Pose> = {}): Pose {
  return {
    sitting: true,
    body: [14, G - 6, 6, 6.5],
    head: [17, G - 15],
    farLegs: [[18, G - 4, 18, G - 1]],
    nearLegs: [[15, G - 4, 15, G - 1]],
    tail: [[9, G - 1], [6, G], [3, G], [2, G - 3], [3, G - 5]],
    ...o,
  };
}

/** Собирает спрайт-лист из поз */
export function buildProceduralCat(): SpriteSheet {
  const columns = 8;
  const frames: Grid[] = [];
  const animations: SpriteSheet['animations'] = {};
  for (const name of Object.keys(POSES) as AnimName[]) {
    const { poses, def } = POSES[name];
    const idx: number[] = [];
    for (const p of poses) {
      idx.push(frames.length);
      frames.push(drawPose(p));
    }
    animations[name] = { frames: idx, ...def };
  }
  const rows = Math.ceil(frames.length / columns);
  const canvas = document.createElement('canvas');
  canvas.width = columns * FW;
  canvas.height = rows * FH;
  const ctx = canvas.getContext('2d')!;
  frames.forEach((g, i) => {
    const ox = (i % columns) * FW;
    const oy = Math.floor(i / columns) * FH;
    for (let y = 0; y < FH; y++) {
      for (let x = 0; x < FW; x++) {
        const c = g.d[y * FW + x];
        if (c === E) continue;
        ctx.fillStyle = PALETTE[c];
        ctx.fillRect(ox + x, oy + y, 1, 1);
      }
    }
  });
  return { image: canvas, frameWidth: FW, frameHeight: FH, columns, anchorX: 16, anchorY: G + 1, animations };
}
