/* Earth Jukebox · vibración y botones del control (Xbox y PlayStation) con la Gamepad API del navegador.
 *
 * El jukebox le pasa cada dato en el momento en que suena (lo lee del reloj del propio audio), así que la
 * vibración nunca se adelanta ni se atrasa respecto a la música, y se detiene en cuanto el audio se pausa.
 * Las reglas de cada pista (qué vibra y cuánto) están en js/jukebox.js, junto al resto de la pista (campo `haptic`).
 *
 * Funciona en Chrome y Edge. Firefox lee el control pero no lo hace vibrar. Por seguridad, el navegador no
 * "ve" el control hasta que se pulsa un botón con la página abierta.
 */
(function () {
  'use strict';
  const EIJ = window.EIJ = window.EIJ || {};
  const hasApi = typeof navigator.getGamepads === 'function';

  // Tope de fuerza: con los motores al máximo el control zumba tanto que se oye por encima de la música.
  // Mientras habla la guía por voz, la vibración baja aún más, igual que baja la música.
  const MAX = 0.8, DUCK = 0.45;

  let enabled = true, timers = [], listeners = [];
  try { enabled = localStorage.getItem('eij-vibracion') !== '0'; } catch (e) { /* sin almacenamiento */ }

  // Controles que pueden vibrar (puede haber más de uno conectado)
  function pads() {
    if (!hasApi) return [];
    return [...navigator.getGamepads()].filter((p) => p && p.connected);
  }
  const canRumble = (p) => !!(p.vibrationActuator && typeof p.vibrationActuator.playEffect === 'function');
  function rumblers() { return pads().filter(canRumble); }

  function padKind(p) {
    const id = p.id.toLowerCase();
    if (/054c|dualsense|dualshock|playstation|wireless controller/.test(id)) return 'ps';
    if (/045e|xbox|xinput/.test(id)) return 'xbox';
    return 'otro';
  }
  function padName(p) { return { ps: 'control de PlayStation', xbox: 'control de Xbox', otro: 'control' }[padKind(p)]; }

  let lastError = '', lastResult = '';
  function status() {
    const all = pads(), r = all.filter(canRumble), p = r[0] || all[0];
    return {
      // Diagnóstico: lo que el navegador dice del control
      id: p ? p.id : '',
      mapping: p ? p.mapping || '(sin mapeo estándar)' : '',
      effects: p && p.vibrationActuator ? (p.vibrationActuator.effects || [p.vibrationActuator.type || '?']).join(', ') : '',
      lastError, lastResult,
      firefox: /firefox/i.test(navigator.userAgent),
      api: hasApi,
      connected: all.length > 0,
      canVibrate: r.length > 0,
      name: (r[0] || all[0]) ? padName(r[0] || all[0]) : '',
      kind: (r[0] || all[0]) ? padKind(r[0] || all[0]) : '',
      enabled,
      active: enabled && r.length > 0
    };
  }
  function changed() { const s = status(); listeners.forEach((f) => f(s)); }

  function rumble(ms, strong, weak) {
    const duck = window.speechSynthesis && window.speechSynthesis.speaking ? DUCK : 1;
    const s = Math.min(MAX, Math.max(0, strong)) * duck, w = Math.min(MAX, Math.max(0, weak)) * duck;
    rumblers().forEach((p) => {
      p.vibrationActuator.playEffect('dual-rumble', {
        startDelay: 0, duration: Math.max(20, Math.round(ms)), strongMagnitude: s, weakMagnitude: w
      }).then((res) => {
        // "complete" o "preempted" (otro efecto lo reemplazó) son normales
        if (res !== lastResult) { lastResult = res; if (res === 'complete') lastError = ''; changed(); }
      }).catch((err) => {
        const msg = `${err && err.name || 'Error'}: ${err && err.message || err}`;
        if (msg !== lastError) { lastError = msg; changed(); }
      });
    });
  }

  // Detiene la vibración en curso y las que estaban por sonar
  function stop() {
    timers.forEach(clearTimeout); timers = [];
    rumblers().forEach((p) => {
      const a = p.vibrationActuator;
      if (typeof a.reset === 'function') a.reset().catch(() => {});
      else a.playEffect('dual-rumble', { duration: 0, strongMagnitude: 0, weakMagnitude: 0 }).catch(() => {});
    });
  }

  /* Toca un patrón: lista de pulsos [retraso ms, duración ms, motor grave 0–1, motor agudo 0–1],
   * medidos a velocidad normal. `rate` es la velocidad de reproducción: a doble velocidad todo dura la mitad,
   * para que cada pulso siga cayendo sobre su nota. Un patrón nuevo corta el anterior: nunca se amontonan. */
  function play(pattern, rate) {
    if (!enabled || !pattern || !pattern.length) return;
    if (!rumblers().length) return;
    timers.forEach(clearTimeout); timers = [];
    rate = rate > 0 ? rate : 1;
    pattern.forEach(([at, ms, strong, weak]) => {
      if (at <= 0) rumble(ms / rate, strong, weak);
      else timers.push(setTimeout(() => rumble(ms / rate, strong, weak), at / rate));
    });
  }

  function setEnabled(on) {
    enabled = !!on;
    try { localStorage.setItem('eij-vibracion', enabled ? '1' : '0'); } catch (e) { /* sin almacenamiento */ }
    if (!enabled) stop();
    changed();
  }

  // Un toque corto para comprobar que el control responde
  function test() { play([[0, 120, 0.6, 0], [220, 120, 0, 0.6]], 1); }

  /* ---------- Botones ----------
   * La Gamepad API no avisa cuando se pulsa un botón: hay que mirar el control en cada cuadro.
   * Solo se avisa al bajar el botón (mantenerlo pulsado no repite). Los números son la posición en el
   * "mapeo estándar" del navegador, igual en Xbox y PlayStation: 0 = abajo (A / ✕), 1 = derecha (B / ○),
   * 2 = izquierda (X / □), 3 = arriba (Y / △), 4/5 = botones superiores, 6/7 = gatillos, 8 = Vista / Create,
   * 9 = Menú / Options, 12–15 = cruceta (arriba, abajo, izquierda, derecha). */
  const btnListeners = [], held = {};
  let polling = false;
  const isDown = (b) => b.pressed || b.value > 0.5;
  function poll() {
    const ps = pads();
    ps.forEach((p) => {
      const prev = held[p.index] || (held[p.index] = []);
      p.buttons.forEach((b, i) => {
        const down = isDown(b);
        if (down && !prev[i]) btnListeners.forEach((f) => f(i, p));
        prev[i] = down;
      });
    });
    if (ps.length) requestAnimationFrame(poll); else polling = false;
  }
  function startPolling() {
    // El botón que despertó al control sigue pulsado: se marca como ya visto para que no dispare una acción
    pads().forEach((p) => { held[p.index] = p.buttons.map(isDown); });
    if (!polling) { polling = true; requestAnimationFrame(poll); }
  }

  if (hasApi) {
    window.addEventListener('gamepadconnected', () => { startPolling(); changed(); });
    window.addEventListener('gamepaddisconnected', (e) => {
      timers.forEach(clearTimeout); timers = [];
      if (e.gamepad) delete held[e.gamepad.index];
      changed();
    });
    if (pads().length) startPolling();
  }

  EIJ.vibracion = {
    status, play, stop, test, setEnabled,
    onChange(f) { listeners.push(f); },
    onButton(f) { btnListeners.push(f); }
  };
})();
