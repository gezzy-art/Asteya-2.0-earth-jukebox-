/* Earth Jukebox: reproduce la colección de audios y sincroniza imagen, gráfica y subtítulos. */
(function () {
  'use strict';
  const EIJ = window.EIJ, T = window.JUKEBOX_TIEMPOS;
  const $ = (id) => document.getElementById(id);
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const fmt = (n, d) => n.toFixed(d);
  const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

  // Colores: frío (azul) → neutro (blanco) → cálido (rojo)
  function heat(k) {
    k = clamp(k, 0, 1);
    const stops = [[0, [33, 102, 172]], [0.5, [240, 240, 240]], [1, [178, 24, 43]]];
    const i = k < 0.5 ? 0 : 1, a = stops[i], b = stops[i + 1], f = (k - a[0]) / (b[0] - a[0]);
    return `rgb(${a[1].map((c, j) => Math.round(c + (b[1][j] - c) * f)).join(',')})`;
  }

  // ---------- Datos de cada pista ----------
  const G = EIJ.GISTEMP, ICE = EIJ.SEAICE, O = EIJ.OCEAN, C = EIJ.CO2;

  const oceanRows = [];
  for (let r = 0; r < O.rows; r++) {
    let s = 0, n = 0;
    for (let c = 0; c < O.cols; c++) { const v = O.grid[r * O.cols + c]; if (v >= 0) { s += v; n++; } }
    oceanRows.push(n ? s / n : null);
  }
  const latOf = (r) => { const lat = 90 - 5 * r - 2.5; return `${Math.abs(lat)}° ${lat >= 0 ? 'N' : 'S'}`; };

  // Mapas de luces y rayos: 48 columnas de 7.5° de longitud, de oeste a este
  const lonOf = (c) => { const lon = Math.round(-180 + 7.5 * c + 3.75); return lon === 0 ? '0°' : `${Math.abs(lon)}° ${lon < 0 ? 'O' : 'E'}`; };

  const co2Date =(i) => { const m = C.firstMonth - 1 + i; return { year: C.firstYear + Math.floor(m / 12), month: m % 12 }; };
  const co2Cross = (lim) => C.ppm.findIndex((v) => v >= lim);
  const co2Last = C.ppm[C.ppm.length - 1];
  const co2Caps = [{ i: 0, text: `${C.firstYear}: ${Math.round(C.ppm[0])} ppm. Empiezan las mediciones en Mauna Loa, Hawái.` }];
  [[350, 'el nivel que los científicos consideran seguro para el clima.'],
   [400, 'más de 400 ppm por primera vez en la historia de la humanidad.'],
   [420, 'el CO₂ sigue subiendo cada año, sin pausa.']].forEach(([lim, txt]) => {
    const i = co2Cross(lim);
    if (i >= 0) co2Caps.push({ i, text: `${co2Date(i).year}: ${lim} ppm, ${txt} Suena la campana.` });
  });
  co2Caps.push({ i: C.ppm.length - 1, text: `${co2Date(C.ppm.length - 1).year}: ${Math.round(co2Last)} ppm, un ${Math.round((co2Last / C.ppm[0] - 1) * 100)} % más que en ${C.firstYear}.` });

  const TRACKS = [
    {
      key: 'temp', file: 'assets/audio/01-temperatura.wav',
      title: 'El planeta se calienta', sub: `Temperatura global · ${G.firstYear}–${G.lastYear}`,
      story: 'Cada nota de arpa es un año, de 1880 a 2025. Cuanto más cálido fue el año comparado con el promedio de 1951–1980, más aguda suena. Cuando el calentamiento pasa de +0.5 °C la melodía cambia a tono menor, y por encima de +0.8 °C entra un pulso de percusión, como una alarma.',
      link: 'https://data.giss.nasa.gov/gistemp/', thumb: 'assets/eic/temperatura-2025.png',
      images: ['assets/eic/temperatura-2025.png'],
      imgAlt: 'Mapa de la NASA del cambio de temperatura en 2025: casi todo el planeta en tonos naranjas y rojos.',
      legend: [['Nota más aguda', 'año más cálido'], ['Tono menor', 'más de +0.5 °C'], ['Pulso de percusión', 'más de +0.8 °C']],
      values: G.anomalies, chart: 'stripes', color: (v) => heat(0.5 + v / 2.4),
      label: (i, v) => `${G.firstYear + i} · ${v > 0 ? '+' : ''}${fmt(v, 2)} °C`,
      captions: [
        { i: 0, text: '1880: empieza el registro de temperatura de la NASA. Las notas son graves y tranquilas.' },
        { i: 29, text: '1909: uno de los años más fríos de todo el registro.' },
        { i: 60, text: 'Años 40: un primer calentamiento que se detiene durante unas décadas.' },
        { i: 97, text: 'Finales de los 70: el calentamiento empieza y ya no se detiene. Las notas suben.' },
        { i: 118, text: '1998: un El Niño muy fuerte supera +0.5 °C y la melodía pasa a tono menor.' },
        { i: 135, text: '2015: se supera +0.8 °C. Entra el pulso de alarma y ya no se va.' },
        { i: 144, text: '2024: el año más cálido registrado, +1.28 °C.' },
        { i: 145, text: 'Acabas de escuchar 146 años de temperatura en menos de un minuto.' }
      ]
    },
    {
      key: 'ice', file: 'assets/audio/02-hielo.wav',
      title: 'El hielo desaparece', sub: `Hielo marino del Ártico en septiembre · ${ICE.firstYear}–${ICE.lastYear}`,
      story: 'Cada año suena como un puñado de campanas de cristal: una por cada porción de hielo que le queda al Ártico al final del verano. Con menos hielo hay menos campanas y suenan más bajo, mientras el viento se oye cada vez más fuerte.',
      link: 'https://nsidc.org/data/g02135', thumb: 'assets/eic/hielo-2012.jpg',
      images: ['assets/eic/hielo-1979.jpg', 'assets/eic/hielo-2012.jpg'],
      imgAlt: 'El hielo del Ártico visto desde satélite: en 1979 cubre gran parte del océano; en 2012, mucho menos.',
      legend: [['Más campanas', 'más hielo'], ['Volumen', 'extensión del hielo'], ['Viento', 'el hielo que falta']],
      values: ICE.extent, chart: 'bars', norm: true, color: () => '#9bd8ff',
      label: (i, v) => `${ICE.firstYear + i} · ${fmt(v, 2)} millones de km²`,
      fade: (v) => clamp((ICE.extent[0] - v) / (ICE.extent[0] - 3.57), 0, 1),
      captions: [
        { i: 0, text: '1979: el Ártico tiene 7 millones de km² de hielo en septiembre. Muchas campanas.' },
        { i: 28, text: '2007: una caída brusca, a 4.3 millones de km². Se apagan campanas.' },
        { i: 33, text: '2012: mínimo récord, 3.6 millones de km². Casi la mitad que en 1979.' },
        { i: 41, text: '2020: el segundo mínimo más bajo. El viento ya domina.' },
        { i: ICE.extent.length - 1, text: `${ICE.lastYear}: ${fmt(ICE.extent[ICE.extent.length - 1], 1)} millones de km², un tercio menos que en 1979.` }
      ]
    },
    {
      key: 'ocean', file: 'assets/audio/03-oceano.wav',
      title: 'El océano mueve el calor', sub: 'Temperatura del mar · del Polo Norte al Polo Sur',
      story: 'Una línea recorre el mapa del océano de norte a sur, 5 grados de latitud por segundo. Cada nota es un trozo de mar: el agua fría suena grave y la cálida, aguda. Escucha cómo la melodía sube al acercarse al ecuador y vuelve a bajar en el océano Austral.',
      link: 'https://svs.gsfc.nasa.gov/3912', thumb: 'assets/eic/corrientes-oceanicas.jpg',
      images: ['assets/eic/corrientes-oceanicas.jpg'],
      imgAlt: 'Mapa de las corrientes del océano coloreadas por temperatura: rojas y naranjas en el ecuador, azules cerca de los polos.',
      legend: [['Nota aguda', 'agua cálida'], ['Nota grave', 'agua fría'], ['Silencio', 'tierra o hielo']],
      values: oceanRows, chart: 'bars', color: (v) => heat(v), scan: 'y',
      label: (i, v) => `${latOf(i)} · ${v === null ? 'sin océano' : v > 0.66 ? 'agua cálida' : v > 0.33 ? 'agua templada' : 'agua fría'}`,
      captions: [
        { i: 0, text: 'Polo Norte: casi todo es hielo y tierra. Apenas suena.' },
        { i: 8, text: '50° N: Atlántico y Pacífico Norte, agua templada. La melodía empieza a subir.' },
        { i: 14, text: 'Trópicos: el agua más cálida del planeta. Las notas más agudas.' },
        { i: 18, text: 'Ecuador: el sol calienta el océano y las corrientes llevan ese calor hacia los polos.' },
        { i: 25, text: '35° S: el agua se enfría y la melodía baja.' },
        { i: 29, text: 'Océano Austral: la corriente que rodea la Antártida, agua helada y notas graves.' },
        { i: 33, text: 'Antártida: hielo y silencio.' }
      ]
    },
    {
      key: 'co2', file: 'assets/audio/04-co2.wav',
      title: 'La causa: el aire que cambia', sub: `CO₂ en la atmósfera · ${C.firstYear}–${C.lastYear}`,
      story: 'Una melodía de flauta y un tono de fondo suben mes a mes con el dióxido de carbono medido en Mauna Loa (Hawái). La ondulación de la melodía es la respiración del planeta: las plantas absorben CO₂ en verano y lo liberan en invierno. Cada latido marca un año, y una campana grave suena al cruzar 350, 400 y 420 ppm.',
      link: 'https://science.nasa.gov/earth/explore/earth-indicators/carbon-dioxide/', thumb: 'assets/eic/co2-dyamond.jpg',
      images: ['assets/eic/co2-dyamond.jpg'],
      imgAlt: 'Simulación de la NASA del CO₂ en la atmósfera sobre Asia y Oceanía, con nubes moradas, rojas y amarillas.',
      legend: [['Tono más agudo', 'más CO₂ en el aire'], ['Latido', 'un año'], ['Campana grave', 'se cruza un umbral']],
      values: C.ppm, chart: 'line', color: () => '#c4b5fd',
      label: (i, v) => { const d = co2Date(i); return `${MES[d.month]} ${d.year} · ${fmt(v, 1)} ppm`; },
      captions: co2Caps
    },
    {
      key: 'lights', file: 'assets/audio/05-luces.wav',
      title: 'Las luces de la noche cambian', sub: 'Luces nocturnas vistas por satélite · 2012 → 2023',
      story: 'Una línea recorre el planeta de noche, de oeste a este. Las luces que aparecieron desde 2012 (en morado) suenan como campanas; las que se apagaron o se hicieron más tenues (en naranja), como un tono grave. Cuanto más al norte está la ciudad, más aguda la nota. Así se escucha dónde crecen las ciudades.',
      link: 'https://svs.gsfc.nasa.gov/5313', thumb: 'assets/eic/luces-nocturnas-cambio.jpg',
      images: ['assets/eic/luces-nocturnas-cambio.jpg'],
      imgAlt: 'Mapa nocturno de la Tierra: puntos morados donde aparecieron luces nuevas, sobre todo en Asia, y naranjas donde se apagaron, sobre todo en Europa.',
      legend: [['Campanas agudas', 'luces nuevas (morado)'], ['Tono grave', 'luces apagadas (naranja)'], ['Más aguda', 'más al norte']],
      values: T.lights.neu, values2: T.lights.off, chart: 'dual', color: () => '#b794f6', color2: () => '#f6a35c', scan: 'x',
      label: (i) => {
        const n = T.lights.neu[i], o = T.lights.off[i];
        return `${lonOf(i)} · ${n + o < 0.03 ? 'oscuridad' : n >= o ? 'más luces nuevas' : 'más luces apagadas'}`;
      },
      captions: [
        { i: 0, text: 'Océano Pacífico: oscuridad. Solo se oye la noche.' },
        { i: 7, text: 'Norteamérica: aparecen las primeras campanas, ciudades que crecieron desde 2012.' },
        { i: 12, text: 'Este de Norteamérica y el Caribe: se mezclan campanas y tonos graves, luces nuevas y luces que se apagaron.' },
        { i: 15, text: 'Sudamérica: más campanas que tonos graves. Las ciudades siguen creciendo.' },
        { i: 22, text: 'Europa: dominan los tonos graves. En parte es porque muchas ciudades cambiaron a luces LED, que el satélite ve más tenues.' },
        { i: 28, text: 'Oriente Medio y África: vuelven las campanas.' },
        { i: 33, text: 'India: una de las mayores olas de luces nuevas del planeta.' },
        { i: 37, text: 'China y el sudeste asiático: campanas por todas partes.' },
        { i: 42, text: 'Japón, Indonesia y Australia: las últimas luces antes de volver al Pacífico.' }
      ]
    },
    {
      key: 'lightning', file: 'assets/audio/06-rayos.wav',
      title: 'Rayos vistos desde el espacio', sub: 'Rayos detectados desde la Estación Espacial Internacional · 2023',
      story: 'Desde la Estación Espacial, el instrumento LIS de la NASA detecta los rayos de todo el planeta. Una línea recorre el mapa de oeste a este: cada zona con rayos es un golpe de tambor, más agudo cuanto más al norte. Donde hay muchos a la vez, retumba un trueno. Escucha cómo las tormentas se concentran en los trópicos.',
      link: 'https://svs.gsfc.nasa.gov/5011', thumb: 'assets/eic/rayos-iss-2023.jpg',
      images: ['assets/eic/rayos-iss-2023.jpg'],
      imgAlt: 'Mapa de la Tierra con puntos amarillos donde se detectaron rayos, concentrados en Sudamérica, África central y el sudeste asiático.',
      legend: [['Tambor', 'una zona con rayos'], ['Más agudo', 'más al norte'], ['Trueno', 'muchos rayos a la vez']],
      values: T.lightning.flash, chart: 'bars', norm: true, color: () => '#ffe640', scan: 'x',
      label: (i, v) => `${lonOf(i)} · ${v < 0.03 ? 'sin rayos' : v < 0.4 ? 'pocos rayos' : 'muchos rayos'}`,
      captions: [
        { i: 0, text: 'Océano Pacífico: algunos rayos sueltos sobre el mar.' },
        { i: 12, text: 'Norteamérica y el golfo de México: primeras tormentas.' },
        { i: 14, text: 'Sudamérica: tormentas sobre la Amazonía. Empiezan los truenos.' },
        { i: 20, text: 'Océano Atlántico: tormentas frente a la costa de África.' },
        { i: 25, text: 'África central: la región con más rayos del planeta. El trueno no para.' },
        { i: 30, text: 'Oriente Medio y el océano Índico: casi en silencio.' },
        { i: 37, text: 'Sudeste asiático e Indonesia: vuelven las tormentas tropicales.' },
        { i: 41, text: 'Australia y el Pacífico: los últimos tambores.' }
      ]
    }
  ];

  // ---------- Estado y elementos ----------
  const audio = $('audio'), chart = $('chart'), cctx = chart.getContext('2d'), scan = $('scan'), sctx = scan.getContext('2d');
  let cur = 0, lastCaption = -1, wantPlay = false, lastIdx = -2, snippetTimer = 0;

  // ---------- Accesibilidad: texto para escuchar, guía por voz y anuncios ----------
  // Convierte las etiquetas visuales ("45° N · agua cálida") en frases que se leen bien en voz alta
  function speakable(s) {
    return String(s)
      .replace(/ · /g, ', ')
      .replace(/(\d)° N\b/g, '$1 grados norte').replace(/(\d)° S\b/g, '$1 grados sur')
      .replace(/(\d)° O\b/g, '$1 grados oeste').replace(/(\d)° E\b/g, '$1 grados este')
      .replace(/(\d)°(?!C)/g, '$1 grados')
      .replace(/°C/g, ' grados').replace(/ppm/g, 'partes por millón').replace(/km²/g, 'kilómetros cuadrados')
      .replace(/CO₂/g, 'CO2').replace(/→/g, 'a').replace(/–/g, ' a ');
  }

  const synth = 'speechSynthesis' in window ? window.speechSynthesis : null;
  let voiceOn = false, esVoice = null, introDone = {};
  function pickVoice() {
    if (!synth) return;
    const vs = synth.getVoices();
    esVoice = vs.find((v) => /^es(-|_)(MX|US|419)/i.test(v.lang)) || vs.find((v) => /^es/i.test(v.lang)) || null;
  }
  if (synth) { pickVoice(); synth.addEventListener && synth.addEventListener('voiceschanged', pickVoice); }

  // Habla con la voz del navegador; mientras habla, la música baja para que se entienda
  function speak(text, opts = {}) {
    if (!synth) return;
    if (opts.interrupt) synth.cancel();
    const clean = speakable(text);
    // Frase a frase: Chrome corta en silencio las locuciones largas
    const parts = clean.split(/(?<=[.;:])\s+/).filter(Boolean);
    let done = false;
    const finish = () => { if (done) return; done = true; clearTimeout(guard); if (opts.then) opts.then(); };
    // Por si el navegador nunca avisa del final: seguir igualmente
    const guard = opts.then ? setTimeout(finish, 4000 + clean.length * 90) : 0;
    parts.forEach((p, k) => {
      const u = new SpeechSynthesisUtterance(p);
      u.lang = esVoice ? esVoice.lang : 'es-ES';
      if (esVoice) u.voice = esVoice;
      u.rate = 1.05;
      u.onstart = () => { audio.volume = 0.25; };
      u.onend = u.onerror = () => {
        if (!synth.speaking && !synth.pending) audio.volume = 1;
        if (k === parts.length - 1) finish();
      };
      synth.speak(u);
    });
  }

  // Anuncia un mensaje: por voz si la guía está activa, si no por el lector de pantalla
  function announce(text, opts) {
    if (voiceOn) { speak(text, Object.assign({ interrupt: true }, opts)); return; }
    const el = $('srAnnounce');
    el.textContent = '';
    setTimeout(() => { el.textContent = speakable(text); }, 30);
    if (opts && opts.then) opts.then();
  }

  function setVoice(on, silent) {
    voiceOn = !!on && !!synth;
    const b = $('voiceBtn');
    b.setAttribute('aria-pressed', String(voiceOn));
    b.textContent = voiceOn ? '🔊 Guía por voz activada (tecla V)' : '🔊 Activar guía por voz (tecla V)';
    // Con guía por voz, los subtítulos no se anuncian dos veces por el lector de pantalla
    $('caption').setAttribute('aria-live', voiceOn ? 'off' : 'polite');
    try { localStorage.setItem('eij-voz', voiceOn ? '1' : '0'); } catch (e) { /* sin almacenamiento */ }
    if (silent) return;
    if (voiceOn) {
      speak(`Guía por voz activada. Estás en la pista ${cur + 1} de ${TRACKS.length}: ${TRACKS[cur].title}. ` +
        'Pulsa espacio para escuchar. Primero te explico qué significa cada sonido. ' +
        'Usa las flechas o los números del 1 al 6 para cambiar de pista, la D para saber qué suena, y la H para la ayuda.', { interrupt: true });
    } else {
      if (synth) synth.cancel();
      audio.volume = 1;
      announce('Guía por voz desactivada.');
    }
  }

  function introText(tr) {
    return `Pista ${cur + 1}: ${tr.title}. ${tr.sub}. ${tr.story} Qué escuchas: ` +
      tr.legend.map(([a, b]) => `${a}, ${b}`).join('; ') + '.';
  }

  // Resumen de la gráfica para quien no la ve
  function chartSummary(tr) {
    const v = tr.values, n = v.length;
    let first = 0, last = n - 1, top = -1;
    while (first < n && v[first] === null) first++;
    while (last > 0 && v[last] === null) last--;
    for (let i = 0; i < n; i++) if (v[i] !== null && (top < 0 || v[i] > v[top])) top = i;
    return `Gráfica de ${n} datos. Empieza en ${tr.label(first, v[first])}. Termina en ${tr.label(last, v[last])}. ` +
      `Valor más alto: ${tr.label(top, v[top])}.`;
  }

  function timing() { return T[TRACKS[cur].key]; }
  function indexAt(time) {
    const t = timing();
    return clamp(Math.floor((time - t.intro) / t.step), -1, t.n - 1);
  }

  // ---------- Carrusel ----------
  function buildThumbs() {
    const ul = $('thumbs');
    TRACKS.forEach((tr, i) => {
      const li = document.createElement('li');
      li.innerHTML = `<button type="button" class="thumb" aria-label="Pista ${i + 1}: ${tr.title}"><img src="${tr.thumb}" alt=""></button>`;
      li.firstChild.addEventListener('click', () => select(i, wantPlay));
      ul.appendChild(li);
    });
  }

  function select(i, autoplay) {
    cur = (i + TRACKS.length) % TRACKS.length;
    const tr = TRACKS[cur];
    document.querySelectorAll('.thumb').forEach((b, k) => b.setAttribute('aria-current', String(k === cur)));
    $('trackNum').textContent = `Pista ${cur + 1} de ${TRACKS.length}`;
    $('trackTitle').textContent = tr.title;
    $('trackSub').textContent = tr.sub;
    $('trackStory').textContent = tr.story;
    $('trackLink').href = tr.link;
    $('downloadBtn').setAttribute('aria-label', `Descargar el audio de ${tr.title}`);
    $('imgA').src = tr.images[0]; $('imgA').alt = tr.imgAlt;
    if (tr.images[1]) $('imgB').src = tr.images[1]; else $('imgB').removeAttribute('src');
    $('imgB').style.opacity = '0'; $('imgB').hidden = !tr.images[1];
    $('legend').innerHTML = tr.legend.map(([a, b]) => `<li class="legend-item"><strong>${a}</strong>${b}</li>`).join('');
    $('timeTotal').textContent = mmss(timing().dur);
    $('chart').setAttribute('aria-label', speakable(chartSummary(tr)));
    lastCaption = -1; lastIdx = -2;
    clearTimeout(snippetTimer);
    setCaption(`${tr.title}. Pulsa reproducir para escuchar.`);
    updateInstOptions();
    loadAudio(false);
    audio.playbackRate = +$('speed').value;
    if (autoplay) play();
    else {
      wantPlay = false; updatePlayUi();
      if (voiceOn) speak(`Pista ${cur + 1} de ${TRACKS.length}: ${tr.title}. Pulsa espacio para escuchar.`, { interrupt: true });
    }
    draw();
  }

  // ---------- Instrumentos: la pista se sintetiza en el navegador (js/jukebox-musica.js) ----------
  const M = EIJ.musica;
  let inst = 'original';
  const layers = { mel: true, pad: true, bass: true, amb: true };
  try {
    const saved = JSON.parse(localStorage.getItem('eij-instrumentos') || 'null');
    if (saved && saved.inst) inst = saved.inst;
    if (saved && saved.layers) Object.keys(layers).forEach((k) => { if (typeof saved.layers[k] === 'boolean') layers[k] = saved.layers[k]; });
  } catch (e) { /* sin almacenamiento */ }
  function saveMix() { try { localStorage.setItem('eij-instrumentos', JSON.stringify({ inst, layers })); } catch (e) { /* sin almacenamiento */ } }

  function instLabel(id) { return id === 'original' ? `Original (${M.instName(M.original(TRACKS[cur].key)).toLowerCase()})` : M.instName(id); }

  function buildInstOptions() {
    if (!M) { $('instSel').closest('.mix').hidden = true; return; }
    $('instSel').innerHTML = ['original'].concat(M.INST_ORDER).map((id) => `<option value="${id}">${id}</option>`).join('');
    document.querySelectorAll('[data-layer]').forEach((cb) => { cb.checked = layers[cb.dataset.layer]; });
  }
  function updateInstOptions() {
    if (!M) return;
    [...$('instSel').options].forEach((o) => { o.textContent = instLabel(o.value); });
    $('instSel').value = inst;
  }

  // Sintetiza la pista con el instrumento y las capas elegidas (sin congelar la página).
  // keepTime: al cambiar de instrumento o de capas se sigue en el mismo punto; mientras tanto suena la versión anterior.
  let loadToken = 0, audioReady = false;
  async function loadAudio(keepTime) {
    const tr = TRACKS[cur], token = ++loadToken;
    if (!keepTime) { audioReady = false; audio.removeAttribute('src'); audio.load(); }
    let url = tr.file, name = tr.file.split('/').pop();
    if (M) {
      $('mixStatus').textContent = keepTime ? 'Cambiando el sonido…' : 'Preparando la música…';
      try {
        const r = await M.renderAsync(tr.key, inst, layers);
        url = r.url;
        name = `${String(cur + 1).padStart(2, '0')}-${tr.key}-${r.inst}.wav`;
      } catch (e) { console.error('No se pudo sintetizar la pista; uso el audio grabado.', e); }
    }
    if (token !== loadToken) return;   // se eligió otra pista mientras tanto
    $('mixStatus').textContent = '';
    const t = keepTime ? audio.currentTime || 0 : 0, resume = wantPlay && (!keepTime || !audioReady || !audio.paused);
    audio.src = url;
    $('downloadBtn').href = url;
    $('downloadBtn').setAttribute('download', name);
    audio.addEventListener('loadedmetadata', () => {
      if (token !== loadToken) return;
      audioReady = true;
      if (t) audio.currentTime = Math.min(t, duration() - 0.05);
      audio.playbackRate = +$('speed').value;
      if (resume) startAudio();
      draw();
      // Mientras se escucha, se prepara la pista siguiente para que el cambio sea inmediato
      if (M) {
        const next = TRACKS[(cur + 1) % TRACKS.length].key;
        M.keep([tr.key, next]);
        setTimeout(() => { if (token === loadToken) M.prepare(next, inst).catch(() => {}); }, 1500);
      }
    }, { once: true });
  }

  function setInst(id) {
    inst = id; saveMix(); updateInstOptions(); loadAudio(true);
    announce(`Melodía con ${instLabel(id)}.`);
  }

  // ---------- Reproducción ----------
  function startAudio() {
    if (!wantPlay || !audioReady) return;   // si aún se está preparando, sonará al terminar
    audio.playbackRate = +$('speed').value;
    audio.play().catch(() => { wantPlay = false; updatePlayUi(); setCaption('El navegador bloqueó el audio. Pulsa reproducir otra vez.'); });
  }
  function play() {
    wantPlay = true;
    clearTimeout(snippetTimer);
    updatePlayUi();
    // Con guía por voz, la primera vez que suena cada pista se explica antes qué significa cada sonido
    if (voiceOn && !introDone[cur] && audio.currentTime < 0.5) {
      introDone[cur] = true;
      setCaption(TRACKS[cur].story);
      speak(introText(TRACKS[cur]), { interrupt: true, then: () => { if (wantPlay && audio.paused) startAudio(); } });
      return;
    }
    startAudio();
  }
  function pause() {
    wantPlay = false; clearTimeout(snippetTimer); audio.pause();
    if (synth && voiceOn) { synth.cancel(); audio.volume = 1; }
    updatePlayUi();
  }
  function toggle() { if (wantPlay) pause(); else play(); }

  function updatePlayUi() {
    $('playBtn').setAttribute('aria-pressed', String(wantPlay));
    $('playBtn').setAttribute('aria-label', wantPlay ? 'Pausar (barra espaciadora)' : 'Reproducir (barra espaciadora)');
    $('playIcon').textContent = wantPlay ? '❚❚' : '▶';
    $('playText').textContent = wantPlay ? 'Pausa' : 'Reproducir';
  }

  audio.addEventListener('ended', () => {
    if (wantPlay && $('autoNext').checked && cur < TRACKS.length - 1) select(cur + 1, true);
    else { wantPlay = false; updatePlayUi(); }
  });

  // ---------- Subtítulos ----------
  function setCaption(text) { $('caption').textContent = text; }
  function updateCaption(idx) {
    const caps = TRACKS[cur].captions;
    let k = -1;
    for (let j = 0; j < caps.length; j++) if (caps[j].i <= idx) k = j;
    if (k !== lastCaption && k >= 0) {
      lastCaption = k; setCaption(caps[k].text);
      if (voiceOn && wantPlay && !audio.paused) speak(caps[k].text);
    }
  }

  // ---------- Escuchar los datos uno a uno ----------
  function describeNow() {
    const tr = TRACKS[cur], idx = indexAt(audio.currentTime || 0);
    const where = `Pista ${cur + 1}, ${tr.title}. Minuto ${mmss(audio.currentTime)} de ${mmss(duration())}.`;
    const what = idx >= 0 ? ` Ahora suena: ${tr.label(idx, tr.values[idx])}.` : ' Todavía no empiezan los datos.';
    announce(where + what);
  }

  function stepData(dir) {
    const tr = TRACKS[cur], t = timing();
    const idx = clamp(indexAt(audio.currentTime || 0) + dir, 0, t.n - 1);
    audio.currentTime = t.intro + idx * t.step + 0.01;
    lastCaption = -1;
    announce(tr.label(idx, tr.values[idx]));
    // En pausa, suena solo el trozo de ese dato
    if (!wantPlay) {
      clearTimeout(snippetTimer);
      audio.playbackRate = +$('speed').value;
      audio.play().catch(() => {});
      snippetTimer = setTimeout(() => { if (!wantPlay) { audio.pause(); draw(); } },
        Math.max(400, t.step / audio.playbackRate * 1000));
    }
    draw();
  }

  function restart() {
    audio.currentTime = 0; lastCaption = -1; draw();
    announce(`Volviste al principio de ${TRACKS[cur].title}.`);
  }

  // ---------- Dibujo: gráfica, línea de lectura y dato actual ----------
  function fitCanvas(cv) {
    const r = cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    const w = Math.round(r.width * dpr), h = Math.round(r.height * dpr);
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    return dpr;
  }

  function draw() {
    const tr = TRACKS[cur], vals = tr.values, n = vals.length;
    const idx = indexAt(audio.currentTime || 0);
    const t = timing();

    // Gráfica bajo la imagen
    const dpr = fitCanvas(chart), W = chart.width, H = chart.height;
    cctx.clearRect(0, 0, W, H);
    const nums = vals.filter((v) => v !== null);
    const lo = Math.min(...nums), hi = Math.max(...nums);
    const bw = W / n;
    if (tr.chart === 'line') {
      cctx.lineWidth = 2 * dpr;
      for (const pass of [0, 1]) {
        cctx.strokeStyle = pass ? tr.color() : 'rgba(255,255,255,.18)';
        cctx.beginPath();
        const last = pass ? Math.max(0, idx) : n - 1;
        for (let i = 0; i <= last; i++) {
          const x = i * bw, y = H - 4 * dpr - (vals[i] - lo) / (hi - lo) * (H - 8 * dpr);
          if (i === 0) cctx.moveTo(x, y); else cctx.lineTo(x, y);
        }
        if (!pass || idx >= 0) cctx.stroke();
      }
    } else {
      for (let i = 0; i < n; i++) {
        const v = vals[i];
        if (v === null) continue;
        cctx.globalAlpha = i <= idx ? 1 : 0.22;
        cctx.fillStyle = tr.color(v);
        if (tr.chart === 'stripes') cctx.fillRect(i * bw, 0, Math.ceil(bw), H);
        else if (tr.chart === 'dual') {
          // Arriba: luces nuevas · abajo: luces apagadas (misma escala)
          const top = Math.max(hi, ...tr.values2), mid = H / 2;
          const hn = v / top * (mid - 2 * dpr), ho = tr.values2[i] / top * (mid - 2 * dpr);
          cctx.fillRect(i * bw + bw * 0.12, mid - hn, bw * 0.76, hn);
          cctx.fillStyle = tr.color2();
          cctx.fillRect(i * bw + bw * 0.12, mid, bw * 0.76, ho);
        } else {
          const h = tr.norm ? v / hi * H : (0.15 + 0.85 * v) * H;
          cctx.fillRect(i * bw + bw * 0.12, H - h, bw * 0.76, h);
        }
      }
      cctx.globalAlpha = 1;
    }
    if (idx >= 0) {
      cctx.fillStyle = '#fff';
      cctx.fillRect(Math.min(W - 2 * dpr, (idx + 0.5) * bw), 0, 2 * dpr, H);
    }

    // Dato actual sobre la imagen
    $('readout').textContent = idx >= 0 ? tr.label(idx, vals[idx]) : tr.sub;

    // Hielo: la imagen pasa de 1979 a 2012 según el hielo que queda
    if (tr.fade) $('imgB').style.opacity = String(idx >= 0 ? tr.fade(vals[idx]) : 0);

    // Océano: línea que baja por el mapa
    const sd = fitCanvas(scan);
    sctx.clearRect(0, 0, scan.width, scan.height);
    if (tr.scan && idx >= 0) {
      const img = $('imgA'), ar = (img.naturalWidth || 2) / (img.naturalHeight || 1);
      let iw = scan.width, ih = iw / ar;
      if (ih > scan.height) { ih = scan.height; iw = ih * ar; }
      const ox = (scan.width - iw) / 2, oy = (scan.height - ih) / 2;
      const p = clamp(((audio.currentTime - t.intro) / t.step) / n, 0, 1);
      sctx.shadowColor = '#00F0FF';
      if (tr.scan === 'y') {   // de norte a sur
        const y = oy + p * ih;
        sctx.fillStyle = 'rgba(0,0,0,.45)'; sctx.fillRect(ox, oy, iw, y - oy);
        sctx.fillStyle = '#fff'; sctx.shadowBlur = 12 * sd; sctx.fillRect(ox, y - sd, iw, 2 * sd);
      } else {                 // de oeste a este
        const x = ox + p * iw;
        sctx.fillStyle = 'rgba(0,0,0,.35)'; sctx.fillRect(ox, oy, x - ox, ih);
        sctx.fillStyle = '#fff'; sctx.shadowBlur = 12 * sd; sctx.fillRect(x - sd, oy, 2 * sd, ih);
      }
      sctx.shadowBlur = 0;
    }

    updateCaption(idx);
    // El deslizador dice el tiempo y el dato, no un número de 0 a 1000
    if (idx !== lastIdx) {
      lastIdx = idx;
      $('seek').setAttribute('aria-valuetext', speakable(`${mmss(audio.currentTime)} de ${mmss(duration())}` +
        (idx >= 0 ? ` · ${tr.label(idx, vals[idx])}` : '')));
    }
    $('seek').value = String(Math.round(audio.currentTime / duration() * 1000));
    $('timeNow').textContent = mmss(audio.currentTime);
  }

  // Algunos servidores no informan la duración del WAV: se usa la del generador
  function duration() { return isFinite(audio.duration) && audio.duration > 0 ? audio.duration : timing().dur; }

  function mmss(s) { s = Math.max(0, Math.floor(s || 0)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }

  function loop() { if (!audio.paused) draw(); requestAnimationFrame(loop); }

  // ---------- Controles ----------
  $('playBtn').addEventListener('click', toggle);
  $('prevBtn').addEventListener('click', () => select(cur - 1, wantPlay));
  $('nextBtn').addEventListener('click', () => select(cur + 1, wantPlay));
  $('speed').addEventListener('input', (e) => {
    audio.playbackRate = +e.target.value;
    const v = +e.target.value;
    e.target.setAttribute('aria-valuetext', v < 1 ? 'lento' : v > 1 ? 'rápido' : 'normal');
  });
  $('seek').addEventListener('input', (e) => {
    audio.currentTime = +e.target.value / 1000 * duration(); lastCaption = -1; draw();
  });
  audio.addEventListener('loadedmetadata', () => { $('timeTotal').textContent = mmss(duration()); });
  audio.addEventListener('seeked', draw);
  window.addEventListener('resize', draw);

  const how = $('howDialog');
  $('howBtn').addEventListener('click', () => how.showModal());
  $('howClose').addEventListener('click', () => how.close());
  how.addEventListener('click', (e) => { if (e.target === how) how.close(); });

  $('voiceBtn').addEventListener('click', () => setVoice(!voiceOn));
  $('describeBtn').addEventListener('click', describeNow);
  $('stepPrev').addEventListener('click', () => stepData(-1));
  $('stepNext').addEventListener('click', () => stepData(1));
  if (!synth) { $('voiceBtn').hidden = true; }

  $('instSel').addEventListener('change', (e) => setInst(e.target.value));
  document.querySelectorAll('[data-layer]').forEach((cb) => cb.addEventListener('change', () => {
    layers[cb.dataset.layer] = cb.checked; saveMix(); loadAudio(true);
  }));
  function nextInst() {
    const ids = ['original'].concat(M ? M.INST_ORDER : []);
    setInst(ids[(ids.indexOf(inst) + 1) % ids.length]);
  }

  document.addEventListener('keydown', (e) => {
    if (how.open || e.ctrlKey || e.metaKey || e.altKey) return;
    const tag = e.target.tagName;
    if (tag === 'INPUT' && e.target.type === 'range' && (e.key.startsWith('Arrow') || e.key === 'Home' || e.key === 'End')) return;
    const k = e.key.toLowerCase();
    if (e.code === 'Space') {
      if (tag === 'INPUT' && e.target.type === 'checkbox') return;
      e.preventDefault(); if (!e.repeat) toggle();
    } else if (e.key === 'ArrowRight') select(cur + 1, wantPlay);
    else if (e.key === 'ArrowLeft') select(cur - 1, wantPlay);
    else if (/^[1-9]$/.test(e.key) && +e.key <= TRACKS.length) select(+e.key - 1, wantPlay);
    else if (k === 'd') describeNow();
    else if (k === 'v') setVoice(!voiceOn);
    else if (k === 'i') announce(introText(TRACKS[cur]));
    else if (k === 'h') how.showModal();
    else if (k === 'm' && M && tag !== 'SELECT') nextInst();
    else if (e.key === ',') stepData(-1);
    else if (e.key === '.') stepData(1);
    else if (e.key === 'Home') { e.preventDefault(); restart(); }
  });
  // Que la barra espaciadora no "pulse" también el botón enfocado
  document.addEventListener('keyup', (e) => { if (e.code === 'Space' && e.target.tagName === 'BUTTON') e.preventDefault(); });

  // Las imágenes cargan después: redibujar cuando estén
  $('imgA').addEventListener('load', draw);

  buildThumbs();
  buildInstOptions();
  let savedVoice = false;
  try { savedVoice = localStorage.getItem('eij-voz') === '1'; } catch (e) { /* sin almacenamiento */ }
  setVoice(savedVoice, true);
  select(0, false);
  requestAnimationFrame(loop);
})();
