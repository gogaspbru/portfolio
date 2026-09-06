/* ============================================================
   Portfolio logic — no dependencies.
   - Loads works from data/works.json
   - Renders 18 at a time via "Загрузить ещё"
   - Each row: caption on the left, light 16:9 tile on the right
   - Photo & video tiles; click opens link in a new tab
   - Duplicates logos for seamless marquees
   ============================================================ */
(function () {
  "use strict";

  var ROWS_PER_LOAD = 6;   // load 6 full rows at a time (18 on 3 cols, 12 on 2 cols)

  // Marquee logos. Add/remove files in assets/logos/ and list them here.
  // (window.__LOGOS__ lets the single-file build inline them as data URIs.)
  // The first 18 (01–18) render as the initial grid, in this order; the rest
  // (19–36) get shuffled in by the blur-swap rotation.
  var LOGOS = window.__LOGOS__ || [
    "assets/logos/01_panasonic.svg", "assets/logos/02_mariott.svg", "assets/logos/03_obit.svg",
    "assets/logos/04_black_star.svg", "assets/logos/05_rpk_nord.svg", "assets/logos/06_svam.svg",
    "assets/logos/07_ptk.svg", "assets/logos/08_surgutneftregaz.svg", "assets/logos/09_bank_russia.svg",
    "assets/logos/10_585gold.svg", "assets/logos/11_olmio.svg", "assets/logos/12_spbgut.svg",
    "assets/logos/13_fujitsy.svg", "assets/logos/14_azottech.svg", "assets/logos/15_vas_pivo.svg",
    "assets/logos/16_aquafor.svg", "assets/logos/17_tatprom.svg", "assets/logos/18_dpd.svg",
    "assets/logos/19_amrest.svg", "assets/logos/20_banda.svg", "assets/logos/21_crafter.svg",
    "assets/logos/22_gaga.svg", "assets/logos/23_gaide.svg", "assets/logos/24_imaika.svg",
    "assets/logos/25_itaka.svg", "assets/logos/26_key.svg", "assets/logos/27_komfortel.svg",
    "assets/logos/28_kultura_doma.svg", "assets/logos/29_limak.svg", "assets/logos/30_nienshanc.svg",
    "assets/logos/31_osc.svg", "assets/logos/32_pulsar.svg", "assets/logos/33_texet.svg",
    "assets/logos/34_tiret.svg", "assets/logos/35_trinity.svg", "assets/logos/36_umi.svg"
  ];

  var list = document.getElementById("grid");
  var loadMoreBtn = document.getElementById("loadMore");
  var preloader = document.getElementById("preloader");

  var works = [];
  var rendered = 0;
  var refreshScrollbar = null;   // set by initScrollbar()
  // desktop = has a real pointer; used to gate video tiles (off on mobile)
  var IS_DESKTOP = !!(window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine)").matches);

  // Preload hover-video clips a bit before they're on screen, so the clip
  // starts instantly on hover (no fetch-on-hover lag), while still not
  // downloading anything until you scroll near it.
  var videoPreloadObserver = ("IntersectionObserver" in window)
    ? new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          videoPreloadObserver.unobserve(e.target);
          var v = e.target.__video;
          if (v && v.preload !== "auto") { v.preload = "auto"; try { v.load(); } catch (_) {} }
        });
      }, { rootMargin: "400px 0px 400px 0px" })
    : null;
  function preloadVideoInView(video, cell) {
    if (!videoPreloadObserver) { video.preload = "metadata"; return; }
    cell.__video = video;
    videoPreloadObserver.observe(cell);
  }

  // ---------- Card reveal: blocks open top→bottom as they scroll in ----------
  var cardObserver = null;
  var cardsArmed = false;
  var cardQueue = [];
  var CARD_STAGGER = 0.09;   // seconds between cards that reveal in the same batch
  function revealCard(el, i) {
    var tile = el.querySelector(".item__tile");
    if (tile && i) {
      tile.style.transitionDelay = (i * CARD_STAGGER) + "s";
      // clear the delay once revealed so it doesn't slow the hover transition
      setTimeout(function () { tile.style.transitionDelay = ""; }, 1000 + i * CARD_STAGGER * 1000);
    }
    el.classList.add("card-in");
  }
  function armCards() {
    if (cardsArmed) return;
    cardsArmed = true;
    cardQueue.forEach(function (el, i) { revealCard(el, i); });
    cardQueue = [];
  }
  function setupCardReveal() {
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || !("IntersectionObserver" in window)) { cardsArmed = true; return; }
    list.classList.add("reveal-cards");   // enables the clipped initial state
    cardObserver = new IntersectionObserver(function (entries) {
      // reveal only when a block has risen into view; stagger a row so the
      // opening is visible instead of a whole row popping at once
      var batch = 0;
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        cardObserver.unobserve(e.target);
        if (cardsArmed) revealCard(e.target, batch++); else cardQueue.push(e.target);
      });
    }, { threshold: 0.2, rootMargin: "0px 0px -8% 0px" });
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  // ---------- Grid item builder: 16:9 tile + caption below ----------
  function buildItem(item) {
    var cell = document.createElement("div");
    cell.className = "item" + (item.type === "video" ? " is-video" : "");

    // the 16:9 tile (clickable, opens link in a new tab)
    var a = document.createElement("a");
    a.className = "item__tile";
    if (item.link) {                 // only clickable when a real link is given
      a.href = item.link;
      a.target = "_blank";
      a.rel = "noopener";
    }
    a.setAttribute("aria-label", item.title || "Работа");

    // 16:9 media wrapper (centered inside the card, with shadow)
    var media = document.createElement("div");
    media.className = "item__media";

    var img = document.createElement("img");
    img.className = "item__img";
    img.loading = "lazy";
    img.decoding = "async";
    // Retina: previews are 2x (1400×788) shown in a ≤700px slot, so they stay
    // crisp on high-DPI screens. Intrinsic size keeps the 16:9 box stable.
    img.width = 1400;
    img.height = 788;
    img.alt = item.title || "";
    img.src = item.preview || "";
    media.appendChild(img);

    // Video tiles (desktop only — on mobile/touch we never create the video,
    // the poster image stays). Two modes:
    //   default  — autoplays (muted loop), the clip replaces the image;
    //   hover:true — image by default, the clip plays on hover.
    if (item.type === "video" && item.video && IS_DESKTOP) {
      var hoverMode = item.autoplay !== true;   // hover-play is the default; opt in to autoplay
      cell.className += hoverMode ? " item--video-hover" : " item--video-autoplay";
      var video = document.createElement("video");
      video.className = "item__video";
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.setAttribute("muted", "");
      video.setAttribute("playsinline", "");
      video.setAttribute("loop", "");
      video.poster = item.preview || "";
      if (hoverMode) {
        video.preload = "none";               // buffered on approach (see below)
        video.src = item.video;
        media.appendChild(video);
        preloadVideoInView(video, cell);      // preload before hover → instant start
        a.addEventListener("mouseenter", function () {
          if (video.preload !== "auto") video.preload = "auto";
          var pr = video.play();
          if (pr && pr.catch) pr.catch(function () {});
        });
        a.addEventListener("mouseleave", function () {
          video.pause();
          try { video.currentTime = 0; } catch (e) {}
        });
      } else {
        video.autoplay = true;
        video.setAttribute("autoplay", "");
        video.preload = "auto";
        video.src = item.video;
        media.appendChild(video);
        var pr = video.play();
        if (pr && pr.catch) pr.catch(function () {});
      }
    }

    a.appendChild(media);

    // caption inside the card (bottom): title on the left, arrow on the right
    var caption =
      '<div class="item__caption">' +
      '<span class="item__title">' + esc(item.title || "") + "</span>" +
      '<span class="item__arrow" aria-hidden="true">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" ' +
      'stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M7 17 17 7"/><path d="M8.5 7H17v8.5"/></svg></span>' +
      "</div>";

    a.insertAdjacentHTML("beforeend", caption);
    cell.appendChild(a);
    return cell;
  }

  // current number of grid columns (3 desktop / 3 tablet / 2 mobile)
  function gridCols() {
    var t = getComputedStyle(list).gridTemplateColumns;
    var n = t ? t.split(" ").filter(Boolean).length : 1;
    return n > 0 ? n : 1;
  }

  // ---------- Rendering ----------
  function renderNext() {
    // load whole rows so the last row is always full — no empty cell before
    // the "Load more" button, whatever the column count
    var cols = gridCols();
    // mobile (2 cols): 16 per load (8 full rows); desktop/tablet: 6 full rows
    var step = (cols === 2) ? 16 : cols * ROWS_PER_LOAD;
    var end = Math.min(rendered + step, works.length);
    var frag = document.createDocumentFragment();
    var fresh = [];
    for (var i = rendered; i < end; i++) {
      var cell = buildItem(works[i]);
      fresh.push(cell);
      frag.appendChild(cell);
    }
    list.appendChild(frag);
    rendered = end;
    loadMoreBtn.hidden = rendered >= works.length;
    // watch the new cards so they open top→bottom when scrolled into view
    if (cardObserver) fresh.forEach(function (c) { cardObserver.observe(c); });
    if (refreshScrollbar) refreshScrollbar();
  }

  // ---------- Logo grid (cells rotate through the logo pool, clay.global style) ----------
  function buildLogoGrid() {
    var grid = document.getElementById("logosGrid");
    if (!grid) return;
    if (!LOGOS.length) { grid.parentNode.hidden = true; return; }

    var VISIBLE = 18;              // 6 columns × 3 rows (repeats fill in until all logos are added)
    var shown = [];               // logo index currently in each cell

    var html = "";
    for (var i = 0; i < VISIBLE; i++) {
      var idx = i % LOGOS.length;
      shown[i] = idx;
      html += '<div class="logos__cell"><img src="' + LOGOS[idx] + '" alt="" decoding="async"></div>';
    }
    grid.innerHTML = html;
    var imgs = grid.querySelectorAll(".logos__cell img");

    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (LOGOS.length < 2 || reduce) return;

    var uniquePossible = LOGOS.length > VISIBLE;   // enough logos to avoid on-screen repeats
    function swapOne() {
      var cell = Math.floor(Math.random() * VISIBLE);
      // pick a logo that isn't currently shown in ANY cell, so no duplicates on screen
      var next;
      do {
        next = Math.floor(Math.random() * LOGOS.length);
      } while (next === shown[cell] ||
               (uniquePossible && shown.indexOf(next) !== -1));
      var img = imgs[cell];
      var pre = new Image(); pre.src = LOGOS[next];   // preload to avoid a flash
      img.style.opacity = "0";                        // blur + fade out
      img.style.filter = "blur(14px)";
      setTimeout(function () {
        shown[cell] = next;
        img.src = LOGOS[next];
        img.style.opacity = "";                       // sharpen + fade back in
        img.style.filter = "";
      }, 300);
    }
    // show the reference order first, then start shuffling in the rest
    setTimeout(function () { setInterval(swapOne, 900); }, 3500);
  }

  // ---------- Custom cursor (desktop only) ----------
  function initCursor() {
    if (!window.matchMedia ||
        !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

    var root = document.documentElement;
    var ring = document.createElement("div");
    var dot = document.createElement("div");
    ring.className = "cursor-ring";
    dot.className = "cursor-dot";
    document.body.appendChild(ring);
    document.body.appendChild(dot);
    root.classList.add("cursor-on");

    var mx = window.innerWidth / 2, my = window.innerHeight / 2;
    var rx = mx, ry = my, shown = false;
    var hoverSel = "a, button, .item__tile, .load-more, .contacts__item, .footer__cta, .logos__cell";

    document.addEventListener("mousemove", function (e) {
      mx = e.clientX; my = e.clientY;
      dot.style.transform = "translate(" + mx + "px," + my + "px)";
      if (!shown) { shown = true; root.classList.add("cursor-ready"); }
    });
    // ring eases toward the pointer → it "rides" behind the cursor
    (function loop() {
      rx += (mx - rx) * 0.18;
      ry += (my - ry) * 0.18;
      ring.style.transform = "translate(" + rx + "px," + ry + "px)";
      requestAnimationFrame(loop);
    })();

    document.addEventListener("mouseover", function (e) {
      if (e.target.closest && e.target.closest(hoverSel)) root.classList.add("cursor-hover");
    });
    document.addEventListener("mouseout", function (e) {
      if (e.target.closest && e.target.closest(hoverSel)) root.classList.remove("cursor-hover");
    });
    root.addEventListener("mouseleave", function () { root.classList.remove("cursor-ready"); });
    root.addEventListener("mouseenter", function () { if (shown) root.classList.add("cursor-ready"); });
  }

  // ---------- Smooth scroll (desktop, non-touch) ----------
  function initSmoothScroll() {
    if (!window.matchMedia ||
        !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    var current = window.pageYOffset;
    var target = current;
    var running = false;
    var ease = 0.1;                 // lower = smoother / more inertia

    function maxScroll() {
      return Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    }
    function clamp(v) { return Math.max(0, Math.min(v, maxScroll())); }

    function raf() {
      current += (target - current) * ease;
      if (Math.abs(target - current) < 0.4) {
        current = target;
        window.scrollTo(0, current);
        running = false;
        return;
      }
      window.scrollTo(0, current);
      requestAnimationFrame(raf);
    }
    function start() { if (!running) { running = true; requestAnimationFrame(raf); } }

    window.addEventListener("wheel", function (e) {
      if (e.ctrlKey) return;        // leave pinch-zoom to the browser
      e.preventDefault();
      var unit = e.deltaMode === 1 ? 16 : (e.deltaMode === 2 ? window.innerHeight : 1);
      target = clamp(target + e.deltaY * unit);
      start();
    }, { passive: false });

    // keep in sync when the page is scrolled by other means (keyboard, scrollbar)
    window.addEventListener("scroll", function () {
      if (!running) { current = target = window.pageYOffset; }
    }, { passive: true });

    window.addEventListener("resize", function () {
      target = clamp(target); current = clamp(current);
    });
  }

  // ---------- Custom scrollbar (desktop, non-touch) ----------
  function initScrollbar() {
    if (!window.matchMedia ||
        !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

    document.documentElement.classList.add("scrollbar-on");
    var thumb = document.createElement("div");
    thumb.className = "scrollbar__thumb";
    document.body.appendChild(thumb);
    var MARGIN = 14;

    function update() {
      var docH = document.documentElement.scrollHeight;
      var winH = window.innerHeight;
      var maxS = docH - winH;
      if (maxS <= 2) { thumb.style.opacity = "0"; return; }
      thumb.style.opacity = "";
      var trackH = winH - MARGIN * 2;
      var thumbH = Math.max(32, (winH / docH) * trackH);
      var y = MARGIN + (window.pageYOffset / maxS) * (trackH - thumbH);
      thumb.style.height = thumbH + "px";
      thumb.style.transform = "translateY(" + y + "px)";
    }

    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    refreshScrollbar = update;   // called after "Load more" grows the page
    update();
  }

  // ---------- Boot ----------
  function hidePreloader() {
    if (!preloader || preloader.classList.contains("is-hidden")) return;
    preloader.classList.add("is-hidden");                 // panels split up + down
    setTimeout(function () { armReveal(); armCards(); }, 180);   // headings + cards animate in as the site appears
    setTimeout(function () { preloader.style.display = "none"; }, 1000);
  }

  // ---------- Scroll reveal (each line floats up from behind a clip) ----------
  var armReveal = function () {};   // replaced by initReveal(); called when preloader lifts
  function initReveal() {
    var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var els = [].slice.call(document.querySelectorAll("[data-reveal]"));
    if (!els.length || reduce) return;
    var STAGGER = 0.09;            // seconds between consecutive lines
    var armed = false, queued = [];

    function splitLines(el) {
      var text = el._revealText;
      // lay the words out to measure where the browser wraps them
      el.textContent = "";
      var words = text.split(/\s+/).filter(Boolean);
      var spans = words.map(function (w) {
        var s = document.createElement("span");
        s.style.display = "inline-block";
        s.textContent = w;
        return s;
      });
      spans.forEach(function (s, i) {
        el.appendChild(s);
        if (i < spans.length - 1) el.appendChild(document.createTextNode(" "));
      });
      var lines = [], cur = [], top = null;
      spans.forEach(function (s) {
        var t = s.offsetTop;
        if (top === null) top = t;
        if (t - top > 2) { lines.push(cur); cur = []; top = t; }
        cur.push(s.textContent);
      });
      if (cur.length) lines.push(cur);
      // rebuild as masked lines
      el.textContent = "";
      el._inners = [];
      lines.forEach(function (lineWords, i) {
        var line = document.createElement("span");
        line.className = "reveal-line";
        var inner = document.createElement("span");
        inner.className = "reveal-line__inner";
        inner.style.transitionDelay = (i * STAGGER) + "s";
        inner.textContent = lineWords.join(" ");
        line.appendChild(inner);
        el.appendChild(line);
        el._inners.push(inner);
      });
    }

    function fire(el) { el.classList.add("is-in"); el._revealed = true; }

    // On mobile the per-line mask is fragile (line measurement can freeze at the
    // wrong width and mangle wrapping), so reveal the whole block instead —
    // the text then wraps natively and always correctly.
    var lineMode = !(window.matchMedia && window.matchMedia("(max-width: 640px)").matches);

    // The dark-footer statement lives in a fixed element, so a viewport
    // IntersectionObserver would treat it as visible from the start (it's just
    // covered by the white page). Drive it from scroll instead: fire once the
    // white page has scrolled up far enough to uncover it.
    function watchFooterReveal(el) {
      var page = document.querySelector(".page");
      if (!page) { queued.push(el); return; }
      function doReveal() {
        // Re-measure lines now that the footer is at its final width (the boot-time
        // split can happen before fonts/layout settle and wrap too narrow).
        if (lineMode && el._inners) splitLines(el);
        if (armed) fire(el); else queued.push(el);
      }
      function check() {
        var pageBottom = page.getBoundingClientRect().bottom;
        var r = el.getBoundingClientRect();
        if (pageBottom <= r.top + r.height * 0.5) {   // ~half of the statement uncovered
          window.removeEventListener("scroll", check);
          doReveal();
        }
      }
      window.addEventListener("scroll", check, { passive: true });
      check();
    }

    els.forEach(function (el) {
      el._revealText = el.textContent.trim();
      if (lineMode) splitLines(el);
      else el.classList.add("reveal-simple");
      if (el.closest && el.closest(".site-footer")) { watchFooterReveal(el); return; }
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          io.unobserve(el);
          if (armed) fire(el); else queued.push(el);   // hold above-the-fold until preloader lifts
        });
      }, { threshold: 0.2, rootMargin: "0px 0px -8% 0px" });
      io.observe(el);
    });

    armReveal = function () {
      if (armed) return;
      armed = true;
      queued.forEach(fire);
      queued = [];
    };

    // re-measure lines on resize; keep already-revealed text visible without re-animating
    var t;
    window.addEventListener("resize", function () {
      if (!lineMode) return;   // whole-block reveal needs no re-measuring
      clearTimeout(t);
      t = setTimeout(function () {
        els.forEach(function (el) {
          if (!el._inners) return;
          var wasRevealed = el._revealed;
          splitLines(el);
          if (wasRevealed) {
            el.classList.add("is-in");
            el._inners.forEach(function (inner) {
              inner.classList.add("reveal-line--noanim");
            });
            void el.offsetWidth;
            el._inners.forEach(function (inner) {
              inner.classList.remove("reveal-line--noanim");
            });
          }
        });
      }, 200);
    });
  }

  // Reveal footer: the dark footer is fixed at the bottom; reserve scroll space
  // (page margin-bottom = footer height) so the white page scrolls up and
  // uncovers it — the page "pages over" to black.
  function initRevealFooter() {
    var page = document.querySelector(".page");
    var footer = document.querySelector(".site-footer");
    if (!page || !footer) return;
    function sync() {
      page.style.marginBottom = footer.offsetHeight + "px";
      if (refreshScrollbar) refreshScrollbar();
    }
    sync();
    window.addEventListener("resize", sync);
    window.addEventListener("load", sync);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(sync);
    setTimeout(sync, 1200);   // re-sync once layout/fonts settle
  }

  // Magnetic social circles (desktop): the button springs toward the cursor and
  // elastically settles back — mirrors the GreenSock demo behaviour.
  function initMagnetic() {
    if (!IS_DESKTOP) return;
    var els = [].slice.call(document.querySelectorAll(".social"));
    els.forEach(function (el) {
      var icon = el.querySelector(".social__icon");
      var PULL = 0.35, ICON_PULL = 0.18;
      el.addEventListener("mousemove", function (e) {
        var r = el.getBoundingClientRect();
        var mx = e.clientX - (r.left + r.width / 2);
        var my = e.clientY - (r.top + r.height / 2);
        el.style.transition = "transform .18s ease-out, background .3s ease";
        el.style.transform = "translate(" + (mx * PULL) + "px," + (my * PULL) + "px)";
        if (icon) {
          icon.style.transition = "transform .18s ease-out";
          icon.style.transform = "translate(" + (mx * ICON_PULL) + "px," + (my * ICON_PULL) + "px)";
        }
      });
      el.addEventListener("mouseleave", function () {
        el.style.transition = "";   // fall back to the springy CSS curve for the return
        el.style.transform = "";
        if (icon) { icon.style.transition = ""; icon.style.transform = ""; }
      });
    });
  }

  // Electric-discharge outline: while a social circle is hovered, jitter the
  // shared feTurbulence so the stroked ring crackles like an electric arc.
  function initElectric() {
    if (!IS_DESKTOP) return;
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    var turb = document.querySelector("#electricFx feTurbulence");
    if (!turb) return;
    var hovering = 0, raf = null, t = 0;
    function frame() {
      t += 1;
      turb.setAttribute("seed", (t * 4) % 120);
      turb.setAttribute("baseFrequency", (0.05 + Math.sin(t * 0.35) * 0.022).toFixed(4));
      if (hovering > 0) raf = requestAnimationFrame(frame);
      else raf = null;
    }
    [].forEach.call(document.querySelectorAll(".social"), function (el) {
      el.addEventListener("mouseenter", function () { hovering++; if (!raf) raf = requestAnimationFrame(frame); });
      el.addEventListener("mouseleave", function () { hovering = Math.max(0, hovering - 1); });
    });
  }

  function init(data) {
    works = Array.isArray(data) ? data : [];
    setupCardReveal();
    renderNext();
    buildLogoGrid();
    loadMoreBtn.addEventListener("click", renderNext);
    var yearEl = document.getElementById("year");
    if (yearEl) yearEl.textContent = new Date().getFullYear();
    initReveal();
    initRevealFooter();
    initMagnetic();
    initElectric();
  }

  initCursor();
  initSmoothScroll();
  initScrollbar();

  // reveal once the progress line has run AND the page has loaded
  (function preloaderReveal() {
    var fill = document.getElementById("preloaderFill");
    var loaded = document.readyState === "complete";
    var lineDone = false, done = false;
    function go() { if (loaded && lineDone && !done) { done = true; hidePreloader(); } }
    if (fill) {
      fill.addEventListener("animationend", function () { lineDone = true; go(); });
      setTimeout(function () { lineDone = true; go(); }, 1800);   // fallback
    } else {
      lineDone = true;
    }
    window.addEventListener("load", function () { loaded = true; go(); });
    go();
  })();

  // Works come from window.__WORKS__ (single-file build) or data/works.json.
  if (window.__WORKS__) {
    init(window.__WORKS__);
  } else {
    fetch("data/works.json", { cache: "no-cache" })
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(init)
      .catch(function (err) {
        console.error("Не удалось загрузить works.json:", err);
        list.innerHTML =
          '<p style="color:#8b8b82">Не удалось загрузить работы. ' +
          "Запустите сайт через локальный сервер (fetch не работает с file://).</p>";
        hidePreloader();
      });
  }
})();

