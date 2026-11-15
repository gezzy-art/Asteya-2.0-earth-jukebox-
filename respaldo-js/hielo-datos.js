/* Extensión del hielo marino del Ártico en septiembre (millones de km²), el mes del mínimo anual.
 * Fuente: NSIDC Sea Ice Index (G02135, v3), datos satelitales SMMR/SSM/I/SSMIS, obtenidos de
 * https://psl.noaa.gov/data/timeseries/monthly/data/n_iceextent.mon.data (descargado el 2026-11-11).
 * Fetterer, F. et al. 2017, doi:10.7265/N5K072F8. */
(function () {
  'use strict';
  window.EIJ.SEAICE = {
    firstYear: 1979,
    lastYear: 2026,
    source: 'NSIDC Sea Ice Index (satélites NASA/NOAA)',
    url: 'https://nsidc.org/data/g02135',
    extent: [7.05, 7.67, 7.14, 7.30, 7.39, 6.81, 6.70, 7.41, 7.28, 7.37, 7.01, 6.14, 6.47, 7.47, 6.40, 7.14, 6.08, 7.58, 6.69, 6.54, 6.12, 6.25, 6.73, 5.83, 6.12, 5.98, 5.50, 5.86, 4.27, 4.69, 5.26, 4.87, 4.56, 3.57, 5.21, 5.22, 4.62, 4.53, 4.82, 4.79, 4.36, 4.00, 4.95, 4.90, 4.38, 4.35, 4.75, 4.81]
  };
})();