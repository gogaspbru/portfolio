#!/usr/bin/env node
/*
 * Автопроверка: бот проходит демо до финального экрана настоящими
 * тапами (эмуляция телефона) или кликами мыши (компьютер).
 *
 *   npm run build && npx vite preview --port 4173 &
 *   node scripts/playtest.mjs                  # телефон
 *   node scripts/playtest.mjs --desktop        # компьютер
 *   node scripts/playtest.mjs --url http://localhost:5173/ --shots ./shots
 *
 * Бот тупой: находит ближайшую к коту живую клетку и тапает в неё.
 * Если далеко — кот сам идёт туда (автопилот), рядом — бьёт лапой.
 */
import { chromium, devices } from 'playwright';
import { mkdirSync } from 'node:fs';

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : def;
};
const desktop = args.includes('--desktop');
const url = opt('--url', 'http://localhost:4173/');
const shots = opt('--shots', null);
const timeLimit = Number(opt('--limit', 900)) * 1000;
if (shots) mkdirSync(shots, { recursive: true });

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const context = desktop
  ? await browser.newContext({ viewport: { width: 1280, height: 800 } })
  : await browser.newContext({ ...devices['Pixel 7'] });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

await page.goto(url + (url.includes('?') ? '&' : '?') + 'url=demo&debug=1');
await page.waitForFunction(() => window.__kot, null, { timeout: 15000 });
const t0 = Date.now();
let lastProgress = 0;
let lastLog = 0;
let stuckSince = Date.now();
let i = 0;

while (Date.now() - t0 < timeLimit) {
  const s = await page.evaluate(() => {
    const g = window.__kot;
    const L = g.level;
    const cx = g.cat.x;
    const cy = g.cat.centerY;
    let best = null;
    let bd = Infinity;
    for (let r = 0; r < L.rows; r++) {
      for (let c = 0; c < L.cols; c++) {
        if (L.owner[r * L.cols + c] < 0) continue;
        const x = (c + 0.5) * L.cs;
        const y = (r + 0.5) * L.cs;
        const d = Math.hypot(x - cx, y - cy);
        if (d < bd) { bd = d; best = { x, y }; }
      }
    }
    const final = !document.getElementById('screen-final').hidden;
    return { best, d: bd, progress: L.progress, cam: [g.camera.x, g.camera.y, g.camera.zoom], nav: g.navigator.active, final, fps: g.fps };
  });
  if (s.final) break;
  if (s.progress > lastProgress + 0.001) { lastProgress = s.progress; stuckSince = Date.now(); }
  if (Date.now() - lastLog > 10000) {
    lastLog = Date.now();
    console.log(`${((Date.now() - t0) / 1000).toFixed(0)} с: захват ${(s.progress * 100).toFixed(1)}%, fps ${s.fps.toFixed(0)}`);
  }
  if (!s.best) { await page.waitForTimeout(300); continue; }
  const sx = (s.best.x - s.cam[0]) * s.cam[2];
  const sy = (s.best.y - s.cam[1]) * s.cam[2];
  const vp = page.viewportSize();
  const inView = sx > 4 && sy > 70 && sx < vp.width - 4 && sy < vp.height - 30;
  if (inView && (s.d < 85 || !s.nav)) {
    if (desktop && s.d > 60) {
      // на компьютере бот ходит клавишами к цели по горизонтали
      await page.keyboard.down(s.best.x > (await page.evaluate(() => window.__kot.cat.x)) ? 'KeyD' : 'KeyA');
      await page.waitForTimeout(120);
      await page.keyboard.up('KeyD'); await page.keyboard.up('KeyA');
      if (s.best.y < (await page.evaluate(() => window.__kot.cat.centerY)) - 40) await page.keyboard.press('Space');
      else if (s.best.y > (await page.evaluate(() => window.__kot.cat.y)) + 20) await page.keyboard.press('KeyS');
      await page.mouse.click(sx, sy);
    } else if (desktop) {
      await page.mouse.click(sx, sy);
    } else {
      await page.touchscreen.tap(sx, sy);
    }
  }
  // цель за экраном — человек пошёл бы по стрелке; бот просто зовёт автопилот
  if (!inView && !s.nav) await page.evaluate(({ x, y }) => window.__kot.navigator.goTo(x, y), s.best);
  // застряли надолго — спрыгиваем/прыгаем
  if (Date.now() - stuckSince > 8000) {
    await page.keyboard.press(i++ % 2 ? 'Space' : 'KeyS');
    stuckSince = Date.now();
  }
  await page.waitForTimeout(desktop ? 60 : 180);
  if (shots && i % 40 === 0) await page.screenshot({ path: `${shots}/play-${String(i).padStart(4, '0')}.png` });
  i++;
}

const final = await page.evaluate(() => !document.getElementById('screen-final').hidden);
if (shots) await page.screenshot({ path: `${shots}/final.png` });
const time = await page.evaluate(() => document.getElementById('final-time').textContent);
if (!final && process.env.DUMP_FG) {
  const d = await page.evaluate(() => window.__kot.level.fg.toDataURL());
  (await import('node:fs')).writeFileSync(process.env.DUMP_FG, Buffer.from(d.split(',')[1], 'base64'));
}
if (!final) {
  // диагностика: на чём стоит кот и что осталось
  console.log(await page.evaluate(() => {
    const g = window.__kot, L = g.level, cat = g.cat;
    const r = Math.round(cat.y / L.cs);
    const under = [];
    for (let c = Math.floor((cat.x - 11) / L.cs); c <= Math.floor((cat.x + 11) / L.cs); c++) under.push(L.owner[r * L.cols + c]);
    const alive = L.aliveElements().map((e) => `${e.type}#${e.index} ${e.x},${e.y} ${e.w}x${e.h} cells ${e.cellsAlive} hp ${e.hp.toFixed(0)}`);
    const deadWithCells = L.elements.filter((e) => e.dead && e.cellsAlive > 0).map((e) => `#${e.index} cells ${e.cellsAlive}`);
    return JSON.stringify({ cat: [Math.round(cat.x), Math.round(cat.y), cat.onGround, cat.onPile, cat.anim], under, nav: g.navigator.active, alive, deadWithCells }, null, 1);
  }));
}
console.log(final ? `Финал! Время в игре ${time}, реальное ${((Date.now() - t0) / 1000).toFixed(0)} с` : 'Финал не достигнут');
if (errors.length) console.log('Ошибки на странице:', errors);
await browser.close();
process.exit(final && !errors.length ? 0 : 1);
