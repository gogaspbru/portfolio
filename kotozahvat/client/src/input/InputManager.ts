import { CONFIG } from '../config';
import { emptyCommands, type Commands, type Vec } from './commands';

/** Что вводу нужно знать об игре */
export interface InputHost {
  toWorld(sx: number, sy: number): Vec;
  catCenter(): Vec;
  isBlock(p: Vec): boolean;
  navigateTo(p: Vec): void;
  cancelNavigation(): void;
  isNavigating(): boolean;
  /** Первое действие игрока (прячем подсказку) */
  onFirstInput(): void;
}

const LEFT = ['KeyA', 'ArrowLeft'];
const RIGHT = ['KeyD', 'ArrowRight'];
const JUMP = ['Space', 'KeyW', 'ArrowUp'];
const DOWN = ['KeyS', 'ArrowDown'];

/**
 * Клавиатура + мышь (компьютер) и тачи (телефон) → Commands.
 * Тип указателя определяется по каждому событию, так что гибридные
 * устройства (ноутбук с сенсорным экраном) работают обоими способами.
 */
export class InputManager {
  private keys = new Set<string>();
  private jumpQueued = false;
  private dropQueued = false;
  private pawQueued: Vec | null = null;

  // мышь (экранные координаты)
  private mouse: Vec | null = null;
  private mouseDown = false;
  private mouseDownAt = 0;

  // палец
  private touchId: number | null = null;
  private touchStart = { x: 0, y: 0, t: 0 };
  private touchNow = { x: 0, y: 0 };
  private touchMoved = false;
  private longPress = false;
  private longTimer = 0;
  private touchScratch = false;
  private renavTimer = 0;

  private started = false;
  private disposers: (() => void)[] = [];

  constructor(private el: HTMLElement, private host: InputHost) {
    const on = <K extends keyof WindowEventMap>(t: EventTarget, type: K, fn: (e: WindowEventMap[K]) => void, opts?: AddEventListenerOptions) => {
      t.addEventListener(type, fn as EventListener, opts);
      this.disposers.push(() => t.removeEventListener(type, fn as EventListener, opts));
    };
    on(window, 'keydown', (e) => this.onKey(e, true));
    on(window, 'keyup', (e) => this.onKey(e, false));
    on(window, 'blur', () => { this.keys.clear(); this.mouseDown = false; });
    on(el, 'pointerdown', (e) => this.onDown(e));
    on(window, 'pointermove', (e) => this.onMove(e));
    on(window, 'pointerup', (e) => this.onUp(e, false));
    on(window, 'pointercancel', (e) => this.onUp(e, true));
    on(el, 'contextmenu', (e) => e.preventDefault());
  }

  dispose() {
    this.disposers.forEach((d) => d());
    clearTimeout(this.longTimer);
  }

  private first() {
    if (!this.started) {
      this.started = true;
      this.host.onFirstInput();
    }
  }

  private onKey(e: KeyboardEvent, down: boolean) {
    const code = e.code;
    const known = [...LEFT, ...RIGHT, ...JUMP, ...DOWN].includes(code);
    if (!known) return;
    e.preventDefault();
    if (down) {
      this.first();
      if (!e.repeat) {
        if (JUMP.includes(code)) this.jumpQueued = true;
        if (DOWN.includes(code)) this.dropQueued = true;
      }
      if (LEFT.includes(code) || RIGHT.includes(code)) this.host.cancelNavigation();
      this.keys.add(code);
    } else {
      this.keys.delete(code);
    }
  }

  private local(e: PointerEvent): Vec {
    const r = this.el.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  private onDown(e: PointerEvent) {
    this.first();
    const p = this.local(e);
    if (e.pointerType === 'mouse') {
      if (e.button !== 0) return;
      this.mouse = p;
      this.mouseDown = true;
      this.mouseDownAt = performance.now();
      this.pawQueued = this.host.toWorld(p.x, p.y);
      return;
    }
    if (this.touchId !== null) return; // второй палец игнорируем
    e.preventDefault();
    this.touchId = e.pointerId;
    this.touchStart = { x: p.x, y: p.y, t: performance.now() };
    this.touchNow = { ...p };
    this.touchMoved = false;
    this.longPress = false;
    this.touchScratch = false;
    clearTimeout(this.longTimer);
    this.longTimer = window.setTimeout(() => this.beginLongPress(), CONFIG.touch.longPressMs);
  }

  private beginLongPress() {
    if (this.touchId === null || this.touchMoved) return;
    this.longPress = true;
    const w = this.host.toWorld(this.touchNow.x, this.touchNow.y);
    if (this.host.isBlock(w)) {
      this.touchScratch = true; // точим когти, пока держим
      this.renavTimer = 0;
    } else {
      this.host.navigateTo(w);
    }
  }

  private onMove(e: PointerEvent) {
    const p = this.local(e);
    if (e.pointerType === 'mouse') {
      this.mouse = p;
      return;
    }
    if (e.pointerId !== this.touchId) return;
    this.touchNow = p;
    if (Math.hypot(p.x - this.touchStart.x, p.y - this.touchStart.y) > CONFIG.touch.tapMaxMove) {
      if (!this.longPress) {
        this.touchMoved = true;
        clearTimeout(this.longTimer);
      }
    }
  }

  private onUp(e: PointerEvent, cancelled: boolean) {
    if (e.pointerType === 'mouse') {
      this.mouseDown = false;
      return;
    }
    if (e.pointerId !== this.touchId) return;
    this.touchId = null;
    clearTimeout(this.longTimer);
    if (cancelled) {
      this.touchScratch = false;
      return;
    }
    if (this.longPress) {
      if (this.touchScratch) this.host.cancelNavigation();
      this.touchScratch = false;
      return;
    }
    const p = this.local(e);
    const dx = p.x - this.touchStart.x;
    const dy = p.y - this.touchStart.y;
    const min = CONFIG.touch.swipeMinDistance;
    if (this.touchMoved) {
      if (dy > min && Math.abs(dy) > Math.abs(dx)) this.dropQueued = true;
      else if (dy < -min && Math.abs(dy) > Math.abs(dx)) this.jumpQueued = true;
      return;
    }
    // тап
    const w = this.host.toWorld(this.touchStart.x, this.touchStart.y);
    const c = this.host.catCenter();
    if (this.host.isBlock(w) && Math.hypot(w.x - c.x, w.y - c.y) <= CONFIG.touch.attackReach) {
      this.host.cancelNavigation();
      this.pawQueued = w;
    } else {
      this.host.navigateTo(w);
    }
  }

  /** Команды на один шаг; однократные нажатия расходуются */
  poll(dt: number): Commands {
    const cmd = emptyCommands();
    const held = (codes: string[]) => codes.some((c) => this.keys.has(c));
    cmd.moveX = (held(RIGHT) ? 1 : 0) - (held(LEFT) ? 1 : 0);
    cmd.jump = this.jumpQueued;
    cmd.jumpHeld = held(JUMP) || this.jumpQueued;
    cmd.drop = this.dropQueued;
    cmd.paw = this.pawQueued;
    this.jumpQueued = this.dropQueued = false;
    this.pawQueued = null;

    if (this.mouse) {
      cmd.aim = this.host.toWorld(this.mouse.x, this.mouse.y);
      if (this.mouseDown && performance.now() - this.mouseDownAt > CONFIG.claws.holdDelay * 1000) cmd.scratch = cmd.aim;
    }
    if (this.touchScratch) {
      const w = this.host.toWorld(this.touchNow.x, this.touchNow.y);
      const c = this.host.catCenter();
      cmd.aim = w;
      if (Math.hypot(w.x - c.x, w.y - c.y) <= CONFIG.touch.attackReach) {
        if (this.host.isNavigating()) this.host.cancelNavigation();
        cmd.scratch = w;
      } else {
        // далеко — идём к блоку, пока держат палец
        this.renavTimer -= dt;
        if (this.renavTimer <= 0 || !this.host.isNavigating()) {
          this.renavTimer = 0.4;
          this.host.navigateTo(w);
        }
      }
    }
    if (cmd.paw && !cmd.aim) cmd.aim = cmd.paw;
    return cmd;
  }
}
