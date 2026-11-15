/* Recorrido guiado · Capítulo 2 "El hielo desaparece".
 * Un acorde de campanas por año (extensión del hielo ártico en septiembre, NSIDC 1979–hoy):
 * cuanto más hielo, más notas. La imagen real de la NASA pasa de 1979 a 2012 según el hielo de cada año. */
(function () {
  'use strict';
  const EIJ = window.EIJ;
  const { clamp, $ } = EIJ;
  const tour = EIJ.tour;
  const D = EIJ.SEAICE;
  const N = D.extent.length;
  const yearOf = (i) => D.firstYear + i;
  const base = D.extent[0];                     // 1979
  const minE = Math.min(...D.extent);
  const minIdx = D.extent.indexOf(minE);
  const IMG_LOW = 3.57;                         // extensión de 2012, la imagen "baja"
  const MAX_NOTES = 7, MIN_NOTES = 1;

  // Más hielo → más notas (7 en 1979; ~2 en el mínimo)
  const notesFor = (e) => clamp(Math.round(MIN_NOTES + (e - 3) / (base - 3) * (MAX_NOTES - MIN_NOTES)), MIN_NOTES, MAX_NOTES);
  const lossPct = (e) => Math.round((1 - e / base) * 100);
  const fmtArea = (e) => `${e.toFixed(2)} millones de km² de hielo`;

  // ---------- Subtítulos calculados a partir de los datos ----------
  const CAPTIONS = new Map();
  CAPTIONS.set(0, `${D.firstYear}. Septiembre en el Ártico: ${fmtArea(base)}. Escucha el acorde completo.`);
  const i90 = 1990 - D.firstYear;
  if (i90 > 0 && i90 < N) CAPTIONS.set(i90, 'Los años 90. El acorde todavía suena casi entero.');
  const iBig = D.extent.findIndex((e) => e < 4.5);
  if (iBig > 0) CAPTIONS.set(iBig, `${yearOf(iBig)}: una caída enorme. Faltan notas: el acorde empieza a sonar vacío.`);
  CAPTIONS.set(minIdx, `${yearOf(minIdx)}: el mínimo récord, ${minE.toFixed(2)} millones de km². Desapareció ${lossPct(minE) >= 45 ? 'casi la mitad' : `el ${lossPct(minE)} %`} del hielo de ${D.firstYear}.`);

  const st = { playing: false, index: 0, timer: null, cmp: null, done: false };

  function show(i) {
    const e = D.extent[i];
    $('iceYear').textContent = yearOf(i);
    $('iceArea').textContent = fmtArea(e);
    const p = lossPct(e);
    $('iceLoss').textContent = i === 0 ? 'punto de partida' : p > 0 ? `${p} % menos que en ${D.firstYear}` : `igual o más que en ${D.firstYear}`;
    $('iceLow').style.opacity = String(clamp((base - e) / (base - IMG_LOW), 0, 1));
    $('iceBarFill').style.width = `${clamp(e / base, 0, 1) * 100}%`;
  }

  const caption = (t) => { $('caption2').textContent = t; };

  function setButton() {
    const b = $('play2Btn');
    b.setAttribute('aria-pressed', String(st.playing));
    b.textContent = st.playing ? '■ Detener' : (st.done ? '↺ Escuchar otra vez' : `▶ Escuchar ${D.firstYear} → hoy`);
  }

  function chord(i) {
    const e = D.extent[i];
    EIJ.audio.iceChord(notesFor(e), 0.35 + 0.4 * clamp(e / base, 0, 1));
    tour.vibrate(e / base);   // más hielo = vibración más larga
  }

  function step() {
    if (!st.playing) return;
    const i = st.index;
    show(i);
    chord(i);
    if (CAPTIONS.has(i)) caption(CAPTIONS.get(i));
    if (i >= N - 1) { finish(); return; }
    st.index = i + 1;
    st.timer = setTimeout(step, 620);
  }

  async function play() {
    if (!EIJ.audio.available) { caption('No se pudo cargar el audio. Revisa tu conexión a internet y recarga la página.'); return; }
    try { await EIJ.audio.ensure(); } catch (e) { caption('El navegador bloqueó el sonido. Pulsa “Escuchar” otra vez.'); return; }
    stopCompare();
    st.playing = true;
    st.index = 0;
    setButton();
    show(0);
    caption('Escucha. Cada acorde es un año…');
    st.timer = setTimeout(step, 1400);
  }

  function stop(silent) {
    clearTimeout(st.timer);
    if (!st.playing) return;
    st.playing = false;
    setButton();
    if (!silent) caption(`Detenido en ${yearOf(st.index)}. Pulsa “Escuchar” para empezar de nuevo.`);
  }

  function finish() {
    st.playing = false;
    st.done = true;
    setButton();
    const last = D.extent[N - 1];
    let lastFull = -1;
    D.extent.forEach((e, i) => { if (notesFor(e) === MAX_NOTES) lastFull = i; });
    const never = lastFull >= 0 && lastFull < N - 1 ? ` Desde ${yearOf(lastFull + 1)}, el acorde nunca volvió a sonar completo.` : '';
    caption(`${D.lastYear}: ${fmtArea(last)}, un ${lossPct(last)} % menos que en ${D.firstYear}.${never} Ahora escucha la diferencia.`);
    $('compare2').classList.remove('hidden');
  }

  // ---------- Escucha la diferencia ----------
  function stopCompare() {
    clearTimeout(st.cmpTimer);
    st.cmp = null;
    ['cmp2Old', 'cmp2New'].forEach((id) => $(id).setAttribute('aria-pressed', 'false'));
  }

  async function compare(i, btnId, text) {
    stop(true);
    try { await EIJ.audio.ensure(); } catch (e) { return; }
    stopCompare();
    st.cmp = i;
    $(btnId).setAttribute('aria-pressed', 'true');
    show(i);
    caption(`${yearOf(i)}: ${fmtArea(D.extent[i])}. ${text}`);
    let k = 0;
    const tick = () => {
      if (st.cmp !== i) return;
      chord(i);
      if (++k < 3) st.cmpTimer = setTimeout(tick, 900);
      else $(btnId).setAttribute('aria-pressed', 'false');
    };
    tick();
  }

  // ---------- Entrada al capítulo ----------
  tour.onLeave.push(() => { stop(true); stopCompare(); });
  tour.enterCap2 = function () {
    tour.goTo('cap2');
    show(0);
    play();   // viene de un clic: el audio puede empezar
  };

  $('play2Btn').addEventListener('click', () => (st.playing ? stop() : play()));
  $('backCap1').addEventListener('click', () => tour.goTo('cap1'));
  $('cmp2NewYear').textContent = yearOf(minIdx);
  $('cmp2Old').addEventListener('click', () => compare(0, 'cmp2Old', 'Todas las notas: un acorde lleno.'));
  $('cmp2New').addEventListener('click', () => compare(minIdx, 'cmp2New', 'Faltan notas: el acorde suena vacío.'));
  $('cmp2Old').setAttribute('aria-label', `Escuchar ${D.firstYear}: ${fmtArea(base)}, acorde completo`);
  $('cmp2New').setAttribute('aria-label', `Escuchar ${yearOf(minIdx)}, el mínimo récord: ${fmtArea(minE)}, acorde con notas que faltan`);
  setButton();
  show(0);
})();
