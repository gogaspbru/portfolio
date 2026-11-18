/**
 * «Матрица точек» на первом экране (вариант вместо видео, index-matrix.html).
 * Перенос сцены из trinity-matrix-kit (matrix.js на three.js) на чистый WebGL —
 * без библиотек и ES-модулей, чтобы страница работала двойным кликом (file://).
 *
 * Сцена: наклонная сетка точек, по ней бегут волны и рябь от курсора.
 * Точки внутри знака (контур из data-mark) при прокрутке «вырастают» в объём
 * и знак встаёт лицом к зрителю.
 *
 * Разметка: <canvas class="hero__matrix" data-mark="<d из SVG>" data-mark-box="21 14" data-bg="#3268F2">
 * Прогресс прокрутки считается по контейнеру [data-matrix-track] (первый экран «залипает» внутри него).
 * Нет WebGL — канвас скрывается, остаётся CSS-фон.
 */
(function (Trinity) {
  'use strict';

  // ---------- параметры (из matrix.js) ----------
  const STEP = 0.42;                          // шаг сетки, мировые единицы
  const LAYERS = 7;                           // слоёв «объёма» у знака
  const GRID_X = [-90, 90];
  const GRID_Y = [-34, 95];
  const MARK = { cx: 9.0, cy: 3.2, w: 17 };   // положение и ширина знака на сетке
  const FOV = 32;                             // вертикальный угол обзора камеры, °
  const CAM_Z = 50, CAM_Z_NARROW = 70;        // дистанция камеры (узкий экран — дальше)
  const SCROLL_EASE = 0.08;
  const COLOR = [1, 1, 1];                    // цвет точек

  const VERT = `
    precision highp float;
    attribute vec2 base; attribute float mask; attribute float layer;
    uniform mat4 uMV, uP;
    uniform float uT, uK, uPR, uMA, uRX, uRZ; uniform vec2 uMouse, uC;
    varying float vA;
    void main(){
      float dm = distance(base, uMouse);
      float ripple = uMA * sin(dm * 1.6 - uT * 5.0) * exp(-dm * 0.22) * 0.9;
      float idle = sin(base.x * 0.35 + uT * 0.8) * cos(base.y * 0.3 - uT * 0.6) * 0.25;
      float h = mask * uK * 5.0 * layer;
      float dc = distance(base, uC);
      float pulse = 0.75 + 0.25 * sin(uT * 2.4 - dc * 0.9);
      vec3 p = vec3(base, h + (ripple + idle) * (1.0 - mask));
      if (mask > 0.5) {
        vec3 q = p - vec3(uC, 0.0);
        float cx = cos(uRX), sx = sin(uRX);
        q = vec3(q.x, q.y * cx - q.z * sx, q.y * sx + q.z * cx);
        float cz = cos(uRZ), sz = sin(uRZ);
        q = vec3(q.x * cz - q.y * sz, q.x * sz + q.y * cz, q.z);
        p = q + vec3(uC, 0.0) + vec3(0.0, 0.0, uK * 4.0);
      }
      vec4 mv = uMV * vec4(p, 1.0);
      float top = step(0.999, layer);
      float grid = (0.5 + 0.5 * max(0.0, ripple) + 0.1 * idle) * 0.4;
      float m = mask * (0.34 + uK * (layer < 0.001 ? 0.6 : (0.32 + 0.6 * top)) * pulse);
      vA = mask > 0.5 ? m * (layer > 0.001 ? uK : 1.0) : grid;
      float sz = mask > 0.5 ? (layer > 0.001 ? 1.0 + top * 0.6 : 1.25) : 0.95 + max(0.0, ripple) * 0.8;
      gl_PointSize = sz * uPR * (210.0 / -mv.z);
      gl_Position = uP * mv;
    }`;

  const FRAG = `
    precision mediump float;
    uniform vec3 uColor; varying float vA;
    void main(){
      float d = length(gl_PointCoord - 0.5);
      float a = smoothstep(0.5, 0.15, d);
      gl_FragColor = vec4(uColor, a * vA);
    }`;

  // ---------- матрицы (column-major, как в WebGL) ----------
  function perspective(fovDeg, aspect, near, far) {
    const f = 1 / Math.tan((fovDeg * Math.PI) / 360);
    const nf = 1 / (near - far);
    return new Float32Array([
      f / aspect, 0, 0, 0,
      0, f, 0, 0,
      0, 0, (far + near) * nf, -1,
      0, 0, 2 * far * near * nf, 0,
    ]);
  }

  // R = Rx(a) · Rz(c) (порядок Эйлера XYZ при y = 0, как grid.rotation в three.js); 3×3, по строкам
  function rotXZ(a, c) {
    const ca = Math.cos(a), sa = Math.sin(a), cc = Math.cos(c), sc = Math.sin(c);
    return [
      cc, -sc, 0,
      ca * sc, ca * cc, -sa,
      sa * sc, sa * cc, ca,
    ];
  }

  // modelView = T(0,0,-camZ) · T(pos) · R
  function modelView(R, pos, camZ) {
    return new Float32Array([
      R[0], R[3], R[6], 0,
      R[1], R[4], R[7], 0,
      R[2], R[5], R[8], 0,
      pos[0], pos[1], pos[2] - camZ, 1,
    ]);
  }

  // ---------- маска знака ----------
  function buildMask(d, box) {
    const [mw, mh] = box;
    const S = 20;
    const c = document.createElement('canvas');
    c.width = Math.ceil(mw * S);
    c.height = Math.ceil(mh * S);
    const ctx = c.getContext('2d');
    ctx.scale(S, S);
    ctx.fillStyle = '#fff';
    try { ctx.fill(new Path2D(d)); } catch (e) { return () => false; }
    const data = ctx.getImageData(0, 0, c.width, c.height).data;
    const s = MARK.w / mw;
    return (x, y) => {
      const u = (x - MARK.cx) / s + mw / 2;
      const v = mh / 2 - (y - MARK.cy) / s;
      if (u < 0 || v < 0 || u >= mw || v >= mh) return false;
      return data[(((v * S) | 0) * c.width + ((u * S) | 0)) * 4 + 3] > 128;
    };
  }

  function buildPoints(inMark) {
    const base = [], mask = [], layer = [];
    for (let y = GRID_Y[0]; y <= GRID_Y[1]; y += STEP) {
      for (let x = GRID_X[0]; x <= GRID_X[1]; x += STEP) {
        base.push(x, y); mask.push(0); layer.push(0);
        if (inMark(x, y)) {
          for (let l = 0; l <= LAYERS; l++) { base.push(x, y); mask.push(1); layer.push(l / LAYERS); }
        }
      }
    }
    return { base: new Float32Array(base), mask: new Float32Array(mask), layer: new Float32Array(layer), count: mask.length };
  }

  function hexToRgb(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return [0.196, 0.408, 0.949];
    const n = parseInt(m[1], 16);
    return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
  }

  function compile(gl, type, src) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
    return sh;
  }

  function initHeroMatrix(canvas) {
    if (!canvas) return;

    const gl = canvas.getContext('webgl', { antialias: true, alpha: false, premultipliedAlpha: false })
      || canvas.getContext('experimental-webgl');
    if (!gl) { canvas.hidden = true; return; }

    let prog;
    try {
      prog = gl.createProgram();
      gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
      gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    } catch (err) {
      console.warn('hero-matrix:', err);
      canvas.hidden = true;
      return;
    }
    gl.useProgram(prog);

    // точки
    const box = (canvas.dataset.markBox || '21 14').split(/\s+/).map(Number);
    const inMark = canvas.dataset.mark ? buildMask(canvas.dataset.mark, box) : () => false;
    const pts = buildPoints(inMark);
    const attr = (name, data, size) => {
      const loc = gl.getAttribLocation(prog, name);
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
    };
    attr('base', pts.base, 2);
    attr('mask', pts.mask, 1);
    attr('layer', pts.layer, 1);

    const U = {};
    ['uMV', 'uP', 'uT', 'uK', 'uPR', 'uMA', 'uRX', 'uRZ', 'uMouse', 'uC', 'uColor']
      .forEach((n) => { U[n] = gl.getUniformLocation(prog, n); });
    gl.uniform2f(U.uC, MARK.cx, MARK.cy);
    gl.uniform3fv(U.uColor, COLOR);
    gl.uniform2f(U.uMouse, 999, 999);

    // аддитивное смешивание, альфа канваса остаётся 1
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE, gl.ZERO, gl.ONE);
    const bg = hexToRgb(canvas.dataset.bg);
    gl.clearColor(bg[0], bg[1], bg[2], 1);

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const track = canvas.closest('[data-matrix-track]') || canvas.parentElement;
    const sticky = canvas.closest('.hero') || canvas.parentElement;

    // ---------- состояние ----------
    const pr = Math.min(window.devicePixelRatio || 1, 2);
    gl.uniform1f(U.uPR, pr);
    let aspect = 1, camZ = CAM_Z, narrow = false;
    let target = 0, progress = 0, visible = true;
    let mA = 0, mAT = 0, px = 0, py = 0, sx = 0, sy = 0;
    let rotX = 0, rotZ = 0, pos = [0, -1, 0];

    const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
    const easeIO = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

    function readScroll() {
      const r = track.getBoundingClientRect();
      const extra = r.height - sticky.offsetHeight; // сколько прокручиваем, пока экран «залип»
      const range = extra > 40 ? extra : sticky.offsetHeight;
      target = clamp(-r.top / Math.max(1, range));
    }

    function resize() {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (!w || !h) return;
      canvas.width = Math.round(w * pr);
      canvas.height = Math.round(h * pr);
      gl.viewport(0, 0, canvas.width, canvas.height);
      aspect = w / h;
      narrow = aspect < 1.1;
      camZ = narrow ? CAM_Z_NARROW : CAM_Z;
      gl.uniformMatrix4fv(U.uP, false, perspective(FOV, aspect, 0.1, 600));
    }

    // курсор → точка на плоскости сетки (локальные координаты)
    function onPointer(e) {
      if (reduce) return;
      const r = canvas.getBoundingClientRect();
      if (e.clientY < r.top || e.clientY > r.bottom) return;
      const nx = ((e.clientX - r.left) / r.width) * 2 - 1;
      const ny = -((e.clientY - r.top) / r.height) * 2 + 1;
      px = nx; py = ny;
      const t = Math.tan((FOV * Math.PI) / 360);
      const R = rotXZ(rotX, rotZ);
      // начало и направление луча в мировых координатах → в локальные: Rᵀ(v − pos)
      const o = [0 - pos[0], 0 - pos[1], camZ - pos[2]];
      const d = [nx * t * aspect, ny * t, -1];
      const loc = (v) => [
        R[0] * v[0] + R[3] * v[1] + R[6] * v[2],
        R[1] * v[0] + R[4] * v[1] + R[7] * v[2],
        R[2] * v[0] + R[5] * v[1] + R[8] * v[2],
      ];
      const lo = loc(o), ld = loc(d);
      if (Math.abs(ld[2]) < 1e-6) return;
      const k = -lo[2] / ld[2];
      if (k <= 0) return;
      gl.uniform2f(U.uMouse, lo[0] + ld[0] * k, lo[1] + ld[1] * k);
      mAT = 1;
    }

    window.addEventListener('scroll', readScroll, { passive: true });
    window.addEventListener('resize', () => { resize(); readScroll(); });
    window.addEventListener('pointermove', onPointer, { passive: true });
    document.documentElement.addEventListener('pointerleave', () => { mAT = 0; });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver((es) => { visible = es[0].isIntersecting; }).observe(canvas);
    }
    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); canvas.hidden = true; });

    resize();
    readScroll();

    const t0 = performance.now();
    function frame(now) {
      requestAnimationFrame(frame);
      if (!visible || canvas.hidden) return;
      const t = (now - t0) / 1000;
      progress = reduce ? target : progress + (target - progress) * SCROLL_EASE;
      const k = reduce ? 1 : easeIO(progress);
      mAT *= 0.985; mA += (mAT - mA) * 0.08;
      sx += (px - sx) * 0.04; sy += (py - sy) * 0.04;

      // сетка лежит под наклоном; при прокрутке камера чуть поднимается над знаком
      rotX = -0.95 + 0.25 * k + sy * 0.05;
      rotZ = -0.18 + 0.08 * k + sx * 0.04;
      pos = narrow ? [-8, 4, 0] : [0, -1, 0];

      gl.uniform1f(U.uT, reduce ? 0 : t);
      gl.uniform1f(U.uK, k);
      gl.uniform1f(U.uMA, mA);
      // знак «встаёт»: компенсируем наклон сетки, к концу прокрутки он стоит ровно к зрителю
      gl.uniform1f(U.uRX, -(rotX - sy * 0.05) * k);
      gl.uniform1f(U.uRZ, -(rotZ - sx * 0.04) * k);
      gl.uniformMatrix4fv(U.uMV, false, modelView(rotXZ(rotX, rotZ), pos, camZ));

      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.POINTS, 0, pts.count);
    }
    requestAnimationFrame(frame);
  }

  Trinity.initHeroMatrix = initHeroMatrix;
})(window.Trinity = window.Trinity || {});
