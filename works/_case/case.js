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
    if (REDUCE) { v.removeAttribute("autoplay"); v.pause(); return; }   // keep the poster still for reduced-motion users
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

  /* ---------- «живой скриншот»: a long site screenshot scrolling inside a device frame ----------
     <div class="live-shot" data-src="img/a.webp[,img/b.webp]" data-speed="60" data-stops="0.2,0.45,0.7"></div>
     Optional: data-bg="#fff" (colour shown while the picture loads, default white);
     data-pause / data-pause-bottom / data-pause-top / data-return (seconds: 1.5 / 2 / 1 / 2.5). No data-stops + zero pauses = never stops.
     Auto-scroll: 1 s pause at the top → down with eased starts/stops, 1.5 s at each stop →
     2 s at the bottom → eased return to the top in 2.5 s → again. Runs only while on screen,
     wheel/swipe scroll it by hand, auto-scroll resumes 3 s after the last input.
     Phones (≤768px): data-src-mobile="img/a-m.webp" — a narrower copy, picked by matchMedia so phones never fetch the big one.
     Video inserts over the picture: data-videos='[{"src":"video/x","x":0,"y":0,"w":100,"h":6,"radius":0,"overlay":"img/x-over.webp"}]'
       src — path without extension (x.webm VP9 first, x.mp4 H.264 second); x/y/w/h — % of the screenshot width/height;
       radius — % of the screenshot width; overlay — transparent layer with the text/plates that sit over the video;
       optional poster. With data-src-mobile, phones get "-m" files (video/x-m.*, img/x-over-m.webp) unless srcMobile/overlayMobile say otherwise.
       The video is hidden until it really plays (its first frame = the screenshot, so there is no jump); if play() is
       refused (iPhone low-power mode) the screenshot simply stays. Only inserts inside the frame play: max 2 at once, 1 on phones
       (the one nearest the middle); data-max-videos overrides. */
  var LS_STATE = { refused: false };
  var LS_MOBILE = window.matchMedia ? window.matchMedia("(max-width: 768px)") : { matches: false };
  function lsList(v) { return (v || "").split(",").map(function (s) { return s.trim(); }).filter(Boolean); }
  function lsMobileName(path) { return path.replace(/(\.[a-z0-9]+)?$/i, "-m$1"); }   // img/a.webp → img/a-m.webp, video/a → video/a-m
  Array.prototype.forEach.call(document.querySelectorAll(".live-shot"), function (box) {
    var hasMobile = box.hasAttribute("data-src-mobile");
    var srcs = lsList(hasMobile && LS_MOBILE.matches ? box.getAttribute("data-src-mobile") : box.getAttribute("data-src"));
    if (!srcs.length) return;
    var SPEED = parseFloat(box.getAttribute("data-speed")) || 60;          // px per second (CSS px)
    var STOPS = (box.getAttribute("data-stops") || "").split(",").map(parseFloat)
      .filter(function (v) { return v > 0 && v < 1; }).sort(function (a, b) { return a - b; });
    function num(name, def) { var v = parseFloat(box.getAttribute(name)); return isNaN(v) ? def : v; }
    var RAMP = 0.8, STOP_PAUSE = num("data-pause", 1.5), BOTTOM_PAUSE = num("data-pause-bottom", 2),
        RETURN_TIME = num("data-return", 2.5), TOP_PAUSE = num("data-pause-top", 1), IDLE = 3;
    if (box.getAttribute("data-bg")) box.style.setProperty("--ls-bg", box.getAttribute("data-bg"));

    var track = document.createElement("div");
    track.className = "live-shot__track";
    var imgs = srcs.map(function (src, i) {
      var img = document.createElement("img");
      img.alt = ""; img.decoding = "async"; img.draggable = false;
      if (i === 0) img.src = src; else img.setAttribute("data-lazy", src);   // later parts load once on screen
      img.addEventListener("load", measure);
      track.appendChild(img);
      return img;
    });
    box.appendChild(track);

    /* ---- video inserts ---- */
    var vids = [];
    try { vids = JSON.parse(box.getAttribute("data-videos") || "[]"); } catch (err) { vids = []; }
    var mob = hasMobile && LS_MOBILE.matches;
    vids = REDUCE ? [] : vids.map(function (v) {
      var wrap = document.createElement("div");
      wrap.className = "live-shot__vid";
      wrap.style.left = (+v.x || 0) + "%"; wrap.style.top = (+v.y || 0) + "%";
      wrap.style.width = (+v.w || 0) + "%"; wrap.style.height = (+v.h || 0) + "%";
      var video = document.createElement("video");
      video.muted = true; video.defaultMuted = true; video.loop = true; video.playsInline = true; video.preload = "none";
      ["muted", "loop", "playsinline", "webkit-playsinline", "disablepictureinpicture", "disableremoteplayback"].forEach(function (a) { video.setAttribute(a, ""); });
      video.setAttribute("preload", "none"); video.setAttribute("aria-hidden", "true"); video.tabIndex = -1;
      if (v.poster) video.poster = mob ? (v.posterMobile || lsMobileName(v.poster)) : v.poster;
      wrap.appendChild(video);
      var over = null;
      if (v.overlay) { over = document.createElement("img"); over.className = "live-shot__over"; over.alt = ""; over.draggable = false; wrap.appendChild(over); }
      track.appendChild(wrap);
      var it = { v: v, wrap: wrap, video: video, over: over, loaded: false, failed: false, playing: false, want: false, base: mob ? (v.srcMobile || lsMobileName(v.src)) : v.src,
                 overSrc: over ? (mob ? (v.overlayMobile || lsMobileName(v.overlay)) : v.overlay) : "" };
      function reveal() {                    // show only when the video plays AND the text layer is ready
        if (it.failed || !it.playing) return;
        if (over && !(over.complete && over.naturalWidth)) return;
        wrap.classList.add("is-on");
      }
      video.addEventListener("playing", function () { it.playing = true; reveal(); });
      video.addEventListener("error", function () { it.failed = true; wrap.classList.remove("is-on"); }, true);
      if (over) over.addEventListener("load", reveal);
      it.start = function () {
        if (it.failed || LS_STATE.refused) return;
        if (!it.loaded) {
          it.loaded = true;
          if (over) over.src = it.overSrc;
          [["webm", "video/webm"], ["mp4", "video/mp4"]].forEach(function (f) {
            var so = document.createElement("source"); so.src = it.base + "." + f[0]; so.type = f[1]; video.appendChild(so);
          });
          video.load();
        }
        var pr = video.play();
        if (pr && pr.catch) pr.catch(function (e) {
          if (e && e.name === "AbortError") return;            // a pause() came first: not a refusal
          it.failed = true; wrap.classList.remove("is-on");    // refused (low-power mode etc.): keep the screenshot
          if (e && e.name === "NotAllowedError") LS_STATE.refused = true;   // and don't download the other videos for nothing
        });
      };
      it.stop = function () { if (!video.paused) video.pause(); };
      return it;
    });
    function maxVideos() { var n = parseInt(box.getAttribute("data-max-videos"), 10); return n > 0 ? n : (LS_MOBILE.matches ? 1 : 2); }
    function updateVideos() {
      if (!vids.length) return;
      var H = box.clientHeight, TH = trackH, on = [];
      if (visible && !document.hidden && TH > 0) {
        vids.forEach(function (it) {
          if (it.failed) return;
          var top = it.v.y / 100 * TH - shown, h = it.v.h / 100 * TH;
          var seen = Math.min(top + h, H) - Math.max(top, 0);
          if (seen >= Math.min(h, H) * 0.25) on.push({ it: it, d: Math.abs(top + h / 2 - H / 2) });
        });
        on.sort(function (a, b) { return a.d - b.d; });
        on = on.slice(0, maxVideos()).map(function (o) { return o.it; });
      }
      vids.forEach(function (it) { if (on.indexOf(it) >= 0) { if (it.video.paused) it.start(); } else it.stop(); });
    }
    document.addEventListener("visibilitychange", updateVideos);

    var y = 0, maxY = 0, shown = -1, trackH = 0, visible = false;
    function measure() {
      trackH = track.offsetHeight;
      vids.forEach(function (it) { if (+it.v.radius) it.wrap.style.borderRadius = (it.v.radius / 100 * track.offsetWidth) + "px"; }); maxY = Math.max(0, trackH - box.clientHeight); y = Math.min(y, maxY); shown = -1; paint(); }
    function paint() {
      var r = Math.round(y);                 // whole pixels keep the text crisp
      if (r !== shown) { shown = r; track.style.transform = "translate3d(0," + (-r) + "px,0)"; updateVideos(); }
    }
    if ("ResizeObserver" in window) new ResizeObserver(measure).observe(box);
    else window.addEventListener("resize", measure);

    /* ---- timeline: one segment at a time (wait or move) ---- */
    var seg = null, clock = 0;               // clock = seconds of auto time actually run
    function S(u) { return u * u * u - u * u * u * u / 2; }   // ∫ smoothstep: eased ramp distance (S(1) = .5)
    function move(to, next) {                // eased start + cruise at SPEED + eased stop
      var from = y, D = Math.abs(to - from), dir = to < from ? -1 : 1;
      if (D < 1) return next();
      var vp = Math.min(SPEED, D / RAMP), T = D / vp + RAMP;
      seg = { t0: clock, T: T, at: function (t) {
        var d = t < RAMP ? vp * RAMP * S(t / RAMP)
              : t > T - RAMP ? D - vp * RAMP * S((T - t) / RAMP)
              : vp * RAMP / 2 + vp * (t - RAMP);
        return from + dir * d;
      }, then: next, to: to };
    }
    function glide(to, time, next) {         // fixed-time ease-in-out (the return to the top)
      var from = y;
      seg = { t0: clock, T: time, at: function (t) { return from + (to - from) * (1 - Math.cos(Math.PI * t / time)) / 2; }, then: next, to: to };
    }
    function wait(sec, next) { seg = { t0: clock, T: sec, at: null, then: next }; }

    function nextStopAfter(pos) {            // first stop (in px) below the current position, else the bottom
      for (var i = 0; i < STOPS.length; i++) { var s = STOPS[i] * maxY; if (s > pos + 2) return s; }
      return maxY;
    }
    function goDown() {
      if (maxY <= 0) return wait(0.5, goDown);
      var to = nextStopAfter(y);
      move(to, to >= maxY - 1 ? function () { wait(BOTTOM_PAUSE, goTop); } : function () { wait(STOP_PAUSE, goDown); });
    }
    function goTop() { glide(0, RETURN_TIME, function () { wait(TOP_PAUSE, goDown); }); }
    function startFromHere() { if (y <= 1) wait(TOP_PAUSE, goDown); else goDown(); }

    /* ---- the loop ---- */
    var hover = false, manualUntil = 0, raf = 0, last = 0;
    var auto = !REDUCE;
    function running() { return auto && visible && !hover && performance.now() >= manualUntil; }
    function frame(now) {
      raf = 0;
      if (!running()) { last = 0; return; }
      var dt = last ? Math.min((now - last) / 1000, 0.1) : 0;
      last = now; clock += dt;
      if (!seg) startFromHere();
      var t = clock - seg.t0;
      if (seg.at) y = Math.max(0, Math.min(maxY, seg.at(Math.min(t, seg.T))));
      paint();
      if (t >= seg.T) { var n = seg.then; seg = null; n(); }
      raf = requestAnimationFrame(frame);
    }
    function kick() { if (!raf && running()) { last = 0; raf = requestAnimationFrame(frame); } }
    function replan() {                      // after a pause mid-move, set off again with an eased start
      if (seg && seg.at) { var to = seg.to, then = seg.then; seg = null; if (to === 0) glide(0, Math.max(RAMP * 2, RETURN_TIME * y / Math.max(maxY, 1)), then); else move(to, then); }
    }

    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (es) {
        visible = es[0].isIntersecting;
        updateVideos();
        if (visible) {
          imgs.forEach(function (img) { var s = img.getAttribute("data-lazy"); if (s) { img.removeAttribute("data-lazy"); img.src = s; } });
          replan(); kick();
        }
      }, { threshold: 0.15 }).observe(box);
    } else { visible = true; imgs.forEach(function (img) { var s = img.getAttribute("data-lazy"); if (s) img.src = s; }); updateVideos(); }

    // the pointer over the block does not stop it (only the wheel/swipe take over); opt back in with data-hover-pause
    if (box.hasAttribute("data-hover-pause") && window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
      box.addEventListener("mouseenter", function () { hover = true; });
      box.addEventListener("mouseleave", function () { hover = false; replan(); kick(); });
    }

    /* ---- manual scroll: wheel + swipe, only inside the picture ---- */
    var idleTimer = 0;
    function manual(dy) {                    // returns true if the picture actually moved
      var ny = Math.max(0, Math.min(maxY, y + dy));
      if (ny === y) return false;
      y = ny; paint();
      seg = null;                            // auto-scroll resumes from here
      manualUntil = performance.now() + IDLE * 1000;
      clearTimeout(idleTimer);
      idleTimer = setTimeout(kick, IDLE * 1000 + 30);
      return true;
    }
    box.addEventListener("wheel", function (e) {
      var dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * box.clientHeight : e.deltaY;
      if (manual(dy)) e.preventDefault();    // at the very top/bottom the page scrolls as usual
    }, { passive: false });
    var tx = 0, ty = 0, axis = "";
    box.addEventListener("touchstart", function (e) { var p = e.touches[0]; tx = p.clientX; ty = p.clientY; axis = ""; }, { passive: true });
    box.addEventListener("touchmove", function (e) {
      var p = e.touches[0], dx = tx - p.clientX, dy = ty - p.clientY;
      if (!axis) { if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return; axis = Math.abs(dy) > Math.abs(dx) ? "y" : "x"; }
      if (axis !== "y") return;
      if (manual(dy)) { e.preventDefault(); tx = p.clientX; ty = p.clientY; }   // at an edge: let the page scroll
    }, { passive: false });

    measure();
  });


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

  /* ---------- rails that fly right → left as the page scrolls ([data-scrollx="from,to"]) ----------
     from/to are design px (1600 grid): the shift when the rail enters the screen and when it leaves;
     data-scrollx-m="from,to" gives separate values for phones (375 grid) */
  (function () {
    var rails = Array.prototype.map.call(document.querySelectorAll("[data-scrollx]"), function (el) {
      var ft = el.getAttribute("data-scrollx").split(",").map(Number);
      var fm = (el.getAttribute("data-scrollx-m") || "").split(",").map(Number);   // optional mobile values, px of the 375 grid
      return { el: el, target: el.firstElementChild || el, from: ft[0] || 0, to: ft[1] || 0,
               fromM: fm.length === 2 ? fm[0] : null, toM: fm.length === 2 ? fm[1] : null, last: null };
    });
    if (!rails.length || REDUCE) return;
    var ticking = false;
    function update() {
      ticking = false;
      var vh = window.innerHeight, w = window.innerWidth;
      var scale = w <= 760 ? w / 375 * 0.45 : Math.min(w, 1920) / 1600;
      for (var i = 0; i < rails.length; i++) {
        var r = rails[i], b = r.el.getBoundingClientRect();
        if (b.bottom < -100 || b.top > vh + 100) continue;
        var p = Math.min(1, Math.max(0, (vh - b.top) / (vh + b.height)));
        var mob = w <= 760 && r.fromM !== null;
        var a = mob ? r.fromM : r.from, z = mob ? r.toM : r.to, sc = mob ? w / 375 : scale;
        var x = ((a + (z - a) * p) * sc).toFixed(1);
        if (x !== r.last) { r.target.style.setProperty("--sx", x + "px"); r.last = x; }
      }
    }
    function req() { if (!ticking) { ticking = true; requestAnimationFrame(update); } }
    window.addEventListener("scroll", req, { passive: true });
    window.addEventListener("resize", req);
    update();
  })();

  /* ---------- photo that follows the mouse ([data-tilt], desktop only) ---------- */
  (function () {
    var boxes = document.querySelectorAll("[data-tilt]");
    if (!boxes.length || REDUCE) return;
    if (!window.matchMedia || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    Array.prototype.forEach.call(boxes, function (box) {
      box.addEventListener("mousemove", function (e) {
        var b = box.getBoundingClientRect();
        var nx = (e.clientX - b.left) / b.width, ny = (e.clientY - b.top) / b.height;
        box.style.setProperty("--tx", ((0.5 - nx) * 40).toFixed(1) + "px");
        box.style.setProperty("--ty", ((0.5 - ny) * 26).toFixed(1) + "px");
        box.style.setProperty("--ts", "1.06");
        box.style.setProperty("--gx", (nx * 100).toFixed(1) + "%");
        box.style.setProperty("--gy", (ny * 100).toFixed(1) + "%");
        box.style.setProperty("--go", "1");
      });
      box.addEventListener("mouseleave", function () {
        ["--tx", "--ty", "--ts", "--go"].forEach(function (k) { box.style.removeProperty(k); });
      });
    });
  })();

  /* ---------- gooey cursor over a photo ([data-goo]) ----------
     the pointer leaves a trail of soft blobs that melt into each other (blur + alpha threshold)
     and show the same photo in a burgundy duotone; each blob swells, then shrinks away.
     desktop with a mouse only */
  (function () {
    var hosts = document.querySelectorAll("[data-goo]");
    if (!hosts.length || REDUCE) return;
    if (!window.matchMedia || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    var NS = "http://www.w3.org/2000/svg";
    var TTL = 1100;          // ms a blob lives
    var R = 95;              // blob radius at its biggest, in photo pixels (photo is ~3000 wide)
    var STEP = 34;           // a new blob every N photo pixels of movement

    Array.prototype.forEach.call(hosts, function (host, n) {
      var img = host.querySelector("img");
      if (!img) return;
      var W = img.getAttribute("width"), H = img.getAttribute("height");
      var src = img.currentSrc || img.getAttribute("src");
      var id = "goo" + n;
      var svg = document.createElementNS(NS, "svg");
      svg.setAttribute("class", "c-goo");
      svg.setAttribute("viewBox", "0 0 " + W + " " + H);
      svg.setAttribute("preserveAspectRatio", "xMidYMid slice");   // = object-fit: cover
      svg.setAttribute("aria-hidden", "true");
      svg.setAttribute("data-speed", img.getAttribute("data-speed") || "0");
      svg.innerHTML =
        '<defs>' +
          '<filter id="' + id + '-f" x="-20%" y="-20%" width="140%" height="140%">' +
            '<feGaussianBlur in="SourceGraphic" stdDeviation="22"/>' +
            '<feColorMatrix values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 28 -11"/>' +
          '</filter>' +
          '<filter id="' + id + '-tone" color-interpolation-filters="sRGB">' +
            '<feColorMatrix type="saturate" values="0"/>' +
            '<feComponentTransfer>' +
              '<feFuncR type="table" tableValues="0.16 0.62 0.98"/>' +
              '<feFuncG type="table" tableValues="0.03 0.12 0.88"/>' +
              '<feFuncB type="table" tableValues="0.06 0.17 0.80"/>' +
            '</feComponentTransfer>' +
          '</filter>' +
          '<mask id="' + id + '-m" maskUnits="userSpaceOnUse" x="0" y="0" width="' + W + '" height="' + H + '">' +
            '<g filter="url(#' + id + '-f)" fill="#fff"></g>' +
          '</mask>' +
        '</defs>' +
        '<image href="' + src + '" width="' + W + '" height="' + H + '" preserveAspectRatio="xMidYMid slice"' +
          ' filter="url(#' + id + '-tone)" mask="url(#' + id + '-m)"/>';
      host.appendChild(svg);
      para.push(svg);   // same parallax as the photo
      var group = svg.querySelector("mask g");

      var blobs = [], raf = null, last = null;
      function toPhoto(e) {
        var m = svg.getScreenCTM();
        if (!m) return null;
        var p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY;
        return p.matrixTransform(m.inverse());
      }
      function add(x, y) {
        var c = document.createElementNS(NS, "circle");
        c.setAttribute("cx", x.toFixed(1)); c.setAttribute("cy", y.toFixed(1)); c.setAttribute("r", "0");
        group.appendChild(c);
        blobs.push({ el: c, t: performance.now(), k: 0.75 + Math.random() * 0.5 });
      }
      function tick(now) {
        for (var i = blobs.length - 1; i >= 0; i--) {
          var b = blobs[i], a = (now - b.t) / TTL;
          if (a >= 1) { group.removeChild(b.el); blobs.splice(i, 1); continue; }
          // swell fast, then shrink slowly
          var s = a < 0.18 ? 1 - Math.pow(1 - a / 0.18, 3) : 1 - Math.pow((a - 0.18) / 0.82, 1.6);
          b.el.setAttribute("r", (R * b.k * s).toFixed(1));
        }
        raf = blobs.length ? requestAnimationFrame(tick) : null;
      }
      host.addEventListener("mousemove", function (e) {
        var p = toPhoto(e);
        if (!p) return;
        if (!last) { add(p.x, p.y); last = p; }
        else {
          var dx = p.x - last.x, dy = p.y - last.y, d = Math.sqrt(dx * dx + dy * dy);
          if (d >= STEP) {
            var steps = Math.min(12, Math.floor(d / STEP));
            for (var i = 1; i <= steps; i++) add(last.x + dx * i / steps, last.y + dy * i / steps);
            last = p;
          }
        }
        if (!raf) raf = requestAnimationFrame(tick);
      });
      host.addEventListener("mouseleave", function () { last = null; });
    });
  })();

  /* ---------- custom cursor, as on the home page (js/app.js initCursor) ----------
     a dot under the pointer and a trailing ring that grows over links */
  (function () {
    if (!window.matchMedia || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    var cores = navigator.hardwareConcurrency, mem = navigator.deviceMemory;
    if (REDUCE || (cores > 0 && cores <= 2) || (mem > 0 && mem <= 2)) return;   // same low-power rule as the home page

    var ring = document.createElement("div");
    var dot = document.createElement("div");
    ring.className = "cursor-ring";
    dot.className = "cursor-dot";
    document.body.appendChild(ring);
    document.body.appendChild(dot);
    doc.classList.add("cursor-on");

    var mx = window.innerWidth / 2, my = window.innerHeight / 2;
    var rx = mx, ry = my, shown = false, raf = null;
    var hoverSel = "a, button";

    function loop() {
      rx += (mx - rx) * 0.18;
      ry += (my - ry) * 0.18;
      ring.style.transform = "translate(" + rx + "px," + ry + "px)";
      if (Math.abs(mx - rx) < 0.1 && Math.abs(my - ry) < 0.1) { raf = null; return; }
      raf = requestAnimationFrame(loop);
    }
    document.addEventListener("mousemove", function (e) {
      mx = e.clientX; my = e.clientY;
      dot.style.transform = "translate(" + mx + "px," + my + "px)";
      if (!shown) { shown = true; doc.classList.add("cursor-ready"); }
      if (!raf) raf = requestAnimationFrame(loop);
    });
    document.addEventListener("mouseover", function (e) {
      if (e.target.closest && e.target.closest(hoverSel)) doc.classList.add("cursor-hover");
    });
    document.addEventListener("mouseout", function (e) {
      if (e.target.closest && e.target.closest(hoverSel)) doc.classList.remove("cursor-hover");
    });
    doc.addEventListener("mouseleave", function () { doc.classList.remove("cursor-ready"); });
    doc.addEventListener("mouseenter", function () { if (shown) doc.classList.add("cursor-ready"); });
  })();

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
      if (e.ctrlKey || e.defaultPrevented) return;   // pinch-zoom; or a .live-shot already used this wheel
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
