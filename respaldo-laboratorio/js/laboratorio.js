/* Laboratorio (laboratorio.html): dibujo, accesibilidad, interfaz y arranque. */

/* ======================================================================
   render
   ====================================================================== */
/* Visor: simulación procedural, archivos locales, capa del escáner y lectura de píxeles. */
(function () {
  'use strict';
  const EIJ = window.EIJ;
  const { W, H, SIM_W, SIM_H, LAND, clamp, state, $ } = EIJ;

  const canvas = $('viewer');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const overlay = $('overlay');
  const octx = overlay.getContext('2d');

  const off = document.createElement('canvas');
  off.width = SIM_W; off.height = SIM_H;
  const offCtx = off.getContext('2d');
  const offImg = offCtx.createImageData(SIM_W, SIM_H);

  // Lienzo diminuto para medir el movimiento entre cuadros
  const MOT_W = 64, MOT_H = 36;
  const mot = document.createElement('canvas');
  mot.width = MOT_W; mot.height = MOT_H;
  const motCtx = mot.getContext('2d', { willReadFrequently: true });
  let prevMot = null;
  let motFrame = 0;

  function makeVideo() {
    const v = document.createElement('video');
    v.muted = true; v.loop = true; v.playsInline = true; v.preload = 'auto';
    return v;
  }

  // Archivo propio del usuario
  const video = makeVideo();
  const image = new Image();

  // Visualizaciones reales del EIC, precargadas por pista
  const eicMedia = EIJ.TRACKS.map((t) => {
    const m = { el: null, ready: false, failed: false };
    const done = () => { if (!m.ready) { m.ready = true; if (EIJ.ui) EIJ.ui.refreshSource(); } };
    const fail = () => { m.failed = true; if (EIJ.ui) EIJ.ui.refreshSource(); };
    if (t.eic.kind === 'video') {
      m.el = makeVideo();
      m.el.addEventListener('canplay', done);
    } else {
      m.el = new Image();
      m.el.addEventListener('load', done);
    }
    m.el.addEventListener('error', fail);
    m.el.src = t.eic.src;
    return m;
  });

  // Qué se dibuja ahora: { kind: 'sim' | 'image' | 'video', el, crop, geo, eic }
  function activeSource() {
    if (EIJ.isFileTrack()) {
      return { kind: state.fileKind, el: state.fileKind === 'video' ? video : image, crop: null, geo: false };
    }
    const tr = EIJ.TRACKS[state.track];
    const m = eicMedia[state.track];
    if (state.useReal && !state.realBlocked && m.ready && !m.failed) {
      return { kind: tr.eic.kind, el: m.el, crop: tr.eic.crop, geo: tr.eic.geo, eic: tr.eic };
    }
    return { kind: 'sim', geo: true };
  }

  // ---------- Fuentes de imagen ----------
  function renderSim(t) {
    const tr = EIJ.TRACKS[state.track];
    const lut = tr.lut, d = offImg.data;
    let i = 0;
    for (let y = 0; y < SIM_H; y++) {
      const v = y / (SIM_H - 1);
      for (let x = 0; x < SIM_W; x++) {
        const u = x / (SIM_W - 1);
        const f = tr.field(u, v, t);
        if (f === LAND) {
          d[i] = 26; d[i + 1] = 30; d[i + 2] = 38;
        } else {
          const k = (clamp(f, 0, 1) * 255) | 0;
          d[i] = lut[k * 3]; d[i + 1] = lut[k * 3 + 1]; d[i + 2] = lut[k * 3 + 2];
        }
        d[i + 3] = 255;
        i += 4;
      }
    }
    offCtx.putImageData(offImg, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(off, 0, 0, W, H);
  }

  // Zona del canvas que ocupa la imagen (sin las bandas negras); sirve para calcular lat/lon
  const rect = { x: 0, y: 0, w: W, h: H };

  // Dibuja la imagen/video (o su recorte) completo, tipo "contain", con bandas negras
  function drawMedia(el, crop) {
    const nw = el.videoWidth || el.naturalWidth, nh = el.videoHeight || el.naturalHeight;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    if (!nw || !nh) return;
    const [sx, sy, sw, sh] = crop || [0, 0, nw, nh];
    const s = Math.min(W / sw, H / sh);
    const dw = sw * s, dh = sh * s;
    Object.assign(rect, { x: (W - dw) / 2, y: (H - dh) / 2, w: dw, h: dh });
    ctx.drawImage(el, sx, sy, sw, sh, rect.x, rect.y, dw, dh);
  }

  // Solo el video visible se reproduce; los demás se pausan
  function syncVideos(active) {
    const vids = [video].concat(eicMedia.filter((m) => m.el.tagName === 'VIDEO').map((m) => m.el));
    vids.forEach((v) => {
      if (v === active.el) { if (v.paused && v.src) v.play().catch(() => {}); }
      else if (!v.paused) v.pause();
    });
  }

  function drawFrame() {
    const src = activeSource();
    syncVideos(src);
    if (src.kind === 'sim') { Object.assign(rect, { x: 0, y: 0, w: W, h: H }); renderSim(state.simT); }
    else drawMedia(src.el, src.crop);
    measureMotion();
  }

  // ---------- Movimiento entre cuadros ----------
  // Diferencia media de color entre el cuadro actual y el de hace ~100 ms (a 64×36 px), suavizada.
  // Medir a intervalos fijos hace que el valor no dependa de los FPS del equipo.
  function measureMotion() {
    const now = performance.now();
    if (now - motFrame < 100) return;
    motFrame = now;
    let data;
    try {
      motCtx.drawImage(canvas, 0, 0, MOT_W, MOT_H);
      data = motCtx.getImageData(0, 0, MOT_W, MOT_H).data;
    } catch (e) { onReadBlocked(); return; }
    if (prevMot) {
      let diff = 0;
      for (let i = 0; i < data.length; i += 4) {
        diff += Math.abs(data[i] - prevMot[i]) + Math.abs(data[i + 1] - prevMot[i + 1]) + Math.abs(data[i + 2] - prevMot[i + 2]);
      }
      const raw = diff / (MOT_W * MOT_H * 3 * 255);
      state.motion = state.motion * 0.8 + clamp(raw * 60, 0, 1) * 0.2;
    }
    prevMot = data;
  }

  // Abierto con file://: el navegador prohíbe leer píxeles de los archivos → volver a la simulación
  function onReadBlocked() {
    if (state.realBlocked) return;
    state.realBlocked = true;
    prevMot = null;
    if (EIJ.ui) EIJ.ui.refreshSource();
  }

  // ---------- Capa del escáner ----------
  function drawGraticule() {
    octx.lineWidth = 1;
    for (let i = 1; i < 12; i++) {
      const x = (W / 12) * i;
      octx.strokeStyle = 'rgba(255,255,255,0.07)';
      octx.beginPath(); octx.moveTo(x, 0); octx.lineTo(x, H); octx.stroke();
    }
    for (let i = 1; i < 6; i++) {
      const y = (H / 6) * i;
      octx.strokeStyle = i === 3 ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.07)';
      octx.setLineDash(i === 3 ? [6, 6] : []);
      octx.beginPath(); octx.moveTo(0, y); octx.lineTo(W, y); octx.stroke();
    }
    octx.setLineDash([]);
  }

  function radarLabel(label, lx, ly) {
    octx.fillStyle = 'rgba(13,14,34,0.75)';
    octx.fillRect(lx, ly, label.length * 7 + 12, 20);
    octx.fillStyle = '#AEB8F2';
    octx.fillText(label, lx + 6, ly + 14);
  }

  // Barrido de arriba a abajo: una línea horizontal que baja
  function drawRadarDown() {
    const y = sweepY();
    const trail = octx.createLinearGradient(0, y - 90, 0, y);
    trail.addColorStop(0, 'rgba(0,240,255,0)');
    trail.addColorStop(1, 'rgba(0,240,255,0.22)');
    octx.fillStyle = trail;
    octx.fillRect(0, y - 90, W, 90);
    octx.save();
    octx.shadowColor = '#AEB8F2'; octx.shadowBlur = 18;
    octx.strokeStyle = '#AEB8F2'; octx.lineWidth = 2;
    octx.beginPath(); octx.moveTo(0, y); octx.lineTo(W, y); octx.stroke();
    octx.restore();
    const label = activeSource().geo ? `LAT ${fmtLat(latOf(y))}` : `${Math.round(state.scanX / sweepLen() * 100)}%`;
    radarLabel(label, 8, clamp(y + 8, 4, H - 24));
  }

  // Barrido del centro hacia afuera: un anillo que se abre desde el centro de la imagen
  function drawRadarRing() {
    const cx = rect.x + rect.w / 2, cy = rect.y + rect.h / 2, r = Math.max(1, state.scanX);
    const trail = octx.createRadialGradient(cx, cy, Math.max(0, r - 90), cx, cy, r);
    trail.addColorStop(0, 'rgba(0,240,255,0)');
    trail.addColorStop(1, 'rgba(0,240,255,0.22)');
    octx.fillStyle = trail;
    octx.beginPath(); octx.arc(cx, cy, r, 0, Math.PI * 2); octx.fill();
    octx.save();
    octx.shadowColor = '#AEB8F2'; octx.shadowBlur = 18;
    octx.strokeStyle = '#AEB8F2'; octx.lineWidth = 2;
    octx.beginPath(); octx.arc(cx, cy, r, 0, Math.PI * 2); octx.stroke();
    octx.restore();
    radarLabel(`${Math.round(r / sweepLen() * 100)}% del centro`, clamp(cx - 50, 4, W - 120), clamp(cy - r - 28, 4, H - 24));
  }

  function drawRadar() {
    if (state.sweep === 'tb') { drawRadarDown(); return; }
    if (state.sweep === 'center') { drawRadarRing(); return; }
    const x = state.scanX;
    const trail = octx.createLinearGradient(x - 90, 0, x, 0);
    trail.addColorStop(0, 'rgba(0,240,255,0)');
    trail.addColorStop(1, 'rgba(0,240,255,0.22)');
    octx.fillStyle = trail;
    octx.fillRect(x - 90, 0, 90, H);
    octx.save();
    octx.shadowColor = '#AEB8F2'; octx.shadowBlur = 18;
    octx.strokeStyle = '#AEB8F2'; octx.lineWidth = 2;
    octx.beginPath(); octx.moveTo(x, 0); octx.lineTo(x, H); octx.stroke();
    octx.restore();
    const lon = lonOf(x);
    const label = activeSource().geo ? `LON ${Math.abs(lon).toFixed(0)}°${lon < 0 ? 'O' : 'E'}` : `${Math.round(x / W * 100)}%`;
    const lx = clamp(x + 8, 4, W - 90);
    octx.fillStyle = 'rgba(13,14,34,0.75)';
    octx.fillRect(lx, 8, label.length * 7 + 12, 20);
    octx.fillStyle = '#AEB8F2';
    octx.fillText(label, lx + 6, 22);
  }

  function drawPointer() {
    if (!state.pointerActive) {
      octx.fillStyle = 'rgba(13,14,34,0.7)';
      octx.fillRect(W / 2 - 170, H - 44, 340, 28);
      octx.fillStyle = '#cbd5e1';
      octx.textAlign = 'center';
      octx.fillText('Mueve el cursor, toca el mapa o usa las flechas ← →', W / 2, H - 26);
      octx.textAlign = 'start';
      return;
    }
    const { px, py } = state;
    octx.save();
    octx.shadowColor = '#00FF87'; octx.shadowBlur = 14;
    octx.strokeStyle = '#00FF87'; octx.lineWidth = 2;
    octx.strokeRect(px - 12, py - 12, 24, 24);
    octx.beginPath(); octx.arc(px, py, 26, 0, Math.PI * 2); octx.stroke();
    octx.restore();
    octx.strokeStyle = 'rgba(0,255,135,0.35)'; octx.lineWidth = 1;
    octx.beginPath();
    octx.moveTo(px, 0); octx.lineTo(px, py - 30); octx.moveTo(px, py + 30); octx.lineTo(px, H);
    octx.moveTo(0, py); octx.lineTo(px - 30, py); octx.moveTo(px + 30, py); octx.lineTo(W, py);
    octx.stroke();
    const lx = clamp(px + 32, 4, W - 110), ly = clamp(py - 34, 4, H - 24);
    octx.fillStyle = 'rgba(13,14,34,0.8)';
    octx.fillRect(lx, ly, 104, 20);
    octx.fillStyle = '#00FF87';
    octx.fillText(positionText(true), lx + 6, ly + 14);
  }

  function drawOverlay() {
    octx.clearRect(0, 0, W, H);
    drawGraticule();
    octx.font = '11px "JetBrains Mono", monospace';
    if (state.mode === 'radar') drawRadar(); else drawPointer();
  }

  // ---------- Lectura de píxeles ----------
  function sampleRegion(x, y, w, h) {
    x = Math.round(clamp(x, 0, W - 1)); y = Math.round(clamp(y, 0, H - 1));
    w = Math.max(1, Math.min(Math.round(w), W - x)); h = Math.max(1, Math.min(Math.round(h), H - y));
    let data;
    try { data = ctx.getImageData(x, y, w, h).data; } catch (e) { onReadBlocked(); return null; }
    let r = 0, g = 0, b = 0;
    const n = data.length / 4;
    for (let i = 0; i < data.length; i += 4) { r += data[i]; g += data[i + 1]; b += data[i + 2]; }
    r /= n; g /= n; b /= n;
    return { r, g, b, lum: (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 };
  }

  // ---------- Dirección del barrido ----------
  // state.scanX es la distancia recorrida por el barrido, en píxeles del canvas:
  //   'lr'     izquierda → derecha: la x de la línea vertical (0..W)
  //   'tb'     arriba → abajo: cuánto ha bajado la línea horizontal desde el borde superior de la imagen
  //            (0..alto de la imagen, sin las bandas negras de arriba y abajo)
  //   'center' del centro hacia afuera: el radio del anillo (0..media diagonal de la imagen)
  const TAU = Math.PI * 2;
  const sweepLen = () => (state.sweep === 'tb' ? rect.h : state.sweep === 'center' ? Math.hypot(rect.w, rect.h) / 2 : W);
  const sweepY = () => rect.y + state.scanX;

  // Recorre los píxeles de un anillo de ~6 px de grosor centrado en la imagen y llama fn(r, g, b, ángulo).
  // Devuelve false si el navegador no deja leer los píxeles.
  function eachRingPixel(radius, fn) {
    const cx = rect.x + rect.w / 2, cy = rect.y + rect.h / 2, R = Math.max(3, radius);
    const x0 = Math.max(0, Math.floor(Math.max(rect.x, cx - R - 3))), y0 = Math.max(0, Math.floor(Math.max(rect.y, cy - R - 3)));
    const x1 = Math.min(W, Math.ceil(Math.min(rect.x + rect.w, cx + R + 3))), y1 = Math.min(H, Math.ceil(Math.min(rect.y + rect.h, cy + R + 3)));
    if (x1 <= x0 || y1 <= y0) return true;
    let data;
    try { data = ctx.getImageData(x0, y0, x1 - x0, y1 - y0).data; } catch (e) { onReadBlocked(); return false; }
    const bw = x1 - x0, steps = Math.max(24, Math.min(720, Math.round(TAU * R / 2)));
    for (const dr of [-2, 0, 2]) {
      for (let k = 0; k < steps; k++) {
        const a = k / steps * TAU;
        const x = Math.round(cx + (R + dr) * Math.cos(a)), y = Math.round(cy + (R + dr) * Math.sin(a));
        if (x < x0 || x >= x1 || y < y0 || y >= y1) continue;   // fuera de la imagen
        const i = ((y - y0) * bw + (x - x0)) * 4;
        fn(data[i], data[i + 1], data[i + 2], a);
      }
    }
    return true;
  }

  function sampleRing(radius) {
    let r = 0, g = 0, b = 0, n = 0;
    if (!eachRingPixel(radius, (pr, pg, pb) => { r += pr; g += pg; b += pb; n++; })) return null;
    if (!n) return { r: 0, g: 0, b: 0, lum: 0 };
    r /= n; g /= n; b /= n;
    return { r, g, b, lum: (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 };
  }

  // Radar: franja de 6 px (vertical, horizontal o en anillo, según la dirección). Puntero: cuadro de 24×24 px.
  function currentSample() {
    if (state.mode === 'radar') {
      if (state.sweep === 'tb') return sampleRegion(rect.x, sweepY() - 3, rect.w, 6);
      if (state.sweep === 'center') return sampleRing(state.scanX);
      return sampleRegion(state.scanX - 3, 0, 6, H);
    }
    if (!state.pointerActive) return null;
    return sampleRegion(state.px - 12, state.py - 12, 24, 24);
  }

  // Coordenadas del canvas → latitud / longitud dentro de la imagen
  const latOf = (y) => 90 - clamp((y - rect.y) / rect.h, 0, 1) * 180;
  const lonOf = (x) => clamp((x - rect.x) / rect.w, 0, 1) * 360 - 180;
  const fmtLat = (lat) => `${Math.abs(lat).toFixed(0)}°${lat >= 0 ? 'N' : 'S'}`;

  function positionText(short) {
    const geo = activeSource().geo;
    if (state.mode === 'radar' && state.sweep === 'center') {
      return `anillo al ${Math.round(state.scanX / sweepLen() * 100)}% del centro hacia el borde`;
    }
    if (state.mode === 'radar' && state.sweep === 'tb') {
      if (!geo) return `Fila ${Math.round(state.scanX / sweepLen() * 100)}% (arriba → abajo)`;
      return `Lat ${fmtLat(latOf(sweepY()))}`;
    }
    if (state.mode === 'radar') {
      if (!geo) return `Columna ${Math.round(state.scanX / W * 100)}% (izq. → der.)`;
      const lon = lonOf(state.scanX);
      return `Lon ${Math.abs(lon).toFixed(1)}°${lon < 0 ? 'O' : 'E'}`;
    }
    if (!state.pointerActive) return 'Puntero inactivo';
    if (!geo) return `X ${Math.round(state.px / W * 100)}% · Y ${Math.round(state.py / H * 100)}%`;
    const lat = latOf(state.py), lon = lonOf(state.px);
    return `${fmtLat(lat)}${short ? ' ' : ', '}${Math.abs(lon).toFixed(0)}°${lon < 0 ? 'O' : 'E'}`;
  }

  // ---------- Detector por bandas (pistas de luces y rayos) ----------
  // Divide la franja del radar (o el cuadro del puntero) en bandas horizontales y, en cada una, cuenta:
  //   lit   píxeles iluminados (luminancia > 0.06)
  //   neu   iluminados morados (luces nuevas: azul > rojo)
  //   out   iluminados naranjas (luces apagadas: rojo > azul)
  //   flash píxeles amarillos saturados (destellos de rayo: rojo y verde altos, azul bajo)
  // Los mapas de luces son casi negros: promediar el color los dejaría en silencio, por eso se cuentan píxeles.
  // Cada banda lleva u (0..1, la altura de su nota) y label (dónde está, en palabras):
  //   barrido izquierda → derecha o en anillo: bandas por latitud, más al norte = más aguda (de 55°S a 70°N)
  //   barrido arriba → abajo: la línea está en una sola latitud, así que las bandas van por longitud, más al este = más aguda
  const BANDS = 18;
  const latU = (lat) => clamp((lat + 55) / 125, 0, 1);
  const fmtLon = (lon) => `${Math.abs(lon).toFixed(0)}°${lon < 0 ? 'O' : 'E'}`;
  const newBand = (u, label) => ({ u, label, lit: 0, neu: 0, out: 0, flash: 0, peak: 0, n: 0 });
  const HINT_NORTH = 'Más al norte, nota más aguda', HINT_EAST = 'Más al este, nota más aguda';

  function countPixel(bd, r, g, b) {
    const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    bd.n++;
    if (lum > bd.peak) bd.peak = lum;
    if ((r + g) / 2 - b > 30 && r > 70 && g > 55) bd.flash++;
    if (lum > 0.06) {
      bd.lit++;
      // Las luces pequeñas quedan tenues al reducir el mapa: basta un matiz leve para clasificarlas
      if (b > r + 4) bd.neu++; else if (r > b + 6) bd.out++;
    }
  }

  function currentFeatures() {
    // Anillo: 18 sectores; la nota de cada uno sale de la latitud del punto del anillo que le toca
    if (state.mode === 'radar' && state.sweep === 'center') {
      const cy = rect.y + rect.h / 2, R = Math.max(3, state.scanX), bands = [];
      for (let k = 0; k < BANDS; k++) {
        const lat = latOf(cy + R * Math.sin((k + 0.5) / BANDS * TAU));
        bands.push(newBand(latU(lat), fmtLat(lat)));
      }
      const ok = eachRingPixel(state.scanX, (r, g, b, a) => countPixel(bands[Math.min(BANDS - 1, Math.floor(a / TAU * BANDS))], r, g, b));
      return ok ? { bands, hint: HINT_NORTH } : null;
    }
    let x, y, w, h, nb, byLon = false;
    if (state.mode === 'radar' && state.sweep === 'tb') { x = rect.x; y = sweepY() - 3; w = rect.w; h = 6; nb = BANDS; byLon = true; }
    else if (state.mode === 'radar') { x = state.scanX - 3; y = rect.y; w = 6; h = rect.h; nb = BANDS; }
    else if (state.pointerActive) { x = state.px - 12; y = state.py - 12; w = 24; h = 24; nb = 1; }
    else return null;
    x = Math.round(clamp(x, 0, W - 1)); y = Math.round(clamp(y, 0, H - 1));
    w = Math.max(1, Math.min(Math.round(w), W - x)); h = Math.max(1, Math.min(Math.round(h), H - y));
    let data;
    try { data = ctx.getImageData(x, y, w, h).data; } catch (e) { onReadBlocked(); return null; }
    const bands = [];
    for (let k = 0; k < nb; k++) {
      if (byLon) bands.push(newBand((k + 0.5) / nb, fmtLon(lonOf(x + (k + 0.5) * w / nb))));
      else { const lat = latOf(y + (k + 0.5) * h / nb); bands.push(newBand(latU(lat), fmtLat(lat))); }
    }
    for (let row = 0; row < h; row++) {
      for (let col = 0; col < w; col++) {
        const i = (row * w + col) * 4;
        const k = byLon ? Math.floor(col * nb / w) : Math.floor(row * nb / h);
        countPixel(bands[Math.min(nb - 1, k)], data[i], data[i + 1], data[i + 2]);
      }
    }
    return { bands, hint: byLon ? HINT_EAST : HINT_NORTH };
  }

  EIJ.render = { canvas, overlay, video, image, activeSource, drawFrame, drawOverlay, currentSample, currentFeatures, positionText, sweepLen };
})();

/* ======================================================================
   a11y
   ====================================================================== */
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
      case 'b': case 'B': if (tag !== 'SELECT') ui.nextSweep(); break;
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

/* ======================================================================
   ui
   ====================================================================== */
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
        ? `Sonando: ${what}. ${SWEEPS[state.sweep].text}.`
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
      ? `Modo barrido. ${SWEEPS[state.sweep].text}.`
      : 'Modo puntero: explora el mapa con el cursor, el dedo o las flechas izquierda y derecha; Shift con flechas arriba y abajo para moverte en vertical.');
  }

  // Dirección del barrido: izquierda → derecha, arriba → abajo o del centro hacia afuera (tecla B)
  const SWEEPS = {
    lr: { text: 'La línea recorre la imagen de izquierda a derecha' },
    tb: { text: 'La línea recorre la imagen de arriba a abajo' },
    center: { text: 'Un anillo se abre desde el centro de la imagen hacia los bordes' }
  };
  const SWEEP_ORDER = ['lr', 'tb', 'center'];
  function setSweep(id) {
    if (!SWEEPS[id]) return;
    state.sweep = id;
    state.scanX = 0;   // cada dirección empieza desde su origen
    $('sweepSelect').value = id;
    if (state.mode !== 'radar') setMode('radar', true);
    announce(`Dirección del barrido: ${SWEEPS[id].text.charAt(0).toLowerCase()}${SWEEPS[id].text.slice(1)}.`);
  }
  const nextSweep = () => setSweep(SWEEP_ORDER[(SWEEP_ORDER.indexOf(state.sweep) + 1) % SWEEP_ORDER.length]);

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
    $('sweepSelect').addEventListener('change', (e) => setSweep(e.target.value));
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

  EIJ.ui = { init, togglePlay, selectTrack, setInstrument, setScale, setMode, setSweep, nextSweep, refreshSource, movePointer, updateTelemetry, stepTrack };
})();

/* ======================================================================
   main
   ====================================================================== */
/* Punto de entrada: inicializa la interfaz y ejecuta el bucle de animación. */
(function () {
  'use strict';
  const EIJ = window.EIJ;
  const { W, state } = EIJ;
  const PASSIVE_SAMPLE_S = 0.15;   // telemetría sin sonido cuando está en pausa

  let lastT = performance.now();
  let passiveAcc = 0;

  function frame(now) {
    const dt = Math.min(0.1, (now - lastT) / 1000);
    lastT = now;
    state.simT += dt * 0.6;

    EIJ.render.drawFrame();

    // El radar avanza PX_PER_TICK píxeles por semicorchea al tempo efectivo (con movimiento)
    const bpm = EIJ.audio.effectiveBpm();
    EIJ.audio.setBpm(bpm);
    if (state.playing && state.mode === 'radar') {
      state.scanX += dt * (bpm / 60) * 4 * EIJ.PX_PER_TICK;
      // Al llegar al final (borde derecho, borde inferior o esquina de la imagen) vuelve a empezar
      const len = EIJ.render.sweepLen();
      if (state.scanX >= len) state.scanX %= len;
    }

    EIJ.render.drawOverlay();

    passiveAcc += dt;
    if (!state.playing && passiveAcc > PASSIVE_SAMPLE_S) {
      passiveAcc = 0;
      const a = EIJ.audio.analyze();
      EIJ.ui.updateTelemetry(a && a.s, a && a.m, false, false);
    }
    requestAnimationFrame(frame);
  }

  EIJ.ui.init();
  requestAnimationFrame(frame);
})();
