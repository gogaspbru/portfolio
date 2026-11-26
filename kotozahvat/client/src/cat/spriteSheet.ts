import { buildProceduralCat } from './proceduralCat';

/**
 * Спрайт-лист кота.
 *
 * Хотите своего кота — положите в client/public/sprites/ два файла:
 *   cat.png  — кадры сеткой слева направо, сверху вниз (все одного размера);
 *   cat.json — описание в формате SpriteSheetMeta (см. ниже и README).
 * Если файлов нет, рисуется встроенный кот (proceduralCat.ts).
 * Шаблон текущего кота можно скачать: откройте игру с ?sprites=export
 */

export type AnimName = 'idle' | 'run' | 'jump' | 'fall' | 'flip' | 'land' | 'paw' | 'scratch' | 'climb' | 'sit' | 'wash';

export const ANIM_NAMES: AnimName[] = ['idle', 'run', 'jump', 'fall', 'flip', 'land', 'paw', 'scratch', 'climb', 'sit', 'wash'];

export interface AnimationDef {
  /** Номера кадров в листе (0 — левый верхний) */
  frames: number[];
  fps: number;
  loop: boolean;
}

export interface SpriteSheetMeta {
  frameWidth: number;
  frameHeight: number;
  /** Сколько кадров в строке листа */
  columns: number;
  /** Точка «лапы на земле» внутри кадра, в пикселях кадра. Кот смотрит вправо */
  anchorX: number;
  anchorY: number;
  /** Во сколько раз увеличивать (по умолчанию CONFIG.cat.spriteScale) */
  scale?: number;
  animations: Partial<Record<AnimName, AnimationDef>>;
}

export interface SpriteSheet extends SpriteSheetMeta {
  image: CanvasImageSource;
}

export async function loadCatSprites(base: string): Promise<SpriteSheet> {
  const builtin = buildProceduralCat();
  try {
    const res = await fetch(`${base}sprites/cat.json`, { cache: 'no-cache' });
    if (!res.ok || !(res.headers.get('content-type') || '').includes('json')) return builtin;
    const meta = (await res.json()) as SpriteSheetMeta;
    const image = await loadImage(`${base}sprites/cat.png`);
    // недостающие анимации подменяем тем, что есть
    const fallback = meta.animations.idle ?? Object.values(meta.animations)[0];
    for (const name of ANIM_NAMES) if (!meta.animations[name] && fallback) meta.animations[name] = fallback;
    return { ...meta, image };
  } catch {
    return builtin;
  }
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Не загрузилась картинка ${src}`));
    img.src = src;
  });
}

/** Номер кадра анимации по времени от её начала */
export function frameAt(sheet: SpriteSheet, anim: AnimName, t: number): number {
  const def = sheet.animations[anim] ?? sheet.animations.idle!;
  const n = def.frames.length;
  let i = Math.floor(t * def.fps);
  i = def.loop ? i % n : Math.min(i, n - 1);
  return def.frames[i];
}

export function animDuration(sheet: SpriteSheet, anim: AnimName): number {
  const def = sheet.animations[anim] ?? sheet.animations.idle!;
  return def.frames.length / def.fps;
}

/** Рисует кадр: (x, feetY) — точка лап в мире, facing 1 — вправо, -1 — влево */
export function drawFrame(
  ctx: CanvasRenderingContext2D,
  sheet: SpriteSheet,
  frame: number,
  x: number,
  feetY: number,
  facing: number,
  scale: number,
  rotation = 0,
  pivotY = 0,
) {
  const fw = sheet.frameWidth;
  const fh = sheet.frameHeight;
  const sx = (frame % sheet.columns) * fw;
  const sy = Math.floor(frame / sheet.columns) * fh;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(x, feetY - pivotY);
  if (rotation) ctx.rotate(rotation * facing);
  ctx.scale(facing * scale, scale);
  ctx.drawImage(sheet.image, sx, sy, fw, fh, -sheet.anchorX, -sheet.anchorY + pivotY / scale, fw, fh);
  ctx.restore();
}
