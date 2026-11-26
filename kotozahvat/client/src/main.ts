import './ui/styles.css';
import { CONFIG } from './config';
import { Game } from './Game';
import { DEMO_ID, loadLevel, normalizeSiteInput } from './api';
import type { LevelData } from '../../shared/types';
import { buildProceduralCat } from './cat/proceduralCat';
import { loadCatSprites, type SpriteSheet } from './cat/spriteSheet';
import { $, CatPreview, formatTime, show, toast } from './ui/dom';

const LOADING_STATUSES = [
  'Кот изучает вёрстку…',
  'Ищет, где потеплее…',
  'Принюхивается к заголовкам…',
  'Точит когти о кнопки…',
  'Проверяет, что плохо лежит…',
];

const params = new URLSearchParams(location.search);
const isTouch = matchMedia('(pointer: coarse)').matches;

let sheet: SpriteSheet;
let game: Game | null = null;
let currentSite = DEMO_ID;
let startPreview: CatPreview;
let loadingPreview: CatPreview;
let hintTimer = 0;

async function init() {
  sheet = await loadCatSprites(import.meta.env.BASE_URL);
  startPreview = new CatPreview($<HTMLCanvasElement>('start-cat'), sheet, 'idle');
  loadingPreview = new CatPreview($<HTMLCanvasElement>('loading-cat'), sheet, 'run');

  if (params.get('sprites') === 'export') {
    showSpriteExport();
    return;
  }

  $('start-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const value = $<HTMLInputElement>('url-input').value;
    launch(value.trim() || DEMO_ID);
  });
  document.querySelectorAll<HTMLButtonElement>('[data-url]').forEach((b) => {
    b.addEventListener('click', () => launch(b.dataset.url!));
  });
  $('hud-exit').addEventListener('click', () => toStart());
  $('btn-again').addEventListener('click', () => toStart());
  $('btn-share').addEventListener('click', () => share());

  const initial = params.get('url');
  if (initial) launch(initial);
  else toStart();
}

function toStart() {
  game?.destroy();
  game = null;
  $('app').classList.remove('playing');
  show($('screen-final'), false);
  show($('screen-loading'), false);
  show($('hud'), false);
  show($('screen-start'), true);
  loadingPreview.stop();
  startPreview.start();
}

async function launch(raw: string) {
  const site = normalizeSiteInput(raw);
  currentSite = site;
  show($('start-error'), false);
  show($('screen-start'), false);
  show($('screen-loading'), true);
  startPreview.stop();
  loadingPreview.start();
  $('loading-site').textContent = site === DEMO_ID ? 'Демо-сайт «Котовости»' : site;

  let i = 0;
  const status = $('loading-status');
  status.textContent = LOADING_STATUSES[0];
  const statusTimer = window.setInterval(() => {
    i = (i + 1) % LOADING_STATUSES.length;
    status.textContent = LOADING_STATUSES[i];
  }, 900);

  try {
    const [level] = await Promise.all([loadLevel(raw), new Promise((r) => setTimeout(r, CONFIG.ui.minLoadingMs))]);
    clearInterval(statusTimer);
    loadingPreview.stop();
    show($('screen-loading'), false);
    startGame(level.data, level.image);
  } catch (err) {
    clearInterval(statusTimer);
    toStart();
    const e = $('start-error');
    e.textContent = err instanceof Error ? err.message : 'Сайт не открылся';
    show(e, true);
  }
}

function startGame(data: LevelData, image: CanvasImageSource) {
  game?.destroy();
  $('app').classList.add('playing');
  show($('hud'), true);
  const bench = Number(params.get('bench')) || undefined;
  game = new Game($<HTMLCanvasElement>('game'), data, image, sheet, {
    onProgress: (p, ms, remaining) => {
      const pct = Math.floor(p * 100);
      $('hud-pct').textContent = `${pct}%`;
      $('hud-bar').style.width = `${p * 100}%`;
      $('hud-time').textContent = formatTime(ms);
      $('hud-pct').title = `Осталось элементов: ${remaining}`;
    },
    onFirstInput: () => hideHint(1500),
    onWin: (stats) => {
      $('final-time').textContent = formatTime(stats.timeMs);
      $('final-elements').textContent = String(stats.elements);
      $('final-site').textContent = currentSite === DEMO_ID ? 'Демо-сайт «Котовости»' : currentSite;
      show($('hud'), false);
      show($('screen-final'), true);
    },
  }, { debug: params.has('debug'), bench });
  game.start();
  if (params.has('debug')) (window as unknown as { __kot: Game }).__kot = game; // для отладки и smoke-теста

  const hint = $('hud-hint');
  hint.textContent = isTouch
    ? 'Тап — идти · тап по блоку — лапой · держать — когти · свайп вниз — спрыгнуть'
    : 'A/D — бег · пробел — прыжок, ещё раз — кульбит, держать — лезть вверх · S — вниз · клик — лапой · зажать — когти';
  hint.classList.remove('hide');
  show(hint, true);
  hideHint(9000);
}

function hideHint(after: number) {
  clearTimeout(hintTimer);
  hintTimer = window.setTimeout(() => $('hud-hint').classList.add('hide'), after);
}

async function share() {
  const url = new URL(location.href);
  url.search = '';
  url.searchParams.set('url', currentSite);
  const time = $('final-time').textContent;
  const what = currentSite === DEMO_ID ? 'демо-сайт' : currentSite;
  const text = `Мой кот захватил ${what} на 100% за ${time}. Выпусти своего!`;
  try {
    if (navigator.share) {
      await navigator.share({ title: 'Котозахват', text, url: url.toString() });
      return;
    }
    await navigator.clipboard.writeText(`${text} ${url}`);
    toast('Ссылка скопирована');
  } catch (e) {
    if ((e as Error).name !== 'AbortError') toast('Не получилось поделиться — скопируй адрес из строки браузера');
  }
}

/** ?sprites=export — показать текущий спрайт-лист и описание, чтобы нарисовать своего кота */
function showSpriteExport() {
  const builtin = buildProceduralCat();
  const canvas = builtin.image as HTMLCanvasElement;
  const { image: _image, ...meta } = builtin;
  const json = JSON.stringify({ ...meta, scale: CONFIG.cat.spriteScale }, null, 2);
  const card = document.querySelector('#screen-start .card')!;
  card.className = 'card sprite-export';
  card.innerHTML = `
    <h2>Спрайты кота</h2>
    <p class="muted">Нарисуйте поверх этого листа своего кота, сохраните как <b>cat.png</b>
    и положите вместе с <b>cat.json</b> в <code>client/public/sprites/</code>.</p>
    <img alt="Спрайт-лист" src="${canvas.toDataURL()}">
    <pre>${json}</pre>
    <div class="final-actions">
      <a class="btn btn-main" download="cat.png" href="${canvas.toDataURL()}">Скачать cat.png</a>
      <a class="btn btn-alt" download="cat.json" href="data:application/json;charset=utf-8,${encodeURIComponent(json)}">Скачать cat.json</a>
    </div>`;
  card.querySelectorAll<HTMLElement>('a.btn').forEach((a) => (a.style.lineHeight = '50px'));
  show($('screen-start'), true);
}

init();
