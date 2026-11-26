import type { LevelData } from '../../../shared/types';
import extractorSource from '../../../shared/extract-elements.js?raw';

/*
 * Превращение настоящего сайта в уровень прямо в браузере игрока.
 *
 * 1. PHP-загрузчик на нашем хостинге (public/api/fetch.php) скачивает HTML страницы.
 * 2. Из HTML убираются скрипты и всё активное; картинки, стили и шрифты
 *    переадресуются через тот же загрузчик — так они с нашего домена и холст не «портится».
 * 3. Страница раскладывается в невидимом iframe шириной 1280 (sandbox без скриптов).
 * 4. Тот же сборщик, что и для демо, собирает прямоугольники элементов.
 * 5. html2canvas-pro перерисовывает страницу в картинку — это и есть «скриншот».
 *
 * Ограничения (честно): это перерисовка, а не снимок браузера — шрифты и сложные эффекты
 * могут отличаться; сайты, которые рисуются скриптами, выйдут пустыми.
 */

export class CaptureError extends Error {}

const API_URL: string = (import.meta.env.VITE_API_URL as string | undefined) || 'api/fetch.php';
const WIDTH = 1280;
const VIEWPORT_H = 800;
const MAX_HEIGHT = VIEWPORT_H * 3;
const MAX_STYLESHEETS = 25;
const LOAD_TIMEOUT = 12000;

type Extractor = (opts: { width: number; maxHeight: number }, win: Window) => LevelData;
const extractElements = new Function(`return (\n${extractorSource.trim()}\n)`)() as Extractor;

export interface CapturedSite {
  data: LevelData;
  image: HTMLCanvasElement;
  finalUrl: string;
}

export function assetUrl(abs: string): string {
  return `${API_URL}?mode=asset&url=${encodeURIComponent(abs)}`;
}

async function apiError(res: Response): Promise<CaptureError> {
  try {
    const j = await res.json();
    if (j && typeof j.message === 'string') return new CaptureError(j.message);
  } catch {
    /* не JSON — значит, PHP не отработал */
  }
  if (res.status === 404) return new CaptureError('Загрузчик сайтов не найден на сервере');
  return new CaptureError('Сайт не открылся');
}

export async function captureSite(url: string): Promise<CapturedSite> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}?mode=page&url=${encodeURIComponent(url)}`);
  } catch {
    throw new CaptureError('Нет связи с сервером котика');
  }
  if (!res.ok) throw await apiError(res);
  let page: { url: string; html: string };
  try {
    page = await res.json();
  } catch {
    throw new CaptureError('Сервер котика ответил что-то странное — PHP точно работает?');
  }

  const html = await prepareHtml(page.html, page.url);
  const iframe = document.createElement('iframe');
  // allow-same-origin — чтобы мы могли измерить элементы; allow-scripts НЕТ — чужой JS не выполняется
  iframe.setAttribute('sandbox', 'allow-same-origin');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.tabIndex = -1;
  Object.assign(iframe.style, {
    position: 'fixed', left: '0', top: '0', width: `${WIDTH}px`, height: `${VIEWPORT_H}px`,
    border: '0', opacity: '0', pointerEvents: 'none', zIndex: '-10',
  });
  document.body.appendChild(iframe);
  try {
    await new Promise<void>((resolve) => {
      const t = setTimeout(resolve, LOAD_TIMEOUT); // не всё догрузилось — берём что есть
      iframe.onload = () => {
        clearTimeout(t);
        resolve();
      };
      iframe.srcdoc = html;
    });
    const win = iframe.contentWindow!;
    const doc = iframe.contentDocument!;
    await Promise.race([doc.fonts?.ready, sleep(3000)]);
    await sleep(150);

    const data = extractElements({ width: WIDTH, maxHeight: MAX_HEIGHT }, win);
    const area = data.elements.reduce((s, e) => s + e.w * e.h, 0);
    if (data.elements.length < 4 || area < data.width * data.height * 0.04) {
      throw new CaptureError('Этот сайт рисуется скриптами — котик видит пустую страницу. Попробуй другой');
    }

    const { default: html2canvas } = await import('html2canvas-pro');
    const image = await html2canvas(doc.documentElement, {
      width: WIDTH,
      height: data.height,
      windowWidth: WIDTH,
      windowHeight: VIEWPORT_H,
      x: 0,
      y: 0,
      scrollX: 0,
      scrollY: 0,
      scale: 1,
      useCORS: true,
      backgroundColor: data.background ?? '#ffffff',
      logging: false,
      imageTimeout: 8000,
    });
    return { data, image, finalUrl: page.url };
  } finally {
    iframe.remove();
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// ---------------- подготовка HTML ----------------

function absolutize(u: string, base: string): string | null {
  const v = u.trim();
  if (!v || v.startsWith('#') || /^(data|blob|about|javascript|mailto|tel):/i.test(v)) return null;
  try {
    const abs = new URL(v, base);
    return abs.protocol === 'http:' || abs.protocol === 'https:' ? abs.href : null;
  } catch {
    return null;
  }
}

function proxied(u: string, base: string): string {
  if (/^data:/i.test(u.trim())) return u;
  const abs = absolutize(u, base);
  return abs ? assetUrl(abs) : '';
}

function rewriteSrcset(value: string, base: string): string {
  return value
    .split(/,\s+(?=\S)/)
    .map((part) => {
      const [u, ...desc] = part.trim().split(/\s+/);
      const p = proxied(u, base);
      return p ? [p, ...desc].join(' ') : '';
    })
    .filter(Boolean)
    .join(', ');
}

/** url(...) и @import внутри CSS → через загрузчик. Импорты подтягиваем и вклеиваем */
async function rewriteCss(css: string, base: string, depth = 0): Promise<string> {
  const imports: { full: string; url: string }[] = [];
  css = css.replace(/@import\s+(?:url\()?\s*["']?([^"')\s;]+)["']?\s*\)?([^;]*);/gi, (full, u: string) => {
    imports.push({ full, url: u });
    return full;
  });
  if (depth < 2) {
    for (const imp of imports.slice(0, 10)) {
      const abs = absolutize(imp.url, base);
      const text = abs ? await fetchText(assetUrl(abs)) : null;
      css = css.replace(imp.full, text ? await rewriteCss(text, abs!, depth + 1) : '');
    }
  }
  return css.replace(/url\(\s*(["']?)([^"')]+)\1\s*\)/gi, (_m, _q, u: string) => {
    const p = proxied(u, base);
    return p ? `url("${p}")` : 'none';
  });
}

async function fetchText(url: string): Promise<string | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(t);
    return res.ok ? await res.text() : null;
  } catch {
    return null;
  }
}

async function prepareHtml(html: string, pageUrl: string): Promise<string> {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const baseEl = doc.querySelector('base[href]');
  const base = (baseEl && absolutize(baseEl.getAttribute('href')!, pageUrl)) || pageUrl;

  // всё активное — вон
  doc.querySelectorAll('script, base, meta[http-equiv], link:not([rel~="stylesheet"]), template, dialog:not([open])').forEach((n) => n.remove());
  // noscript при выключенных скриптах — обычный контент
  doc.querySelectorAll('noscript').forEach((n) => n.replaceWith(...Array.from(n.childNodes)));
  // встроенные чужие окна → серые заглушки того же размера
  doc.querySelectorAll('iframe, frame, object, embed, video, audio').forEach((n) => {
    const d = doc.createElement('div');
    const w = n.getAttribute('width');
    const h = n.getAttribute('height');
    d.style.cssText = `background:#d9d6cf;width:${w ? `${parseInt(w)}px` : '100%'};height:${h ? `${parseInt(h)}px` : '240px'};max-width:100%`;
    const poster = n.getAttribute('poster');
    if (poster) d.style.background = `#d9d6cf url("${proxied(poster, base)}") center/cover`;
    n.replaceWith(d);
  });
  doc.querySelectorAll('*').forEach((el) => {
    for (const a of Array.from(el.attributes)) {
      if (/^on/i.test(a.name)) el.removeAttribute(a.name);
      else if (/^\s*javascript:/i.test(a.value)) el.setAttribute(a.name, '#');
    }
  });

  // картинки, включая «ленивые»
  doc.querySelectorAll('img, source, input[type="image"]').forEach((el) => {
    const lazy = el.getAttribute('data-src') || el.getAttribute('data-lazy-src') || el.getAttribute('data-original');
    if (lazy) el.setAttribute('src', lazy);
    const lazySet = el.getAttribute('data-srcset') || el.getAttribute('data-lazy-srcset');
    if (lazySet) el.setAttribute('srcset', lazySet);
    const src = el.getAttribute('src');
    if (src) el.setAttribute('src', proxied(src, base));
    const srcset = el.getAttribute('srcset');
    if (srcset) el.setAttribute('srcset', rewriteSrcset(srcset, base));
    el.removeAttribute('loading');
    el.removeAttribute('decoding');
  });
  doc.querySelectorAll('image, use').forEach((el) => {
    for (const attr of ['href', 'xlink:href']) {
      const v = el.getAttribute(attr);
      if (v && !v.startsWith('#')) el.setAttribute(attr, proxied(v, base));
    }
  });
  // формы никуда не отправляются (href у ссылок оставляем — от него зависят стили :link)
  doc.querySelectorAll('form[action]').forEach((el) => el.removeAttribute('action'));

  // встроенные стили
  doc.querySelectorAll<HTMLElement>('[style]').forEach((el) => {
    const s = el.getAttribute('style')!;
    if (/url\(/i.test(s)) {
      el.setAttribute('style', s.replace(/url\(\s*(["']?)([^"')]+)\1\s*\)/gi, (_m, _q, u: string) => {
        const p = proxied(u, base);
        return p ? `url("${p}")` : 'none';
      }));
    }
  });
  for (const st of Array.from(doc.querySelectorAll('style'))) {
    st.textContent = await rewriteCss(st.textContent || '', base);
  }

  // внешние стили: скачиваем через загрузчик и вклеиваем, сохраняя порядок
  const links = Array.from(doc.querySelectorAll<HTMLLinkElement>('link[rel~="stylesheet"]')).slice(0, MAX_STYLESHEETS);
  doc.querySelectorAll('link[rel~="stylesheet"]').forEach((l, i) => i >= MAX_STYLESHEETS && l.remove());
  await Promise.all(
    links.map(async (link) => {
      const abs = absolutize(link.getAttribute('href') || '', base);
      const text = abs ? await fetchText(assetUrl(abs)) : null;
      const style = doc.createElement('style');
      const media = link.getAttribute('media');
      if (media && media !== 'all' && media !== 'screen') style.setAttribute('media', media);
      style.textContent = text ? await rewriteCss(text, abs!) : '';
      link.replaceWith(style);
    }),
  );

  // анимации выключаем, чтобы снимок был в «покое»; прокрутку — тоже
  const calm = doc.createElement('style');
  calm.textContent = '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}html{scroll-behavior:auto!important}';
  doc.head.appendChild(calm);
  const charset = doc.createElement('meta');
  charset.setAttribute('charset', 'utf-8');
  doc.head.prepend(charset);

  return '<!doctype html>\n' + doc.documentElement.outerHTML;
}
