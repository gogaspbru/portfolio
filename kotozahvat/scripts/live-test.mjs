#!/usr/bin/env node
/*
 * Проверка загрузки настоящих сайтов (этап 2) без интернета:
 * поднимает тестовые сайты из test-sites/ и PHP-загрузчик, потом в браузере
 * вводит адреса в игру и смотрит, что получилось.
 *
 *   npm run build && node scripts/live-test.mjs
 *
 * Нужен установленный php (8.x). Для теста загрузчику разрешён localhost
 * (переменная KOTOZAHVAT_DEV_ALLOW_LOCAL=1 — на хостинге её нет).
 */
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const procs = [
  spawn('php', ['-S', '127.0.0.1:8191', '-t', join(root, 'test-sites')], { stdio: 'ignore' }),
  spawn('php', ['-S', '127.0.0.1:8192', '-t', join(root, '..')], { stdio: 'ignore', env: { ...process.env, KOTOZAHVAT_DEV_ALLOW_LOCAL: '1' } }),
];
await new Promise((r) => setTimeout(r, 800));

const API = 'http://127.0.0.1:8192/kot/api/fetch.php';
let failed = 0;
const check = (name, ok, info = '') => {
  console.log(`${ok ? '✓' : '✗'} ${name}${info ? ' — ' + info : ''}`);
  if (!ok) failed++;
};

try {
  // --- загрузчик напрямую ---
  const api = async (q) => (await fetch(`${API}?${q}`)).json().catch(() => ({}));
  const enc = encodeURIComponent;
  check('SSRF: редирект на 169.254.169.254 запрещён', (await api(`mode=page&url=${enc('http://127.0.0.1:8191/evil.php')}`)).error === 'private');
  check('SSRF: 10.0.0.1 запрещён', (await api(`mode=page&url=${enc('http://10.0.0.1/')}`)).error === 'private');
  check('только http/https', (await api(`mode=page&url=${enc('file:///etc/passwd')}`)).error === 'bad_url');
  check('лимит размера', (await api(`mode=page&url=${enc('http://127.0.0.1:8191/big.php')}`)).error === 'too_big');
  check('редирект внутри сайта', (await api(`mode=page&url=${enc('http://127.0.0.1:8191/redirect.php')}`)).url === 'http://127.0.0.1:8191/index.html');
  check('HTML не отдаётся как картинка', (await api(`mode=asset&url=${enc('http://127.0.0.1:8191/cp1251.html')}`)).error === 'type');

  // --- целиком в игре ---
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('dialog', (d) => { errors.push('чужой скрипт выполнился: ' + d.message()); d.dismiss(); });
  const play = async (url) => {
    await page.goto('http://127.0.0.1:8192/kot/?debug=1');
    await page.fill('#url-input', url);
    await page.click('button[type=submit]');
    await page.waitForFunction(() => window.__kot || !document.getElementById('start-error').hidden, null, { timeout: 40000 });
    const r = await page.evaluate(() => window.__kot
      ? { elements: window.__kot.level.elements.length, text: '' }
      : { elements: 0, text: document.getElementById('start-error').textContent });
    await page.evaluate(() => { window.__kot?.destroy(); window.__kot = undefined; });
    return r;
  };
  const news = await play('http://127.0.0.1:8191/');
  check('новостной сайт с внешним CSS и картинками', news.elements > 40, `${news.elements} элементов`);
  const cp = await play('http://127.0.0.1:8191/cp1251.html');
  check('сайт в windows-1251', cp.elements >= 6, `${cp.elements} элементов`);
  const spa = await play('http://127.0.0.1:8191/spa.html');
  check('сайт на скриптах — понятная ошибка', /скриптами/.test(spa.text), spa.text);
  check('без ошибок и чужих скриптов на странице', errors.length === 0, errors.join('; '));
  await browser.close();
} finally {
  procs.forEach((p) => p.kill());
}
console.log(failed ? `\nПровалено: ${failed}` : '\nВсё хорошо');
process.exit(failed ? 1 : 0);
