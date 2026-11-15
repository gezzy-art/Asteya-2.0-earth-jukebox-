/* Barra de navegación, modo accesible y (en la portada) la ventana de bienvenida "¿activar el modo accesible?".
 * Compartido por index.html y jukebox.html. La elección se guarda para que el Jukebox la respete. */
(function () {
  'use strict';
  window.EIJ = window.EIJ || {};
  const $ = (id) => document.getElementById(id);
  const KEY = 'eij-a11y';

  // ---------- Modo accesible: se guarda y se aplica en todas las páginas ----------
  let on = false;
  try { on = localStorage.getItem(KEY) === '1'; } catch (e) { /* sin almacenamiento */ }
  const listeners = [];
  function apply() { document.documentElement.classList.toggle('a11y-mode', on); }
  apply();
  EIJ.a11y = {
    get on() { return on; },
    set(v) {
      on = !!v;
      try { localStorage.setItem(KEY, on ? '1' : '0'); } catch (e) { /* sin almacenamiento */ }
      apply();
      listeners.forEach((fn) => fn(on));
    },
    onChange(fn) { listeners.push(fn); }
  };

  // ---------- Voz del asistente: la más natural que tenga el navegador ----------
  // Las voces "Natural"/"Online" de Edge (Dalia, Jorge…) y las de Google suenan humanas; las locales
  // de Windows (Sabina, Helena) son robóticas y quedan al final. Entre iguales, mejor español de México/Latam.
  EIJ.voz = {
    rate: 1,      // velocidad normal: acelerar la voz la hace sonar más artificial
    pitch: 1,
    pick() {
      const synth = window.speechSynthesis;
      if (!synth || !synth.getVoices) return null;
      // Con la página en inglés (js/i18n.js) se busca una voz inglesa con los mismos criterios
      const en = !!(EIJ.i18n && EIJ.i18n.lang === 'en');
      const score = (v) => {
        if (!(en ? /^en/i : /^es/i).test(v.lang)) return -1;
        const n = v.name;
        let s = 0;
        if (/natural|neural/i.test(n)) s += 100;
        else if (/online/i.test(n)) s += 80;
        else if (/google/i.test(n)) s += 60;
        else if (/premium|enhanced|mejorad/i.test(n)) s += 50;
        if (en) { if (/^en(-|_)US/i.test(v.lang)) s += 10; else if (/^en(-|_)GB/i.test(v.lang)) s += 8; }
        else if (/^es(-|_)MX/i.test(v.lang)) s += 10;
        else if (/^es(-|_)(US|419)/i.test(v.lang)) s += 8;
        if (/dalia|paloma|elvira|ximena|jorge|alvaro|monica|paulina|aria|jenny|guy|samantha/i.test(n)) s += 3;
        return s;
      };
      let best = null, bestS = -1;
      synth.getVoices().forEach((v) => { const s = score(v); if (s > bestS) { best = v; bestS = s; } });
      return best;
    }
  };

  // ---------- Barra de navegación ----------
  const links = $('navLinks'), toggle = $('navToggle');
  if (links && toggle) {
    toggle.addEventListener('click', () => {
      const open = links.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(open));
    });
    links.addEventListener('click', (e) => {
      if (!e.target.closest('a')) return;
      links.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    });
  }

  // ---------- Bienvenida: ¿activar el modo accesible? F = sí, J = no ----------
  // Solo existe en la portada y sale cada vez que se entra a ella.
  // F y J tienen relieve en el teclado: se encuentran sin mirar. El asistente da la bienvenida y lee la pregunta
  // en cuanto se abre la página; si el navegador impide hablar hasta el primer clic o tecla, la primera tecla
  // o clic la lee, y si se elige sin haberla oído, la bienvenida se dice al elegir.
  // La portada anima su entrada (texto que sube y la Tierra que asoma) cuando se cierra esta ventana,
  // para que no ocurra tapada por ella. Sin ventana, en cuanto carga.
  const introGo = () => document.documentElement.classList.add('intro-go');
  const dlg = $('a11yDialog');
  if (!dlg || typeof dlg.showModal !== 'function') { introGo(); return; }

  const synth = window.speechSynthesis;
  const BIENVENIDA = 'Hola, bienvenida a Earth Jukebox, un proyecto de Asteya para el NASA Space Apps Challenge.';
  const PREGUNTA = BIENVENIDA + ' ' +
    '¿Quieres activar el modo de accesibilidad para personas con discapacidad? ' +
    'Pulsa la F para activarlo o la J para seguir sin él.';
  let welcomed = false;   // true cuando la voz realmente empezó a hablar
  function say(text) {
    if (!synth || !window.SpeechSynthesisUtterance) return;
    synth.cancel();
    const v = EIJ.voz.pick();
    // Frase a frase: Chrome corta en silencio las locuciones largas
    text.split(/(?<=[.?])\s+/).forEach((p, i) => {
      const u = new SpeechSynthesisUtterance(p);
      u.lang = v ? v.lang : (EIJ.i18n && EIJ.i18n.lang === 'en' ? 'en-US' : 'es-ES'); if (v) u.voice = v; u.rate = EIJ.voz.rate; u.pitch = EIJ.voz.pitch;
      if (i === 0 && text.indexOf(BIENVENIDA) === 0) u.onstart = () => { welcomed = true; };
      synth.speak(u);
    });
  }
  function announce(text) {
    const el = $('a11yLive');
    if (el) { el.textContent = ''; setTimeout(() => { el.textContent = text; }, 30); }
  }

  let done = false;
  function choose(yes) {
    if (done) return;
    done = true;
    window.removeEventListener('keydown', onKey, true);
    dlg.removeEventListener('pointerdown', onPointer);
    dlg.close();
    introGo();
    EIJ.a11y.set(yes);
    const msg = yes
      ? 'Modo accesible activado: texto más grande, más contraste y, en el Jukebox, guía por voz. ' +
        'Pulsa Enter para empezar el recorrido guiado, o la J para ir al Jukebox.'
      : 'Modo normal. Pulsa Enter para empezar el recorrido o la J para ir al Jukebox.';
    // Si el navegador no dejó hablar al cargar, la bienvenida suena ahora (es el primer gesto de la persona)
    const pre = welcomed ? '' : BIENVENIDA + ' ';
    if (yes) say(pre + msg); else if (pre) say(BIENVENIDA); else if (synth) synth.cancel();
    announce(msg);
    const start = $('startBtn');
    if (start) start.focus({ preventScroll: true });
  }
  function onKey(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === 'f' || k === 'j') { e.preventDefault(); e.stopImmediatePropagation(); choose(k === 'f'); return; }
    // Tab, Enter y Espacio siguen sirviendo para elegir con los botones
    if (['tab', 'shift', 'enter', ' ', 'escape'].includes(k)) return;
    e.preventDefault(); e.stopImmediatePropagation();
    say(PREGUNTA);
  }
  // Un clic dentro de la ventana (fuera de los botones) también lee la bienvenida si aún no sonó
  function onPointer(e) {
    if (welcomed || e.target.closest('button')) return;
    say(PREGUNTA);
  }
  dlg.addEventListener('pointerdown', onPointer);
  $('a11yYes').addEventListener('click', () => choose(true));
  $('a11yNo').addEventListener('click', () => choose(false));
  dlg.addEventListener('cancel', (e) => { e.preventDefault(); choose(false); });   // Esc = no

  window.addEventListener('keydown', onKey, true);
  dlg.showModal();
  $('a11yYes').focus();
  // La bienvenida suena desde que se entra. Las voces pueden tardar en cargar: se espera a que estén (máx. 1 s).
  let spoke = false;
  const speakNow = () => { if (spoke || done) return; spoke = true; say(PREGUNTA); };
  if (synth && synth.getVoices && synth.getVoices().length) setTimeout(speakNow, 200);
  else if (synth) {
    synth.addEventListener && synth.addEventListener('voiceschanged', speakNow, { once: true });
    setTimeout(speakNow, 1000);
  }
})();
