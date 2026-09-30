import { CONFIG } from '../config';
import { animDuration } from '../cat/spriteSheet';
import type { SpriteSheet } from '../cat/spriteSheet';
import type { Vec } from '../input/commands';
import { strikePoint, type Ability, type AbilityContext } from './Ability';

/** Удар лапой: урон всем элементам в радиусе + откол клеток в точке удара */
export class Paw implements Ability {
  readonly id = 'paw';
  private cooldown = 0;

  constructor(private sheet: SpriteSheet) {}

  trigger(ctx: AbilityContext, target: Vec) {
    if (this.cooldown > 0) return;
    const cfg = CONFIG.paw;
    this.cooldown = cfg.cooldown;
    const { cat, level, effects } = ctx;
    if (Math.abs(target.x - cat.x) > 2) cat.facing = Math.sign(target.x - cat.x);
    cat.playAction('paw', animDuration(this.sheet, 'paw'));
    const p = strikePoint(cat, target, cfg.reach);
    effects.swipe(p.x, p.y, Math.atan2(p.dy, p.dx));
    const hits = level.damageArea(p.x, p.y, cfg.hitRadius, cfg.damage, cfg.chipRadius, p.dx * 260, p.dy * 260 - 120);
    if (hits.length) {
      effects.shake(CONFIG.effects.shakeOnHit);
      effects.vibrate(12);
    }
  }

  update(_ctx: AbilityContext, dt: number) {
    this.cooldown -= dt;
  }
}
