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
  build: { outDir: 'dist', assetsInlineLimit: 0 },
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
  ],
});
