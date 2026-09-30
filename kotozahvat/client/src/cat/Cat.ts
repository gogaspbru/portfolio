import { CONFIG } from '../config';
import type { Commands } from '../input/commands';
import type { Level } from '../level/Level';
import type { Debris } from '../debris/Debris';
import type { AnimName } from './spriteSheet';

/**
 * Кот: физика (бег, прыжок, кульбит, спрыгивание) и выбор анимации.
 * Координаты: x — центр, y — линия лап.
 * Платформы односторонние: снизу пролетаем насквозь, сверху стоим.
 */
export class Cat {
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  vx = 0;
  vy = 0;
  readonly w = CONFIG.cat.width;
  readonly h = CONFIG.cat.height;
  facing = 1;

  onGround = false;
  onPile = false;
  climbing = false;
  usedDoubleJump = false;

  private coyote = 0;
  private jumpBuffer = 0;
  private jumpCutAllowed = false;
  private dropTimer = 0;
  private dropFromY = 0;
  private landTime = 0;
  /** Сколько осталось крутить кульбит */
  flipTime = 0;

  private actionAnim: AnimName | null = null;
  private actionTime = 0;
  /** Ставится способностью «когти» на каждом шаге, пока точим */
  scratching = false;
  /** 'wash' — финал: кот сидит и умывается, команды игнорируются */
  mode: 'play' | 'wash' = 'play';

  anim: AnimName = 'fall';
  animTime = 0;

  constructor(x: number, y: number) {
    this.x = this.prevX = x;
    this.y = this.prevY = y;
  }

  get centerY() {
    return this.y - this.h / 2;
  }

  /** Проиграть анимацию действия (лапа) поверх движения */
  playAction(anim: AnimName, duration: number) {
    this.actionAnim = anim;
    this.actionTime = duration;
    this.animTime = 0;
    this.anim = anim;
  }

  /** Сколько длится кульбит-анимация целиком (для поворота спрайта) */
  get flipProgress() {
    return this.flipTime > 0 ? 1 - this.flipTime / CONFIG.cat.flipDuration : 0;
  }

  update(dt: number, cmd: Commands, level: Level, debris: Debris, landDuration: number) {
    const cfg = CONFIG.cat;
    this.prevX = this.x;
    this.prevY = this.y;

    this.coyote -= dt;
    this.jumpBuffer -= dt;
    this.dropTimer -= dt;
    this.landTime -= dt;
    this.flipTime = Math.max(0, this.flipTime - dt);
    this.actionTime -= dt;
    if (this.actionTime <= 0) this.actionAnim = null;

    const playing = this.mode === 'play';
    const moveX = playing ? cmd.moveX : 0;

    // --- горизонталь ---
    const target = moveX * cfg.runSpeed;
    if (moveX !== 0) {
      const a = (this.onGround ? cfg.groundAccel : cfg.airAccel) * dt;
      this.vx += Math.max(-a, Math.min(a, target - this.vx));
    } else if (this.onGround) {
      const f = cfg.groundFriction * dt;
      this.vx = Math.abs(this.vx) <= f ? 0 : this.vx - Math.sign(this.vx) * f;
    }

    // --- взгляд ---
    if (playing && cmd.aim && Math.abs(cmd.aim.x - this.x) > 4) this.facing = Math.sign(cmd.aim.x - this.x);
    else if (moveX !== 0) this.facing = Math.sign(moveX);

    // --- прыжки ---
    if (playing && cmd.jump) this.jumpBuffer = cfg.jumpBuffer;
    if (this.jumpBuffer > 0 && (this.onGround || this.coyote > 0)) {
      this.vy = -cfg.jumpVelocity;
      this.onGround = false;
      this.coyote = 0;
      this.jumpBuffer = 0;
      this.jumpCutAllowed = true;
      this.usedDoubleJump = false;
      this.climbing = false;
    } else if (playing && cmd.jump && !this.onGround && !this.usedDoubleJump) {
      // кульбит
      this.vy = -cfg.doubleJumpVelocity;
      this.usedDoubleJump = true;
      this.flipTime = cfg.flipDuration;
      this.climbing = false;
      this.jumpBuffer = 0;
      this.jumpCutAllowed = false;
    }
    if (this.jumpCutAllowed && !cmd.jumpHeld && this.vy < 0) {
      this.vy *= cfg.jumpCutMultiplier;
      this.jumpCutAllowed = false;
    }

    // --- спрыгнуть сквозь платформу ---
    if (playing && cmd.drop && this.onGround && !this.onPile) {
      this.dropTimer = cfg.dropThroughTime;
      this.dropFromY = this.y;
      this.onGround = false;
      this.y += 1;
    }

    // --- лазанье: держим прыжок в воздухе после верхней точки ---
    const cl = CONFIG.climb;
    const canClimb = cl.enabled && playing && cmd.jumpHeld && !this.onGround && this.y - this.h > 0;
    this.climbing = canClimb && (this.climbing || this.vy >= 0);
    if (this.climbing) this.vx = Math.max(-cfg.runSpeed * cl.sideSpeed, Math.min(cfg.runSpeed * cl.sideSpeed, this.vx));

    // --- движение ---
    if (this.climbing) this.vy = -cl.speed;
    else this.vy = Math.min(this.vy + CONFIG.physics.gravity * dt, CONFIG.physics.maxFallSpeed);
    this.x = Math.max(this.w / 2, Math.min(level.width - this.w / 2, this.x + this.vx * dt));
    if (this.x <= this.w / 2 || this.x >= level.width - this.w / 2) this.vx = 0;

    const newY = this.y + this.vy * dt;
    const wasGround = this.onGround;
    const fallSpeed = this.vy;
    this.onGround = false;
    this.onPile = false;
    if (this.vy >= 0) {
      const landing = this.findLanding(level, debris, this.y, newY);
      if (landing) {
        this.y = landing.y;
        this.vy = 0;
        this.onGround = true;
        this.onPile = landing.pile;
        this.usedDoubleJump = false;
        this.jumpCutAllowed = false;
        this.climbing = false;
        if (!wasGround && fallSpeed > cfg.landingSpeedForAnim) this.landTime = landDuration;
      } else {
        this.y = newY;
      }
    } else {
      this.y = newY;
      if (this.y - this.h < -200) {
        this.y = -200 + this.h;
        this.vy = 0;
      }
    }
    if (wasGround && !this.onGround && this.vy >= 0) this.coyote = cfg.coyoteTime;

    // куча могла вырасти под котом — выталкиваем наверх
    const pileTop = debris.pileTopIn(this.x - this.w / 2 + 6, this.x + this.w / 2 - 6);
    if (this.y > pileTop) {
      this.y = pileTop;
      if (this.vy > 0) this.vy = 0;
      this.onGround = true;
      this.onPile = true;
    }

    this.pickAnimation(dt);
  }

  /** Ищем ближайшую сверху поверхность между fromY и toY под лапами кота */
  private findLanding(level: Level, debris: Debris, fromY: number, toY: number): { y: number; pile: boolean } | null {
    const cs = level.cs;
    const x1 = this.x - this.w / 2 + 6;
    const x2 = this.x + this.w / 2 - 6;
    const c0 = Math.floor(x1 / cs);
    const c1 = Math.floor(x2 / cs);
    const rStart = Math.ceil((fromY - 0.5) / cs);
    const rEnd = Math.min(level.rows - 1, Math.floor(toY / cs));
    let best: { y: number; pile: boolean } | null = null;
    for (let r = rStart; r <= rEnd && !best; r++) {
      const top = r * cs;
      if (this.dropTimer > 0 && top <= this.dropFromY + 1) continue;
      for (let c = c0; c <= c1; c++) {
        if (level.isSurface(c, r)) {
          best = { y: top, pile: false };
          break;
        }
      }
    }
    const pileTop = debris.pileTopIn(x1, x2);
    if (toY >= pileTop && (!best || pileTop < best.y)) best = { y: pileTop, pile: true };
    return best;
  }

  private pickAnimation(dt: number) {
    let next: AnimName;
    if (this.mode === 'wash') next = this.onGround ? 'wash' : 'fall';
    else if (this.actionAnim) next = this.actionAnim;
    else if (this.scratching) next = 'scratch';
    else if (this.climbing) next = 'climb';
    else if (!this.onGround) next = this.flipTime > 0 ? 'flip' : this.vy < 0 ? 'jump' : 'fall';
    else if (this.landTime > 0) next = 'land';
    else if (Math.abs(this.vx) > 30) next = 'run';
    else next = 'idle';
    if (next !== this.anim) {
      this.anim = next;
      this.animTime = 0;
    } else {
      this.animTime += dt;
    }
  }
}
