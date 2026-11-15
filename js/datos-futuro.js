/* ======================================================================
   datos-futuro · Echoes of Tomorrow (pista 7 del Jukebox)
   ======================================================================
 * Proyecciones de la temperatura global para dos escenarios de emisiones.
 * Fuente: IPCC AR6, Grupo de Trabajo I, Resumen para responsables de políticas, tabla SPM.1
 * (https://www.ipcc.ch/report/ar6/wg1/). Mejor estimación y rango "muy probable" (5–95 %) del calentamiento
 * respecto a 1850–1900 para tres periodos:
 *   SSP1-2.6 (bajas emisiones):  2021–2040 1.5 (1.2–1.8) · 2041–2060 1.7 (1.3–2.2) · 2081–2100 1.8 (1.3–2.4) °C
 *   SSP5-8.5 (altas emisiones):  2021–2040 1.6 (1.3–1.9) · 2041–2060 2.4 (1.9–3.0) · 2081–2100 4.4 (3.3–5.7) °C
 *
 * Cómo se pasa a una serie año por año (aproximación, se explica también en la página):
 *  1. Cada periodo se coloca en su año central (2030, 2050, 2090).
 *  2. Se cambia la referencia a la de GISTEMP (1951–1980) para que la historia y el futuro suenen en la misma
 *     escala: GISTEMP empieza en 1880, así que 1850–1900 se aproxima con el promedio de GISTEMP 1880–1900.
 *  3. El punto de partida es el promedio medido de los últimos 5 años (centrado en su año del medio).
 *  4. Entre esos puntos, una recta; de 2090 a 2100 sigue la pendiente de 2050–2090.
 * Son proyecciones de escenarios, no predicciones: dicen qué pasaría según cuánto emitamos. */
(function () {
  'use strict';
  const EIJ = window.EIJ, G = EIJ.GISTEMP;
  const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;

  // 1850–1900 respecto a 1951–1980 (≈ −0.22 °C con los datos actuales)
  const preind = mean(G.anomalies.slice(0, 1900 - G.firstYear + 1));
  const recent = G.anomalies.slice(-5), anchorYear = G.lastYear - 2, anchor = mean(recent);

  const IPCC = {
    low: { ssp: 'SSP1-2.6', name: 'Bajas emisiones', p: [[2030, 1.5, 1.2, 1.8], [2050, 1.7, 1.3, 2.2], [2090, 1.8, 1.3, 2.4]] },
    high: { ssp: 'SSP5-8.5', name: 'Altas emisiones', p: [[2030, 1.6, 1.3, 1.9], [2050, 2.4, 1.9, 3.0], [2090, 4.4, 3.3, 5.7]] }
  };

  const years = [];
  for (let y = G.lastYear + 1; y <= 2100; y++) years.push(y);

  function series(sc) {
    // Puntos [año, medio, bajo, alto] en la referencia 1951–1980; el ancla no tiene rango
    const pts = [[anchorYear, anchor, anchor, anchor]].concat(sc.p.map(([y, m, l, h]) => [y, m + preind, l + preind, h + preind]));
    const at = (y, k) => {
      let a = pts[pts.length - 2], b = pts[pts.length - 1];   // por defecto, extrapola con el último tramo
      for (let i = 0; i < pts.length - 1; i++) if (y <= pts[i + 1][0]) { a = pts[i]; b = pts[i + 1]; break; }
      return a[k] + (b[k] - a[k]) * (y - a[0]) / (b[0] - a[0]);
    };
    const r2 = (v) => Math.round(v * 100) / 100;
    return {
      ssp: sc.ssp, name: sc.name,
      mid: years.map((y) => r2(at(y, 1))), lo: years.map((y) => r2(at(y, 2))), hi: years.map((y) => r2(at(y, 3))),
      ipcc: sc.p
    };
  }

  EIJ.FUTURO = {
    years, preind, low: series(IPCC.low), high: series(IPCC.high),
    source: 'IPCC AR6 (WG1, tabla SPM.1)', url: 'https://www.ipcc.ch/report/ar6/wg1/'
  };

  // Tiempos de la pista para la página (la duración exacta la pone js/jukebox-musica.js)
  const T = window.JUKEBOX_TIEMPOS, n = G.anomalies.length + years.length;
  ['ambos', 'bajo', 'alto'].forEach((m) => { T['future_' + m] = { step: 0.3, intro: 1, n, dur: 1 + n * 0.3 + 4.5 }; });
})();
