import { drawFrame, frameAt, type AnimName, type SpriteSheet } from '../cat/spriteSheet';

export const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

export function show(el: HTMLElement, visible: boolean) {
  el.hidden = !visible;
}

let toastTimer = 0;
export function toast(text: string, ms = 2600) {
  const el = $('toast');
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el.classList.remove('show'), ms);
}

export function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/** Маленький анимированный кот на стартовом экране и экране загрузки */
export class CatPreview {
  private raf = 0;
  private t0 = performance.now();
  constructor(private canvas: HTMLCanvasElement, private sheet: SpriteSheet, public anim: AnimName) {}

  start() {
    const ctx = this.canvas.getContext('2d')!;
    const loop = (t: number) => {
      this.raf = requestAnimationFrame(loop);
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      const frame = frameAt(this.sheet, this.anim, (t - this.t0) / 1000);
      const scale = Math.floor(Math.min(this.canvas.width / this.sheet.frameWidth, this.canvas.height / this.sheet.frameHeight));
      drawFrame(ctx, this.sheet, frame, this.canvas.width / 2, this.canvas.height - 2, 1, scale);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    cancelAnimationFrame(this.raf);
  }
}
