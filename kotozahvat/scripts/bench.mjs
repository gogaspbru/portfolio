#!/usr/bin/env node
/*
 * Бенчмарк осколков: сколько летящих осколков держит игра при 60 fps.
 *   npm run build && npx vite preview --port 4173 &
 *   node scripts/bench.mjs [--cpu 4]    # --cpu N — замедлить процессор в N раз (≈ средний телефон)
 * Важно: headless Chromium рисует без видеокарты, так что цифры — ориентир,
 * а не замер на реальном устройстве.
 */
import { chromium, devices } from 'playwright';

const args = process.argv.slice(2);
const cpu = Number(args[args.indexOf('--cpu') + 1]) || 1;
const url = 'http://localhost:4173/';
const counts = [1000, 2500, 4000, 6000, 10000, 15000];

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
for (const [name, opts] of [['компьютер 1280×800', { viewport: { width: 1280, height: 800 } }], ['телефон Pixel 7', devices['Pixel 7']]]) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  if (cpu > 1) {
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
  }
  const row = [];
  for (const n of counts) {
    await page.goto(`${url}?url=demo&debug=1&bench=${n}`);
    await page.waitForFunction(() => window.__kot, null, { timeout: 30000 });
    await page.waitForTimeout(3000);
    // средний fps за 3 секунды
    const fps = await page.evaluate(() => new Promise((res) => {
      let frames = 0; const t0 = performance.now();
      const f = () => { frames++; if (performance.now() - t0 < 3000) requestAnimationFrame(f); else res(frames / ((performance.now() - t0) / 1000)); };
      requestAnimationFrame(f);
    }));
    const live = await page.evaluate(() => window.__kot.debris.count);
    row.push(`${n} (живых ${live}): ${fps.toFixed(0)} fps`);
  }
  console.log(`${name}${cpu > 1 ? `, CPU ×${cpu} медленнее` : ''}:\n  ` + row.join('\n  '));
  await ctx.close();
}
await browser.close();
