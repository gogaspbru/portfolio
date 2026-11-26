#!/usr/bin/env node
/*
 * Генератор демо-уровня: рендерит demo/page.html в headless Chromium,
 * снимает скриншот и разметку элементов тем же сборщиком, что и сервер.
 * Результат: client/public/demo/demo.png + demo.json
 *
 *   npm run demo
 *
 * Если Playwright не находит свой Chromium, укажите путь:
 *   CHROMIUM_PATH=/path/to/chrome npm run demo
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const WIDTH = 1280;
const MAX_HEIGHT = 800 * 3;

const extractor = readFileSync(join(root, 'shared/extract-elements.js'), 'utf8');
const html = readFileSync(join(root, 'demo/page.html'), 'utf8');

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const page = await browser.newPage({ viewport: { width: WIDTH, height: 800 }, deviceScaleFactor: 1 });
await page.setContent(html, { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);

const level = await page.evaluate(`(${extractor.trim()})(${JSON.stringify({ width: WIDTH, maxHeight: MAX_HEIGHT })})`);
const png = await page.screenshot({ clip: { x: 0, y: 0, width: WIDTH, height: level.height }, fullPage: true });
await browser.close();

writeFileSync(join(root, 'client/public/demo/demo.png'), png);
writeFileSync(join(root, 'client/public/demo/demo.json'), JSON.stringify(level, null, 1) + '\n');
const byType = {};
for (const e of level.elements) byType[e.type] = (byType[e.type] || 0) + 1;
console.log(`demo: ${level.width}x${level.height}, элементов ${level.elements.length}`, byType, `png ${(png.length / 1024).toFixed(0)} КБ`);
