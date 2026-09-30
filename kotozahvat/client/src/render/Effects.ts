import { CONFIG } from '../config';

interface Swipe {
  x: number;
  y: number;
  angle: number;
  t: number;
  claws: boolean;
}

/** Мелкие эффекты: дуги ударов и тряска экрана */
export class Effects {
  private swipes: Swipe[] = [];
  private shakeAmount = 0;
  shakeX = 0;
  shakeY = 0;

  swipe(x: number, y: number, angle: number, claws = false) {
    this.swipes.push({ x, y, angle, t: 0, claws });
  }

  shake(amount: number) {
    this.shakeAmount = Math.max(this.shakeAmount, amount);
  }

  vibrate(ms: number) {
    if (CONFIG.effects.vibrate && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(ms);
      } catch {
        /* не везде разрешено — не страшно */
      }
    }
  }

  update(dt: number) {
    for (const s of this.swipes) s.t += dt;
    this.swipes = this.swipes.filter((s) => s.t < 0.16);
    this.shakeAmount = Math.max(0, this.shakeAmount - dt * 30);
    this.shakeX = (Math.random() - 0.5) * 2 * this.shakeAmount;
    this.shakeY = (Math.random() - 0.5) * 2 * this.shakeAmount;
  }

  render(ctx: CanvasRenderingContext2D) {
    for (const s of this.swipes) {
      const k = s.t / 0.16;
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.angle);
      ctx.globalAlpha = 1 - k;
      ctx.strokeStyle = s.claws ? '#ffffff' : '#fff3c4';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      const r = 16 + k * 8;
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.arc(-6, i * 5, r, -0.9, 0.9);
        ctx.stroke();
      }
      ctx.restore();
    }
  }
}
