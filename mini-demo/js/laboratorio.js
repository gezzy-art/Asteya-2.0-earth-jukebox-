/* Laboratorio sencillo de la mini demo: la misma idea (dato -> sonido) con cualquier dato.
 *   - Tus números: más alto = más agudo.
 *   - Una imagen: una línea la recorre de izquierda a derecha; más brillo = más volumen, más arriba = más agudo.
 * Usa el motor de audio y la voz de js/demo.js (window.MINI.api). */
(function () {
  'use strict';

  var A = window.MINI.api;
  var $ = function (id) { return document.getElementById(id); };
  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };

  var COLS = 48, ROWS = 12, STEP_NUM = 0.35, STEP_IMG = 0.25;
  var PENTA = [0, 2, 4, 7, 9];
  function pent(k) { return 130.81 * Math.pow(2, (Math.floor(k / 5) * 12 + PENTA[k % 5]) / 12); }
  function say(v) { return String(+v.toFixed(2)).replace('.', ','); }

  var EXAMPLES = {
    rayos: { src: 'assets/rayos.jpg', name: 'el mapa de rayos de la NASA',
      alt: 'Mapa de la NASA con los rayos detectados desde la Estación Espacial en 2023: puntos amarillos, sobre todo en los trópicos.' },
    luces: { src: 'assets/luces.jpg', name: 'el mapa de luces nocturnas de la NASA',
      alt: 'Mapa de la NASA del cambio en las luces nocturnas de 2012 a 2023: morado donde aparecieron luces, naranja donde se apagaron.' }
  };

  var timers = [], running = false;
  var img = $('lab-img'), cv = $('lab-canvas'), bars = $('lab-bars');

  function setBtns() { $('lab-stop').disabled = !running; }
  function stop(silent) {
    timers.forEach(clearTimeout); timers = [];
    var was = running; running = false; setBtns();
    if (was && !silent) { A.earcon('down'); A.announce('Laboratorio en pausa.'); }
  }
  A.onStop(function () { stop(true); });
  function begin() { A.pauseMain(); stop(true); A.audio(); running = true; setBtns(); }
  function at(sec, fn) { timers.push(setTimeout(function () { if (running) fn(); }, sec * 1000)); }
  function status(t) { $('lab-status').textContent = t; }

  // ---------- Tus números ----------
  function parseNums(text) {
    var out = [];
    text.split(/[\s;]+/).forEach(function (tok) {
      if (!tok) return;
      if (/^-?\d+,\d+$/.test(tok)) tok = tok.replace(',', '.');   // 1,5 = uno coma cinco
      tok.split(',').forEach(function (p) { var v = parseFloat(p); if (isFinite(v)) out.push(v); });
    });
    return out.slice(0, 200);
  }
  function showBars(vals, lo, span) {
    img.hidden = true; cv.hidden = true; bars.hidden = false;
    bars.innerHTML = '';
    return vals.map(function (v) {
      var b = document.createElement('div');
      b.style.height = (12 + 88 * (v - lo) / span) + '%';
      bars.appendChild(b);
      return b;
    });
  }
  function playNumbers() {
    var vals = parseNums($('lab-nums').value);
    if (vals.length < 2) { A.earcon('error'); A.announce('Escribe al menos dos números, separados por espacios.'); return; }
    var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals), span = hi - lo || 1, n = vals.length;
    var els = showBars(vals, lo, span);
    begin(); A.earcon('up');
    status('Tus ' + n + ' números: de ' + say(lo) + ' a ' + say(hi) + '.');
    A.announce('Tus ' + n + ' números, del más bajo, ' + say(lo) + ', al más alto, ' + say(hi) + '. Más alto, más agudo.', { then: function () {
      if (!running) return;
      vals.forEach(function (v, i) {
        at(0.1 + i * STEP_NUM, function () {
          var ctx = A.audio();
          A.pluck(pent(Math.round((v - lo) / span * 14)), ctx.currentTime + 0.02, 0.8, 0.35);
          els.forEach(function (b, k) { b.classList.toggle('on', k <= i); b.classList.toggle('now', k === i); });
        });
      });
      at(0.9 + n * STEP_NUM, function () {
        running = false; setBtns();
        A.announce('Fin. El valor más alto, ' + say(hi) + ', es el número ' + (vals.indexOf(hi) + 1) + ' de ' + n + '.');
      });
    } });
  }

  // ---------- Una imagen ----------
  // Lee la imagen en una cuadrícula de 48 × 12 y deja cada celda entre 0 (como el fondo) y 1 (lo más brillante)
  function analyze(im) {
    var W = Math.min(960, im.naturalWidth), H = Math.max(ROWS, Math.round(im.naturalHeight * W / im.naturalWidth));
    var c = document.createElement('canvas'); c.width = W; c.height = H;
    var x = c.getContext('2d'); x.drawImage(im, 0, 0, W, H);
    var d;
    try { d = x.getImageData(0, 0, W, H).data; } catch (e) { return null; }   // página abierta con doble clic
    var sum = new Float64Array(COLS * ROWS), cnt = new Float64Array(COLS * ROWS);
    for (var py = 0; py < H; py++) {
      var ri = Math.floor(py * ROWS / H);
      for (var px = 0; px < W; px++) {
        var p = (py * W + px) * 4, k = Math.floor(px * COLS / W) * ROWS + ri;
        sum[k] += (0.2126 * d[p] + 0.7152 * d[p + 1] + 0.0722 * d[p + 2]) / 255; cnt[k]++;
      }
    }
    var mean = Array.prototype.map.call(sum, function (s, k) { return s / (cnt[k] || 1); });
    var sorted = mean.slice().sort(function (a, b) { return a - b; });
    var bg = sorted[Math.floor(sorted.length / 2)], top = sorted[sorted.length - 1];
    return mean.map(function (m) { return clamp((m - bg) / ((top - bg) || 1), 0, 1); });
  }
  function drawLine(col) {
    var r = img.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
    var g = cv.getContext('2d'); g.clearRect(0, 0, cv.width, cv.height);
    if (col < 0) return;
    var xx = (col + 0.5) / COLS * cv.width;
    g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(0, 0, xx, cv.height);
    g.shadowColor = '#AEB8F2'; g.shadowBlur = 10 * dpr;
    g.fillStyle = '#fff'; g.fillRect(xx - dpr, 0, 2 * dpr, cv.height);
  }
  function playImage(v, name) {
    begin(); A.earcon('up');
    status('Escuchando ' + name + '.');
    A.announce('Imagen: ' + name + '. Una línea la recorre de izquierda a derecha. Más brillo, más volumen; más arriba, más agudo.', { then: function () {
      if (!running) return;
      for (var c = 0; c < COLS; c++) {
        at(0.1 + c * STEP_IMG, function (c) {
          return function () {
            var ctx = A.audio(), rows = [];
            for (var r = 0; r < ROWS; r++) if (v[c * ROWS + r] >= 0.25) rows.push(r);
            rows.sort(function (a, b) { return v[c * ROWS + b] - v[c * ROWS + a]; }).slice(0, 3).forEach(function (r, k) {
              A.pluck(pent(ROWS - 1 - r), ctx.currentTime + 0.02 + k * 0.04, 0.5, 0.06 + 0.3 * v[c * ROWS + r]);
            });
            drawLine(c);
          };
        }(c));
      }
      at(0.9 + COLS * STEP_IMG, function () {
        running = false; setBtns(); drawLine(-1);
        // Dónde está lo más brillante, para quien no ve la imagen
        var best = 0, bestSum = -1;
        for (var c = 0; c < COLS; c++) {
          var s = 0; for (var r = 0; r < ROWS; r++) s += v[c * ROWS + r];
          if (s > bestSum) { bestSum = s; best = c; }
        }
        var row = 0; for (var r = 1; r < ROWS; r++) if (v[best * ROWS + r] > v[best * ROWS + row]) row = r;
        var where = row < 4 ? 'en la parte de arriba' : row < 8 ? 'en el centro' : 'en la parte de abajo';
        A.announce('Fin. Lo más brillante está a un ' + Math.round((best + 0.5) / COLS * 100) + ' por ciento del ancho, ' + where + '.');
      });
    } });
  }
  function loadImage(src, name, alt) {
    A.pauseMain(); stop(true);
    bars.hidden = true; img.hidden = false; cv.hidden = false;
    img.alt = alt || ('Imagen cargada: ' + name);
    status('Cargando ' + name + '…');
    var ready = function () {
      var v = analyze(img);
      if (!v) {
        A.earcon('error');
        var msg = 'El navegador no deja leer esta imagen si la página se abrió con doble clic. Abre la demo con iniciar-servidor.bat, o sube tu propia imagen.';
        status(msg); A.announce(msg);
        return;
      }
      drawLine(-1);
      playImage(v, name);
    };
    img.onerror = function () { A.earcon('error'); status('No se pudo abrir la imagen.'); A.announce('No se pudo abrir la imagen.'); };
    // La misma imagen otra vez no vuelve a avisar de que cargó: se escucha directamente
    if (img.getAttribute('src') === src && img.complete && img.naturalWidth) { img.onload = null; ready(); }
    else { img.onload = ready; img.src = src; }
  }
  function example(key) {
    var ex = EXAMPLES[key];
    if (!document.getElementById('lab').contains(document.activeElement)) $('lab').scrollIntoView();
    loadImage(ex.src, ex.name, ex.alt);
  }

  // ---------- Controles ----------
  $('lab-play-nums').addEventListener('click', playNumbers);
  $('lab-ex-rayos').addEventListener('click', function () { example('rayos'); });
  $('lab-ex-luces').addEventListener('click', function () { example('luces'); });
  $('lab-stop').addEventListener('click', function () { stop(false); });
  $('lab-file').addEventListener('change', function (e) {
    var f = e.target.files && e.target.files[0];
    if (!f) return;
    // Como data: URL, para poder leer los píxeles también con la página abierta con doble clic
    var rd = new FileReader();
    rd.onload = function () { loadImage(rd.result, 'tu imagen, ' + f.name.replace(/\.[^.]+$/, '')); };
    rd.readAsDataURL(f);
  });
  setBtns();

  window.MINI.lab = {
    intro: 'Laboratorio. La misma idea funciona con cualquier dato. Con Tab llegas al cuadro de números: escribe los tuyos y pulsa Escuchar mis números. ' +
      'También puedes elegir una imagen de la NASA o subir la tuya: una línea la recorre y el brillo se convierte en sonido. Escape para parar.',
    playNumbers: function () { $('lab').scrollIntoView(); playNumbers(); },
    example: example,
    stop: stop
  };
})();
