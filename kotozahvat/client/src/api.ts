import type { LevelData } from '../../shared/types';
import { loadImage } from './cat/spriteSheet';
import { captureSite, CaptureError } from './capture/liveSite';

export interface LoadedLevel {
  data: LevelData;
  image: CanvasImageSource;
  /** Что показывать игроку как адрес */
  site: string;
  isDemo: boolean;
}

export const DEMO_ID = 'demo';

/** Приводим ввод к виду «example.com/path» для показа и ссылок */
export function normalizeSiteInput(raw: string): string {
  const s = raw.trim();
  if (!s || s.toLowerCase() === DEMO_ID) return DEMO_ID;
  return s.replace(/^https?:\/\//i, '').replace(/\/+$/, '');
}

export async function loadLevel(raw: string): Promise<LoadedLevel> {
  const site = normalizeSiteInput(raw);
  if (site === DEMO_ID) return loadDemo();
  // схему не дописываем: если её нет, загрузчик попробует https, потом http
  const url = raw.trim();
  try {
    const cap = await captureSite(url);
    return { data: cap.data, image: cap.image, site, isDemo: false };
  } catch (e) {
    if (e instanceof CaptureError) throw e;
    console.error(e);
    throw new CaptureError('Сайт не открылся');
  }
}

async function loadDemo(): Promise<LoadedLevel> {
  const base = import.meta.env.BASE_URL;
  const [res, image] = await Promise.all([fetch(`${base}demo/demo.json`), loadImage(`${base}demo/demo.png`)]);
  if (!res.ok) throw new Error('Демо-уровень не загрузился');
  const data = (await res.json()) as LevelData;
  return { data, image, site: 'Котовости (демо)', isDemo: true };
}
