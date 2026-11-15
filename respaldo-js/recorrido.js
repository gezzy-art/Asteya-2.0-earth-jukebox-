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
    st.timer = setTimeout(step, 1600);
  }

  function stop(silent) {
    clearTimeout(st.timer);
    if (!st.playing) return;
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
  function goTo(id) {
    onLeave.forEach((fn) => fn());
    document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('hidden', s.id !== id));
    window.scrollTo(0, 0);
    const title = document.querySelector(`#${id} h2[tabindex="-1"]`);
    if (title) title.focus();
  }
  EIJ.tour = { goTo, onLeave, vibrate, fitCanvas };

  function enterChapter() {
    goTo('cap1');
    fitCanvas(stripes);
    showYear(0);
    render(null);
    play();   // el clic en "Empezar" permite iniciar el audio de inmediato
  }

  EIJ.tour.enterCap1 = enterChapter;
  $('startBtn').addEventListener('click', enterChapter);
  $('toCap2').addEventListener('click', () => EIJ.tour.enterCap2());
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
