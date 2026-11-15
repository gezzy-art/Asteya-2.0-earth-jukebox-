/* Escucha cualquier imagen de la NASA: sonificación en tiempo real de una imagen elegida o subida.
 *
 * El navegador lee los píxeles en una cuadrícula de 48 columnas × 12 filas. Para cada celda calcula:
 *   - presencia: cuánto destaca del fondo (brillo o color por encima de la mediana de la imagen), de 0 a 1;
 *   - color dominante: el tono medio de sus píxeles con color.
 * Una línea recorre la imagen de izquierda a derecha, una columna cada ~0,22 s:
 *   - fila = nota de una escala pentatónica (más arriba = más agudo);
 *   - presencia = volumen (lo que no destaca no suena);
 *   - color = instrumento (cálidos: campana · verdes: marimba · fríos: tono suave · gris o blanco: arpa);
 *   - acorde de fondo: mayor si en esa columna domina lo cálido, menor si domina lo frío.
 * Usa la voz y los avisos del jukebox (EIJ.jukebox, en js/jukebox.js). */
(function () {
  'use strict';
  const EIJ = window.EIJ, J = EIJ.jukebox;
  const $ = (id) => document.getElementById(id);
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  const COLS = 48, ROWS = 12, STEP = 0.22, MIN_P = 0.3;
  // Do mayor pentatónica desde Do4: 12 notas, una por fila (fila 0 = arriba = la más aguda)
  const PENTA = [0, 2, 4, 7, 9];
  const noteHz = (k) => 261.63 * Math.pow(2, (Math.floor(k / 5) * 12 + PENTA[k % 5]) / 12);
  const rowHz = (r) => noteHz(ROWS - 1 - r);
  const CHORD = { mayor: [130.81, 164.81, 196.0], menor: [110.0, 130.81, 164.81] };

  const GALLERY = [
    { src: 'assets/eic/temperatura-2025.png', name: 'la temperatura global de 2025',
      alt: 'Mapa de la NASA del cambio de temperatura en 2025: casi todo el planeta en tonos naranjas y rojos.' },
    { src: 'assets/eic/hielo-1979.jpg', name: 'el hielo del Ártico en 1979',
      alt: 'El hielo del Ártico visto desde satélite en septiembre de 1979: cubre gran parte del océano.' },
    { src: 'assets/eic/hielo-2012.jpg', name: 'el hielo del Ártico en 2012',
      alt: 'El hielo del Ártico visto desde satélite en septiembre de 2012, el mínimo récord: cubre mucho menos que en 1979.' },
    { src: 'assets/eic/corrientes-oceanicas.jpg', name: 'las corrientes del océano',
      alt: 'Mapa de las corrientes del océano coloreadas por temperatura: rojas y naranjas en el ecuador, azules cerca de los polos.' },
    { src: 'assets/eic/co2-dyamond.jpg', name: 'el CO₂ en la atmósfera',
      alt: 'Simulación de la NASA del CO₂ en la atmósfera sobre Asia y Oceanía, con nubes moradas, rojas y amarillas.' },
    { src: 'assets/eic/luces-nocturnas-cambio.jpg', name: 'el cambio en las luces nocturnas',
      alt: 'Mapa nocturno de la Tierra: puntos morados donde aparecieron luces nuevas, sobre todo en Asia, y naranjas donde se apagaron, sobre todo en Europa.' },
    { src: 'assets/eic/rayos-iss-2023.jpg', name: 'los rayos vistos desde el espacio',
      alt: 'Mapa de la Tierra con puntos amarillos donde se detectaron rayos, concentrados en Sudamérica, África central y el sudeste asiático.' }
  ];

  const LEGEND = 'Una línea recorre la imagen de izquierda a derecha. Más arriba, más agudo. Más color o brillo, más fuerte; ' +
    'el fondo no suena. Rojo, naranja y amarillo suenan como campanas; verde, como marimba; azul y morado, como un tono suave; ' +
    'gris o blanco, como arpa. El acorde de fondo es mayor si domina lo cálido y menor si domina lo frío.';

  const img = $('ixImg'), stage = $('ixStage'), cv = $('ixScan'), seek = $('ixSeek');
  let active = false, grid = null, name = '', alt = '', pick = -1;
  let playing = false, col = 0, row = -1, timer = 0, hoverKey = '';

  // ---------- Análisis de la imagen ----------
  function hueOf(r, g, b) {
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    if (!d) return 0;
    let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60; return h < 0 ? h + 360 : h;
  }
  function family(c) {
    if (c.chroma < 0.12) return 'neutro';
    const h = c.hue;
    if (h < 70 || h >= 330) return 'calido';
    if (h < 170) return 'verde';
    return 'frio';
  }
  function colorName(c) {
    if (c.chroma < 0.12) return c.lum > 0.7 ? 'blanco' : c.lum < 0.15 ? 'negro' : 'gris';
    const h = c.hue;
    return h < 15 || h >= 345 ? 'rojo' : h < 40 ? 'naranja' : h < 70 ? 'amarillo' : h < 170 ? 'verde'
      : h < 200 ? 'celeste' : h < 255 ? 'azul' : h < 300 ? 'morado' : 'rosa';
  }

  function analyze(im) {
    const W = Math.min(960, im.naturalWidth), H = Math.max(ROWS, Math.round(im.naturalHeight * W / im.naturalWidth));
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(im, 0, 0, W, H);
    let d;
    try { d = x.getImageData(0, 0, W, H).data; } catch (e) { return null; }   // página abierta con doble clic
    const N = COLS * ROWS;
    const L = new Float64Array(N), C = new Float64Array(N), n = new Float64Array(N);
    const R = new Float64Array(N), G = new Float64Array(N), B = new Float64Array(N), Wt = new Float64Array(N);
    for (let py = 0; py < H; py++) {
      const ri = Math.floor(py * ROWS / H);
      for (let px = 0; px < W; px++) {
        const p = (py * W + px) * 4, k = Math.floor(px * COLS / W) * ROWS + ri;
        const r = d[p], g = d[p + 1], b = d[p + 2];
        const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255, chroma = (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
        L[k] += lum; C[k] += chroma; n[k]++;
        // El color de la celda lo deciden sus píxeles con más color y brillo, no el fondo
        const w = chroma * chroma + 0.02 * lum;
        R[k] += r * w; G[k] += g * w; B[k] += b * w; Wt[k] += w;
      }
    }
    const lum = [], chr = [];
    for (let k = 0; k < N; k++) { lum.push(L[k] / (n[k] || 1)); chr.push(C[k] / (n[k] || 1)); }
    // Fondo = mediana; tope = percentil 95 (así un solo punto muy brillante no apaga el resto)
    const scale = (arr) => {
      const s = arr.slice().sort((a, b) => a - b), bg = s[Math.floor(s.length / 2)], top = s[Math.floor(s.length * 0.95)];
      return (v) => clamp((v - bg) / ((top - bg) || 1), 0, 1);
    };
    const sl = scale(lum), sc = scale(chr);
    const cells = [];
    for (let k = 0; k < N; k++) {
      const w = Wt[k] || 1, r = R[k] / w, g = G[k] / w, b = B[k] / w;
      const cell = { p: Math.max(sl(lum[k]), sc(chr[k])), lum: lum[k], hue: hueOf(r, g, b),
        chroma: Wt[k] ? (Math.max(r, g, b) - Math.min(r, g, b)) / 255 : 0, rgb: [r, g, b].map(Math.round) };
      cell.fam = family(cell); cell.name = colorName(cell);
      cells.push(cell);
    }
    return cells;
  }
  const cellAt = (c, r) => grid[c * ROWS + r];

  // ---------- Sonido (Web Audio, en tiempo real) ----------
  let ctx = null, out = null, padGain = null, padOsc = [];
  function audio() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return ctx; }
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    const comp = ctx.createDynamicsCompressor();
    out = ctx.createGain(); out.gain.value = 0.9;
    // Un eco suave para que suene a espacio y no a pitido
    const delay = ctx.createDelay(1), fb = ctx.createGain(), wet = ctx.createGain();
    delay.delayTime.value = 0.27; fb.gain.value = 0.3; wet.gain.value = 0.22;
    out.connect(comp); out.connect(delay); delay.connect(fb); fb.connect(delay); delay.connect(wet); wet.connect(comp);
    comp.connect(ctx.destination);
    // Acorde de fondo: tres osciladores que cambian de mayor a menor
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700;
    padGain = ctx.createGain(); padGain.gain.value = 0;
    lp.connect(padGain); padGain.connect(comp);
    padOsc = CHORD.mayor.map((f) => { const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f; o.connect(lp); o.start(); return o; });
    return ctx;
  }
  function env(g, t, vol, attack, decay) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }
  function tone(freq, t, vol, type, attack, decay, dest) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = freq; o.connect(g); g.connect(dest || out);
    env(g, t, vol, attack, decay); o.start(t); o.stop(t + attack + decay + 0.05);
  }
  // Un instrumento por familia de color
  function note(fam, freq, t, vol) {
    if (fam === 'calido') {          // campana: fundamental + parcial inarmónico
      tone(freq, t, vol, 'sine', 0.005, 1.4); tone(freq * 2.76, t, vol * 0.35, 'sine', 0.005, 0.6);
    } else if (fam === 'verde') {    // marimba: golpe corto de madera
      tone(freq, t, vol * 1.1, 'sine', 0.003, 0.4); tone(freq * 4, t, vol * 0.2, 'sine', 0.002, 0.08);
    } else if (fam === 'frio') {     // tono suave: entra despacio y filtrado
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = freq * 3; lp.connect(out);
      tone(freq, t, vol * 0.9, 'triangle', 0.06, 0.9, lp);
    } else {                         // arpa: cuerda pulsada
      tone(freq, t, vol, 'triangle', 0.004, 0.7);
    }
  }
  function playColumn(c, t) {
    audio(); t = t || ctx.currentTime + 0.02;
    const cells = [];
    let warm = 0, cool = 0, sum = 0;
    for (let r = 0; r < ROWS; r++) {
      const cell = cellAt(c, r); sum += cell.p;
      if (cell.fam === 'calido') warm += cell.p; else if (cell.fam === 'frio') cool += cell.p;
      if (cell.p >= MIN_P) cells.push([r, cell]);
    }
    cells.sort((a, b) => b[1].p - a[1].p).slice(0, 3).forEach(([r, cell], k) => {
      note(cell.fam, rowHz(r), t + k * 0.035, 0.05 + 0.22 * cell.p);
    });
    // Acorde de fondo: sigue la mezcla de colores de la columna
    const mode = warm >= cool ? 'mayor' : 'menor';
    padOsc.forEach((o, i) => o.frequency.setTargetAtTime(CHORD[mode][i], t, 0.08));
    padGain.gain.setTargetAtTime(0.012 + 0.05 * (sum / ROWS), t, 0.1);
    return cells.length;
  }
  function playCell(c, r) {
    audio();
    const cell = cellAt(c, r), t = ctx.currentTime + 0.01;
    if (cell.p >= MIN_P) note(cell.fam, rowHz(r), t, 0.06 + 0.24 * cell.p);
    else tone(70, t, 0.05, 'sine', 0.004, 0.12);   // fondo: un golpe sordo
  }
  function padOff() { if (padGain) padGain.gain.setTargetAtTime(0, ctx.currentTime, 0.15); }

  // ---------- Dibujo: línea, celda y lectura ----------
  // Rectángulo que ocupa la imagen dentro del escenario (object-fit: contain)
  function imgRect(w, h) {
    const ar = (img.naturalWidth || 16) / (img.naturalHeight || 9);
    let iw = w, ih = w / ar;
    if (ih > h) { ih = h; iw = h * ar; }
    return { x: (w - iw) / 2, y: (h - ih) / 2, w: iw, h: ih };
  }
  function draw() {
    const r = cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
    const g = cv.getContext('2d'); g.clearRect(0, 0, cv.width, cv.height);
    if (!grid) return;
    const R = imgRect(cv.width, cv.height), cw = R.w / COLS, x = R.x + (col + 0.5) * cw;
    if (playing) { g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(R.x, R.y, x - R.x, R.h); }
    // Las celdas que suenan en esta columna
    for (let rr = 0; rr < ROWS; rr++) {
      const cell = cellAt(col, rr);
      if (cell.p < MIN_P && rr !== row) continue;
      g.strokeStyle = rr === row ? '#fff' : `rgba(255,255,255,${0.25 + 0.6 * cell.p})`;
      g.lineWidth = (rr === row ? 2 : 1) * dpr;
      g.strokeRect(R.x + col * cw + 0.5, R.y + rr * R.h / ROWS + 0.5, cw - 1, R.h / ROWS - 1);
    }
    g.shadowColor = '#F4A3CB'; g.shadowBlur = 12 * dpr; g.fillStyle = '#fff';
    g.fillRect(x - dpr, R.y, 2 * dpr, R.h); g.shadowBlur = 0;
  }
  const pct = (c) => Math.round((c + 0.5) / COLS * 100);
  function colColors(c) {
    const by = {};
    for (let r = 0; r < ROWS; r++) { const cell = cellAt(c, r); if (cell.p >= MIN_P) by[cell.name] = (by[cell.name] || 0) + cell.p; }
    return Object.keys(by).sort((a, b) => by[b] - by[a]).slice(0, 2);
  }
  function readout(text) { const el = $('ixReadout'); el.hidden = false; el.textContent = text; }
  function updatePos() {
    seek.value = String(col);
    $('ixPos').textContent = pct(col) + '%';
    const cs = colColors(col);
    seek.setAttribute('aria-valuetext', `${pct(col)} por ciento del ancho` + (cs.length ? `, ${cs.join(' y ')}` : ', fondo'));
    readout(`${pct(col)}% · ${cs.length ? cs.join(', ') : 'fondo'}`);
  }

  // ---------- Recorrido ----------
  function setPlayUi() {
    const b = $('ixPlay');
    b.dataset.playing = String(playing);
    $('ixPlayIcon').textContent = playing ? '❚❚' : '▶';
    b.setAttribute('aria-label', playing ? 'Pausar (barra espaciadora)' : 'Escuchar la imagen (barra espaciadora)');
  }
  function tick() {
    if (!playing) return;
    playColumn(col); updatePos(); draw();
    if (col >= COLS - 1) { timer = setTimeout(finish, 900); return; }
    col++;
    timer = setTimeout(tick, STEP * 1000);
  }
  function play() {
    if (!grid) { J.announce('Primero elige una imagen: pulsa un número del 1 al 7 o sube la tuya.'); return; }
    audio();
    if (col >= COLS - 1) col = 0;
    playing = true; row = -1; setPlayUi();
    const first = col === 0;
    $('ixCaption').textContent = `Escuchando ${name}. ` + (first ? 'La línea va de izquierda a derecha.' : '');
    if (first) J.announce(`Escuchando ${name}. ${LEGEND}`, { then: () => { if (playing) tick(); } });
    else tick();
  }
  function stop(silent) {
    clearTimeout(timer);
    const was = playing; playing = false; setPlayUi(); padOff(); draw();
    if (was && !silent) $('ixCaption').textContent = `En pausa en el ${pct(col)} % de la imagen. Pulsa ▶ para seguir.`;
  }
  function toggle() { if (playing) stop(); else play(); }
  function summary() {
    // Columna y fila con más presencia; colores principales y cuánto de la imagen destaca
    let best = 0, bestSum = -1, lit = 0;
    const by = {};
    for (let c = 0; c < COLS; c++) {
      let s = 0;
      for (let r = 0; r < ROWS; r++) {
        const cell = cellAt(c, r); s += cell.p;
        if (cell.p >= MIN_P) { lit++; by[cell.name] = (by[cell.name] || 0) + cell.p; }
      }
      if (s > bestSum) { bestSum = s; best = c; }
    }
    let br = 0; for (let r = 1; r < ROWS; r++) if (cellAt(best, r).p > cellAt(best, br).p) br = r;
    const h = best < COLS / 3 ? 'a la izquierda' : best < 2 * COLS / 3 ? 'en el centro' : 'a la derecha';
    const v = br < ROWS / 3 ? 'arriba' : br < 2 * ROWS / 3 ? 'a media altura' : 'abajo';
    const cols = Object.keys(by).sort((a, b) => by[b] - by[a]).slice(0, 3);
    return `Lo que más suena está ${h}, ${v}, al ${pct(best)} % del ancho. ` +
      (cols.length ? `Colores principales: ${cols.join(', ')}. ` : '') +
      `Destaca el ${Math.round(lit / (COLS * ROWS) * 100)} % de la imagen.`;
  }
  function finish() {
    playing = false; setPlayUi(); padOff(); draw();
    const s = summary();
    $('ixCaption').textContent = `Fin. ${s}`;
    J.announce(`Fin. ${s}`);
  }

  // ---------- Cargar una imagen ----------
  function load(src, nm, al, idx) {
    stop(true);
    pick = idx;
    document.querySelectorAll('#ixGallery button').forEach((b, k) => b.setAttribute('aria-pressed', String(k === idx)));
    name = nm; alt = al || `Imagen subida: ${nm}.`;
    $('ixCaption').textContent = `Cargando ${nm}…`;
    const ready = () => {
      const g = analyze(img);
      $('ixEmpty').hidden = true; img.hidden = false;
      if (!g) {
        grid = null; $('ixPlay').disabled = true; seek.disabled = true; draw();
        const msg = 'El navegador no deja leer los colores de esta imagen porque la página se abrió con doble clic. ' +
          'Ábrela con iniciar-servidor.bat, o sube la imagen con el botón «Subir una imagen de la NASA».';
        $('ixCaption').textContent = msg; J.announce(msg);
        return;
      }
      grid = g; col = 0; row = -1;
      $('ixPlay').disabled = false; seek.disabled = false;
      img.alt = alt;
      stage.setAttribute('aria-label', `${alt} Usa las flechas para explorarla y Espacio para escucharla.`);
      updatePos(); draw();
      $('ixCaption').textContent = `${nm.charAt(0).toUpperCase() + nm.slice(1)}. Pulsa ▶ para escucharla, o toca la imagen para oír un punto.`;
      J.announce(`Imagen: ${nm}. ${alt} Pulsa espacio para escucharla.`);
    };
    img.onerror = () => { $('ixCaption').textContent = 'No se pudo abrir la imagen.'; J.announce('No se pudo abrir la imagen.'); };
    if (img.getAttribute('src') === src && img.complete && img.naturalWidth) { img.onload = null; ready(); }
    else { img.onload = ready; img.src = src; }
  }
  function choose(i) {
    i = (i + GALLERY.length) % GALLERY.length;
    const g = GALLERY[i]; load(g.src, g.name, g.alt, i);
  }

  // ---------- Explorar con el dedo, el ratón o las flechas ----------
  function cellFromEvent(e) {
    const r = stage.getBoundingClientRect(), R = imgRect(r.width, r.height);
    const x = (e.clientX - r.left - R.x) / R.w, y = (e.clientY - r.top - R.y) / R.h;
    if (x < 0 || x >= 1 || y < 0 || y >= 1) return null;
    return [Math.floor(x * COLS), Math.floor(y * ROWS)];
  }
  function explore(c, r, speakIt) {
    col = clamp(c, 0, COLS - 1); row = clamp(r, 0, ROWS - 1);
    playCell(col, row); updatePos(); draw();
    const cell = cellAt(col, row);
    readout(`${pct(col)}% · ${cell.p >= MIN_P ? cell.name : 'fondo'}`);
    if (speakIt) describe();
  }
  function describe() {
    if (!grid) { J.announce('Todavía no hay ninguna imagen. Elige una con los números del 1 al 7.'); return; }
    const where = `${pct(col)} % del ancho` + (row >= 0 ? `, ${row < 4 ? 'arriba' : row < 8 ? 'a media altura' : 'abajo'}` : '');
    if (row >= 0) {
      const cell = cellAt(col, row);
      J.announce(`${where}: ${cell.p >= MIN_P ? `${cell.name}, ${cell.p > 0.7 ? 'muy destacado' : 'destacado'}` : 'fondo, no suena'}.`);
    } else {
      const cs = colColors(col);
      J.announce(`${where}: ${cs.length ? `suena ${cs.join(' y ')}` : 'solo fondo'}.`);
    }
  }
  stage.addEventListener('pointermove', (e) => {
    if (!grid || playing || e.pointerType === 'touch' && !e.buttons && e.pressure === 0) return;
    const p = cellFromEvent(e); if (!p) return;
    const key = p.join(','); if (key === hoverKey) return;
    hoverKey = key; explore(p[0], p[1], false);
  });
  stage.addEventListener('pointerdown', (e) => {
    if (!grid) return;
    const p = cellFromEvent(e); if (!p) return;
    if (playing) stop();
    hoverKey = p.join(','); explore(p[0], p[1], false);
  });
  stage.addEventListener('pointerleave', () => { hoverKey = ''; });

  function key(e) {
    const tag = e.target.tagName, k = e.key.toLowerCase();
    if (e.code === 'Space') {
      if (tag === 'BUTTON' || tag === 'A' || tag === 'SUMMARY' || tag === 'INPUT') return;
      e.preventDefault(); if (!e.repeat) toggle();
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      if (!grid) return;
      e.preventDefault(); if (playing) stop();
      const d = (e.key === 'ArrowRight' ? 1 : -1) * (e.shiftKey ? 6 : 1);
      explore(col + d, row < 0 ? 0 : row, false);
      if (row >= 0) { row = -1; playColumn(col); draw(); }   // las flechas laterales suenan la columna entera
      describe();
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      if (!grid) return;
      e.preventDefault(); if (playing) stop();
      explore(col, (row < 0 ? (e.key === 'ArrowUp' ? ROWS : -1) : row) + (e.key === 'ArrowUp' ? -1 : 1), true);
    } else if (/^[1-7]$/.test(e.key)) choose(+e.key - 1);
    else if (k === 'd') describe();
    else if (k === 'i') J.announce(LEGEND);
    else if (e.key === 'Home') { e.preventDefault(); stop(true); col = 0; row = -1; updatePos(); draw(); J.announce('Al principio de la imagen.'); }
    else if (e.key === 'Escape') stop();
  }

  // ---------- Modos ----------
  function setMode(img) {
    active = img;
    $('panelCol').hidden = img; $('panelImg').hidden = !img;
    $('modeCol').setAttribute('aria-current', img ? 'false' : 'page');
    $('modeImg').setAttribute('aria-current', img ? 'page' : 'false');
    try { history.replaceState(null, '', img ? '#imagen' : location.pathname + location.search); } catch (e) { /* file:// */ }
  }
  function open() {
    if (active) return;
    J.pause(); setMode(true);
    if (!grid && pick < 0) choose(0);
    else { draw(); J.announce('Escucha una imagen de la NASA. Espacio para escuchar, números del 1 al 7 para cambiar de imagen.'); }
  }
  function close() {
    if (!active) return;
    stop(true); setMode(false);
    window.dispatchEvent(new Event('resize'));   // el jukebox vuelve a dibujar su gráfica
    J.announce('La colección. Pulsa espacio para escuchar la pista.');
  }

  // Órdenes por voz en este modo (desde js/jukebox.js). Devuelve false si no la reconoce.
  const NUM = { uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7 };
  function voice(txt, w) {
    const has = (...xs) => xs.some((x) => w.includes(x));
    if (/que suena|que hay|donde estoy|que es esto/.test(txt)) { describe(); return true; }
    if (has('explica', 'explicame', 'repite')) { J.announce(LEGEND); return true; }
    const m = txt.match(/\b(\d+|uno|dos|tres|cuatro|cinco|seis|siete)\b/);
    const n = m ? (+m[1] || NUM[m[1]] || 0) : 0;
    if (n >= 1 && n <= GALLERY.length) { choose(n - 1); return true; }
    if (/principio|reinicia|de nuevo|otra vez/.test(txt)) { stop(true); col = 0; play(); return true; }
    if (has('siguiente', 'proxima', 'otra')) { choose(pick + 1); return true; }
    if (has('anterior', 'previa')) { choose(pick - 1); return true; }
    if (has('pausa', 'pausar', 'parar', 'para', 'detente', 'alto', 'silencio', 'stop')) { stop(); return true; }
    if (has('reproducir', 'reproduce', 'play', 'escuchar', 'escucha', 'toca', 'empieza', 'sigue', 'dale')) { play(); return true; }
    return false;
  }
  // Botones del control en este modo. Devuelve false si el botón no se usa aquí.
  function pad(i) {
    switch (i) {
      case 0: toggle(); return true;
      case 1: describe(); return true;
      case 2: J.announce(LEGEND); return true;
      case 12: case 13: if (grid) { if (playing) stop(); explore(col + (i === 12 ? 1 : -1), 0, false); row = -1; playColumn(col); draw(); describe(); } return true;
      case 14: choose(pick - 1); return true;
      case 15: choose(pick + 1); return true;
      case 8: if (grid) { stop(true); col = 0; row = -1; updatePos(); draw(); } return true;
      default: return false;
    }
  }

  // ---------- Controles ----------
  const ul = $('ixGallery');
  GALLERY.forEach((g, i) => {
    const li = document.createElement('li');
    li.innerHTML = `<button type="button" aria-pressed="false" aria-label="${i + 1}: ${g.name}" title="${g.name} (tecla ${i + 1})"><img src="${g.src}" alt=""></button>`;
    li.firstChild.addEventListener('click', () => choose(i));
    ul.appendChild(li);
  });
  $('ixPlay').addEventListener('click', toggle);
  seek.addEventListener('input', () => { if (playing) stop(); col = +seek.value; row = -1; playColumn(col); updatePos(); draw(); });
  $('ixFile').addEventListener('change', (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    // Como data: URL, para poder leer los píxeles también con la página abierta con doble clic
    const rd = new FileReader();
    rd.onload = () => load(rd.result, `tu imagen «${f.name.replace(/\.[^.]+$/, '')}»`, null, -1);
    rd.readAsDataURL(f);
    e.target.value = '';
  });
  $('modeImg').addEventListener('click', open);
  $('modeCol').addEventListener('click', close);
  window.addEventListener('resize', () => { if (active) draw(); });

  EIJ.imagen = { active: () => active, open, close, toggleMode: () => (active ? close() : open()), key, voice, pad };

  if (location.hash === '#imagen') open();
  window.addEventListener('hashchange', () => { if (location.hash === '#imagen') open(); });
})();
