/* Recorrido guiado · Capítulos 5 (luces nocturnas) y 6 (rayos desde la ISS).
 * Usan los audios de la colección (assets/audio/05-luces.wav y 06-rayos.wav), generados con
 * herramientas/generar-audios.ps1. Una línea recorre el mapa de oeste a este al ritmo del audio,
 * con subtítulos y el dato de cada franja. Los tiempos y datos vienen de js/jukebox-tiempos.js. */
(function () {
  'use strict';
  const EIJ = window.EIJ, T = window.JUKEBOX_TIEMPOS;
  const { clamp, $ } = EIJ;
  const tour = EIJ.tour;

  const lonOf = (c) => { const lon = Math.round(-180 + 7.5 * c + 3.75); return lon === 0 ? '0°' : `${Math.abs(lon)}° ${lon < 0 ? 'O' : 'E'}`; };

  const CHAPTERS = {
    5: {
      key: 'lights', file: 'assets/audio/05-luces.wav', color: '#f9a8d4',
      start: 'Escucha… empezamos de noche sobre el océano Pacífico.',
      describe: (i) => {
        const n = T.lights.neu[i], o = T.lights.off[i];
        return n + o < 0.03 ? 'oscuridad' : n >= o ? 'más luces nuevas' : 'más luces apagadas';
      },
      captions: [
        [0, 'Océano Pacífico: oscuridad. Solo se oye la noche.'],
        [7, 'Norteamérica: aparecen las primeras campanas, ciudades que crecieron desde 2012.'],
        [12, 'Este de Norteamérica y el Caribe: se mezclan campanas y tonos graves.'],
        [15, 'Sudamérica: más campanas que tonos graves. Las ciudades siguen creciendo.'],
        [22, 'Europa: dominan los tonos graves. En parte porque muchas ciudades cambiaron a luces LED, que el satélite ve más tenues.'],
        [28, 'Oriente Medio y África: vuelven las campanas.'],
        [33, 'India: una de las mayores olas de luces nuevas del planeta.'],
        [37, 'China y el sudeste asiático: campanas por todas partes.'],
        [42, 'Japón, Indonesia y Australia: las últimas luces antes de volver al Pacífico.']
      ],
      end: 'La Tierra de noche cuenta dónde crecen las ciudades: sobre todo en Asia, y donde se ahorra energía, como en Europa.',
      compare: { A: [22, 27, 'Europa: tonos graves. Muchas luces se hicieron más tenues.'], B: [33, 40, 'India y China: campanas. Luces nuevas por todas partes.'] }
    },
    6: {
      key: 'lightning', file: 'assets/audio/06-rayos.wav', color: '#fde047',
      start: 'Escucha… empezamos sobre el océano Pacífico.',
      describe: (i) => { const v = T.lightning.flash[i]; return v < 0.03 ? 'sin rayos' : v < 0.4 ? 'pocos rayos' : 'muchos rayos'; },
      captions: [
        [0, 'Océano Pacífico: algunos rayos sueltos sobre el mar.'],
        [12, 'Norteamérica y el golfo de México: primeras tormentas.'],
        [14, 'Sudamérica: tormentas sobre la Amazonía. Empiezan los truenos.'],
        [20, 'Océano Atlántico: tormentas frente a la costa de África.'],
        [25, 'África central: la región con más rayos del planeta. El trueno no para.'],
        [30, 'Oriente Medio y el océano Índico: casi en silencio.'],
        [37, 'Sudeste asiático e Indonesia: vuelven las tormentas tropicales.'],
        [41, 'Australia y el Pacífico: los últimos tambores.']
      ],
      end: null,   // se calcula abajo con el porcentaje en los trópicos
      compare: { A: [30, 35, 'Océano Índico: casi silencio, el aire no forma tormentas eléctricas.'], B: [25, 30, 'África central: tambores y truenos sin parar.'] }
    }
  };

  // Rayos en los trópicos (bandas de 30° N a 30° S), de los datos del generador
  const bands = T.lightning.bands || [];
  const totalBolt = bands.reduce((a, b) => a + b, 0);
  const tropicPct = totalBolt ? Math.round((bands[4] + bands[5] + bands[6] + bands[7]) / totalBolt * 100) : 0;
  CHAPTERS[6].end = `Fin de la vuelta al mundo: el ${tropicPct} % de los rayos del mapa cae entre los trópicos, donde el aire es más cálido y húmedo.`;

  // Luces nuevas frente a apagadas en todo el mapa
  const sum = (a) => a.reduce((x, y) => x + y, 0);
  const lightsRatio = sum(T.lights.neu) / Math.max(0.001, sum(T.lights.off));

  // ---------- Un capítulo ----------
  function setup(num) {
    const ch = CHAPTERS[num], t = T[ch.key];
    const audio = new Audio(ch.file);
    audio.preload = 'none';
    const canvas = $('scan' + num), ctx = canvas.getContext('2d');
    const st = { done: false, lastCap: -1, segEnd: null, segBtn: null, raf: 0 };

    const caption = (s) => { $('caption' + num).textContent = s; };
    const idxAt = (time) => clamp(Math.floor((time - t.intro) / t.step), -1, t.n - 1);

    function drawScan() {
      const r = Math.min(window.devicePixelRatio || 1, 2);
      const cw = Math.round(canvas.clientWidth * r), chh = Math.round(canvas.clientHeight * r);
      if (canvas.width !== cw || canvas.height !== chh) { canvas.width = cw; canvas.height = chh; }
      const W = canvas.width, H = canvas.height, dpr = W / Math.max(1, canvas.clientWidth);
      ctx.clearRect(0, 0, W, H);
      const p = clamp((audio.currentTime - t.intro) / (t.step * t.n), 0, 1);
      if (audio.currentTime <= 0 && audio.paused) return;
      const x = p * W;
      ctx.fillStyle = 'rgba(0,0,0,.35)';
      ctx.fillRect(0, 0, x, H);
      ctx.save();
      ctx.shadowColor = ch.color; ctx.shadowBlur = 14 * dpr;
      ctx.fillStyle = '#fff';
      ctx.fillRect(x - dpr, 0, 2 * dpr, H);
      ctx.restore();
    }

    function update() {
      tick();
      if (!audio.paused) st.raf = requestAnimationFrame(update);
    }
    // timeupdate es el respaldo cuando la pestaña no dibuja (requestAnimationFrame se pausa en segundo plano)
    audio.addEventListener('timeupdate', tick);

    function tick() {
      const i = idxAt(audio.currentTime);
      if (i >= 0) {
        $('lon' + num).textContent = lonOf(i);
        $('what' + num).textContent = ch.describe(i);
        if (st.segEnd === null) {
          let k = -1;
          ch.captions.forEach(([ci], j) => { if (ci <= i) k = j; });
          if (k !== st.lastCap && k >= 0) { st.lastCap = k; caption(ch.captions[k][1]); }
        }
        if (i !== st.lastIdx) {   // una vibración por franja, más fuerte donde hay más luces o rayos
          st.lastIdx = i;
          const v = num === 5 ? T.lights.neu[i] : T.lightning.flash[i];
          if (v > 0.03) tour.vibrate(clamp(v, 0, 1));
        }
      }
      drawScan();
      if (st.segEnd !== null && audio.currentTime >= st.segEnd) endSegment();
    }

    function setButton() {
      const b = $(`play${num}Btn`), playing = !audio.paused && st.segEnd === null;
      b.setAttribute('aria-pressed', String(playing));
      b.textContent = playing ? '■ Detener' : st.done ? '↺ Escuchar otra vez' : (num === 5 ? '▶ Escuchar la vuelta al mundo' : '▶ Escuchar las tormentas');
    }

    function play() {
      endSegment(true);
      audio.currentTime = 0;
      st.lastCap = -1;
      caption(ch.start);
      audio.play().then(() => { st.raf = requestAnimationFrame(update); setButton(); })
        .catch(() => caption('El navegador bloqueó el sonido. Pulsa “Escuchar” otra vez.'));
      setButton();
    }

    function stop(silent) {
      cancelAnimationFrame(st.raf);
      const was = !audio.paused;
      audio.pause();
      endSegment(true);
      setButton();
      if (was && !silent) caption(`Detenido en ${$('lon' + num).textContent}. Pulsa “Escuchar” para empezar de nuevo.`);
    }

    audio.addEventListener('ended', () => {
      cancelAnimationFrame(st.raf);
      st.done = true;
      caption(ch.end);
      $('compare' + num).classList.remove('hidden');
      setButton();
      drawScan();
    });

    // ---------- Escucha la diferencia: un tramo del mismo audio ----------
    function segment(which, btnId) {
      const [c0, c1, text] = ch.compare[which];
      cancelAnimationFrame(st.raf);
      audio.pause();
      endSegment(true);
      st.segEnd = t.intro + c1 * t.step;
      st.segBtn = btnId;
      $(btnId).setAttribute('aria-pressed', 'true');
      caption(text);
      audio.currentTime = t.intro + c0 * t.step;
      audio.play().then(() => { st.raf = requestAnimationFrame(update); }).catch(() => endSegment(true));
      setButton();
    }
    function endSegment(silent) {
      if (st.segEnd === null) return;
      if (!silent) { audio.pause(); cancelAnimationFrame(st.raf); }
      $(st.segBtn).setAttribute('aria-pressed', 'false');
      st.segEnd = null; st.segBtn = null;
      setButton();
    }
    $(`cmp${num}A`).addEventListener('click', () => segment('A', `cmp${num}A`));
    $(`cmp${num}B`).addEventListener('click', () => segment('B', `cmp${num}B`));

    $(`play${num}Btn`).addEventListener('click', () => (!audio.paused && st.segEnd === null ? stop() : play()));
    tour.onLeave.push(() => stop(true));
    window.addEventListener('resize', () => { if (!$('cap' + num).classList.contains('hidden')) drawScan(); });
    setButton();

    return function enter() {
      tour.goTo('cap' + num);
      drawScan();
      play();   // viene de un clic: el audio puede empezar
    };
  }

  tour.enterCap5 = setup(5);
  tour.enterCap6 = setup(6);

  $('toCap5').addEventListener('click', () => tour.enterCap5());
  $('backCap4').addEventListener('click', () => tour.goTo('cap4'));
  $('toCap6').addEventListener('click', () => tour.enterCap6());
  $('backCap5').addEventListener('click', () => tour.goTo('cap5'));
  $('toFin').addEventListener('click', () => tour.goTo('fin'));

  // ---------- Cierre: cifras de los capítulos 5 y 6 ----------
  $('finLights').textContent = lightsRatio.toFixed(1);
  $('finBolt').textContent = `${tropicPct} %`;
})();
