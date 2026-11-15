/* ======================================================================
   futuros-comparar · Echoes of Tomorrow: hoy y el futuro, lado a lado
   ======================================================================
 * Dos mapas: a la izquierda el presente (el mapa real de la NASA de 2025) o un año cercano; a la derecha un año
 * futuro con bajas (SSP1-2.6) o altas emisiones (SSP5-8.5).
 *
 * Cómo se dibuja el futuro (escalado de patrones, una ilustración):
 *  1. Se lee la barra de colores del propio mapa de la NASA (−4 a +4 °C) para saber qué temperatura es cada color.
 *  2. Cada píxel del mapa se pasa a su temperatura local (diferencia con 1951–1980).
 *  3. A esa temperatura se le suma el aumento global proyectado, en proporción a lo que ese lugar ya se calentó en
 *     2025 (mínimo la mitad del aumento), y se vuelve a pintar con la misma barra. Así el Ártico sigue calentándose
 *     más que el trópico, pero todo el mapa sube a la vez.
 * Los números grandes son los del IPCC (js/datos-futuro.js), medidos desde la era preindustrial. */
(function () {
  'use strict';
  const EIJ = window.EIJ || {}, G = EIJ.GISTEMP, F = EIJ.FUTURO;
  const $ = (id) => document.getElementById(id);
  if (!G || !F || !$('comparar')) return;

  const SRC = 'assets/eic/temperatura-2025.png';
  // Zonas de la imagen original (1920×1080), en fracciones: el mapa (sin el título en inglés) y la barra de colores
  const CROP = { x: 100 / 1920, y: 112 / 1080, w: 1680 / 1920, h: 842 / 1080 };
  const BAR = { x0: 663 / 1920, x1: 1257 / 1920, y: 1013 / 1080 };
  const N = 161, VMIN = -4, VMAX = 4;              // muestras de la barra: de −4 a +4 °C, cada 0.05 °C
  const TH2 = 52 * 52;                             // un píxel más lejos que esto de la barra no es dato (fondo, costas, texto)

  const last = G.lastYear, aLast = G.anomalies[G.anomalies.length - 1];
  const SCEN = { bajo: 'low', alto: 'high' };
  const SCEN_TXT = { bajo: 'bajas emisiones', alto: 'altas emisiones' };
  let scen = 'alto';

  const fmt = (v) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(1)} °C`;
  const toPre = (v) => v - F.preind;               // de la referencia 1951–1980 a la preindustrial (1850–1900)

  // Temperatura global de un año, referencia 1951–1980
  function glob(year) {
    if (year <= last) return { mid: G.anomalies[year - G.firstYear], measured: true };
    const j = F.years.indexOf(year), s = F[SCEN[scen]];
    return { mid: s.mid[j], lo: s.lo[j], hi: s.hi[j], measured: false };
  }

  // ---------- Controles ----------
  const yearA = $('yearA'), yearB = $('yearB');
  [[last, `Hoy · ${last} (medido)`], [2030, '2030'], [2040, '2040'], [2050, '2050']].forEach(([y, t]) => {
    const o = document.createElement('option'); o.value = y; o.textContent = t; yearA.appendChild(o);
  });
  const scenBtns = Array.from(document.querySelectorAll('.eot-scen button'));
  scenBtns.forEach((b) => b.addEventListener('click', () => { scen = b.dataset.scen; update(); }));
  yearA.addEventListener('change', update);
  yearB.addEventListener('input', update);

  // ---------- Imagen y barra de colores ----------
  const cA = $('mapA'), cB = $('mapB');
  let W = 0, H = 0, base = null, cmap = null, lut = null, vals = null, canRead = true;

  const img = new Image();
  img.onload = init;
  img.onerror = () => { $('cmpWarn').hidden = false; update(); };
  img.src = SRC;

  function init() {
    const nW = img.naturalWidth, nH = img.naturalHeight;
    W = Math.min(1100, Math.round(CROP.w * nW)); H = Math.round(W * (CROP.h * nH) / (CROP.w * nW));
    [cA, cB].forEach((c) => { c.width = W; c.height = H; });
    const draw = (c) => c.getContext('2d').drawImage(img, CROP.x * nW, CROP.y * nH, CROP.w * nW, CROP.h * nH, 0, 0, W, H);
    draw(cA); draw(cB);
    try {
      // Barra de colores: promedio de 5 filas en el centro de la barra
      const t = document.createElement('canvas'); t.width = nW; t.height = nH;
      const tx = t.getContext('2d'); tx.drawImage(img, 0, 0);
      const y0 = Math.round(BAR.y * nH) - 2, bar = tx.getImageData(0, y0, nW, 5).data;
      cmap = new Uint8ClampedArray(N * 3);
      for (let i = 0; i < N; i++) {
        const x = Math.round(nW * (BAR.x0 + (BAR.x1 - BAR.x0) * i / (N - 1)));
        for (let k = 0; k < 3; k++) {
          let s = 0; for (let r = 0; r < 5; r++) s += bar[(r * nW + x) * 4 + k];
          cmap[i * 3 + k] = s / 5;
        }
      }
      base = cA.getContext('2d').getImageData(0, 0, W, H);
      lut = new Int16Array(1 << 18).fill(-2);
      // Temperatura local de cada píxel (NaN donde no hay dato): sirve para recolorear y para escuchar la foto
      const src = base.data;
      vals = new Float32Array(W * H);
      for (let p = 0, q = 0; p < src.length; p += 4, q++) {
        const c = classify(src[p], src[p + 1], src[p + 2]);
        vals[q] = c < 0 ? NaN : VMIN + (VMAX - VMIN) * c / (N - 1);
      }
      const stops = [];
      for (let i = 0; i < N; i += 16) stops.push(`rgb(${cmap[i * 3]},${cmap[i * 3 + 1]},${cmap[i * 3 + 2]})`);
      $('scaleBar').style.background = `linear-gradient(90deg, ${stops.join(',')})`;
    } catch (e) {
      // Abierta como archivo (file://): el navegador no deja leer los píxeles
      canRead = false; $('cmpWarn').hidden = false;
    }
    update();
  }

  // Índice de la barra (0…N−1) más parecido a un color, o −1 si no es un color de dato. Se guarda por color.
  function classify(r, g, b) {
    const k = ((r >> 2) << 12) | ((g >> 2) << 6) | (b >> 2);
    let c = lut[k];
    if (c !== -2) return c;
    let best = -1, bd = TH2;
    for (let i = 0; i < N; i++) {
      const dr = r - cmap[i * 3], dg = g - cmap[i * 3 + 1], db = b - cmap[i * 3 + 2], d = dr * dr + dg * dg + db * db;
      if (d < bd) { bd = d; best = i; }
    }
    lut[k] = best;
    return best;
  }

  // Pinta en el lienzo el patrón de 2025 calentado delta grados en promedio global.
  // Cada lugar sube delta × (su calentamiento / el global): donde 2025 ya era más cálido (el Ártico) sube más.
  // Los lugares que en 2025 estuvieron frescos suben al menos la mitad del promedio (si no, el escalado los enfriaría).
  const warm = (v, delta) => v + delta * Math.max(0.5, v / aLast);
  function paint(canvas, delta) {
    const ctx = canvas.getContext('2d');
    if (!base) return;
    if (Math.abs(delta) < 1e-6) { ctx.putImageData(base, 0, 0); return; }
    const src = base.data, out = ctx.createImageData(W, H), d = out.data;
    for (let p = 0, q = 0; p < src.length; p += 4, q++) {
      const r = src[p], g = src[p + 1], b = src[p + 2], v = vals[q];
      d[p + 3] = 255;
      if (v !== v) { d[p] = r; d[p + 1] = g; d[p + 2] = b; continue; }   // NaN: no es dato
      const c = Math.round((v - VMIN) / (VMAX - VMIN) * (N - 1));
      const v2 = warm(v, delta);
      let i2 = Math.round((v2 - VMIN) / (VMAX - VMIN) * (N - 1));
      i2 = i2 < 0 ? 0 : i2 > N - 1 ? N - 1 : i2;
      // Conserva el relieve del mapa: misma proporción de brillo entre el píxel y su color de la barra
      const lc = cmap[c * 3] + cmap[c * 3 + 1] + cmap[c * 3 + 2] + 1;
      let s = (r + g + b + 1) / lc; s = s < 0.7 ? 0.7 : s > 1.2 ? 1.2 : s;
      d[p] = cmap[i2 * 3] * s; d[p + 1] = cmap[i2 * 3 + 1] * s; d[p + 2] = cmap[i2 * 3 + 2] * s;
    }
    ctx.putImageData(out, 0, 0);
  }

  // ---------- Textos ----------
  function describe(year, g) {
    const pre = toPre(g.mid);
    if (g.measured) return { big: fmt(pre), sub: `sobre la era preindustrial · ${year}, medido por la NASA (GISTEMP)` };
    return {
      big: fmt(toPre(g.mid)),
      sub: `sobre la era preindustrial · ${year}, ${SCEN_TXT[scen]} · rango de los modelos ${fmt(toPre(g.lo))} a ${fmt(toPre(g.hi))}`
    };
  }

  let raf = 0;
  function update() {
    const yA = +yearA.value, yB = +yearB.value;
    const gA = glob(yA), gB = glob(yB);
    scenBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.scen === scen)));
    $('cardB').classList.toggle('is-low', scen === 'bajo');
    $('yearBOut').textContent = yB;
    yearB.setAttribute('aria-valuetext', `${yB}, ${SCEN_TXT[scen]}`);

    const dA = describe(yA, gA), dB = describe(yB, gB);
    $('bigA').textContent = dA.big; $('subA').textContent = dA.sub;
    $('bigB').textContent = dB.big; $('subB').textContent = dB.sub;
    const tagA = $('tagA');
    tagA.textContent = gA.measured ? 'Medido · NASA' : `Proyección · ${SCEN_TXT[scen]}`;
    tagA.classList.toggle('is-proj', !gA.measured);
    $('tagB').textContent = `Proyección · ${SCEN_TXT[scen]}`;

    const diff = gB.mid - gA.mid;
    $('diffBox').innerHTML = `${fmt(diff)}<small>${yB} vs ${yA}</small>`;
    const nameA = gA.measured ? `Hoy (${yA})` : `En ${yA}, con ${SCEN_TXT[scen]},`;
    $('cmpSummary').textContent =
      `${nameA} el planeta ${gA.measured ? 'está' : 'estaría'} ${fmt(toPre(gA.mid))} sobre la era preindustrial. ` +
      `En ${yB}, con ${SCEN_TXT[scen]}, estaría ${fmt(toPre(gB.mid))} (los modelos dan de ${fmt(toPre(gB.lo))} a ${fmt(toPre(gB.hi))}): ` +
      (Math.abs(diff) < 0.05 ? 'prácticamente igual.' : `${Math.abs(diff).toFixed(1)} °C más ${diff > 0 ? 'caliente' : 'fresco'}.`) +
      (scen === 'bajo' ? ' Reduciendo mucho las emisiones, el calentamiento se frena.' : ' Sin reducir las emisiones, el calor sigue subiendo.');

    const ariaMap = (y, g) => g.measured
      ? `Mapa de la NASA de ${y}: casi todo el planeta en tonos naranjas y rojos; el Ártico es la zona más caliente.`
      : `Ilustración de ${y} con ${SCEN_TXT[scen]}: el mismo patrón de 2025, ${g.mid / aLast > 1.6 ? 'mucho más rojo, con el Ártico y el norte de Asia en rojo oscuro' : 'algo más rojo que hoy'}.`;
    cA.setAttribute('aria-label', ariaMap(yA, gA));
    cB.setAttribute('aria-label', ariaMap(yB, gB));

    if (!base || !canRead) return;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => { paint(cA, gA.mid - aLast); paint(cB, gB.mid - aLast); });
  }

  // ---------- Escuchar cada foto: F = la primera (izquierda), J = la segunda (derecha) ----------
  // Una línea recorre el mapa de oeste a este; cada nota es una franja de longitud y su altura es la temperatura
  // promedio de esa franja (la misma regla de todo el Jukebox: más calor, nota más aguda). Suena de izquierda a
  // derecha en los audífonos. Debajo, un tono grave y continuo con el promedio global. Las dos fotos usan la misma
  // escala, así que se pueden comparar de oído.
  const COLS = 48, STEP = 0.13;
  const PENTA = [0, 2, 4, 7, 9];
  function freq(v) {
    const t = Math.max(0, Math.min(1, (v + 1) / 7));          // −1 °C … +6 °C
    let m = 52 + t * 36, o = Math.floor(m / 12), s = m - o * 12;
    let best = PENTA[0], bd = 99;
    PENTA.concat(12).forEach((p) => { if (Math.abs(p - s) < bd) { bd = Math.abs(p - s); best = p; } });
    m = o * 12 + best;
    return 440 * Math.pow(2, (m - 69) / 12);
  }
  // Temperatura promedio de cada franja de longitud (null si la franja no tiene datos)
  function columns(delta) {
    const out = [];
    for (let c = 0; c < COLS; c++) {
      const x0 = Math.floor(c * W / COLS), x1 = Math.floor((c + 1) * W / COLS);
      let s = 0, n = 0;
      for (let y = 0; y < H; y += 3) for (let x = x0; x < x1; x += 2) {
        const v = vals[y * W + x];
        if (v === v) { s += warm(v, delta); n++; }
      }
      out.push(n > 20 ? s / n : null);
    }
    return out;
  }

  let actx = null, playing = null;
  function stopPhoto() {
    if (!playing) return;
    playing.nodes.forEach((n) => { try { n.stop(); } catch (e) { /* ya parado */ } });
    cancelAnimationFrame(playing.raf);
    playing.scan.hidden = true;
    playing.btn.setAttribute('aria-pressed', 'false');
    playing = null;
  }
  function photoInfo(i) {
    const y = i ? +yearB.value : +yearA.value, g = glob(y);
    const what = g.measured ? `${y}, medido por la NASA` : `${y}, con ${SCEN_TXT[scen]}`;
    return { y, g, text: `${i ? 'Segunda' : 'Primera'} foto: ${what}. ${fmt(toPre(g.mid))} sobre la era preindustrial.` };
  }
  function sonify(i, g) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!actx) actx = new AC();
    actx.resume();
    stopPhoto();
    const cols = vals ? columns(g.mid - aLast) : new Array(COLS).fill(g.mid);
    const t0 = actx.currentTime + 0.08, end = t0 + COLS * STEP, nodes = [];
    const master = actx.createGain(); master.gain.value = 0.55; master.connect(actx.destination);
    // Fondo: el promedio global, dos octavas abajo
    const d = actx.createOscillator(), dg = actx.createGain();
    d.type = 'sine'; d.frequency.value = freq(g.mid) / 4;
    dg.gain.setValueAtTime(0, t0); dg.gain.linearRampToValueAtTime(0.16, t0 + 0.4);
    dg.gain.setValueAtTime(0.16, end); dg.gain.linearRampToValueAtTime(0, end + 0.6);
    d.connect(dg).connect(master); d.start(t0); d.stop(end + 0.7); nodes.push(d);
    cols.forEach((v, k) => {
      if (v == null) return;
      const t = t0 + k * STEP, o = actx.createOscillator(), og = actx.createGain();
      o.type = 'triangle'; o.frequency.value = freq(v);
      og.gain.setValueAtTime(0, t); og.gain.linearRampToValueAtTime(0.32, t + 0.012); og.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
      let node = o.connect(og);
      if (actx.createStereoPanner) { const p = actx.createStereoPanner(); p.pan.value = -0.8 + 1.6 * k / (COLS - 1); node = node.connect(p); }
      node.connect(master); o.start(t); o.stop(t + 0.45); nodes.push(o);
    });
    // Línea que recorre la foto mientras suena
    const card = i ? cB : cA, scan = card.parentElement.querySelector('.eot-scan'), btn = document.querySelector(`[data-photo="${i}"]`);
    scan.hidden = false; btn.setAttribute('aria-pressed', 'true');
    playing = { nodes, scan, btn, raf: 0 };
    const tick = () => {
      if (!playing) return;
      const f = (actx.currentTime - t0) / (end - t0);
      if (f >= 1.05) { stopPhoto(); return; }
      scan.style.left = `${Math.max(0, Math.min(1, f)) * 100}%`;
      playing.raf = requestAnimationFrame(tick);
    };
    tick();
  }
  function playPhoto(i) {
    const J = EIJ.jukebox;
    if (J) J.pause();
    if (playing && playing.btn.dataset.photo === String(i)) { stopPhoto(); return; }
    const info = photoInfo(i), go = () => sonify(i, info.g);
    if (J && J.talking()) J.speak(info.text, { interrupt: true, then: go });
    else { if (J) J.announce(info.text); go(); }
  }
  document.querySelectorAll('[data-photo]').forEach((b) => b.addEventListener('click', () => playPhoto(+b.dataset.photo)));

  // ---------- El asistente explica las teclas al llegar a la comparación ----------
  const section = $('comparar');
  let inView = false, told = false;
  function instructions() {
    const a = photoInfo(0), b = photoInfo(1);
    const nA = a.g.measured ? `hoy, ${a.y}` : `${a.y} con ${SCEN_TXT[scen]}`;
    return `Comparación de dos fotos. La primera es ${nA}; la segunda, ${b.y} con ${SCEN_TXT[scen]}. ` +
      'Presiona la F para escuchar la primera foto, y presiona la J para escuchar la segunda foto. ' +
      'Cuanto más aguda la nota, más calor.';
  }
  function tell() {
    const J = EIJ.jukebox;
    if (J) J.announce(instructions());
  }
  if ('IntersectionObserver' in window) {
    // "Está en la comparación" cuando la sección cruza la franja central de la pantalla
    new IntersectionObserver((es) => {
      inView = es[0].isIntersecting;
      if (inView && !told) { told = true; tell(); }
      if (!inView) stopPhoto();
    }, { rootMargin: '-35% 0px -35% 0px' }).observe(section);
  }
  // Botón "Comparar hoy y el futuro" de la portada: siempre da las instrucciones
  document.querySelectorAll('a[href="#comparar"]').forEach((a) => a.addEventListener('click', () => {
    told = true; setTimeout(tell, 400);
  }));

  // Lo que usa js/jukebox.js: teclas F / J y órdenes de voz («primera foto», «segunda foto», «comparar»)
  EIJ.comparar = {
    active: () => inView || section.contains(document.activeElement),
    play: playPhoto,
    stop: stopPhoto,
    show() {
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      told = true; tell();
    }
  };

  update();
})();
