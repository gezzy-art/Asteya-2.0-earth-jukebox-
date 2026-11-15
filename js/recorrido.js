/* Recorrido guiado (index.html): navegación general y un bloque por capítulo. */

/* ======================================================================
   recorrido
   ====================================================================== */
/* Recorrido guiado · Capítulo 1 "El planeta se calienta".
 * Sonifica la anomalía anual de temperatura global (GISTEMP v4) año por año, con subtítulos
 * en lenguaje sencillo que explican lo que se escucha, y un comparador "antes / ahora". */
(function () {
  'use strict';
  const EIJ = window.EIJ;
  const { clamp, $ } = EIJ;
  const G = EIJ.GISTEMP;
  const N = G.anomalies.length;
  const lastYear = G.firstYear + N - 1;
  const lut = EIJ.TRACKS[0].lut;   // paleta azul → blanco → rojo

  // Arpa: notas cortas y claras, se distinguen bien una a una
  EIJ.state.inst = 2;

  const MIN = -0.6, MAX = 1.4;
  const norm = (a) => clamp((a - MIN) / (MAX - MIN), 0, 1);
  const colorK = (a) => clamp(0.5 + a / 2.4, 0, 1);
  const yearOf = (i) => G.firstYear + i;
  const maxA = Math.max(...G.anomalies);
  const maxIdx = G.anomalies.indexOf(maxA);
  const firstIdx = (pred) => G.anomalies.findIndex(pred);
  const fmtTemp = (a) => `${a >= 0 ? '+' : '−'}${Math.abs(a).toFixed(2)} °C`;
  const plainTemp = (a) => (Math.abs(a) < 0.05 ? 'temperatura normal'
    : a > 0 ? `${fmtTemp(a)} más caliente de lo normal` : `${fmtTemp(a)}, más fresco de lo normal`);

  // ---------- Subtítulos: qué decir y cuándo (se calculan a partir de los datos) ----------
  const CAPTIONS = new Map();
  CAPTIONS.set(0, `${G.firstYear}. Así sonaba la Tierra: notas graves y tranquilas. Es nuestro punto de partida.`);
  CAPTIONS.set(1910 - G.firstYear, 'Durante décadas el sonido casi no cambia: el clima era estable.');
  CAPTIONS.set(1950 - G.firstYear, '1950. Todavía estable. Recuerda esta altura de nota… a partir de aquí empieza el cambio.');
  const i03 = firstIdx((a) => a >= 0.3);
  const i05 = firstIdx((a) => a >= 0.5);
  const i08 = firstIdx((a) => a >= 0.8);
  if (i03 > 0) CAPTIONS.set(i03, `${yearOf(i03)}. Las notas empiezan a subir… y cada vez bajan menos.`);
  if (i05 > 0) CAPTIONS.set(i05, `¿Notas que la música se vuelve más triste? ${yearOf(i05)} ya pasa del medio grado extra.`);
  if (i08 > 0) CAPTIONS.set(i08, `Ese tic-tic es una alarma: ${yearOf(i08)} supera 0.8 °C extra. Fíjate cómo los años pasan cada vez más rápido.`);
  CAPTIONS.set(maxIdx, `${yearOf(maxIdx)}: el año más caliente jamás medido. ${fmtTemp(maxA)}.`);

  // ---------- Dibujo: franjas de calentamiento ----------
  function paintStripes(canvas, upTo, marker) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height, sw = W / N;
    ctx.fillStyle = '#05070f';
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < N; i++) {
      const k = (colorK(G.anomalies[i]) * 255) | 0;
      ctx.globalAlpha = i < upTo ? 1 : 0.1;
      ctx.fillStyle = `rgb(${lut[k * 3]},${lut[k * 3 + 1]},${lut[k * 3 + 2]})`;
      ctx.fillRect(Math.floor(i * sw), 0, Math.ceil(sw) + 1, H);
    }
    ctx.globalAlpha = 1;
    if (marker !== null && marker !== undefined) {
      const x = (marker + 0.5) * sw;
      ctx.fillStyle = 'rgba(255,255,255,.9)';
      ctx.fillRect(x - 1.5, 0, 3, H);
    }
  }

  function fitCanvas(canvas) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(canvas.clientWidth * dpr);
    canvas.height = Math.round(canvas.clientHeight * dpr);
  }

  // ---------- Portada ----------
  const portadaCanvas = $('portadaStripes');
  function drawPortada() { fitCanvas(portadaCanvas); paintStripes(portadaCanvas, N, null); }

  // ---------- Capítulo 1 ----------
  const stripes = $('stripes');
  const st = { playing: false, index: 0, revealed: N, timer: null, cmp: null };

  function showYear(i) {
    const a = G.anomalies[i];
    $('yearOut').textContent = yearOf(i);
    const t = $('tempOut');
    t.textContent = plainTemp(a);
    t.style.color = a >= 0.05 ? '#fdba74' : a <= -0.05 ? '#93c5fd' : '#e2e8f0';
  }

  function render(marker) { paintStripes(stripes, st.revealed, marker); }

  function caption(text) { $('caption').textContent = text; }

  // Vibración en Android: level 0..1 (más intenso = vibración más larga)
  function vibrate(level) {
    if (typeof navigator.vibrate !== 'function') return;
    // El navegador solo permite vibrar después de que la persona tocó la página
    if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
    try { navigator.vibrate(Math.round(12 + clamp(level, 0, 1) * 45)); } catch (e) { /* sin permiso */ }
  }

  function step() {
    if (!st.playing) return;
    const i = st.index;
    const a = G.anomalies[i];
    st.revealed = i + 1;
    showYear(i);
    render(i);
    EIJ.audio.yearNote(a, norm(a), i);
    vibrate(norm(a));
    if (CAPTIONS.has(i)) caption(CAPTIONS.get(i));
    if (i >= N - 1) { finish(); return; }
    st.index = i + 1;
    // Cuanto más calor, más rápido pasan los años (de ~380 ms a ~190 ms)
    st.timer = setTimeout(step, 380 - 190 * norm(a));
  }

  function setPlayButton() {
    const b = $('playBtn');
    b.setAttribute('aria-pressed', String(st.playing));
    b.textContent = st.playing ? '■ Detener' : (st.done ? '↺ Escuchar otra vez' : `▶ Escuchar ${G.firstYear} → ${lastYear}`);
  }

  async function play() {
    if (!EIJ.audio.available) { caption('No se pudo cargar el audio. Revisa tu conexión a internet y recarga la página.'); return; }
    try { await EIJ.audio.ensure(); } catch (e) { caption('El navegador bloqueó el sonido. Pulsa “Escuchar” otra vez.'); return; }
    stopCompare();
    st.playing = true;
    st.index = 0;
    st.revealed = 0;
    setPlayButton();
    showYear(0);
    render(null);
    caption('Escucha. Cada nota es un año…');
    // En modo accesible, primero el narrador dice qué capítulo vas a escuchar
    announceStart(1, () => { if (st.playing) st.timer = setTimeout(step, 1600); });
  }

  function stop(silent) {
    clearTimeout(st.timer);
    if (!st.playing) return;
    hush();
    st.playing = false;
    st.revealed = N;
    setPlayButton();
    render(st.index);
    if (!silent) caption(`Detenido en ${yearOf(st.index)}. Pulsa “Escuchar” para empezar de nuevo.`);
  }

  function finish() {
    st.playing = false;
    st.done = true;
    st.revealed = N;
    setPlayButton();
    render(N - 1);
    const rise = (G.anomalies[N - 1] - G.anomalies[0]).toFixed(1);
    caption(`En ${N} años la Tierra se calentó unos ${rise} °C… y lo acabas de escuchar. Ahora compara un año de antes con uno de ahora.`);
    $('compare').classList.remove('hidden');
    announceEnd(1);
  }

  // ---------- Escucha la diferencia ----------
  // Un motivo corto de 6 notas con la altura, la armonía, el tempo y la alarma de ese año.
  function stopCompare() {
    clearTimeout(st.cmpTimer);
    st.cmp = null;
    ['cmpOld', 'cmpNew'].forEach((id) => $(id).setAttribute('aria-pressed', 'false'));
  }

  async function playYearMotif(i, btnId, description) {
    if (st.playing) stop();
    try { await EIJ.audio.ensure(); } catch (e) { return; }
    stopCompare();
    st.cmp = i;
    $(btnId).setAttribute('aria-pressed', 'true');
    const a = G.anomalies[i], t = norm(a);
    const contour = [0, 0.05, 0.1, 0.05, 0, -0.04];
    const gap = 380 - 190 * t;
    showYear(i);
    render(i);
    caption(`${yearOf(i)}: ${plainTemp(a)}. ${description}`);
    let k = 0;
    const tick = () => {
      if (st.cmp !== i) return;
      EIJ.audio.yearNote(a, clamp(t + contour[k], 0, 1), k);
      vibrate(norm(a));
      if (++k < contour.length) st.cmpTimer = setTimeout(tick, gap);
      else $(btnId).setAttribute('aria-pressed', 'false');
    };
    tick();
  }

  // ---------- Navegación entre pantallas ----------
  // Cada capítulo registra cómo detenerse al salir (EIJ.tour.onLeave).
  const onLeave = [() => { stop(true); stopCompare(); }];

  // ---------- Narrador (solo en modo accesible) ----------
  // Al empezar cada capítulo dice cuál vas a escuchar y al terminar cuál acabas de escuchar.
  // Se escribe en español; js/i18n.js lo traduce y elige una voz inglesa si la página está en inglés.
  // "then" se ejecuta cuando la voz termina (o enseguida si no hay voz): así el sonido no se pisa con ella.
  const CHAPS = [
    { id: 1, name: 'El planeta se calienta' },
    { id: 3, name: 'El océano mueve el calor', accent: ' is-sea' },
    { id: 4, name: 'La causa', accent: ' is-co2' },
    { id: 5, name: 'Las luces de la noche' }
  ];
  const synth = window.speechSynthesis;
  let sayGen = 0;
  function narrate(text, then) {
    const gen = ++sayGen;
    const go = () => { if (gen === sayGen && then) { const f = then; then = null; f(); } };
    if (!(EIJ.a11y && EIJ.a11y.on) || !synth || !window.SpeechSynthesisUtterance) { go(); return; }
    synth.cancel();
    // En inglés se traduce la frase entera antes de partirla (partida, ya no coincide con el diccionario)
    if (EIJ.i18n && EIJ.i18n.lang === 'en') text = EIJ.i18n.speech(text);
    const v = EIJ.voz && EIJ.voz.pick ? EIJ.voz.pick() : null;
    const parts = text.split(/(?<=[.?:])\s+/).filter(Boolean);
    const guard = setTimeout(go, 4000 + text.length * 90);   // por si el navegador nunca avisa del final
    parts.forEach((p, k) => {
      const u = new SpeechSynthesisUtterance(p);
      u.lang = v ? v.lang : 'es-ES'; if (v) u.voice = v;
      u.rate = EIJ.voz ? EIJ.voz.rate : 1; u.pitch = EIJ.voz ? EIJ.voz.pitch : 1;
      if (k === parts.length - 1) u.onend = u.onerror = () => { clearTimeout(guard); go(); };
      synth.speak(u);
    });
  }
  function hush() { sayGen++; if (synth && EIJ.a11y && EIJ.a11y.on) synth.cancel(); }
  const chapName = (id) => {
    const k = CHAPS.findIndex((c) => c.id === id);
    return `el capítulo ${k + 1} de ${CHAPS.length}: ${CHAPS[k].name}`;
  };
  const announceStart = (id, then) => narrate(`Vas a escuchar ${chapName(id)}.`, then);
  const announceEnd = (id) => narrate(`Acabas de escuchar ${chapName(id)}.`);

  function goTo(id) {
    hush();
    onLeave.forEach((fn) => fn());
    document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('hidden', s.id !== id));
    window.scrollTo(0, 0);
    const title = document.querySelector(`#${id} h2[tabindex="-1"]`);
    if (title) title.focus();
  }
  EIJ.tour = { goTo, onLeave, vibrate, fitCanvas, CHAPS, hush, announceStart, announceEnd };

  function enterChapter() {
    goTo('cap1');
    fitCanvas(stripes);
    showYear(0);
    render(null);
    play();   // el clic en "Empezar" permite iniciar el audio de inmediato
  }

  EIJ.tour.enterCap1 = enterChapter;
  $('startBtn').addEventListener('click', enterChapter);
  $('playBtn').addEventListener('click', () => (st.playing ? stop() : play()));
  $('cmpOld').addEventListener('click', () => playYearMotif(0, 'cmpOld', 'Notas graves, lentas y una armonía tranquila.'));
  $('cmpNewYear').textContent = yearOf(maxIdx);
  $('cmpNew').addEventListener('click', () => playYearMotif(maxIdx, 'cmpNew', 'Notas agudas, más rápidas, armonía triste y la alarma sonando.'));
  $('cmpOld').setAttribute('aria-label', `Escuchar ${G.firstYear}: ${plainTemp(G.anomalies[0])}`);
  $('cmpNew').setAttribute('aria-label', `Escuchar ${yearOf(maxIdx)}, el año más caliente: ${plainTemp(maxA)}`);

  window.addEventListener('resize', () => {
    if (!$('portada').classList.contains('hidden')) drawPortada();
    else { fitCanvas(stripes); render(st.playing ? st.index : null); }
  });

  setPlayButton();
  drawPortada();
})();

/* ======================================================================
   cap3-oceano
   ====================================================================== */
/* Recorrido guiado · Capítulo 3 "El océano mueve el calor".
 * 1) Viaje guiado por la Corriente del Golfo: un punto recorre el mapa real de la NASA (SVS 3912) y
 *    cada paso suena según la temperatura del agua (cálida = aguda).
 * 2) Exploración libre con el dedo, el ratón o las flechas del teclado.
 * Las temperaturas vienen de js/datos-nasa.js, sección oceano-datos (extraídas del color de la imagen), así que funciona
 * también abriendo index.html con doble clic. */
(function () {
  'use strict';
  const EIJ = window.EIJ;
  const { clamp, $ } = EIJ;
  const tour = EIJ.tour;
  const O = EIJ.OCEAN;
  const CELL = 180 / O.rows;   // 5°

  const cellAt = (lat, lon) => {
    const col = clamp(Math.floor((lon + 180) / CELL), 0, O.cols - 1);
    const row = clamp(Math.floor((90 - lat) / CELL), 0, O.rows - 1);
    return { col, row, v: O.grid[row * O.cols + col] };
  };
  const word = (v) => (v < 0 ? 'tierra o hielo, sin datos del mar'
    : v > 0.75 ? 'agua muy cálida' : v > 0.55 ? 'agua cálida' : v > 0.35 ? 'agua templada' : v > 0.15 ? 'agua fría' : 'agua muy fría');
  const fmtPos = (lat, lon) => `${Math.abs(lat).toFixed(0)}°${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lon).toFixed(0)}°${lon < 0 ? 'O' : 'E'}`;

  // Ruta aproximada de la Corriente del Golfo y su continuación, la Deriva Noratlántica [lat, lon]
  const ROUTE = [[24, -88], [25, -80], [30, -79], [35, -74], [39, -65], [42, -50], [46, -35], [52, -25], [58, -12], [63, 0], [68, 10]];
  const SUB = 4;   // pasos entre cada par de puntos de la ruta
  const PATH = [];
  for (let k = 0; k < ROUTE.length - 1; k++) {
    for (let s = 0; s < SUB; s++) {
      const f = s / SUB;
      PATH.push([ROUTE[k][0] + (ROUTE[k + 1][0] - ROUTE[k][0]) * f, ROUTE[k][1] + (ROUTE[k + 1][1] - ROUTE[k][1]) * f, s === 0 ? k : -1]);
    }
  }
  PATH.push([...ROUTE[ROUTE.length - 1], ROUTE.length - 1]);

  const ROUTE_CAPTIONS = {
    0: 'Golfo de México: agua muy cálida. Escucha qué agudas suenan las notas.',
    2: 'La corriente sube pegada a la costa de Estados Unidos, como un río caliente dentro del mar.',
    5: 'Cruza el Atlántico. El agua va soltando su calor: las notas bajan poco a poco.',
    8: 'Se acerca a Europa. El calor que traía del trópico se va repartiendo por el camino.'
  };

  const start = cellAt(...ROUTE[0]).v;
  const end = cellAt(...ROUTE[ROUTE.length - 1]).v;
  // ¿Es el mar del final más templado que el resto del océano a la misma latitud (fuera del Atlántico norte)?
  const endRow = cellAt(...ROUTE[ROUTE.length - 1]).row;
  const others = [];
  for (let c = 0; c < O.cols; c++) {
    const lon = -180 + (c + 0.5) * CELL;
    const v = O.grid[endRow * O.cols + c];
    if (v >= 0 && (lon < -60 || lon > 40)) others.push(v);
  }
  const othersMean = others.length ? others.reduce((a, b) => a + b, 0) / others.length : null;
  const endIsWarmer = othersMean !== null && end > othersMean + 0.05;

  // ---------- Dibujo ----------
  const stage = $('seaStage');
  const canvas = $('seaCanvas');
  const ctx = canvas.getContext('2d');
  const st = { playing: false, step: 0, timer: null, cursor: null, lastCell: -1, cmp: null };

  const toXY = (lat, lon) => [(lon + 180) / 360 * canvas.width, (90 - lat) / 180 * canvas.height];

  function draw() {
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    const dpr = W / Math.max(1, canvas.clientWidth);
    // Ruta recorrida
    if (st.step > 0) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,.9)';
      ctx.lineWidth = 2.5 * dpr;
      ctx.setLineDash([6 * dpr, 5 * dpr]);
      ctx.beginPath();
      for (let i = 0; i <= Math.min(st.step, PATH.length - 1); i++) {
        const [x, y] = toXY(PATH[i][0], PATH[i][1]);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.restore();
    }
    const dot = st.cursor || (st.step > 0 ? PATH[Math.min(st.step, PATH.length - 1)] : null);
    if (dot) {
      const [x, y] = toXY(dot[0], dot[1]);
      ctx.save();
      ctx.shadowColor = '#CDB8E6'; ctx.shadowBlur = 16 * dpr;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(x, y, 7 * dpr, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      ctx.strokeStyle = '#CDB8E6'; ctx.lineWidth = 2 * dpr;
      ctx.beginPath(); ctx.arc(x, y, 15 * dpr, 0, Math.PI * 2); ctx.stroke();
    }
  }

  function fit() { tour.fitCanvas(canvas); draw(); }

  const caption = (t) => { $('caption3').textContent = t; };

  function sound(v, vel) {
    if (!EIJ.audio.ready) return;
    EIJ.audio.warmNote(Math.max(0, v), vel, v < 0);
    if (v >= 0) tour.vibrate(v);
  }

  // ---------- Viaje guiado ----------
  function setButton() {
    const b = $('play3Btn');
    b.setAttribute('aria-pressed', String(st.playing));
    b.textContent = st.playing ? '■ Detener' : (st.done ? '↺ Viajar otra vez' : '▶ Viajar con la Corriente del Golfo');
  }

  function stepVoyage() {
    if (!st.playing) return;
    const [lat, lon, wp] = PATH[st.step];
    const c = cellAt(lat, lon);
    draw();
    sound(c.v, 0.55);
    if (wp >= 0 && ROUTE_CAPTIONS[wp]) caption(ROUTE_CAPTIONS[wp]);
    if (st.step >= PATH.length - 1) { finish(); return; }
    st.step++;
    st.timer = setTimeout(stepVoyage, 320);
  }

  async function play() {
    if (!EIJ.audio.available) { caption('No se pudo cargar el audio. Revisa tu conexión a internet y recarga la página.'); return; }
    try { await EIJ.audio.ensure(); } catch (e) { caption('El navegador bloqueó el sonido. Pulsa el botón otra vez.'); return; }
    stopCompare();
    st.cursor = null;
    st.playing = true;
    st.step = 0;
    setButton();
    draw();
    tour.announceStart(3, () => { if (st.playing) st.timer = setTimeout(stepVoyage, 600); });
  }

  function stop(silent) {
    clearTimeout(st.timer);
    if (!st.playing) return;
    tour.hush();
    st.playing = false;
    setButton();
    if (!silent) caption('Viaje detenido. Puedes explorar el mapa tú mismo.');
  }

  function finish() {
    st.playing = false;
    st.done = true;
    setButton();
    const warmer = endIsWarmer
      ? ' Aun así, este mar es más templado que el resto del océano a la misma latitud: ese calor vino del trópico.'
      : '';
    caption(`Noruega: ${word(end)}.${warmer} Ahora explora tú: pasa el dedo o el ratón por el mapa, o usa las flechas.`);
    $('compare3').classList.remove('hidden');
    tour.announceEnd(3);
  }

  // ---------- Exploración libre ----------
  function explore(lat, lon, force) {
    lat = clamp(lat, -89, 89);
    lon = clamp(lon, -179.9, 179.9);
    st.cursor = [lat, lon];
    const c = cellAt(lat, lon);
    const id = c.row * O.cols + c.col;
    draw();
    if (id === st.lastCell && !force) return;
    st.lastCell = id;
    sound(c.v, 0.5);
    caption(`${fmtPos(lat, lon)}: ${word(c.v)}.`);
  }

  function fromPointer(e) {
    const r = stage.getBoundingClientRect();
    const lon = (e.clientX - r.left) / r.width * 360 - 180;
    const lat = 90 - (e.clientY - r.top) / r.height * 180;
    return [lat, lon];
  }

  async function wake() {
    if (EIJ.audio.ready || !EIJ.audio.available) return;
    try { await EIJ.audio.ensure(); } catch (e) { /* sin audio todavía */ }
  }

  stage.addEventListener('pointerdown', async (e) => {
    stop(true);
    await wake();
    if (e.pointerType !== 'mouse') stage.setPointerCapture(e.pointerId);
    explore(...fromPointer(e), true);
  });
  stage.addEventListener('pointermove', (e) => {
    if (st.playing) return;
    if (e.pointerType !== 'mouse' && e.buttons === 0) return;
    if (!EIJ.audio.ready && e.pointerType === 'mouse') { caption('Haz clic en el mapa para activar el sonido y explorar.'); return; }
    explore(...fromPointer(e));
  });
  stage.addEventListener('keydown', async (e) => {
    const moves = { ArrowUp: [CELL, 0], ArrowDown: [-CELL, 0], ArrowLeft: [0, -CELL], ArrowRight: [0, CELL] };
    if (!moves[e.key] && e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    stop(true);
    await wake();
    const cur = st.cursor || [25, -60];
    if (moves[e.key]) {
      const k = e.shiftKey ? 3 : 1;
      explore(cur[0] + moves[e.key][0] * k, cur[1] + moves[e.key][1] * k, true);
    } else {
      explore(cur[0], cur[1], true);
    }
  });

  // ---------- Escucha la diferencia ----------
  function stopCompare() {
    clearTimeout(st.cmpTimer);
    st.cmp = null;
    ['cmp3Start', 'cmp3End'].forEach((id) => $(id).setAttribute('aria-pressed', 'false'));
  }

  async function compare(point, btnId, label) {
    stop(true);
    await wake();
    stopCompare();
    st.cmp = btnId;
    $(btnId).setAttribute('aria-pressed', 'true');
    st.cursor = point;
    draw();
    const v = cellAt(...point).v;
    caption(`${label}: ${word(v)}.`);
    let k = 0;
    const tick = () => {
      if (st.cmp !== btnId) return;
      sound(v, 0.6);
      if (++k < 4) st.cmpTimer = setTimeout(tick, 380);
      else $(btnId).setAttribute('aria-pressed', 'false');
    };
    tick();
  }

  // ---------- Entrada y navegación ----------
  tour.onLeave.push(() => { stop(true); stopCompare(); });
  tour.enterCap3 = function () {
    tour.goTo('cap3');
    fit();
    play();   // viene de un clic: el audio puede empezar
  };

  $('play3Btn').addEventListener('click', () => (st.playing ? stop() : play()));
  $('backCap1').addEventListener('click', () => { tour.goTo('cap1'); });
  $('toCap3').addEventListener('click', () => tour.enterCap3());
  $('cmp3Start').addEventListener('click', () => compare(ROUTE[0], 'cmp3Start', 'Golfo de México, al inicio del viaje'));
  $('cmp3End').addEventListener('click', () => compare(ROUTE[ROUTE.length - 1], 'cmp3End', 'Noruega, al final del viaje'));
  $('cmp3Start').setAttribute('aria-label', `Escuchar el Golfo de México: ${word(start)}`);
  $('cmp3End').setAttribute('aria-label', `Escuchar Noruega: ${word(end)}`);
  window.addEventListener('resize', () => { if (!$('cap3').classList.contains('hidden')) fit(); });
  setButton();
})();

/* ======================================================================
   cap4-co2
   ====================================================================== */
/* Recorrido guiado · Capítulo 4 "La causa" y pantalla de cierre.
 * Un tono continuo sigue el CO₂ de Mauna Loa mes a mes (NOAA, 1958–hoy): se oye el vaivén anual
 * (la "respiración" de las plantas) y la subida de fondo. Al final, un resumen de los 4 capítulos. */
(function () {
  'use strict';
  const EIJ = window.EIJ;
  const { clamp, $ } = EIJ;
  const tour = EIJ.tour;
  const C = EIJ.CO2;
  const N = C.ppm.length;
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const MS_PER_MONTH = 40;   // 823 meses ≈ 33 s

  const dateOf = (i) => { const m = C.firstMonth - 1 + i; return { year: C.firstYear + Math.floor(m / 12), month: m % 12 }; };
  const label = (i) => { const d = dateOf(i); return `${MESES[d.month]} ${d.year}`; };
  const indexOf = (year, month) => (year - C.firstYear) * 12 + (month - (C.firstMonth - 1));
  // 310 ppm → 110 Hz; cada 55 ppm sube una octava
  const hzOf = (ppm) => 110 * Math.pow(2, (ppm - 310) / 55);
  const pct = (a, b) => Math.round((b / a - 1) * 100);

  const first = C.ppm[0], last = C.ppm[N - 1];
  const i400 = C.ppm.findIndex((v) => v >= 400);

  // Último año completo, para comparar un año entero de "respiración"
  const lastFullYear = C.lastMonth === 12 ? C.lastYear : C.lastYear - 1;
  const firstFullYear = C.firstMonth === 1 ? C.firstYear : C.firstYear + 1;

  // ---------- Subtítulos ----------
  const CAPTIONS = new Map();
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  CAPTIONS.set(0, `${cap(label(0))}, Mauna Loa (Hawái): ${Math.round(first)} partes por millón de CO₂. Escucha: ese tono es el aire del planeta.`);
  CAPTIONS.set(indexOf(1962, 0), '¿Oyes que el tono sube y baja cada año? Es la Tierra respirando: en primavera y verano las plantas del norte absorben CO₂, y en invierno lo devuelven.');
  CAPTIONS.set(indexOf(1985, 0), 'Pero cada respiración termina más arriba que la anterior. El tono no deja de subir.');
  if (i400 > 0) CAPTIONS.set(i400, `${cap(label(i400))}: por primera vez, más de 400 partes por millón.`);

  // ---------- Dibujo: curva de Keeling ----------
  const canvas = $('co2Canvas');
  const ctx = canvas.getContext('2d');
  const LO = 305, HI = Math.max(...C.ppm) + 5;
  const st = { playing: false, i: 0, timer: null, upTo: N, cmp: null, done: false };

  function draw(marker) {
    const W = canvas.width, H = canvas.height;
    const dpr = W / Math.max(1, canvas.clientWidth);
    const padL = 20 * dpr, padR = 20 * dpr, padT = 90 * dpr, padB = 20 * dpr;
    const x = (i) => padL + i / (N - 1) * (W - padL - padR);
    const y = (v) => H - padB - (v - LO) / (HI - LO) * (H - padT - padB);
    ctx.clearRect(0, 0, W, H);
    // Línea de 400 ppm como referencia
    ctx.save();
    ctx.setLineDash([5 * dpr, 6 * dpr]);
    ctx.strokeStyle = 'rgba(255,255,255,.35)';
    ctx.beginPath(); ctx.moveTo(padL, y(400)); ctx.lineTo(W - padR, y(400)); ctx.stroke();
    ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,.6)';
    ctx.font = `${12 * dpr}px "JetBrains Mono", monospace`;
    ctx.fillText('400 ppm', W - padR - 62 * dpr, y(400) - 6 * dpr);
    // Curva hasta el mes actual
    ctx.save();
    ctx.shadowColor = '#F4A3CB'; ctx.shadowBlur = 10 * dpr;
    ctx.strokeStyle = '#FCE4F0'; ctx.lineWidth = 2 * dpr;
    ctx.beginPath();
    for (let i = 0; i < st.upTo; i++) { if (i === 0) ctx.moveTo(x(i), y(C.ppm[i])); else ctx.lineTo(x(i), y(C.ppm[i])); }
    ctx.stroke();
    ctx.restore();
    if (marker !== undefined && marker !== null) {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(x(marker), y(C.ppm[marker]), 5 * dpr, 0, Math.PI * 2); ctx.fill();
    }
  }

  function show(i) {
    $('co2Date').textContent = label(i);
    $('co2Ppm').textContent = `${C.ppm[i].toFixed(1)} ppm de CO₂`;
  }

  const caption = (t) => { $('caption4').textContent = t; };

  function setButton() {
    const b = $('play4Btn');
    b.setAttribute('aria-pressed', String(st.playing));
    b.textContent = st.playing ? '■ Detener' : (st.done ? '↺ Escuchar otra vez' : `▶ Escuchar ${C.firstYear} → hoy`);
  }

  function step() {
    if (!st.playing) return;
    const i = st.i;
    const v = C.ppm[i];
    st.upTo = i + 1;
    EIJ.audio.co2Set(hzOf(v));
    if (dateOf(i).month === 0) { EIJ.audio.co2Tick(hzOf(v)); tour.vibrate(clamp((v - 310) / 125, 0, 1)); }
    if (i % 3 === 0 || i === N - 1) { show(i); draw(i); }
    if (CAPTIONS.has(i)) caption(CAPTIONS.get(i));
    if (i >= N - 1) { finish(); return; }
    st.i = i + 1;
    st.timer = setTimeout(step, MS_PER_MONTH);
  }

  async function play() {
    if (!EIJ.audio.available) { caption('No se pudo cargar el audio. Revisa tu conexión a internet y recarga la página.'); return; }
    try { await EIJ.audio.ensure(); } catch (e) { caption('El navegador bloqueó el sonido. Pulsa “Escuchar” otra vez.'); return; }
    stopCompare();
    st.playing = true;
    st.i = 0;
    st.upTo = 0;
    setButton();
    show(0);
    draw(null);
    caption('Escucha. Este tono sigue al CO₂ del aire, mes a mes…');
    // El tono continuo arranca cuando el narrador termina de decir qué capítulo vas a escuchar
    tour.announceStart(4, () => {
      if (!st.playing) return;
      EIJ.audio.co2Set(hzOf(first));
      EIJ.audio.co2Start();
      st.timer = setTimeout(step, 1500);
    });
  }

  function stop(silent) {
    clearTimeout(st.timer);
    if (!st.playing) return;
    tour.hush();
    st.playing = false;
    EIJ.audio.co2Stop();
    st.upTo = N;
    setButton();
    draw(st.i);
    if (!silent) caption(`Detenido en ${label(st.i)}. Pulsa “Escuchar” para empezar de nuevo.`);
  }

  function finish() {
    st.playing = false;
    st.done = true;
    EIJ.audio.co2Stop();
    setButton();
    caption(`Hoy: ${last.toFixed(0)} partes por millón, un ${pct(first, last)} % más que en ${C.firstYear}. ` +
      'Según la NASA, gases como el CO₂ atrapan el calor del Sol: más CO₂, un planeta más caliente y un océano que acumula calor. Es lo que escuchaste en los capítulos anteriores.');
    $('compare4').classList.remove('hidden');
    tour.announceEnd(4);
  }

  // ---------- Escucha la diferencia: un año completo de respiración ----------
  function stopCompare() {
    clearTimeout(st.cmpTimer);
    if (st.cmp !== null && !st.playing) EIJ.audio.co2Stop();
    st.cmp = null;
    ['cmp4Old', 'cmp4New'].forEach((id) => $(id).setAttribute('aria-pressed', 'false'));
  }

  async function compare(year, btnId, text) {
    stop(true);
    try { await EIJ.audio.ensure(); } catch (e) { return; }
    stopCompare();
    st.cmp = year;
    $(btnId).setAttribute('aria-pressed', 'true');
    const i0 = indexOf(year, 0);
    const mean = C.ppm.slice(i0, i0 + 12).reduce((a, b) => a + b, 0) / 12;
    caption(`${year}: en promedio ${mean.toFixed(0)} partes por millón. ${text}`);
    EIJ.audio.co2Set(hzOf(C.ppm[i0]));
    EIJ.audio.co2Start();
    let k = 0;
    const tick = () => {
      if (st.cmp !== year) return;
      const i = i0 + k;
      EIJ.audio.co2Set(hzOf(C.ppm[i]));
      show(i);
      draw(i);
      if (++k < 12) st.cmpTimer = setTimeout(tick, 220);
      else st.cmpTimer = setTimeout(() => { EIJ.audio.co2Stop(); $(btnId).setAttribute('aria-pressed', 'false'); st.cmp = null; }, 400);
    };
    tick();
  }

  // ---------- Entrada y navegación ----------
  tour.onLeave.push(() => { stop(true); stopCompare(); });
  tour.enterCap4 = function () {
    tour.goTo('cap4');
    tour.fitCanvas(canvas);
    play();   // viene de un clic: el audio puede empezar
  };

  $('play4Btn').addEventListener('click', () => (st.playing ? stop() : play()));
  $('toCap4').addEventListener('click', () => tour.enterCap4());
  $('backCap3').addEventListener('click', () => { tour.goTo('cap3'); });
  $('cmp4Old').querySelector('span').textContent = firstFullYear;
  $('cmp4NewYear').textContent = lastFullYear;
  $('cmp4Old').addEventListener('click', () => compare(firstFullYear, 'cmp4Old', 'Escucha el vaivén de todo un año, en un tono grave.'));
  $('cmp4New').addEventListener('click', () => compare(lastFullYear, 'cmp4New', 'El mismo vaivén de las plantas… pero mucho más arriba.'));
  $('cmp4Old').setAttribute('aria-label', `Escuchar un año de CO₂ en ${firstFullYear}`);
  $('cmp4New').setAttribute('aria-label', `Escuchar un año de CO₂ en ${lastFullYear}`);
  window.addEventListener('resize', () => { if (!$('cap4').classList.contains('hidden')) { tour.fitCanvas(canvas); draw(st.playing ? st.i : null); } });
  setButton();
  show(0);

  // ---------- Cierre ----------
  const G = EIJ.GISTEMP;
  const tempRise = G.anomalies[G.anomalies.length - 1] - G.anomalies[0];
  $('finTemp').textContent = `+${tempRise.toFixed(1)} °C`;
  $('finTemp').nextElementSibling.textContent = `más caliente que en ${G.firstYear}`;
  $('finCo2').textContent = `+${pct(first, last)} %`;
  $('finCo2').nextElementSibling.textContent = `de CO₂ en el aire desde ${C.firstYear}`;

  $('restartBtn').addEventListener('click', () => tour.enterCap1());
  // El capítulo de las luces (sección cap56-mapas, más abajo) registra tour.enterCap5 y el botón "Terminar"
  document.querySelectorAll('.fin-replay').forEach((b) => b.addEventListener('click', () => {
    const fn = tour['enterCap' + b.dataset.go];
    if (fn) fn();
  }));

  $('shareBtn').addEventListener('click', async () => {
    const data = { title: 'Earth Jukebox', text: '¿Cómo suena un planeta que se calienta? Escucha ' + G.anomalies.length + ' años de datos de la NASA.', url: location.href.split('#')[0] };
    try {
      if (navigator.share) { await navigator.share(data); $('shareStatus').textContent = '¡Gracias por compartir!'; }
      else { await navigator.clipboard.writeText(data.url); $('shareStatus').textContent = 'Enlace copiado. Pégalo donde quieras compartirlo.'; }
    } catch (e) {
      $('shareStatus').textContent = 'No se pudo compartir automáticamente. Copia la dirección de la barra del navegador.';
    }
  });
})();

/* ======================================================================
   cap56-mapas
   ====================================================================== */
/* Recorrido guiado · Capítulos 5 (luces nocturnas) y 6 (rayos desde la ISS).
 * Usan los audios de la colección (assets/audio/05-luces.wav y 06-rayos.wav), generados con
 * herramientas/generar-audios.ps1. Una línea recorre el mapa de oeste a este al ritmo del audio,
 * con subtítulos y el dato de cada franja. Los tiempos y datos vienen de js/jukebox-tiempos.js. */
(function () {
  'use strict';
  const EIJ = window.EIJ, T = window.JUKEBOX_TIEMPOS;
  const { clamp, $ } = EIJ;
  const tour = EIJ.tour;

  const lonOf = (c) => { const lon = Math.round(-180 + 7.5 * c + 3.75); return lon === 0 ? '0°' : `${Math.abs(lon)}° ${lon < 0 ? 'O' : 'E'}`; };

  const CHAPTERS = {
    5: {
      key: 'lights', file: 'assets/audio/05-luces.wav', color: '#f9a8d4',
      start: 'Escucha… empezamos de noche sobre el océano Pacífico.',
      describe: (i) => {
        const n = T.lights.neu[i], o = T.lights.off[i];
        return n + o < 0.03 ? 'oscuridad' : n >= o ? 'más luces nuevas' : 'más luces apagadas';
      },
      captions: [
        [0, 'Océano Pacífico: oscuridad. Solo se oye la noche.'],
        [7, 'Norteamérica: aparecen las primeras campanas, ciudades que crecieron desde 2012.'],
        [12, 'Este de Norteamérica y el Caribe: se mezclan campanas y tonos graves.'],
        [15, 'Sudamérica: más campanas que tonos graves. Las ciudades siguen creciendo.'],
        [22, 'Europa: dominan los tonos graves. En parte porque muchas ciudades cambiaron a luces LED, que el satélite ve más tenues.'],
        [28, 'Oriente Medio y África: vuelven las campanas.'],
        [33, 'India: una de las mayores olas de luces nuevas del planeta.'],
        [37, 'China y el sudeste asiático: campanas por todas partes.'],
        [42, 'Japón, Indonesia y Australia: las últimas luces antes de volver al Pacífico.']
      ],
      end: 'La Tierra de noche cuenta dónde crecen las ciudades: sobre todo en Asia, y donde se ahorra energía, como en Europa.',
      compare: { A: [22, 27, 'Europa: tonos graves. Muchas luces se hicieron más tenues.'], B: [33, 40, 'India y China: campanas. Luces nuevas por todas partes.'] }
    }
  };

  // Luces nuevas frente a apagadas en todo el mapa
  const sum = (a) => a.reduce((x, y) => x + y, 0);
  const lightsRatio = sum(T.lights.neu) / Math.max(0.001, sum(T.lights.off));

  // ---------- Un capítulo ----------
  function setup(num) {
    const ch = CHAPTERS[num], t = T[ch.key];
    const audio = new Audio(ch.file);
    audio.preload = 'none';
    const canvas = $('scan' + num), ctx = canvas.getContext('2d');
    const st = { done: false, lastCap: -1, segEnd: null, segBtn: null, raf: 0 };

    const caption = (s) => { $('caption' + num).textContent = s; };
    const idxAt = (time) => clamp(Math.floor((time - t.intro) / t.step), -1, t.n - 1);

    function drawScan() {
      const r = Math.min(window.devicePixelRatio || 1, 2);
      const cw = Math.round(canvas.clientWidth * r), chh = Math.round(canvas.clientHeight * r);
      if (canvas.width !== cw || canvas.height !== chh) { canvas.width = cw; canvas.height = chh; }
      const W = canvas.width, H = canvas.height, dpr = W / Math.max(1, canvas.clientWidth);
      ctx.clearRect(0, 0, W, H);
      const p = clamp((audio.currentTime - t.intro) / (t.step * t.n), 0, 1);
      if (audio.currentTime <= 0 && audio.paused) return;
      const x = p * W;
      ctx.fillStyle = 'rgba(0,0,0,.35)';
      ctx.fillRect(0, 0, x, H);
      ctx.save();
      ctx.shadowColor = ch.color; ctx.shadowBlur = 14 * dpr;
      ctx.fillStyle = '#fff';
      ctx.fillRect(x - dpr, 0, 2 * dpr, H);
      ctx.restore();
    }

    function update() {
      tick();
      if (!audio.paused) st.raf = requestAnimationFrame(update);
    }
    // timeupdate es el respaldo cuando la pestaña no dibuja (requestAnimationFrame se pausa en segundo plano)
    audio.addEventListener('timeupdate', tick);

    function tick() {
      const i = idxAt(audio.currentTime);
      if (i >= 0) {
        $('lon' + num).textContent = lonOf(i);
        $('what' + num).textContent = ch.describe(i);
        if (st.segEnd === null) {
          let k = -1;
          ch.captions.forEach(([ci], j) => { if (ci <= i) k = j; });
          if (k !== st.lastCap && k >= 0) { st.lastCap = k; caption(ch.captions[k][1]); }
        }
        if (i !== st.lastIdx) {   // una vibración por franja, más fuerte donde hay más luces o rayos
          st.lastIdx = i;
          const v = T.lights.neu[i];
          if (v > 0.03) tour.vibrate(clamp(v, 0, 1));
        }
      }
      drawScan();
      if (st.segEnd !== null && audio.currentTime >= st.segEnd) endSegment();
    }

    function setButton() {
      const b = $(`play${num}Btn`), playing = (!audio.paused || st.waiting) && st.segEnd === null;
      b.setAttribute('aria-pressed', String(playing));
      b.textContent = playing ? '■ Detener' : st.done ? '↺ Escuchar otra vez' : '▶ Escuchar la vuelta al mundo';
    }

    function play() {
      endSegment(true);
      audio.currentTime = 0;
      st.lastCap = -1;
      caption(ch.start);
      // En modo accesible el audio empieza cuando el narrador termina de decir qué capítulo vas a escuchar
      st.waiting = true;
      tour.announceStart(num, () => {
        if (!st.waiting) return;
        st.waiting = false;
        audio.play().then(() => { st.raf = requestAnimationFrame(update); setButton(); })
          .catch(() => { caption('El navegador bloqueó el sonido. Pulsa “Escuchar” otra vez.'); setButton(); });
      });
      setButton();
    }

    function stop(silent) {
      cancelAnimationFrame(st.raf);
      const was = !audio.paused || st.waiting;
      if (st.waiting) { st.waiting = false; tour.hush(); }
      audio.pause();
      endSegment(true);
      setButton();
      if (was && !silent) caption(`Detenido en ${$('lon' + num).textContent}. Pulsa “Escuchar” para empezar de nuevo.`);
    }

    audio.addEventListener('ended', () => {
      cancelAnimationFrame(st.raf);
      st.done = true;
      caption(ch.end);
      $('compare' + num).classList.remove('hidden');
      setButton();
      drawScan();
      tour.announceEnd(num);
    });

    // ---------- Escucha la diferencia: un tramo del mismo audio ----------
    function segment(which, btnId) {
      const [c0, c1, text] = ch.compare[which];
      if (st.waiting) { st.waiting = false; tour.hush(); }
      cancelAnimationFrame(st.raf);
      audio.pause();
      endSegment(true);
      st.segEnd = t.intro + c1 * t.step;
      st.segBtn = btnId;
      $(btnId).setAttribute('aria-pressed', 'true');
      caption(text);
      audio.currentTime = t.intro + c0 * t.step;
      audio.play().then(() => { st.raf = requestAnimationFrame(update); }).catch(() => endSegment(true));
      setButton();
    }
    function endSegment(silent) {
      if (st.segEnd === null) return;
      if (!silent) { audio.pause(); cancelAnimationFrame(st.raf); }
      $(st.segBtn).setAttribute('aria-pressed', 'false');
      st.segEnd = null; st.segBtn = null;
      setButton();
    }
    $(`cmp${num}A`).addEventListener('click', () => segment('A', `cmp${num}A`));
    $(`cmp${num}B`).addEventListener('click', () => segment('B', `cmp${num}B`));

    $(`play${num}Btn`).addEventListener('click', () => ((!audio.paused || st.waiting) && st.segEnd === null ? stop() : play()));
    tour.onLeave.push(() => stop(true));
    window.addEventListener('resize', () => { if (!$('cap' + num).classList.contains('hidden')) drawScan(); });
    setButton();

    return function enter() {
      tour.goTo('cap' + num);
      drawScan();
      play();   // viene de un clic: el audio puede empezar
    };
  }

  tour.enterCap5 = setup(5);

  $('toCap5').addEventListener('click', () => tour.enterCap5());
  $('backCap4').addEventListener('click', () => tour.goTo('cap4'));
  $('toFin').addEventListener('click', () => tour.goTo('fin'));

  // ---------- Cierre: cifra del capítulo de las luces ----------
  $('finLights').textContent = `${lightsRatio.toFixed(1)}×`;

  // ---------- Ir directo a cualquier capítulo ----------
  // Los puntos de progreso de cada pantalla pasan a ser botones numerados, y la portada y el cierre
  // tienen el mismo menú: no hace falta volver al inicio ni pasar por los capítulos intermedios.
  // El recorrido tiene 4 capítulos; "id" es la pantalla (cap1, cap3, cap4, cap5) y el número visible es su posición.
  const CHAPS = tour.CHAPS;   // definidos junto al narrador, al principio del recorrido
  const posOf = (id) => CHAPS.findIndex((c) => c.id === id) + 1;   // 0 = portada
  const capButtons = (curId) => {
    const cur = posOf(curId);
    return CHAPS.map((c, k) => {
      const n = k + 1, here = n === cur;
      const cls = `chapter-dot chapter-btn${here ? ` is-active${c.accent || ''}` : n < cur ? ' is-done' : ''}`;
      return `<li><button type="button" class="${cls}" data-cap="${c.id}"${here ? ' aria-current="step"' : ''} ` +
        `title="Capítulo ${n}: ${c.name}" aria-label="Capítulo ${n}: ${c.name}${here ? ' (actual)' : ''}">${n}</button></li>`;
    }).join('');
  };

  document.querySelectorAll('ol[aria-label="Progreso del recorrido"]').forEach((ol) => {
    const cur = +ol.closest('.screen').id.replace('cap', '');
    ol.setAttribute('aria-label', 'Capítulos del recorrido: ir a cualquiera');
    ol.innerHTML = `<li><button type="button" class="chapter-home" data-cap="0" aria-label="Volver a la portada">Inicio</button></li>` +
      capButtons(cur) + `<li class="text-slate-400 ml-1" aria-hidden="true">${posOf(cur)} de ${CHAPS.length}</li>`;
  });
  document.querySelectorAll('.cap-menu').forEach((ol) => { ol.innerHTML = capButtons(0); });

  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-cap]');
    if (!b || b.getAttribute('aria-current')) return;
    const n = +b.dataset.cap;
    if (n === 0) { tour.goTo('portada'); window.dispatchEvent(new Event('resize')); return; }   // redibuja la portada
    const fn = tour['enterCap' + n];
    if (fn) fn();   // viene de un clic: el capítulo empieza a sonar
  });
})();

/* ======================================================================
   equipo
   ====================================================================== */
/* ============================================================
 *  EQUIPO · edita este archivo con los datos reales del equipo
 * ============================================================
 *  - nombre:  nombre de la persona
 *  - rol:     qué hizo en el proyecto (una línea)
 *  - texto:   una frase sobre su aporte o por qué participó (opcional)
 *  - foto:    ruta a una foto cuadrada, por ejemplo 'assets/equipo/ana.jpg' (opcional;
 *             si no hay foto se muestran las iniciales)
 *  - enlace:  LinkedIn, GitHub o web personal (opcional)
 *  Puedes agregar o quitar personas: la página se ajusta sola.
 */
window.EQUIPO = {
  nombre: 'Nuestro equipo',            // ← nombre del equipo
  intro: 'Somos estudiantes que participamos en el NASA Space Apps Challenge 2026. Nos unió una pregunta: ¿se puede entender el cambio climático sin ver una sola gráfica?',
  personas: [
    { nombre: '', rol: 'Datos y sonificación', texto: 'Convirtió los datos de la NASA en reglas de sonido.', foto: '', enlace: '' },
    { nombre: 'Rachel Tejada', rol: 'Diseño y accesibilidad', texto: 'Diseñó la experiencia para que cualquiera pueda usarla.', foto: '', enlace: '' },
    { nombre: 'Jeriel Baez', rol: 'Programación web', texto: 'Construyó el Jukebox y el recorrido guiado.', foto: '', enlace: '' },
    { nombre: 'Ashenet Placencia', rol: 'Investigación y narrativa', texto: 'Escribió la historia que cuentan los subtítulos.', foto: '', enlace: '' }
  ]
};

(function () {
  'use strict';
  const E = window.EQUIPO, list = document.getElementById('teamList');
  if (!E || !list) return;
  const esc = (s) => String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const initials = (n) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');

  document.getElementById('teamName').textContent = E.nombre;
  document.getElementById('teamIntro').textContent = E.intro;
  // Las personas sin nombre todavía (plantilla por rellenar) no se muestran
  list.innerHTML = E.personas.filter((p) => p.nombre && p.nombre.trim()).map((p) => `
    <li class="member">
      ${p.foto ? `<img class="member-photo" src="${esc(p.foto)}" alt="Foto de ${esc(p.nombre)}">`
               : `<span class="member-initials" aria-hidden="true">${esc(initials(p.nombre))}</span>`}
      <span>
        <span class="member-name block">${esc(p.nombre)}</span>
        <span class="member-role block">${esc(p.rol)}</span>
      </span>
      ${p.texto ? `<span class="member-text">${esc(p.texto)}</span>` : ''}
      ${p.enlace ? `<a class="text-sm underline hover:text-white mt-auto" href="${esc(p.enlace)}" target="_blank" rel="noopener">Perfil ↗</a>` : ''}
    </li>`).join('');
})();
