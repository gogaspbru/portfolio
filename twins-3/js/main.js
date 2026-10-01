/* TWINS 3 — поведение: прелоадер, крупный логотип → полоска, построчные тексты, стопка блоков, Lenis. */
(function () {
  'use strict';
  var root = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var armReveal = function () {};

  var yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // ---------- прелоадер v3: линия-прогресс, затем плавное исчезновение ----------
  var pre = document.getElementById('preloader');
  function reveal() { root.classList.remove('is-loading'); root.classList.add('loaded'); armReveal(); }
  if (reduce || !pre) {
    if (pre) pre.style.display = 'none';
    reveal();
  } else {
    var bar = document.getElementById('preBar');
    var t0 = performance.now(), DUR = 1100;
    (function tick(t) {
      var k = Math.min(1, (t - t0) / DUR);
      var e = 1 - Math.pow(1 - k, 3); // easeOutCubic
      if (bar) bar.style.transform = 'scaleX(' + e + ')';
      if (k < 1) { requestAnimationFrame(tick); return; }
      setTimeout(function () {
        pre.classList.add('is-done');
        reveal();
        pre.addEventListener('transitionend', function () { pre.style.display = 'none'; }, { once: true });
      }, 180);
    })(t0);
  }

  // ---------- меню ----------
  var burger = document.querySelector('.burger');
  var menu = document.getElementById('menu');
  function setMenu(open) {
    root.classList.toggle('menu-open', open);
    if (burger) burger.setAttribute('aria-expanded', String(open));
    if (menu) menu.setAttribute('aria-hidden', String(!open));
  }
  if (burger) burger.addEventListener('click', function () { setMenu(!root.classList.contains('menu-open')); });
  if (menu) menu.addEventListener('click', function (e) { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setMenu(false); });

  // ---------- крупный логотип уезжает в полоску по мере скролла ----------
  var brand = document.getElementById('brand');
  var header = document.getElementById('header');
  function updateBrand() {
    if (!brand) return;
    var vh = window.innerHeight, vw = window.innerWidth;
    var mobile = window.matchMedia('(max-width: 760px)').matches;
    var range = vh * (mobile ? 0.34 : 0.42);
    var p = Math.min(1, Math.max(0, window.scrollY / range));
    var base = brand.offsetWidth || 110;                 // ширина лого при scale 1
    var targetBig = mobile ? vw * 0.74 : Math.min(vw * 0.52, 820); // крупный размер вверху
    var K = Math.max(1, targetBig / base);
    var centerY = vh * (mobile ? 0.15 : 0.16);           // где центр крупного лого
    var natCenter = (brand.offsetTop || 18) + (brand.offsetHeight || 37) / 2;
    var DOWN = Math.max(0, centerY - natCenter);
    var scale = 1 + (1 - p) * (K - 1);
    var ty = (1 - p) * DOWN;
    brand.style.transform = 'translate(-50%,' + ty + 'px) scale(' + scale + ')';
    if (header) header.classList.toggle('is-compact', p > 0.6);
  }

  // ---------- появление плиток портфолио: «выпадают» снизу ----------
  var pjIO = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-in');
      pjIO.unobserve(entry.target);
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -6% 0px' });
  document.querySelectorAll('.pj').forEach(function (el) { pjIO.observe(el); });

  // ---------- мобильная «бегущая» лента логотипов прессы ----------
  (function () {
    var press = document.querySelector('.press');
    if (!press) return;
    var mq = window.matchMedia('(max-width: 760px)');
    var clones = [];
    function enable() {
      if (clones.length) return;
      [].slice.call(press.children).forEach(function (li) {
        var c = li.cloneNode(true); c.setAttribute('aria-hidden', 'true');
        press.appendChild(c); clones.push(c);
      });
      press.classList.add('is-marquee');
    }
    function disable() { clones.forEach(function (c) { c.remove(); }); clones = []; press.classList.remove('is-marquee'); }
    function sync() { if (mq.matches) enable(); else disable(); }
    sync();
    if (mq.addEventListener) mq.addEventListener('change', sync); else if (mq.addListener) mq.addListener(sync);
  })();

  // ---------- тексты: каждая строка выезжает снизу из-под маски ----------
  var TEXT_TARGETS = '.statement__text';
  document.querySelectorAll(TEXT_TARGETS).forEach(function (el) { el.setAttribute('data-reveal-text', ''); });

  (function initReveal() {
    var els = [].slice.call(document.querySelectorAll('[data-reveal-text]'));
    if (!els.length || reduce) return;
    var STAGGER = 0.08;
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
          if (was) { el.classList.add('is-in'); el._inners.forEach(function (i) { i.classList.add('reveal-line--noanim'); }); void el.offsetWidth; el._inners.forEach(function (i) { i.classList.remove('reveal-line--noanim'); }); }
        });
      }, 200);
    });
  })();

  // ---------- скролл-обработчики + Lenis ----------
  var tick = false;
  function onScroll() { if (tick) return; tick = true; requestAnimationFrame(function () { tick = false; updateBrand(); }); }
  updateBrand();
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', updateBrand);

  if (!reduce && typeof Lenis !== 'undefined') {
    var lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 1, smoothWheel: true });
    lenis.on('scroll', updateBrand);
    function raf(t) { lenis.raf(t); requestAnimationFrame(raf); }
    requestAnimationFrame(raf);
  }
})();
