/* Accesibilidad: narrador aria-live, descripción de los datos y atajos de teclado. */
(function () {
  'use strict';
  const EIJ = window.EIJ;
  const { mtof, midiSol, NOTE_ES, SCALES, state, $ } = EIJ;
  const NARRATE_EVERY_MS = 7000;

  // ---------- Región aria-live ----------
  let announceTimer = null;
  function announce(msg) {
    const el = $('liveRegion');
    clearTimeout(announceTimer);
    el.textContent = '';   // vaciar primero para que el lector repita mensajes iguales
    announceTimer = setTimeout(() => { el.textContent = msg; }, 60);
    state.lastAnnounce = msg;
  }

  function dominanceText(s) {
    const { r, g, b, lum } = s;
    if (lum < 0.06) return 'zona oscura o sin datos, casi en silencio';
    if (r > 140 && g > 140 && b < 120) return 'predominio amarillo, valores extremos detectados';
    if (r > b + 25 && r > g + 15) return 'predominio cálido detectado (rojos y naranjas)';
    if (r > 90 && b > 90 && g < Math.min(r, b) - 30) return 'predominio morado detectado';
    if (b > r + 25 && g > b - 15 && g > 110) return 'predominio cian y verde detectado';
    if (b > r + 25) return 'predominio frío detectado (azules oceánicos)';
    if (g > r + 20 && g > b) return 'predominio verde detectado';
    if (lum > 0.8) return 'zona muy brillante y neutra';
    return 'valores neutros y equilibrados';
  }

  function buildDescription() {
    const s = state.lastSample, m = state.lastMap;
    const t = EIJ.currentTrack();
    const src = EIJ.render.activeSource();
    const tname = EIJ.isFileTrack() ? 'archivo local ' + state.fileName
      : src.eic ? `${t.name} (datos reales de la NASA)` : `${t.name} (simulación)`;
    if (!s || !m) {
      return state.mode === 'pointer'
        ? `Modo puntero en ${tname}: mueve el cursor, toca el mapa o usa las flechas para explorar.`
        : `Pista ${tname} lista. Pulsa espacio para iniciar el barrido.`;
    }
    const verb = state.playing ? 'Escaneando' : 'Explorando (en pausa)';
    // Pistas con detector propio (luces y rayos): el mapeo ya trae su descripción
    if (m.desc) return `${verb} ${tname} en ${EIJ.render.positionText()}: ${m.desc}.`;
    const ratio = m.idx / (m.n - 1);
    const register = ratio < 0.34 ? 'tonos graves' : ratio < 0.67 ? 'tonos medios' : 'tonos agudos';
    const bassTxt = m.bassMidi !== null ? ', con bajo profundo activo' : '';
    const sound = m.silent ? 'sin notas' : `reproduciendo ${register} (${midiSol(m.midi)}, ${Math.round(mtof(m.midi))} hercios)`;
    const motionTxt = state.motion > 0.45 ? ' Mucho movimiento: ritmo acelerado con percusión.'
      : state.motion > 0.12 ? ' Movimiento moderado: el ritmo se acelera.' : '';
    return `${verb} ${tname} en ${EIJ.render.positionText()}: ${dominanceText(s)}, ${sound} en escala ${SCALES[state.scale].name} de ${NOTE_ES[t.root]}${bassTxt}. Brillo ${Math.round(s.lum * 100)} por ciento.${motionTxt}`;
  }

  const describeNow = () => announce(buildDescription());

  // ---------- Retroalimentación táctil (vibración) ----------
  // Cada nota vibra más tiempo cuanto más cálida es la zona; los extremos dan doble pulso.
  // navigator.vibrate funciona en Android; iOS no lo admite y se oculta la opción.
  const canVibrate = typeof navigator.vibrate === 'function';
  let lastBuzz = 0;
  function haptic(m, minGapMs) {
    if (!canVibrate || !m || m.silent || !$('hapticChk').checked) return;
    // El navegador solo permite vibrar después de que la persona tocó la página
    if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
    const now = performance.now();
    if (now - lastBuzz < minGapMs) return;
    lastBuzz = now;
    const ms = Math.round(12 + m.warmth * 45);
    const extreme = m.warmth > 0.85 || m.warmth < 0.15;
    try { navigator.vibrate(extreme ? [ms, 40, ms] : ms); } catch (e) { /* sin permiso aún */ }
  }
  if (!canVibrate) {
    $('hapticRow').classList.add('hidden');
    $('hapticHint').classList.add('hidden');
  }

  // ---------- Diálogo "Cómo funciona" ----------
  const howDialog = $('howDialog');
  const openHow = () => { if (!howDialog.open) howDialog.showModal(); };
  $('howBtn').addEventListener('click', openHow);
  $('howClose').addEventListener('click', () => howDialog.close());
  // Clic en el fondo oscuro también cierra; al cerrar, el foco vuelve al botón
  howDialog.addEventListener('click', (e) => { if (e.target === howDialog) howDialog.close(); });
  howDialog.addEventListener('close', () => $('howBtn').focus());
  const DEMO_TEXT = {
    warmth: 'Ejemplo: de frío a calor, las notas suben y el sonido se vuelve más brillante.',
    blue: 'Ejemplo: el azul profundo despierta un bajo grave con eco espacial.',
    bright: 'Ejemplo: de oscuro a brillante, más volumen y más notas.',
    motion: 'Ejemplo: cuanto más movimiento, más rápido el ritmo y la percusión.',
    lights: 'Ejemplo: campanas agudas para las luces nuevas y tonos graves para las luces que se apagaron.',
    lightning: 'Ejemplo: cada rayo es un golpe de tambor; con muchos rayos juntos suena un trueno grave.'
  };
  howDialog.querySelectorAll('.demo-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!EIJ.audio.available) { announce('Audio no disponible: Tone.js no se cargó.'); return; }
      announce(DEMO_TEXT[btn.dataset.demo]);
      try { await EIJ.audio.demo(btn.dataset.demo); } catch (e) { announce('El navegador bloqueó el audio. Inténtalo de nuevo.'); }
    });
  });

  // Narración periódica mientras suena, solo si el mensaje cambió
  setInterval(() => {
    if (!state.playing || !$('narrateChk').checked) return;
    const msg = buildDescription();
    if (msg !== state.lastAnnounce) announce(msg);
  }, NARRATE_EVERY_MS);

  // ---------- Atajos de teclado ----------
  document.addEventListener('keydown', (e) => {
    const ui = EIJ.ui;
    const el = e.target;
    const tag = el.tagName;
    const isCheckbox = tag === 'INPUT' && el.type === 'checkbox';
    const isField = (tag === 'INPUT' && !isCheckbox) || tag === 'SELECT' || tag === 'TEXTAREA';
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    // Con un diálogo abierto (portada o "Cómo funciona"), el teclado funciona de forma nativa (Tab, Enter, Escape)
    if (document.querySelector('dialog[open]')) return;

    if (e.code === 'Space' || e.key === ' ') {
      if (tag === 'SELECT' || isCheckbox) return;
      e.preventDefault();
      if (!e.repeat) ui.togglePlay();
      return;
    }
    // En campos de formulario las flechas conservan su comportamiento nativo
    if (isField && e.key.startsWith('Arrow')) return;

    switch (e.key) {
      case '1': case '2': case '3': case '4': case '5': case '6':
        ui.selectTrack(parseInt(e.key, 10) - 1); break;
      case 'ArrowUp':
        e.preventDefault();
        if (e.shiftKey && state.mode === 'pointer') ui.movePointer(0, -15); else ui.setInstrument(state.inst - 1);
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (e.shiftKey && state.mode === 'pointer') ui.movePointer(0, 15); else ui.setInstrument(state.inst + 1);
        break;
      // En modo puntero las flechas lo mueven; en barrido cambian de pista, como el carrusel
      case 'ArrowLeft':
        e.preventDefault();
        if (state.mode === 'pointer') ui.movePointer(e.shiftKey ? -60 : -15, 0); else ui.stepTrack(-1);
        break;
      case 'ArrowRight':
        e.preventDefault();
        if (state.mode === 'pointer') ui.movePointer(e.shiftKey ? 60 : 15, 0); else ui.stepTrack(1);
        break;
      case 'm': case 'M': ui.setMode(state.mode === 'radar' ? 'pointer' : 'radar'); break;
      case 's': case 'S': ui.setScale(state.scale + 1); break;
      case 'd': case 'D': describeNow(); break;
      case 'h': case 'H': openHow(); break;
      default: break;
    }
  });

  // Evita que la barra espaciadora también "pulse" el botón enfocado
  document.addEventListener('keyup', (e) => {
    if (document.querySelector('dialog[open]')) return;
    if ((e.code === 'Space' || e.key === ' ') && e.target.tagName === 'BUTTON') e.preventDefault();
  });

  EIJ.a11y = { announce, describeNow, haptic };
})();
