import { defineConfig } from 'vite';
import { cpSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Vite — только dev-сервер и сборка статики (без фреймворков).
// Скрипты в js/ — обычные (не модули): страница работает и двойным кликом
// по index.html (file://), как и любая статичная вёрстка.
// base: './' — относительные пути, сборку можно положить в любую папку шаблона Битрикса.
export default defineConfig({
  base: './',
  server: { host: true, port: 5173 },
  preview: { host: true, port: 4173 },
  build: {
    outDir: 'dist',
    rollupOptions: {
      // страницы: основной вариант (видео) и варианты первого экрана
      input: {
        main: resolve(__dirname, 'index.html'),
        matrix: resolve(__dirname, 'index-matrix.html'),
        cubes: resolve(__dirname, 'index-cubes.html'),
        line: resolve(__dirname, 'index-line.html'),
      },
    },
    // Шрифт woff2 встраиваем в CSS (data:) — Chrome не грузит шрифты с file://.
    assetsInlineLimit: (file) => file.endsWith('.woff2'),
  },
  plugins: [
    {
      // crossorigin у <link rel="stylesheet"> ломает загрузку CSS с диска (file://)
      name: 'no-crossorigin',
      apply: 'build',
      enforce: 'post',
      transformIndexHtml: (html) => html.replace(/ crossorigin(?=[ >])/g, ''),
    },
    {
      // Vite не собирает обычные <script src> и видео из data-src —
      // копируем js/ и assets/video/ в сборку как есть.
      name: 'copy-static',
      closeBundle() {
        for (const dir of ['js', 'assets/video']) {
          const from = resolve(__dirname, dir);
          if (existsSync(from)) cpSync(from, resolve(__dirname, 'dist', dir), { recursive: true });
        }
      },
    },
  ],
});
