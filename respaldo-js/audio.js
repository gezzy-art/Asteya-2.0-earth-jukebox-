/* Motor de sonificación con Tone.js: grafo de audio, instrumentos y mapeo píxeles → sonido. */
(function () {
  'use strict';
  const EIJ = window.EIJ;
  const { clamp, mtof, INSTRUMENTS, SCALES, state } = EIJ;

  const audio = (EIJ.audio = {
    available: typeof window.Tone !== 'undefined',
    ready: false
  });

  let filter, reverb, master, limiter, synth, bass, hat;

  // ---------- Mapeo de datos a sonido ----------
  function rootMidi(oct, root = EIJ.currentTrack().root) { return 12 * (oct + 1) + root; }

  // Tres octavas de la escala elegida a partir de la tónica en octava 3
  function scaleMidis(scale = state.scale, root) {
    const steps = SCALES[scale].steps, base = rootMidi(3, root), out = [];
    for (let o = 0; o < 3; o++) steps.forEach((s) => out.push(base + 12 * o + s));
    out.push(base + 36);
    return out;
  }

  /*
   * Calor (rojo − azul) → altura de la nota y apertura del filtro.
   *   Usar el rojo relativo al azul hace que el blanco (anomalía 0) quede en el centro
   *   y que las paletas divergentes azul→rojo de la NASA suenen de grave a agudo.
   * Azul       → bajo profundo (más azul = más grave) y cantidad de reverb.
   * Brillo     → velocidad de la nota y densidad rítmica.
   * Movimiento → tempo y percusión (ver effectiveBpm y onTick).
   */
  function mapSample(s) {
    const bn = s.b / 255, lum = s.lum;
    const warmth = clamp((s.r - s.b) / 220 + 0.5, 0, 1);
    const notes = scaleMidis();
    const idx = Math.round(warmth * (notes.length - 1));
    return {
      notes, idx, n: notes.length, midi: notes[idx], warmth,
      filterHz: 300 + warmth * warmth * 7500,
      wet: clamp((0.08 + bn * 0.75) * state.revAmt, 0, 0.95),
      div: (lum > 0.6 ? 1 : lum > 0.3 ? 2 : 4) * INSTRUMENTS[state.inst].div,
      bassMidi: bn > 0.3 ? rootMidi(bn > 0.6 ? 2 : 3) : null,
      vel: 0.25 + 0.7 * lum,
      silent: lum < 0.04
    };
  }

  // ---------- Instrumentos ----------
  function makeInstrument(i) {
    let s;
    if (i === 0) {
      s = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'fattriangle', count: 3, spread: 24 },
        envelope: { attack: 0.5, decay: 0.3, sustain: 0.7, release: 2.5 }
      });
      s.volume.value = -12;
    } else if (i === 1) {
      s = new Tone.FMSynth({
        harmonicity: 3, modulationIndex: 12,
        oscillator: { type: 'sine' },
        envelope: { attack: 0.005, decay: 0.2, sustain: 0.1, release: 0.4 },
        modulation: { type: 'square' },
        modulationEnvelope: { attack: 0.01, decay: 0.2, sustain: 0.2, release: 0.3 }
      });
      s.volume.value = -10;
    } else {
      s = new Tone.PluckSynth({ attackNoise: 1.2, dampening: 5000, resonance: 0.96 });
      s.volume.value = -2;
    }
    s.connect(filter);
    return s;
  }

  function releaseAll() {
    try {
      if (synth.releaseAll) synth.releaseAll(); else synth.triggerRelease();
      bass.triggerRelease();
    } catch (e) { /* nada sonando */ }
  }

  // Cambia el instrumento; el anterior se libera tras su release para evitar clics
  audio.setInstrument = function (i) {
    if (!audio.ready) return;
    const old = synth;
    synth = makeInstrument(i);
    try { if (old.releaseAll) old.releaseAll(); else old.triggerRelease(); } catch (e) { /* sin notas activas */ }
    setTimeout(() => old.dispose(), 3000);
  };

  // El movimiento de la imagen acelera hasta un 75 % el tempo elegido
  audio.effectiveBpm = () => Math.round(state.bpm * (1 + 0.75 * state.motion));
  audio.setBpm = (bpm) => { if (audio.ready) Tone.Transport.bpm.value = bpm; };
  audio.setVolume = (db) => { if (audio.ready) master.volume.rampTo(db <= -40 ? -Infinity : db, 0.05); };

  // ---------- Pistas con detector propio: luces nocturnas y rayos ----------
  // Inspirado en las sonificaciones de la NASA (p. ej. SVS 13786 · Caldwell 73): el radar avanza en el
  // tiempo de oeste a este y la altura vertical (latitud) decide la nota: más al norte, más aguda.
  const MAX_EVENTS = 3;   // como máximo 3 notas por paso, para que no se vuelva ruido
  let lightBell = null, lightOut = null, drum = null, crack = null;
  function ensureSpecial() {
    if (lightBell) return;
    // Luces nuevas (morado): campanas brillantes
    lightBell = new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 3.01, modulationIndex: 6,
      envelope: { attack: 0.002, decay: 0.9, sustain: 0, release: 0.8 },
      modulationEnvelope: { attack: 0.002, decay: 0.4, sustain: 0, release: 0.3 }
    });
    lightBell.volume.value = -17;
    lightBell.connect(reverb);
    // Luces apagadas (naranja): un tono grave y suave que se desvanece
    lightOut = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sine' },
      envelope: { attack: 0.08, decay: 0.7, sustain: 0.15, release: 1.4 }
    });
    lightOut.volume.value = -9;
    lightOut.connect(reverb);
    // Rayos: tambor (tono según la latitud) + chasquido de ruido
    drum = new Tone.PolySynth(Tone.MembraneSynth, {
      pitchDecay: 0.04, octaves: 4,
      envelope: { attack: 0.001, decay: 0.45, sustain: 0, release: 0.3 }
    });
    drum.volume.value = -9;
    drum.connect(reverb);
    crack = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.1, sustain: 0, release: 0.05 } });
    crack.volume.value = -20;
    crack.chain(new Tone.Filter({ type: 'bandpass', frequency: 2600, Q: 0.8 }), reverb);
  }

  // Latitud → nota de la escala (de 55°S a 70°N, donde hay casi todas las tierras con luces o rayos)
  function latNote(lat, notes) {
    const t = clamp((lat + 55) / 125, 0, 1);
    const idx = Math.round(t * (notes.length - 1));
    return { idx, midi: notes[idx] };
  }

  function latRange(list, fmt) {
    const lats = list.map((b) => b.lat);
    const hi = Math.max(...lats), lo = Math.min(...lats);
    return list.length === 1 || Math.abs(hi - lo) < 5 ? `cerca de ${fmt(hi)}` : `entre ${fmt(lo)} y ${fmt(hi)}`;
  }

  function mapLights(f) {
    const notes = scaleMidis();
    const lit = f.bands.filter((b) => b.lit >= 2);
    // Una banda es "nueva" o "apagada" si ese matiz domina claramente; si no, sin cambio
    const kindOf = (b) => (b.neu > b.out * 1.3 && b.neu >= b.lit * 0.25 ? 'new'
      : b.out > b.neu * 1.3 && b.out >= b.lit * 0.25 ? 'out' : 'same');
    const counts = { new: 0, out: 0, same: 0 };
    lit.forEach((b) => { counts[kindOf(b)]++; });
    const events = lit.slice().sort((a, b) => b.lit - a.lit).slice(0, MAX_EVENTS).map((b) => {
      const { idx, midi } = latNote(b.lat, notes);
      return { kind: kindOf(b), idx, midi, lat: b.lat, vel: clamp(0.3 + (b.lit / b.n) * 5 + b.peak * 0.35, 0.25, 0.95) };
    });
    const totalLit = lit.reduce((a, b) => a + b.lit, 0);
    let desc;
    if (!events.length) desc = 'océano o zona sin luces, en silencio';
    else {
      const parts = [];
      if (counts.new) parts.push(`${counts.new} ${counts.new === 1 ? 'zona' : 'zonas'} con luces nuevas (morado, campanas agudas)`);
      if (counts.out) parts.push(`${counts.out} con luces que se apagaron (naranja, tono grave)`);
      if (counts.same) parts.push(`${counts.same} sin cambio`);
      desc = `${parts.join(', ')}, ${latRange(lit, f.fmtLat)}. Más al norte, nota más aguda`;
    }
    const top = events[0];
    return {
      special: 'lights', events, notes, n: notes.length, desc,
      idx: top ? top.idx : 0, midi: top ? top.midi : notes[0],
      warmth: clamp(totalLit / 120, 0, 1), silent: !events.length, bassMidi: null
    };
  }

  function mapLightning(f) {
    const notes = scaleMidis();
    const hit = f.bands.filter((b) => b.flash >= 1);
    const total = hit.reduce((a, b) => a + b.flash, 0);
    const events = hit.slice().sort((a, b) => b.flash - a.flash).slice(0, MAX_EVENTS).map((b) => {
      const { idx, midi } = latNote(b.lat, notes);
      return { kind: 'flash', idx, midi, lat: b.lat, vel: clamp(0.35 + b.flash * 0.08, 0.35, 1) };
    });
    const desc = events.length
      ? `${total} ${total === 1 ? 'píxel' : 'píxeles'} de rayo en ${hit.length} ${hit.length === 1 ? 'zona' : 'zonas'}, ${latRange(hit, f.fmtLat)}: un tambor por zona${total >= 8 ? ', con trueno grave por la tormenta intensa' : ''}`
      : 'sin rayos en esta franja, en silencio';
    const top = events[0];
    return {
      special: 'lightning', events, notes, n: notes.length, desc, total,
      idx: top ? top.idx : 0, midi: top ? top.midi : notes[0],
      warmth: clamp(total / 12, 0, 1), silent: !events.length, bassMidi: null
    };
  }

  function playSpecial(m, tick, time) {
    ensureSpecial();
    let played = false;
    if (m.special === 'lights') {
      // Corcheas: las ciudades suenan como un arpegio que recorre las latitudes
      if (tick % 2 === 0) {
        filter.frequency.rampTo(5000, 0.1, time);
        reverb.wet.rampTo(clamp(0.45 * state.revAmt + 0.15, 0, 0.9), 0.3, time);
        m.events.forEach((e, k) => {
          const t = time + k * 0.045;
          if (e.kind === 'new') lightBell.triggerAttackRelease(mtof(e.midi + 12), '8n', t, e.vel);
          else if (e.kind === 'out') lightOut.triggerAttackRelease(mtof(e.midi - 12), '4n', t, e.vel * 0.8);
          else synth.triggerAttackRelease(mtof(e.midi), '8n', t, e.vel * 0.6);
        });
        played = m.events.length > 0;
      }
    } else {
      // Semicorcheas: cada zona con destellos es un golpe de tambor con un pequeño "flam"
      reverb.wet.rampTo(clamp(0.35 * state.revAmt + 0.1, 0, 0.9), 0.3, time);
      m.events.forEach((e, k) => {
        const t = time + k * 0.03;
        drum.triggerAttackRelease(mtof(e.midi - 24), '16n', t, e.vel);
        crack.triggerAttackRelease('32n', t, e.vel * 0.7);
      });
      if (m.total >= 8 && tick % 2 === 0) bass.triggerAttackRelease(mtof(rootMidi(1)), '8n', time, 0.7);
      played = m.events.length > 0;
    }
    return played;
  }

  // Lee lo que hay bajo el radar o el puntero y lo traduce a sonido (sin tocarlo todavía)
  audio.analyze = function () {
    const s = EIJ.render.currentSample();
    if (!s) return null;
    const tr = EIJ.currentTrack();
    if (tr.sonify) {
      const f = EIJ.render.currentFeatures();
      if (!f) return null;
      return { s, m: tr.sonify === 'lights' ? mapLights(f) : mapLightning(f) };
    }
    return { s, m: mapSample(s) };
  };

  // ---------- Ciclo del escáner (cada semicorchea) ----------
  function onTick(time) {
    const a = audio.analyze();
    const tick = state.tick++;
    if (!a) { Tone.Draw.schedule(() => EIJ.ui.updateTelemetry(null), time); return; }
    const { s, m } = a;
    if (m.special) {
      const p = playSpecial(m, tick, time);
      Tone.Draw.schedule(() => EIJ.ui.updateTelemetry(s, m, p, false), time);
      return;
    }
    filter.frequency.rampTo(m.filterHz, 0.1, time);
    reverb.wet.rampTo(m.wet, 0.3, time);

    let played = false;
    if (!m.silent && tick % m.div === 0) {
      const inst = INSTRUMENTS[state.inst];
      const f = mtof(m.midi);
      if (state.inst === 0) {
        const chord = [f];
        if (m.idx + 2 < m.n) chord.push(mtof(m.notes[m.idx + 2]));
        synth.triggerAttackRelease(chord, inst.dur, time, m.vel * 0.8);
      } else {
        synth.triggerAttackRelease(f, inst.dur, time, m.vel);
      }
      played = true;
    }

    let bassPlayed = false;
    if (m.bassMidi !== null && tick % 8 === 0 && !m.silent) {
      bass.triggerAttackRelease(mtof(m.bassMidi), '2n', time, clamp(s.b / 255, 0.3, 0.95));
      bassPlayed = true;
    }

    // Percusión según el movimiento: corcheas con poco cambio, semicorcheas con mucho
    const mv = state.motion;
    if (mv > 0.12 && (mv > 0.45 || tick % 2 === 0)) {
      hat.triggerAttackRelease('32n', time, clamp(0.15 + mv * 0.8, 0, 1));
    }
    Tone.Draw.schedule(() => EIJ.ui.updateTelemetry(s, m, played, bassPlayed), time);
  }

  // ---------- Grafo de audio ----------
  // synth → filtro → reverb → volumen → limitador → salida
  // bajo  ─────────→ reverb
  async function init() {
    await Tone.start();
    filter = new Tone.Filter({ type: 'lowpass', frequency: 2000, Q: 1.2 });
    reverb = new Tone.Reverb({ decay: 5, preDelay: 0.02, wet: 0.3 });
    master = new Tone.Volume(state.volDb);
    limiter = new Tone.Limiter(-2);
    filter.connect(reverb);
    reverb.connect(master);
    master.connect(limiter);
    limiter.toDestination();

    bass = new Tone.MonoSynth({
      oscillator: { type: 'sine' },
      filter: { Q: 1, type: 'lowpass', rolloff: -24 },
      envelope: { attack: 0.05, decay: 0.4, sustain: 0.6, release: 1.5 },
      filterEnvelope: { attack: 0.05, decay: 0.3, sustain: 0.4, release: 1, baseFrequency: 90, octaves: 2.5 }
    });
    bass.volume.value = -4;
    bass.connect(reverb);

    hat = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.06, sustain: 0, release: 0.02 }
    });
    hat.volume.value = -22;
    hat.chain(new Tone.Filter({ type: 'highpass', frequency: 7000 }), master);

    synth = makeInstrument(state.inst);
    Tone.Transport.bpm.value = state.bpm;
    new Tone.Loop(onTick, '16n').start(0);
    audio.ready = true;
  }

  // Debe llamarse tras una interacción del usuario (clic o tecla)
  audio.start = async function () {
    if (!audio.ready) await init();
    Tone.Transport.start();
  };

  // ---------- Recorrido · capítulo 1: un año de GISTEMP = un pulso ----------
  // t: 0..1 (anomalía normalizada). Debajo de +0.5 °C suena en Pentatónica Mayor;
  // por encima, la armonía pasa a Menor Natural (tensión). Sobre +0.8 °C entra la percusión.
  audio.ensure = async () => { if (!audio.ready) await init(); };
  audio.yearNote = function (anomaly, t, index) {
    const time = Tone.now() + 0.03;
    const root = EIJ.TRACKS[0].root;
    const notes = scaleMidis(anomaly > 0.5 ? 1 : 0, root);
    const midi = notes[Math.round(t * (notes.length - 1))];
    filter.frequency.rampTo(300 + t * t * 7200, 0.15, time);
    reverb.wet.rampTo(clamp(0.55 - 0.35 * t, 0.1, 0.6) * (0.4 + state.revAmt), 0.3, time);
    synth.triggerAttackRelease(mtof(midi), '8n', time, 0.35 + 0.55 * t);
    if (index % 4 === 0) bass.triggerAttackRelease(mtof(rootMidi(2, root)), '2n', time, 0.5 + 0.4 * t);
    if (anomaly > 0.8) {
      hat.triggerAttackRelease('32n', time, 0.4 + 0.5 * t);
      if (anomaly > 1.1) hat.triggerAttackRelease('32n', time + 0.07, 0.5);
    }
    return midi;
  };

  // ---------- Recorrido · capítulo del hielo: un acorde de campanas por año ----------
  // count = cuántas notas suenan (más hielo = acorde más lleno). Las notas se tocan casi juntas,
  // en registro agudo y con campanas FM, para que suene a cristal.
  let bell = null;
  audio.iceChord = function (count, vel) {
    if (!bell) {
      bell = new Tone.PolySynth(Tone.FMSynth, {
        harmonicity: 3.01, modulationIndex: 7,
        envelope: { attack: 0.002, decay: 1.4, sustain: 0, release: 1.2 },
        modulationEnvelope: { attack: 0.002, decay: 0.6, sustain: 0, release: 0.4 }
      });
      bell.volume.value = -14;
      bell.connect(filter);
    }
    const time = Tone.now() + 0.03;
    const root = 9;   // La
    const notes = scaleMidis(0, root);
    filter.frequency.rampTo(6500, 0.1, time);
    reverb.wet.rampTo(0.45, 0.3, time);
    for (let k = 0; k < count; k++) {
      bell.triggerAttackRelease(mtof(notes[5 + k]), '4n', time + k * 0.035, vel);
    }
    bass.triggerAttackRelease(mtof(rootMidi(2, root)), '4n', time, 0.35 + 0.08 * count);
  };

  // ---------- Recorrido · capítulo del océano: agua cálida = nota aguda ----------
  // t: 0..1 (índice de temperatura del mar). land = true toca un golpe grave y apagado (tierra).
  audio.warmNote = function (t, vel = 0.6, land = false) {
    const time = Tone.now() + 0.02;
    const root = 9;   // La
    if (land) {
      bass.triggerAttackRelease(mtof(rootMidi(1, root)), '16n', time, 0.25);
      return;
    }
    const notes = scaleMidis(0, root);
    filter.frequency.rampTo(400 + t * t * 6500, 0.1, time);
    reverb.wet.rampTo(0.35 + 0.25 * (1 - t), 0.3, time);   // agua fría = más eco, más "profunda"
    synth.triggerAttackRelease(mtof(notes[Math.round(clamp(t, 0, 1) * (notes.length - 1))]), '8n', time, vel);
  };

  // ---------- Recorrido · capítulo del CO₂: un tono continuo que "respira" ----------
  // Un oscilador suave que sigue la concentración de CO₂ mes a mes: se oye la oscilación de cada
  // año (la respiración de las plantas) y la subida de fondo. co2Set recibe la frecuencia en Hz.
  let co2Osc = null, co2Gain = null;
  audio.co2Start = function () {
    if (!co2Osc) {
      co2Gain = new Tone.Gain(0).connect(reverb);
      const lp = new Tone.Filter({ type: 'lowpass', frequency: 1800, Q: 0.7 }).connect(co2Gain);
      co2Osc = new Tone.FatOscillator({ type: 'triangle', count: 3, spread: 16, frequency: 110 }).connect(lp);
      co2Osc.start();
    }
    reverb.wet.rampTo(0.35, 0.3);
    co2Gain.gain.rampTo(0.22, 0.4);
  };
  audio.co2Set = (hz) => { if (co2Osc) co2Osc.frequency.rampTo(hz, 0.06); };
  audio.co2Stop = () => { if (co2Gain) co2Gain.gain.rampTo(0, 0.5); };
  // Un toque suave cada enero, para marcar el paso de los años
  audio.co2Tick = (hz) => { synth.triggerAttackRelease(hz * 2, '16n', Tone.now() + 0.01, 0.22); };

  // ---------- Ejemplos sonoros del diálogo "Cómo funciona" ----------
  // Usan los mismos instrumentos y escala que la sonificación, programados con Tone.now().
  function playNote(midi, time, vel) {
    synth.triggerAttackRelease(mtof(midi), '8n', time, vel);
  }

  audio.demo = async function (kind) {
    if (!audio.ready) await init();
    const t0 = Tone.now() + 0.05;
    const notes = scaleMidis();
    if (kind === 'warmth') {
      // De frío a calor: la nota sube por la escala y el filtro se abre
      filter.frequency.cancelScheduledValues(t0);
      filter.frequency.setValueAtTime(400, t0);
      filter.frequency.linearRampToValueAtTime(7500, t0 + 2.4);
      for (let i = 0; i < 8; i++) playNote(notes[Math.round(i / 7 * (notes.length - 1))], t0 + i * 0.3, 0.7);
    } else if (kind === 'blue') {
      // Azul claro → azul profundo: el bajo baja una octava y crece la reverb
      reverb.wet.cancelScheduledValues(t0);
      reverb.wet.setValueAtTime(0.2, t0);
      reverb.wet.linearRampToValueAtTime(0.75, t0 + 1.5);
      bass.triggerAttackRelease(mtof(rootMidi(3)), '2n', t0, 0.6);
      bass.triggerAttackRelease(mtof(rootMidi(2)), '1n', t0 + 1.1, 0.95);
    } else if (kind === 'bright') {
      // De oscuro a brillante: más volumen y notas cada vez más seguidas
      let t = t0;
      for (let i = 0; i < 12; i++) {
        const k = i / 11;
        playNote(notes[Math.floor(notes.length / 2) + (i % 3)], t, 0.12 + 0.8 * k);
        t += 0.5 - 0.38 * k;
      }
    } else if (kind === 'motion') {
      // De quieto a mucho movimiento: el hi-hat y las notas se aceleran
      let t = t0;
      for (let i = 0; i < 20; i++) {
        const k = i / 19;
        hat.triggerAttackRelease('32n', t, 0.3 + 0.6 * k);
        if (i % 4 === 0) playNote(notes[Math.floor(notes.length / 2)], t, 0.5);
        t += 0.38 - 0.28 * k;
      }
    } else if (kind === 'lights') {
      // Luces: campanas que suben (luces nuevas, de sur a norte) y luego tonos graves (luces apagadas)
      ensureSpecial();
      [0.2, 0.35, 0.5, 0.65, 0.8].forEach((v, i) => lightBell.triggerAttackRelease(mtof(notes[Math.round(v * (notes.length - 1))] + 12), '8n', t0 + i * 0.25, 0.7));
      [0.6, 0.45].forEach((v, i) => lightOut.triggerAttackRelease(mtof(notes[Math.round(v * (notes.length - 1))] - 12), '4n', t0 + 1.5 + i * 0.5, 0.7));
    } else if (kind === 'lightning') {
      // Rayos: golpes de tambor irregulares, cada vez más seguidos, y un trueno al final
      ensureSpecial();
      let t = t0;
      for (let i = 0; i < 10; i++) {
        const midi = notes[(i * 5) % notes.length] - 24;
        drum.triggerAttackRelease(mtof(midi), '16n', t, 0.5 + 0.05 * i);
        crack.triggerAttackRelease('32n', t, 0.5);
        t += 0.32 - 0.025 * i;
      }
      bass.triggerAttackRelease(mtof(rootMidi(1)), '2n', t + 0.1, 0.9);
    }
  };
  audio.pause = function () {
    if (!audio.ready) return;
    Tone.Transport.pause();
    releaseAll();
  };
})();
