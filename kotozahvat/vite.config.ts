import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

// Клиент собирается в папку /kot в корне репозитория-портфолио,
// чтобы открываться по адресу goga.spb.ru/kot/.
// base: './' — относительные пути, сборка работает из любой подпапки.
export default defineConfig({
  root: fileURLToPath(new URL('./client', import.meta.url)),
  base: './',
  build: {
    outDir: fileURLToPath(new URL('../kot', import.meta.url)),
    emptyOutDir: true,
    target: 'es2020',
  },
  server: { host: true },
});
