import type { LevelData } from '../../shared/types';
import { loadImage } from './cat/spriteSheet';

export interface LoadedLevel {
  data: LevelData;
  image: HTMLImageElement;
  /** Что показывать игроку как адрес */
  site: string;
  isDemo: boolean;
  /** Сообщение для игрока (например, «сервер не подключён — играем в демо») */
  notice?: string;
}

/**
 * Адрес сервера (этап 2). Пусто — сервера нет, играем только демо.
 * Задаётся при сборке: VITE_API_URL=https://api.example.ru npm run build
 */
const API_URL: string = (import.meta.env.VITE_API_URL as string | undefined) ?? '';

export const DEMO_ID = 'demo';

/** Приводим ввод к виду «example.com/path» для показа и ссылок */
export function normalizeSiteInput(raw: string): string {
  const s = raw.trim();
  if (!s || s.toLowerCase() === DEMO_ID) return DEMO_ID;
  return s.replace(/^https?:\/\//i, '').replace(/\/+$/, '');
}

export async function loadLevel(raw: string): Promise<LoadedLevel> {
  const site = normalizeSiteInput(raw);
  if (site === DEMO_ID || !API_URL) {
    const demo = await loadDemo();
    if (site !== DEMO_ID) {
      demo.notice = 'Сервер котика пока не подключён — тренируемся на демо-сайте.';
    }
    return demo;
  }
  throw new Error('Загрузка настоящих сайтов появится на этапе 2');
}

async function loadDemo(): Promise<LoadedLevel> {
  const base = import.meta.env.BASE_URL;
  const [res, image] = await Promise.all([fetch(`${base}demo/demo.json`), loadImage(`${base}demo/demo.png`)]);
  if (!res.ok) throw new Error('Демо-уровень не загрузился');
  const data = (await res.json()) as LevelData;
  return { data, image, site: 'Котовости (демо)', isDemo: true };
}
