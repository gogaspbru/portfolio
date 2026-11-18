/**
 * «Волны по кубикам» на первом экране (index-cubes.html).
 * По мотивам демо «wavy cubes»: сетка кубиков с перспективой; от курсора расходятся
 * кольцевые волны — фронт волны выдвигает кубики вперёд и подсвечивает их,
 * кольцо растёт и гаснет. Плюс медленная фоновая волна.
 * Второй проход (постобработка): размытие и цветные ореолы к краям кадра, лёгкое зерно.
 * Чистый WebGL (без three.js и модулей) — работает с file://.
 *
 * Без мыши (телефон, планшет, курсор вне экрана) волны сами появляются в случайных местах.
 *
 * Разметка: <canvas class="hero__cubes" data-bg="#3268F2" data-base="#3268F2" data-accent="#EAF1FF">
 *   data-base — цвет кубиков, data-accent — цвет фронта волны, data-bg — фон.
 * Нет WebGL — канвас скрывается, остаётся CSS-фон.
 */
(function (Trinity) {
  'use strict';

  // ---------- параметры ----------
  const CUBE_PX = 56;          // размер кубика на экране (десктоп), px
  const CUBE_PX_MOBILE = 38;   // на узких экранах
  const GAP = 0.03;            // зазор между кубиками (доля размера)
  const DEPTH = 1.4;           // глубина кубика
  const FOV = 40;              // вертикальный угол камеры, ° (больше — сильнее перспектива)
  const TILT_X = -0.16;        // наклон сетки «от зрителя», рад
  const TILT_Y = 0.10;         // поворот вбок, рад
  const WAVE = 0.35;           // амплитуда фоновой волны (в размерах кубика)
  const JITTER = 0.25;         // случайный разброс глубины кубиков

  const RIPPLES = 10;          // сколько волн одновременно
  const RIPPLE_SPEED = 9.5;    // скорость фронта, кубиков в секунду
  const RIPPLE_WIDTH = 1.4;    // ширина фронта, кубиков
  const RIPPLE_LIFE = 1.4;     // постоянная затухания, с (волна живёт ≈ 3× дольше)
  const RIPPLE_PUSH = 1.6;     // насколько фронт выдвигает кубики
  const SPAWN_STEP = 2.4;      // новая волна — каждые N кубиков пути курсора
  const SPAWN_MIN_GAP = 0.12;  // но не чаще, с
  const GHOST_AFTER = 2.5;     // через сколько секунд без мыши волны появляются сами
  const GHOST_EVERY = 1.6;     // как часто, с

  const EDGE_BLUR = 7;         // размытие у краёв кадра, px
  const ABERRATION = 0.006;    // сила цветных ореолов у краёв
  const GRAIN = 0.035;         // зерно

  const SCENE_VERT = `
    precision highp float;
    attribute vec3 aPos; attribute vec3 aNorm; attribute vec2 aUv;
    attribute vec3 aInst;                         // x, y, случайное 0..1
    uniform mat4 uP, uM; uniform float uCamZ, uT, uWave, uJitter, uSize, uDepth;
    uniform vec4 uRip[${RIPPLES}];                // x, y, возраст (с), сила
    uniform float uSpeed, uWidth, uLife, uPush;
    varying vec3 vN; varying vec2 vUv; varying float vHeat, vZ, vFront;
    void main(){
      vec2 o = aInst.xy;
      float w = sin(o.x * 0.30 + uT * 0.55) * sin(o.y * 0.38 - uT * 0.42)
              + 0.6 * sin((o.x * 0.7 + o.y) * 0.16 + uT * 0.33);
      // кольцевые волны: фронт на расстоянии speed·age от центра
      float heat = 0.0;
      for (int i = 0; i < ${RIPPLES}; i++) {
        vec4 r = uRip[i];
        if (r.w <= 0.0) continue;
        float d = distance(o, r.xy) - r.z * uSpeed;
        float band = exp(-d * d / (uWidth * uWidth));
        heat += band * r.w * exp(-r.z / uLife);
      }
      heat = 1.0 - exp(-heat * 2.2);             // мягкое насыщение при наложении волн
      float z = w * uWave + (aInst.z - 0.5) * uJitter + heat * uPush;
      vec3 p = vec3(aPos.xy * uSize + o, (aPos.z - 0.5) * uDepth + z);
      vec4 wp = uM * vec4(p, 1.0);
      vN = mat3(uM) * aNorm; vUv = aUv; vHeat = heat; vZ = z; vFront = step(0.5, aNorm.z);
      gl_Position = uP * vec4(wp.xy, wp.z - uCamZ, 1.0);
    }`;

  const SCENE_FRAG = `
    precision mediump float;
    uniform vec3 uBase, uAccent, uBg;
    varying vec3 vN; varying vec2 vUv; varying float vHeat, vZ, vFront;
    void main(){
      vec3 L = normalize(vec3(-0.4, 0.7, 0.75));
      float dif = max(dot(normalize(vN), L), 0.0);
      float shade = 0.62 + 0.38 * dif;
      shade *= mix(1.0, 0.94 + 0.08 * vUv.y, vFront);          // лицевая грань: градиент
      shade *= mix(mix(0.7, 1.0, vUv.y), 1.0, vFront);        // бока темнеют к основанию
      float h = clamp(vHeat, 0.0, 1.0);
      vec3 mid = mix(uBase, uAccent, 0.45);
      vec3 tint = mix(mix(uBase, mid, smoothstep(0.0, 0.5, h)), uAccent, smoothstep(0.45, 1.0, h));
      vec3 col = tint * mix(shade, 0.85 + 0.15 * shade, h);
      float rim = (1.0 - smoothstep(0.0, 0.05, min(1.0 - vUv.y, vUv.x))) * vFront;
      col += rim * (0.05 + 0.15 * h);                         // блик по кромке
      col = mix(uBg * 0.9, col, clamp(0.72 + vZ * 0.3, 0.0, 1.0)); // утопленные «тонут» в фоне
      gl_FragColor = vec4(col, 1.0);
    }`;

  const POST_VERT = `
    attribute vec2 aQuad; varying vec2 vUv;
    void main(){ vUv = aQuad * 0.5 + 0.5; gl_Position = vec4(aQuad, 0.0, 1.0); }`;

  const POST_FRAG = `
    precision mediump float;
    uniform sampler2D uTex; uniform vec2 uPx; uniform float uT, uBlur, uAb, uGrain, uAspect;
    varying vec2 vUv;
    vec3 blurAt(vec2 uv, float r){
      vec3 s = texture2D(uTex, uv).rgb * 2.0;
      for (int i = 0; i < 8; i++) {
        float a = float(i) * 0.785398;
        s += texture2D(uTex, uv + vec2(cos(a), sin(a)) * r * uPx).rgb;
      }
      return s / 10.0;
    }
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){
      vec2 d = vUv - 0.5;
      float e = smoothstep(0.3, 0.75, length(d * vec2(uAspect, 1.0)) / uAspect * 1.5);
      float r = uBlur * e;
      vec2 off = d * uAb * e;
      vec3 c;
      if (e < 0.01) {
        c = texture2D(uTex, vUv).rgb;            // центр кадра — без размытия (дешевле)
      } else {
        c.r = blurAt(vUv + off, r).r;
        c.g = blurAt(vUv, r).g;
        c.b = blurAt(vUv - off, r).b;
      }
      c += (hash(vUv / uPx + fract(uT) * 100.0) - 0.5) * uGrain;
      gl_FragColor = vec4(c, 1.0);
    }`;

  // куб без задней грани: позиция (z: 0..1), нормаль, uv грани (у боковых uv.y = z)
  function cubeGeometry() {
    const v = [];
    const quad = (a, b, c, d, n) => {
      const uv = [[0, 0], [1, 0], [1, 1], [0, 1]];
      [[a, 0], [b, 1], [c, 2], [a, 0], [c, 2], [d, 3]].forEach(([p, i]) => v.push(...p, ...n, ...uv[i]));
    };
    const h = 0.5;
    quad([-h, -h, 1], [h, -h, 1], [h, h, 1], [-h, h, 1], [0, 0, 1]);
    quad([-h, h, 0], [h, h, 0], [h, h, 1], [-h, h, 1], [0, 1, 0]);
    quad([h, -h, 0], [-h, -h, 0], [-h, -h, 1], [h, -h, 1], [0, -1, 0]);
    quad([h, h, 0], [h, -h, 0], [h, -h, 1], [h, h, 1], [1, 0, 0]);
    quad([-h, -h, 0], [-h, h, 0], [-h, h, 1], [-h, -h, 1], [-1, 0, 0]);
    return new Float32Array(v);
  }

  function perspective(fovDeg, aspect, near, far) {
    const f = 1 / Math.tan((fovDeg * Math.PI) / 360);
    const nf = 1 / (near - far);
    return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0]);
  }

  // R = Ry(b) · Rx(a), по строкам
  function rotYX(a, b) {
    const ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b);
    return [cb, sb * sa, sb * ca, 0, ca, -sa, -sb, cb * sa, cb * ca];
  }
  const toMat4 = (R) => new Float32Array([R[0], R[3], R[6], 0, R[1], R[4], R[7], 0, R[2], R[5], R[8], 0, 0, 0, 0, 1]);

  function hexToRgb(hex, fallback) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return fallback;
    const n = parseInt(m[1], 16);
    return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
  }

  function program(gl, vs, fs) {
    const p = gl.createProgram();
    [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]].forEach(([type, src]) => {
      const sh = gl.createShader(type);
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
      gl.attachShader(p, sh);
    });
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    return p;
  }

  function locations(gl, p, names, fn) {
    const o = {};
    names.forEach((n) => { o[n] = fn.call(gl, p, n); });
    return o;
  }

  function initHeroCubes(canvas) {
    if (!canvas) return;
    const gl = canvas.getContext('webgl', { antialias: false, alpha: false, depth: false });
    const inst = gl && gl.getExtension('ANGLE_instanced_arrays');
    if (!gl || !inst) { canvas.hidden = true; return; }

    let scene, post;
    try {
      scene = program(gl, SCENE_VERT, SCENE_FRAG);
      post = program(gl, POST_VERT, POST_FRAG);
    } catch (err) {
      console.warn('hero-cubes:', err);
      canvas.hidden = true;
      return;
    }

    const SA = locations(gl, scene, ['aPos', 'aNorm', 'aUv', 'aInst'], gl.getAttribLocation);
    const SU = locations(gl, scene, ['uP', 'uM', 'uCamZ', 'uT', 'uWave', 'uJitter', 'uSize', 'uDepth',
      'uRip', 'uSpeed', 'uWidth', 'uLife', 'uPush', 'uBase', 'uAccent', 'uBg'], gl.getUniformLocation);
    const PA = locations(gl, post, ['aQuad'], gl.getAttribLocation);
    const PU = locations(gl, post, ['uTex', 'uPx', 'uT', 'uBlur', 'uAb', 'uGrain', 'uAspect'], gl.getUniformLocation);

    const geo = cubeGeometry();
    const VERTS = geo.length / 8;
    const geoBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, geoBuf);
    gl.bufferData(gl.ARRAY_BUFFER, geo, gl.STATIC_DRAW);
    const instBuf = gl.createBuffer();
    const quadBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);

    const bg = hexToRgb(canvas.dataset.bg, [0.196, 0.408, 0.949]);
    const R = rotYX(TILT_X, TILT_Y);
    gl.useProgram(scene);
    gl.uniform3fv(SU.uBase, hexToRgb(canvas.dataset.base, [0.196, 0.408, 0.949]));
    gl.uniform3fv(SU.uAccent, hexToRgb(canvas.dataset.accent, [0.918, 0.945, 1]));
    gl.uniform3fv(SU.uBg, bg);
    gl.uniform1f(SU.uWave, WAVE);
    gl.uniform1f(SU.uJitter, JITTER);
    gl.uniform1f(SU.uSize, 1 - GAP);
    gl.uniform1f(SU.uDepth, DEPTH);
    gl.uniform1f(SU.uSpeed, RIPPLE_SPEED);
    gl.uniform1f(SU.uWidth, RIPPLE_WIDTH);
    gl.uniform1f(SU.uLife, RIPPLE_LIFE);
    gl.uniform1f(SU.uPush, RIPPLE_PUSH);
    gl.uniformMatrix4fv(SU.uM, false, toMat4(R));
    gl.useProgram(post);
    gl.uniform1i(PU.uTex, 0);
    gl.uniform1f(PU.uAb, ABERRATION);
    gl.uniform1f(PU.uGrain, GRAIN);

    // кадр рисуем в текстуру (с запасом по разрешению — сглаживание), потом постобработка
    const tex = gl.createTexture();
    const depthRb = gl.createRenderbuffer();
    const fbo = gl.createFramebuffer();

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const pr = Math.min(window.devicePixelRatio || 1, 2);

    let count = 0, halfW = 0, halfH = 0, camZ = 1, aspect = 1, fw = 1, fh = 1;

    function build() {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (!w || !h) return false;
      canvas.width = Math.round(w * pr);
      canvas.height = Math.round(h * pr);
      const ss = pr >= 2 ? 1 : 2 / pr;              // отрисовка в ~2× для гладких краёв
      const maxSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
      fw = Math.min(maxSize, Math.round(canvas.width * ss));
      fh = Math.min(maxSize, Math.round(canvas.height * ss));

      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, fw, fh, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.bindRenderbuffer(gl.RENDERBUFFER, depthRb);
      gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, fw, fh);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depthRb);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);

      const cube = w < 768 ? CUBE_PX_MOBILE : CUBE_PX;
      halfW = w / cube / 2;
      halfH = h / cube / 2;
      aspect = w / h;
      camZ = halfH / Math.tan((FOV * Math.PI) / 360);

      gl.useProgram(scene);
      gl.uniform1f(SU.uCamZ, camZ);
      gl.uniformMatrix4fv(SU.uP, false, perspective(FOV, aspect, 0.1, camZ * 4));
      gl.useProgram(post);
      gl.uniform2f(PU.uPx, 1 / fw, 1 / fh);
      gl.uniform1f(PU.uAspect, aspect);
      gl.uniform1f(PU.uBlur, EDGE_BLUR * pr * fw / canvas.width);

      // запас по краям: наклон и перспектива
      const cols = Math.ceil(halfW * 2 * 1.35) + 4;
      const rows = Math.ceil(halfH * 2 * 1.45) + 4;
      count = cols * rows;
      const data = new Float32Array(count * 3);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const i = r * cols + c;
          data[i * 3] = c - (cols - 1) / 2;
          data[i * 3 + 1] = r - (rows - 1) / 2;
          data[i * 3 + 2] = Math.random();
        }
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, instBuf);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      return true;
    }

    // ---------- волны ----------
    const rip = new Float32Array(RIPPLES * 4);     // x, y, время рождения → возраст, сила
    const born = new Float32Array(RIPPLES);
    let next = 0;
    function spawn(x, y, strength, now) {
      rip[next * 4] = x;
      rip[next * 4 + 1] = y;
      rip[next * 4 + 3] = strength;
      born[next] = now;
      next = (next + 1) % RIPPLES;
    }

    // ---------- курсор → точка на плоскости сетки ----------
    let lastMouse = -1e9, lastSpawn = -1e9, lastGhost = -1e9, sx = 1e9, sy = 1e9, inside = false;
    function toGrid(nx, ny) {
      const t = Math.tan((FOV * Math.PI) / 360);
      const o = [0, 0, camZ], d = [nx * t * aspect, ny * t, -1];
      const loc = (v) => [R[0] * v[0] + R[3] * v[1] + R[6] * v[2], R[1] * v[0] + R[4] * v[1] + R[7] * v[2], R[2] * v[0] + R[5] * v[1] + R[8] * v[2]];
      const lo = loc(o), ld = loc(d);
      const k = -lo[2] / ld[2];
      return [lo[0] + ld[0] * k, lo[1] + ld[1] * k];
    }
    function pointerToGrid(e) {
      const r = canvas.getBoundingClientRect();
      inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      if (!inside) return null;
      return toGrid(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    }
    window.addEventListener('pointermove', (e) => {
      if (reduce || (e.pointerType && e.pointerType !== 'mouse')) return; // тач — волны сами
      const p = pointerToGrid(e);
      if (!p) return;
      const now = performance.now();
      lastMouse = now;
      if (Math.hypot(p[0] - sx, p[1] - sy) >= SPAWN_STEP && now - lastSpawn > SPAWN_MIN_GAP * 1000) {
        spawn(p[0], p[1], 0.9, now);
        sx = p[0]; sy = p[1]; lastSpawn = now;
      }
    }, { passive: true });
    window.addEventListener('pointerdown', (e) => {
      if (reduce) return;
      const p = pointerToGrid(e);
      if (p) { spawn(p[0], p[1], 1.4, performance.now()); lastMouse = performance.now(); }
    }, { passive: true });
    document.documentElement.addEventListener('pointerleave', () => { inside = false; });

    let visible = true;
    if ('IntersectionObserver' in window) {
      new IntersectionObserver((es) => { visible = es[0].isIntersecting; }).observe(canvas);
    }
    window.addEventListener('resize', () => { build(); if (reduce) requestAnimationFrame(frame); });
    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); canvas.hidden = true; });
    if (!build()) return;

    function drawScene(t) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.viewport(0, 0, fw, fh);
      gl.enable(gl.DEPTH_TEST);
      gl.clearColor(bg[0] * 0.9, bg[1] * 0.9, bg[2] * 0.9, 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.useProgram(scene);
      gl.uniform1f(SU.uT, t);
      gl.uniform4fv(SU.uRip, rip);
      gl.bindBuffer(gl.ARRAY_BUFFER, geoBuf);
      gl.enableVertexAttribArray(SA.aPos);  gl.vertexAttribPointer(SA.aPos, 3, gl.FLOAT, false, 32, 0);
      gl.enableVertexAttribArray(SA.aNorm); gl.vertexAttribPointer(SA.aNorm, 3, gl.FLOAT, false, 32, 12);
      gl.enableVertexAttribArray(SA.aUv);   gl.vertexAttribPointer(SA.aUv, 2, gl.FLOAT, false, 32, 24);
      gl.bindBuffer(gl.ARRAY_BUFFER, instBuf);
      gl.enableVertexAttribArray(SA.aInst); gl.vertexAttribPointer(SA.aInst, 3, gl.FLOAT, false, 0, 0);
      inst.vertexAttribDivisorANGLE(SA.aInst, 1);
      inst.drawArraysInstancedANGLE(gl.TRIANGLES, 0, VERTS, count);
      inst.vertexAttribDivisorANGLE(SA.aInst, 0);
      [SA.aPos, SA.aNorm, SA.aUv, SA.aInst].forEach((l) => gl.disableVertexAttribArray(l));
    }

    function drawPost(t) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.disable(gl.DEPTH_TEST);
      gl.useProgram(post);
      gl.uniform1f(PU.uT, t);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
      gl.enableVertexAttribArray(PA.aQuad);
      gl.vertexAttribPointer(PA.aQuad, 2, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      gl.disableVertexAttribArray(PA.aQuad);
    }

    const t0 = performance.now();
    function frame(now) {
      if (!reduce) requestAnimationFrame(frame);
      if (!visible || canvas.hidden) return;
      const t = reduce ? 0 : (now - t0) / 1000;

      if (!reduce) {
        // без мыши волны появляются сами
        if (!(inside && now - lastMouse < GHOST_AFTER * 1000) && now - lastGhost > GHOST_EVERY * 1000) {
          spawn((Math.random() * 1.4 - 0.7) * halfW, (Math.random() * 1.4 - 0.7) * halfH, 1.0, now);
          lastGhost = now;
        }
        for (let i = 0; i < RIPPLES; i++) {
          const age = (now - born[i]) / 1000;
          rip[i * 4 + 2] = age;
          if (age > RIPPLE_LIFE * 4) rip[i * 4 + 3] = 0;   // волна погасла — слот свободен
        }
      }

      drawScene(t);
      drawPost(t);
    }
    requestAnimationFrame(frame);
  }

  Trinity.initHeroCubes = initHeroCubes;
})(window.Trinity = window.Trinity || {});
