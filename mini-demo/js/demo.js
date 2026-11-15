/* Mini demo "Escucha la Tierra": datos de la NASA convertidos en sonido,
 * usable sin ver la pantalla (voz guía, sonidos de confirmación, fila guía del teclado y comandos de voz).
 *
 * Dos pistas (1 temperatura, 2 rayos) y un laboratorio sencillo (3, en js/laboratorio.js).
 *
 * Teclado pensado para la fila guía (F y J tienen relieve):
 *   mano izquierda  D = dato anterior · F = reproducir/pausa · G = dato siguiente
 *   mano derecha    H = ayuda · J = ¿qué suena ahora? · K = escucha la diferencia
 *   1 / 2 = pista · 3 = laboratorio · A = voz guía sí/no · Mayús + D/G = saltar 10 · Espacio = comando de voz
 */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };

  // ---------- Datos: temperatura (js/datos.js) ----------
  var G = window.MINI.GISTEMP;
  var FIRST = G.firstYear, DATA = G.anomalies;
  var LAST = FIRST + DATA.length - 1;
  var MAX = Math.max.apply(null, DATA), MIN = Math.min.apply(null, DATA);
  var I_MAX = DATA.indexOf(MAX), I_MIN = DATA.indexOf(MIN);
  var I_05 = DATA.findIndex(function (v) { return v > 0.5; });
  var I_08 = DATA.findIndex(function (v) { return v > 0.8; });

  // ---------- Datos: rayos (js/datos.js) ----------
  var R = window.MINI.RAYOS, RC = R.cols, RR = R.rows, FL = R.flash;
  var FMAX = Math.max.apply(null, FL), I_FMAX = FL.indexOf(FMAX);
  function cell(c, r) { return R.grid[c * RR + r]; }

  // ---------- Paleta de las franjas (la misma del proyecto principal) ----------
  var STOPS = [[0, '#053061'], [0.2, '#2166ac'], [0.38, '#4393c3'], [0.5, '#e8eef2'], [0.62, '#fdae61'], [0.75, '#f46d43'], [0.88, '#d73027'], [1, '#67001f']];
  function hex(c) { return [1, 3, 5].map(function (i) { return parseInt(c.substr(i, 2), 16); }); }
  function color(a) {
    var t = clamp(0.5 + a / 2.4, 0, 1), k = 0;
    while (k < STOPS.length - 2 && t > STOPS[k + 1][0]) k++;
    var p0 = STOPS[k][0], p1 = STOPS[k + 1][0], c0 = hex(STOPS[k][1]), c1 = hex(STOPS[k + 1][1]);
    var f = clamp((t - p0) / (p1 - p0), 0, 1);
    return 'rgb(' + c0.map(function (v, j) { return Math.round(v + (c1[j] - v) * f); }).join(',') + ')';
  }

  // ---------- Portada: franjas a pantalla completa ----------
  var cover = $('portadaStripes');
  function drawCover() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    cover.width = Math.round(cover.clientWidth * dpr);
    cover.height = Math.round(cover.clientHeight * dpr);
    var c = cover.getContext('2d'), sw = cover.width / DATA.length;
    c.fillStyle = '#05070f'; c.fillRect(0, 0, cover.width, cover.height);
    DATA.forEach(function (a, i) { c.fillStyle = color(a); c.fillRect(Math.floor(i * sw), 0, Math.ceil(sw) + 1, cover.height); });
  }
  drawCover();
  window.addEventListener('resize', drawCover);

  // ---------- Textos para leer en voz alta ----------
  function num(a) { return Math.abs(a).toFixed(2).replace('.', ','); }
  function spoken(a) {
    if (a === 0) return 'igual que la media de 1951 a 1980';
    return num(a) + ' grados ' + (a > 0 ? 'por encima' : 'por debajo') + ' de la media';
  }
  function signed(a) { return (a > 0 ? '+' : a < 0 ? '−' : '') + Math.abs(a).toFixed(2) + ' °C'; }

  var HELP = 'Teclas en la fila guía. Mano izquierda: F, la tecla con relieve, reproduce o pausa. ' +
    'D va al dato anterior y G al siguiente; con Mayúsculas saltan diez. ' +
    'Mano derecha: J, la otra tecla con relieve, dice qué suena ahora. H repite esta ayuda. ' +
    'K hace escucha la diferencia. A apaga o enciende esta voz. Escape lo para todo. ' +
    'Con los números cambias de pista: 1 temperatura, 2 rayos, 3 el laboratorio. ' +
    'Con la barra espaciadora puedes decir un comando, por ejemplo: reproducir, pausa, siguiente, rayos, África, año 1950, laboratorio o ayuda.';
  var WELCOME = 'Te damos la bienvenida al Earth Jukebox. Hay dos pistas y un laboratorio: ' +
    'pulsa 1 para la temperatura, 2 para los rayos y 3 para el laboratorio, o H para oír todas las teclas. Ahora estás en la pista 1. ';

  // ---------- Dato -> nota (temperatura) ----------
  var MAJOR = [0, 2, 4, 7, 9], MINOR = [0, 2, 3, 5, 7, 8, 10];
  function noteFor(a) {
    var minor = a > 0.5, scale = minor ? MINOR : MAJOR;
    var t = clamp((a + 0.5) / 1.8, 0, 1);
    var steps = scale.length * 3, i = Math.round(t * (steps - 1));
    var semis = Math.floor(i / scale.length) * 12 + scale[i % scale.length];
    return { freq: 196 * Math.pow(2, semis / 12), minor: minor };
  }

  // ---------- Motor de audio (Web Audio) ----------
  var ctx, master, MUSIC = 0.5;
  function audio() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain(); master.gain.value = MUSIC;
      var delay = ctx.createDelay(); delay.delayTime.value = 0.22;
      var fb = ctx.createGain(); fb.gain.value = 0.25;
      master.connect(ctx.destination);
      master.connect(delay); delay.connect(fb); fb.connect(delay); delay.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function pluck(freq, when, dur, vol) {
    var o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    o.type = 'triangle'; o2.type = 'sine';
    o.frequency.value = freq; o2.frequency.value = freq * 2;
    f.type = 'lowpass'; f.frequency.value = 800 + freq * 4;
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(vol, when + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    o.connect(f); o2.connect(f); f.connect(g); g.connect(master);
    o.start(when); o2.start(when); o.stop(when + dur); o2.stop(when + dur);
  }
  function noise(sec, shape) {
    var len = Math.floor(ctx.sampleRate * sec), buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, shape);
    var s = ctx.createBufferSource(); s.buffer = buf; return s;
  }
  function tick(when, vol) {
    var s = noise(0.05, 1), f = ctx.createBiquadFilter(), g = ctx.createGain();
    f.type = 'highpass'; f.frequency.value = 6000; g.gain.value = vol;
    s.connect(f); f.connect(g); g.connect(master); s.start(when);
  }
  function drum(freq, when, vol) {              // golpe de tambor: tono que cae rápido
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(freq * 1.6, when);
    o.frequency.exponentialRampToValueAtTime(freq, when + 0.06);
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(vol, when + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.35);
    o.connect(g); g.connect(master); o.start(when); o.stop(when + 0.4);
  }
  function thunder(when, vol) {                 // trueno: ruido grave que se apaga despacio
    var s = noise(1.4, 2), f = ctx.createBiquadFilter(), g = ctx.createGain();
    f.type = 'lowpass'; f.frequency.value = 180; g.gain.value = vol;
    s.connect(f); f.connect(g); g.connect(master); s.start(when);
  }
  function duck(on) {                           // baja la música mientras habla la voz
    if (!ctx) return;
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setTargetAtTime(on ? MUSIC * 0.25 : MUSIC, ctx.currentTime, 0.08);
  }
  // Sonidos de confirmación: sube = empieza, baja = para, dos notas = cambio de pista, grave = error
  var EARCONS = { up: [[660, 880]], down: [[880, 660]], track: [[523, 523], [784, 784]], error: [[260, 200], [260, 200]] };
  function earcon(kind) {
    audio();
    var t = ctx.currentTime;
    (EARCONS[kind] || EARCONS.up).forEach(function (f, k) {
      var o = ctx.createOscillator(), g = ctx.createGain(), s = t + k * 0.11;
      o.type = kind === 'error' ? 'square' : 'sine';
      o.frequency.setValueAtTime(f[0], s); o.frequency.linearRampToValueAtTime(f[1], s + 0.1);
      g.gain.setValueAtTime(kind === 'error' ? 0.05 : 0.13, s); g.gain.exponentialRampToValueAtTime(0.0001, s + 0.16);
      o.connect(g); g.connect(ctx.destination); o.start(s); o.stop(s + 0.18);
    });
  }

  // ---------- Voz guía (síntesis de voz) + lector de pantalla ----------
  var voiceOn = true;
  try { voiceOn = localStorage.getItem('eij-mini-voz') !== 'no'; } catch (e) {}
  var synth = window.speechSynthesis, voice = null;
  function pickVoice() {
    if (!synth) return;
    var vs = synth.getVoices();
    voice = vs.find(function (v) { return /^es(-|_)(ES|MX|US|419)/i.test(v.lang); }) ||
            vs.find(function (v) { return /^es/i.test(v.lang); }) || null;
  }
  if (synth) { pickVoice(); synth.onvoiceschanged = pickVoice; }

  function announce(text, opts) {
    opts = opts || {};
    if (voiceOn && synth) {
      if (!opts.queue) synth.cancel();
      var u = new SpeechSynthesisUtterance(text);
      u.lang = voice ? voice.lang : 'es-ES'; if (voice) u.voice = voice;
      u.rate = 1.05;
      u.onstart = function () { duck(true); };
      u.onend = u.onerror = function () { if (!synth.speaking) duck(false); if (opts.then) opts.then(); };
      synth.speak(u);
    } else {
      $('sr').textContent = '';
      setTimeout(function () { $('sr').textContent = text; }, 30);   // fuerza que el lector lo repita
      if (opts.then) setTimeout(opts.then, 400);
    }
  }
  function setVoice(on) {
    voiceOn = on;
    try { localStorage.setItem('eij-mini-voz', on ? 'si' : 'no'); } catch (e) {}
    $('b-voice').setAttribute('aria-pressed', String(on));
    if (!on && synth) synth.cancel();
    $('sr').textContent = '';
    earcon(on ? 'up' : 'down');
    announce(on ? 'Voz guía encendida.' : 'Voz guía apagada. Los avisos pasan al lector de pantalla.');
  }
  $('b-voice').setAttribute('aria-pressed', String(voiceOn));

  // =====================================================================
  // Pista 1: temperatura
  // =====================================================================
  var TEMP = {
    key: 'temp', name: 'Temperatura', n: DATA.length,
    title: 'El planeta se calienta',
    sub: DATA.length + ' años de temperatura global de la NASA, convertidos en sonido. Una nota por año.',
    axis: [FIRST, 1950, LAST],
    fields: ['Año', 'Anomalía', 'Armonía'],
    edge: ['Ya estás en el primer año.', 'Ya estás en el último año.'],
    how: ['<b>Más calor = nota más aguda</b> (de −0.5 °C a +1.3 °C).',
          '<b>Por encima de +0.5 °C</b> la escala pasa de mayor a menor: suena más tensa.',
          '<b>Por encima de +0.8 °C</b> entra un pulso de percusión, como una alarma.',
          '<b>Color de cada franja</b>: azul = más frío que 1951–1980, rojo = más cálido.'],
    source: 'Datos: NASA GISS · <a href="https://data.giss.nasa.gov/gistemp/">GISTEMP v4</a>, anomalía anual respecto a 1951–1980.',
    intro: 'El planeta se calienta. Vas a oír ' + DATA.length + ' años de temperatura global medida por la NASA, de ' +
      FIRST + ' a ' + LAST + '. Cada año es una nota: cuanto más calor, más aguda. ' +
      'Por encima de medio grado la música se vuelve más tensa, y por encima de 0,8 entra un pulso de alarma. Pulsa F para empezar.',
    summary: 'Franjas de calentamiento de ' + FIRST + ' a ' + LAST + '. Empieza en ' + signed(DATA[0]) +
      ', el año más frío es ' + (FIRST + I_MIN) + ' con ' + signed(MIN) + ', el más caliente ' + (FIRST + I_MAX) +
      ' con ' + signed(MAX) + ', y termina en ' + signed(DATA[DATA.length - 1]) + '.',
    end: 'Fin. Así sonaron ' + DATA.length + ' años de datos de la NASA. Pulsa F para volver a empezar, o 2 para escuchar los rayos.',
    build: function (box) {
      return DATA.map(function (a) {
        var d = document.createElement('div');
        d.style.background = color(a);
        box.appendChild(d);
        return d;
      });
    },
    read: function (i) { var a = DATA[i]; return [FIRST + i, signed(a), noteFor(a).minor ? 'Menor' : 'Mayor']; },
    dur: function (i) { return 0.38 - 0.19 * clamp((DATA[i] + 0.2) / 1.4, 0, 1); },   // más calor = más rápido
    sound: function (i, when) {
      var a = DATA[i];
      pluck(noteFor(a).freq, when, 0.9, 0.35);
      if (a > 0.8) tick(when, 0.25);
      if (a > 1.1) tick(when + this.dur(i) / 2, 0.18);
    },
    short: function (i) { var a = DATA[i]; return (FIRST + i) + '. ' + (a > 0 ? 'más ' : a < 0 ? 'menos ' : '') + num(a); },
    describe: function (i) {
      var a = DATA[i], n = noteFor(a);
      return 'Año ' + (FIRST + i) + '. ' + spoken(a) + '. Armonía ' + (n.minor ? 'menor' : 'mayor') +
        (a > 0.8 ? ', con pulso de alarma' : '') + '. Es el año ' + (i + 1) + ' de ' + DATA.length +
        (playing ? ', y sigue sonando.' : ', en pausa.');
    },
    milestone: function (i) {
      var y = FIRST + i;
      if (i === 0) return y + '. Empezamos. Notas graves, escala mayor.';
      if (y === 1944) return '1944. Un pico cálido durante la guerra, y vuelve a bajar.';
      if (i === I_05) return y + '. Supera medio grado. La música pasa a menor.';
      if (i === I_08) return y + '. Supera 0,8 grados. Entra el pulso de alarma.';
      if (i === I_MAX) return y + '. El año más caliente registrado: ' + spoken(MAX) + '.';
      return null;
    },
    cmp: {
      a: 0, b: I_MAX,
      sayA: 'Escucha la diferencia. Primero ' + FIRST + ', ' + spoken(DATA[0]) + '.',
      sayB: 'Ahora ' + (FIRST + I_MAX) + ', el año más caliente: ' + spoken(MAX) + '.',
      end: '¿Notas el salto? Pulsa K para repetir.'
    }
  };

  // =====================================================================
  // Pista 2: rayos vistos desde el espacio
  // =====================================================================
  // Regiones del recorrido de oeste a este: [primera columna, nombre corto, cómo se dice, subtítulo]
  var REGIONS = [
    [0, 'Pacífico', 'el océano Pacífico', 'Océano Pacífico: casi en silencio, algunos rayos sueltos sobre el mar.'],
    [9, 'Norteamérica', 'Norteamérica y el golfo de México', 'Norteamérica y el golfo de México: primeras tormentas.'],
    [14, 'Sudamérica', 'Sudamérica', 'Sudamérica: tormentas sobre la Amazonía. Empiezan los truenos.'],
    [19, 'Atlántico', 'el océano Atlántico', 'Océano Atlántico: tormentas frente a la costa de África.'],
    [24, 'África', 'África', 'África central: la zona con más rayos del planeta. El trueno no para.'],
    [30, 'Oriente Medio e Índico', 'Oriente Medio y el océano Índico', 'Oriente Medio y el océano Índico: casi en silencio.'],
    [35, 'Sudeste asiático', 'el sudeste asiático e Indonesia', 'Sudeste asiático e Indonesia: vuelven las tormentas tropicales.'],
    [41, 'Australia', 'Australia y el Pacífico oeste', 'Australia y el Pacífico: los últimos tambores.'],
    [45, 'Pacífico', 'el océano Pacífico', null]
  ];
  function regionOf(c) { var r = REGIONS[0]; REGIONS.forEach(function (x) { if (c >= x[0]) r = x; }); return r; }
  function lonDeg(c) { return Math.round(-180 + 7.5 * c + 3.75); }
  function lonShort(c) { var l = lonDeg(c); return l === 0 ? '0°' : Math.abs(l) + '° ' + (l < 0 ? 'O' : 'E'); }
  function lonSpoken(c) { var l = lonDeg(c); return l === 0 ? 'cero grados' : Math.abs(l) + ' grados ' + (l < 0 ? 'oeste' : 'este'); }
  function latSpoken(l) { return l === 0 ? 'el ecuador' : Math.abs(l) + ' grados ' + (l > 0 ? 'norte' : 'sur'); }
  function level(v) { return v < 0.03 ? 'sin rayos' : v < 0.4 ? 'pocos rayos' : v < 0.9 ? 'bastantes rayos' : 'muchos rayos'; }
  function activeRows(c) {   // filas con rayos, de más a menos
    var rows = [];
    for (var r = 0; r < RR; r++) if (cell(c, r) >= 0.02) rows.push(r);
    return rows.sort(function (a, b) { return cell(c, b) - cell(c, a); });
  }
  var PENTA = [0, 2, 4, 7, 9];
  function rowFreq(r) { var k = RR - 1 - r; return 110 * Math.pow(2, (Math.floor(k / 5) * 12 + PENTA[k % 5]) / 12); }
  var THUNDER = 0.6;

  var RAYOS = {
    key: 'rayos', name: 'Rayos', n: RC,
    title: 'Rayos vistos desde el espacio',
    sub: 'Los rayos de todo un año detectados desde la Estación Espacial Internacional, de oeste a este. Una columna del planeta por paso.',
    axis: ['180° O', '0°', '180° E'],
    fields: ['Longitud', 'Rayos', 'Región'],
    edge: ['Ya estás en el extremo oeste.', 'Ya estás en el extremo este.'],
    how: ['<b>Una columna = una franja del planeta</b> de 7,5° de longitud, de oeste a este.',
          '<b>Cada zona con rayos es un golpe de tambor</b>: más al norte, más agudo.',
          '<b>Muchos rayos a la vez = trueno</b> grave.',
          '<b>Silencio = sin rayos</b>: casi todo el océano y los polos.'],
    source: 'Datos: NASA · <a href="https://svs.gsfc.nasa.gov/5011">SVS 5011</a>, rayos detectados por el instrumento LIS en la Estación Espacial Internacional (2023).',
    intro: 'Rayos vistos desde el espacio. Un instrumento de la NASA en la Estación Espacial detecta los rayos de todo el planeta. ' +
      'Vas a recorrer el mapa de oeste a este, de América a Asia. Cada zona con rayos es un golpe de tambor: más al norte, más agudo. ' +
      'Donde hay muchos rayos, retumba un trueno. Pulsa F para empezar.',
    summary: 'Mapa de rayos de oeste a este, ' + RC + ' columnas. Casi todos los rayos están en los trópicos. ' +
      'La columna con más rayos está en ' + regionOf(I_FMAX)[2] + ', a ' + lonSpoken(I_FMAX) + '.',
    end: 'Fin. Le diste la vuelta al planeta: los rayos se concentran en los trópicos y sobre tierra firme, sobre todo en África, Sudamérica y el sudeste asiático. Pulsa F para volver a empezar.',
    build: function (box) {
      var cols = [];
      for (var c = 0; c < RC; c++) {
        var col = document.createElement('div');
        for (var r = 0; r < RR; r++) {
          var s = document.createElement('span'), v = cell(c, r);
          if (v > 0) s.style.background = 'rgba(255,230,64,' + Math.min(1, 0.25 + v * 2).toFixed(2) + ')';
          col.appendChild(s);
        }
        box.appendChild(col); cols.push(col);
      }
      return cols;
    },
    read: function (c) { return [lonShort(c), level(FL[c]).replace(/^./, function (x) { return x.toUpperCase(); }), regionOf(c)[1]]; },
    dur: function () { return 0.5; },
    sound: function (c, when) {
      var rows = activeRows(c).slice(0, 3);
      rows.forEach(function (r, k) { drum(rowFreq(r), when + k * 0.06, 0.15 + 0.5 * Math.min(1, cell(c, r) / 0.5)); });
      if (rows.length) tick(when, 0.1);
      if (FL[c] >= THUNDER) thunder(when, 0.25 + 0.35 * FL[c] / FMAX);
    },
    short: function (c) { return lonSpoken(c) + '. ' + level(FL[c]); },
    describe: function (c) {
      var rows = activeRows(c).sort(function (a, b) { return a - b; });
      var s = 'Longitud ' + lonSpoken(c) + ', en ' + regionOf(c)[2] + '. ';
      if (!rows.length) s += 'Sin rayos.';
      else s += level(FL[c]).replace(/^./, function (x) { return x.toUpperCase(); }) + ', entre ' + latSpoken(90 - 15 * rows[0]) +
        ' y ' + latSpoken(90 - 15 * (rows[rows.length - 1] + 1)) + (FL[c] >= THUNDER ? ', con trueno.' : '.');
      return s + ' Es la columna ' + (c + 1) + ' de ' + RC + (playing ? ', y sigue sonando.' : ', en pausa.');
    },
    milestone: function (c) {
      var r = REGIONS.filter(function (x) { return x[0] === c; })[0];
      return r ? r[3] : null;
    },
    cmp: {
      a: 3, b: I_FMAX,
      sayA: 'Escucha la diferencia. Primero el océano Pacífico: unos pocos rayos.',
      sayB: 'Ahora ' + regionOf(I_FMAX)[2] + ', la zona con más rayos del planeta.',
      end: '¿Notas el trueno? Pulsa K para repetir.'
    }
  };

  var TRACKS = [TEMP, RAYOS];

  // ---------- Estado y vista ----------
  var T = TEMP, cur = 0, playing = false, timers = [], comparing = false, cols = [];
  var stopHooks = [];                                  // el laboratorio se registra aquí para parar a la vez
  function stopOthers() { stopHooks.forEach(function (f) { f(); }); }

  function render() {
    var box = $('viz');
    box.innerHTML = ''; box.className = 'viz viz-' + T.key;
    cols = T.build(box);
    box.setAttribute('aria-label', T.summary);
    $('demoTitle').textContent = T.title;
    $('sub').textContent = T.sub;
    ['ax0', 'ax1', 'ax2'].forEach(function (id, k) { $(id).textContent = T.axis[k]; });
    ['l1', 'l2', 'l3'].forEach(function (id, k) { $(id).textContent = T.fields[k]; });
    $('how').innerHTML = T.how.map(function (h) { return '<li>' + h + '</li>'; }).join('');
    $('src').innerHTML = T.source;
    TRACKS.forEach(function (tr, k) { $('b-t' + (k + 1)).setAttribute('aria-pressed', String(tr === T)); });
    $('caption').innerHTML = 'Pulsa <kbd class="bump">F</kbd> para reproducir.';
    paint(0);
    cols[0].classList.remove('now');
  }
  function paint(i) {
    cols.forEach(function (s, k) { s.classList.toggle('on', k <= i); s.classList.toggle('now', k === i); });
    var r = T.read(i);
    $('v1').textContent = r[0]; $('v2').textContent = r[1]; $('v3').textContent = r[2];
  }

  function clearTimers() { timers.forEach(clearTimeout); timers = []; }
  function setPlayBtn() { $('b-play').textContent = playing ? '❚❚ Pausa (F)' : '▶ Reproducir (F)'; }
  function pause(silent) {
    var was = playing || comparing;
    clearTimers(); playing = false; comparing = false;
    setPlayBtn();
    if (was && !silent) { earcon('down'); announce('Pausa. ' + T.short(cur) + '.'); }
  }
  function play() {
    pause(true); stopOthers(); audio();
    if (cur >= T.n - 1) cur = 0;
    playing = true; setPlayBtn(); earcon('up');
    var start = cur;
    cols.forEach(function (s, k) { s.classList.toggle('on', k < start); });
    var t = 0.2;
    for (var i = start; i < T.n; i++) {
      timers.push(setTimeout(function (i) {          // dato a dato para poder pausar
        return function () {
          if (!playing) return;
          T.sound(i, ctx.currentTime + 0.02);
          cur = i; paint(i);
          var m = T.milestone(i);
          if (m) { $('caption').textContent = m; announce(m); }
        };
      }(i), t * 1000));
      t += T.dur(i);
    }
    timers.push(setTimeout(function () {
      playing = false; setPlayBtn();
      $('caption').textContent = T.end; announce(T.end, { queue: true });
    }, (t + 1) * 1000));
  }
  function toggle() { if (playing || comparing) pause(); else play(); }

  function goTo(i, full) {
    pause(true); stopOthers(); audio();
    cur = i; paint(cur);
    T.sound(cur, ctx.currentTime + 0.02);
    announce(full ? T.describe(cur) : T.short(cur));
  }
  function step(delta) {
    var next = clamp(cur + delta, 0, T.n - 1);
    if (next === cur) { pause(true); earcon('error'); announce(T.edge[cur === 0 ? 0 : 1]); return; }
    goTo(next, false);
  }
  function goYear(y) {
    var i = y - FIRST;
    if (i < 0 || i >= DATA.length) { earcon('error'); announce('Solo hay datos de ' + FIRST + ' a ' + LAST + '.'); return; }
    if (T !== TEMP) setTrack(0, true);
    goTo(i, true);
  }
  function playRepeat(i, done) {
    cur = i; paint(i);
    var t = ctx.currentTime + 0.05;
    for (var r = 0; r < 4; r++) T.sound(i, t + r * 0.4);
    timers.push(setTimeout(done, 1900));
  }
  function compare() {
    pause(true); stopOthers(); audio(); comparing = true;
    var c = T.cmp;
    announce(c.sayA, { then: function () {
      if (!comparing) return;
      playRepeat(c.a, function () {
        announce(c.sayB, { then: function () {
          if (!comparing) return;
          playRepeat(c.b, function () { comparing = false; announce(c.end, { queue: true }); });
        } });
      });
    } });
  }

  // ---------- Pistas y laboratorio ----------
  function setTrack(k, quiet) {
    var nt = TRACKS[k];
    pause(true); stopOthers();
    if (nt !== T) { T = nt; cur = 0; render(); }
    if (quiet) return;
    earcon('track');
    announce('Pista ' + (k + 1) + ' de ' + TRACKS.length + '. ' + T.intro);
  }
  function goLab() {
    pause(true); stopOthers();
    $('lab').scrollIntoView();
    $('t-lab').focus({ preventScroll: true });
    earcon('track');
    announce(window.MINI.lab ? window.MINI.lab.intro : 'Laboratorio.');
  }

  // ---------- Comandos de voz (reconocimiento de voz del navegador) ----------
  var Rec = window.SpeechRecognition || window.webkitSpeechRecognition, rec = null, listening = false;
  function plain(s) { return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  var PLACES = [[/pacifico/, 0], [/norteamerica|mexico|estados unidos/, 9], [/sudamerica|amazon|brasil/, 14], [/atlantico/, 19],
    [/africa|congo/, 24], [/oriente|india|indico/, 30], [/asia|indonesia/, 35], [/australia/, 41]];
  function peakIn(from) {   // la columna con más rayos de una región
    var to = (REGIONS.filter(function (x) { return x[0] > from; })[0] || [RC])[0], best = from;
    for (var c = from; c < to; c++) if (FL[c] > FL[best]) best = c;
    return best;
  }
  function runCommand(raw) {
    var s = plain(raw), lab = window.MINI.lab;
    var y = s.match(/\b(18[89]\d|19\d\d|20[0-2]\d)\b/);
    if (y) return goYear(+y[1]);
    if (/ayuda|teclas|comandos|que puedo/.test(s)) return announce(HELP);
    if (/laboratorio/.test(s)) return goLab();
    if (lab && /mis numeros|mis datos/.test(s)) return lab.playNumbers();
    if (lab && /luz|luces/.test(s)) return lab.example('luces');
    if (lab && /imagen|mapa/.test(s)) return lab.example('rayos');
    if (/pista (1|uno)|temperatura|calor|calentamiento/.test(s)) return setTrack(0);
    if (/pista (2|dos)|rayo|tormenta/.test(s)) return setTrack(1);
    if (/(siguiente|otra|cambia\w*) pista|pista siguiente/.test(s)) return setTrack((TRACKS.indexOf(T) + 1) % TRACKS.length);
    for (var p = 0; p < PLACES.length; p++) {
      if (PLACES[p][0].test(s)) { if (T !== RAYOS) setTrack(1, true); return goTo(peakIn(PLACES[p][1]), true); }
    }
    if (/que suena|donde|describ|que ano|dato/.test(s)) return announce(T.describe(cur));
    if (/diferencia|compar/.test(s)) return compare();
    if (/inicio|principio|reinici|desde el/.test(s)) { pause(true); cur = 0; paint(0); return announce('Vuelvo al principio. Di reproducir para empezar.'); }
    if (/paus|para|deten|stop|alto|espera/.test(s)) { stopOthers(); return pause(); }
    if (/reproduc|play|empez|toca|dale|sigue|continua|escuchar/.test(s)) return play();
    if (/anterior|atras|antes/.test(s)) return step(/diez|10/.test(s) ? -10 : -1);
    if (/siguiente|adelante|despues|proximo/.test(s)) return step(/diez|10/.test(s) ? 10 : 1);
    if (/apaga.*voz|silencio|callate/.test(s)) return setVoice(false);
    if (/enciende.*voz|activa.*voz/.test(s)) return setVoice(true);
    earcon('error');
    announce('No entendí “' + raw + '”. Di ayuda para oír los comandos.');
  }
  function listen() {
    if (!Rec) { earcon('error'); announce('Este navegador no reconoce la voz. Usa Chrome o Edge, o las teclas de la fila guía. Pulsa H para oírlas.'); return; }
    if (listening) { rec.abort(); return; }
    if (synth) synth.cancel();
    var wasPlaying = playing; if (playing) pause(true);
    rec = new Rec(); rec.lang = 'es-ES'; rec.interimResults = false; rec.maxAlternatives = 1;
    rec.onstart = function () { listening = true; earcon('up'); $('mic').textContent = '🎤 Escuchando… di un comando'; $('b-mic').setAttribute('aria-pressed', 'true'); };
    rec.onresult = function (e) { var txt = e.results[0][0].transcript; $('mic').textContent = '🎤 “' + txt + '”'; wasPlaying = false; runCommand(txt); };
    rec.onerror = function (e) {
      earcon('error');
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') announce('No tengo permiso para usar el micrófono. Puedes seguir con las teclas: pulsa H para oírlas.');
      else if (e.error === 'no-speech') announce('No oí nada. Pulsa espacio y vuelve a intentarlo.');
      else if (e.error === 'network') announce('El reconocimiento de voz necesita internet. Usa las teclas de la fila guía.');
    };
    rec.onend = function () { listening = false; $('b-mic').setAttribute('aria-pressed', 'false'); if (wasPlaying) play(); };
    try { rec.start(); } catch (e) { announce('No se pudo activar el micrófono.'); }
  }

  // ---------- Empezar (desde la portada) ----------
  var greeted = false;
  function start() {
    greeted = true; audio();
    $('demo').scrollIntoView();
    $('demoTitle').focus({ preventScroll: true });
    earcon('up');
    announce(WELCOME + T.intro);
  }
  $('startBtn').addEventListener('click', start);

  // ---------- Teclado: fila guía D F G · H J K ----------
  var KEYS = {
    KeyF: toggle,
    KeyD: function (e) { step(e.shiftKey ? -10 : -1); },
    KeyG: function (e) { step(e.shiftKey ? 10 : 1); },
    KeyJ: function () { announce(T.describe(cur)); },
    KeyH: function () { announce(HELP); },
    KeyK: compare,
    KeyA: function () { setVoice(!voiceOn); },
    Digit1: function () { setTrack(0); }, Numpad1: function () { setTrack(0); },
    Digit2: function () { setTrack(1); }, Numpad2: function () { setTrack(1); },
    Digit3: goLab, Numpad3: goLab,
    Space: listen,
    ArrowLeft: function (e) { step(e.shiftKey ? -10 : -1); },
    ArrowRight: function (e) { step(e.shiftKey ? 10 : 1); },
    Home: function () { goTo(0, false); },
    End: function () { goTo(T.n - 1, false); },
    Escape: function () { if (synth) synth.cancel(); stopOthers(); pause(); }
  };
  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
    var tg = e.target, tag = tg && tg.tagName;
    // Escribiendo en el laboratorio las teclas escriben; solo Escape para el sonido
    if ((tag === 'TEXTAREA' || (tag === 'INPUT' && tg.type !== 'button')) && e.code !== 'Escape') return;
    var fn = KEYS[e.code];
    if (!greeted) {
      // La primera tecla (o Enter en "Empezar") presenta la demo; F, D, G… ya actúan directamente.
      if (!fn || e.code === 'KeyH') { e.preventDefault(); start(); return; }
      greeted = true; audio();
      $('demo').scrollIntoView();
    }
    if (!fn) return;
    e.preventDefault();
    fn(e);
  });

  // ---------- Botones (para quien use ratón o pantalla táctil) ----------
  function btn(id, fn) { $(id).addEventListener('click', function () { greeted = true; fn(); }); }
  btn('b-play', toggle);
  btn('b-prev', function () { step(-1); });
  btn('b-next', function () { step(1); });
  btn('b-what', function () { announce(T.describe(cur)); });
  btn('b-cmp', compare);
  btn('b-voice', function () { setVoice(!voiceOn); });
  btn('b-mic', listen);
  btn('b-help', function () { announce(HELP); });
  btn('b-t1', function () { setTrack(0); });
  btn('b-t2', function () { setTrack(1); });
  btn('b-t3', goLab);

  render();

  // Lo que comparte con el laboratorio (js/laboratorio.js)
  window.MINI.api = {
    audio: audio, pluck: pluck, announce: announce, earcon: earcon,
    pauseMain: function () { pause(true); },
    onStop: function (f) { stopHooks.push(f); }
  };
  window.__miniDemo = { runCommand: runCommand, describe: function () { return T.describe(cur); }, state: function () { return { track: T.key, cur: cur, playing: playing, voiceOn: voiceOn }; } };
})();
