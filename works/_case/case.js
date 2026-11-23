/* ============================================================
   Case pages — shared behaviour. No dependencies.
   - reveals ([data-in], .c-reveal, .c-rise, …) via IntersectionObserver
   - videos play only while on screen; poster "breathes" if the file is missing
   - parallax for [data-speed] elements
   - dark footer from the home page, uncovered as the page scrolls away
   - endless moving rows in the dark block (direction per row, speeds up
     with scroll, slows down under the cursor)
   ============================================================ */
(function () {
  "use strict";

  var doc = document.documentElement;

  /* links to folders ("../../", "../kulturadoma/") are clean on the server;
     opened from disk (file://) they would show a file list, so add index.html */
  if (location.protocol === "file:") {
    Array.prototype.forEach.call(document.querySelectorAll("a[href]"), function (a) {
      var h = a.getAttribute("href");
      if (/\/$/.test(h) && !/^[a-z]+:/i.test(h)) a.setAttribute("href", h + "index.html");
    });
  }
  var REDUCE = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- reveals ---------- */
  var revealSel = "[data-in], .c-reveal, .c-rise, .c-phones, .c-tablet, .c-dark, .c-shapes, .c-pair__slate, [data-risers], [data-orbit]";
  var revealEls = Array.prototype.slice.call(document.querySelectorAll(revealSel));

  if (REDUCE || !("IntersectionObserver" in window)) {
    revealEls.forEach(function (el) { el.classList.add("is-in"); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add("is-in");
        io.unobserve(e.target);
      });
    }, { rootMargin: "0px 0px -12% 0px", threshold: 0.01 });
    revealEls.forEach(function (el) { io.observe(el); });
  }

  /* stagger text that sits together: each [data-in] in a block waits a bit */
  Array.prototype.forEach.call(document.querySelectorAll(".c-text"), function (block) {
    Array.prototype.forEach.call(block.querySelectorAll("[data-in]"), function (el, i) {
      if (!el.style.getPropertyValue("--d")) el.style.setProperty("--d", (i * 0.08) + "s");
    });
  });

  /* ---------- numbers that count up once they come into view ([data-count]) ---------- */
  if (!REDUCE && "IntersectionObserver" in window) {
    var countIo = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        countIo.unobserve(e.target);
        var el = e.target, to = parseFloat(el.getAttribute("data-count")) || 0, t0 = null, dur = 1400;
        var step = function (now) {
          if (t0 === null) t0 = now;
          var p = Math.min(1, (now - t0) / dur);
          el.textContent = String(Math.round(to * (1 - Math.pow(1 - p, 3))));
          if (p < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      });
    }, { rootMargin: "0px 0px -15% 0px" });
    Array.prototype.forEach.call(document.querySelectorAll("[data-count]"), function (el) {
      if (parseFloat(el.getAttribute("data-count")) > 1) el.textContent = "0";
      countIo.observe(el);
    });
  }

  /* ---------- videos: play on screen, pause off screen ---------- */
  Array.prototype.forEach.call(document.querySelectorAll("[data-video]"), function (box) {
    var v = box.querySelector("video");
    if (!v) return;
    var sources = v.querySelectorAll("source");
    var failed = 0;
    function markFallback() { box.classList.add("is-fallback"); }
    Array.prototype.forEach.call(sources, function (s) {
      s.addEventListener("error", function () { failed++; if (failed >= sources.length) markFallback(); });
    });
    v.addEventListener("error", markFallback);
    if (REDUCE) return;   // keep the poster still for reduced-motion users
    if (!("IntersectionObserver" in window)) { v.play().catch(function () {}); return; }
    var vo = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          if (v.preload === "none") { v.preload = "auto"; }
          var p = v.play(); if (p && p.catch) p.catch(function () {});
        } else {
          v.pause();
        }
      });
    }, { threshold: 0.15 });
    vo.observe(box);
  });

  /* ---------- figures that swap while the screen holds ---------- */
  Array.prototype.forEach.call(document.querySelectorAll("[data-shapes]"), function (box) {
    var shapes = box.querySelectorAll(".c-shape");
    var n = shapes.length, current = 0;
    var sticky = box.querySelector(".c-shapes__sticky");
    box.style.setProperty("--n", String(n));
    function update() {
      var r = box.getBoundingClientRect();
      var sh = sticky ? sticky.offsetHeight : window.innerHeight;
      var travel = r.height - sh;                          // scroll distance while pinned
      if (travel <= 0) return;
      var pinTop = (window.innerHeight - sh) / 2;          // the sticky area sits mid-screen
      var p = Math.min(1, Math.max(0, (pinTop - r.top) / travel));
      var i = Math.min(n - 1, Math.floor(p * n));
      if (i === current) return;
      shapes[current].classList.remove("is-active");
      shapes[i].classList.add("is-active");
      current = i;
    }
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    update();
  });

  /* ---------- footer (same as the home page) ----------
     The dark footer is fixed behind the white .page. Give the page a bottom
     margin equal to the footer height so scrolling past the last block lifts
     the page away and uncovers the footer. */
  var page = document.querySelector(".page");
  var footer = document.querySelector(".site-footer");
  var yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();
  if (page && footer) {
    var syncFooter = function () { page.style.marginBottom = footer.offsetHeight + "px"; };
    syncFooter();
    window.addEventListener("resize", syncFooter);
    window.addEventListener("load", syncFooter);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(syncFooter);
    // keep it hidden until the user scrolls (avoids a load-time flash on iOS)
    var showFooter = function () { footer.classList.add("is-visible"); window.removeEventListener("scroll", onFooterScroll); };
    var onFooterScroll = function () { if (window.pageYOffset > 60) showFooter(); };
    window.addEventListener("scroll", onFooterScroll, { passive: true });
    setTimeout(showFooter, 1800);

    // statement text: lines float up once about half of it is uncovered
    var stmt = footer.querySelector("[data-reveal]");
    if (stmt && !REDUCE) {
      var text = stmt.textContent.trim();
      var lineMode = !window.matchMedia("(max-width: 640px)").matches;
      var split = function () {
        if (!lineMode) return;
        stmt.textContent = "";
        var spans = text.split(/\s+/).map(function (w, i, a) {
          var s = document.createElement("span");
          s.style.display = "inline-block"; s.textContent = w;
          stmt.appendChild(s);
          if (i < a.length - 1) stmt.appendChild(document.createTextNode(" "));
          return s;
        });
        var lines = [], cur = [], top = null;
        spans.forEach(function (s) {
          if (top === null) top = s.offsetTop;
          if (s.offsetTop - top > 2) { lines.push(cur); cur = []; top = s.offsetTop; }
          cur.push(s.textContent);
        });
        if (cur.length) lines.push(cur);
        stmt.textContent = "";
        lines.forEach(function (ws, i) {
          var line = document.createElement("span"); line.className = "reveal-line";
          var inner = document.createElement("span"); inner.className = "reveal-line__inner";
          inner.style.transitionDelay = (i * 0.09) + "s";
          inner.textContent = ws.join(" ");
          line.appendChild(inner); stmt.appendChild(line);
        });
      };
      if (!lineMode) stmt.classList.add("reveal-simple");
      var checkStmt = function () {
        var r = stmt.getBoundingClientRect();
        if (page.getBoundingClientRect().bottom <= r.top + r.height * 0.5) {
          window.removeEventListener("scroll", checkStmt);
          split();                     // measure at the final width, then animate
          void stmt.offsetWidth;
          stmt.classList.add("is-in");
        }
      };
      window.addEventListener("scroll", checkStmt, { passive: true });
      checkStmt();
    }
  }

  if (REDUCE) return;

  /* ---------- footer circles: magnetic pull + electric outline (mouse only) ---------- */
  if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
    var socials = Array.prototype.slice.call(document.querySelectorAll(".social"));
    socials.forEach(function (el) {
      var icon = el.querySelector(".social__icon");
      el.addEventListener("mousemove", function (e) {
        var r = el.getBoundingClientRect();
        var mx = e.clientX - (r.left + r.width / 2), my = e.clientY - (r.top + r.height / 2);
        el.style.transition = "transform .18s ease-out, background .3s ease";
        el.style.transform = "translate(" + (mx * 0.35) + "px," + (my * 0.35) + "px)";
        if (icon) { icon.style.transition = "transform .18s ease-out"; icon.style.transform = "translate(" + (mx * 0.18) + "px," + (my * 0.18) + "px)"; }
      });
      el.addEventListener("mouseleave", function () {
        el.style.transition = ""; el.style.transform = "";
        if (icon) { icon.style.transition = ""; icon.style.transform = ""; }
      });
    });
    var turb = document.querySelector("#electricFx feTurbulence");
    if (turb) {
      var hovering = 0, sraf = null, st = 0;
      var crackle = function () {
        st += 1;
        if (st % 4 === 0) {
          turb.setAttribute("seed", ((st / 4) * 2) % 211);
          turb.setAttribute("baseFrequency", (0.06 + Math.sin(st * 0.09) * 0.03).toFixed(4));
        }
        sraf = hovering > 0 ? requestAnimationFrame(crackle) : null;
      };
      socials.forEach(function (el) {
        el.addEventListener("mouseenter", function () { hovering++; if (!sraf) sraf = requestAnimationFrame(crackle); });
        el.addEventListener("mouseleave", function () { hovering = Math.max(0, hovering - 1); });
      });
    }
  }

  /* ---------- parallax ---------- */
  var para = Array.prototype.slice.call(document.querySelectorAll("[data-speed]"))
    .filter(function (el) { return !el.closest("[data-marquee]"); });

  var zoomers = Array.prototype.slice.call(document.querySelectorAll("[data-zoom]")).map(function (el) {
    return { el: el, target: el.querySelector(".c-laptop__device") || el, last: null };
  });

  var risers = Array.prototype.map.call(document.querySelectorAll(".c-phones__stage, [data-risers]"), function (stage) {
    return { stage: stage, phones: Array.prototype.map.call(stage.querySelectorAll("[data-rise]"), function (el) {
      return { el: el, order: parseFloat(el.getAttribute("data-rise")) || 0, last: null };
    }) };
  });

  /* ---------- marquee rows ---------- */
  var rows = Array.prototype.slice.call(document.querySelectorAll("[data-marquee] .c-row")).map(function (row) {
    var track = row.querySelector(".c-track");
    var dir = parseFloat(row.getAttribute("data-dir")) || -1;
    row.style.setProperty("--dir", String(-dir));
    // duplicate the cards so the loop is seamless at any width
    var originals = Array.prototype.slice.call(track.children);
    for (var n = 0; n < 2; n++) {
      originals.forEach(function (c) {
        var clone = c.cloneNode(true);
        clone.setAttribute("aria-hidden", "true");
        var img = clone.querySelector("img"); if (img) img.alt = "";
        track.appendChild(clone);
      });
    }
    return {
      row: row, track: track, dir: dir,
      speed: parseFloat(row.getAttribute("data-speed")) || 30,   // px per second at 1600px
      x: 0, period: 0, hover: 0, hoverTarget: 1
    };
  });
  function measure() {
    rows.forEach(function (r) {
      var kids = r.track.children, count = kids.length / 3;
      // one period = width of the original set (first card → first clone)
      r.period = kids[count].offsetLeft - kids[0].offsetLeft;
      if (r.dir > 0 && r.x === 0) r.x = -r.period;
    });
  }
  rows.forEach(function (r) {
    r.row.addEventListener("mouseenter", function () { r.hoverTarget = 0.18; });
    r.row.addEventListener("mouseleave", function () { r.hoverTarget = 1; });
  });

  var darkVisible = true;
  var dark = document.querySelector(".c-dark");
  var pageEl = document.querySelector(".page");
  if (dark && pageEl) doc.classList.add("js-fade");
  // colour the page fades to: data-tint="r,g,b" on .c-dark (default: night)
  var tint = ((dark && dark.getAttribute("data-tint")) || "18,19,23").split(",").map(Number);
  if (dark && "IntersectionObserver" in window) {
    new IntersectionObserver(function (es) { darkVisible = es[0].isIntersecting; }, { rootMargin: "200px 0px" }).observe(dark);
  }

  var lastY = window.scrollY, boost = 0, last = performance.now();
  function frame(now) {
    var dt = Math.min(0.05, (now - last) / 1000); last = now;
    var y = window.scrollY, vh = window.innerHeight;
    var dy = y - lastY; lastY = y;
    // scroll gives the rows a push; it decays smoothly
    boost += (Math.min(60, Math.abs(dy)) * 0.9 - boost) * 0.08;

    if (darkVisible) {
      var scale = Math.min(window.innerWidth, 1920) / 1600;
      if (window.innerWidth <= 760) scale = window.innerWidth / 375 * 0.45;
      rows.forEach(function (r) {
        r.hover += (r.hoverTarget - r.hover) * 0.06;
        var v = (r.speed * scale + boost * 6 * scale) * r.hover;
        r.x += r.dir * v * dt;
        if (r.period) {
          if (r.x <= -r.period) r.x += r.period;
          if (r.x > 0) r.x -= r.period;
        }
        r.track.style.setProperty("--x", r.x.toFixed(2) + "px");
      });
    }

    // soft entry: tint the page from white to night as the dark block comes up, back on the way out
    if (dark && pageEl) {
      var dr = dark.getBoundingClientRect();
      var tin = Math.min(1, Math.max(0, (vh * 0.85 - dr.top) / (vh * 0.55)));
      var tout = Math.min(1, Math.max(0, (dr.bottom - vh * 0.15) / (vh * 0.55)));
      var t = Math.min(tin, tout);
      t = t * t * (3 - 2 * t);                                   // smoothstep
      var tk = t.toFixed(3);
      if (tk !== dark._t) {
        dark._t = tk;
        var c = function (a, b) { return Math.round(a + (b - a) * t); };
        pageEl.style.backgroundColor = "rgb(" + c(255, tint[0]) + "," + c(255, tint[1]) + "," + c(255, tint[2]) + ")";
      }
    }

    // laptop grows from 90% to full size as it comes up the screen
    for (var zi = 0; zi < zoomers.length; zi++) {
      var zr = zoomers[zi].el.getBoundingClientRect();
      if (zr.bottom < -200 || zr.top > vh + 200) continue;
      var zp = Math.min(1, Math.max(0, (vh - zr.top) / (vh * 0.9)));
      var zv = (1 - Math.pow(1 - zp, 3)).toFixed(4);
      if (zv !== zoomers[zi].last) { zoomers[zi].target.style.setProperty("--z", zv); zoomers[zi].last = zv; }
      if (zv > 0.88 && !zoomers[zi].awake) { zoomers[zi].awake = true; zoomers[zi].el.classList.add("is-awake"); }
    }

    // phones rise out of the beige panel one after another, then hold still
    for (var j = 0; j < risers.length; j++) {
      var st = risers[j].stage.getBoundingClientRect();
      if (st.bottom < -200 || st.top > vh + 200) continue;
      var pr = Math.min(1, Math.max(0, (vh - st.top) / (vh * 0.85)));
      risers[j].phones.forEach(function (ph) {
        var k = Math.min(1, Math.max(0, (pr - ph.order * 0.14) / 0.6));
        var rise = (Math.pow(1 - k, 3)).toFixed(4);                // easeOutCubic, 1 → 0
        if (rise !== ph.last) { ph.el.style.setProperty("--rise", rise); ph.last = rise; }
      });
    }

    for (var i = 0; i < para.length; i++) {
      var el = para[i];
      var box = (el.closest(".c-reveal, .c-phones__stage") || el).getBoundingClientRect();
      if (box.bottom < -200 || box.top > vh + 200) continue;
      var center = box.top + box.height / 2 - vh / 2;
      var s = (parseFloat(el.getAttribute("data-speed")) || 0) * (window.innerWidth <= 760 ? 0.45 : 1);
      el.style.setProperty("--py", (-center * s).toFixed(1) + "px");
    }
    requestAnimationFrame(frame);
  }

  function start() { measure(); requestAnimationFrame(frame); }
  if (document.readyState === "complete") start(); else window.addEventListener("load", start);
  window.addEventListener("resize", function () { rows.forEach(function (r) { r.x = 0; }); measure(); });
  // images inside rows are lazy — re-measure once they size in
  Array.prototype.forEach.call(document.querySelectorAll("[data-marquee] img"), function (img) {
    if (!img.complete) img.addEventListener("load", measure, { once: true });
  });

  /* ---------- smooth scroll + thin scrollbar, as on the home page (js/app.js) ----------
     desktop with a mouse only; off for reduced motion and clearly weak machines */
  (function () {
    if (!window.matchMedia || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

    /* thin custom scrollbar */
    doc.classList.add("scrollbar-on");
    var thumb = document.createElement("div");
    thumb.className = "scrollbar__thumb";
    document.body.appendChild(thumb);
    var MARGIN = 14;
    function updateBar() {
      var docH = doc.scrollHeight, winH = window.innerHeight, maxS = docH - winH;
      if (maxS <= 2) { thumb.style.opacity = "0"; return; }
      thumb.style.opacity = "";
      var trackH = winH - MARGIN * 2;
      var thumbH = Math.max(32, (winH / docH) * trackH);
      var y = MARGIN + (window.pageYOffset / maxS) * (trackH - thumbH);
      thumb.style.height = thumbH + "px";
      thumb.style.transform = "translateY(" + y + "px)";
    }
    window.addEventListener("scroll", updateBar, { passive: true });
    window.addEventListener("resize", updateBar);
    window.addEventListener("load", updateBar);
    updateBar();

    /* inertial wheel scroll */
    var cores = navigator.hardwareConcurrency, mem = navigator.deviceMemory;
    if (REDUCE || (cores > 0 && cores <= 2) || (mem > 0 && mem <= 2)) return;

    var current = window.pageYOffset, target = current, running = false;
    var ease = 0.1;                 // lower = smoother / more inertia (same as the home page)
    function clamp(v) { return Math.max(0, Math.min(v, doc.scrollHeight - window.innerHeight)); }
    function raf() {
      current += (target - current) * ease;
      if (Math.abs(target - current) < 0.4) { current = target; window.scrollTo(0, current); running = false; return; }
      window.scrollTo(0, current);
      requestAnimationFrame(raf);
    }
    window.addEventListener("wheel", function (e) {
      if (e.ctrlKey) return;        // leave pinch-zoom to the browser
      e.preventDefault();
      var unit = e.deltaMode === 1 ? 16 : (e.deltaMode === 2 ? window.innerHeight : 1);
      target = clamp(target + e.deltaY * unit);
      if (!running) { running = true; requestAnimationFrame(raf); }
    }, { passive: false });
    // keep in sync when the page is scrolled by other means (keyboard, links, scrollbar drag)
    window.addEventListener("scroll", function () {
      if (!running) current = target = window.pageYOffset;
    }, { passive: true });
    window.addEventListener("resize", function () { target = clamp(target); current = clamp(current); });
  })();

  doc.classList.add("js-ready");
})();
