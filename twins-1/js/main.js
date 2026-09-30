/* TWINS 1 — поведение главной: появление при прокрутке, изогнутая лента, счётчики. */
(function () {
  'use strict';
  var root = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- первый экран: запускаем анимацию после первой отрисовки ----------
  requestAnimationFrame(function () {
    requestAnimationFrame(function () { root.classList.add('loaded'); });
  });

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

  // ---------- появление при прокрутке ----------
  var textTargets = '.projects__title, .statement__text, .press, .about__text, .stats li, .footer__top > *';
  var imageTargets = '.card';
  document.querySelectorAll(textTargets).forEach(function (el) { el.setAttribute('data-reveal', ''); });
  document.querySelectorAll(imageTargets).forEach(function (el) { el.setAttribute('data-reveal', 'img'); });

  // соседние элементы в одном ряду появляются лесенкой
  document.querySelectorAll('.row, .stats, .press, .footer__top').forEach(function (group) {
    Array.prototype.forEach.call(group.children, function (el, i) { el.style.transitionDelay = (i * 0.09) + 's'; });
  });

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-in');
      io.unobserve(entry.target);
      // задержку «лесенки» убираем после появления, чтобы наведение реагировало сразу
      setTimeout(function () { entry.target.style.transitionDelay = ''; }, 1800);
    });
  }, { rootMargin: '0px 0px -8% 0px' });
  document.querySelectorAll('[data-reveal]').forEach(function (el) { io.observe(el); });

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

  function paintContrast(el) {
    if (!el) return;
    var r = el.getBoundingClientRect();
    var L = lumAt(r.left + r.width / 2, r.top + r.height / 2);
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

  // ---------- год в подвале ----------
  var year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();
})();
