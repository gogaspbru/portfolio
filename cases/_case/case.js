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
  var REDUCE = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- reveals ---------- */
  var revealSel = "[data-in], .c-reveal, .c-rise, .c-phones, .c-tablet, .c-dark, .c-shapes, .c-pair__slate";
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
    box.style.setProperty("--n", String(n));
    function update() {
      var r = box.getBoundingClientRect();
      var travel = r.height - window.innerHeight;          // scroll distance while pinned
      if (travel <= 0) return;
      var p = Math.min(1, Math.max(0, -r.top / travel));
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

  doc.classList.add("js-ready");
})();
