/* Interfaz: lista de pistas, carga de archivos, controles, puntero y telemetría. */
(function () {
  'use strict';
  const EIJ = window.EIJ;
  const { W, H, clamp, NOTE_ES, TRACKS, FILE_TRACK, FILE_IDX, INSTRUMENTS, SCALES, state, $ } = EIJ;
  const announce = (msg) => EIJ.a11y.announce(msg);
  let mediaUrl = null;

  // Texto sencillo de cada pista (columna izquierda, como en Hearing Hubble)
  const STORY = {
    temp: 'Este mapa de la NASA muestra cuánto más cálido fue 2025 que el promedio de 1951–1980. Una línea lo recorre de izquierda a derecha: donde hace más calor (rojo), las notas suben; donde está más frío (azul), aparece un bajo profundo.',
    ocean: 'Las corrientes del océano vistas por un modelo de la NASA, coloreadas por la temperatura del agua. Escucha cómo el agua cálida del ecuador suena aguda y el agua fría de los polos, grave. El movimiento de las corrientes acelera el ritmo.',
    co2: 'Una simulación de la NASA del dióxido de carbono moviéndose por la atmósfera. Los colores más intensos (naranja y amarillo) son donde hay más CO₂, y suenan más agudos y fuertes.',
    lights: 'La Tierra de noche: en morado, luces que aparecieron entre 2012 y 2023; en naranja, luces que se apagaron. Las luces nuevas suenan como campanas y las apagadas, como un tono grave. Más al norte, nota más aguda.',
    lightning: 'Rayos detectados desde la Estación Espacial Internacional. Cada destello amarillo es un golpe de tambor, y muchos rayos juntos suenan como un trueno. Escucha cómo se concentran en los trópicos.'
  };
  const thumbOf = (t) => (t.eic.kind === 'video' ? 'assets/eic/corrientes-oceanicas.jpg' : t.eic.src);

  // ---------- Carrusel de pistas ----------
  function renderTrackList() {
    const list = $('trackList');
    list.innerHTML = '';
    const items = TRACKS.map((t, i) => ({ t, i }));
    if (state.fileName) items.push({ t: FILE_TRACK, i: FILE_IDX });
    items.forEach(({ t, i }) => {
      const isFile = i === FILE_IDX;
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'track-btn';
      btn.setAttribute('aria-pressed', String(state.track === i));
      btn.setAttribute('aria-label', isFile
        ? `Pista ${FILE_IDX + 1}: tu archivo ${state.fileName}. Tecla ${FILE_IDX + 1}`
        : `Pista ${i + 1}: ${t.name}. Tecla ${i + 1}`);
      const real = !isFile && state.useReal && !state.realBlocked;
      btn.style.background = isFile ? 'linear-gradient(135deg,#334155,#0f172a)'
        : real ? `#000 url('${thumbOf(t)}') center/cover`
          : `linear-gradient(135deg, ${t.stops.map((s) => s[1]).join(',')})`;
      btn.addEventListener('click', () => selectTrack(i));
      li.appendChild(btn);
      list.appendChild(li);
    });
  }

  function stepTrack(d) {
    const n = TRACKS.length + (state.fileName ? 1 : 0);
    selectTrack((state.track + d + n) % n);
  }

  function selectTrack(i) {
    if (i === FILE_IDX && !state.fileName) { announce('No hay archivo local cargado. Usa el botón Cargar video o imagen.'); return; }
    if (i < 0 || i > FILE_IDX) return;
    state.track = i;
    renderTrackList();
    updateLabels();
    const t = EIJ.currentTrack();
    const src = EIJ.render.activeSource();
    const what = i === FILE_IDX ? 'archivo local ' + state.fileName
      : src.eic ? `${t.name}, visualización real de la NASA: ${src.eic.title}` : `${t.name}, simulación`;
    announce(`Pista ${i + 1}: ${what}. Tónica ${NOTE_ES[t.root]}.`);
  }

  function updateLabels() {
    const t = EIJ.currentTrack();
    const src = EIJ.render.activeSource();
    let label, aria, credit = '';
    const isFile = EIJ.isFileTrack();
    if (isFile) {
      label = `${state.fileKind === 'video' ? 'Video' : 'Imagen'} de tu equipo`;
      aria = `Cuadro cargado ${state.fileName}, que se está sonificando`;
    } else if (src.eic) {
      label = src.eic.title;
      aria = `Visualización de la NASA: ${src.eic.title}. ${t.desc}. Se está sonificando`;
      credit = `<a class="learn-link" href="${src.eic.url}" target="_blank" rel="noopener">Ver la visualización original ↗</a><span class="block mt-2 text-xs">${src.eic.credit} · dominio público</span>`;
    } else {
      label = 'Simulación ilustrativa (no son datos reales)';
      aria = `Mapa simulado de ${t.name}, ${t.desc}, que se está sonificando`;
    }
    const n = TRACKS.length + (state.fileName ? 1 : 0);
    $('trackNum').textContent = `Pista ${state.track + 1} de ${n}`;
    $('trackName').textContent = isFile ? state.fileName : t.name;
    $('trackDesc').textContent = isFile
      ? 'Tu propia imagen o video, leído con las mismas reglas: rojo sube el tono, azul despierta el bajo, brillo da volumen y el movimiento acelera el ritmo.'
      : (STORY[t.id] || t.desc);
    $('sourceLabel').textContent = label;
    $('creditLine').innerHTML = credit;
    EIJ.render.canvas.setAttribute('aria-label', aria);
  }

  // Se llama cuando cambia la disponibilidad de los archivos del EIC
  function refreshSource() {
    const note = $('sourceNote');
    if (state.realBlocked) {
      note.textContent = 'Abriste laboratorio.html directamente desde la carpeta: el navegador no deja leer los píxeles de las imágenes de la NASA, así que suena la simulación. Para escuchar los datos reales, abre la app con iniciar-servidor.bat (o con Live Server en VS Code).';
      note.classList.remove('hidden');
    } else {
      note.classList.add('hidden');
    }
    renderTrackList();
    updateLabels();
  }

  // ---------- Carga de archivos locales ----------
  function onFileChosen(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const { video, image } = EIJ.render;
    if (mediaUrl) URL.revokeObjectURL(mediaUrl);
    mediaUrl = URL.createObjectURL(file);
    if (file.type.startsWith('video/')) {
      video.src = mediaUrl;
      video.play()
        .then(() => finishLoad(file.name, 'video'))
        .catch(() => { $('fileInfo').textContent = 'No se pudo reproducir el video. Prueba con MP4 (H.264) o WebM.'; announce('Error al reproducir el video.'); });
    } else if (file.type.startsWith('image/')) {
      image.onload = () => finishLoad(file.name, 'image');
      image.onerror = () => { $('fileInfo').textContent = 'No se pudo leer la imagen.'; announce('Error al leer la imagen.'); };
      image.src = mediaUrl;
    } else {
      $('fileInfo').textContent = 'Formato no compatible. Usa .mp4, .webm o una imagen.';
    }
  }

  function finishLoad(name, kind) {
    state.fileName = name;
    state.fileKind = kind;
    state.track = FILE_IDX;
    $('fileInfo').textContent = 'Tu archivo aparece al final del carrusel. Usa las flechas para volver a las pistas de la NASA.';
    renderTrackList();
    updateLabels();
    announce(`${kind === 'video' ? 'Video' : 'Imagen'} local cargado: ${name}. Ahora se sonifica tu archivo.`);
  }

  // ---------- Reproducción ----------
  async function togglePlay() {
    const audio = EIJ.audio;
    if (!audio.available) { announce('Audio no disponible: Tone.js no se cargó.'); return; }
    if (state.playing) {
      audio.pause();
      state.playing = false;
      announce('Sonificación en pausa.');
    } else {
      try { await audio.start(); } catch (e) { announce('El navegador bloqueó el audio. Inténtalo de nuevo.'); return; }
      state.playing = true;
      const t = EIJ.currentTrack();
      const what = EIJ.isFileTrack() ? 'archivo ' + state.fileName : t.name;
      announce(state.mode === 'radar'
        ? `Sonando: ${what}. La línea recorre la imagen de izquierda a derecha.`
        : `Sonando: ${what}. Mueve el puntero sobre la imagen para explorarla.`);
    }
    updatePlayUi();
  }

  function updatePlayUi() {
    const b = $('playBtn');
    b.setAttribute('aria-pressed', String(state.playing));
    $('playIcon').textContent = state.playing ? '❚❚' : '▶';
    $('playText').textContent = state.playing ? 'Pausa' : 'Reproducir';
    b.setAttribute('aria-label', state.playing ? 'Pausar (barra espaciadora)' : 'Reproducir (barra espaciadora)');
    $('statusChip').classList.toggle('live', state.playing);
    $('statusText').textContent = state.playing ? 'SONIFICANDO' : 'EN ESPERA';
  }

  // ---------- Instrumento, escala y modo ----------
  function setInstrument(i) {
    state.inst = (i + INSTRUMENTS.length) % INSTRUMENTS.length;
    $('instSelect').value = String(state.inst);
    EIJ.audio.setInstrument(state.inst);
    announce(`Instrumento: ${INSTRUMENTS[state.inst].name}.`);
  }

  function setScale(i) {
    state.scale = (i + SCALES.length) % SCALES.length;
    $('scaleSelect').value = String(state.scale);
    announce(`Escala: ${SCALES[state.scale].name} de ${NOTE_ES[EIJ.currentTrack().root]}.`);
  }

  function setMode(mode, silent) {
    state.mode = mode;
    $('modeRadar').setAttribute('aria-pressed', String(mode === 'radar'));
    $('modePointer').setAttribute('aria-pressed', String(mode === 'pointer'));
    EIJ.render.overlay.classList.toggle('pointer-mode', mode === 'pointer');
    if (silent) return;
    announce(mode === 'radar'
      ? 'Modo barrido: la línea de radar recorre el mapa de izquierda a derecha.'
      : 'Modo puntero: explora el mapa con el cursor, el dedo o las flechas izquierda y derecha; Shift con flechas arriba y abajo para moverte en vertical.');
  }

  function movePointer(dx, dy) {
    state.pointerActive = true;
    state.px = clamp(state.px + dx, 0, W - 1);
    state.py = clamp(state.py + dy, 0, H - 1);
  }

  // ---------- Puntero (ratón y táctil) ----------
  function bindPointer() {
    const overlay = EIJ.render.overlay;
    const place = (e) => {
      const r = overlay.getBoundingClientRect();
      state.px = clamp((e.clientX - r.left) / r.width * W, 0, W - 1);
      state.py = clamp((e.clientY - r.top) / r.height * H, 0, H - 1);
      state.pointerActive = true;
    };
    overlay.addEventListener('pointermove', (e) => { if (state.mode === 'pointer') place(e); });
    overlay.addEventListener('pointerdown', (e) => {
      if (state.mode !== 'pointer') return;
      place(e);
      if (e.pointerType !== 'mouse') overlay.setPointerCapture(e.pointerId);
    });
    overlay.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') state.pointerActive = false; });
    overlay.addEventListener('pointerup', (e) => { if (e.pointerType !== 'mouse') state.pointerActive = false; });
    overlay.addEventListener('pointercancel', () => { state.pointerActive = false; });
  }

  // ---------- Controles del panel derecho ----------
  function bindControls() {
    $('playBtn').addEventListener('click', togglePlay);
    $('instSelect').addEventListener('change', (e) => setInstrument(parseInt(e.target.value, 10)));
    $('scaleSelect').addEventListener('change', (e) => setScale(parseInt(e.target.value, 10)));
    $('modeRadar').addEventListener('click', () => setMode('radar'));
    $('modePointer').addEventListener('click', () => setMode('pointer'));
    $('prevTrack').addEventListener('click', () => stepTrack(-1));
    $('nextTrack').addEventListener('click', () => stepTrack(1));
    $('describeBtn').addEventListener('click', () => EIJ.a11y.describeNow());
    $('uploadBtn').addEventListener('click', () => $('fileInput').click());
    $('fileInput').addEventListener('change', onFileChosen);

    $('bpmRange').addEventListener('input', (e) => {
      state.bpm = +e.target.value;
      $('bpmOut').textContent = state.bpm + ' BPM';
      e.target.setAttribute('aria-valuetext', state.bpm + ' pulsos por minuto');
      EIJ.audio.setBpm(state.bpm);
    });
    $('volRange').addEventListener('input', (e) => {
      state.volDb = +e.target.value;
      $('volOut').textContent = state.volDb + ' dB';
      e.target.setAttribute('aria-valuetext', state.volDb + ' decibelios');
      EIJ.audio.setVolume(state.volDb);
    });
  }

  // ---------- Muestra actual (para el narrador) y vibración ----------
  function updateTelemetry(s, m, played) {
    if (!s) { state.lastSample = null; return; }
    state.lastSample = s; state.lastMap = m;
    // Vibración: con cada nota, o al explorar con el dedo en pausa
    if (played) EIJ.a11y.haptic(m, 120);
    else if (!state.playing && state.mode === 'pointer' && state.pointerActive) EIJ.a11y.haptic(m, 250);
  }

  function init() {
    if (!EIJ.audio.available) $('toneError').classList.remove('hidden');
    refreshSource();
    updatePlayUi();
    setMode('radar', true);
    bindControls();
    bindPointer();
  }

  EIJ.ui = { init, togglePlay, selectTrack, setInstrument, setScale, setMode, refreshSource, movePointer, updateTelemetry, stepTrack };
})();
