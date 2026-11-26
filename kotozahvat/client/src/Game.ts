import { CONFIG } from './config';
import type { LevelData } from '../../shared/types';
import { Cat } from './cat/Cat';
import { animDuration, drawFrame, frameAt, type SpriteSheet } from './cat/spriteSheet';
import { Debris } from './debris/Debris';
import { Level, type RuntimeElement } from './level/Level';
import { Navigator } from './nav/Navigator';
import { InputManager } from './input/InputManager';
import { emptyCommands, type Commands } from './input/commands';
import { Camera } from './render/Camera';
import { Effects } from './render/Effects';
import { strikeOrigin, type Ability, type AbilityContext } from './abilities/Ability';
import type { Vec } from './input/commands';
import { Paw } from './abilities/Paw';
import { Claws } from './abilities/Claws';

export interface GameStats {
  timeMs: number;
  elements: number;
}

export interface GameCallbacks {
  onProgress(progress: number, timeMs: number, remainingElements: number): void;
  onFirstInput(): void;
  onWin(stats: GameStats): void;
}

export interface GameOptions {
  debug?: boolean;
  /** Бенчмарк: держать столько летящих осколков */
  bench?: number;
}

type State = 'play' | 'winning' | 'washing' | 'done';

/** Вся игра: цикл с фиксированным шагом, симуляция, рендер */
export class Game {
  readonly level: Level;
  readonly debris: Debris;
  readonly cat: Cat;
  readonly camera = new Camera();
  readonly effects = new Effects();
  readonly navigator: Navigator;
  private input: InputManager;
  private paw: Paw;
  private claws: Claws;
  /** Все способности — сюда же встанут новые «оружия» */
  private abilities: Ability[];
  private ctx: CanvasRenderingContext2D;
  private dpr = 1;
  private dprCap: number = CONFIG.render.maxDpr;
  private qualityTimer = 0;
  private qualityFrames = 0;
  private raf = 0;
  private lastT = 0;
  private acc = 0;
  private state: State = 'play';
  private time = 0;
  private playTime = 0;
  private stateTime = 0;
  private wasScratching = false;
  /** Блок, к которому кот идёт, чтобы ударить (тап по дальнему блоку) */
  private hitTarget: Vec | null = null;
  private pendingPaw: Vec | null = null;
  private reportTick = 0;
  private landDuration: number;
  private resizeObserver: ResizeObserver;

  // замеры для отладки и бенчмарка
  fps = 0;
  private frameTimes: number[] = [];

  constructor(
    private canvas: HTMLCanvasElement,
    data: LevelData,
    image: CanvasImageSource,
    private sheet: SpriteSheet,
    private callbacks: GameCallbacks,
    private options: GameOptions = {},
  ) {
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.level = new Level(data, image, {
      onCellDestroyed: (x, y, ix, iy) => this.spawnCellDebris(x, y, ix, iy),
      onCollapse: () => this.effects.shake(CONFIG.effects.shakeOnCollapse),
    });
    const perCell = Math.min(CONFIG.destruction.particlesPerCell, (this.level.cs / CONFIG.debris.pixel) ** 2);
    this.debris = new Debris(
      this.level.width, this.level.worldHeight, this.level.totalCells * perCell,
      options.bench ? Math.max(options.bench, CONFIG.debris.maxLive) : CONFIG.debris.maxLive,
    );
    this.navigator = new Navigator(this.level, this.debris);
    this.cat = new Cat(...this.spawnPoint());
    this.paw = new Paw(sheet);
    this.claws = new Claws();
    this.abilities = [this.paw, this.claws];
    this.landDuration = animDuration(sheet, 'land');

    this.input = new InputManager(canvas, {
      toWorld: (sx, sy) => this.camera.toWorld(sx, sy),
      isBlock: (p) => !!this.level.elementAt(p.x, p.y),
      inStrikeRange: (p) => this.inStrikeRange(p),
      tapBlock: (p) => {
        if (this.inStrikeRange(p)) {
          this.navigator.cancel();
          this.hitTarget = null;
          this.pendingPaw = p;
        } else if (this.state === 'play') {
          // далеко: идём к блоку и бьём, как только дотянемся
          this.hitTarget = p;
          this.navigator.goTo(p.x, p.y);
        }
      },
      navigateTo: (p) => this.state === 'play' && this.navigator.goTo(p.x, p.y),
      cancelNavigation: () => {
        this.navigator.cancel();
        this.hitTarget = null;
      },
      isNavigating: () => this.navigator.active,
      onFirstInput: () => callbacks.onFirstInput(),
    });

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.resize();
    this.camera.follow(this.cat.x, this.cat.centerY, 0, this.level.width, this.level.worldHeight, true);
  }

  /** Достанет ли лапа до точки, не сходя с места (с небольшим запасом на радиус удара) */
  private inStrikeRange(p: Vec): boolean {
    const o = strikeOrigin(this.cat);
    return Math.hypot(p.x - o.x, p.y - o.y) <= CONFIG.paw.reach + CONFIG.paw.hitRadius * 0.7;
  }

  /** Кот появляется над самым верхним элементом ближе к левому краю */
  private spawnPoint(): [number, number] {
    const els = this.level.elements.filter((e) => !e.dead && e.w >= 60);
    els.sort((a, b) => a.y - b.y || a.x - b.x);
    const e = els[0];
    return e ? [Math.min(e.x + CONFIG.cat.width * 1.6, e.x + e.w / 2), Math.max(0, e.y - 40)] : [CONFIG.cat.width * 1.6, 0];
  }

  start() {
    this.lastT = performance.now();
    const frame = (t: number) => {
      this.raf = requestAnimationFrame(frame);
      const dt = Math.min(0.1, (t - this.lastT) / 1000);
      this.lastT = t;
      this.measure(dt);
      const step = CONFIG.physics.fixedStep;
      this.acc += dt;
      let steps = 0;
      while (this.acc >= step && steps < 5) {
        this.step(step);
        this.acc -= step;
        steps++;
      }
      if (steps === 5) this.acc = 0; // не догоняем после долгого подвисания
      this.render(this.acc / step);
    };
    this.raf = requestAnimationFrame(frame);
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    this.input.dispose();
    this.resizeObserver.disconnect();
  }

  get elapsedMs() {
    return Math.round(this.playTime * 1000);
  }

  /** Текущий кадр как картинка (для «Сохранить кадр») */
  snapshot(type = 'image/png'): string {
    return this.canvas.toDataURL(type);
  }

  private resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(this.dprCap, window.devicePixelRatio || 1);
    this.canvas.width = Math.max(1, Math.round(rect.width * this.dpr));
    this.canvas.height = Math.max(1, Math.round(rect.height * this.dpr));
    this.camera.resize(rect.width, rect.height, this.level.width);
  }

  private measure(dt: number) {
    this.frameTimes.push(dt);
    if (this.frameTimes.length > 60) this.frameTimes.shift();
    const avg = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    this.fps = avg > 0 ? 1 / avg : 0;
    this.adaptQuality(dt);
  }

  /** Автокачество: раз в 2 секунды смотрим fps и при необходимости снижаем плотность пикселей */
  private adaptQuality(dt: number) {
    const r = CONFIG.render;
    if (!r.autoQuality || this.options.bench) return;
    this.qualityTimer += dt;
    this.qualityFrames++;
    if (this.qualityTimer < 2) return;
    const fps = this.qualityFrames / this.qualityTimer;
    this.qualityTimer = 0;
    this.qualityFrames = 0;
    if (fps >= r.autoQualityMinFps || document.hidden) return;
    const next = r.autoQualitySteps.find((d) => d < this.dpr - 0.01);
    if (next !== undefined) {
      this.dprCap = next;
      this.resize();
    }
  }

  private spawnCellDebris(x: number, y: number, ix: number, iy: number) {
    const px = CONFIG.debris.pixel;
    const n = this.level.cs / px;
    const per = CONFIG.destruction.particlesPerCell;
    const total = n * n;
    const { spreadX, spreadUp } = CONFIG.debris;
    for (let k = 0; k < total; k++) {
      if (per < total && Math.random() > per / total) continue;
      const sx = x + (k % n) * px;
      const sy = y + Math.floor(k / n) * px;
      const color = this.level.colorAt(sx + px / 2, sy + px / 2);
      this.debris.spawn(sx, sy, ix + (Math.random() - 0.5) * spreadX, iy - Math.random() * spreadUp, color);
    }
  }

  // ---------------- симуляция ----------------

  private step(dt: number) {
    this.time += dt;
    this.stateTime += dt;
    let cmd: Commands = this.input.poll(dt);
    if (this.pendingPaw) {
      cmd.paw = cmd.aim = this.pendingPaw;
      this.pendingPaw = null;
    }
    if (this.hitTarget) {
      if (!this.level.elementAt(this.hitTarget.x, this.hitTarget.y)) this.hitTarget = null; // уже разрушен
      else if (this.inStrikeRange(this.hitTarget)) {
        cmd.paw = cmd.aim = this.hitTarget;
        this.navigator.cancel();
        this.hitTarget = null;
      } else if (!this.navigator.active) this.hitTarget = null; // не дошли — игрок тапнет ещё
    }
    if (this.state === 'play') {
      this.navigator.update(this.cat, dt, cmd);
      this.playTime += dt;
    } else {
      cmd = emptyCommands();
    }

    const ctx: AbilityContext = { cat: this.cat, level: this.level, debris: this.debris, effects: this.effects };
    this.cat.scratching = false;
    if (cmd.paw) this.paw.trigger(ctx, cmd.paw);
    if (cmd.scratch) this.claws.hold(ctx, cmd.scratch, dt);
    else if (this.wasScratching) this.claws.release();
    this.wasScratching = !!cmd.scratch;
    for (const a of this.abilities) a.update(ctx, dt);

    this.cat.update(dt, cmd, this.level, this.debris, this.landDuration);
    this.level.update(dt);
    if (this.options.bench) this.runBench();
    this.debris.update(dt);
    this.effects.update(dt);
    this.camera.follow(this.cat.x + this.cat.facing * CONFIG.camera.lookAhead, this.cat.centerY, dt, this.level.width, this.level.worldHeight);

    this.updateState();
  }

  private updateState() {
    const p = this.level.progress;
    if (this.state === 'play' && p >= CONFIG.destruction.winThreshold) {
      this.state = 'winning';
      this.stateTime = 0;
      this.navigator.cancel();
      this.level.collapseAll();
    } else if (this.state === 'winning' && !this.level.crumbling && (this.debris.count < 40 || this.stateTime > 3)) {
      this.state = 'washing';
      this.stateTime = 0;
      this.cat.mode = 'wash';
    } else if (this.state === 'washing' && this.stateTime > CONFIG.destruction.washBeforeFinal) {
      this.state = 'done';
      this.callbacks.onWin({ timeMs: this.elapsedMs, elements: this.level.elements.length });
    }
    // интерфейс обновляем ~10 раз в секунду
    if (++this.reportTick >= 6) {
      this.reportTick = 0;
      const shown = this.state === 'play' ? p : 1;
      this.callbacks.onProgress(shown, this.elapsedMs, this.level.aliveElements().length);
    }
  }

  private runBench() {
    const target = this.options.bench!;
    const v = { x: this.camera.x, y: this.camera.y, w: this.camera.viewW };
    let n = Math.min(400, target - this.debris.count);
    while (n-- > 0) {
      const color = 0xff000000 | ((Math.random() * 0xffffff) | 0);
      this.debris.spawn(v.x + Math.random() * v.w, v.y - 20 - Math.random() * 200, (Math.random() - 0.5) * 200, Math.random() * 100, color);
    }
  }

  // ---------------- рендер ----------------

  private render(alpha: number) {
    const { ctx, camera, level, dpr } = this;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#16131c';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    const z = camera.zoom * dpr;
    const camX = camera.x + this.effects.shakeX;
    const camY = camera.y + this.effects.shakeY;
    ctx.setTransform(z, 0, 0, z, -camX * z, -camY * z);
    const view = { x: camX, y: camY, w: camera.viewW, h: camera.viewH };

    // фон страницы и «подвал»
    ctx.imageSmoothingEnabled = true;
    this.drawVisible(level.bg, level.bgScale, view, level.pageHeight);
    ctx.fillStyle = '#0e0c12';
    ctx.fillRect(0, level.pageHeight, level.width, level.worldHeight - level.pageHeight + 400);
    ctx.fillStyle = 'rgba(255, 138, 61, 0.25)';
    ctx.fillRect(0, level.pageHeight, level.width, 2);

    // передний план — живые куски сайта
    level.fg.draw(ctx, view);
    for (const el of level.elements) {
      if (el.flash > 0 && !el.dead) {
        ctx.fillStyle = `rgba(255,255,255,${(0.45 * el.flash) / CONFIG.destruction.flashTime})`;
        ctx.fillRect(el.x, el.y, el.w, el.h);
      }
    }

    this.debris.render(ctx, view);
    this.drawCat(alpha);
    this.effects.render(ctx);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (this.state === 'play' && level.progress >= CONFIG.ui.hintArrowFrom) this.drawHintArrow();
    if (this.options.debug || this.options.bench) this.drawDebug();
  }

  /** Рисуем только видимую часть большого холста */
  private drawVisible(src: HTMLCanvasElement, scale: number, view: { x: number; y: number; w: number; h: number }, maxY: number) {
    const x1 = Math.max(0, view.x);
    const y1 = Math.max(0, view.y);
    const x2 = Math.min(this.level.width, view.x + view.w);
    const y2 = Math.min(maxY, view.y + view.h);
    if (x2 <= x1 || y2 <= y1) return;
    const sx = Math.floor(x1 * scale);
    const sy = Math.floor(y1 * scale);
    const sw = Math.min(src.width - sx, Math.ceil((x2 - x1) * scale) + 1);
    const sh = Math.min(src.height - sy, Math.ceil((y2 - y1) * scale) + 1);
    if (sw <= 0 || sh <= 0) return;
    this.ctx.drawImage(src, sx, sy, sw, sh, sx / scale, sy / scale, sw / scale, sh / scale);
  }

  private drawCat(alpha: number) {
    const cat = this.cat;
    const x = cat.prevX + (cat.x - cat.prevX) * alpha;
    const y = cat.prevY + (cat.y - cat.prevY) * alpha;
    const scale = this.sheet.scale ?? CONFIG.cat.spriteScale;
    const frame = frameAt(this.sheet, cat.anim, cat.animTime);
    const rot = cat.anim === 'flip' ? cat.flipProgress * Math.PI * 2 : 0;
    drawFrame(this.ctx, this.sheet, frame, Math.round(x), Math.round(y), cat.facing, scale, rot, rot ? cat.h / 2 : 0);
  }

  private drawHintArrow() {
    const alive = this.level.aliveElements();
    if (!alive.length) return;
    const cat = this.cat;
    let best: RuntimeElement = alive[0];
    let bestD = Infinity;
    for (const e of alive) {
      const d = Math.hypot(e.x + e.w / 2 - cat.x, e.y + e.h / 2 - cat.centerY);
      if (d < bestD) { bestD = d; best = e; }
    }
    const cam = this.camera;
    const visible = best.x + best.w > cam.x && best.x < cam.x + cam.viewW && best.y + best.h > cam.y && best.y < cam.y + cam.viewH;
    if (visible) return;
    const p = cam.toScreen(best.x + best.w / 2, best.y + best.h / 2);
    const cx = cam.screenW / 2;
    const cy = cam.screenH / 2;
    const a = Math.atan2(p.y - cy, p.x - cx);
    const m = 36;
    const k = Math.min((cam.screenW / 2 - m) / Math.abs(Math.cos(a) || 1e-6), (cam.screenH / 2 - m) / Math.abs(Math.sin(a) || 1e-6));
    const ax = cx + Math.cos(a) * k;
    const ay = cy + Math.sin(a) * k;
    const pulse = 1 + Math.sin(this.time * 8) * 0.15;
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(a);
    ctx.scale(pulse, pulse);
    ctx.fillStyle = '#ff8a3d';
    ctx.strokeStyle = '#16131c';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(16, 0);
    ctx.lineTo(-10, -12);
    ctx.lineTo(-4, 0);
    ctx.lineTo(-10, 12);
    ctx.closePath();
    ctx.stroke();
    ctx.fill();
    ctx.restore();
  }

  private drawDebug() {
    const ctx = this.ctx;
    if (this.options.debug) {
      const z = this.camera.zoom;
      ctx.save();
      ctx.translate(-this.camera.x * z, -this.camera.y * z);
      ctx.scale(z, z);
      ctx.strokeStyle = 'rgba(0,255,160,0.8)';
      ctx.lineWidth = 2 / z;
      for (const s of this.navigator.debugPath) {
        ctx.beginPath();
        ctx.moveTo(s.x1, s.pile ? this.debris.pileTopAt(s.x1) : s.y);
        ctx.lineTo(s.x2, s.pile ? this.debris.pileTopAt(s.x2) : s.y);
        ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(255,0,0,0.6)';
      ctx.strokeRect(this.cat.x - this.cat.w / 2, this.cat.y - this.cat.h, this.cat.w, this.cat.h);
      ctx.restore();
    }
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(8, this.camera.screenH - 58, 230, 50);
    ctx.fillStyle = '#9f9';
    ctx.font = '12px monospace';
    ctx.fillText(`fps ${this.fps.toFixed(0)}  осколков ${this.debris.count}/${this.debris.capacity}`, 14, this.camera.screenH - 40);
    ctx.fillText(`захват ${(this.level.progress * 100).toFixed(1)}%  ${this.state}  dpr ${this.dpr}`, 14, this.camera.screenH - 22);
  }
}
