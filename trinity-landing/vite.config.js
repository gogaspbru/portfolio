import { defineConfig } from 'vite';
import { cpSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Vite используется только как dev-сервер и сборщик статики (без фреймворков).
// base: './' — относительные пути, чтобы сборку можно было положить
// в любую папку шаблона Битрикса.
export default defineConfig({
  base: './',
  server: { host: true, port: 5173 },
  preview: { host: true, port: 4173 },
  build: {
    outDir: 'dist',
    // Шрифт woff2 встраиваем в CSS (data:), остальное — файлами.
    // Chrome не грузит шрифты с file:// — так сборка работает и двойным кликом.
    assetsInlineLimit: (file) => file.endsWith('.woff2'),
    modulePreload: false,
    cssCodeSplit: false, // CSS — отдельным файлом, а не внутри JS
    rollupOptions: {
      // Один обычный (не модульный) скрипт: сборка открывается и работает
      // даже двойным кликом по dist/index.html (file://), где браузеры
      // блокируют <script type="module">.
      output: { format: 'iife', inlineDynamicImports: true },
    },
  },
  plugins: [
    {
      // Видео подключается из JS (data-src), поэтому Vite сам его не видит —
      // копируем папку assets/video в сборку как есть.
      name: 'copy-hero-video',
      closeBundle() {
        const from = resolve(__dirname, 'assets/video');
        if (existsSync(from)) cpSync(from, resolve(__dirname, 'dist/assets/video'), { recursive: true });
      },
    },
    {
      // Для file:// убираем type="module" и crossorigin (CORS на диске не работает),
      // скрипт подключаем с defer — порядок выполнения тот же, что у модуля.
      name: 'classic-script-for-file-protocol',
      apply: 'build',
      enforce: 'post',
      transformIndexHtml(html) {
        return html
          .replace(/<script type="module" crossorigin src=/g, '<script defer src=')
          .replace(/<link rel="stylesheet" crossorigin href=/g, '<link rel="stylesheet" href=');
      },
    },
  ],
});
