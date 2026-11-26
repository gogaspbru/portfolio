import type { Cat } from '../cat/Cat';
import type { Debris } from '../debris/Debris';
import type { Commands } from '../input/commands';
import type { Level } from '../level/Level';
import { NavGraph, type Segment } from './NavGraph';

/**
 * Автопилот для телефона: «тапнул — кот сам добежал/допрыгал».
 * Каждый шаг выдаёт команды (бег, прыжок, спрыгнуть) как будто их нажимает игрок.
 * После каждого приземления путь перестраивается — так автопилот переживает
 * промахи и разрушенные по дороге платформы.
 */
export class Navigator {
  active = false;
  private graph: NavGraph | null = null;
  private goal: Segment | null = null;
  private goalX = 0;
  private path: Segment[] = [];
  private lastSeg = -2;
  private airTarget: Segment | null = null;
  /** Куда был прыжок/шаг к airTarget: от этого зависит, держать ли прыжок в воздухе */
  private airMode: 'up' | 'down' | 'level' = 'level';
  private sinceProgress = 0;
  /** Лучшее расстояние до цели — если оно уменьшается, мы не застряли */
  private bestDist = Infinity;
  private onArrive: (() => void) | null = null;

  constructor(private level: Level, private debris: Debris) {}

  private graphAge = 0;

  /** Граф пересобирается, если сетка изменилась, но не чаще раза в 0.3 с */
  private getGraph(force = false): NavGraph {
    const stale = !this.graph || this.graph.version !== this.level.version;
    if (stale && (force || !this.graph || this.graphAge > 0.3)) {
      this.graph = new NavGraph(this.level, this.debris);
      this.graphAge = 0;
    }
    return this.graph!;
  }

  /** Идти к точке мира. Если точка внутри элемента — на его верх */
  goTo(x: number, y: number, onArrive?: () => void) {
    const g = this.getGraph(true);
    this.goal = this.level.elementAt(x, y) ? g.segmentOnTopOf(x, y) : g.segmentBelow(x, y);
    this.goalX = Math.max(this.goal.x1 + 6, Math.min(this.goal.x2 - 6, x));
    this.active = true;
    this.lastSeg = -2;
    this.path = [];
    // airTarget не сбрасываем: если кот сейчас в прыжке/лазанье, пусть долетит
    this.sinceProgress = 0;
    this.bestDist = Infinity;
    this.onArrive = onArrive ?? null;
  }

  cancel() {
    this.active = false;
    this.goal = null;
    this.path = [];
    this.airTarget = null;
  }

  /** Для отладки: текущий путь */
  get debugPath(): Segment[] {
    return this.path;
  }

  update(cat: Cat, dt: number, cmd: Commands) {
    if (!this.active || !this.goal) return;
    this.sinceProgress += dt;
    this.graphAge += dt;
    const dist = Math.hypot(this.goalX - cat.x, this.goal.y - cat.y);
    if (dist < this.bestDist - 4) {
      this.bestDist = dist;
      this.sinceProgress = 0;
    }
    if (this.sinceProgress > 4) {
      this.cancel(); // застряли — сдаёмся, игрок тапнет ещё раз
      return;
    }
    const g = this.getGraph();
    const toward = (tx: number) => {
      const d = tx - cat.x;
      cmd.moveX = Math.abs(d) < 5 ? 0 : Math.abs(d) < 24 ? Math.sign(d) * 0.4 : Math.sign(d);
    };

    if (!cat.onGround) {
      const t = this.airTarget;
      if (t) {
        toward(t.pile ? this.goalX : Math.max(t.x1 + 10, Math.min(t.x2 - 10, cat.x)));
        const ty = g.yOf(t, cat.x);
        const over = cat.x > t.x1 && cat.x < t.x2;
        if (this.airMode === 'up') {
          // пока лапы ниже цели — держим прыжок (кульбит, потом лазанье); выше — отпускаем и падаем на неё
          cmd.jumpHeld = cat.y > ty - 6;
          if (cat.y > ty + 4 && cat.vy > -80 && !cat.usedDoubleJump && !cat.climbing) cmd.jump = true;
        } else if (this.airMode === 'level') {
          cmd.jumpHeld = cat.vy < 0 || (!over && cat.y > ty + 4);
          if (!over && cat.y > ty + 4 && cat.vy > 0 && !cat.usedDoubleJump) cmd.jump = true;
        }
      } else {
        toward(this.goalX);
      }
      return;
    }

    const cur = g.segmentUnder(cat.x, cat.y, cat.w / 2 - 6, cat.onPile);
    if (!cur) {
      toward(this.goalX);
      return;
    }
    // граф пересобран (что-то разрушили) — заново находим цель; её могли и сломать
    if (!g.segments.includes(this.goal)) {
      const old = this.goal;
      this.goal = old.pile ? g.pile : g.segmentBelow(this.goalX, old.y - 1);
      this.path = [];
    }
    // путь перестраиваем при смене площадки
    if (cur.id !== this.lastSeg || this.path.length === 0) {
      if (cur.id !== this.lastSeg) this.sinceProgress = 0;
      this.lastSeg = cur.id;
      this.path = g.findPath(cur, this.goal) ?? [cur];
    }

    if (cur.id === this.goal.id || (cur.pile && this.goal.pile)) {
      toward(this.goalX);
      if (Math.abs(this.goalX - cat.x) < 8) {
        const cb = this.onArrive;
        this.cancel();
        cb?.();
      }
      return;
    }
    const i = this.path.findIndex((s) => s.id === cur.id);
    const hop = i >= 0 ? this.path[i + 1] : undefined;
    if (!hop) {
      // цель недостижима — хотя бы подбежим по горизонтали
      toward(this.goalX);
      if (Math.abs(this.goalX - cat.x) < 8) this.cancel();
      return;
    }
    this.airTarget = hop;
    const hy = g.yOf(hop, cat.x);
    this.airMode = hy > cat.y + 2 ? 'down' : hy < cat.y - 2 ? 'up' : 'level';
    const inHop = cat.x > hop.x1 + 6 && cat.x < hop.x2 - 6;
    if (hy > cat.y + 2) {
      // вниз
      if (inHop && !cur.pile) {
        cmd.drop = true;
      } else {
        const tx = Math.max(hop.x1 + 12, Math.min(hop.x2 - 12, cat.x));
        toward(tx);
        const atEdge = (tx > cat.x && cat.x > cur.x2 - 8) || (tx < cat.x && cat.x < cur.x1 + 8);
        const gap = Math.max(0, hop.x1 - cur.x2, cur.x1 - hop.x2);
        if (atEdge && gap > 40) cmd.jump = true;
      }
    } else if (hy < cat.y - 2) {
      // вверх: встаём под площадку (или у её края) и прыгаем
      const launch = Math.max(cur.x1 + 4, Math.min(cur.x2 - 4, Math.max(hop.x1 - 4, Math.min(hop.x2 + 4, cat.x))));
      if (Math.abs(cat.x - launch) > 10) toward(launch);
      else {
        cmd.jump = true;
        cmd.jumpHeld = true;
        toward(Math.max(hop.x1 + 10, Math.min(hop.x2 - 10, cat.x)));
      }
    } else {
      // на той же высоте — бежим, у края прыгаем
      const tx = Math.max(hop.x1 + 12, Math.min(hop.x2 - 12, cat.x));
      toward(tx);
      const atEdge = (tx > cat.x && cat.x > cur.x2 - 10) || (tx < cat.x && cat.x < cur.x1 + 10);
      if (atEdge) {
        cmd.jump = true;
        cmd.jumpHeld = true;
      }
    }
  }
}
