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
    EIJ.audio.co2Set(hzOf(first));
    EIJ.audio.co2Start();
    st.timer = setTimeout(step, 1500);
  }

  function stop(silent) {
    clearTimeout(st.timer);
    if (!st.playing) return;
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
      'Según la NASA, gases como el CO₂ atrapan el calor del Sol: más CO₂, un planeta más caliente, menos hielo y un océano que acumula calor. Es lo que escuchaste en los capítulos anteriores.');
    $('compare4').classList.remove('hidden');
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
  const G = EIJ.GISTEMP, S = EIJ.SEAICE;
  const tempRise = G.anomalies[G.anomalies.length - 1] - G.anomalies[0];
  $('finTemp').textContent = `+${tempRise.toFixed(1)} °C`;
  $('finTemp').nextElementSibling.textContent = `más caliente que en ${G.firstYear}`;
  $('finIce').textContent = `−${Math.round((1 - S.extent[S.extent.length - 1] / S.extent[0]) * 100)} %`;
  $('finIce').nextElementSibling.textContent = `de hielo ártico en septiembre desde ${S.firstYear}`;
  $('finCo2').textContent = `+${pct(first, last)} %`;
  $('finCo2').nextElementSibling.textContent = `de CO₂ en el aire desde ${C.firstYear}`;

  $('restartBtn').addEventListener('click', () => tour.enterCap1());
  // Los capítulos 5 y 6 (js/cap56-mapas.js) registran tour.enterCap5 / enterCap6 y el botón "Terminar"
  document.querySelectorAll('.fin-replay').forEach((b) => b.addEventListener('click', () => {
    const fn = tour['enterCap' + b.dataset.go];
    if (fn) fn();
  }));

  $('shareBtn').addEventListener('click', async () => {
    const data = { title: 'Earth Jukebox', text: '¿Cómo suena un planeta que se calienta? Escucha 146 años de datos de la NASA.', url: location.href.split('#')[0] };
    try {
      if (navigator.share) { await navigator.share(data); $('shareStatus').textContent = '¡Gracias por compartir!'; }
      else { await navigator.clipboard.writeText(data.url); $('shareStatus').textContent = 'Enlace copiado. Pégalo donde quieras compartirlo.'; }
    } catch (e) {
      $('shareStatus').textContent = 'No se pudo compartir automáticamente. Copia la dirección de la barra del navegador.';
    }
  });
})();
