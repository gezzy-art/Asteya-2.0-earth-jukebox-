/* Globo 3D de la Tierra de noche (mini demo).
 * - Imagen de luces: NASA SVS 5313 (cambio 2012 → 2023): morado = nuevas, naranja = apagadas, blanco = siguen.
 * - Imagen de rayos: NASA SVS 5011 (LIS en la ISS): amarillo = rayos; su gris sirve para dibujar los continentes.
 * Las dos son mapas equirectangulares del mundo entero (la de luces está estirada a 16:9, no recortada),
 * así que se pegan tal cual sobre la esfera.
 * Sonido: se oye la franja de 5° de longitud que está en el centro (la línea vertical). Más al norte = más agudo.
 * Necesita servidor local: con file:// el navegador no deja usar las imágenes como textura ni leer sus píxeles. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var COLS = 72, ROWS = 36;             // celdas de 5°: columnas de oeste a este, filas de norte a sur
  var CAPAS = ['nuevas', 'apagadas', 'siguen', 'rayos'];
  var NOMBRE = { nuevas: 'luces nuevas', apagadas: 'luces apagadas', siguen: 'luces que siguen', rayos: 'rayos' };
  var show = { nuevas: true, apagadas: true, siguen: true, rayos: false };
  var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Voz y anuncios ---------- */
  var voiceOn = true;
  try { voiceOn = localStorage.getItem('globo-voz') !== '0'; } catch (e) {}
  var synth = window.speechSynthesis, voz = null;
  function pickVoice() {
    if (!synth) return;
    var vs = synth.getVoices().filter(function (v) { return /^es/i.test(v.lang); });
    voz = vs.filter(function (v) { return /es-(MX|US|419)/i.test(v.lang); })[0] || vs[0] || null;
  }
  if (synth) { pickVoice(); synth.onvoiceschanged = pickVoice; }
  function say(text) {
    $('g-status').textContent = text;
    if (voiceOn && synth) {
      synth.cancel();
      var u = new SpeechSynthesisUtterance(text);
      u.lang = voz ? voz.lang : 'es-MX'; if (voz) u.voice = voz; u.rate = 1.05;
      synth.speak(u);
    } else {
      $('sr').textContent = ''; setTimeout(function () { $('sr').textContent = text; }, 30);
    }
  }
  function setVoice(on) {
    voiceOn = on; $('g-voice').setAttribute('aria-pressed', String(on));
    try { localStorage.setItem('globo-voz', on ? '1' : '0'); } catch (e) {}
    if (!on && synth) synth.cancel();
    say(on ? 'Voz guía activada.' : 'Voz guía apagada.');
  }
  $('g-voice').setAttribute('aria-pressed', String(voiceOn));

  /* ---------- Lugares ---------- */
  var REGIONES = [ // [nombre, latMin, latMax, lonMin, lonMax]; el primero que coincide gana
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
  var LUGARES = [ // la tecla K salta de uno a otro
    { lat: 48, lon: 8, txt: 'Europa: muchas luces aparecen en naranja, como apagadas. En parte es por el cambio a lámparas LED, que el satélite capta peor.' },
    { lat: 22, lon: 79, txt: 'India: casi todo es morado. Aparecieron muchas luces nuevas entre 2012 y 2023.' },
    { lat: 32, lon: 112, txt: 'China: muchas luces nuevas en las ciudades del este.' },
    { lat: 38, lon: -95, txt: 'Estados Unidos: la mayoría son luces que siguen, con algunas nuevas.' },
    { lat: 0, lon: 22, txt: 'África central: pocas luces de ciudad, pero muchísimos rayos. Activé la capa de rayos.', rayos: true },
    { lat: -15, lon: -55, txt: 'Sudamérica: luces nuevas en Brasil y muchos rayos en el interior.' }
  ];
  var lugar = -1;

  function fmt(lat, lon) {
    var a = Math.round(Math.abs(lat)), o = Math.round(Math.abs(lon));
    return a + '° ' + (lat >= 0 ? 'N' : 'S') + ', ' + o + '° ' + (lon >= 0 ? 'E' : 'O');
  }
  function fmtVoz(lat, lon) {
    var a = Math.round(Math.abs(lat)), o = Math.round(Math.abs(lon));
    return a + ' grados ' + (lat >= 0 ? 'norte' : 'sur') + ', ' + o + ' grados ' + (lon >= 0 ? 'este' : 'oeste');
  }

  /* ---------- Errores ---------- */
  function fail(msg) {
    var e = $('g-error'); e.textContent = msg; e.hidden = false;
    $('g-where').textContent = '';
  }
  if (location.protocol === 'file:') {
    fail('El globo necesita el servidor local: abre la carpeta del proyecto con iniciar-servidor.bat y entra a /mini-demo/globo.html.');
    return;
  }
  if (!window.THREE) { fail('No se pudo cargar Three.js. Revisa la conexión a internet.'); return; }

  /* ---------- Escena ---------- */
  var canvas = $('globo');
  var renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true }); }
  catch (e) { fail('Este equipo o navegador no tiene WebGL, que hace falta para el globo 3D.'); return; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x05060f, 1);
  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(35, 1, 0.1, 200);

  var uniforms = {
    tLuces: { value: null }, tRayos: { value: null },
    show: { value: new THREE.Vector4(1, 1, 1, 0) }
  };
  var globe = new THREE.Mesh(
    new THREE.SphereGeometry(1, 128, 64),
    new THREE.ShaderMaterial({
      uniforms: uniforms,
      vertexShader: [
        'varying vec2 vUv; varying vec3 vN;',
        'void main(){ vUv = uv; vN = normalize(normalMatrix * normal);',
        '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }'
      ].join('\n'),
      fragmentShader: [
        'uniform sampler2D tLuces; uniform sampler2D tRayos; uniform vec4 show;',
        'varying vec2 vUv; varying vec3 vN;',
        'void main(){',
        '  vec3 l = texture2D(tLuces, vUv).rgb; vec3 r = texture2D(tRayos, vUv).rgb;',
        '  float mx = max(max(l.r, l.g), l.b), mn = min(min(l.r, l.g), l.b);',
        '  float sat = mx > 0.01 ? (mx - mn) / mx : 0.0;',
        '  float colored = step(0.22, sat);',
        '  float isNew = colored * step(l.r * 0.85, l.b);',
        '  float isOff = colored - isNew;',
        '  float isOn = 1.0 - colored;',
        '  float b = smoothstep(0.05, 0.45, mx) * 2.4;',
        '  vec3 col = vec3(0.012, 0.018, 0.05);',
        '  float gray = min(min(r.r, r.g), r.b);',
        '  col += smoothstep(0.09, 0.22, gray) * vec3(0.11, 0.13, 0.24);',
        '  col += b * (isNew * show.x * vec3(0.73, 0.55, 1.0) + isOff * show.y * vec3(1.0, 0.63, 0.25) + isOn * show.z * vec3(1.0, 0.95, 0.84));',
        '  float yel = clamp((min(r.r, r.g) - r.b - 0.15) * 3.0, 0.0, 1.0);',
        '  col += yel * show.w * vec3(1.0, 0.88, 0.2) * 1.8;',
        '  float rim = pow(1.0 - max(dot(vN, vec3(0.0, 0.0, 1.0)), 0.0), 3.0);',
        '  col += rim * vec3(0.18, 0.26, 0.65) * 0.5;',
        '  gl_FragColor = vec4(col, 1.0);',
        '}'
      ].join('\n')
    })
  );
  scene.add(globe);

  // Brillo de la atmósfera
  scene.add(new THREE.Mesh(
    new THREE.SphereGeometry(1.14, 64, 32),
    new THREE.ShaderMaterial({
      vertexShader: 'varying vec3 vN; void main(){ vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'varying vec3 vN; void main(){ float i = pow(max(0.62 - dot(vN, vec3(0.0, 0.0, 1.0)), 0.0), 2.6); gl_FragColor = vec4(0.32, 0.45, 1.0, 1.0) * i; }',
      side: THREE.BackSide, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false
    })
  ));

  // Línea fija: el meridiano que suena (mitad visible del círculo x = 0)
  (function () {
    var pts = [];
    for (var t = -90; t <= 90; t += 2) { var a = t * Math.PI / 180; pts.push(new THREE.Vector3(0, Math.sin(a) * 1.006, Math.cos(a) * 1.006)); }
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({ color: 0xf4a3cb, transparent: true, opacity: 0.55 })));
  })();

  // Estrellas
  (function () {
    var n = 1400, p = new Float32Array(n * 3);
    for (var i = 0; i < n; i++) {
      var u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2, s = Math.sqrt(1 - u * u);
      p[i * 3] = 60 * s * Math.cos(th); p[i * 3 + 1] = 60 * u; p[i * 3 + 2] = 60 * s * Math.sin(th);
    }
    var g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xaab4e8, size: 0.12, transparent: true, opacity: 0.7 })));
  })();

  function resize() {
    var w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    var v = camera.fov * Math.PI / 180, hf = 2 * Math.atan(Math.tan(v / 2) * camera.aspect);
    camera.position.set(0, 0, 1.3 / Math.tan(Math.min(v, hf) / 2));
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);

  /* ---------- Datos: leer los píxeles en celdas de 5° ---------- */
  var cells = {};  // cells[capa][c * ROWS + r], de 0 a 1
  function pixels(img) {
    var cv = document.createElement('canvas'); cv.width = 720; cv.height = 360;
    var cx = cv.getContext('2d'); cx.drawImage(img, 0, 0, 720, 360);
    return cx.getImageData(0, 0, 720, 360).data;
  }
  function normalize(arr) {
    var nz = Array.prototype.slice.call(arr).filter(function (v) { return v > 0; }).sort(function (a, b) { return a - b; });
    var p95 = nz.length ? nz[Math.floor(nz.length * 0.95)] : 1;
    for (var i = 0; i < arr.length; i++) arr[i] = Math.min(1, arr[i] / p95);
    return arr;
  }
  function buildCells(imgLuces, imgRayos) {
    CAPAS.forEach(function (k) { cells[k] = new Float32Array(COLS * ROWS); });
    var d = pixels(imgLuces), x, y, i, cell;
    for (y = 0; y < 360; y++) for (x = 0; x < 720; x++) {
      i = (y * 720 + x) * 4;
      var R = d[i], G = d[i + 1], B = d[i + 2], mx = Math.max(R, G, B), mn = Math.min(R, G, B);
      if (mx < 18) continue;
      cell = Math.floor(x / 10) * ROWS + Math.floor(y / 10);
      var sat = (mx - mn) / mx, v = mx / 255;
      if (sat < 0.22) cells.siguen[cell] += v;
      else if (B >= R * 0.85) cells.nuevas[cell] += v;
      else cells.apagadas[cell] += v;
    }
    d = pixels(imgRayos);
    for (y = 0; y < 360; y++) for (x = 0; x < 720; x++) {
      i = (y * 720 + x) * 4;
      if (d[i] > 140 && d[i + 1] > 120 && d[i + 2] < 0.6 * Math.min(d[i], d[i + 1])) cells.rayos[Math.floor(x / 10) * ROWS + Math.floor(y / 10)] += 1;
    }
    CAPAS.forEach(function (k) { normalize(cells[k]); });
  }

  /* ---------- Sonido (Web Audio) ---------- */
  var ac = null, master = null, noiseBuf = null;
  function ensureAudio() {
    if (!ac) {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      var comp = ac.createDynamicsCompressor();
      master = ac.createGain(); master.gain.value = 0.55;
      master.connect(comp); comp.connect(ac.destination);
      noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
      var ch = noiseBuf.getChannelData(0);
      for (var i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
    }
    if (ac.state === 'suspended') ac.resume();
  }
  function freqLat(lat) { // pentatónica de Do: de 60° S (Do4) a 75° N (La6)
    var i = Math.max(0, Math.min(14, Math.round((lat + 60) / 135 * 14)));
    var semis = [0, 2, 4, 7, 9][i % 5] + 12 * Math.floor(i / 5);
    return 261.63 * Math.pow(2, semis / 12);
  }
  function env(g, t, peak, a, dec) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec);
  }
  function tone(type, f, t, peak, a, dec, filt) {
    var o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.value = f;
    var last = o;
    if (filt) { var lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = filt; o.connect(lp); last = lp; }
    last.connect(g); g.connect(master); env(g, t, peak, a, dec); o.start(t); o.stop(t + a + dec + 0.05);
  }
  function noise(t, peak, dec, ftype, fq, q) {
    var s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noiseBuf; f.type = ftype; f.frequency.value = fq; f.Q.value = q || 1;
    s.connect(f); f.connect(g); g.connect(master); env(g, t, peak, 0.005, dec);
    s.start(t, Math.random()); s.stop(t + dec + 0.1);
  }
  var SONIDO = {
    nuevas: function (f, v, t) { tone('sine', f, t, 0.22 * v, 0.004, 1.3); tone('sine', f * 2.76, t, 0.06 * v, 0.004, 0.5); },
    apagadas: function (f, v, t) { tone('triangle', f / 4, t, 0.3 * v, 0.03, 0.9, 500); },
    siguen: function (f, v, t) { tone('sine', f / 2, t, 0.1 * v, 0.003, 0.35); tone('sine', f * 2, t, 0.025 * v, 0.003, 0.12); },
    rayos: function (f, v, t) { tone('sine', f / 3, t, 0.3 * v, 0.003, 0.18); noise(t, 0.18 * v, 0.12, 'bandpass', f, 1.5); }
  };
  var lastSound = 0;
  function playColumn(c) {
    if (!ac || !cells.nuevas) return;
    var now = ac.currentTime;
    if (now - lastSound < 0.09) return;
    lastSound = now;
    var focusLat = view.lat;
    CAPAS.forEach(function (k, ki) {
      if (!show[k]) return;
      var list = [], sum = 0;
      for (var r = 0; r < ROWS; r++) {
        var lat = 87.5 - r * 5, v = cells[k][c * ROWS + r];
        // La zona hacia la que miras pesa más (inclinar el globo destaca el norte o el sur)
        v *= 0.35 + 0.65 * Math.max(0, Math.cos((lat - focusLat) * Math.PI / 180));
        sum += v;
        if (v > 0.22) list.push({ lat: lat, v: v });
      }
      list.sort(function (a, b) { return b.v - a.v; });
      list.slice(0, 3).forEach(function (it, j) { SONIDO[k](freqLat(it.lat), Math.min(1, it.v), now + 0.01 + ki * 0.015 + j * 0.045); });
      if (k === 'rayos' && sum > 2.2) noise(now + 0.05, 0.35, 1.6, 'lowpass', 160, 0.7); // trueno
    });
  }

  /* ---------- Vista y giro ---------- */
  var view = { lon: 20, lat: 20 }, target = null, playing = false, lastCol = -1, jumping = false;
  function wrap(lon) { return ((lon + 540) % 360) - 180; }
  function applyView() {
    globe.rotation.order = 'XYZ';
    globe.rotation.y = (-90 - view.lon) * Math.PI / 180;
    globe.rotation.x = view.lat * Math.PI / 180;
    $('g-where').textContent = region(view.lat, view.lon) + ' · ' + fmt(view.lat, view.lon);
  }
  function colOf(lon) { return Math.min(COLS - 1, Math.floor((wrap(lon) + 180) / 5)); }
  function move(dLon, dLat) {
    ensureAudio(); target = null; jumping = false;
    view.lon = wrap(view.lon + dLon);
    view.lat = Math.max(-60, Math.min(70, view.lat + dLat));
  }

  function describe() {
    if (!cells.nuevas) return 'Todavía se están cargando los datos.';
    var c0 = colOf(view.lon), r0 = Math.round((87.5 - view.lat) / 5), tot = {}, n = 0;
    CAPAS.forEach(function (k) { tot[k] = 0; });
    for (var dc = -3; dc <= 3; dc++) for (var dr = -2; dr <= 2; dr++) {
      var r = r0 + dr; if (r < 0 || r >= ROWS) continue;
      var c = (c0 + dc + COLS) % COLS; n++;
      CAPAS.forEach(function (k) { tot[k] += cells[k][c * ROWS + r]; });
    }
    var partes = [];
    CAPAS.forEach(function (k) {
      if (!show[k]) return;
      var m = tot[k] / n, esc = k === 'rayos' ? 0.4 : 1; // los rayos son puntos sueltos: umbral más bajo
      if (m > 0.22 * esc) partes.push('muchas ' + NOMBRE[k].replace('rayos', 'zonas con rayos'));
      else if (m > 0.05 * esc) partes.push('algunas ' + NOMBRE[k].replace('rayos', 'zonas con rayos'));
    });
    var txt = 'Estás sobre ' + region(view.lat, view.lon) + ', ' + fmtVoz(view.lat, view.lon) + '. ';
    if (!partes.length) txt += 'Casi no hay ' + (show.rayos ? 'luces ni rayos.' : 'luces.');
    else {
      var s = partes.join(', ').replace(/, ([^,]*)$/, ' y $1');
      txt += 'Hay ' + s + '.';
    }
    return txt;
  }

  function setPlaying(on) {
    playing = on; if (on) { ensureAudio(); target = null; }
    $('g-play').textContent = on ? '⏸ Parar (F)' : '▶ Dar la vuelta (F)';
    $('g-play').setAttribute('aria-pressed', String(on));
    say(on ? 'Damos la vuelta al mundo de oeste a este. Campanas: luces nuevas. Tono grave: luces apagadas. Más agudo: más al norte.' : 'Parado. ' + describe());
  }
  function jump() {
    ensureAudio(); setPlayingQuiet(false);
    lugar = (lugar + 1) % LUGARES.length;
    var L = LUGARES[lugar];
    if (L.rayos && !show.rayos) setCapa('rayos', true, true);
    target = { lon: L.lon, lat: L.lat }; jumping = true;
    say(L.txt);
  }
  function setPlayingQuiet(on) { playing = on; $('g-play').textContent = '▶ Dar la vuelta (F)'; $('g-play').setAttribute('aria-pressed', 'false'); }

  function setCapa(k, on, quiet) {
    show[k] = on;
    document.querySelector('.capa[data-capa="' + k + '"]').setAttribute('aria-pressed', String(on));
    uniforms.show.value.set(+show.nuevas, +show.apagadas, +show.siguen, +show.rayos);
    if (!quiet) say((on ? 'Capa activada: ' : 'Capa apagada: ') + NOMBRE[k] + '.');
  }

  var HELP = 'Globo de la Tierra de noche. Flechas izquierda y derecha, o D y G: girar. Flechas arriba y abajo: norte y sur. ' +
    'F: dar la vuelta al mundo. J: qué hay aquí. K: ir a un lugar. 1 a 4: capas de luces nuevas, apagadas, que siguen y rayos. A: voz guía.';

  /* ---------- Entrada ---------- */
  document.querySelectorAll('.capa').forEach(function (b) {
    b.addEventListener('click', function () { ensureAudio(); var k = b.getAttribute('data-capa'); setCapa(k, !show[k]); });
  });
  $('g-play').addEventListener('click', function () { setPlaying(!playing); });
  $('g-what').addEventListener('click', function () { ensureAudio(); lastCol = -1; say(describe()); });
  $('g-jump').addEventListener('click', jump);
  $('g-voice').addEventListener('click', function () { setVoice(!voiceOn); });

  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var k = e.key, step = e.shiftKey ? 45 : 15;
    var handled = true;
    if (k === 'ArrowLeft' || k === 'd' || k === 'D') move(-step, 0);
    else if (k === 'ArrowRight' || k === 'g' || k === 'G') move(step, 0);
    else if (k === 'ArrowUp') move(0, 10);
    else if (k === 'ArrowDown') move(0, -10);
    else if (k === 'f' || k === 'F') setPlaying(!playing);
    else if (k === 'j' || k === 'J') { ensureAudio(); lastCol = -1; say(describe()); }
    else if (k === 'k' || k === 'K') jump();
    else if (k === 'a' || k === 'A') setVoice(!voiceOn);
    else if (k === 'h' || k === 'H') say(HELP);
    else if (k >= '1' && k <= '4') { ensureAudio(); var c = CAPAS[+k - 1]; setCapa(c, !show[c]); }
    else if (k === 'Escape') { setPlayingQuiet(false); target = null; if (synth) synth.cancel(); }
    else handled = false;
    if (handled) e.preventDefault();
    if (/^Arrow/.test(k) || /^[dgDG]$/.test(k)) { if (playing) setPlayingQuiet(false); $('g-status').textContent = region(view.lat, view.lon) + ' · ' + fmt(view.lat, view.lon); }
  });

  var drag = null;
  canvas.addEventListener('pointerdown', function (e) {
    ensureAudio(); drag = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId);
    if (playing) setPlayingQuiet(false);
  });
  canvas.addEventListener('pointermove', function (e) {
    if (!drag) return;
    var k = 160 / Math.max(200, Math.min(canvas.clientWidth, canvas.clientHeight));
    move(-(e.clientX - drag.x) * k, (e.clientY - drag.y) * k);
    drag = { x: e.clientX, y: e.clientY };
  });
  function endDrag() { if (drag) { drag = null; $('g-status').textContent = region(view.lat, view.lon) + ' · ' + fmt(view.lat, view.lon); } }
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  /* ---------- Bucle ---------- */
  var prevT = performance.now();
  function frame(t) {
    var dt = Math.min(0.1, (t - prevT) / 1000); prevT = t;
    if (playing) view.lon = wrap(view.lon + 9 * dt);             // una vuelta en 40 s
    else if (target) {
      var dl = wrap(target.lon - view.lon), dla = target.lat - view.lat, e = reduced ? 1 : Math.min(1, dt * 3.5);
      view.lon = wrap(view.lon + dl * e); view.lat += dla * e;
      if (Math.abs(dl) < 0.3 && Math.abs(dla) < 0.3) { view.lon = target.lon; view.lat = target.lat; target = null; jumping = false; lastCol = -1; }
    }
    applyView();
    var c = colOf(view.lon);
    if (c !== lastCol) { lastCol = c; if (!jumping) playColumn(c); }
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }

  /* ---------- Carga ---------- */
  var loader = new THREE.TextureLoader(), pending = 2, texL, texR;
  function done() {
    if (--pending) return;
    try { buildCells(texL.image, texR.image); }
    catch (e) { fail('No se pudieron leer los píxeles de las imágenes. Abre la página con el servidor local.'); return; }
    uniforms.tLuces.value = texL; uniforms.tRayos.value = texR;
    applyView();
    $('g-status').textContent = 'Listo. Arrastra el globo o usa las flechas. H: ayuda.';
  }
  function prep(tx) {
    tx.minFilter = THREE.LinearFilter; tx.generateMipmaps = false;
    tx.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return tx;
  }
  texL = loader.load('assets/luces.jpg', function (tx) { prep(tx); done(); }, undefined, function () { fail('No se encontró assets/luces.jpg.'); });
  texR = loader.load('assets/rayos.jpg', function (tx) { prep(tx); done(); }, undefined, function () { fail('No se encontró assets/rayos.jpg.'); });

  resize(); applyView(); requestAnimationFrame(frame);
})();
