/* Constantes, datasets (pistas), instrumentos, escalas y estado compartido. */
(function () {
  'use strict';
  const EIJ = (window.EIJ = window.EIJ || {});

  // ---------- Utilidades ----------
  const NOTE_ES = ['Do', 'Do♯', 'Re', 'Re♯', 'Mi', 'Fa', 'Fa♯', 'Sol', 'Sol♯', 'La', 'La♯', 'Si'];
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  Object.assign(EIJ, {
    W: 800, H: 450,          // tamaño del canvas principal
    SIM_W: 160, SIM_H: 90,   // resolución interna de la simulación
    PX_PER_TICK: 5,          // píxeles que avanza el radar por semicorchea
    NOTE_ES, clamp,
    mtof: (m) => 440 * Math.pow(2, (m - 69) / 12),
    midiSol: (m) => NOTE_ES[m % 12] + (Math.floor(m / 12) - 1),
    $: (id) => document.getElementById(id)
  });

  function hexToRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }

  // Tabla de 256 colores interpolados a partir de paradas [posición, #hex]
  function buildLut(stops) {
    const lut = new Uint8ClampedArray(256 * 3);
    const cs = stops.map(([p, c]) => [p, hexToRgb(c)]);
    for (let i = 0; i < 256; i++) {
      const t = i / 255;
      let k = 0;
      while (k < cs.length - 2 && t > cs[k + 1][0]) k++;
      const [p0, c0] = cs[k], [p1, c1] = cs[k + 1];
      const f = clamp((t - p0) / (p1 - p0), 0, 1);
      for (let j = 0; j < 3; j++) lut[i * 3 + j] = c0[j] + (c1[j] - c0[j]) * f;
    }
    return lut;
  }

  // ---------- Campos procedurales (modo simulación) ----------
  // Cada función devuelve un valor ~0..1 para la coordenada (u, v) en el instante t.
  const LAND = -99;
  function fieldTemp(u, v, t) {
    const lat = (v - 0.5) * 2;
    return 0.5
      + 0.2 * Math.sin(u * 12.6 + t * 0.35 + Math.sin(v * 5 + t * 0.3) * 1.2)
      + 0.16 * Math.sin(v * 9 - t * 0.45 + u * 4)
      + 0.12 * Math.sin((u + v) * 14 + t * 0.7)
      + 0.22 * Math.pow(Math.abs(lat), 3)   // amplificación polar
      + 0.08 * Math.sin(t * 0.12);
  }
  function fieldOcean(u, v, t) {
    const land = Math.sin(u * 9.5 + 1.3) * Math.cos(v * 6.2 - 0.4) + 0.55 * Math.sin(u * 17 + v * 11 + 2);
    if (land > 1.05) return LAND;
    const a = Math.sin(u * 8 + Math.sin(v * 6 + t * 0.6) * 1.5 + t * 0.3);
    const b = Math.cos(v * 10 - t * 0.4 + Math.cos(u * 5 - t * 0.2) * 2);
    return 0.5 + 0.3 * a * b + 0.18 * Math.sin((u * 3 - v * 2) * 6.28 + t * 0.8) - 0.15 * Math.abs(v - 0.5);
  }
  function fieldCO2(u, v, t) {
    const band = Math.exp(-Math.pow(v - 0.33, 2) * 22);   // banda del hemisferio norte
    const plume = Math.sin(u * 7 - t * 0.5 + Math.sin(v * 3 + t * 0.2) * 2) * (0.5 + 0.5 * Math.sin(v * 4 + t * 0.15));
    return 0.3 + 0.28 * plume + 0.35 * band + 0.12 * Math.sin(u * 19 + v * 13 - t * 1.1) + 0.08 * Math.sin(t * 0.6);
  }
  // Pseudoaleatorio estable a partir de una celda (para ciudades y destellos simulados)
  function hash(a, b) { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); }
  // Luces: casi todo negro; cúmulos de ciudades en naranja (0.62–0.78, apagadas) o morado (0.86–1, nuevas)
  function fieldLights(u, v) {
    const cx = Math.floor(u * 160), cy = Math.floor(v * 90);
    const land = Math.sin(u * 9.5 + 1.3) * Math.cos(v * 6.2 - 0.4) + 0.55 * Math.sin(u * 17 + v * 11 + 2);
    if (land < 0.35 || v < 0.15 || v > 0.8 || hash(cx, cy) < 0.9) return 0.1;
    const k = hash(cy, cx);
    return Math.sin(u * 5 + 1) > 0.55 ? 0.62 + 0.16 * k : 0.86 + 0.14 * k;
  }
  // Rayos: tierra gris oscura y destellos amarillos que cambian ~4 veces por segundo, sobre todo en el trópico
  function fieldLightning(u, v, t) {
    const land = Math.sin(u * 9.5 + 1.3) * Math.cos(v * 6.2 - 0.4) + 0.55 * Math.sin(u * 17 + v * 11 + 2);
    const base = land > 0.35 ? 0.4 : 0.05;
    const tropic = Math.exp(-Math.pow(v - 0.5, 2) * 30);
    const h = hash(Math.floor(u * 160) + Math.floor(t * 4) * 7.3, Math.floor(v * 90));
    return h > 1 - 0.04 * tropic * (land > 0.35 ? 1 : 0.3) ? 0.95 : base;
  }

  // ---------- Pistas ----------
  // Cada pista tiene una visualización real del EIC (eic) y una simulación de respaldo (field + stops).
  // eic.crop = [x, y, ancho, alto] recorta títulos y barras de color para no sonificarlos.
  // eic.geo indica si la imagen es un mapa equirrectangular (permite mostrar lat/lon).
  EIJ.LAND = LAND;
  EIJ.TRACKS = [
    { id: 'temp', name: 'Anomalías de Temperatura Global', short: 'Temperatura', root: 2,
      desc: 'Rojos/naranjas cálidos vs. azules fríos', field: fieldTemp,
      stops: [[0, '#053061'], [0.2, '#2166ac'], [0.38, '#4393c3'], [0.5, '#e8eef2'], [0.62, '#fdae61'], [0.75, '#f46d43'], [0.88, '#d73027'], [1, '#67001f']],
      eic: { kind: 'image', src: 'assets/eic/temperatura-2025.png', crop: [110, 105, 1660, 845], geo: false,
        title: 'Cambio en la temperatura global en 2025 respecto a 1951–1980',
        credit: 'NASA SVS 5603 · GISTEMP v4 (NASA GISS)', url: 'https://svs.gsfc.nasa.gov/5603' } },
    { id: 'ocean', name: 'Corrientes Oceánicas y Temperatura del Mar', short: 'Océanos', root: 9,
      desc: 'Corrientes coloreadas por temperatura', field: fieldOcean,
      stops: [[0, '#020b2a'], [0.25, '#06306b'], [0.5, '#0077b6'], [0.7, '#00c2d1'], [0.85, '#00f0ff'], [1, '#7dff9b']],
      eic: { kind: 'video', src: 'assets/eic/corrientes-oceanicas.webm', crop: null, geo: false,
        title: 'Corrientes superficiales coloreadas por temperatura del mar, 2007–2008 (animación)',
        credit: 'NASA SVS 3912 · modelo ECCO2 (MIT/JPL)', url: 'https://svs.gsfc.nasa.gov/3912' } },
    { id: 'co2', name: 'Gases de Efecto Invernadero / CO₂', short: 'CO₂', root: 4,
      desc: 'Morados, rojos y amarillos', field: fieldCO2,
      stops: [[0, '#1a0533'], [0.25, '#4b1080'], [0.45, '#8e1c8f'], [0.65, '#d6304f'], [0.82, '#f77f2a'], [1, '#fde725']],
      eic: { kind: 'image', src: 'assets/eic/co2-dyamond.jpg', crop: [0, 0, 1024, 540], geo: false,
        title: 'Dióxido de carbono en la atmósfera, enero de 2020 (Asia y Oceanía)',
        credit: 'NASA SVS 5196 · modelo GEOS, simulación DYAMOND', url: 'https://svs.gsfc.nasa.gov/5196' } },
    // sonify: estas pistas no usan el mapeo de color general, sino un detector propio (ver audio.js)
    { id: 'lights', name: 'Luces Nocturnas 2012 → 2023', short: 'Luces', root: 7, sonify: 'lights',
      desc: 'Morado = luces nuevas, naranja = luces apagadas', field: fieldLights,
      stops: [[0, '#000000'], [0.5, '#030308'], [0.62, '#6a4520'], [0.78, '#ffb060'], [0.8, '#2a1a40'], [0.86, '#5a3a9a'], [1, '#d8b8ff']],
      eic: { kind: 'image', src: 'assets/eic/luces-nocturnas-cambio.jpg', crop: null, geo: true,
        title: 'Cambio en la iluminación nocturna entre 2012 y 2023 (morado = luces nuevas, naranja = luces apagadas)',
        credit: 'NASA SVS 5313 · VIIRS Black Marble', url: 'https://svs.gsfc.nasa.gov/5313' } },
    { id: 'lightning', name: 'Rayos Detectados desde la ISS', short: 'Rayos', root: 2, sonify: 'lightning',
      desc: 'Cada destello amarillo es un rayo', field: fieldLightning,
      stops: [[0, '#0e0e10'], [0.3, '#2a2a2d'], [0.6, '#3c3c3f'], [0.75, '#806a10'], [1, '#ffe640']],
      eic: { kind: 'image', src: 'assets/eic/rayos-iss-2023.jpg', crop: null, geo: true,
        title: 'Rayos detectados desde la Estación Espacial Internacional (un cuadro de la animación 2017–2023)',
        credit: 'NASA SVS 5011 · instrumento LIS en la ISS', url: 'https://svs.gsfc.nasa.gov/5011' } }
  ];
  EIJ.TRACKS.forEach((t) => { t.lut = buildLut(t.stops); });
  EIJ.FILE_TRACK = { id: 'file', name: 'Archivo local', short: 'Archivo', root: 0, desc: '' };
  EIJ.FILE_IDX = EIJ.TRACKS.length;   // índice del archivo local, después de las pistas del EIC

  // ---------- Instrumentos y escalas ----------
  EIJ.INSTRUMENTS = [
    { name: 'Ambient Pad', div: 2, dur: '2n' },
    { name: 'Pulso Espacial', div: 1, dur: '16n' },
    { name: 'Arpa Cristalina', div: 1, dur: '8n' }
  ];
  EIJ.SCALES = [
    { name: 'Pentatónica Mayor', steps: [0, 2, 4, 7, 9] },
    { name: 'Menor Natural', steps: [0, 2, 3, 5, 7, 8, 10] },
    { name: 'Cromática', steps: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] }
  ];

  // ---------- Estado compartido ----------
  EIJ.state = {
    track: 0,            // 0..TRACKS.length-1 pistas, FILE_IDX archivo local
    useReal: true,       // pistas del EIC: visualización real (true) o simulación (false)
    realBlocked: false,  // el navegador no deja leer los píxeles de los archivos (abierto con file://)
    motion: 0,           // 0..1, cuánto cambia la imagen entre cuadros
    fileKind: null,
    fileName: '',
    mode: 'radar',       // 'radar' | 'pointer'
    sweep: 'lr',         // dirección del barrido: 'lr' izquierda → derecha, 'tb' arriba → abajo, 'center' del centro hacia afuera
    inst: 0, scale: 0,
    bpm: 90, volDb: -10, revAmt: 0.6,
    playing: false,
    scanX: 0, px: 400, py: 225, pointerActive: false,
    simT: 0, tick: 0,
    lastSample: null, lastMap: null, lastAnnounce: ''
  };

  EIJ.isFileTrack = () => EIJ.state.track === EIJ.FILE_IDX;
  EIJ.currentTrack = () => (EIJ.isFileTrack() ? EIJ.FILE_TRACK : EIJ.TRACKS[EIJ.state.track]);
})();
