# Портфолио — Егор Сорокин &amp; Co

Одностраничный сайт-портфолио на чистом HTML + CSS + JS. Без сборки,
без фреймворков, без зависимостей.

## Структура

```
index.html            — разметка страницы
css/styles.css        — все стили (переменные в :root задают внешний вид)
js/app.js             — логика (сетка работ, «Загрузить ещё», курсор, скролл, прелоадер)
data/works.js         — список работ (добавляйте свои сюда)
assets/works/         — превью изображений для работ
assets/placeholders/  — нейтральные заглушки 16:9
assets/logos/         — логотипы клиентов для бегущих лент
scripts/gen-placeholders.py  — генерирует заглушки и пример works.js
scripts/build-standalone.py  — собирает всё в один файл scripts/standalone.html
cases/                — страницы кейсов (см. cases/README.md)
```

## Как добавить работу

Откройте `data/works.js` и допишите объект в массив `window.__WORKS__`:

```json
{
  "type": "photo",
  "title": "Название",
  "category": "Website",
  "year": "2025",
  "preview": "assets/works/my-image.jpg",
  "link": "https://example.com/"
}
```

- `type`: `"photo"` или `"video"`.
- Для видео добавьте поле `"video": "assets/works/my-clip.mp4"` — оно
  проигрывается по наведению; `preview` показывается до наведения.
- `link` открывается в новой вкладке по клику на плитку.

Кладите свои изображения в `assets/works/`, видео — туда же.

## Запуск

Просто откройте `index.html` двойным кликом: сервер не нужен, всё работает
прямо с диска (список работ лежит в `data/works.js`, а не в JSON). Кейсы тоже
открываются двойным кликом по `cases/<имя>/index.html`.

При желании можно запустить и через сервер: `python3 -m http.server 8137`.

## Один файл

```
python3 scripts/build-standalone.py
```

соберёт `scripts/standalone.html` со всеми ресурсами внутри — его можно
открыть прямо с диска или переслать одним файлом.
