import type { Cat } from '../cat/Cat';
import type { Debris } from '../debris/Debris';
import type { Vec } from '../input/commands';
import type { Level } from '../level/Level';
import type { Effects } from '../render/Effects';

export interface AbilityContext {
  cat: Cat;
  level: Level;
  debris: Debris;
  effects: Effects;
}

/**
 * «Оружие» кота. Сейчас их два: лапа (однократно) и когти (удержание).
 * Новые — комок шерсти, мяу-волна, прыжок-бомбочка, клубок, «позвать банду» —
 * добавляются отдельными файлами с этим интерфейсом и регистрируются в Game.
 */
export interface Ability {
  readonly id: string;
  /** Однократное применение в точку (клик / тап) */
  trigger?(ctx: AbilityContext, target: Vec): void;
  /** Удержание: вызывается каждый шаг, пока держат */
  hold?(ctx: AbilityContext, target: Vec, dt: number): void;
  /** Отпустили */
  release?(ctx: AbilityContext): void;
  /** Каждый шаг симуляции (перезарядки, снаряды) */
  update(ctx: AbilityContext, dt: number): void;
}

/** Откуда кот бьёт — примерно от груди */
export function strikeOrigin(cat: Cat): Vec {
  return { x: cat.x + cat.facing * 6, y: cat.y - cat.h * 0.55 };
}

/** Точка удара: в сторону цели, не дальше reach */
export function strikePoint(cat: Cat, target: Vec, reach: number): { x: number; y: number; dx: number; dy: number } {
  const o = strikeOrigin(cat);
  let dx = target.x - o.x;
  let dy = target.y - o.y;
  const len = Math.hypot(dx, dy) || 1;
  dx /= len;
  dy /= len;
  const d = Math.max(12, Math.min(reach, len));
  return { x: o.x + dx * d, y: o.y + dy * d, dx, dy };
}
