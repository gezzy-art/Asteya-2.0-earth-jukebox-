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

  function drawRadar() {
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

  // Radar: franja vertical de 6 px. Puntero: cuadro de 24×24 px.
  function currentSample() {
    if (state.mode === 'radar') return sampleRegion(state.scanX - 3, 0, 6, H);
    if (!state.pointerActive) return null;
    return sampleRegion(state.px - 12, state.py - 12, 24, 24);
  }

  // Coordenadas del canvas → latitud / longitud dentro de la imagen
  const latOf = (y) => 90 - clamp((y - rect.y) / rect.h, 0, 1) * 180;
  const lonOf = (x) => clamp((x - rect.x) / rect.w, 0, 1) * 360 - 180;
  const fmtLat = (lat) => `${Math.abs(lat).toFixed(0)}°${lat >= 0 ? 'N' : 'S'}`;

  function positionText(short) {
    const geo = activeSource().geo;
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
  const BANDS = 18;
  function currentFeatures() {
    let x, y, w, h, nb;
    if (state.mode === 'radar') { x = state.scanX - 3; y = rect.y; w = 6; h = rect.h; nb = BANDS; }
    else if (state.pointerActive) { x = state.px - 12; y = state.py - 12; w = 24; h = 24; nb = 1; }
    else return null;
    x = Math.round(clamp(x, 0, W - 1)); y = Math.round(clamp(y, 0, H - 1));
    w = Math.max(1, Math.min(Math.round(w), W - x)); h = Math.max(1, Math.min(Math.round(h), H - y));
    let data;
    try { data = ctx.getImageData(x, y, w, h).data; } catch (e) { onReadBlocked(); return null; }
    const bands = [];
    for (let k = 0; k < nb; k++) bands.push({ lat: latOf(y + (k + 0.5) * h / nb), lit: 0, neu: 0, out: 0, flash: 0, peak: 0, n: 0 });
    for (let row = 0; row < h; row++) {
      const bd = bands[Math.min(nb - 1, Math.floor(row * nb / h))];
      for (let col = 0; col < w; col++) {
        const i = (row * w + col) * 4, r = data[i], g = data[i + 1], b = data[i + 2];
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
    }
    return { bands, fmtLat };
  }

  EIJ.render = { canvas, overlay, video, image, activeSource, drawFrame, drawOverlay, currentSample, currentFeatures, positionText };
})();
