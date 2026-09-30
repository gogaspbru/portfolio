/*
 * Сбор прямоугольников видимых элементов страницы.
 *
 * Файл содержит ОДНО выражение-функцию без импортов и внешних ссылок:
 * его читают как текст и выполняют внутри страницы через Playwright
 * (`page.evaluate(`(${source})(${JSON.stringify(opts)})`)`).
 * Используется и генератором демо-уровня, и сервером — формат один.
 *
 * Возвращает { width, height, background, elements: [{ id, type, x, y, w, h }] }
 * Порядок элементов — порядок отрисовки: родительский блок раньше детей,
 * поэтому на клиенте «кто позже, тот сверху».
 */
(function extractElements(opts) {
  const width = opts.width;
  const maxHeight = opts.maxHeight;
  const minSize = opts.minSize || 8;
  const maxElements = opts.maxElements || 500;

  const docHeight = Math.max(document.documentElement.scrollHeight, document.body ? document.body.scrollHeight : 0);
  const height = Math.min(docHeight, maxHeight);
  const pageArea = width * height;

  const consumed = new Set(); // «атомарные» элементы: их потомков не разбираем
  const order = new Map(); // элемент → порядковый номер обхода
  const found = []; // { el, type, r }

  const parseColor = (c) => {
    const m = /rgba?\(([^)]+)\)/.exec(c || '');
    if (!m) return null;
    const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };
  const bodyBgColor = (() => {
    for (const el of [document.body, document.documentElement]) {
      if (!el) continue;
      const c = parseColor(getComputedStyle(el).backgroundColor);
      if (c && c.a > 0.1) return c;
    }
    return { r: 255, g: 255, b: 255, a: 1 };
  })();
  const sameColor = (a, b) => Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b) < 12;

  const isVisible = (el, cs) => {
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.visibility === 'collapse') return false;
    if (typeof el.checkVisibility === 'function') {
      return el.checkVisibility({ opacityProperty: true, visibilityProperty: true });
    }
    return Number(cs.opacity) > 0.05;
  };

  const toPage = (r) => {
    const x1 = Math.max(0, r.left + window.scrollX);
    const y1 = Math.max(0, r.top + window.scrollY);
    const x2 = Math.min(width, r.right + window.scrollX);
    const y2 = Math.min(height, r.bottom + window.scrollY);
    if (x2 - x1 < minSize || y2 - y1 < minSize) return null;
    return { x: Math.round(x1), y: Math.round(y1), w: Math.round(x2 - x1), h: Math.round(y2 - y1) };
  };

  const hasText = (el) => (el.textContent || '').trim().length > 0;
  const hasBox = (cs) => {
    const bg = parseColor(cs.backgroundColor);
    if (bg && bg.a > 0.1 && !sameColor(bg, bodyBgColor)) return true;
    for (const side of ['Top', 'Right', 'Bottom', 'Left']) {
      const w = parseFloat(cs['border' + side + 'Width']);
      const c = parseColor(cs['border' + side + 'Color']);
      if (w >= 1 && cs['border' + side + 'Style'] !== 'none' && c && c.a > 0.2) return true;
    }
    return false;
  };
  const hasBgImage = (cs) => /url\(/.test(cs.backgroundImage || '');

  // Прямоугольник по содержимому (текст бывает уже своего блока).
  const contentRect = (el) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    const rr = range.getBoundingClientRect();
    const er = el.getBoundingClientRect();
    if (rr.width < 1 || rr.height < 1) return er;
    return {
      left: Math.max(rr.left, er.left), top: Math.max(rr.top, er.top),
      right: Math.min(rr.right, er.right), bottom: Math.min(rr.bottom, er.bottom),
    };
  };

  const add = (el, type, rect) => {
    const r = toPage(rect);
    if (r) found.push({ el, type, r });
  };

  // ---- Проход 1: картинки, кнопки, заголовки, крупные блоки ----
  let idx = 0;
  const walk = (el) => {
    order.set(el, idx++);
    const tag = el.tagName;
    if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT' || tag === 'TEMPLATE' || tag === 'HEAD') return;
    const cs = getComputedStyle(el);
    if (!isVisible(el, cs)) {
      // display:contents виден через детей, остальное пропускаем целиком
      if (cs.display !== 'contents') return;
    }
    const rect = el.getBoundingClientRect();

    if (tag === 'IMG' || tag === 'VIDEO' || tag === 'CANVAS' || tag === 'IFRAME' || tag === 'svg' || tag === 'SVG' || tag === 'OBJECT' || tag === 'EMBED') {
      if (rect.width >= 16 && rect.height >= 16) add(el, 'image', rect);
      consumed.add(el);
      return;
    }
    if (/^H[1-6]$/.test(tag)) {
      if (hasText(el)) add(el, 'heading', contentRect(el));
      consumed.add(el);
      return;
    }
    const role = el.getAttribute('role');
    const formControl = tag === 'BUTTON' || tag === 'SELECT' || tag === 'TEXTAREA' || (tag === 'INPUT' && el.type !== 'hidden');
    const styledSmall = hasBox(cs) && rect.height <= 90 && rect.width <= 420 && hasText(el);
    if (formControl || role === 'button' || styledSmall) {
      add(el, 'button', rect);
      consumed.add(el);
      return;
    }
    if (hasBgImage(cs) && !hasText(el) && rect.width >= 24 && rect.height >= 24) {
      add(el, 'image', rect);
      consumed.add(el);
      return;
    }
    if ((hasBox(cs) || hasBgImage(cs)) && rect.width >= 40 && rect.height >= 30 && rect.width * rect.height < pageArea * 0.5) {
      add(el, 'block', rect);
    }
    for (const child of el.children) walk(child);
  };
  if (document.body) walk(document.body);

  // ---- Проход 2: текст. Текстовые узлы группируются по ближайшему блочному предку ----
  const isConsumed = (node) => {
    for (let p = node.parentElement; p; p = p.parentElement) if (consumed.has(p)) return true;
    return false;
  };
  const hosts = new Map(); // host → rect (объединение)
  const tw = document.createTreeWalker(document.body || document.documentElement, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  for (let n = tw.nextNode(); n; n = tw.nextNode()) {
    if (!n.nodeValue || !n.nodeValue.trim()) continue;
    const parent = n.parentElement;
    if (!parent || /^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE)$/.test(parent.tagName)) continue;
    if (isConsumed(n)) continue;
    let host = parent;
    while (host.parentElement && /^(inline|contents)$/.test(getComputedStyle(host).display)) host = host.parentElement;
    const hcs = getComputedStyle(parent);
    if (!isVisible(parent, hcs)) continue;
    range.selectNodeContents(n);
    const r = range.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    const prev = hosts.get(host);
    if (prev) {
      prev.left = Math.min(prev.left, r.left); prev.top = Math.min(prev.top, r.top);
      prev.right = Math.max(prev.right, r.right); prev.bottom = Math.max(prev.bottom, r.bottom);
    } else {
      hosts.set(host, { left: r.left, top: r.top, right: r.right, bottom: r.bottom });
    }
  }
  for (const [host, r] of hosts) add(host, 'text', r);

  // ---- Порядок отрисовки, дубли, лимит ----
  found.sort((a, b) => (order.get(a.el) ?? 0) - (order.get(b.el) ?? 0));
  const seen = new Set();
  let list = [];
  for (let i = found.length - 1; i >= 0; i--) {
    const f = found[i];
    const key = f.r.x + ':' + f.r.y + ':' + f.r.w + ':' + f.r.h;
    if (seen.has(key)) continue; // одинаковые прямоугольники — оставляем верхний
    seen.add(key);
    list.push(f);
  }
  list.reverse();
  if (list.length > maxElements) {
    const keep = new Set(list.slice().sort((a, b) => b.r.w * b.r.h - a.r.w * a.r.h).slice(0, maxElements));
    list = list.filter((f) => keep.has(f));
  }

  const bg = bodyBgColor;
  return {
    width,
    height,
    background: 'rgb(' + bg.r + ',' + bg.g + ',' + bg.b + ')',
    elements: list.map((f, i) => ({ id: i + 1, type: f.type, x: f.r.x, y: f.r.y, w: f.r.w, h: f.r.h })),
  };
})
