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

  // Subtítulos de la temperatura: el récord y el cierre salen de los datos, para que no caduquen al actualizarlos
  const gN = G.anomalies.length, gMax = Math.max(...G.anomalies), gMaxIdx = G.anomalies.indexOf(gMax);
  const gRecord = `${G.firstYear + gMaxIdx}: el año más cálido registrado, +${fmt(gMax, 2)} °C.`;
  const gEnd = `Acabas de escuchar ${gN} años de temperatura en menos de un minuto.`;
  const tempEndCaps = gMaxIdx === gN - 1
    ? [{ i: gN - 1, text: `${gRecord} ${gEnd}` }]
    : [{ i: gMaxIdx, text: gRecord }, { i: gN - 1, text: gEnd }];
  const iceLast = ICE.extent[ICE.extent.length - 1];

  const TRACKS = [
    {
      key: 'temp', file: 'assets/audio/01-temperatura.wav',
      title: 'El planeta se calienta', sub: `Temperatura global · ${G.firstYear}–${G.lastYear}`,
      story: `Cada nota de arpa es un año, de ${G.firstYear} a ${G.lastYear}. ` + 'Cuanto más cálido fue el año comparado con el promedio de 1951–1980, más aguda suena. Cuando el calentamiento pasa de +0.5 °C la melodía cambia a tono menor, y por encima de +0.8 °C entra un pulso de percusión, como una alarma.',
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
        { i: 135, text: '2015: se supera +0.8 °C. Entra el pulso de alarma y ya no se va.' }
      ].concat(tempEndCaps)
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
        { i: ICE.extent.length - 1, text: `${ICE.lastYear}: ${fmt(iceLast, 1)} millones de km², un ${Math.round((1 - iceLast / ICE.extent[0]) * 100)} % menos que en ${ICE.firstYear}.` }
      ]
    },
    {
      key: 'ocean', file: 'assets/audio/03-oceano.wav',
      title: 'El océano mueve el calor', sub: 'Temperatura del mar · del Polo Norte al Polo Sur',
      story: 'Una línea recorre el mapa del océano de norte a sur, 5 grados de latitud por segundo. Cada nota es un trozo de mar: el agua fría suena grave y la cálida, aguda. Escucha cómo la melodía sube al acercarse al ecuador y vuelve a bajar en el océano Austral.',
      link: 'https://svs.gsfc.nasa.gov/3912', thumb: 'assets/eic/corrientes-oceanicas.jpg', globe: 'oceano',
      globeLabel: 'Globo del océano: corrientes rojas y naranjas, agua cálida; azules, agua fría. Se inclina del Polo Norte al Polo Sur con el audio; con las flechas lo giras tú y oyes cada trozo de mar.',
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
      link: 'https://svs.gsfc.nasa.gov/5313', thumb: 'assets/eic/luces-nocturnas-cambio.jpg', globe: 'luces',
      globeLabel: 'Globo de la Tierra de noche: morado, luces nuevas; naranja, luces apagadas. Gira con el audio; con las flechas lo giras tú y oyes cada región.',
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

  // ---------- Echoes of Tomorrow: lo medido y dos futuros posibles ----------
  // Tiene su propia página (futuros.html, que define window.EIJ_FUTURO_PAGE): allí es la única pista del reproductor.
  // En el Jukebox no aparece; la tecla F y las órdenes «dos futuros», «futuro bajo» o «futuro alto» abren esa página.
  // Tres versiones de la misma pista (js/jukebox-musica.js): "ambos" (Two Futures, uno en cada oído), "bajo" y "alto".
  const F = EIJ.FUTURO, SOLO_FUTURO = !!window.EIJ_FUTURO_PAGE;
  const FUT_MODES = { ambos: 'Dos futuros', bajo: 'Bajas emisiones', alto: 'Altas emisiones' };
  let futMode = FUT_MODES[location.hash.slice(1)] ? location.hash.slice(1) : 'ambos';
  if (F && SOLO_FUTURO) {
    TRACKS.length = 0;
    const fH = G.anomalies.length, nF = F.years.length;
    const sg = (v, d) => `${v > 0 ? '+' : ''}${fmt(v, d)} °C`;
    const toPre = (v) => v - F.preind;   // de la referencia 1951–1980 a la de 1850–1900
    const fIdx = (y) => fH + F.years.indexOf(y);
    const fv = (s, y) => F[s].mid[F.years.indexOf(y)];
    const scenTxt = (s, y) => `${sg(fv(s, y), 1)} (${sg(toPre(fv(s, y)), 1)} sobre la era preindustrial)`;
    const FUT_CAPS = {
      ambos: [
        { i: fIdx(F.years[0]), text: `${F.years[0]}: desde aquí suena una proyección, no una predicción. A la izquierda, con flauta: si reducimos mucho las emisiones. A la derecha, con cuerdas: si no las reducimos.` },
        { i: fIdx(2050), text: `2050: bajas emisiones, ${scenTxt('low', 2050)}. Altas emisiones, ${scenTxt('high', 2050)}. Los dos caminos ya se separan.` },
        { i: fIdx(2075), text: 'Con bajas emisiones la melodía se estabiliza. Con altas emisiones sigue subiendo y se suman golpes de alarma.' },
        { i: fIdx(2100), text: `2100: bajas emisiones, ${scenTxt('low', 2100)}. Altas emisiones, ${scenTxt('high', 2100)}. El futuro todavía no está escrito: depende de lo que hagamos.` }
      ],
      bajo: [
        { i: fIdx(F.years[0]), text: `${F.years[0]}: desde aquí suena una proyección, no una predicción. Escenario de bajas emisiones: el mundo reduce mucho sus emisiones.` },
        { i: fIdx(2050), text: `2050: ${scenTxt('low', 2050)}. El calentamiento empieza a frenarse.` },
        { i: fIdx(2100), text: `2100: ${scenTxt('low', 2100)}. La melodía se estabiliza: el calor deja de subir.` }
      ],
      alto: [
        { i: fIdx(F.years[0]), text: `${F.years[0]}: desde aquí suena una proyección, no una predicción. Escenario de altas emisiones: las emisiones siguen creciendo.` },
        { i: fIdx(2050), text: `2050: ${scenTxt('high', 2050)}. Más de +2 °C: la alarma suena dos veces.` },
        { i: fIdx(2100), text: `2100: ${scenTxt('high', 2100)}. La melodía no deja de subir y la alarma suena tres veces.` }
      ]
    };
    const histCaps = [
      { i: 0, text: '1880: empieza el registro de temperatura de la NASA. Las notas son graves y tranquilas.' },
      { i: 97, text: 'Finales de los 70: el calentamiento empieza y ya no se detiene.' },
      { i: 118, text: '1998: se supera +0.5 °C y la melodía pasa a tono menor.' },
      { i: 135, text: '2015: se supera +0.8 °C. Entra el pulso de alarma.' },
      { i: fH - 1, text: `${G.lastYear}: el último año medido, ${sg(G.anomalies[fH - 1], 2)}. Ahora, la campana: empieza el futuro.` }
    ];
    const LEG = {
      ambos: [['Arpa', 'temperatura medida, 1880–2025'], ['Campana con eco', 'empieza la proyección'],
        ['Flauta, oído izquierdo', 'bajas emisiones'], ['Cuerdas, oído derecho', 'altas emisiones'],
        ['Golpes de alarma', '1 sobre +0.8 °C, 2 sobre +2 °C, 3 sobre +3 °C'], ['Soplo', 'incertidumbre de los modelos']],
      bajo: [['Arpa', 'temperatura medida, 1880–2025'], ['Campana con eco', 'empieza la proyección'],
        ['Flauta con eco', 'futuro con bajas emisiones'], ['Golpes de alarma', '1 sobre +0.8 °C, 2 sobre +2 °C, 3 sobre +3 °C'], ['Soplo', 'incertidumbre de los modelos']],
      alto: [['Arpa', 'temperatura medida, 1880–2025'], ['Campana con eco', 'empieza la proyección'],
        ['Cuerdas con eco', 'futuro con altas emisiones'], ['Golpes de alarma', '1 sobre +0.8 °C, 2 sobre +2 °C, 3 sobre +3 °C'], ['Soplo', 'incertidumbre de los modelos']]
    };
    TRACKS.push({
      future: true,
      get key() { return 'future_' + futMode; },
      file: '',
      title: 'Echoes of Tomorrow: escucha los futuros posibles',
      get sub() { return `Temperatura global · medida ${G.firstYear}–${G.lastYear} y proyectada hasta 2100 · ${FUT_MODES[futMode]}`; },
      story: `Primero suena la temperatura medida por la NASA, de ${G.firstYear} a ${G.lastYear}, con la misma regla de la pista 1: más calor, nota más aguda. ` +
        'Una campana con eco marca el paso al futuro. Desde ahí suena una proyección de los modelos climáticos del IPCC, no una predicción: ' +
        'lo que pasaría según cuánto emitamos. En el modo Dos futuros, con audífonos, la flauta del oído izquierdo es el camino de bajas emisiones ' +
        'y las cuerdas del derecho, el de altas emisiones. Cuanto más ancho el rango de los modelos, más se oye un soplo de fondo.',
      link: F.url, thumb: 'assets/eic/temperatura-2025.png', badge: '2100',
      images: ['assets/eic/temperatura-2025.png'],
      imgAlt: 'Mapa de la NASA del cambio de temperatura en 2025: casi todo el planeta en tonos naranjas y rojos.',
      get legend() { return LEG[futMode]; },
      get values() { return G.anomalies.concat(F[futMode === 'bajo' ? 'low' : 'high'].mid); },
      chart: 'future', color: (v) => heat(0.5 + v / 2.4),
      label: (i, v) => {
        if (i < fH) return `${G.firstYear + i} · medido · ${sg(G.anomalies[i], 2)}`;
        const j = i - fH, y = F.years[j];
        const one = (s) => `${F[s].name.toLowerCase()} ${sg(F[s].mid[j], 1)} (rango de los modelos ${sg(F[s].lo[j], 1)} a ${sg(F[s].hi[j], 1)})`;
        if (futMode === 'ambos') return `${y} · proyección · ${one('low')} · ${one('high')}`;
        return `${y} · proyección · ${one(futMode === 'bajo' ? 'low' : 'high')}`;
      },
      get captions() { return histCaps.concat(FUT_CAPS[futMode]); },
      touch: 'Un pulso por año: cuanto más cálido, más fuerte. En el futuro, el pulso se repite: dos veces por encima de +2 °C y tres por encima de +3 °C.',
      haptic: (i, v) => {
        const s = 0.2 + 0.6 * lvl((v + 0.6) / 5.6), k = v > 3 ? 3 : v > 2 ? 2 : 1;
        const out = [];
        for (let m = 0; m < k; m++) out.push([m * 140, 90, s, v > 0.8 ? 0.35 : 0]);
        return out;
      }
    });
  }

  // ---------- Vibración del control: misma regla que el sonido, pista por pista ----------
  // haptic(i, v) devuelve los pulsos de ese dato, [retraso ms, duración ms, motor grave, motor agudo] (0–1),
  // o null si ese dato no vibra. Las fuerzas se redondean a 4 niveles: la mano no distingue más.
  const lvl = (k) => Math.round(clamp(k, 0, 1) * 3) / 3;
  const iceMax = Math.max(...ICE.extent);
  const co2Marks = new Set([350, 400, 420].map(co2Cross).filter((i) => i >= 0));
  const lightsMax = [Math.max(...T.lights.neu, 1e-6), Math.max(...T.lights.off, 1e-6)];
  const HAPTIC = {
    temp: {
      touch: 'Un pulso por año: cuanto más cálido, más fuerte. Por encima de +0.5 °C el pulso se vuelve doble, y por encima de +0.8 °C se suma un cosquilleo, como la alarma.',
      haptic: (i, v) => {
        const s = 0.2 + 0.6 * lvl((v + 0.6) / 2), w = v > 0.8 ? 0.35 : 0;
        return v > 0.5 ? [[0, 90, s, w], [150, 90, s, w]] : [[0, 160, s, w]];
      }
    },
    ice: {
      touch: 'Un zumbido por año: cuanto más hielo queda, más largo. Año tras año se va acortando.',
      haptic: (i, v) => [[0, 80 + 470 * clamp(v / iceMax, 0, 1), 0.55, 0]]
    },
    ocean: {
      touch: 'Una vibración por franja de mar, de norte a sur: agua cálida, fuerte (con cosquilleo en la más cálida); agua fría, suave; tierra o hielo, nada.',
      haptic: (i, v) => (v === null ? null : [[0, 850, 0.15 + 0.6 * lvl(v), v > 0.66 ? 0.3 : 0]])
    },
    co2: {
      touch: 'Un latido por año que se hace cada vez más fuerte con el CO₂. Al cruzar 350, 400 y 420 ppm, una vibración larga, como la campana.',
      haptic: (i, v) => {
        if (co2Marks.has(i)) return [[0, 600, 0.9, 0.6]];
        if (co2Date(i).month !== 0) return null;
        return [[0, 70, 0.2 + 0.6 * clamp((v - 310) / 125, 0, 1), 0]];
      }
    },
    lights: {
      touch: 'De oeste a este. Luces nuevas: tres golpecitos rápidos (más luces, más fuertes). Luces apagadas: un zumbido largo. Oscuridad: nada.',
      haptic: (i) => {
        const n = T.lights.neu[i], o = T.lights.off[i];
        if (n + o < 0.03) return null;
        if (n >= o) { const s = 0.3 + 0.5 * lvl(n / lightsMax[0]); return [[0, 80, 0, s], [200, 80, 0, s], [400, 80, 0, s]]; }
        return [[0, 600, 0.3 + 0.5 * lvl(o / lightsMax[1]), 0]];
      }
    },
    lightning: {
      touch: 'De oeste a este. Cada zona con rayos: un golpe, más fuerte con más rayos. Muchos rayos a la vez: una sacudida larga, el trueno.',
      haptic: (i, v) => {
        if (v < 0.03) return null;
        if (v < 0.4) return [[0, 70, 0.3 + 0.5 * lvl(v / 0.4), 0]];
        return [[0, 320, 0.9, 0.6]];
      }
    }
  };
  TRACKS.forEach((tr) => Object.assign(tr, HAPTIC[tr.key]));

  // ---------- Estado y elementos ----------
  const audio = $('audio'), chart = $('chart'), cctx = chart.getContext('2d'), scan = $('scan'), sctx = scan.getContext('2d');
  let cur = 0, lastCaption = -1, wantPlay = false, lastIdx = -2, snippetTimer = 0, dragging = false;
  const V = EIJ.vibracion;
  let hapIdx = -2;   // último dato que ya vibró
  let padPressAt = -1e9;   // cuándo se pulsó por última vez un botón del control

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

  // Texto listo para leerse en voz alta en el idioma elegido (ES / EN)
  function spokenText(text) {
    const I = EIJ.i18n;
    return I && I.lang === 'en' ? I.speech(String(text)) : speakable(text);
  }

  const synth = 'speechSynthesis' in window ? window.speechSynthesis : null;
  let voiceOn = false, esVoice = null, introDone = {}, introPending = false;
  // Órdenes por voz (más abajo): micOn = el micrófono escucha; ttsEnd = cuándo terminó de hablar la guía
  let micOn = false, ttsEnd = 0;
  function pickVoice() {
    if (!synth) return;
    esVoice = EIJ.voz.pick();
  }
  if (synth) { pickVoice(); synth.addEventListener && synth.addEventListener('voiceschanged', pickVoice); }

  // Habla con la voz del navegador; mientras habla, la música baja para que se entienda
  // speakGen: cada interrupción invalida los "al terminar" de las locuciones anteriores (cancelar la voz
  // dispara su final). pendingThen: el "al terminar" que aún no se ejecutó; si otra locución sin uno propio
  // interrumpe (p. ej. la tecla D durante la explicación), lo hereda para que la música no se quede sin arrancar.
  let speakGen = 0, pendingThen = null;
  function speak(text, opts = {}) {
    if (!synth) return;
    let carried = null;
    if (opts.interrupt) { carried = pendingThen; pendingThen = null; speakGen++; synth.cancel(); }
    const myGen = speakGen, then = opts.then || carried;
    if (then) pendingThen = then;
    // En inglés (js/i18n.js) se traduce el texto original entero antes de partirlo en frases: si antes se pasara
    // a "forma hablada" (°C → grados, 1951–1980 → 1951 a 1980) ya no coincidiría con el diccionario
    const clean = spokenText(text);
    // Frase a frase: Chrome corta en silencio las locuciones largas
    const parts = clean.split(/(?<=[.;:])\s+/).filter(Boolean);
    let done = false;
    const finish = () => {
      if (done) return;
      done = true; clearTimeout(guard);
      if (myGen !== speakGen || !then) return;   // otra locución la interrumpió: ya no le toca
      if (pendingThen === then) pendingThen = null;
      then();
    };
    // Por si el navegador nunca avisa del final: seguir igualmente
    const guard = then ? setTimeout(finish, 4000 + clean.length * 90) : 0;
    parts.forEach((p, k) => {
      const u = new SpeechSynthesisUtterance(p);
      u.lang = esVoice ? esVoice.lang : 'es-ES';
      if (esVoice) u.voice = esVoice;
      u.rate = EIJ.voz.rate; u.pitch = EIJ.voz.pitch;
      u.onstart = () => { audio.volume = 0.25; };
      u.onend = u.onerror = () => {
        ttsEnd = performance.now();
        if (!synth.speaking && !synth.pending) audio.volume = 1;
        if (k === parts.length - 1) finish();
      };
      synth.speak(u);
    });
  }

  // Anuncia un mensaje: por voz si la guía está activa, si no por el lector de pantalla.
  // Con las órdenes por voz también se responde hablando: así se sabe cuándo habla la página y el
  // micrófono no toma esa respuesta por una orden.
  function announce(text, opts) {
    if (synth && (voiceOn || micOn)) { speak(text, Object.assign({ interrupt: true }, opts)); return; }
    const el = $('srAnnounce');
    el.textContent = '';
    setTimeout(() => { el.textContent = spokenText(text); }, 30);
    if (opts && opts.then) opts.then();
  }

  function setVoice(on, silent) {
    voiceOn = !!on && !!synth;
    const b = $('voiceBtn');
    b.setAttribute('aria-pressed', String(voiceOn));
    b.textContent = voiceOn ? '🔊 Guía por voz: sí' : '🔊 Guía por voz';
    // Con guía por voz, los subtítulos no se anuncian dos veces por el lector de pantalla
    $('caption').setAttribute('aria-live', voiceOn ? 'off' : 'polite');
    try { localStorage.setItem('eij-voz', voiceOn ? '1' : '0'); } catch (e) { /* sin almacenamiento */ }
    if (silent) return;
    if (voiceOn) {
      speak(`Guía por voz activada. Estás en ${trackName(true)}. ` +
        'Pulsa espacio para escuchar. Primero te explico qué significa cada sonido. ' +
        (SOLO_FUTURO ? 'Usa la F para cambiar de futuro, ' : `Usa las flechas o los números del 1 al ${TRACKS.length} para cambiar de pista, `) +
        'la D para saber qué suena, y la H para la ayuda.', { interrupt: true });
    } else {
      if (synth) synth.cancel();
      audio.volume = 1;
      // Si se apaga la guía a mitad de la explicación, la música ya no tiene que esperar
      if (introPending) { introPending = false; pendingThen = null; startAudio(); }
      announce('Guía por voz desactivada.');
    }
  }

  function introText(tr) {
    // Cada trozo se traduce por separado: en el diccionario la historia está entera, no frase a frase
    const I = EIJ.i18n, t = (s) => (I && I.lang === 'en' ? I.t(s) : s);
    return `${t(`Vas a escuchar ${trackName(true)}`)}. ${t(tr.sub)}. ${t(tr.story)} ${t('Qué escuchas')}: ` +
      tr.legend.map(([a, b]) => `${t(a)}, ${t(b)}`).join('; ') + '.' +
      (V && V.status().active && tr.touch ? ` ${t('En el control')}: ${t(tr.touch)}` : '');
  }

  // "Pista 3: El océano mueve el calor" (con total: "pista 3 de 6: …"); en la página de los futuros, solo el título
  function trackName(withTotal) {
    const tr = TRACKS[cur];
    if (tr.future) return tr.title;
    return withTotal ? `la pista ${cur + 1} de ${TRACKS.length}: ${tr.title}` : `Pista ${cur + 1}: ${tr.title}`;
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
      li.innerHTML = `<button type="button" class="thumb${tr.badge ? ' thumb-badged' : ''}" aria-label="Pista ${i + 1}: ${tr.title}"><img src="${tr.thumb}" alt="">` +
        (tr.badge ? `<span class="thumb-badge" aria-hidden="true">${tr.badge}</span>` : '') + '</button>';
      li.firstChild.addEventListener('click', () => select(i, wantPlay));
      ul.appendChild(li);
    });
  }

  function select(i, autoplay, quiet) {
    cur = (i + TRACKS.length) % TRACKS.length;
    introPending = false;
    const tr = TRACKS[cur];
    document.querySelectorAll('.thumb').forEach((b, k) => b.setAttribute('aria-current', String(k === cur)));
    $('trackNum').textContent = tr.future ? 'Escuchar posibles futuros' : `Pista ${cur + 1} de ${TRACKS.length}`;
    $('trackTitle').textContent = tr.title;
    $('trackSub').textContent = tr.sub;
    $('trackStory').textContent = tr.story;
    $('trackLink').href = tr.link;
    $('downloadBtn').setAttribute('aria-label', `Descargar el audio de ${tr.title}`);
    $('imgA').src = tr.images[0]; $('imgA').alt = tr.imgAlt;
    if (tr.images[1]) $('imgB').src = tr.images[1]; else $('imgB').removeAttribute('src');
    $('imgB').style.opacity = '0'; $('imgB').hidden = !tr.images[1];
    setGlobe(tr);
    $('legend').innerHTML = tr.legend.map(([a, b]) => `<li class="legend-item"><strong>${a}</strong>${b}</li>`).join('');
    $('touchLegend').textContent = tr.touch || '';
    if ($('futBox')) $('futBox').hidden = !tr.future;
    $('chart').classList.toggle('chart-tall', !!tr.future);
    updateFutUi();
    if (V) V.stop();
    hapIdx = -2;
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
      if (voiceOn && !quiet) speak(`${trackName(true)}. Pulsa espacio para escuchar.`, { interrupt: true });
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
    if (!url) { $('mixStatus').textContent = 'Este navegador no pudo preparar la pista.'; return; }   // pista sin audio grabado
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

  // ---------- Echoes of Tomorrow: elegir qué futuro se escucha ----------
  const futIndex = TRACKS.findIndex((t) => t.future);
  function updateFutUi() {
    document.querySelectorAll('[data-fut]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.fut === futMode)));
  }
  function futAnnounce() {
    return futMode === 'ambos'
      ? 'Modo dos futuros: con audífonos, a la izquierda bajas emisiones, con flauta; a la derecha altas emisiones, con cuerdas.'
      : `Futuro con ${FUT_MODES[futMode].toLowerCase()}.`;
  }
  function setFutMode(m) {
    if (!FUT_MODES[m]) return;
    futMode = m;
    updateFutUi();
    const tr = TRACKS[cur];
    if (tr.future) {
      $('trackSub').textContent = tr.sub;
      $('legend').innerHTML = tr.legend.map(([a, b]) => `<li class="legend-item"><strong>${a}</strong>${b}</li>`).join('');
      $('chart').setAttribute('aria-label', speakable(chartSummary(tr)));
      lastCaption = -1; lastIdx = -2;
      loadAudio(true);
      draw();
    }
    announce(futAnnounce());
  }
  // Ir a la pista 7 con un futuro elegido (órdenes por voz y tecla F)
  function goFuture(m, autoplay) {
    // Desde el Jukebox: abrir la página propia de Echoes of Tomorrow con ese futuro
    if (futIndex < 0) { location.href = 'futuros.html' + (m !== 'ambos' ? '#' + m : ''); return; }
    if (cur !== futIndex) {
      futMode = m; select(futIndex, autoplay, true);
      // Con guía por voz y reproducción, la explicación de la pista ya lo cuenta (y no hay que cortarla)
      if (!(autoplay && voiceOn)) announce(`Pista ${futIndex + 1}: Echoes of Tomorrow. ${futAnnounce()}`);
    }
    else setFutMode(m);
  }
  function cycleFut() {
    const ms = Object.keys(FUT_MODES);
    if (cur !== futIndex) goFuture(futMode, wantPlay);
    else setFutMode(ms[(ms.indexOf(futMode) + 1) % ms.length]);
  }

  function setInst(id) {
    inst = id; saveMix(); updateInstOptions(); loadAudio(true);
    announce(`Melodía con ${instLabel(id)}.`);
  }

  // ---------- Reproducción ----------
  function startAudio() {
    // Si aún se está preparando, sonará al terminar; si la voz está explicando la pista, cuando acabe
    if (!wantPlay || !audioReady || introPending) return;
    audio.playbackRate = +$('speed').value;
    audio.play().catch(() => {
      wantPlay = false; updatePlayUi();
      // Los navegadores no cuentan los botones del control como "el usuario tocó la página": hasta la primera
      // tecla o clic no dejan sonar nada
      if (performance.now() - padPressAt < 1500) {
        const msg = 'El navegador todavía no deja sonar audio. Pulsa una vez la barra espaciadora o haz clic en la página; después el control ya lo maneja todo.';
        setCaption(msg); $('srAnnounce').textContent = msg;
      } else setCaption('El navegador bloqueó el audio. Pulsa reproducir otra vez.');
    });
  }
  function play() {
    wantPlay = true;
    clearTimeout(snippetTimer);
    updatePlayUi();
    // Con guía por voz, cada vez que una pista empieza desde el principio se dice cuál vas a escuchar.
    // La primera vez, además, se explica qué significa cada sonido. La música espera a que termine la voz.
    if (voiceOn && audio.currentTime < 0.5) {
      const first = !introDone[cur];
      introDone[cur] = true;
      introPending = true;   // la música espera a que termine la voz, aunque el audio quede listo antes
      if (first) setCaption(TRACKS[cur].story);
      speak(first ? introText(TRACKS[cur]) : `Vas a escuchar ${trackName(true)}.`,
        { interrupt: true, then: () => { introPending = false; if (wantPlay && audio.paused) startAudio(); } });
      return;
    }
    startAudio();
  }
  function pause() {
    wantPlay = false; introPending = false; clearTimeout(snippetTimer); audio.pause();
    if (synth && voiceOn) { synth.cancel(); audio.volume = 1; }
    updatePlayUi();
  }
  function toggle() { if (wantPlay) pause(); else play(); }

  function updatePlayUi() {
    // Sin aria-pressed: la etiqueta ya cambia entre "Reproducir" y "Pausar" (las dos señales juntas se leen "Pausar, pulsado")
    $('playBtn').dataset.playing = String(wantPlay);
    $('playBtn').setAttribute('aria-label', wantPlay ? 'Pausar (barra espaciadora)' : 'Reproducir (barra espaciadora)');
    $('playIcon').textContent = wantPlay ? '❚❚' : '▶';
    $('playText').textContent = wantPlay ? 'Pausa' : 'Reproducir';
  }

  audio.addEventListener('ended', () => {
    const next = wantPlay && $('autoNext').checked && cur < TRACKS.length - 1;
    const goOn = () => { if (next && wantPlay) select(cur + 1, true); };
    if (!next) { wantPlay = false; updatePlayUi(); }
    // Con guía por voz se dice qué pista acabas de escuchar; la siguiente empieza cuando termina la voz
    if (voiceOn && synth) speak(`Acabas de escuchar ${trackName(true)}.`, { interrupt: true, then: goOn });
    else goOn();
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
    const where = `${trackName()}. Minuto ${mmss(audio.currentTime)} de ${mmss(duration())}.`;
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

  // ---------- Pistas 3 y 5: globo 3D (js/globo-3d.js) ----------
  // La imagen de la pista envuelve un globo que sigue al audio: en la 5 gira de oeste a este (línea vertical), en la 3
  // se inclina del Polo Norte al Polo Sur (línea horizontal). Si se arrastra o se gira con las flechas, el audio se
  // pausa y suena lo que queda bajo la línea. Si no hay WebGL o la página se abrió con doble clic, se queda el mapa plano.
  // Un globo (y un canvas) por modo: cada uno tiene su propio contexto WebGL y se crea la primera vez que hace falta.
  const globes = {};   // modo → { canvas, promise }
  let globe = null, globeOn = false, exploring = false;
  function setGlobe(tr) {
    const G = EIJ.globo3d;
    globeOn = false; exploring = false;
    Object.values(globes).forEach((g) => { g.canvas.hidden = true; g.promise.then((x) => x && x.stop()); });
    $('imgA').hidden = false;
    // Pistas de mapa (3 y 5): el visor se agranda para ver bien el globo 3D (css/jukebox.css, .globe-big)
    $('panelCol').classList.toggle('globe-big', !!tr.globe);
    $('globeFull').hidden = true;
    if (!(tr.globe && G && G.available())) return;
    let entry = globes[tr.globe];
    if (!entry) {
      const canvas = document.createElement('canvas');
      canvas.className = 'stage-globe'; canvas.tabIndex = 0; canvas.hidden = true;
      canvas.setAttribute('role', 'application'); canvas.setAttribute('aria-roledescription', 'globo');
      canvas.setAttribute('aria-label', tr.globeLabel);
      $('scan').before(canvas);
      entry = globes[tr.globe] = { canvas, promise: null };
      entry.promise = G.create(canvas, {
        modo: tr.globe,
        onUserMove: () => { exploring = true; if (wantPlay) pause(); },
        onMove: (d) => { if (exploring) $('readout').textContent = `${d.region} · ${d.lat}, ${d.lon} · ${d.text}`; }
      }).catch(() => null);
    }
    const forTrack = cur;
    entry.promise.then((g) => {
      if (!g || cur !== forTrack) return;   // falló (se queda el mapa plano) o ya se cambió de pista
      globe = g; globeOn = true; entry.canvas.hidden = false; $('imgA').hidden = true;
      $('globeFull').hidden = !document.fullscreenEnabled;
      g.start(); draw();
    });
  }
  // Globo a pantalla completa: el mismo visor (con subtítulos y lectura) ocupa toda la pantalla
  $('globeFull').addEventListener('click', () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else $('stage').requestFullscreen().catch(() => {});
  });
  document.addEventListener('fullscreenchange', () => {
    const on = document.fullscreenElement === $('stage');
    $('globeFull').textContent = on ? '✕ Salir de pantalla completa' : '⛶ Pantalla completa';
    if (EIJ.i18n) $('globeFull').textContent = EIJ.i18n.t($('globeFull').textContent);
    // El tamaño del lienzo cambia: el globo y la gráfica se recolocan
    setTimeout(() => { if (globe && globeOn) globe.resize(); draw(); }, 60);
  });
  audio.addEventListener('play', () => { exploring = false; });

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
    if (tr.chart === 'future') drawFuture(idx, W, H, dpr, bw);
    else if (tr.chart === 'line') {
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

    // Globo: sigue la línea del audio, salvo mientras se explora a mano
    if (globeOn && !exploring) {
      const p = clamp(((audio.currentTime - t.intro) / t.step) / n, 0, 1);
      globe.follow(tr.scan === 'y' ? 90 - 180 * p : -180 + 360 * p);
    }

    // Dato actual sobre la imagen
    if (!exploring) $('readout').textContent = idx >= 0 ? tr.label(idx, vals[idx]) : tr.sub;

    // Hielo: la imagen pasa de 1979 a 2012 según el hielo que queda
    if (tr.fade) $('imgB').style.opacity = String(idx >= 0 ? tr.fade(vals[idx]) : 0);

    // Océano: línea que baja por el mapa
    const sd = fitCanvas(scan);
    sctx.clearRect(0, 0, scan.width, scan.height);
    if (tr.scan && idx >= 0 && !globeOn) {
      const img = $('imgA'), ar = (img.naturalWidth || 2) / (img.naturalHeight || 1);
      let iw = scan.width, ih = iw / ar;
      if (ih > scan.height) { ih = scan.height; iw = ih * ar; }
      const ox = (scan.width - iw) / 2, oy = (scan.height - ih) / 2;
      const p = clamp(((audio.currentTime - t.intro) / t.step) / n, 0, 1);
      sctx.shadowColor = '#F4A3CB';
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
    if (!audio.paused && idx !== hapIdx) vibrateUpTo(idx);
    // El deslizador dice el tiempo y el dato, no un número de 0 a 1000
    if (idx !== lastIdx) {
      lastIdx = idx;
      $('seek').setAttribute('aria-valuetext', speakable(`${mmss(audio.currentTime)} de ${mmss(duration())}` +
        (idx >= 0 ? ` · ${tr.label(idx, vals[idx])}` : '')));
    }
    if (!dragging) $('seek').value = String(Math.round(audio.currentTime / duration() * 1000));
    $('timeNow').textContent = mmss(audio.currentTime);
  }

  // Pista 7: franjas de lo medido y, tras una línea discontinua en 2025, las proyecciones con su rango
  // (azul claro = bajas emisiones, salmón = altas emisiones). Lo que aún no sonó se ve apagado.
  const FUT_COLORS = { low: '174,184,242', high: '255,154,139' };
  function drawFuture(idx, W, H, dpr, bw) {
    const A = G.anomalies, fH = A.length, nF = F.years.length;
    const lo = -0.6, hi = Math.max(...F.high.hi) + 0.2, pad = 3 * dpr;
    const y = (v) => H - pad - (v - lo) / (hi - lo) * (H - 2 * pad);
    const x = (i) => (i + 0.5) * bw;
    for (let i = 0; i < fH; i++) {
      cctx.globalAlpha = i <= idx ? 1 : 0.25;
      cctx.fillStyle = heat(0.5 + A[i] / 2.4);
      cctx.fillRect(i * bw, y(A[i]), Math.ceil(bw), H - pad - y(A[i]));
    }
    cctx.globalAlpha = 1;
    // Línea de 2025: aquí termina lo medido
    cctx.strokeStyle = 'rgba(255,255,255,.6)'; cctx.lineWidth = 1 * dpr; cctx.setLineDash([3 * dpr, 3 * dpr]);
    cctx.beginPath(); cctx.moveTo(fH * bw, 0); cctx.lineTo(fH * bw, H); cctx.stroke(); cctx.setLineDash([]);
    const shown = futMode === 'ambos' ? ['low', 'high'] : [futMode === 'bajo' ? 'low' : 'high'];
    shown.forEach((s) => {
      const S = F[s], c = FUT_COLORS[s], upto = idx - fH;
      for (const played of [false, true]) {
        const last = played ? Math.min(nF - 1, upto) : nF - 1;
        if (last < 0) continue;
        cctx.fillStyle = `rgba(${c},${played ? 0.3 : 0.08})`;
        cctx.beginPath();
        for (let j = 0; j <= last; j++) cctx.lineTo(x(fH + j), y(S.hi[j]));
        for (let j = last; j >= 0; j--) cctx.lineTo(x(fH + j), y(S.lo[j]));
        cctx.fill();
        cctx.strokeStyle = `rgba(${c},${played ? 1 : 0.3})`; cctx.lineWidth = 2 * dpr;
        cctx.beginPath();
        for (let j = 0; j <= last; j++) { if (j) cctx.lineTo(x(fH + j), y(S.mid[j])); else cctx.moveTo(x(fH + j), y(S.mid[j])); }
        cctx.stroke();
      }
    });
  }

  /* La vibración sigue al reloj del audio (audio.currentTime), el mismo que mueve la gráfica y los subtítulos:
   * así no puede adelantarse ni atrasarse respecto a la música. Si entre dos cuadros pasaron varios datos
   * (el CO₂ va mes a mes, a 50 ms), se toca el más importante de ellos para no perder ningún latido. */
  function vibrateUpTo(idx) {
    const tr = TRACKS[cur];
    const from = hapIdx < -1 || idx < hapIdx || idx - hapIdx > 40 ? idx : hapIdx + 1;
    hapIdx = idx;
    if (!V || !tr.haptic || !V.status().active) return;
    let best = null, bestLen = 0;
    for (let i = Math.max(0, from); i <= idx; i++) {
      const p = tr.haptic(i, tr.values[i]);
      if (!p) continue;
      const len = p.reduce((m, [at, ms]) => Math.max(m, at + ms), 0);
      if (len >= bestLen) { best = p; bestLen = len; }
    }
    if (best) V.play(best, audio.playbackRate);
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
  // Mientras se arrastra el deslizador, el dibujo no le reescribe el valor
  $('seek').addEventListener('pointerdown', () => { dragging = true; });
  ['pointerup', 'pointercancel', 'change', 'blur'].forEach((ev) => $('seek').addEventListener(ev, () => { dragging = false; }));
  // Con el teclado: flechas = 2 segundos, RePág / AvPág = 10 segundos (el paso nativo era de centésimas)
  $('seek').addEventListener('keydown', (e) => {
    const d = { ArrowRight: 2, ArrowUp: 2, ArrowLeft: -2, ArrowDown: -2, PageUp: 10, PageDown: -10 }[e.key];
    if (!d) return;
    e.preventDefault();
    audio.currentTime = clamp((audio.currentTime || 0) + d, 0, duration());
    lastCaption = -1; lastIdx = -2; draw();
  });
  audio.addEventListener('loadedmetadata', () => { $('timeTotal').textContent = mmss(duration()); });
  audio.addEventListener('seeked', draw);
  // Al saltar a otro punto, el dato de destino vuelve a vibrar; al pausar o terminar, el control se calla
  audio.addEventListener('seeking', () => { hapIdx = -2; if (V) V.stop(); });
  ['pause', 'ended', 'emptied'].forEach((ev) => audio.addEventListener(ev, () => { if (V) V.stop(); }));
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
  document.querySelectorAll('[data-fut]').forEach((b) => b.addEventListener('click', () => setFutMode(b.dataset.fut)));
  document.querySelectorAll('[data-layer]').forEach((cb) => cb.addEventListener('change', () => {
    layers[cb.dataset.layer] = cb.checked; saveMix(); loadAudio(true);
  }));
  function nextInst() {
    const ids = ['original'].concat(M ? M.INST_ORDER : []);
    setInst(ids[(ids.indexOf(inst) + 1) % ids.length]);
  }

  // ---------- Órdenes por voz: manejar el jukebox hablando ----------
  // Usa el reconocimiento de voz del navegador (Chrome y Edge; necesita micrófono e internet).
  // Es una forma más de manejarlo: el teclado y los botones siguen funcionando siempre.
  const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
  const NUM = { uno: 1, una: 1, primera: 1, dos: 2, segunda: 2, tres: 3, tercera: 3, cuatro: 4, cuarta: 4, cinco: 5, quinta: 5, seis: 6, sexta: 6, siete: 7, septima: 7 };
  // Palabras con las que también se puede pedir cada pista ("pon la del hielo")
  const TEMA = [['temperatura', 'calienta', 'calor'], ['hielo', 'artico'], ['oceano', 'mar'],
    ['co2', 'dioxido', 'carbono', 'aire'], ['luces', 'ciudades'], ['rayos', 'tormentas']];
  const ALTO = ['pausa', 'pausar', 'pausalo', 'parar', 'paralo', 'detente', 'detener', 'deten', 'alto', 'silencio', 'stop', 'callate'];
  const SUENA = ['reproducir', 'reproduce', 'reproducelo', 'play', 'toca', 'tocar', 'empieza', 'empezar', 'comienza',
    'comenzar', 'continua', 'continuar', 'sigue', 'seguir', 'dale', 'escuchar', 'ponla'];
  const VOICE_HELP = SOLO_FUTURO
    ? 'Puedes decir: reproducir; pausa; qué suena; dato siguiente; dato anterior; explica; desde el principio; ' +
      'más rápido; más lento; dos futuros; futuro bajo; futuro alto; comparar; primera foto; segunda foto; instrumento; y desactivar órdenes.'
    : 'Puedes decir: pista y un número del uno al seis; reproducir; pausa; siguiente; anterior; ' +
      'qué suena; dato siguiente; dato anterior; explica; desde el principio; más rápido; más lento; ' +
      'instrumento; imagen, para escuchar una imagen de la NASA; futuros, para abrir Echoes of Tomorrow; y desactivar órdenes.';

  // Minúsculas, sin tildes ni signos: "¿Qué suena?" → "que suena"
  function norm(s) {
    return String(s).toLowerCase().replace(/₂/g, '2').normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/\bco 2\b/g, 'co2').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function setSpeed(v) {
    const s = $('speed');
    s.value = String(clamp(v, +s.min, +s.max));
    s.dispatchEvent(new Event('input'));
    announce(`Velocidad: ${s.getAttribute('aria-valuetext')}.`);
  }

  // Ejecuta una orden dicha en voz alta. Devuelve false si no la reconoce.
  function voiceCommand(raw) {
    const txt = norm(raw), w = txt.split(' ').filter(Boolean);
    if (!w.length) return false;
    const has = (...xs) => xs.some((x) => w.includes(x)), says = (re) => re.test(txt);
    const wantsPlay = has(...SUENA);

    if (says(/deja\w* de escuchar|(apaga|desactiva|quita)\w* (el |las )?(microfono|ordenes)/)) { setMic(false); return true; }
    if (has('guia')) {
      if (has('desactiva', 'desactivar', 'apaga', 'apagar', 'quita', 'quitar')) { setVoice(false); return true; }
      if (has('activa', 'activar', 'enciende', 'encender', 'pon', 'poner')) { setVoice(true); return true; }
    }
    if (has('ayuda', 'ordenes', 'comandos') || says(/que puedo decir/)) { announce(VOICE_HELP); return true; }

    // Cambiar de modo: "imagen" / "volver a la colección"
    if (EIJ.imagen) {
      if (!imageMode() && has('imagen', 'imagenes', 'foto', 'fotos', 'subir')) { EIJ.imagen.open(); return true; }
      if (imageMode() && has('coleccion', 'jukebox', 'volver', 'pistas')) { EIJ.imagen.close(); return true; }
      if (imageMode()) return EIJ.imagen.voice(txt, w);
    }

    // Echoes of Tomorrow, comparación de dos fotos: "primera foto", "escucha la segunda imagen", "comparar"
    if (EIJ.comparar) {
      if (has('foto', 'fotos', 'imagen', 'imagenes', 'mapa', 'mapas')) {
        if (has('primera', 'primer', 'uno', 'izquierda', 'hoy', 'presente')) { EIJ.comparar.play(0); return true; }
        if (has('segunda', 'segundo', 'dos', 'derecha')) { EIJ.comparar.play(1); return true; }
        EIJ.comparar.show(); return true;
      }
      if (has('comparar', 'comparacion', 'compara') && !has('futuro', 'futuros')) { EIJ.comparar.show(); return true; }
    }

    // Echoes of Tomorrow: "dos futuros", "compara los futuros", "futuro bajo", "futuro con altas emisiones"
    if (F && has('futuro', 'futuros', 'proyeccion', 'proyecciones', 'echoes', 'manana', 'emisiones', 'escenario', 'escenarios')) {
      const m = has('bajo', 'bajas', 'baja', 'reducimos', 'mejor', 'bueno') ? 'bajo'
        : has('alto', 'altas', 'alta', 'peor', 'malo') ? 'alto' : 'ambos';
      goFuture(m, true);
      return true;
    }

    if (has('dato', 'datos')) {
      if (has('siguiente', 'proximo')) stepData(1);
      else if (has('anterior', 'previo')) stepData(-1);
      else describeNow();
      return true;
    }
    if (says(/que suena|que esta sonando|que escucho|donde estoy|que es esto/)) { describeNow(); return true; }
    if (has('explica', 'explicame', 'explicacion', 'repite', 'repetir')) { announce(introText(TRACKS[cur])); return true; }

    // "pista tres", "la número 5" o solo "cuatro"
    const m = txt.match(/\b(?:pista|numero|cancion|audio)\s+(?:numero\s+)?(\d+|[a-z]+)\b/);
    const n = m ? (+m[1] || NUM[m[1]] || 0) : (w.length === 1 ? (+w[0] || NUM[w[0]] || 0) : 0);
    if (n >= 1 && n <= TRACKS.length) { select(n - 1, true); return true; }
    if (has('siguiente', 'proxima', 'proximo')) { select(cur + 1, true); return true; }
    if (has('anterior', 'previa')) { select(cur - 1, true); return true; }

    if (says(/principio|reinicia|de nuevo|otra vez|al inicio|desde el inicio/)) { restart(); if (wantsPlay) play(); return true; }

    if (has('normal')) { setSpeed(1); return true; }
    if (has('rapido', 'rapida', 'acelera')) { setSpeed(+$('speed').value + 0.25); return true; }
    if (has('lento', 'lenta', 'despacio')) { setSpeed(+$('speed').value - 0.25); return true; }

    if (M) {
      const id = ['original'].concat(M.INST_ORDER).find((x) => has(x) || txt.includes(norm(M.instName(x))));
      if (id) { setInst(id); return true; }
      if (has('instrumento', 'instrumentos')) { nextInst(); return true; }
    }

    const tema = TEMA.findIndex((ws) => has(...ws));
    if (tema >= 0) { select(tema, true); return true; }

    if (has(...ALTO) || w[0] === 'para') { pause(); return true; }
    if (wantsPlay) { play(); return true; }
    return false;
  }

  let rec = null, micRestart = 0;
  function micSay(text) { $('micStatus').textContent = text; }

  function onHeard(heard) {
    // En inglés las órdenes se dicen en inglés: se pasan a las palabras en español que entiende voiceCommand
    const raw = EIJ.i18n ? EIJ.i18n.cmdToEs(heard) : heard;
    const w = norm(raw).split(' ').filter(Boolean);
    if (!w.length) return;
    // Mientras la guía habla, el micrófono la oye: solo se acepta una orden corta de parar
    if (synth && (synth.speaking || performance.now() - ttsEnd < 1200)) {
      if (w.length <= 2 && (ALTO.includes(w[0]) || w[0] === 'para')) { micSay(`Oí: «${heard.trim()}»`); pause(); }
      return;
    }
    // Las órdenes son cortas: una frase larga es una conversación (o un lector de pantalla), no una orden
    if (w.length > 7) return;
    micSay(`Oí: «${heard.trim()}»`);
    if (!voiceCommand(raw) && w.length <= 4) announce('No entendí la orden. Di «ayuda» para oír lo que puedes decir.');
  }

  function updateMicUi() {
    const b = $('micBtn');
    b.setAttribute('aria-pressed', String(micOn));
    b.textContent = micOn ? '🎤 Órdenes por voz: sí' : '🎤 Órdenes por voz';
  }
  function startRec() { try { rec.start(); } catch (e) { /* ya estaba escuchando */ } }
  function micFail(msg) { micOn = false; clearTimeout(micRestart); updateMicUi(); micSay(msg); announce(msg); }

  function setMic(on) {
    if (!Rec) return;
    micOn = !!on;
    clearTimeout(micRestart);
    updateMicUi();
    if (!micOn) {
      if (rec) { try { rec.abort(); } catch (e) { /* no estaba escuchando */ } }
      micSay('');
      announce('Órdenes por voz desactivadas.');
      return;
    }
    if (!rec) {
      rec = new Rec();
      rec.lang = EIJ.i18n && EIJ.i18n.lang === 'en' ? (/^en/i.test(navigator.language || '') ? navigator.language : 'en-US')
        : /^es/i.test(navigator.language || '') ? navigator.language : 'es-ES';
      rec.continuous = true; rec.interimResults = false; rec.maxAlternatives = 1;
      rec.onresult = (e) => {
        for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) onHeard(e.results[i][0].transcript);
      };
      rec.onerror = (e) => {
        if (e.error === 'not-allowed' || e.error === 'service-not-allowed') micFail('El navegador no tiene permiso para usar el micrófono. Permítelo y vuelve a activar las órdenes por voz.');
        else if (e.error === 'network') micFail('Las órdenes por voz necesitan conexión a internet.');
        else if (e.error === 'audio-capture') micFail('No se encontró ningún micrófono.');
      };
      // El navegador deja de escuchar tras un rato de silencio: se vuelve a empezar
      rec.onend = () => { if (micOn) micRestart = setTimeout(startRec, 400); };
    }
    startRec();
    micSay('Escuchando… di «pista tres», «reproducir», «pausa» o «ayuda».');
    announce('Órdenes por voz activadas. Di, por ejemplo: pista tres, reproducir, pausa, o ayuda.');
  }

  // ---------- Vibración del control: botón y avisos ----------
  let vibeWasConnected = false;
  function updateVibeUi(s) {
    const b = $('vibeBtn');
    b.setAttribute('aria-pressed', String(s.active));
    // En pantalla, una etiqueta corta; el detalle va en la descripción emergente y para el lector de pantalla
    const detail = !s.connected ? 'Vibración: conecta un control de Xbox o PlayStation y pulsa un botón (tecla T)'
      : !s.canVibrate ? (s.firefox ? 'Firefox no hace vibrar el control: usa Chrome o Edge'
        : `El navegador ve el ${s.name}, pero no ofrece vibración para él`)
      : s.active ? `Vibración del ${s.name} activada (tecla T)`
      : `Activar vibración del ${s.name} (tecla T)`;
    b.textContent = s.active ? '🎮 Vibración: sí' : '🎮 Vibración';
    b.title = detail;
    b.setAttribute('aria-label', detail);
    $('touchBox').hidden = !s.active;
    // Línea de diagnóstico: qué ve el navegador del control (para saber por qué no vibra, si no vibra)
    const d = $('padDiag');
    d.hidden = !s.connected;
    if (s.connected) {
      d.textContent = `Control: ${s.id} · mapeo: ${s.mapping} · vibración: ${s.effects || 'no disponible'}` +
        (s.lastError ? ` · error: ${s.lastError}` : s.lastResult ? ` · última vibración: ${s.lastResult}` : '');
    }
  }
  function onVibeChange(s) {
    updateVibeUi(s);
    if (s.connected && !vibeWasConnected) {
      announce(!s.canVibrate ? `${s.name} conectado, pero este navegador no lo puede hacer vibrar.${s.firefox ? ' Usa Chrome o Edge.' : ''}`
        : s.active ? `${s.name} conectado. Vibración activada: sentirás los datos al mismo tiempo que suenan. Pulsa ${btnName(3, s.kind)} para oír qué hace cada botón.`
        : `${s.name} conectado. Pulsa la T para activar la vibración, o ${btnName(3, s.kind)} para oír qué hace cada botón.`);
      if (s.active) V.test();
    } else if (!s.connected && vibeWasConnected) announce('Se desconectó el control.');
    vibeWasConnected = s.connected;
  }
  function toggleVibe() {
    const s = V.status();
    if (!s.connected) { announce('No veo ningún control. Conecta un control de Xbox o PlayStation, mejor por USB, y pulsa cualquier botón.'); return; }
    if (!s.canVibrate) { announce('Este navegador no puede hacer vibrar el control. Usa Chrome o Edge.'); return; }
    V.setEnabled(!s.enabled);
    if (!s.enabled) { hapIdx = -2; V.test(); announce(`Vibración activada. ${TRACKS[cur].touch}`); }
    else announce('Vibración desactivada.');
  }
  // ---------- Botones del control ----------
  // Se eligen por posición, no por letra: la "X" de Xbox está a la izquierda y la ✕ de PlayStation, abajo.
  const BTN = {
    xbox: ['A', 'B', 'X', 'Y'],
    ps: ['equis', 'círculo', 'cuadrado', 'triángulo'],
    otro: ['el botón de abajo', 'el botón de la derecha', 'el botón de la izquierda', 'el botón de arriba']
  };
  function btnName(i, kind) {
    const k = BTN[kind] ? kind : 'otro';
    return k === 'otro' ? BTN.otro[i] : `${BTN[k][i]}`;
  }
  function padHelp() {
    const k = V.status().kind, b = (i) => btnName(i, k);
    const menu = k === 'ps' ? 'Options' : k === 'xbox' ? 'Menú' : 'el botón de menú';
    const view = k === 'ps' ? 'Create' : k === 'xbox' ? 'Vista' : 'el botón de vista';
    return `Botones del control. ${b(0)}: reproducir o pausar. ${b(1)}: qué suena ahora. ` +
      `${b(2)}: repetir la explicación de la pista. ${b(3)}: esta ayuda. ` +
      'Cruceta izquierda y derecha: pista anterior o siguiente. Cruceta arriba y abajo: dato siguiente o anterior. ' +
      'Gatillo izquierdo: más lento. Gatillo derecho: más rápido. Botón superior derecho: cambiar de instrumento. ' +
      `${menu}: activar o desactivar la vibración. ${view}: volver al principio.`;
  }
  function onPadButton(i) {
    padPressAt = performance.now();
    if (how.open) { if (i === 1 || i === 3) how.close(); return; }
    // En "Escucha una imagen" los botones manejan la imagen (menos vibración y ayuda)
    if (imageMode() && i !== 9 && i !== 3 && EIJ.imagen.pad(i)) return;
    const sp = +$('speed').value;
    switch (i) {
      case 0: toggle(); break;
      case 1: describeNow(); break;
      case 2: announce(introText(TRACKS[cur])); break;
      case 3: announce(padHelp()); break;
      case 5: if (M) nextInst(); break;
      case 6: setSpeed(sp - 0.25); break;
      case 7: setSpeed(sp + 0.25); break;
      case 8: restart(); break;
      case 9: toggleVibe(); break;
      case 12: stepData(1); break;
      case 13: stepData(-1); break;
      case 14: select(cur - 1, wantPlay); break;
      case 15: select(cur + 1, wantPlay); break;
      default: break;
    }
  }

  if (V && V.status().api) {
    V.onChange(onVibeChange);
    V.onButton(onPadButton);
    updateVibeUi(V.status());
    $('vibeBtn').addEventListener('click', toggleVibe);
  } else $('vibeBtn').hidden = true;

  if (Rec) $('micBtn').addEventListener('click', () => setMic(!micOn));
  else { $('micBtn').hidden = true; $('micHint').hidden = true; }
  // Se suma a EIJ.voz de js/nav.js (voz elegida, velocidad y tono): reemplazarlo dejaba la guía por voz sin voz
  EIJ.voz = Object.assign(EIJ.voz || {}, { orden: voiceCommand });

  // Lo que necesita "Escucha una imagen de la NASA" (js/jukebox-imagen.js)
  function imageMode() { return !!(EIJ.imagen && EIJ.imagen.active()); }
  EIJ.jukebox = {
    pause, announce, speak: (t, o) => speak(t, o),
    talking: () => voiceOn || micOn,
    help: () => how.showModal()
  };

  document.addEventListener('keydown', (e) => {
    if (how.open || e.ctrlKey || e.metaKey || e.altKey) return;
    const tag = e.target.tagName;
    if (tag === 'INPUT' && e.target.type === 'range' && (e.key.startsWith('Arrow') || e.key === 'Home' || e.key === 'End')) return;
    // En el selector de instrumento, las flechas y las letras son suyas (elegir opción), no atajos de la página
    if (tag === 'SELECT') return;
    const k = e.key.toLowerCase();
    if (k === 'e' && EIJ.imagen) { EIJ.imagen.toggleMode(); return; }
    // En "Escucha una imagen": la imagen tiene sus teclas; voz, órdenes, vibración y ayuda siguen igual
    if (imageMode() && !['v', 'o', 't', 'h'].includes(k)) { EIJ.imagen.key(e); return; }
    if (e.code === 'Space') {
      // Sobre un botón, enlace o casilla, Espacio pulsa ese control, como espera el teclado y el lector de pantalla
      if (tag === 'BUTTON' || tag === 'A' || tag === 'SUMMARY' || (tag === 'INPUT' && e.target.type === 'checkbox')) return;
      e.preventDefault(); if (!e.repeat) toggle();
    } else if (e.key === 'ArrowRight' && TRACKS.length > 1) select(cur + 1, wantPlay);
    else if (e.key === 'ArrowLeft' && TRACKS.length > 1) select(cur - 1, wantPlay);
    else if (/^[1-9]$/.test(e.key) && +e.key <= TRACKS.length) select(+e.key - 1, wantPlay);
    else if (k === 'd') describeNow();
    else if (k === 'v') setVoice(!voiceOn);
    else if (k === 'o') setMic(!micOn);
    else if (k === 't' && V && V.status().api) toggleVibe();
    else if (k === 'i') announce(introText(TRACKS[cur]));
    // Echoes of Tomorrow, en la comparación de dos fotos (js/futuros-comparar.js): F = primera foto, J = segunda
    else if ((k === 'f' || k === 'j') && EIJ.comparar && EIJ.comparar.active()) { if (!e.repeat) EIJ.comparar.play(k === 'f' ? 0 : 1); }
    else if (k === 'f' && F) cycleFut();
    else if (k === 'h') how.showModal();
    else if (k === 'm' && M && tag !== 'SELECT') nextInst();
    else if (e.key === ',') stepData(-1);
    else if (e.key === '.') stepData(1);
    else if (e.key === 'Home') { e.preventDefault(); restart(); }
  });

  // Las imágenes cargan después: redibujar cuando estén
  $('imgA').addEventListener('load', draw);

  buildThumbs();
  buildInstOptions();
  let savedVoice = false;
  try { savedVoice = localStorage.getItem('eij-voz') === '1'; } catch (e) { /* sin almacenamiento */ }
  setVoice(savedVoice, true);
  select(0, false, true);   // al entrar al Jukebox el asistente no habla
  requestAnimationFrame(loop);

  // ---------- Modo accesible: texto grande, más contraste y guía por voz ----------
  // Se elige en la portada (ventana F / J) y se guarda en js/nav.js (EIJ.a11y); aquí se puede cambiar con el botón.
  const A = EIJ.a11y;
  function syncA11y(silent) {
    const on = !!(A && A.on);
    const b = $('a11yBtn');
    b.setAttribute('aria-pressed', String(on));
    b.textContent = on ? '♿ Modo accesible: sí' : '♿ Modo accesible';
    if (on !== voiceOn && synth) setVoice(on, silent);
    else if (!silent) announce(on ? 'Modo accesible activado.' : 'Modo accesible desactivado.');
    requestAnimationFrame(draw);
  }
  if (A) {
    $('a11yBtn').addEventListener('click', () => { A.set(!A.on); syncA11y(false); });
    if (A.on) syncA11y(true);
    else { const b = $('a11yBtn'); b.setAttribute('aria-pressed', 'false'); }
  } else $('a11yBtn').hidden = true;

  // ---------- Barra de navegación: "Jukebox" y "Escucha una imagen" cambian de modo ----------
  $('navLinks').addEventListener('click', (e) => {
    const a = e.target.closest('a[data-nav-mode]');
    if (a) $(a.dataset.navMode === 'img' ? 'modeImg' : 'modeCol').click();
  });
  // Desde la portada: jukebox.html#imagen abre directamente "Escucha una imagen"
  if (location.hash === '#imagen') setTimeout(() => $('modeImg').click(), 0);
  document.querySelectorAll('[data-open-help]').forEach((b) => b.addEventListener('click', () => how.showModal()));

  // La bienvenida por voz se da solo en la portada (js/nav.js); al entrar al Jukebox el asistente no habla.
})();
