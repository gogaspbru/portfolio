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

  var PAGE_SIZE = 12;

  // Marquee logos. Add/remove files in assets/logos/ and list them here.
  // (window.__LOGOS__ lets the single-file build inline them as data URIs.)
  var LOGOS = window.__LOGOS__ || [
    "assets/logos/logo-01.svg", "assets/logos/logo-02.svg", "assets/logos/logo-03.svg",
    "assets/logos/logo-04.svg", "assets/logos/logo-05.svg", "assets/logos/logo-06.svg",
    "assets/logos/logo-07.svg", "assets/logos/logo-08.svg", "assets/logos/logo-09.svg",
    "assets/logos/logo-10.svg", "assets/logos/logo-11.svg", "assets/logos/logo-12.svg",
    "assets/logos/logo-13.svg", "assets/logos/logo-14.svg", "assets/logos/logo-15.svg",
    "assets/logos/logo-16.svg", "assets/logos/logo-17.svg", "assets/logos/logo-18.svg"
  ];

  var list = document.getElementById("grid");
  var loadMoreBtn = document.getElementById("loadMore");
  var preloader = document.getElementById("preloader");

  var works = [];
  var rendered = 0;
  var refreshScrollbar = null;   // set by initScrollbar()

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
    a.href = item.link || "#";
    a.target = "_blank";
    a.rel = "noopener";
    a.setAttribute("aria-label", item.title || "Работа");

    // 16:9 media wrapper (centered inside the card, with shadow)
    var media = document.createElement("div");
    media.className = "item__media";

    var img = document.createElement("img");
    img.className = "item__img";
    img.loading = "lazy";
    img.decoding = "async";
    img.alt = item.title || "";
    img.src = item.preview || "";
    media.appendChild(img);

    if (item.type === "video") {
      if (item.video) {
        var video = document.createElement("video");
        video.className = "item__video";
        video.muted = true;
        video.loop = true;
        video.playsInline = true;
        video.setAttribute("playsinline", "");
        video.preload = "none";
        video.poster = item.preview || "";
        video.src = item.video;
        media.appendChild(video);

        a.addEventListener("mouseenter", function () {
          if (video.preload === "none") video.preload = "auto";
          var p = video.play();
          if (p && p.catch) p.catch(function () {});
        });
        a.addEventListener("mouseleave", function () {
          video.pause();
          video.currentTime = 0;
        });
      }
    }

    a.appendChild(media);

    // caption inside the card (bottom): title on the left, arrow on the right
    var caption =
      '<div class="item__caption">' +
      '<span class="item__title">' + esc(item.title || "") + "</span>" +
      '<span class="item__arrow" aria-hidden="true">' +
      '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.4">' +
      '<path d="M6 14 14 6"/><path d="M8 6H14V12"/></svg></span>' +
      "</div>";

    a.insertAdjacentHTML("beforeend", caption);
    cell.appendChild(a);
    return cell;
  }

  // ---------- Rendering ----------
  function renderNext() {
    var end = Math.min(rendered + PAGE_SIZE, works.length);
    var frag = document.createDocumentFragment();
    for (var i = rendered; i < end; i++) {
      frag.appendChild(buildItem(works[i]));
    }
    list.appendChild(frag);
    rendered = end;
    loadMoreBtn.hidden = rendered >= works.length;
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

    function swapOne() {
      var cell = Math.floor(Math.random() * VISIBLE);
      var next = shown[cell];
      while (next === shown[cell]) next = Math.floor(Math.random() * LOGOS.length);
      var img = imgs[cell];
      var pre = new Image(); pre.src = LOGOS[next];   // preload to avoid a flash
      img.style.opacity = "0";                        // blur + fade out
      img.style.filter = "blur(14px)";
      setTimeout(function () {
        shown[cell] = next;
        img.src = LOGOS[next];
        img.style.opacity = "";                       // sharpen + fade back in
        img.style.filter = "";
      }, 550);
    }
    setInterval(swapOne, 1900);
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
    setTimeout(function () { preloader.style.display = "none"; }, 1000);
  }

  function init(data) {
    works = Array.isArray(data) ? data : [];
    renderNext();
    buildLogoGrid();
    loadMoreBtn.addEventListener("click", renderNext);
    var yearEl = document.getElementById("year");
    if (yearEl) yearEl.textContent = new Date().getFullYear();
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

