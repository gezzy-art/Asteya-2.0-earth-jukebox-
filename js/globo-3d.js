/* Globo 3D del Jukebox: la imagen de la NASA de la pista envuelve una esfera que gira con el audio.
 * Dos modos (opts.modo):
 * - 'luces' (pista 5): assets/eic/luces-nocturnas-cambio.jpg (NASA SVS 5313, cambio 2012 → 2023): morado = nuevas,
 *   naranja = apagadas o más tenues, blanco = siguen. Continentes con el gris de rayos-iss-2023.jpg (SVS 5011).
 *   El audio recorre el mundo de oeste a este: el globo gira y la línea vertical es la franja que suena.
 * - 'oceano' (pista 3): assets/eic/corrientes-oceanicas.jpg (NASA SVS 3912, ECCO2) y, si se puede, su animación
 *   corrientes-oceanicas.webm como textura de video. El audio va de norte a sur: el globo se inclina del Polo Norte
 *   al Polo Sur, gira despacio para que se vean todos los océanos, y la línea horizontal es la latitud que suena.
 * Las dos imágenes son mapas equirectangulares del mundo entero, así que se pegan tal cual sobre la esfera.
 * Al arrastrar o girar con las flechas se pasa a "explorar": suena lo que queda bajo la línea (luces) o bajo el
 * círculo central (océano: agua cálida = nota aguda, tierra = golpe sordo).
 * Three.js se carga del CDN solo cuando hace falta. Necesita servidor local (con file:// el navegador no deja usar
 * las imágenes como textura). API: EIJ.globo3d.available() y EIJ.globo3d.create(canvas, opts) → Promise<globo>. */
(function () {
  'use strict';
  var EIJ = window.EIJ = window.EIJ || {};
  var THREE_URL = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
  var COLS = 72, ROWS = 36;   // celdas de 5°: columnas de oeste a este, filas de norte a sur
  var CAPAS = ['nuevas', 'apagadas', 'siguen'];

  function available() {
    if (location.protocol === 'file:') return false;
    try { var c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); }
    catch (e) { return false; }
  }

  var threePromise = null;
  function loadThree() {
    if (window.THREE) return Promise.resolve(window.THREE);
    if (!threePromise) threePromise = new Promise(function (ok, ko) {
      var s = document.createElement('script'); s.src = THREE_URL;
      s.onload = function () { ok(window.THREE); }; s.onerror = function () { threePromise = null; ko(new Error('three')); };
      document.head.appendChild(s);
    });
    return threePromise;
  }

  /* ---------- Lugares ---------- */
  var REGIONES = [ // [nombre, latMin, latMax, lonMin, lonMax]; gana el primero que coincide
    ['la Antártida', -90, -62, -180, 180], ['Groenlandia', 60, 84, -73, -12],
    ['Japón y Corea', 30, 46, 124, 146], ['India', 6, 35, 68, 90], ['China', 20, 45, 90, 123],
    ['el sudeste asiático', -11, 20, 92, 141], ['Oriente Medio', 12, 42, 34, 63],
    ['Europa', 36, 71, -11, 40], ['Asia central', 35, 55, 50, 90], ['Rusia', 45, 78, 40, 180],
    ['Australia', -44, -10, 113, 154], ['Nueva Zelanda', -47, -34, 166, 179],
    ['el norte de África', 15, 37, -17, 34], ['África central', -10, 15, -17, 42], ['el sur de África', -35, -10, 10, 52],
    ['el Caribe', 10, 24, -85, -60], ['Canadá y Alaska', 50, 84, -168, -52], ['Estados Unidos', 25, 50, -125, -66],
    ['México y Centroamérica', 7, 32, -118, -77], ['Sudamérica', -56, 12, -82, -34]
  ];
  function region(lat, lon) {
    for (var i = 0; i < REGIONES.length; i++) {
      var r = REGIONES[i];
      if (lat >= r[1] && lat <= r[2] && lon >= r[3] && lon <= r[4]) return r[0];
    }
    if (lat > 66) return 'el océano Ártico';
    if (lat < -55) return 'el océano Austral';
    if (lon > -70 && lon < 20) return 'el océano Atlántico';
    if (lon >= 20 && lon < 120 && lat < 25) return 'el océano Índico';
    return 'el océano Pacífico';
  }
  function wrap(lon) { return ((lon + 540) % 360) - 180; }
  function fmtLat(lat) { var a = Math.round(Math.abs(lat)); return a === 0 ? '0°' : a + '° ' + (lat >= 0 ? 'N' : 'S'); }
  function fmtLon(lon) { var o = Math.round(Math.abs(lon)); return o === 0 || o === 180 ? o + '°' : o + '° ' + (lon >= 0 ? 'E' : 'O'); }

  /* ---------- Sonido de exploración (Web Audio) ---------- */
  var ac = null, master = null;
  function ensureAudio() {
    if (!ac) {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      var comp = ac.createDynamicsCompressor();
      master = ac.createGain(); master.gain.value = 0.55;
      master.connect(comp); comp.connect(ac.destination);
    }
    if (ac.state === 'suspended') ac.resume();
  }
  function penta(i, base) { // escala pentatónica de Do
    i = Math.max(0, Math.min(14, Math.round(i)));
    return base * Math.pow(2, ([0, 2, 4, 7, 9][i % 5] + 12 * Math.floor(i / 5)) / 12);
  }
  function freqLat(lat) { return penta((lat + 60) / 135 * 14, 261.63); } // 60° S = Do4 … 75° N = La6
  function tone(type, f, t, peak, a, dec, filt) {
    var o = ac.createOscillator(), g = ac.createGain(), last = o;
    o.type = type; o.frequency.value = f;
    if (filt) { var lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = filt; o.connect(lp); last = lp; }
    last.connect(g); g.connect(master);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec);
    o.start(t); o.stop(t + a + dec + 0.05);
  }
  var SONIDO = {
    nuevas: function (f, v, t) { tone('sine', f, t, 0.22 * v, 0.004, 1.3); tone('sine', f * 2.76, t, 0.06 * v, 0.004, 0.5); },
    apagadas: function (f, v, t) { tone('triangle', f / 4, t, 0.3 * v, 0.03, 0.9, 500); },
    siguen: function (f, v, t) { tone('sine', f / 2, t, 0.08 * v, 0.003, 0.35); }
  };

  /* ---------- Datos de las luces: píxeles → celdas de 5° ---------- */
  function lucesCells(img) {
    var cells = {}; CAPAS.forEach(function (k) { cells[k] = new Float32Array(COLS * ROWS); });
    var cv = document.createElement('canvas'); cv.width = 720; cv.height = 360;
    var cx = cv.getContext('2d'); cx.drawImage(img, 0, 0, 720, 360);
    var d = cx.getImageData(0, 0, 720, 360).data;   // lanza si el navegador no deja leer los píxeles
    for (var y = 0; y < 360; y++) for (var x = 0; x < 720; x++) {
      var i = (y * 720 + x) * 4, R = d[i], G = d[i + 1], B = d[i + 2], mx = Math.max(R, G, B), mn = Math.min(R, G, B);
      if (mx < 18) continue;
      var cell = Math.floor(x / 10) * ROWS + Math.floor(y / 10), sat = (mx - mn) / mx, v = mx / 255;
      if (sat < 0.22) cells.siguen[cell] += v;
      else if (B >= R * 0.85) cells.nuevas[cell] += v;
      else cells.apagadas[cell] += v;
    }
    CAPAS.forEach(function (k) { // 0–1, con el percentil 95 de las celdas con luz como tope
      var a = cells[k], nz = Array.prototype.slice.call(a).filter(function (v) { return v > 0; }).sort(function (p, q) { return p - q; });
      var top = nz.length ? nz[Math.floor(nz.length * 0.95)] : 1;
      for (var j = 0; j < a.length; j++) a[j] = Math.min(1, a[j] / top);
    });
    return cells;
  }

  /* ---------- Cada modo: texturas, sombreado, línea guía, sonido y descripción ---------- */
  var VERT = 'varying vec2 vUv; varying vec3 vN; void main(){ vUv = uv; vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
  var RIM = '  col += pow(1.0 - max(dot(vN, vec3(0.0, 0.0, 1.0)), 0.0), 3.0) * vec3(0.09, 0.13, 0.33);\n';

  var MODOS = {
    luces: {
      textures: ['assets/eic/luces-nocturnas-cambio.jpg', 'assets/eic/rayos-iss-2023.jpg'],
      line: 'vertical', color: 0xf9a8d4, start: { lon: -170, lat: 20 },
      frag: [
        'uniform sampler2D t0; uniform sampler2D t1; varying vec2 vUv; varying vec3 vN;',
        'void main(){',
        '  vec3 l = texture2D(t0, vUv).rgb; vec3 t = texture2D(t1, vUv).rgb;',
        '  float mx = max(max(l.r, l.g), l.b), mn = min(min(l.r, l.g), l.b);',
        '  float colored = step(0.22, mx > 0.01 ? (mx - mn) / mx : 0.0);',
        '  float isNew = colored * step(l.r * 0.85, l.b), isOff = colored - isNew, isOn = 1.0 - colored;',
        '  vec3 col = vec3(0.012, 0.018, 0.05);',
        '  col += smoothstep(0.09, 0.22, min(min(t.r, t.g), t.b)) * vec3(0.11, 0.13, 0.24);',
        '  col += smoothstep(0.05, 0.45, mx) * 2.4 * (isNew * vec3(0.73, 0.55, 1.0) + isOff * vec3(1.0, 0.63, 0.25) + isOn * vec3(1.0, 0.95, 0.84));',
        RIM + '  gl_FragColor = vec4(col, 1.0);', '}'
      ].join('\n'),
      data: function (imgs) { return lucesCells(imgs[0]); },
      // Lo que hay alrededor del centro: 7 columnas × 5 filas
      describe: function (cells, lat, lon) {
        var c0 = colOf(lon), r0 = Math.round((87.5 - lat) / 5), t = { nuevas: 0, apagadas: 0, siguen: 0 }, n = 0;
        for (var dc = -3; dc <= 3; dc++) for (var dr = -2; dr <= 2; dr++) {
          var rr = r0 + dr; if (rr < 0 || rr >= ROWS) continue;
          var c = (c0 + dc + COLS) % COLS; n++;
          CAPAS.forEach(function (k) { t[k] += cells[k][c * ROWS + rr]; });
        }
        var nu = t.nuevas / n, of = t.apagadas / n, on = t.siguen / n;
        if (nu + of + on < 0.04) return 'oscuridad';
        if (nu > of * 1.3) return 'más luces nuevas';
        if (of > nu * 1.3) return 'más luces apagadas';
        if (nu + of > on * 0.5) return 'luces nuevas y apagadas';
        return 'sobre todo luces que siguen';
      },
      // Suena la columna bajo la línea vertical; la zona hacia la que miras pesa más
      key: function (lat, lon) { return colOf(lon); },
      sound: function (cells, lat, lon) {
        var c = colOf(lon), now = ac.currentTime;
        CAPAS.forEach(function (k, ki) {
          var list = [];
          for (var rr = 0; rr < ROWS; rr++) {
            var la = 87.5 - rr * 5, v = cells[k][c * ROWS + rr] * (0.35 + 0.65 * Math.max(0, Math.cos((la - lat) * Math.PI / 180)));
            if (v > 0.22) list.push({ lat: la, v: v });
          }
          list.sort(function (p, q) { return q.v - p.v; });
          list.slice(0, 3).forEach(function (it, j) { SONIDO[k](freqLat(it.lat), Math.min(1, it.v), now + 0.01 + ki * 0.015 + j * 0.045); });
        });
      },
      follow: function (view, v, dt, reduced) { view.lon = wrap(v); view.lat += (20 - view.lat) * (reduced ? 1 : Math.min(1, dt * 2)); }
    },

    oceano: {
      textures: ['assets/eic/corrientes-oceanicas.jpg'],
      video: 'assets/eic/corrientes-oceanicas.webm',
      line: 'horizontal', color: 0xf4a3cb, start: { lon: -150, lat: 80 },
      frag: [
        'uniform sampler2D t0; varying vec2 vUv; varying vec3 vN;',
        'void main(){',
        '  vec3 col = texture2D(t0, vUv).rgb * 1.15;',
        RIM + '  gl_FragColor = vec4(col, 1.0);', '}'
      ].join('\n'),
      data: function () { return EIJ.OCEAN || null; },
      describe: function (O, lat, lon) {
        var v = oceanAt(O, lat, lon);
        return v === null ? 'sin datos' : v < 0 ? 'tierra o hielo' : v > 0.66 ? 'agua cálida' : v > 0.33 ? 'agua templada' : 'agua fría';
      },
      // Suena la celda bajo el círculo central: agua cálida = nota aguda (como en la pista), tierra = golpe sordo
      key: function (lat, lon) { return Math.floor((90 - lat) / 5) * COLS + colOf(lon); },
      sound: function (O, lat, lon) {
        var v = oceanAt(O, lat, lon), now = ac.currentTime;
        if (v === null) return;
        if (v < 0) { tone('sine', 70, now, 0.35, 0.003, 0.12, 300); return; }
        var f = penta(v * 14, 130.81);
        tone('triangle', f, now, 0.28, 0.005, 0.7, 2400); tone('sine', f * 2, now, 0.06, 0.005, 0.3);
      },
      // Del norte al sur; mientras tanto gira despacio para mostrar todos los océanos
      follow: function (view, v, dt, reduced) { view.lat = Math.max(-85, Math.min(85, v)); if (!reduced) view.lon = wrap(view.lon + 8 * dt); }
    }
  };
  function colOf(lon) { return Math.min(COLS - 1, Math.floor((wrap(lon) + 180) / 5)); }
  function oceanAt(O, lat, lon) {
    if (!O) return null;
    var r = Math.max(0, Math.min(O.rows - 1, Math.floor((90 - lat) / 5)));
    return O.grid[r * O.cols + colOf(lon)];
  }

  function create(canvas, opts) {
    opts = opts || {};
    var M = MODOS[opts.modo || 'luces'];
    return loadThree().then(function (THREE) {
      return Promise.all(M.textures.map(function (src) {
        return new Promise(function (ok, ko) {
          new THREE.TextureLoader().load(src, function (t) { t.minFilter = THREE.LinearFilter; t.generateMipmaps = false; ok(t); }, undefined, ko);
        });
      })).then(function (tex) { return build(THREE, canvas, opts, M, tex); });
    });
  }

  function build(THREE, canvas, opts, M, tex) {
    var data = M.data(tex.map(function (t) { return t.image; }));
    var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 1);
    tex.forEach(function (t) { t.anisotropy = renderer.capabilities.getMaxAnisotropy(); });
    var scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(35, 2, 0.1, 200);

    var uniforms = {}; tex.forEach(function (t, i) { uniforms['t' + i] = { value: t }; });
    var globe = new THREE.Mesh(new THREE.SphereGeometry(1, 128, 64),
      new THREE.ShaderMaterial({ uniforms: uniforms, vertexShader: VERT, fragmentShader: M.frag }));
    globe.rotation.order = 'XYZ';
    scene.add(globe);

    // Océano: la animación de las corrientes como textura de video (si no carga, se queda la imagen fija)
    var video = null;
    if (M.video) {
      video = document.createElement('video');
      video.muted = true; video.loop = true; video.playsInline = true; video.preload = 'auto'; video.src = M.video;
      video.addEventListener('loadeddata', function () {
        if (!video.videoWidth || Math.abs(video.videoWidth / video.videoHeight - 2) > 0.05) { video = null; return; } // solo si es un mapa 2:1
        var vt = new THREE.VideoTexture(video); vt.minFilter = THREE.LinearFilter; vt.generateMipmaps = false;
        uniforms.t0.value = vt;
        if (running) video.play().catch(function () {});
      }, { once: true });
      video.addEventListener('error', function () { video = null; }, { once: true });
    }

    scene.add(new THREE.Mesh(new THREE.SphereGeometry(1.14, 64, 32), new THREE.ShaderMaterial({ // atmósfera
      vertexShader: 'varying vec3 vN; void main(){ vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'varying vec3 vN; void main(){ float i = pow(max(0.62 - dot(vN, vec3(0.0, 0.0, 1.0)), 0.0), 2.6); gl_FragColor = vec4(0.32, 0.45, 1.0, 1.0) * i; }',
      side: THREE.BackSide, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false
    })));

    // La línea fija que suena: un meridiano (oeste → este) o un paralelo (norte → sur) frente a la cámara
    var pts = [];
    for (var a = -90; a <= 90; a += 2) {
      var r = a * Math.PI / 180, s = Math.sin(r) * 1.006, c = Math.cos(r) * 1.006;
      pts.push(M.line === 'vertical' ? new THREE.Vector3(0, s, c) : new THREE.Vector3(s, 0, c));
    }
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({ color: M.color, transparent: true, opacity: 0.7 })));

    var star = new Float32Array(1400 * 3);
    for (var k = 0; k < 1400; k++) {
      var u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2, q = Math.sqrt(1 - u * u);
      star[k * 3] = 60 * q * Math.cos(th); star[k * 3 + 1] = 60 * u; star[k * 3 + 2] = 60 * q * Math.sin(th);
    }
    var sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(star, 3));
    scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xaab4e8, size: 0.12, transparent: true, opacity: 0.7 })));

    /* ---------- Vista ---------- */
    var view = { lon: M.start.lon, lat: M.start.lat }, follow = false, target = null, running = false, lastKey = null, lastSound = 0;
    var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

    function resize() {
      var w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return;
      renderer.setSize(w, h, false); camera.aspect = w / h;
      var v = camera.fov * Math.PI / 180, hf = 2 * Math.atan(Math.tan(v / 2) * camera.aspect);
      camera.position.set(0, 0, 1.25 / Math.tan(Math.min(v, hf) / 2));
      camera.updateProjectionMatrix();
    }
    window.addEventListener('resize', function () { if (running) resize(); });

    function describe() {
      return { region: region(view.lat, view.lon), lat: fmtLat(view.lat), lon: fmtLon(view.lon), text: M.describe(data, view.lat, view.lon) };
    }
    function userMove(dLon, dLat) {
      ensureAudio();
      if (follow && opts.onUserMove) opts.onUserMove();   // el Jukebox pausa el audio y pasa a explorar
      follow = false;
      view.lon = wrap(view.lon + dLon); view.lat = Math.max(-85, Math.min(85, view.lat + dLat));
      var key = M.key(view.lat, view.lon);
      if (key !== lastKey && ac && ac.currentTime - lastSound > 0.09) { lastKey = key; lastSound = ac.currentTime; M.sound(data, view.lat, view.lon); }
      if (opts.onMove) opts.onMove(describe());
    }

    var drag = null;
    canvas.addEventListener('pointerdown', function (e) { drag = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); ensureAudio(); });
    canvas.addEventListener('pointermove', function (e) {
      if (!drag) return;
      var f = 160 / Math.max(200, Math.min(canvas.clientWidth, canvas.clientHeight));
      userMove(-(e.clientX - drag.x) * f, (e.clientY - drag.y) * f);
      drag = { x: e.clientX, y: e.clientY };
    });
    canvas.addEventListener('pointerup', function () { drag = null; });
    canvas.addEventListener('pointercancel', function () { drag = null; });
    canvas.addEventListener('keydown', function (e) {
      var st = e.shiftKey ? 45 : 15, m = { ArrowLeft: [-st, 0], ArrowRight: [st, 0], ArrowUp: [0, 10], ArrowDown: [0, -10] }[e.key];
      if (!m) return;
      e.preventDefault(); e.stopPropagation();   // las flechas de la página (cambiar de pista) no se disparan
      userMove(m[0], m[1]);
    });

    var prevT = 0;
    function frame(t) {
      if (!running) return;
      var dt = prevT ? Math.min(0.1, (t - prevT) / 1000) : 0; prevT = t;
      if (follow && target !== null) M.follow(view, target, dt, reduced);
      globe.rotation.y = (-90 - view.lon) * Math.PI / 180;
      globe.rotation.x = view.lat * Math.PI / 180;
      renderer.render(scene, camera);
      requestAnimationFrame(frame);
    }

    return {
      /** Sigue al audio: longitud (luces, −180 → 180) o latitud (océano, 90 → −90) */
      follow: function (v) { follow = true; target = v; lastKey = null; },
      start: function () {
        if (running) return; running = true; prevT = 0; resize(); requestAnimationFrame(frame);
        if (video && uniforms.t0.value.isVideoTexture) video.play().catch(function () {});
      },
      stop: function () { running = false; if (video) video.pause(); },
      resize: resize,
      describe: describe
    };
  }

  EIJ.globo3d = { available: available, create: create };
})();
