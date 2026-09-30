import { CONFIG } from '../config';
import type { Vec } from '../input/commands';

/**
 * Камера: масштаб под ширину экрана и плавное следование за котом.
 * Если уровень целиком по ширине получается слишком мелким (телефон),
 * масштаб не опускается ниже CONFIG.camera.minZoom и камера ездит по горизонтали.
 */
export class Camera {
  x = 0;
  y = 0;
  zoom = 1;
  screenW = 1;
  screenH = 1;

  get viewW() {
    return this.screenW / this.zoom;
  }
  get viewH() {
    return this.screenH / this.zoom;
  }

  resize(screenW: number, screenH: number, worldW: number) {
    this.screenW = screenW;
    this.screenH = screenH;
    const { minZoom, maxZoom } = CONFIG.camera;
    this.zoom = Math.min(maxZoom, Math.max(minZoom, screenW / worldW));
  }

  follow(tx: number, ty: number, dt: number, worldW: number, worldH: number, instant = false) {
    const vw = this.viewW;
    const vh = this.viewH;
    const dx = vw >= worldW ? (worldW - vw) / 2 : Math.max(0, Math.min(worldW - vw, tx - vw / 2));
    const dy = vh >= worldH ? (worldH - vh) / 2 : Math.max(-CONFIG.camera.topMargin / this.zoom - CONFIG.cat.height * 1.2, Math.min(worldH - vh, ty - vh * 0.55));
    if (instant) {
      this.x = dx;
      this.y = dy;
      return;
    }
    const k = 1 - Math.exp(-CONFIG.camera.followSpeed * dt);
    this.x += (dx - this.x) * k;
    this.y += (dy - this.y) * k;
  }

  toWorld(sx: number, sy: number): Vec {
    return { x: this.x + sx / this.zoom, y: this.y + sy / this.zoom };
  }

  toScreen(wx: number, wy: number): Vec {
    return { x: (wx - this.x) * this.zoom, y: (wy - this.y) * this.zoom };
  }
}
