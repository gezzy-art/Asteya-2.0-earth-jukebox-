/* Earth Jukebox · motor musical.
 * Convierte los datos de cada pista en música directamente en el navegador, en cuatro capas:
 *   melodía  → los datos (con el instrumento que elija la persona)
 *   acordes  → una progresión armónica suave que acompaña
 *   bajo     → la raíz de cada acorde
 *   ambiente → viento, olas, latidos, truenos y señales (umbrales, alarma de calor)
 * Las reglas dato → nota son las mismas para todos los instrumentos: solo cambia el timbre.
 * El resultado se guarda como WAV en memoria y lo reproduce el <audio> de la página, así siguen
 * funcionando la velocidad, el salto a un dato y la descarga. */
(function () {
  'use strict';
  const EIJ = window.EIJ, T = window.JUKEBOX_TIEMPOS;
  const SR = 24000, TAU = Math.PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const at = (t) => Math.round(t * SR);

  // Tabla de seno: Math.sin es lento en algunos equipos y aquí se llama millones de veces.
  // La fase va en ciclos (0..1).
  const SIN_N = 4096, SIN = new Float32Array(SIN_N + 1);
  for (let i = 0; i <= SIN_N; i++) SIN[i] = Math.sin(TAU * i / SIN_N);
  function fsin(c) {
    c -= Math.floor(c);
    const x = c * SIN_N, i = x | 0;
    return SIN[i] + (SIN[i + 1] - SIN[i]) * (x - i);
  }

  // Ruido determinista: el mismo dato suena siempre igual
  let seed = 7;
  const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);

  // ---------- Escalas y acordes ----------
  const MAJOR = [0, 2, 4, 5, 7, 9, 11], MINOR = [0, 2, 3, 5, 7, 8, 10];
  const PENTA = [0, 2, 4, 7, 9], PENTA_MIN = [0, 3, 5, 7, 10];
  const PROG = { major: [0, 5, 3, 4], minor: [0, 5, 2, 6] };   // I–vi–IV–V · i–VI–III–VII

  function deg(root, scale, k) {
    const n = scale.length, o = Math.floor(k / n), s = ((k % n) + n) % n;
    return root + 12 * o + scale[s];
  }
  // El grado más cercano a k que sea nota del acorde que empieza en el grado d (d, d+2, d+4)
  function snap(k, d) {
    for (let r = 0; r < 4; r++) {
      for (const c of [k - r, k + r]) {
        const m = (((c - d) % 7) + 7) % 7;
        if (m === 0 || m === 2 || m === 4) return c;
      }
    }
    return k;
  }
  function padChord(root, sc, d) {
    const off = d >= 4 ? -12 : 0;
    return [0, 2, 4].map((x) => deg(root, sc, d + x) + off);
  }
  function inBass(m) { while (m > 47) m -= 12; while (m < 36) m += 12; return m; }

  // ---------- Bloques de sonido ----------
  // Parciales con caída exponencial (osciladores por recurrencia: rápidos y afinados)
  function partials(b, t, f, a, len, parts, attack) {
    const start = at(t), n = Math.min(at(len), b.length - start), atk = Math.max(1, attack * SR), tail = Math.min(400, n);
    if (n <= 0) return;
    for (const [r, g, dk] of parts) {
      const w = TAU * f * r / SR;
      if (f * r > SR * 0.45) continue;
      const c = 2 * Math.cos(w), m = Math.exp(-dk / SR);
      let y = 0, yp = -Math.sin(w), env = g * a;
      for (let i = 0; i < n; i++) {
        let e = env;
        if (i < atk) e *= i / atk;
        if (i > n - tail) e *= (n - i) / tail;
        b[start + i] += y * e;
        const ny = c * y - yp; yp = y; y = ny;
        env *= m;
      }
    }
  }

  // Tono sostenido con vibrato (cuerdas, flauta): harm = [[armónico, ganancia]]
  function sustained(b, t, f, a, hold, o) {
    const start = at(t), total = hold + o.release, n = Math.min(at(total), b.length - start);
    if (n <= 0) return;
    const atk = o.attack * SR, holdN = hold * SR, rel = o.release * SR;
    let lp = 0;
    for (const det of o.voices) {
      let ph = 0;
      const f0 = f * (1 + det), hk = [], hg = [];
      o.harm.forEach(([k, g]) => { if (f0 * k < SR * 0.45) { hk.push(k); hg.push(g); } });
      const nh = hk.length, vibRamp = 0.25 * SR;
      for (let i = 0; i < n; i++) {
        const vib = 1 + o.vib * (i < vibRamp ? i / vibRamp : 1) * fsin(o.vibHz * i / SR);
        ph += f0 * vib / SR;
        if (ph >= 1) ph -= 1;
        let s = 0;
        for (let h = 0; h < nh; h++) s += hg[h] * fsin(ph * hk[h]);
        let e = i < atk ? i / atk : 1;
        if (i > holdN) e *= Math.max(0, 1 - (i - holdN) / rel);
        b[start + i] += s * e * a / o.voices.length;
      }
    }
    if (o.breath) {
      for (let i = 0; i < n; i++) {
        lp += 0.25 * ((rnd() * 2 - 1) - lp);
        let e = i < atk ? i / atk : 1;
        if (i > holdN) e *= Math.max(0, 1 - (i - holdN) / rel);
        b[start + i] += lp * e * a * o.breath;
      }
    }
  }

  // Tambor afinado: el tono cae rápido al golpear
  function drum(b, t, f, a) {
    const start = at(t), n = Math.min(at(0.32), b.length - start);
    const m40 = Math.exp(-40 / SR), m11 = Math.exp(-11 / SR);
    let ph = 0, e40 = 1, e11 = a;
    for (let i = 0; i < n; i++) {
      ph += f * (1 + 1.2 * e40) / SR;
      b[start + i] += fsin(ph) * e11;
      e40 *= m40; e11 *= m11;
    }
  }

  // ---------- Instrumentos de la melodía ----------
  // lo / hi: registro cómodo; la pista entera se mueve por octavas para caber en él
  const harpParts = [];
  for (let k = 1; k <= 8; k++) harpParts.push([k, Math.abs(Math.sin(Math.PI * k * 0.18)) / k, 1.1 + 0.9 * k]);

  const INST = {
    arpa: { name: 'Arpa', lo: 43, hi: 96, play: (b, t, f, a) => partials(b, t, f, a, 2.2, harpParts, 0.002) },
    piano: {
      name: 'Piano', lo: 40, hi: 100,
      play(b, t, f, a) {
        const parts = [], br = 1 + f / 900;
        for (let k = 1; k <= 7; k++) {
          const r = k * Math.sqrt(1 + 0.0004 * k * k), g = 1 / Math.pow(k, 1.4), dk = (0.8 + 0.75 * k) * br;
          parts.push([r, g * 0.6, dk], [r * 1.0012, g * 0.4, dk * 1.1]);
        }
        partials(b, t, f, a, 2.6, parts, 0.003);
      }
    },
    marimba: {
      name: 'Marimba', lo: 48, hi: 96,
      play: (b, t, f, a) => partials(b, t, f, a, 1.3, [[1, 1, 4.2], [3.93, 0.32, 13], [9.2, 0.08, 30]], 0.001)
    },
    cuerdas: {
      name: 'Cuerdas', lo: 50, hi: 93,
      play: (b, t, f, a, hold) => sustained(b, t, f, a * 0.7, clamp(hold, 0.12, 1.6), {
        attack: 0.09, release: 0.32, vib: 0.0045, vibHz: 5.3, voices: [-0.0025, 0.0025],
        harm: [[1, 1], [2, 0.42], [3, 0.24], [4, 0.13], [5, 0.08], [6, 0.05]]
      })
    },
    flauta: {
      name: 'Flauta', lo: 60, hi: 98,
      play: (b, t, f, a, hold) => sustained(b, t, f, a, clamp(hold, 0.1, 1.6), {
        attack: 0.05, release: 0.14, vib: 0.005, vibHz: 4.8, voices: [0], breath: 0.08,
        harm: [[1, 1], [2, 0.22], [3, 0.07]]
      })
    },
    campanas: {
      name: 'Campanas', lo: 60, hi: 100,
      play: (b, t, f, a) => partials(b, t, f, a, 1.8,
        [[1, 1, 1.6], [2.01, 0.45, 3], [3, 0.22, 4.4], [4.23, 0.12, 5.7], [5.41, 0.06, 7]], 0.004)
    },
    agua: {
      name: 'Tono suave', lo: 43, hi: 90,
      play: (b, t, f, a) => partials(b, t, f, a, 0.65, [[1, 1, 5.5], [2, 0.25, 5.5], [3, 0.08, 5.5]], 0.025)
    },
    tambores: { name: 'Tambores', lo: 24, hi: 64, play: (b, t, f, a) => drum(b, t, f, a * 1.6) }
  };
  const INST_ORDER = ['arpa', 'piano', 'marimba', 'cuerdas', 'flauta', 'campanas', 'agua', 'tambores'];

  // ---------- Acompañamiento ----------
  function pad(b, t, dur, midis, a) {
    const start = at(t), holdN = dur * SR, rel = 0.7 * SR, atk = 0.35 * SR;
    const n = Math.min(Math.round(holdN + rel), b.length - start);
    for (const m of midis) {
      for (const det of [-0.003, 0.003]) {
        const f = mtof(m) * (1 + det);
        for (const [k, g] of [[1, 1], [2, 0.35], [3, 0.14]]) {
          const w = TAU * f * k / SR, c = 2 * Math.cos(w);
          let y = 0, yp = -Math.sin(w);
          for (let i = 0; i < n; i++) {
            let e = i < atk ? i / atk : 1;
            if (i > holdN) e *= 1 - (i - holdN) / rel;
            b[start + i] += y * e * g * a;
            const ny = c * y - yp; yp = y; y = ny;
          }
        }
      }
    }
  }
  const bassNote = (b, t, m, a, len) => partials(b, t, mtof(m), a, Math.min(len + 0.35, 2.6),
    [[1, 1, 1.6], [2, 0.32, 3.5], [3, 0.08, 6]], 0.012);

  // ---------- Ambiente (portado del generador original) ----------
  const interp = (arr, p) => { if (p <= 0) return arr[0]; if (p >= arr.length - 1) return arr[arr.length - 1]; const k = Math.floor(p), f = p - k; return arr[k] * (1 - f) + arr[k + 1] * f; };
  function drone(b, freq, gainPerSec) {
    for (let i = 0; i < b.length; i++) {
      const s = i / SR, g = interp(gainPerSec, s), c = freq * s;
      b[i] += (fsin(c) + 0.3 * fsin(1.5 * c + 0.05) + 0.15 * fsin(2 * c)) * g;
    }
  }
  function wind(b, gainPerSec, cutoff, lfoHz) {
    let y = 0;
    const a = Math.exp(-TAU * cutoff / SR);
    for (let i = 0; i < b.length; i++) {
      const s = i / SR;
      y = (1 - a) * (rnd() * 2 - 1) + a * y;
      const lfo = lfoHz > 0 ? 0.6 + 0.4 * Math.sin(TAU * lfoHz * s) : 1;
      b[i] += y * interp(gainPerSec, s) * lfo * 4;
    }
  }
  function tick(b, t, a) {
    const start = at(t), n = Math.min(at(0.06), b.length - start);
    const m = Math.exp(-70 / SR);
    let last = 0, e = a;
    for (let i = 0; i < n; i++) { const w = rnd() * 2 - 1; b[start + i] += (w - last) * e; last = w; e *= m; }
  }
  function thump(b, t, a) {
    const start = at(t), n = Math.min(at(0.25), b.length - start), m30 = Math.exp(-30 / SR), m14 = Math.exp(-14 / SR);
    let ph = 0, e30 = 1, e14 = a;
    for (let i = 0; i < n; i++) { ph += (48 + 60 * e30) / SR; b[start + i] += fsin(ph) * e14; e30 *= m30; e14 *= m14; }
  }
  function thunder(b, t, a) {
    const start = at(t), n = Math.min(at(1.8), b.length - start), k = Math.exp(-TAU * 160 / SR);
    const m = Math.exp(-2.2 / SR);
    let y1 = 0, y2 = 0, e = a * 9;
    for (let i = 0; i < n; i++) {
      const tt = i / SR;
      y1 = (1 - k) * (rnd() * 2 - 1) + k * y1; y2 = (1 - k) * y1 + k * y2;
      b[start + i] += y2 * Math.min(1, tt / 0.03) * e * (0.7 + 0.3 * fsin(tt * 23 / TAU));
      e *= m;
    }
  }
  function glide(b, t0, step, freq, amp) {
    const start = at(t0), end = Math.min(b.length, at(t0 + step * (freq.length - 1) + 2));
    let ph = 0;
    for (let i = start; i < end; i++) {
      const p = (i - start) / SR / step, f = interp(freq, p);
      ph += f / SR;
      if (ph >= 1) ph -= 1;
      const env = Math.min(1, (i - start) / (0.5 * SR)) * Math.min(1, (end - i) / (1.5 * SR));
      b[i] += (fsin(ph) + 0.3 * fsin(2 * ph) + 0.1 * fsin(3 * ph)) * amp * env;
    }
  }
  const bell = (b, t, m, a, len) => INST.campanas.play(b, t, mtof(m), a, len);
  const perSec = (dur, fn) => { const out = []; for (let s = 0; s <= Math.ceil(dur) + 1; s++) out.push(fn(s)); return out; };

  // ---------- Partituras: de los datos a notas ----------
  // Cada pista devuelve: notas de la melodía, segmentos de acordes, ambiente y su instrumento original.
  function chordSegments(list) {
    const out = [];
    list.forEach((s) => {
      const last = out[out.length - 1];
      if (last && last.d === s.d && last.sc === s.sc && Math.abs(last.end - s.t) < 1e-6) last.end = s.end;
      else out.push(Object.assign({}, s));
    });
    return out;
  }

  const SCORES = {
    // 1 · Temperatura: un año = una nota. Más calor = más aguda. Por encima de +0.5 °C, tono menor.
    temp() {
      const A = EIJ.GISTEMP.anomalies, intro = 1, step = 0.32, n = A.length, root = 50, dur = intro + n * step + 4.5;
      const notes = [], steps = [];
      for (let i = 0; i < n; i++) {
        const a = A[i], t = intro + i * step, u = clamp((a + 0.55) / 1.85, 0, 1), minor = a > 0.5;
        const sc = minor ? MINOR : MAJOR, d = PROG[minor ? 'minor' : 'major'][Math.floor(i / 4) % 4];
        let k = Math.round(u * 14);
        if (i % 2 === 0) k = snap(k, d);
        notes.push({ t, midi: deg(root, sc, k), vel: 0.45 + 0.35 * u, hold: 0.42 });
        steps.push({ t, end: t + step, d, sc });
      }
      const tEnd = intro + n * step;
      [0, 2, 4, 7].forEach((x, j) => notes.push({ t: tEnd + 0.1 + j * 0.09, midi: deg(root, MINOR, x), vel: 0.5, hold: 2.6 }));
      const chords = chordSegments(steps);
      chords.push({ t: tEnd, end: tEnd + 3.2, d: 0, sc: MINOR });
      return {
        dur, step, intro, n, root, notes, chords, inst: 'arpa', wet: 0.3, amb: { level: 0.03 },
        ambience(b) {
          drone(b, mtof(38), perSec(dur, (s) => 0.03 + 0.09 * clamp((s - intro) / (n * step), 0, 1)));
          for (let i = 0; i < n; i++) {
            const a = A[i], t = intro + i * step;
            if (a > 0.8) { tick(b, t, 0.12 + 0.2 * (a - 0.8)); thump(b, t, 0.25); }   // alarma de calor
          }
        }
      };
    },

    // 2 · Hielo: un año = un arpegio. Más hielo = más notas y más volumen; el viento crece con el que falta.
    ice() {
      const E = EIJ.SEAICE.extent, intro = 1, step = 0.7, n = E.length, root = 57, dur = intro + n * step + 4.5;
      const notes = [], steps = [], OFF = [0, 2, 4, 7, 9, 11, 14];
      for (let i = 0; i < n; i++) {
        const e = E[i], t = intro + i * step, d = PROG.major[Math.floor(i / 2) % 4];
        const count = clamp(Math.round(1 + (e - 3.5) / (7.7 - 3.5) * 6), 1, 7);
        for (let j = 0; j < count; j++) notes.push({ t: t + j * 0.07, midi: deg(root + 12, MAJOR, d + OFF[j]), vel: 0.25 + 0.75 * (e / 7.7), hold: 0.5 });
        steps.push({ t, end: t + step, d, sc: MAJOR });
      }
      const tEnd = intro + n * step;
      notes.push({ t: tEnd + 0.2, midi: root + 24, vel: 0.45, hold: 2.5 });
      const chords = chordSegments(steps);
      chords.push({ t: tEnd, end: tEnd + 3, d: 0, sc: MAJOR });
      return {
        dur, step, intro, n, root, notes, chords, inst: 'campanas', wet: 0.38, amb: { level: 0.035 },
        ambience(b) {
          wind(b, perSec(dur, (s) => { const k = clamp(Math.floor((s - intro) / step), 0, n - 1); return 0.01 + 0.06 * clamp((7.6 - E[k]) / 4, 0, 1); }), 500, 0.15);
        }
      };
    },

    // 3 · Océano: la línea baja de norte a sur, una fila de 5° por segundo; agua cálida = nota aguda.
    ocean() {
      const O = EIJ.OCEAN, intro = 1, step = 1, rows = 36, per = 6, w = O.cols / per, root = 57, dur = intro + rows * step + 3.5;
      const notes = [], steps = [], prog = [0, 3, 5, 4];
      for (let r = 0; r < rows; r++) {
        const d = prog[Math.floor(r / 2) % 4];
        let any = false;
        for (let g = 0; g < per; g++) {
          let s = 0, cnt = 0;
          for (let c = g * w; c < (g + 1) * w; c++) { const v = O.grid[r * O.cols + c]; if (v >= 0) { s += v; cnt++; } }
          if (cnt < w / 4) continue;
          any = true;
          let k = Math.round((s / cnt) * 14);
          if (g % 3 === 0) k = snap(k, d);
          notes.push({ t: intro + r * step + g * (step / per), midi: deg(root, MAJOR, k), vel: 0.35 + 0.65 * (cnt / w), hold: 0.3 });
        }
        if (any) steps.push({ t: intro + r * step, end: intro + (r + 1) * step, d, sc: MAJOR });   // tierra o hielo: silencio
      }
      const tEnd = intro + rows * step;
      notes.push({ t: tEnd + 0.1, midi: root, vel: 0.5, hold: 2 });
      return {
        dur, step, intro, n: rows, root, notes, chords: chordSegments(steps), inst: 'agua', wet: 0.4, amb: { level: 0.03 },
        ambience(b) { wind(b, perSec(dur, () => 0.035), 350, 0.12); }
      };
    },

    // 4 · CO₂: la melodía sube con las ppm y ondula con las estaciones (la respiración de las plantas).
    co2() {
      const P = EIJ.CO2.ppm, intro = 1, step = 0.05, n = P.length, root = 57, dur = intro + n * step + 3.5;
      // Tendencia: media de 12 meses centrada; lo que sobra es la oscilación de cada año
      const trend = P.map((_, i) => { let s = 0, c = 0; for (let j = i - 6; j <= i + 5; j++) if (j >= 0 && j < n) { s += P[j]; c++; } return s / c; });
      const notes = [], steps = [];
      for (let i = 0; i < n; i++) {
        const t = intro + i * step, jan = (i + 2) % 12 === 0;   // la serie empieza en marzo
        const year = Math.floor((i + 2) / 12), d = PROG.minor[year % 4];
        if (jan || i === 0) steps.push({ t, end: Math.min(intro + n * step, t + 12 * step), d, sc: MINOR });
        if (i % 2) continue;
        const u = clamp((trend[i] - 310) / 125, 0, 1);
        let k = clamp(Math.round(u * 14 + (P[i] - trend[i]) * 0.9), 0, 19);
        if (jan || (i + 2) % 12 === 6) k = snap(k, d);
        notes.push({ t, midi: deg(root, MINOR, k), vel: 0.45 + 0.3 * u, hold: 0.17 });
      }
      const tEnd = intro + n * step;
      notes.push({ t: tEnd + 0.1, midi: root + 12, vel: 0.45, hold: 2 });
      const chords = chordSegments(steps);
      chords.push({ t: tEnd, end: tEnd + 2.5, d: 0, sc: MINOR });
      return {
        dur, step, intro, n, root, notes, chords, inst: 'flauta', wet: 0.3, amb: { level: 0.05 },
        ambience(b) {
          glide(b, intro, step, P.map((v) => 110 * Math.pow(2, 2 * clamp((v - 310) / 125, 0, 1))), 0.12);
          const crossed = {};
          for (let i = 0; i < n; i++) {
            const t = intro + i * step, u = clamp((P[i] - 310) / 125, 0, 1);
            if ((i + 2) % 12 === 0) thump(b, t, 0.25 + 0.35 * u);   // latido: un año
            for (const lim of [350, 400, 420]) if (!crossed[lim] && P[i] >= lim) { crossed[lim] = true; bell(b, t, 52, 0.5, 3.5); }
          }
        }
      };
    },

    // 5 · Luces: barrido oeste → este. Luces nuevas = notas agudas; apagadas = tono grave. Más al norte, más aguda.
    lights() {
      const L = T.lights, intro = 1, step = 0.75, cols = L.n, B = 12, root = 50, dur = intro + cols * step + 4;
      const notes = [], steps = [];
      for (let c = 0; c < cols; c++) {
        const t0 = intro + c * step, d = PROG.major[Math.floor(c / 2) % 4];
        steps.push({ t: t0, end: t0 + step, d, sc: MAJOR });
        for (let k = 0; k < B; k++) {
          const t = t0 + k * (step / B), vn = L.gridNeu[c * B + k], vo = L.gridOff[c * B + k];
          if (vn > 0.04) notes.push({ t, midi: deg(62, PENTA, B - 1 - k), vel: 0.25 + 0.75 * Math.sqrt(vn), hold: 0.35 });
          if (vo > 0.04) notes.push({ t, midi: deg(38, PENTA, B - 1 - k), vel: 0.3 + 0.7 * Math.sqrt(vo), hold: 0.6, grave: true });
        }
      }
      const tEnd = intro + cols * step;
      notes.push({ t: tEnd + 0.1, midi: 74, vel: 0.45, hold: 2.5 });
      const chords = chordSegments(steps);
      chords.push({ t: tEnd, end: tEnd + 3, d: 0, sc: MAJOR });
      return {
        dur, step, intro, n: cols, root, notes, chords, inst: 'campanas', wet: 0.35, padLevel: 0.6, amb: { level: 0.025 },
        ambience(b) { drone(b, mtof(38), perSec(dur, () => 0.03)); }
      };
    },

    // 6 · Rayos: barrido oeste → este. Cada zona con rayos = un golpe (más al norte, más agudo); muchos = trueno.
    lightning() {
      const L = T.lightning, intro = 1, step = 0.75, cols = L.n, B = 12, root = 43, dur = intro + cols * step + 4;
      const notes = [], steps = [], hits = [];
      const maxSum = Math.max(...L.flash);
      for (let c = 0; c < cols; c++) {
        const t0 = intro + c * step, d = PROG.minor[Math.floor(c / 2) % 4];
        steps.push({ t: t0, end: t0 + step, d, sc: MINOR });
        for (let k = 0; k < B; k++) {
          const v = L.grid[c * B + k];
          if (v < 0.04) continue;
          const t = t0 + k * (step / B);
          notes.push({ t, midi: deg(root, PENTA_MIN, B - 1 - k), vel: 0.3 + 0.7 * Math.sqrt(v), hold: 0.18 });
          hits.push([t, v]);
        }
      }
      const tEnd = intro + cols * step;
      return {
        dur, step, intro, n: cols, root: 55, notes, chords: chordSegments(steps), inst: 'tambores', wet: 0.3, padLevel: 0.55, amb: { level: 0.06 },
        ambience(b) {
          wind(b, perSec(dur, () => 0.012), 2500, 0);   // lluvia
          hits.forEach(([t, v]) => tick(b, t, 0.08 + 0.25 * v));
          for (let c = 0; c < cols; c++) if (L.flash[c] > 0.45 * maxSum) thunder(b, intro + c * step, 0.5 * L.flash[c] / maxSum);
          thunder(b, tEnd + 0.2, 0.3);
        }
      };
    }
  };

  const scores = {};
  function score(key) { return scores[key] || (scores[key] = SCORES[key]()); }

  // ---------- Render de cada capa (con caché) ----------
  const stems = {};
  const buf = (s) => new Float32Array(Math.ceil(s.dur * SR));
  function rms(b) { let s = 0; for (let i = 0; i < b.length; i += 4) s += b[i] * b[i]; return Math.sqrt(s / (b.length / 4)); }
  function normalize(b, target) { const r = rms(b); if (r > 1e-6) { const g = target / r; for (let i = 0; i < b.length; i++) b[i] *= g; } return b; }

  // Todas las notas de la pista se mueven las mismas octavas, para no romper la relación dato → altura
  function octaveShift(notes, inst) {
    const ms = notes.filter((x) => !x.grave).map((x) => x.midi);
    if (!ms.length) return 0;
    let lo = Math.min(...ms), hi = Math.max(...ms), sh = 0;
    while (lo + sh < inst.lo) sh += 12;
    while (hi + sh > inst.hi && lo + sh - 12 >= inst.lo) sh -= 12;
    return sh;
  }

  function stem(key, layer, instId) {
    const id = `${key}|${layer}|${instId || ''}`;
    if (stems[id]) return stems[id];
    const s = score(key);
    seed = 7;
    let b = buf(s);
    if (layer === 'mel') {
      const inst = INST[instId], sh = octaveShift(s.notes, inst), grave = buf(s);
      s.notes.forEach((x) => {
        if (x.grave) INST.agua.play(grave, x.t, mtof(x.midi), x.vel, x.hold);
        else inst.play(b, x.t, mtof(x.midi + sh), x.vel, x.hold);
      });
      normalize(b, 0.1);
      normalize(grave, 0.065);
      for (let i = 0; i < b.length; i++) b[i] += grave[i];
    } else if (layer === 'pad') {
      s.chords.forEach((c) => pad(b, c.t, c.end - c.t, padChord(s.root, c.sc, c.d), 1));
      normalize(b, 0.03 * (s.padLevel || 1));
    } else if (layer === 'bass') {
      s.chords.forEach((c) => {
        const len = c.end - c.t, r = inBass(deg(s.root, c.sc, c.d));
        bassNote(b, c.t, r, 1, len >= 1.2 ? len / 2 : len);
        if (len >= 1.2) bassNote(b, c.t + len / 2, inBass(deg(s.root, c.sc, c.d + 4)), 0.75, len / 2);
      });
      normalize(b, 0.04);
    } else {
      s.ambience(b);
      normalize(b, s.amb.level);
    }
    return (stems[id] = b);
  }

  // Reverberación estéreo tipo Schroeder (dos juegos de filtros algo distintos = sensación de espacio)
  function reverb(dry, spread) {
    const scale = SR / 44100, sum = new Float32Array(dry.length);
    for (const c0 of [1116, 1188, 1277, 1356, 1422, 1491]) {
      const c = Math.round((c0 + spread) * scale), line = new Float32Array(c);
      let p = 0, lp = 0;
      for (let i = 0; i < dry.length; i++) {
        const y = line[p]; lp = y * 0.6 + lp * 0.4;
        line[p] = dry[i] + lp * 0.82; p = p + 1 === c ? 0 : p + 1; sum[i] += y;
      }
    }
    for (const a0 of [225, 341, 441]) {
      const c = Math.round((a0 + spread / 3) * scale), line = new Float32Array(c);
      let p = 0;
      for (let i = 0; i < dry.length; i++) {
        const bv = line[p], x = sum[i];
        sum[i] = -x + bv; line[p] = x + bv * 0.5; p = p + 1 === c ? 0 : p + 1;
      }
    }
    return sum;
  }

  // ---------- WAV estéreo de 16 bits ----------
  function wav(L, R, gain) {
    const n = L.length, data = new DataView(new ArrayBuffer(44 + n * 4));
    const str = (o, s) => { for (let i = 0; i < s.length; i++) data.setUint8(o + i, s.charCodeAt(i)); };
    str(0, 'RIFF'); data.setUint32(4, 36 + n * 4, true); str(8, 'WAVE'); str(12, 'fmt ');
    data.setUint32(16, 16, true); data.setUint16(20, 1, true); data.setUint16(22, 2, true);
    data.setUint32(24, SR, true); data.setUint32(28, SR * 4, true); data.setUint16(32, 4, true); data.setUint16(34, 16, true);
    str(36, 'data'); data.setUint32(40, n * 4, true);
    const fadeIn = SR / 50, fadeOut = SR;
    for (let i = 0; i < n; i++) {
      let e = 1;
      if (i < fadeIn) e = i / fadeIn;
      if (i > n - fadeOut) e = (n - i) / fadeOut;
      data.setInt16(44 + i * 4, Math.round(Math.tanh(L[i] * gain) * e * 32000), true);
      data.setInt16(46 + i * 4, Math.round(Math.tanh(R[i] * gain) * e * 32000), true);
    }
    return new Blob([data], { type: 'audio/wav' });
  }

  // ---------- API ----------
  const LAYERS = ['mel', 'pad', 'bass', 'amb'];
  const peaks = {};
  let lastUrl = null;

  // La reverb es lineal: se calcula una vez por capa y luego las capas solo se suman
  const wetStems = {};
  function stereoStem(key, layer, instId) {
    const id = `${key}|${layer}|${instId || ''}`;
    if (wetStems[id]) return wetStems[id];
    const s = score(key), dry = stem(key, layer, instId), n = dry.length;
    delete stems[id];   // ya no hace falta la versión seca
    const wl = reverb(dry, 0), wr = reverb(dry, 23), dw = 1 - s.wet, ww = s.wet * 1.6 / 6;
    for (let i = 0; i < n; i++) { wl[i] = dry[i] * dw + wl[i] * ww; wr[i] = dry[i] * dw + wr[i] * ww; }
    return (wetStems[id] = [wl, wr]);
  }

  const resolveInst = (key, instId) => (!instId || instId === 'original' || !INST[instId] ? score(key).inst : instId);
  const breathe = () => new Promise((r) => setTimeout(r, 0));

  // Prepara las capas una a una, dejando respirar a la página entre una y otra
  async function prepare(key, instId) {
    instId = resolveInst(key, instId);
    for (const l of LAYERS) {
      const id = `${key}|${l}|${l === 'mel' ? instId : ''}`;
      if (!wetStems[id]) { stereoStem(key, l, l === 'mel' ? instId : ''); await breathe(); }
    }
    return instId;
  }

  // Cada pista ocupa decenas de MB en memoria: solo se guardan las pistas indicadas
  function keep(keys) {
    Object.keys(wetStems).forEach((id) => { if (!keys.includes(id.split('|')[0])) delete wetStems[id]; });
  }

  function mixdown(key, instId, on) {
    const n = Math.ceil(score(key).dur * SR), L = new Float32Array(n), R = new Float32Array(n);
    LAYERS.forEach((l) => {
      if (!on[l]) return;
      const [sl, sr] = stereoStem(key, l, l === 'mel' ? instId : '');
      for (let i = 0; i < n; i++) { L[i] += sl[i]; R[i] += sr[i]; }
    });
    let peak = 1e-9;
    for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
    return { L, R, peak };
  }

  // Devuelve una URL con el WAV de la pista. El volumen se calcula con todas las capas encendidas,
  // así apagar una capa no sube el resto.
  function render(key, instId, on) {
    const s = score(key);
    instId = resolveInst(key, instId);
    const pk = `${key}|${instId}`, all = LAYERS.every((l) => on[l]);
    const m = mixdown(key, instId, on);
    if (!peaks[pk]) peaks[pk] = all ? m.peak : mixdown(key, instId, { mel: true, pad: true, bass: true, amb: true }).peak;
    const url = URL.createObjectURL(wav(m.L, m.R, 0.89 / peaks[pk] * 1.1));
    if (lastUrl) { const old = lastUrl; setTimeout(() => URL.revokeObjectURL(old), 4000); }
    lastUrl = url;
    return { url, inst: instId, dur: s.dur };
  }

  // La página usa estos tiempos para la línea, la gráfica y los subtítulos
  Object.keys(SCORES).forEach((k) => {
    try { T[k].dur = Math.round(score(k).dur * 100) / 100; } catch (e) { /* datos que faltan: se usa el WAV */ }
  });

  EIJ.musica = {
    render,
    // Igual que render, pero sin congelar la página mientras sintetiza
    async renderAsync(key, instId, on) { await prepare(key, instId); return render(key, instId, on); },
    prepare,
    keep,
    INST_ORDER,
    instName: (id) => (INST[id] ? INST[id].name : id),
    original: (key) => score(key).inst
  };
})();
