/* Punto de entrada: inicializa la interfaz y ejecuta el bucle de animación. */
(function () {
  'use strict';
  const EIJ = window.EIJ;
  const { W, state } = EIJ;
  const PASSIVE_SAMPLE_S = 0.15;   // telemetría sin sonido cuando está en pausa

  let lastT = performance.now();
  let passiveAcc = 0;

  function frame(now) {
    const dt = Math.min(0.1, (now - lastT) / 1000);
    lastT = now;
    state.simT += dt * 0.6;

    EIJ.render.drawFrame();

    // El radar avanza PX_PER_TICK píxeles por semicorchea al tempo efectivo (con movimiento)
    const bpm = EIJ.audio.effectiveBpm();
    EIJ.audio.setBpm(bpm);
    if (state.playing && state.mode === 'radar') {
      state.scanX += dt * (bpm / 60) * 4 * EIJ.PX_PER_TICK;
      if (state.scanX >= W) state.scanX -= W;
    }

    EIJ.render.drawOverlay();

    passiveAcc += dt;
    if (!state.playing && passiveAcc > PASSIVE_SAMPLE_S) {
      passiveAcc = 0;
      const a = EIJ.audio.analyze();
      EIJ.ui.updateTelemetry(a && a.s, a && a.m, false, false);
    }
    requestAnimationFrame(frame);
  }

  EIJ.ui.init();
  requestAnimationFrame(frame);
})();
