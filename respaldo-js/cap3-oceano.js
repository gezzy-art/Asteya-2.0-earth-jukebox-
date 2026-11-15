/* Recorrido guiado · Capítulo 3 "El océano mueve el calor".
 * 1) Viaje guiado por la Corriente del Golfo: un punto recorre el mapa real de la NASA (SVS 3912) y
 *    cada paso suena según la temperatura del agua (cálida = aguda).
 * 2) Exploración libre con el dedo, el ratón o las flechas del teclado.
 * Las temperaturas vienen de js/oceano-datos.js (extraídas del color de la imagen), así que funciona
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
    st.timer = setTimeout(stepVoyage, 600);
  }

  function stop(silent) {
    clearTimeout(st.timer);
    if (!st.playing) return;
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
  $('backCap2').addEventListener('click', () => { tour.goTo('cap2'); });
  $('toCap3').addEventListener('click', () => tour.enterCap3());
  $('cmp3Start').addEventListener('click', () => compare(ROUTE[0], 'cmp3Start', 'Golfo de México, al inicio del viaje'));
  $('cmp3End').addEventListener('click', () => compare(ROUTE[ROUTE.length - 1], 'cmp3End', 'Noruega, al final del viaje'));
  $('cmp3Start').setAttribute('aria-label', `Escuchar el Golfo de México: ${word(start)}`);
  $('cmp3End').setAttribute('aria-label', `Escuchar Noruega: ${word(end)}`);
  window.addEventListener('resize', () => { if (!$('cap3').classList.contains('hidden')) fit(); });
  setButton();
})();
