/* TWINS 1 — поведение главной: появление при прокрутке, изогнутая лента, счётчики. */
(function () {
  'use strict';
  var root = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var armReveal = function () {}; // заменяется в initReveal(); вызывается после прелоадера

  // год в подвале — до построчной разбивки текста (splitLines перезапишет узел)
  var yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // ---------- прелоадер → появление первого экрана ----------
  var pre = document.getElementById('preloader');
  function reveal() { root.classList.remove('is-loading'); root.classList.add('loaded'); armReveal(); }
  if (reduce || !pre) {
    if (pre) pre.style.display = 'none';
    reveal();
  } else {
    var numEl = document.getElementById('preNum');
    var t0 = performance.now(), DUR = 1200;
    (function tick(t) {
      var k = Math.min(1, (t - t0) / DUR);
      if (numEl) numEl.textContent = Math.round(k * 100);
      if (k < 1) { requestAnimationFrame(tick); return; }
      setTimeout(function () {
        pre.classList.add('is-done');
        reveal();
        pre.addEventListener('transitionend', function () { pre.style.display = 'none'; }, { once: true });
      }, 200);
    })(t0);
  }

  // ---------- меню ----------
  var burger = document.querySelector('.burger');
  var menu = document.getElementById('menu');
  function setMenu(open) {
    root.classList.toggle('menu-open', open);
    burger.setAttribute('aria-expanded', String(open));
    menu.setAttribute('aria-hidden', String(!open));
  }
  // Меню пока выключено — бургер ничего не открывает. Включить: MENU_ENABLED = true
  var MENU_ENABLED = false;
  if (MENU_ENABLED) burger.addEventListener('click', function () { setMenu(!root.classList.contains('menu-open')); });
  menu.addEventListener('click', function (e) { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setMenu(false); });

  // ---------- появление карточек (клип сверху вниз) ----------
  document.querySelectorAll('.card').forEach(function (el) { el.setAttribute('data-reveal', 'img'); });
  document.querySelectorAll('.row').forEach(function (group) {
    Array.prototype.forEach.call(group.children, function (el, i) { el.style.transitionDelay = (i * 0.09) + 's'; });
  });
  var cardIO = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-in');
      cardIO.unobserve(entry.target);
      setTimeout(function () { entry.target.style.transitionDelay = ''; }, 1800);
    });
  }, { rootMargin: '0px 0px -8% 0px' });
  document.querySelectorAll('[data-reveal="img"]').forEach(function (el) { cardIO.observe(el); });

  // ---------- тексты: каждая строка выезжает снизу из-под маски (как на goga.spb.ru) ----------
  var TEXT_TARGETS = '.hero__kicker, .hero__title, .projects__title, .statement__text, .about__text, ' +
    '.footer__title, .footer__label, .footer__col a, .footer__col p, .footer__legal a, ' +
    '.footer__bottom > span, .footer__bottom > a:last-child, .stats li span, .cat__label';
  document.querySelectorAll(TEXT_TARGETS).forEach(function (el) { el.setAttribute('data-reveal-text', ''); });

  (function initReveal() {
    var els = [].slice.call(document.querySelectorAll('[data-reveal-text]'));
    if (!els.length || reduce) return;
    var STAGGER = 0.09;
    var queued = [], armed = false;

    function splitLines(el) {
      var text = el._revealText;
      el.textContent = '';
      var words = text.split(/\s+/).filter(Boolean);
      var spans = words.map(function (w) { var s = document.createElement('span'); s.style.display = 'inline-block'; s.textContent = w; return s; });
      spans.forEach(function (s, i) { el.appendChild(s); if (i < spans.length - 1) el.appendChild(document.createTextNode(' ')); });
      var lines = [], cur = [], top = null;
      spans.forEach(function (s) { var t = s.offsetTop; if (top === null) top = t; if (t - top > 2) { lines.push(cur); cur = []; top = t; } cur.push(s.textContent); });
      if (cur.length) lines.push(cur);
      el.textContent = ''; el._inners = [];
      el.classList.add('reveal-split');
      lines.forEach(function (lw, i) {
        var line = document.createElement('span'); line.className = 'reveal-line';
        var inner = document.createElement('span'); inner.className = 'reveal-line__inner';
        inner.style.transitionDelay = (i * STAGGER) + 's'; inner.textContent = lw.join(' ');
        line.appendChild(inner); el.appendChild(line); el._inners.push(inner);
      });
    }
    function fire(el) { el.classList.add('is-in'); el._revealed = true; }
    var lineMode = !(window.matchMedia && window.matchMedia('(max-width: 640px)').matches);

    els.forEach(function (el) {
      el._revealText = el.textContent.trim();
      if (lineMode) splitLines(el); else el.classList.add('reveal-simple');
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { if (!e.isIntersecting) return; io.unobserve(el); if (armed) fire(el); else queued.push(el); });
      }, { threshold: 0.2, rootMargin: '0px 0px -8% 0px' });
      io.observe(el);
    });

    armReveal = function () { if (armed) return; armed = true; queued.forEach(fire); queued = []; };

    var t;
    window.addEventListener('resize', function () {
      if (!lineMode) return;
      clearTimeout(t);
      t = setTimeout(function () {
        els.forEach(function (el) {
          if (!el._inners) return;
          var was = el._revealed; splitLines(el);
          if (was) {
            el.classList.add('is-in');
            el._inners.forEach(function (i) { i.classList.add('reveal-line--noanim'); });
            void el.offsetWidth;
            el._inners.forEach(function (i) { i.classList.remove('reveal-line--noanim'); });
          }
        });
      }, 200);
    });
  })();

  // ---------- счётчики ----------
  var counters = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      counters.unobserve(entry.target);
      var el = entry.target;
      var to = Number(el.getAttribute('data-count'));
      var suffix = el.getAttribute('data-suffix') || '';
      if (reduce) return;
      var t0 = performance.now();
      var dur = 1400;
      (function tick(t) {
        var k = Math.min(1, (t - t0) / dur);
        var eased = 1 - Math.pow(1 - k, 3);
        el.textContent = Math.round(to * eased) + suffix;
        if (k < 1) requestAnimationFrame(tick);
      })(t0);
    });
  }, { threshold: 0.6 });
  document.querySelectorAll('[data-count]').forEach(function (el) { counters.observe(el); });

  // ---------- изогнутая лента услуг: карточки на цилиндре, поворот от прокрутки ----------
  var section = document.querySelector('.services');
  var ring = document.querySelector('.ring');
  var cards = ring ? Array.prototype.slice.call(ring.children) : [];
  var geo = null;

  function measure() {
    if (!ring) return;
    var w = ring.getBoundingClientRect().width;
    var gap = Math.max(16, w * 0.05);
    var radius = w * 2.3;                                           // больше радиус — меньше изгиб
    var step = 2 * Math.asin((w / 2 + gap / 2) / radius) * 180 / Math.PI;
    geo = { radius: radius, step: step };
  }

  function renderRing() {
    if (!section || !geo) return;
    var r = section.getBoundingClientRect();
    var total = section.offsetHeight - window.innerHeight;
    var p = total > 0 ? Math.min(1, Math.max(0, -r.top / total)) : 0;
    // лента въезжает справа и уезжает влево
    var span = (cards.length - 1) * geo.step;
    var from = geo.step * 0.9;       // первая карточка видна сразу, без пустого экрана
    var to = -span - geo.step * 0.9;
    var rot = from + (to - from) * p;
    cards.forEach(function (card, i) {
      var a = rot + i * geo.step;
      card.style.transform = 'translateZ(' + (-geo.radius) + 'px) rotateY(' + a + 'deg) translateZ(' + geo.radius + 'px)';
      card.style.visibility = Math.abs(a) > 88 ? 'hidden' : '';
    });
  }

  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () { ticking = false; renderRing(); });
  }
  measure();
  renderRing();
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', function () { measure(); renderRing(); });

  // ---------- контрастный логотип/бургер: цвет подбирается под фон ----------
  var logo = document.querySelector('.logo');
  var burger = document.querySelector('.burger');
  var cvs = document.createElement('canvas');
  var ctx = cvs.getContext('2d', { willReadFrequently: true });

  function lumColor(c) {
    var m = c && c.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    var p = m[1].split(',').map(Number);
    if (p.length >= 4 && p[3] === 0) return null; // прозрачный — смотрим глубже
    return (0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2]) / 255;
  }

  function sampleMedia(m, x, y) {
    var nw = m.naturalWidth || m.videoWidth, nh = m.naturalHeight || m.videoHeight;
    if (!nw || !nh) return null;
    var b = m.getBoundingClientRect();
    if (x < b.left || x > b.right || y < b.top || y > b.bottom) return null;
    var cw = Math.max(2, Math.round(b.width / 6)), ch = Math.max(2, Math.round(b.height / 6));
    cvs.width = cw; cvs.height = ch;
    var arB = b.width / b.height, arI = nw / nh, sx, sy, sw, sh;
    if (arI > arB) { sh = nh; sw = nh * arB; sx = (nw - sw) / 2; sy = 0; }
    else { sw = nw; sh = nw / arB; sx = 0; sy = (nh - sh) / 2; }
    try {
      ctx.drawImage(m, sx, sy, sw, sh, 0, 0, cw, ch);
      var lx = Math.min(cw - 1, Math.max(0, Math.round((x - b.left) / b.width * cw)));
      var ly = Math.min(ch - 1, Math.max(0, Math.round((y - b.top) / b.height * ch)));
      var d = ctx.getImageData(lx, ly, 1, 1).data;
      return (0.2126 * d[0] + 0.7152 * d[1] + 0.0722 * d[2]) / 255;
    } catch (e) { return null; } // напр. tainted canvas
  }

  function lumAt(x, y) {
    var els = document.elementsFromPoint(x, y);
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (el.closest && el.closest('.header')) continue; // пропускаем сам логотип/бургер
      var media = (el.tagName === 'IMG' || el.tagName === 'VIDEO') ? el
        : (el.querySelector ? el.querySelector('img, video') : null);
      if (media) { var lm = sampleMedia(media, x, y); if (lm != null) return lm; }
      var lc = lumColor(getComputedStyle(el).backgroundColor);
      if (lc != null) return lc;
    }
    return 1; // по умолчанию считаем фон светлым
  }

  var hero = document.querySelector('.hero');
  function paintContrast(el) {
    if (!el) return;
    var r = el.getBoundingClientRect();
    var cy = r.top + r.height / 2;
    // на первом экране логотип и бургер всегда белые
    if (hero) {
      var h = hero.getBoundingClientRect();
      if (h.top <= cy && h.bottom >= cy) { el.style.color = '#fff'; return; }
    }
    var L = lumAt(r.left + r.width / 2, cy);
    el.style.color = L > 0.5 ? '#111' : '#fff'; // противоположный фону
  }
  function updateContrast() { paintContrast(logo); paintContrast(burger); }

  var cTick = false;
  function onContrast() {
    if (cTick) return; cTick = true;
    requestAnimationFrame(function () { cTick = false; updateContrast(); });
  }
  updateContrast();
  window.addEventListener('scroll', onContrast, { passive: true });
  window.addEventListener('resize', onContrast);
  // фон-видео и фото догружаются/меняют кадр — пересчитываем чуть позже
  [200, 600, 1200, 2000].forEach(function (t) { setTimeout(updateContrast, t); });

  // ---------- плавный скролл (Lenis) ----------
  if (!reduce && typeof Lenis !== 'undefined') {
    var lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 1, smoothWheel: true });
    lenis.on('scroll', function () { onScroll(); onContrast(); });
    function raf(t) { lenis.raf(t); requestAnimationFrame(raf); }
    requestAnimationFrame(raf);
  }
})();
