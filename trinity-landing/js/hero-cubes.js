/**
 * «Волна из кубиков» на первом экране (светлый вариант, index-cubes.html).
 * По мотивам демо «wavy cubes»: сетка светлых кубиков почти анфас, по ней идёт
 * медленная волна, за курсором тянется синий шлейф — кубики выдвигаются вперёд
 * и плавно гаснут. Чистый WebGL (без three.js и модулей) — работает с file://.
 *
 * Без мыши (телефон, планшет, курсор вне экрана) шлейф рисует «призрачный курсор»,
 * который медленно гуляет по экрану, — эффект виден и без взаимодействия.
 *
 * Разметка: <canvas class="hero__cubes" data-bg="#EEF0F4" data-accent="#3268F2">
 * Нет WebGL — канвас скрывается, остаётся CSS-фон.
 */
(function (Trinity) {
  'use strict';

  // ---------- параметры ----------
  const CUBE_PX = 74;          // размер кубика на экране (десктоп), px
  const CUBE_PX_MOBILE = 52;   // на узких экранах
  const GAP = 0.035;           // зазор между кубиками (доля размера)
  const DEPTH = 1.2;           // глубина кубика
  const FOV = 28;              // вертикальный угол камеры, ° (меньше — «площе»)
  const WAVE = 0.38;           // амплитуда волны (в размерах кубика)
  const PUSH = 0.9;            // насколько выдвигается «подсвеченный» кубик
  const RADIUS = 2.1;          // радиус кисти курсора (в кубиках)
  const FADE = 1.4;            // время затухания шлейфа, с (примерно)
  const GHOST_AFTER = 2.5;     // через сколько секунд без мыши включается «призрак»
  const BASE = [0.955, 0.96, 0.972];  // цвет граней кубика

  const VERT = `
    precision highp float;
    attribute vec3 aPos; attribute vec3 aNorm; attribute vec2 aUv;
    attribute vec2 aOffset; attribute float aHeat;
    uniform mat4 uP; uniform float uCamZ, uT, uWave, uPush, uSize, uDepth;
    varying vec3 vN; varying vec2 vUv; varying float vHeat, vZ, vFront;
    void main(){
      vec2 o = aOffset;
      float w = sin(o.x * 0.33 + uT * 0.55) * sin(o.y * 0.42 - uT * 0.45)
              + 0.55 * sin((o.x + o.y) * 0.18 + uT * 0.35);
      float z = w * uWave + aHeat * uPush;
      vec3 p = vec3(aPos.xy * uSize + o, (aPos.z - 0.5) * uDepth + z);
      vN = aNorm; vUv = aUv; vHeat = aHeat; vZ = z; vFront = step(0.5, aNorm.z);
      gl_Position = uP * vec4(p.x, p.y, p.z - uCamZ, 1.0);
    }`;

  const FRAG = `
    precision mediump float;
    uniform vec3 uBase, uAccent, uBg;
    varying vec3 vN; varying vec2 vUv; varying float vHeat, vZ, vFront;
    void main(){
      vec3 L = normalize(vec3(-0.45, 0.65, 0.85));
      float dif = max(dot(normalize(vN), L), 0.0);
      float shade = 0.74 + 0.26 * dif;
      // лицевая грань: лёгкая фаска по краям
      float e = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y));
      shade *= mix(1.0, mix(0.94, 1.0, smoothstep(0.0, 0.07, e)), vFront);
      // боковые грани к основанию темнеют (ambient occlusion «на глаз»)
      shade *= mix(mix(0.82, 1.0, vUv.y), 1.0, vFront);
      vec3 col = mix(uBase, uAccent, clamp(vHeat, 0.0, 1.0) * 0.88) * shade;
      // утопленные кубики чуть тонут в фоне
      col = mix(uBg, col, clamp(0.78 + vZ * 0.35, 0.0, 1.0));
      gl_FragColor = vec4(col, 1.0);
    }`;

  // куб без задней грани: позиция (0..1 по z), нормаль, uv грани
  function cubeGeometry() {
    const v = [];
    const quad = (a, b, c, d, n) => {
      const uv = [[0, 0], [1, 0], [1, 1], [0, 1]];
      [[a, 0], [b, 1], [c, 2], [a, 0], [c, 2], [d, 3]].forEach(([p, i]) => v.push(...p, ...n, ...uv[i]));
    };
    const h = 0.5;
    quad([-h, -h, 1], [h, -h, 1], [h, h, 1], [-h, h, 1], [0, 0, 1]);    // перед
    quad([-h, h, 0], [h, h, 0], [h, h, 1], [-h, h, 1], [0, 1, 0]);      // верх (uv.y: 0 у основания)
    quad([h, -h, 0], [-h, -h, 0], [-h, -h, 1], [h, -h, 1], [0, -1, 0]); // низ
    quad([h, h, 0], [h, -h, 0], [h, -h, 1], [h, h, 1], [1, 0, 0]);      // право
    quad([-h, -h, 0], [-h, h, 0], [-h, h, 1], [-h, -h, 1], [-1, 0, 0]); // лево
    return new Float32Array(v);
  }

  function perspective(fovDeg, aspect, near, far) {
    const f = 1 / Math.tan((fovDeg * Math.PI) / 360);
    const nf = 1 / (near - far);
    return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0]);
  }

  function hexToRgb(hex, fallback) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return fallback;
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

  function initHeroCubes(canvas) {
    if (!canvas) return;
    const gl = canvas.getContext('webgl', { antialias: true, alpha: false });
    const inst = gl && gl.getExtension('ANGLE_instanced_arrays');
    if (!gl || !inst) { canvas.hidden = true; return; }

    let prog;
    try {
      prog = gl.createProgram();
      gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
      gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    } catch (err) {
      console.warn('hero-cubes:', err);
      canvas.hidden = true;
      return;
    }
    gl.useProgram(prog);

    const A = {};
    ['aPos', 'aNorm', 'aUv', 'aOffset', 'aHeat'].forEach((n) => { A[n] = gl.getAttribLocation(prog, n); });
    const U = {};
    ['uP', 'uCamZ', 'uT', 'uWave', 'uPush', 'uSize', 'uDepth', 'uBase', 'uAccent', 'uBg']
      .forEach((n) => { U[n] = gl.getUniformLocation(prog, n); });

    // геометрия куба
    const geo = cubeGeometry();
    const geoBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, geoBuf);
    gl.bufferData(gl.ARRAY_BUFFER, geo, gl.STATIC_DRAW);
    const STRIDE = 8 * 4;
    gl.enableVertexAttribArray(A.aPos);  gl.vertexAttribPointer(A.aPos, 3, gl.FLOAT, false, STRIDE, 0);
    gl.enableVertexAttribArray(A.aNorm); gl.vertexAttribPointer(A.aNorm, 3, gl.FLOAT, false, STRIDE, 12);
    gl.enableVertexAttribArray(A.aUv);   gl.vertexAttribPointer(A.aUv, 2, gl.FLOAT, false, STRIDE, 24);
    const VERTS = geo.length / 8;

    const offBuf = gl.createBuffer();
    const heatBuf = gl.createBuffer();

    const bg = hexToRgb(canvas.dataset.bg, [0.933, 0.941, 0.957]);
    const accent = hexToRgb(canvas.dataset.accent, [0.196, 0.408, 0.949]);
    gl.uniform3fv(U.uBase, BASE);
    gl.uniform3fv(U.uAccent, accent);
    gl.uniform3fv(U.uBg, bg);
    gl.uniform1f(U.uWave, WAVE);
    gl.uniform1f(U.uPush, PUSH);
    gl.uniform1f(U.uSize, 1 - GAP);
    gl.uniform1f(U.uDepth, DEPTH);
    gl.clearColor(bg[0], bg[1], bg[2], 1);
    gl.enable(gl.DEPTH_TEST);

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const pr = Math.min(window.devicePixelRatio || 1, 2);

    // ---------- сетка ----------
    let cols = 0, rows = 0, count = 0, halfW = 0, halfH = 0;
    let offsets, heat, shown;

    function build() {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (!w || !h) return false;
      canvas.width = Math.round(w * pr);
      canvas.height = Math.round(h * pr);
      gl.viewport(0, 0, canvas.width, canvas.height);

      const cube = w < 768 ? CUBE_PX_MOBILE : CUBE_PX;
      halfW = w / cube / 2;
      halfH = h / cube / 2;
      const camZ = halfH / Math.tan((FOV * Math.PI) / 360);
      gl.uniform1f(U.uCamZ, camZ);
      gl.uniformMatrix4fv(U.uP, false, perspective(FOV, w / h, 0.1, camZ * 3));

      // запас по краям, чтобы при перспективе не было пустот
      cols = Math.ceil(halfW * 2 * 1.15) + 2;
      rows = Math.ceil(halfH * 2 * 1.15) + 2;
      count = cols * rows;
      offsets = new Float32Array(count * 2);
      heat = new Float32Array(count);
      shown = new Float32Array(count);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const i = r * cols + c;
          offsets[i * 2] = c - (cols - 1) / 2;
          offsets[i * 2 + 1] = r - (rows - 1) / 2;
        }
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, offBuf);
      gl.bufferData(gl.ARRAY_BUFFER, offsets, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(A.aOffset);
      gl.vertexAttribPointer(A.aOffset, 2, gl.FLOAT, false, 0, 0);
      inst.vertexAttribDivisorANGLE(A.aOffset, 1);

      gl.bindBuffer(gl.ARRAY_BUFFER, heatBuf);
      gl.bufferData(gl.ARRAY_BUFFER, shown, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(A.aHeat);
      gl.vertexAttribPointer(A.aHeat, 1, gl.FLOAT, false, 0, 0);
      inst.vertexAttribDivisorANGLE(A.aHeat, 1);
      return true;
    }

    // ---------- курсор ----------
    let mx = 0, my = 0, pmx = 0, pmy = 0, lastMouse = -1e9, inside = false;
    function onPointer(e) {
      if (e.pointerType && e.pointerType !== 'mouse') return; // на тач-экранах — «призрак»
      const r = canvas.getBoundingClientRect();
      inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      if (!inside) return;
      mx = ((e.clientX - r.left) / r.width * 2 - 1) * halfW;
      my = -((e.clientY - r.top) / r.height * 2 - 1) * halfH;
      lastMouse = performance.now();
    }
    window.addEventListener('pointermove', onPointer, { passive: true });
    document.documentElement.addEventListener('pointerleave', () => { inside = false; });

    let visible = true;
    if ('IntersectionObserver' in window) {
      new IntersectionObserver((es) => { visible = es[0].isIntersecting; }).observe(canvas);
    }
    window.addEventListener('resize', build);
    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); canvas.hidden = true; });
    if (!build()) return;

    // кисть: добавляем «тепло» кубикам вокруг точки, сильнее при быстром движении
    function paint(x, y, strength) {
      const c0 = Math.max(0, Math.floor(x + (cols - 1) / 2 - RADIUS));
      const c1 = Math.min(cols - 1, Math.ceil(x + (cols - 1) / 2 + RADIUS));
      const r0 = Math.max(0, Math.floor(y + (rows - 1) / 2 - RADIUS));
      const r1 = Math.min(rows - 1, Math.ceil(y + (rows - 1) / 2 + RADIUS));
      for (let r = r0; r <= r1; r++) {
        for (let c = c0; c <= c1; c++) {
          const i = r * cols + c;
          const d = Math.hypot(offsets[i * 2] - x, offsets[i * 2 + 1] - y) / RADIUS;
          if (d < 1) heat[i] = Math.min(1, heat[i] + (1 - d) * (1 - d) * strength);
        }
      }
    }

    const t0 = performance.now();
    let prev = t0;
    function frame(now) {
      if (!reduce) requestAnimationFrame(frame);
      if (!visible || canvas.hidden) { prev = now; return; }
      const dt = Math.min(0.05, (now - prev) / 1000);
      prev = now;
      const t = (now - t0) / 1000;

      if (!reduce) {
        // источник шлейфа: мышь или «призрак» (фигура Лиссажу)
        const useMouse = inside && now - lastMouse < GHOST_AFTER * 1000;
        const x = useMouse ? mx : Math.sin(t * 0.31) * halfW * 0.75 + Math.sin(t * 0.13) * halfW * 0.15;
        const y = useMouse ? my : Math.sin(t * 0.47 + 1.3) * halfH * 0.6;
        const speed = Math.hypot(x - pmx, y - pmy) / Math.max(dt, 1e-3);
        pmx = x; pmy = y;
        paint(x, y, Math.min(14, 2.2 + speed * 0.7) * dt); // «тепло» в секунду: быстрее курсор — ярче след

        const decay = Math.exp(-dt / FADE);
        const k = 1 - Math.exp(-dt * 9);
        for (let i = 0; i < count; i++) {
          heat[i] *= decay;
          shown[i] += (heat[i] - shown[i]) * k;
        }
        gl.bindBuffer(gl.ARRAY_BUFFER, heatBuf);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, shown);
      }

      gl.uniform1f(U.uT, reduce ? 0 : t);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      inst.drawArraysInstancedANGLE(gl.TRIANGLES, 0, VERTS, count);
    }
    requestAnimationFrame(frame);
    if (reduce) window.addEventListener('resize', () => requestAnimationFrame(frame));
  }

  Trinity.initHeroCubes = initHeroCubes;
})(window.Trinity = window.Trinity || {});
