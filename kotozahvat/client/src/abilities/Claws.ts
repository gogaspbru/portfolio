import { CONFIG } from '../config';
import type { Vec } from '../input/commands';
import { strikePoint, type Ability, type AbilityContext } from './Ability';

/** Точить когти: урон со временем, следы царапин, изредка откалывает кусочки */
export class Claws implements Ability {
  readonly id = 'claws';
  private scratchTimer = 0;
  private chipTimer = 0;

  hold(ctx: AbilityContext, target: Vec, dt: number) {
    const cfg = CONFIG.claws;
    const { cat, level, effects } = ctx;
    cat.scratching = true;
    if (Math.abs(target.x - cat.x) > 2) cat.facing = Math.sign(target.x - cat.x);
    const p = strikePoint(cat, target, cfg.reach);
    level.damageArea(p.x, p.y, cfg.radius, cfg.damagePerSecond * dt, 0, 0, 0, false);

    this.scratchTimer -= dt;
    if (this.scratchTimer <= 0) {
      this.scratchTimer = cfg.scratchInterval;
      const jx = p.x + (Math.random() - 0.5) * cfg.radius;
      const jy = p.y + (Math.random() - 0.5) * cfg.radius;
      if (level.elementAt(jx, jy)) {
        level.scratch(jx, jy, p.dx, p.dy);
        effects.shake(0.6);
      }
    }
    this.chipTimer -= dt;
    if (this.chipTimer <= 0) {
      this.chipTimer = cfg.chipInterval;
      if (level.elementAt(p.x, p.y)) {
        level.damageArea(p.x, p.y, cfg.chipRadius, 0, cfg.chipRadius, p.dx * 120, -80, false);
        effects.swipe(p.x, p.y, Math.atan2(p.dy, p.dx), true);
        effects.vibrate(6);
      }
    }
  }

  release() {
    this.scratchTimer = 0;
    this.chipTimer = 0;
  }

  update() {}
}
