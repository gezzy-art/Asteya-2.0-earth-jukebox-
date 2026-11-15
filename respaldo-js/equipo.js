/* ============================================================
 *  EQUIPO · edita este archivo con los datos reales del equipo
 * ============================================================
 *  - nombre:  nombre de la persona
 *  - rol:     qué hizo en el proyecto (una línea)
 *  - texto:   una frase sobre su aporte o por qué participó (opcional)
 *  - foto:    ruta a una foto cuadrada, por ejemplo 'assets/equipo/ana.jpg' (opcional;
 *             si no hay foto se muestran las iniciales)
 *  - enlace:  LinkedIn, GitHub o web personal (opcional)
 *  Puedes agregar o quitar personas: la página se ajusta sola.
 */
window.EQUIPO = {
  nombre: 'Nuestro equipo',            // ← nombre del equipo
  intro: 'Somos estudiantes que participamos en el NASA Space Apps Challenge 2026. Nos unió una pregunta: ¿se puede entender el cambio climático sin ver una sola gráfica?',
  personas: [
    { nombre: '', rol: 'Datos y sonificación', texto: 'Convirtió los datos de la NASA en reglas de sonido.', foto: '', enlace: '' },
    { nombre: 'Rachel Tejada', rol: 'Diseño y accesibilidad', texto: 'Diseñó la experiencia para que cualquiera pueda usarla.', foto: '', enlace: '' },
    { nombre: 'Jeriel Baez', rol: 'Programación web', texto: 'Construyó el Jukebox, el recorrido y el Laboratorio.', foto: '', enlace: '' },
    { nombre: 'Ashenet Placencia', rol: 'Investigación y narrativa', texto: 'Escribió la historia que cuentan los subtítulos.', foto: '', enlace: '' }
  ]
};

(function () {
  'use strict';
  const E = window.EQUIPO, list = document.getElementById('teamList');
  if (!E || !list) return;
  const esc = (s) => String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const initials = (n) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');

  document.getElementById('teamName').textContent = E.nombre;
  document.getElementById('teamIntro').textContent = E.intro;
  list.innerHTML = E.personas.map((p) => `
    <li class="member">
      ${p.foto ? `<img class="member-photo" src="${esc(p.foto)}" alt="Foto de ${esc(p.nombre)}">`
               : `<span class="member-initials" aria-hidden="true">${esc(initials(p.nombre))}</span>`}
      <span>
        <span class="member-name block">${esc(p.nombre)}</span>
        <span class="member-role block">${esc(p.rol)}</span>
      </span>
      ${p.texto ? `<span class="member-text">${esc(p.texto)}</span>` : ''}
      ${p.enlace ? `<a class="text-sm underline hover:text-white mt-auto" href="${esc(p.enlace)}" target="_blank" rel="noopener">Perfil ↗</a>` : ''}
    </li>`).join('');
})();
