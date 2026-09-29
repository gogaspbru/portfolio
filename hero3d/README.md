# hero3d — первые два экрана с 3D-логотипом

Отдельный Vite-проект, основной сайт (`../index.html`) не затронут.

```
cd hero3d
npm i
npm run dev      # lil-gui справа сверху (только в dev)
npm run build    # tsc + vite build → hero3d/dist
```

- `src/config.ts` — все параметры (раскладка, экструзия, материал, свет, ракурс).
- `src/logo.ts` — `../assets/logo.svg` → по mesh на каждый контур (`#v-mark`, `#top-bar`),
  каждая часть центрирована вокруг себя, `basePosition` — место в собранном знаке.
- `src/stage.ts` — renderer (ACESFilmic, sRGB, DPR ≤ 2), RoomEnvironment, composer.
- `src/material.ts` — материал знака.
- `src/gui.ts` — lil-gui.

`assets/logo.svg` восстановлен из присланного PDF (два контура, координаты 1:1).
