/* Idioma: español (original) o inglés.
 * Botón ES / EN en la barra de navegación de todas las páginas; la elección se guarda (localStorage 'eij-lang').
 * Al pasar a inglés se traduce el texto de la página, los atributos accesibles (aria-label, title, alt…) y todo lo
 * que los scripts escriben después (subtítulos, anuncios, etiquetas), gracias a un MutationObserver.
 * La voz del navegador también habla en inglés. Volver a español recarga la página (el HTML original es español).
 *
 * Cómo traduce: busca cada frase en DICT. Los números (y los meses antes de un año) se tratan como comodines, así
 * que "Pista 3 de 6" usa la entrada "Pista 1 de 6". Si una frase no está entera, la parte por oraciones, ": ",
 * " · ", ", " e " y ", y traduce cada trozo. Las frases se escriben en DICT tal cual aparecen en español.
 * Para añadir textos nuevos: agrega un par ["español", "English"] (con los números en el mismo orden). */
(function () {
  'use strict';
  const EIJ = window.EIJ = window.EIJ || {};
  const KEY = 'eij-lang';
  let lang = 'es';
  try { lang = localStorage.getItem(KEY) === 'en' ? 'en' : 'es'; } catch (e) { /* sin almacenamiento */ }

  // ---------------------------------------------------------------- Diccionario
  const DICT = [
    // ----- Navegación y comunes
    ["Saltar al contenido", "Skip to content"], ["Saltar al reproductor", "Skip to the player"],
    ["Menú", "Menu"], ["Principal", "Main"], ["Inicio · Recorrido", "Home · Guided tour"], ["Inicio", "Home"],
    ["Escucha una imagen", "Listen to an image"], ["Ir al Jukebox", "Go to the Jukebox"],
    ["Volver al recorrido", "Back to the tour"], ["Volver al Jukebox", "Back to the Jukebox"], ["Recorrido guiado", "Guided tour"],
    ["Sí", "Yes"], ["No", "No"], ["Cerrar", "Close"], ["Fin", "End"], ["Fuente", "Source"], ["Fuentes", "Sources"],
    ["Escucha cómo cambia la Tierra", "Listen to how the Earth is changing"],
    ["Pantalla completa", "Fullscreen"], ["Ver el globo en pantalla completa", "View the globe fullscreen"],
    ["Salir de pantalla completa", "Exit fullscreen"],

    // ----- Portada
    ["Earth Jukebox · datos de la NASA convertidos en sonido", "Earth Jukebox · NASA data turned into sound"],
    ["Cómo suena un planeta", "How does a planet"], ["que se calienta", "sound as it warms"],
    ["No hace falta mirar gráficas. Escucha cómo ha cambiado la Tierra.", "You don't need to look at charts. Listen to how the Earth has changed."],
    ["Empezar", "Start"],
    ["Mejor con audífonos · Empezar: recorrido guiado de 4 capítulos · Jukebox: toda la colección, también con los ojos cerrados (tecla",
      "Best with headphones · Start: a 4-chapter guided tour · Jukebox: the whole collection, even with your eyes closed (key"],
    ["Ir directo a un capítulo", "Jump straight to a chapter"], ["Ir a un capítulo", "Go to a chapter"],
    ["Conoce al equipo y por qué lo hicimos", "Meet the team and why we made this"],
    ["Por qué lo hicimos", "Why we made it"], ["Los datos del planeta", "The planet's data"],
    ["no deberían ser solo para quien puede verlos", "shouldn't be only for those who can see it"],
    ["La NASA publica visualizaciones increíbles de cómo cambia la Tierra: mapas de temperatura, hielo que se derrite, corrientes del océano. Pero todas tienen algo en común",
      "NASA publishes amazing visualizations of how the Earth is changing: temperature maps, melting ice, ocean currents. But they all have one thing in common"],
    ["solo se pueden mirar", "you can only look at them"],
    ["Según la Organización Mundial de la Salud, al menos 2,200 millones de personas viven con algún problema de visión.",
      "According to the World Health Organization, at least 2,200 million people live with some kind of vision impairment."],
    ["El reto", "The"],
    ["del NASA Space Apps Challenge 2026 propone traducir esos datos a sonido. Nosotros quisimos ir un paso más allá: que el sonido no sea un fondo bonito, sino",
      "challenge of the NASA Space Apps Challenge 2026 proposes translating that data into sound. We wanted to go one step further: for the sound not to be a pretty background, but"],
    ["el dato mismo", "the data itself"], ["y que cualquiera pueda entender la historia que cuenta", "and for anyone to understand the story it tells"],
    ["Por qué lo hicimos así", "Why we made it this way"], ["Cinco decisiones", "Five decisions"],
    ["Datos reales, no música inventada", "Real data, not made-up music"],
    ["Cada nota sale de un número de la NASA o la NOAA con reglas fijas: más calor, nota más aguda; menos hielo, menos campanas. Si cambian los datos, cambia el sonido.",
      "Every note comes from a NASA or NOAA number with fixed rules: more heat, higher note; less ice, fewer bells. If the data changes, the sound changes."],
    ["Una historia, no datos sueltos", "A story, not loose data"],
    ["El orden cuenta algo: la Tierra se calienta, el océano mueve el calor, el aire cambia (la causa). Y al final, cómo nos vemos desde el espacio: las luces de la noche.",
      "The order tells something: the Earth warms, the ocean moves the heat, the air changes (the cause). And finally, how we look from space: the lights at night."],
    ["Sencillo primero", "Simple first"],
    ["Como en las sonificaciones de la NASA: una imagen, un botón y subtítulos que explican qué estás oyendo. Sin paneles ni configuraciones: pulsas y escuchas.",
      "Like NASA's sonifications: one image, one button and captions that explain what you're hearing. No panels or settings: press and listen."],
    ["Accesible por diseño", "Accessible by design"],
    ["Todo funciona con el teclado y con lector de pantalla; los subtítulos narran los datos y, en el celular, la vibración acompaña las notas.",
      "Everything works with the keyboard and with screen readers; captions narrate the data and, on phones, vibration follows the notes."],
    ["Dos formas de escuchar", "Two ways to listen"],
    ["Este recorrido guiado, que cuenta la historia capítulo a capítulo, y el", "This guided tour, which tells the story chapter by chapter, and the"],
    ["6 pistas para escuchar de corrido, con instrumentos a elegir y control por voz.", "6 tracks to listen to straight through, with instruments to choose from and voice control."],
    ["El equipo", "The team"], ["Nuestro equipo", "Our team"], ["Perfil", "Profile"],
    ["Somos estudiantes que participamos en el NASA Space Apps Challenge 2026. Nos unió una pregunta: ¿se puede entender el cambio climático sin ver una sola gráfica?",
      "We are students taking part in the NASA Space Apps Challenge 2026. One question brought us together: can you understand climate change without seeing a single chart?"],
    ["Datos y sonificación", "Data and sonification"], ["Diseño y accesibilidad", "Design and accessibility"],
    ["Programación web", "Web development"], ["Investigación y narrativa", "Research and storytelling"],
    ["Convirtió los datos de la NASA en reglas de sonido.", "Turned NASA data into sound rules."],
    ["Diseñó la experiencia para que cualquiera pueda usarla.", "Designed the experience so anyone can use it."],
    ["Construyó el Jukebox y el recorrido guiado.", "Built the Jukebox and the guided tour."],
    ["Escribió la historia que cuentan los subtítulos.", "Wrote the story the captions tell."],
    ["Volver a empezar", "Back to the start"], ["Escuchar la colección completa", "Listen to the full collection"],
    // Ventana de bienvenida
    ["Bienvenida a Earth Jukebox", "Welcome to Earth Jukebox"],
    ["Activar el modo de accesibilidad", "Turn on accessibility mode"],
    ["Texto más grande, más contraste y guía por voz para personas con discapacidad.", "Larger text, more contrast and a voice guide for people with disabilities."],
    ["F y J tienen una marca en relieve en el teclado.", "F and J have a raised mark on the keyboard."],
    ["Hola, bienvenida a Earth Jukebox, un proyecto de Asteya para el NASA Space Apps Challenge.", "Hi, welcome to Earth Jukebox, a project by Asteya for the NASA Space Apps Challenge."],
    ["Quieres activar el modo de accesibilidad para personas con discapacidad", "Would you like to turn on accessibility mode for people with disabilities"],
    ["Pulsa la F para activarlo o la J para seguir sin él.", "Press F to turn it on or J to continue without it."],
    ["Modo accesible activado: texto más grande, más contraste y, en el Jukebox, guía por voz.", "Accessible mode on: larger text, more contrast and, in the Jukebox, a voice guide."],
    ["Pulsa Enter para empezar el recorrido guiado, o la J para ir al Jukebox.", "Press Enter to start the guided tour, or J to go to the Jukebox."],
    ["Modo normal.", "Normal mode."], ["Pulsa Enter para empezar el recorrido o la J para ir al Jukebox.", "Press Enter to start the tour or J to go to the Jukebox."],

    // ----- Recorrido: cabecera de capítulos
    ["Progreso del recorrido", "Tour progress"], ["Capítulos del recorrido: ir a cualquiera", "Tour chapters: go to any"],
    ["Volver a la portada", "Back to the cover"], ["1 de 4", "1 of 4"], ["Capítulo 1", "Chapter 1"],
    ["El planeta se calienta", "The planet is warming"], ["El océano mueve el calor", "The ocean moves the heat"],
    ["La causa", "The cause"], ["La causa: el aire que cambia", "The cause: the changing air"],
    ["Las luces de la noche", "The lights at night"], ["Las luces de la noche cambian", "The lights at night are changing"],
    ["El océano", "The ocean"], ["Siguiente", "Next"], ["Terminar el recorrido", "Finish the tour"],
    // Capítulo 1
    ["Cada nota es un año, desde 1880 hasta hoy.", "Each note is a year, from 1880 to today."],
    ["Cuanto más aguda la nota, más caliente estuvo la Tierra.", "The higher the note, the warmer the Earth was."],
    ["Pulsa “Escuchar” y deja que la Tierra te lo cuente.", "Press “Listen” and let the Earth tell you."],
    ["Escuchar 1880 → 2025", "Listen 1880 → 2025"], ["Escuchar 1958 → hoy", "Listen 1958 → today"],
    ["Escucha la diferencia", "Hear the difference"],
    ["Compara un año de antes con uno de ahora. Cierra los ojos si quieres.", "Compare a year from back then with one from now. Close your eyes if you like."],
    ["Grave, lento, tranquilo", "Low, slow, calm"], ["Agudo, rápido, con alarma", "High, fast, with an alarm"],
    ["Qué estoy escuchando", "What am I hearing"],
    ["Una nota = un año.", "One note = one year."], ["Son 146 años de mediciones de la NASA en todo el planeta.", "That's 146 years of NASA measurements across the planet."],
    ["Nota más aguda = año más caliente.", "Higher note = warmer year."],
    ["Se compara con lo “normal”: el promedio de 1951 a 1980.", "It's compared with “normal”: the 1951 to 1980 average."],
    ["Música triste = más de medio grado extra.", "Sad music = more than half a degree extra."],
    ["La armonía pasa de alegre a melancólica.", "The harmony goes from cheerful to melancholic."],
    ["El tic-tic = alarma.", "The tick-tick = alarm."], ["Aparece cuando el planeta supera 0.8 °C extra.", "It appears when the planet goes above 0.8 °C extra."],
    ["Los colores", "The colors"], ["cada franja es un año. Azul = más fresco que lo normal, rojo = más caliente.", "each stripe is a year. Blue = cooler than normal, red = warmer."],
    ["Mapa de la NASA de 2025: casi todo el planeta en tonos rojos y marrones, más caliente que lo normal; el Ártico es la zona más roja.",
      "NASA map of 2025: almost the whole planet in red and brown tones, warmer than normal; the Arctic is the reddest area."],
    ["Así se ve 2025 en el mapa de la NASA: casi todo el planeta en rojo. Fuente", "This is how 2025 looks on NASA's map: almost the whole planet in red. Source"],
    ["(dominio público)", "(public domain)"], ["Capítulo 2: El océano", "Chapter 2: The ocean"],
    ["temperatura normal", "normal temperature"], ["+0.12 °C más caliente de lo normal", "+0.12 °C warmer than normal"],
    ["−0.20 °C, más fresco de lo normal", "−0.20 °C, cooler than normal"],
    ["1880. Así sonaba la Tierra: notas graves y tranquilas. Es nuestro punto de partida.", "1880. This is how the Earth sounded: low, calm notes. It's our starting point."],
    ["Durante décadas el sonido casi no cambia: el clima era estable.", "For decades the sound barely changes: the climate was stable."],
    ["1950. Todavía estable. Recuerda esta altura de nota… a partir de aquí empieza el cambio.", "1950. Still stable. Remember this pitch… from here on the change begins."],
    ["1980. Las notas empiezan a subir… y cada vez bajan menos.", "1980. The notes start to rise… and drop less and less."],
    ["Notas que la música se vuelve más triste? 1998 ya pasa del medio grado extra.", "Notice the music getting sadder? 1998 is already past half a degree extra."],
    ["Ese tic-tic es una alarma: 2016 supera 0.8 °C extra. Fíjate cómo los años pasan cada vez más rápido.", "That tick-tick is an alarm: 2016 goes above 0.8 °C extra. Notice how the years go by faster and faster."],
    ["2024: el año más caliente jamás medido. +1.28 °C.", "2024: the hottest year ever measured. +1.28 °C."],
    ["Detener", "Stop"], ["Escuchar otra vez", "Listen again"],
    ["No se pudo cargar el audio. Revisa tu conexión a internet y recarga la página.", "The audio couldn't load. Check your internet connection and reload the page."],
    ["El navegador bloqueó el sonido. Pulsa “Escuchar” otra vez.", "The browser blocked the sound. Press “Listen” again."],
    ["El navegador bloqueó el sonido. Pulsa el botón otra vez.", "The browser blocked the sound. Press the button again."],
    ["Escucha. Cada nota es un año", "Listen. Each note is a year"],
    ["Pulsa “Escuchar” para empezar de nuevo.", "Press “Listen” to start again."],
    ["En 145 años la Tierra se calentó unos 1.4 °C… y lo acabas de escuchar. Ahora compara un año de antes con uno de ahora.",
      "In 145 years the Earth warmed about 1.4 °C… and you just heard it. Now compare a year from back then with one from now."],
    ["Notas graves, lentas y una armonía tranquila.", "Low, slow notes and a calm harmony."],
    ["Notas agudas, más rápidas, armonía triste y la alarma sonando.", "High, faster notes, sad harmony and the alarm ringing."],
    ["el año más caliente", "the hottest year"],
    // Capítulo 2 (océano)
    ["Según la NASA, el océano ha absorbido cerca del", "According to NASA, the ocean has absorbed about"],
    ["90 % del calor extra", "90% of the extra heat"],
    ["del calentamiento, y sus corrientes lo llevan por todo el planeta.", "from global warming, and its currents carry it around the planet."],
    ["Agua cálida = nota aguda; agua fría = nota grave.", "Warm water = high note; cold water = low note."],
    ["Mapa de corrientes oceánicas de la NASA. Usa las flechas para moverte por el mapa y escuchar la temperatura del agua; o toca y arrastra el dedo.",
      "NASA ocean currents map. Use the arrow keys to move around the map and hear the water temperature; or touch and drag your finger."],
    ["Acompaña al agua caliente del trópico en su viaje hacia el norte.", "Follow the warm tropical water on its journey north."],
    ["Viajar con la Corriente del Golfo", "Travel with the Gulf Stream"], ["Viajar otra vez", "Travel again"],
    ["Después, explora tú: pasa el dedo o el ratón por el mapa, o usa las flechas.", "Then explore yourself: move your finger or mouse over the map, or use the arrow keys."],
    ["La misma corriente, al principio y al final del viaje.", "The same current, at the start and end of the journey."],
    ["Golfo de México", "Gulf of Mexico"], ["Agua tropical: notas agudas", "Tropical water: high notes"], ["Noruega", "Norway"],
    ["El mismo calor, ya entregado: notas más graves", "The same heat, already delivered: lower notes"],
    ["El mapa", "The map"],
    ["una visualización de la NASA con las corrientes de la superficie del mar, coloreadas por su temperatura (azul = fría, rojo = cálida).",
      "a NASA visualization of the sea surface currents, colored by their temperature (blue = cold, red = warm)."],
    ["Una nota = un punto del océano.", "One note = one point in the ocean."],
    ["Cuanto más cálida es el agua, más aguda la nota; el agua fría suena grave y con más eco, como si fuera más profunda.",
      "The warmer the water, the higher the note; cold water sounds low and with more echo, as if it were deeper."],
    ["Golpe sordo = tierra o hielo.", "Dull thud = land or ice."], ["Ahí no hay datos del mar.", "There's no sea data there."],
    ["Es una lectura de colores", "It's a color reading"],
    ["la app convierte el color del mapa en una escala de frío a cálido; no son grados exactos.", "the app turns the map's color into a cold-to-warm scale; these aren't exact degrees."],
    ["(modelo ECCO2, MIT/JPL; dominio público)", "(ECCO2 model, MIT/JPL; public domain)"],
    ["NASA: calentamiento del océano", "NASA: ocean warming"], ["Capítulo 3: La causa", "Chapter 3: The cause"],
    ["tierra o hielo, sin datos del mar", "land or ice, no sea data"], ["agua muy cálida", "very warm water"], ["agua cálida", "warm water"],
    ["agua templada", "mild water"], ["agua fría", "cold water"], ["agua muy fría", "very cold water"],
    ["Golfo de México: agua muy cálida. Escucha qué agudas suenan las notas.", "Gulf of Mexico: very warm water. Hear how high the notes sound."],
    ["La corriente sube pegada a la costa de Estados Unidos, como un río caliente dentro del mar.", "The current runs up along the US coast, like a warm river inside the sea."],
    ["Cruza el Atlántico. El agua va soltando su calor: las notas bajan poco a poco.", "It crosses the Atlantic. The water gives off its heat: the notes drop little by little."],
    ["Se acerca a Europa. El calor que traía del trópico se va repartiendo por el camino.", "It approaches Europe. The heat it brought from the tropics spreads out along the way."],
    ["Viaje detenido. Puedes explorar el mapa tú mismo.", "Journey stopped. You can explore the map yourself."],
    ["Aun así, este mar es más templado que el resto del océano a la misma latitud: ese calor vino del trópico.",
      "Even so, this sea is milder than the rest of the ocean at the same latitude: that heat came from the tropics."],
    ["Ahora explora tú: pasa el dedo o el ratón por el mapa, o usa las flechas.", "Now explore yourself: move your finger or mouse over the map, or use the arrow keys."],
    ["Haz clic en el mapa para activar el sonido y explorar.", "Click the map to turn on the sound and explore."],
    ["Golfo de México, al inicio del viaje", "Gulf of Mexico, at the start of the journey"],
    ["Noruega, al final del viaje", "Norway, at the end of the journey"], ["el Golfo de México", "the Gulf of Mexico"],
    // Capítulo 3 (CO₂)
    ["El CO₂ es un gas que atrapa el calor del Sol. Desde 1958 se mide cada mes en lo alto de un volcán en Hawái.",
      "CO₂ is a gas that traps the Sun's heat. Since 1958 it has been measured every month high on a volcano in Hawaii."],
    ["Escucha un tono continuo: cuanto más CO₂, más agudo.", "Listen to a continuous tone: the more CO₂, the higher."],
    ["Pulsa “Escuchar” para oír cómo respira el planeta.", "Press “Listen” to hear how the planet breathes."],
    ["Un año completo de “respiración”, entonces y ahora.", "A full year of “breathing”, then and now."],
    ["Tono grave", "Low tone"], ["El mismo vaivén, mucho más arriba", "The same swing, much higher up"],
    ["Un tono continuo = el CO₂ del aire, mes a mes.", "A continuous tone = the CO₂ in the air, month by month."],
    ["Más CO₂, tono más agudo. Cada enero suena un toque suave para marcar el año.", "More CO₂, higher tone. Every January a soft tap marks the year."],
    ["El vaivén de cada año es la Tierra respirando", "Each year's swing is the Earth breathing"],
    ["en primavera y verano las plantas del hemisferio norte absorben CO₂; en otoño e invierno lo devuelven.",
      "in spring and summer the plants of the northern hemisphere absorb CO₂; in autumn and winter they release it."],
    ["La subida de fondo", "The underlying rise"],
    ["es el CO₂ que se acumula, sobre todo por quemar carbón, petróleo y gas (NASA).", "is the CO₂ building up, mainly from burning coal, oil and gas (NASA)."],
    ["La imagen de fondo", "The background image"],
    ["un modelo de la NASA que muestra el CO₂ moviéndose por la atmósfera (en naranja, donde hay más).", "a NASA model showing CO₂ moving through the atmosphere (in orange, where there's more)."],
    ["Fuentes: datos", "Sources: data"], ["NASA: indicador de CO₂", "NASA: CO₂ indicator"], ["imagen", "image"],
    ["Marzo 1958, Mauna Loa (Hawái): 316 partes por millón de CO₂. Escucha: ese tono es el aire del planeta.",
      "Marzo 1958, Mauna Loa (Hawaii): 316 parts per million of CO₂. Listen: that tone is the planet's air."],
    ["¿Oyes que el tono sube y baja cada año? Es la Tierra respirando: en primavera y verano las plantas del norte absorben CO₂, y en invierno lo devuelven.",
      "Do you hear the tone rise and fall every year? It's the Earth breathing: in spring and summer northern plants absorb CO₂, and in winter they release it."],
    ["Pero cada respiración termina más arriba que la anterior. El tono no deja de subir.", "But each breath ends higher than the last. The tone keeps rising."],
    ["Abril 2015: por primera vez, más de 400 partes por millón.", "Abril 2015: for the first time, more than 400 parts per million."],
    ["315.7 ppm de CO₂", "315.7 ppm of CO₂"], ["Escucha. Este tono sigue al CO₂ del aire, mes a mes", "Listen. This tone follows the CO₂ in the air, month by month"],
    ["Hoy: 427 partes por millón, un 35 % más que en 1958. Según la NASA, gases como el CO₂ atrapan el calor del Sol: más CO₂, un planeta más caliente y un océano que acumula calor. Es lo que escuchaste en los capítulos anteriores.",
      "Today: 427 parts per million, 35% more than in 1958. According to NASA, gases like CO₂ trap the Sun's heat: more CO₂, a warmer planet and an ocean that stores heat. That's what you heard in the previous chapters."],
    ["1959: en promedio 316 partes por millón", "1959: on average 316 parts per million"],
    ["Escucha el vaivén de todo un año, en un tono grave.", "Listen to a whole year's swing, in a low tone."],
    ["El mismo vaivén de las plantas… pero mucho más arriba.", "The same swing of the plants… but much higher up."],
    ["un año de CO₂ en 1959", "a year of CO₂ in 1959"],
    // Capítulo 4 (luces)
    ["Un satélite de la NASA fotografía la Tierra de noche. Este mapa compara 2012 con 2023: en morado, luces nuevas; en naranja, luces que se apagaron.",
      "A NASA satellite photographs the Earth at night. This map compares 2012 with 2023: in purple, new lights; in orange, lights that went out."],
    ["Escucha: las luces nuevas suenan como campanas; las apagadas, como un tono grave.", "Listen: new lights sound like bells; the ones that went out, like a low tone."],
    ["Pulsa “Escuchar” para dar la vuelta al mundo de noche.", "Press “Listen” to go around the world at night."],
    ["Escuchar la vuelta al mundo", "Listen to the trip around the world"], ["Dos regiones, dos historias distintas.", "Two regions, two different stories."],
    ["Europa", "Europe"], ["Tonos graves: luces más tenues", "Low tones: dimmer lights"], ["India y China", "India and China"],
    ["Campanas: ciudades que crecen", "Bells: growing cities"],
    ["Una línea recorre el mapa de oeste a este", "A line sweeps the map from west to east"],
    ["del Pacífico a Asia, 7.5 grados de longitud cada tres cuartos de segundo.", "from the Pacific to Asia, 7.5 degrees of longitude every three quarters of a second."],
    ["Campanas = luces nuevas (morado).", "Bells = new lights (purple)."], ["Cuantas más luces nuevas, más fuertes.", "The more new lights, the louder."],
    ["Tono grave = luces apagadas o más tenues (naranja).", "Low tone = lights off or dimmer (orange)."],
    ["La altura de la nota es la latitud", "The pitch of the note is the latitude"], ["una ciudad más al norte suena más aguda.", "a city further north sounds higher."],
    ["Por qué Europa suena grave", "Why does Europe sound low"],
    ["En parte porque muchas ciudades cambiaron a luces LED, más eficientes y que el satélite ve más tenues; no siempre significa que haya menos gente.",
      "Partly because many cities switched to LED lights, which are more efficient and look dimmer to the satellite; it doesn't always mean there are fewer people."],
    ["satélite Suomi NPP (VIIRS), producto Black Marble (dominio público)", "Suomi NPP satellite (VIIRS), Black Marble product (public domain)"],
    ["Escucha… empezamos de noche sobre el océano Pacífico.", "Listen… we start at night over the Pacific Ocean."],
    ["oscuridad", "darkness"], ["más luces nuevas", "more new lights"], ["más luces apagadas", "more lights off"],
    ["Océano Pacífico: oscuridad. Solo se oye la noche.", "Pacific Ocean: darkness. You only hear the night."],
    ["Norteamérica: aparecen las primeras campanas, ciudades que crecieron desde 2012.", "North America: the first bells appear, cities that have grown since 2012."],
    ["Este de Norteamérica y el Caribe: se mezclan campanas y tonos graves.", "Eastern North America and the Caribbean: bells and low tones mix."],
    ["Este de Norteamérica y el Caribe: se mezclan campanas y tonos graves, luces nuevas y luces que se apagaron.", "Eastern North America and the Caribbean: bells and low tones mix, new lights and lights that went out."],
    ["Sudamérica: más campanas que tonos graves. Las ciudades siguen creciendo.", "South America: more bells than low tones. Cities keep growing."],
    ["Europa: dominan los tonos graves. En parte porque muchas ciudades cambiaron a luces LED, que el satélite ve más tenues.", "Europe: low tones dominate. Partly because many cities switched to LED lights, which the satellite sees as dimmer."],
    ["Europa: dominan los tonos graves. En parte es porque muchas ciudades cambiaron a luces LED, que el satélite ve más tenues.", "Europe: low tones dominate. Partly because many cities switched to LED lights, which the satellite sees as dimmer."],
    ["Oriente Medio y África: vuelven las campanas.", "Middle East and Africa: the bells return."],
    ["India: una de las mayores olas de luces nuevas del planeta.", "India: one of the biggest waves of new lights on the planet."],
    ["China y el sudeste asiático: campanas por todas partes.", "China and Southeast Asia: bells everywhere."],
    ["Japón, Indonesia y Australia: las últimas luces antes de volver al Pacífico.", "Japan, Indonesia and Australia: the last lights before returning to the Pacific."],
    ["La Tierra de noche cuenta dónde crecen las ciudades: sobre todo en Asia, y donde se ahorra energía, como en Europa.", "The Earth at night shows where cities are growing: above all in Asia, and where energy is being saved, as in Europe."],
    ["Europa: tonos graves. Muchas luces se hicieron más tenues.", "Europe: low tones. Many lights became dimmer."],
    ["India y China: campanas. Luces nuevas por todas partes.", "India and China: bells. New lights everywhere."],
    // Cierre
    ["Fin del recorrido", "End of the tour"], ["Lo que acabas de escuchar no es música inventada.", "What you just heard is not made-up music."],
    ["Son datos reales de la NASA y la NOAA convertidos en sonido, para que cualquier persona —también quien no puede ver una gráfica— pueda entender cómo está cambiando la Tierra.",
      "It's real NASA and NOAA data turned into sound, so that anyone —including people who can't see a chart— can understand how the Earth is changing."],
    ["Resumen de los cuatro capítulos", "Summary of the four chapters"],
    ["más caliente que hace 146 años", "warmer than 146 years ago"], ["más caliente que en 1880", "warmer than in 1880"],
    ["Volver a escuchar el capítulo 1", "Listen to chapter 1 again"], ["del calor extra lo absorbe el océano", "of the extra heat is absorbed by the ocean"],
    ["de CO₂ en el aire desde 1958", "more CO₂ in the air since 1958"],
    ["luces nuevas por cada una que se apagó o atenuó, de 2012 a 2023", "new lights for every one that went out or dimmed, 2012 to 2023"],
    ["Compartir", "Share"], ["Empezar de nuevo", "Start again"], ["Escuchar la colección (Jukebox)", "Listen to the collection (Jukebox)"],
    ["Fuentes: NASA GISS (GISTEMP v4) · ECCO2 · NOAA Mauna Loa · NASA Black Marble (VIIRS) · visualizaciones del", "Sources: NASA GISS (GISTEMP v4) · ECCO2 · NOAA Mauna Loa · NASA Black Marble (VIIRS) · visualizations from the"],
    ["Proyecto para el 2026 NASA Space Apps Challenge", "Project for the 2026 NASA Space Apps Challenge"],
    ["¡Gracias por compartir!", "Thanks for sharing!"], ["Enlace copiado. Pégalo donde quieras compartirlo.", "Link copied. Paste it wherever you want to share it."],
    ["No se pudo compartir automáticamente. Copia la dirección de la barra del navegador.", "Couldn't share automatically. Copy the address from the browser bar."],

    // ----- Jukebox: estático
    ["Este jukebox está hecho para escuchar los datos de la NASA, no solo para mirarlos: cada sonido es un número real. No necesitas ver las imágenes. Teclas: Espacio reproducir o pausar, flechas izquierda y derecha o números del 1 al 6 cambiar de pista, D qué suena ahora, coma y punto dato anterior o siguiente, I repetir la explicación de la pista, F abrir Echoes of Tomorrow, para escuchar los futuros posibles del clima, M cambiar el instrumento, E escuchar cualquier imagen de la NASA, T vibración del control, V guía por voz, Inicio volver a empezar, H ayuda.",
      "This jukebox is made for listening to NASA data, not just looking at it: every sound is a real number. You don't need to see the images. Keys: Space play or pause, left and right arrows or numbers 1 to 6 change track, D what's playing now, comma and period previous or next data point, I repeat the track explanation, F open Echoes of Tomorrow, to hear the possible climate futures, M change the instrument, E listen to any NASA image, T controller vibration, V voice guide, Home start over, H help."],
    ["También puedes manejarlo hablando: pulsa O y di «pista tres», «reproducir» o «pausa».", "You can also control it by speaking: press O and say “track three”, “play” or “pause”."],
    ["Modo", "Mode"], ["La colección", "The collection"], ["de la NASA", "from NASA"], ["Accesibilidad", "Accessibility"],
    ["Modo accesible", "Accessible mode"], ["Guía por voz", "Voice guide"], ["Órdenes por voz", "Voice commands"], ["Vibración", "Vibration"], ["Ayuda", "Help"],
    ["Texto más grande, más contraste y guía por voz", "Larger text, more contrast and voice guide"],
    ["Lee en voz alta cada pista (tecla V)", "Reads each track aloud (V key)"], ["Maneja el jukebox hablando (tecla O)", "Control the jukebox by speaking (O key)"],
    ["Siente los datos en un control de Xbox o PlayStation (tecla T)", "Feel the data on an Xbox or PlayStation controller (T key)"],
    ["Cómo funciona y todos los atajos (tecla H)", "How it works and all shortcuts (H key)"],
    ["Pistas de la colección", "Collection tracks"], ["Pistas", "Tracks"], ["Pista anterior (flecha izquierda)", "Previous track (left arrow)"],
    ["Pista siguiente (flecha derecha)", "Next track (right arrow)"], ["Pista anterior", "Previous track"], ["Pista siguiente", "Next track"],
    ["Reproductor", "Player"], ["Pulsa reproducir para escuchar.", "Press play to listen."], ["Gráfica de los datos de la pista", "Chart of the track's data"],
    ["Ajustes de sonido", "Sound settings"], ["Capas", "Layers"], ["Melodía", "Melody"], ["Acordes", "Chords"], ["Bajo", "Bass"], ["Ambiente", "Ambience"],
    ["Seguir con la siguiente", "Continue with the next"], ["Instrumento", "Instrument"], ["Datos", "Data"],
    ["Dato anterior (coma)", "Previous data point (comma)"], ["Dato siguiente (punto)", "Next data point (period)"], ["Qué suena", "What's playing"],
    ["Descargar", "Download"], ["Cómo funciona", "How it works"], ["Ver los datos", "See the"], ["originales", "original data"],
    ["Reproducir (barra espaciadora)", "Play (space bar)"], ["Pausar (barra espaciadora)", "Pause (space bar)"], ["Reproducir", "Play"], ["Pausa", "Pause"],
    ["Posición en el audio", "Position in the audio"], ["Lento", "Slow"], ["Rápido", "Fast"], ["Velocidad", "Speed"], ["normal", "normal"],
    ["Pista 1 de 6", "Track 1 of 6"], ["Pista 1", "Track 1"], ["Qué escuchas", "What you hear"], ["Qué sientes en el control", "What you feel on the controller"],
    ["Imagen que suena", "Sounding image"], ["Elige una imagen de la NASA para escucharla", "Choose a NASA image to listen to it"],
    ["Elige una imagen a la derecha", "Choose an image on the right"], ["o sube la tuya", "or upload your own"],
    ["Elige una imagen de la NASA y pulsa ▶. Una línea la recorre de izquierda a derecha y lo que ve se convierte en música.",
      "Choose a NASA image and press ▶. A line sweeps it from left to right and what it sees becomes music."],
    ["Escuchar la imagen (barra espaciadora)", "Listen to the image (space bar)"], ["Posición de la línea en la imagen", "Position of the line in the image"],
    ["También puedes tocar o pasar el ratón sobre la imagen para oír ese punto. Con la imagen seleccionada, las flechas mueven la línea.",
      "You can also touch or hover over the image to hear that point. With the image selected, the arrow keys move the line."],
    ["Tiempo real", "Real time"], ["Escucha cualquier imagen de la NASA", "Listen to any NASA image"],
    ["El navegador lee los colores de la imagen, píxel a píxel, y los convierte en sonido al momento. Funciona con mapas, fotos de satélite y visualizaciones del Earth Information Center.",
      "The browser reads the image's colors, pixel by pixel, and turns them into sound instantly. It works with maps, satellite photos and Earth Information Center visualizations."],
    ["Elige una", "Pick one"], ["Subir una imagen de la NASA", "Upload a NASA image"], ["Encuentra más en", "Find more at"], ["o", "or"],
    ["descárgala y súbela aquí.", "download it and upload it here."],
    ["Más arriba = más agudo", "Higher up = higher pitch"], ["Cada fila de la imagen es una nota de la escala.", "Each row of the image is a note of the scale."],
    ["Más color o brillo = más fuerte", "More color or brightness = louder"], ["Lo que destaca del fondo suena; el fondo, no.", "What stands out from the background sounds; the background doesn't."],
    ["El color elige el instrumento", "Color picks the instrument"], ["Rojo, naranja y amarillo: campanas brillantes.", "Red, orange and yellow: bright bells."],
    ["Azul y morado: tono suave.", "Blue and purple: soft tone."], ["Verde: marimba. Gris o blanco: arpa.", "Green: marimba. Gray or white: harp."],
    ["Un acorde de fondo", "A background chord"], ["Sigue la mezcla de colores: mayor si domina lo cálido, menor si domina lo frío.", "It follows the color mix: major if warm colors dominate, minor if cool ones do."],
    ["Prototipo para el reto “The Earth Information Jukebox” · 2026 NASA Space Apps Challenge. Datos públicos de NASA GISS, NSIDC, NASA SVS (ECCO2) y NOAA. Imágenes: NASA Scientific Visualization Studio (dominio público).",
      "Prototype for the “The Earth Information Jukebox” challenge · 2026 NASA Space Apps Challenge. Public data from NASA GISS, NSIDC, NASA SVS (ECCO2) and NOAA. Images: NASA Scientific Visualization Studio (public domain)."],
    // Diálogo "Cómo funciona"
    ["La NASA cuenta cómo cambia la Tierra sobre todo con imágenes y mapas. Aquí", "NASA tells how the Earth is changing mostly with images and maps. Here"],
    ["los mismos datos se cuentan con sonido", "the same data is told with sound"],
    ["para que cualquiera los pueda vivir: mirando, escuchando o sintiendo.", "so anyone can experience it: by looking, listening or feeling."],
    ["elige una pista arriba y pulsa ▶. Cada nota es un número real: la temperatura de un año, el hielo de un septiembre, el CO₂ de un mes… Los subtítulos cuentan lo que está pasando.",
      "pick a track above and press ▶. Each note is a real number: the temperature of a year, the ice of a September, the CO₂ of a month… The captions tell what's happening."],
    ["(su propia página, tecla", "(its own page, key"],
    ["después de la temperatura medida (1880–2025), una campana con eco da paso a las proyecciones del IPCC hasta 2100. En «Dos futuros», con audífonos, la flauta del oído izquierdo es el camino de bajas emisiones y las cuerdas del derecho, el de altas emisiones. Son proyecciones, no predicciones.",
      "after the measured temperature (1880–2025), an echoing bell gives way to IPCC projections up to 2100. In “Two futures”, with headphones, the flute in the left ear is the low-emissions path and the strings in the right ear, the high-emissions one. These are projections, not predictions."],
    ["Escucha una imagen de la NASA", "Listen to a NASA image"],
    ["elige una imagen o sube la tuya. El navegador lee sus colores en tiempo real y una línea la recorre de izquierda a derecha convirtiéndolos en música.",
      "choose an image or upload your own. The browser reads its colors in real time and a line sweeps it from left to right turning them into music."],
    ["cambia el instrumento, la velocidad o apaga capas (acordes, bajo, ambiente) para escuchar solo los datos.", "change the instrument or the speed, or turn off layers (chords, bass, ambience) to hear just the data."],
    ["Sonido estéreo (mejor con audífonos)", "Stereo sound (best with headphones)"],
    ["en los mapas (océano, luces y rayos) el oeste suena a la izquierda y el este a la derecha; en las series de tiempo (temperatura, hielo y CO₂) el pasado suena a la izquierda y el presente a la derecha. La altura y el volumen dicen lo mismo, así que en mono no se pierde nada.",
      "on the maps (ocean, lights and lightning) west sounds on the left and east on the right; in the time series (temperature, ice and CO₂) the past sounds on the left and the present on the right. Pitch and volume say the same thing, so nothing is lost in mono."],
    ["Sin mirar la pantalla", "Without looking at the screen"],
    ["lee la explicación de cada pista y los subtítulos, bajando la música mientras habla. Con lector de pantalla (NVDA, JAWS, VoiceOver, TalkBack) déjala apagada: los subtítulos se anuncian solos.",
      "reads each track's explanation and the captions, lowering the music while it speaks. With a screen reader (NVDA, JAWS, VoiceOver, TalkBack) leave it off: the captions are announced on their own."],
    ["di «pista tres», «reproducir», «pausa», «qué suena», «dos futuros», «futuro bajo» o «futuro alto» (abren Echoes of Tomorrow), «imagen» o «ayuda». Chrome y Edge, con micrófono e internet. Con altavoces, mejor usa auriculares.",
      "say “track three”, “play”, “pause”, “what's playing”, “two futures”, “low future” or “high future” (they open Echoes of Tomorrow), “image” or “help”. Chrome and Edge, with a microphone and internet. With speakers, better use headphones."],
    ["Vibración del control", "Controller vibration"],
    ["conecta un control de Xbox o PlayStation y pulsa un botón. Vibra con los mismos datos que suenan.", "connect an Xbox or PlayStation controller and press a button. It vibrates with the same data you hear."],
    ["Botones del control", "Controller buttons"],
    ["abajo (A / ✕) reproducir o pausar; derecha (B / ○) qué suena; izquierda (X / □) repetir la explicación; arriba (Y / △) ayuda de botones; cruceta ← → pista, ↑ ↓ dato; gatillos velocidad; superior derecho instrumento; Menú / Options vibración; Vista / Create volver al principio.",
      "bottom (A / ✕) play or pause; right (B / ○) what's playing; left (X / □) repeat the explanation; top (Y / △) button help; D-pad ← → track, ↑ ↓ data point; triggers speed; right bumper instrument; Menu / Options vibration; View / Create back to the start."],
    ["Teclado", "Keyboard"], ["Espacio", "Space"], ["reproducir", "play"], ["pista", "track"], ["abrir Echoes of Tomorrow", "open Echoes of Tomorrow"],
    ["qué suena", "what's playing"], ["dato anterior o siguiente", "previous or next data point"], ["repetir la explicación", "repeat the explanation"],
    ["instrumento", "instrument"], ["escuchar una imagen / volver a la colección", "listen to an image / back to the collection"],
    ["volver al principio", "back to the start"], ["En «Escucha una imagen»", "In “Listen to an image”"], ["escuchar", "listen"],
    ["mover la línea", "move the line"], ["elegir imagen", "choose image"],
    ["qué hay en ese punto. Al terminar se dice dónde está lo más destacado.", "what's at that point. At the end it tells you where the most prominent part is."],

    // ----- Jukebox: pistas
    ["El hielo desaparece", "The ice is disappearing"], ["Rayos vistos desde el espacio", "Lightning seen from space"],
    ["Echoes of Tomorrow: escucha los futuros posibles", "Echoes of Tomorrow: listen to the possible futures"],
    ["Temperatura global", "Global temperature"], ["Hielo marino del Ártico en septiembre", "Arctic sea ice in September"],
    ["Temperatura del mar", "Sea temperature"], ["del Polo Norte al Polo Sur", "from the North Pole to the South Pole"],
    ["CO₂ en la atmósfera", "CO₂ in the atmosphere"], ["Luces nocturnas vistas por satélite", "Night lights seen by satellite"],
    ["Rayos detectados desde la Estación Espacial Internacional", "Lightning detected from the International Space Station"],
    ["medida 1880–2025 y proyectada hasta 2100", "measured 1880–2025 and projected to 2100"],
    ["Dos futuros", "Two futures"], ["Bajas emisiones", "Low emissions"], ["Altas emisiones", "High emissions"],
    ["Cada nota de arpa es un año, de 1880 a 2025. Cuanto más cálido fue el año comparado con el promedio de 1951–1980, más aguda suena. Cuando el calentamiento pasa de +0.5 °C la melodía cambia a tono menor, y por encima de +0.8 °C entra un pulso de percusión, como una alarma.",
      "Each harp note is a year, from 1880 to 2025. The warmer the year compared with the 1951–1980 average, the higher it sounds. When warming passes +0.5 °C the melody switches to a minor key, and above +0.8 °C a percussion pulse comes in, like an alarm."],
    ["Cada año suena como un puñado de campanas de cristal: una por cada porción de hielo que le queda al Ártico al final del verano. Con menos hielo hay menos campanas y suenan más bajo, mientras el viento se oye cada vez más fuerte.",
      "Each year sounds like a handful of glass bells: one for each piece of ice the Arctic has left at the end of summer. With less ice there are fewer bells and they sound quieter, while the wind grows louder and louder."],
    ["Una línea recorre el mapa del océano de norte a sur, 5 grados de latitud por segundo. Cada nota es un trozo de mar: el agua fría suena grave y la cálida, aguda. Escucha cómo la melodía sube al acercarse al ecuador y vuelve a bajar en el océano Austral.",
      "A line sweeps the ocean map from north to south, 5 degrees of latitude per second. Each note is a patch of sea: cold water sounds low and warm water, high. Hear how the melody rises near the equator and falls again in the Southern Ocean."],
    ["Una melodía de flauta y un tono de fondo suben mes a mes con el dióxido de carbono medido en Mauna Loa (Hawái). La ondulación de la melodía es la respiración del planeta: las plantas absorben CO₂ en verano y lo liberan en invierno. Cada latido marca un año, y una campana grave suena al cruzar 350, 400 y 420 ppm.",
      "A flute melody and a background tone rise month by month with the carbon dioxide measured at Mauna Loa (Hawaii). The melody's ripple is the planet breathing: plants absorb CO₂ in summer and release it in winter. Each heartbeat marks a year, and a low bell rings when crossing 350, 400 and 420 ppm."],
    ["Una línea recorre el planeta de noche, de oeste a este. Las luces que aparecieron desde 2012 (en morado) suenan como campanas; las que se apagaron o se hicieron más tenues (en naranja), como un tono grave. Cuanto más al norte está la ciudad, más aguda la nota. Así se escucha dónde crecen las ciudades.",
      "A line sweeps the planet at night, from west to east. Lights that appeared since 2012 (in purple) sound like bells; those that went out or dimmed (in orange), like a low tone. The further north the city, the higher the note. This is how you hear where cities are growing."],
    ["Desde la Estación Espacial, el instrumento LIS de la NASA detecta los rayos de todo el planeta. Una línea recorre el mapa de oeste a este: cada zona con rayos es un golpe de tambor, más agudo cuanto más al norte. Donde hay muchos a la vez, retumba un trueno. Escucha cómo las tormentas se concentran en los trópicos.",
      "From the Space Station, NASA's LIS instrument detects lightning across the whole planet. A line sweeps the map from west to east: each area with lightning is a drum hit, higher the further north. Where there are many at once, thunder rumbles. Hear how storms gather in the tropics."],
    ["Primero suena la temperatura medida por la NASA, de 1880 a 2025, con la misma regla de la pista 1: más calor, nota más aguda. Una campana con eco marca el paso al futuro. Desde ahí suena una proyección de los modelos climáticos del IPCC, no una predicción: lo que pasaría según cuánto emitamos. En el modo Dos futuros, con audífonos, la flauta del oído izquierdo es el camino de bajas emisiones y las cuerdas del derecho, el de altas emisiones. Cuanto más ancho el rango de los modelos, más se oye un soplo de fondo.",
      "First you hear the temperature measured by NASA, from 1880 to 2025, with the same rule as track 1: more heat, higher note. An echoing bell marks the step into the future. From there you hear a projection from the IPCC climate models, not a prediction: what would happen depending on how much we emit. In Two futures mode, with headphones, the flute in the left ear is the low-emissions path and the strings in the right ear, the high-emissions one. The wider the range of the models, the more you hear a background breath."],
    ["Mapa de la NASA del cambio de temperatura en 2025: casi todo el planeta en tonos naranjas y rojos.", "NASA map of temperature change in 2025: almost the whole planet in orange and red tones."],
    ["El hielo del Ártico visto desde satélite: en 1979 cubre gran parte del océano; en 2012, mucho menos.", "Arctic ice seen from satellite: in 1979 it covers much of the ocean; in 2012, much less."],
    ["Mapa de las corrientes del océano coloreadas por temperatura: rojas y naranjas en el ecuador, azules cerca de los polos.", "Map of ocean currents colored by temperature: red and orange at the equator, blue near the poles."],
    ["Simulación de la NASA del CO₂ en la atmósfera sobre Asia y Oceanía, con nubes moradas, rojas y amarillas.", "NASA simulation of CO₂ in the atmosphere over Asia and Oceania, with purple, red and yellow clouds."],
    ["Mapa nocturno de la Tierra: puntos morados donde aparecieron luces nuevas, sobre todo en Asia, y naranjas donde se apagaron, sobre todo en Europa.", "Night map of the Earth: purple dots where new lights appeared, mostly in Asia, and orange ones where they went out, mostly in Europe."],
    ["Mapa de la Tierra con puntos amarillos donde se detectaron rayos, concentrados en Sudamérica, África central y el sudeste asiático.", "Map of the Earth with yellow dots where lightning was detected, concentrated in South America, Central Africa and Southeast Asia."],
    ["Globo del océano: corrientes rojas y naranjas, agua cálida; azules, agua fría. Se inclina del Polo Norte al Polo Sur con el audio; con las flechas lo giras tú y oyes cada trozo de mar.",
      "Ocean globe: red and orange currents, warm water; blue, cold water. It tilts from the North Pole to the South Pole with the audio; with the arrow keys you turn it yourself and hear each patch of sea."],
    ["Globo de la Tierra de noche: morado, luces nuevas; naranja, luces apagadas. Gira con el audio; con las flechas lo giras tú y oyes cada región.",
      "Globe of the Earth at night: purple, new lights; orange, lights off. It turns with the audio; with the arrow keys you turn it yourself and hear each region."],
    ["globo", "globe"],
    // Leyendas
    ["Nota más aguda", "Higher note"], ["año más cálido", "warmer year"], ["Tono menor", "Minor key"], ["más de +0.5 °C", "over +0.5 °C"],
    ["Pulso de percusión", "Percussion pulse"], ["Más campanas", "More bells"], ["más hielo", "more ice"], ["Volumen", "Volume"],
    ["extensión del hielo", "ice extent"], ["Viento", "Wind"], ["el hielo que falta", "the missing ice"], ["Nota aguda", "High note"],
    ["Nota grave", "Low note"], ["Silencio", "Silence"], ["tierra o hielo", "land or ice"], ["Tono más agudo", "Higher tone"],
    ["más CO₂ en el aire", "more CO₂ in the air"], ["Latido", "Heartbeat"], ["un año", "one year"], ["Campana grave", "Low bell"],
    ["se cruza un umbral", "a threshold is crossed"], ["Campanas agudas", "High bells"], ["luces nuevas (morado)", "new lights (purple)"],
    ["luces apagadas (naranja)", "lights off (orange)"], ["Más aguda", "Higher"], ["más al norte", "further north"], ["Tambor", "Drum"],
    ["una zona con rayos", "an area with lightning"], ["Más agudo", "Higher"], ["Trueno", "Thunder"], ["muchos rayos a la vez", "lots of lightning at once"],
    ["Arpa", "Harp"], ["temperatura medida, 1880–2025", "measured temperature, 1880–2025"], ["Campana con eco", "Echoing bell"],
    ["empieza la proyección", "the projection begins"], ["Flauta, oído izquierdo", "Flute, left ear"], ["Cuerdas, oído derecho", "Strings, right ear"],
    ["Golpes de alarma", "Alarm hits"], ["1 sobre +0.8 °C, 2 sobre +2 °C, 3 sobre +3 °C", "1 above +0.8 °C, 2 above +2 °C, 3 above +3 °C"],
    ["Soplo", "Breath"], ["incertidumbre de los modelos", "model uncertainty"], ["Flauta con eco", "Echoing flute"],
    ["futuro con bajas emisiones", "low-emissions future"], ["Cuerdas con eco", "Echoing strings"], ["futuro con altas emisiones", "high-emissions future"],
    ["Piano", "Piano"], ["Marimba", "Marimba"], ["Cuerdas", "Strings"], ["Flauta", "Flute"], ["Campanas", "Bells"], ["Tono suave", "Soft tone"], ["Tambores", "Drums"],
    // Subtítulos de las pistas
    ["1880: empieza el registro de temperatura de la NASA. Las notas son graves y tranquilas.", "1880: NASA's temperature record begins. The notes are low and calm."],
    ["1909: uno de los años más fríos de todo el registro.", "1909: one of the coldest years in the whole record."],
    ["Años 40: un primer calentamiento que se detiene durante unas décadas.", "The '40s: a first warming that stalls for a few decades."],
    ["Finales de los 70: el calentamiento empieza y ya no se detiene. Las notas suben.", "Late '70s: warming begins and never stops. The notes rise."],
    ["Finales de los 70: el calentamiento empieza y ya no se detiene.", "Late '70s: warming begins and never stops."],
    ["1998: un El Niño muy fuerte supera +0.5 °C y la melodía pasa a tono menor.", "1998: a very strong El Niño goes past +0.5 °C and the melody shifts to a minor key."],
    ["2015: se supera +0.8 °C. Entra el pulso de alarma y ya no se va.", "2015: +0.8 °C is passed. The alarm pulse comes in and never leaves."],
    ["2015: se supera +0.8 °C. Entra el pulso de alarma.", "2015: +0.8 °C is passed. The alarm pulse comes in."],
    ["1998: se supera +0.5 °C y la melodía pasa a tono menor.", "1998: +0.5 °C is passed and the melody shifts to a minor key."],
    ["2024: el año más cálido registrado, +1.28 °C.", "2024: the warmest year on record, +1.28 °C."],
    ["Acabas de escuchar 146 años de temperatura en menos de un minuto.", "You just heard 146 years of temperature in less than a minute."],
    ["7.05 millones de km²", "7.05 million km²"],
    ["1979: el Ártico tiene 7 millones de km² de hielo en septiembre. Muchas campanas.", "1979: the Arctic has 7 million km² of ice in September. Lots of bells."],
    ["2007: una caída brusca, a 4.3 millones de km². Se apagan campanas.", "2007: a sharp drop, to 4.3 million km². Bells fall silent."],
    ["2012: mínimo récord, 3.6 millones de km². Casi la mitad que en 1979.", "2012: record low, 3.6 million km². Almost half of 1979."],
    ["2020: el segundo mínimo más bajo. El viento ya domina.", "2020: the second-lowest minimum. The wind now dominates."],
    ["2025: 4.6 millones de km², un 35 % menos que en 1979.", "2025: 4.6 million km², 35% less than in 1979."],
    ["sin océano", "no ocean"],
    ["Polo Norte: casi todo es hielo y tierra. Apenas suena.", "North Pole: almost all ice and land. Barely a sound."],
    ["50° N: Atlántico y Pacífico Norte, agua templada. La melodía empieza a subir.", "50° N: North Atlantic and Pacific, mild water. The melody starts to rise."],
    ["Trópicos: el agua más cálida del planeta. Las notas más agudas.", "Tropics: the warmest water on the planet. The highest notes."],
    ["Ecuador: el sol calienta el océano y las corrientes llevan ese calor hacia los polos.", "Equator: the sun heats the ocean and the currents carry that heat toward the poles."],
    ["35° S: el agua se enfría y la melodía baja.", "35° S: the water cools and the melody drops."],
    ["Océano Austral: la corriente que rodea la Antártida, agua helada y notas graves.", "Southern Ocean: the current that circles Antarctica, icy water and low notes."],
    ["Antártida: hielo y silencio.", "Antarctica: ice and silence."],
    ["1958: 316 ppm. Empiezan las mediciones en Mauna Loa, Hawái.", "1958: 316 ppm. Measurements begin at Mauna Loa, Hawaii."],
    ["1988: 350 ppm, el nivel que los científicos consideran seguro para el clima.", "1988: 350 ppm, the level scientists consider safe for the climate."],
    ["2015: 400 ppm, más de 400 ppm por primera vez en la historia de la humanidad.", "2015: 400 ppm, over 400 ppm for the first time in human history."],
    ["2023: 420 ppm, el CO₂ sigue subiendo cada año, sin pausa.", "2023: 420 ppm, CO₂ keeps rising every year, without pause."],
    ["Suena la campana.", "The bell rings."],
    ["2025: 427 ppm, un 35 % más que en 1958.", "2025: 427 ppm, 35% more than in 1958."],
    ["sin rayos", "no lightning"], ["pocos rayos", "little lightning"], ["muchos rayos", "lots of lightning"],
    ["Océano Pacífico: algunos rayos sueltos sobre el mar.", "Pacific Ocean: a few scattered bolts over the sea."],
    ["Norteamérica y el golfo de México: primeras tormentas.", "North America and the Gulf of Mexico: the first storms."],
    ["Sudamérica: tormentas sobre la Amazonía. Empiezan los truenos.", "South America: storms over the Amazon. The thunder begins."],
    ["Océano Atlántico: tormentas frente a la costa de África.", "Atlantic Ocean: storms off the coast of Africa."],
    ["África central: la región con más rayos del planeta. El trueno no para.", "Central Africa: the region with the most lightning on the planet. The thunder doesn't stop."],
    ["Oriente Medio y el océano Índico: casi en silencio.", "Middle East and the Indian Ocean: almost silent."],
    ["Sudeste asiático e Indonesia: vuelven las tormentas tropicales.", "Southeast Asia and Indonesia: tropical storms return."],
    ["Australia y el Pacífico: los últimos tambores.", "Australia and the Pacific: the last drums."],
    // Echoes of Tomorrow
    ["2026: desde aquí suena una proyección, no una predicción. A la izquierda, con flauta: si reducimos mucho las emisiones. A la derecha, con cuerdas: si no las reducimos.",
      "2026: from here on you hear a projection, not a prediction. On the left, with flute: if we cut emissions sharply. On the right, with strings: if we don't."],
    ["2026: desde aquí suena una proyección, no una predicción. Escenario de bajas emisiones: el mundo reduce mucho sus emisiones.",
      "2026: from here on you hear a projection, not a prediction. Low-emissions scenario: the world cuts its emissions sharply."],
    ["2026: desde aquí suena una proyección, no una predicción. Escenario de altas emisiones: las emisiones siguen creciendo.",
      "2026: from here on you hear a projection, not a prediction. High-emissions scenario: emissions keep growing."],
    ["2050: bajas emisiones, +1.6 °C (+2.0 °C sobre la era preindustrial)", "2050: low emissions, +1.6 °C (+2.0 °C above pre-industrial levels)"],
    ["Altas emisiones, +2.3 °C (+2.7 °C sobre la era preindustrial)", "High emissions, +2.3 °C (+2.7 °C above pre-industrial levels)"],
    ["2050: +1.6 °C (+2.0 °C sobre la era preindustrial)", "2050: +1.6 °C (+2.0 °C above pre-industrial levels)"],
    ["Los dos caminos ya se separan.", "The two paths are already parting."],
    ["El futuro todavía no está escrito: depende de lo que hagamos.", "The future isn't written yet: it depends on what we do."],
    ["Con bajas emisiones la melodía se estabiliza. Con altas emisiones sigue subiendo y se suman golpes de alarma.", "With low emissions the melody levels off. With high emissions it keeps rising and alarm hits pile up."],
    ["El calentamiento empieza a frenarse.", "Warming starts to slow down."], ["La melodía se estabiliza: el calor deja de subir.", "The melody levels off: the heat stops rising."],
    ["Más de +2 °C: la alarma suena dos veces.", "Over +2 °C: the alarm sounds twice."],
    ["La melodía no deja de subir y la alarma suena tres veces.", "The melody keeps rising and the alarm sounds three times."],
    ["2025: el último año medido, +1.20 °C", "2025: the last measured year, +1.20 °C"], ["Ahora, la campana: empieza el futuro.", "Now, the bell: the future begins."],
    ["proyección", "projection"], ["medido", "measured"],
    ["bajas emisiones +1.6 °C (rango de los modelos +1.2 °C a +2.1 °C)", "low emissions +1.6 °C (model range +1.2 °C to +2.1 °C)"],
    ["altas emisiones +1.6 °C (rango de los modelos +1.2 °C a +2.1 °C)", "high emissions +1.6 °C (model range +1.2 °C to +2.1 °C)"],
    ["Escuchar posibles futuros", "Listen to possible futures"], ["Futuro con bajas emisiones", "Low-emissions future"], ["Futuro con altas emisiones", "High-emissions future"],
    ["Modo dos futuros: con audífonos, a la izquierda bajas emisiones, con flauta; a la derecha altas emisiones, con cuerdas.",
      "Two-futures mode: with headphones, low emissions on the left, with flute; high emissions on the right, with strings."],
    // Vibración (qué se siente)
    ["Un pulso por año: cuanto más cálido, más fuerte. En el futuro, el pulso se repite: dos veces por encima de +2 °C y tres por encima de +3 °C.",
      "One pulse per year: the warmer, the stronger. In the future, the pulse repeats: twice above +2 °C and three times above +3 °C."],
    ["Un pulso por año: cuanto más cálido, más fuerte. Por encima de +0.5 °C el pulso se vuelve doble, y por encima de +0.8 °C se suma un cosquilleo, como la alarma.",
      "One pulse per year: the warmer, the stronger. Above +0.5 °C the pulse doubles, and above +0.8 °C a tingle is added, like the alarm."],
    ["Un zumbido por año: cuanto más hielo queda, más largo. Año tras año se va acortando.", "One buzz per year: the more ice left, the longer. Year after year it gets shorter."],
    ["Una vibración por franja de mar, de norte a sur: agua cálida, fuerte (con cosquilleo en la más cálida); agua fría, suave; tierra o hielo, nada.",
      "One vibration per band of sea, north to south: warm water, strong (with a tingle in the warmest); cold water, soft; land or ice, nothing."],
    ["Un latido por año que se hace cada vez más fuerte con el CO₂. Al cruzar 350, 400 y 420 ppm, una vibración larga, como la campana.",
      "One heartbeat per year that grows stronger with CO₂. When crossing 350, 400 and 420 ppm, a long vibration, like the bell."],
    ["De oeste a este. Luces nuevas: tres golpecitos rápidos (más luces, más fuertes). Luces apagadas: un zumbido largo. Oscuridad: nada.",
      "West to east. New lights: three quick taps (more lights, stronger). Lights off: a long buzz. Darkness: nothing."],
    ["De oeste a este. Cada zona con rayos: un golpe, más fuerte con más rayos. Muchos rayos a la vez: una sacudida larga, el trueno.",
      "West to east. Each area with lightning: a hit, stronger with more lightning. Lots of lightning at once: a long shake, the thunder."],
    // Avisos y voz del Jukebox
    ["Guía por voz activada", "Voice guide on"], ["Guía por voz desactivada", "Voice guide off"], ["Estás en la pista 1 de 6", "You're on track 1 of 6"],
    ["Pulsa espacio para escuchar", "Press space to listen"], ["Primero te explico qué significa cada sonido", "First I'll explain what each sound means"],
    ["Usa las flechas o los números del 1 al 6 para cambiar de pista, la D para saber qué suena, y la H para la ayuda",
      "Use the arrows or the numbers 1 to 6 to change track, D to know what's playing, and H for help"],
    ["Usa la F para cambiar de futuro, la D para saber qué suena, y la H para la ayuda", "Use F to change the future, D to know what's playing, and H for help"],
    ["En el control", "On the controller"], ["Cambiando el sonido", "Changing the sound"], ["Preparando la música", "Preparing the music"],
    ["Este navegador no pudo preparar la pista.", "This browser couldn't prepare the track."],
    ["El navegador todavía no deja sonar audio. Pulsa una vez la barra espaciadora o haz clic en la página; después el control ya lo maneja todo.",
      "The browser won't play audio yet. Press the space bar once or click the page; after that the controller handles everything."],
    ["El navegador bloqueó el audio. Pulsa reproducir otra vez.", "The browser blocked the audio. Press play again."],
    ["Minuto 0:12 de 1:05", "Minute 0:12 of 1:05"], ["0:12 de 1:05", "0:12 of 1:05"], ["Ahora suena", "Now playing"],
    ["Todavía no empiezan los datos.", "The data hasn't started yet."], ["Gráfica de 146 datos", "Chart of 146 data points"], ["Valor más alto", "Highest value"],
    ["lento", "slow"], ["rápido", "fast"],
    ["Puedes decir: pista y un número del uno al seis; reproducir; pausa; siguiente; anterior; qué suena; dato siguiente; dato anterior; explica; desde el principio; más rápido; más lento; instrumento; imagen, para escuchar una imagen de la NASA; futuros, para abrir Echoes of Tomorrow; y desactivar órdenes.",
      "You can say: track and a number from one to six; play; pause; next; previous; what's playing; next data; previous data; explain; from the start; faster; slower; instrument; image, to listen to a NASA image; futures, to open Echoes of Tomorrow; and stop listening."],
    ["Puedes decir: reproducir; pausa; qué suena; dato siguiente; dato anterior; explica; desde el principio; más rápido; más lento; dos futuros; futuro bajo; futuro alto; comparar; primera foto; segunda foto; instrumento; y desactivar órdenes.",
      "You can say: play; pause; what's playing; next data; previous data; explain; from the start; faster; slower; two futures; low future; high future; compare; first photo; second photo; instrument; and stop listening."],
    ["No entendí la orden. Di «ayuda» para oír lo que puedes decir.", "I didn't understand. Say “help” to hear what you can say."],
    ["El navegador no tiene permiso para usar el micrófono. Permítelo y vuelve a activar las órdenes por voz.", "The browser doesn't have permission to use the microphone. Allow it and turn voice commands on again."],
    ["Las órdenes por voz necesitan conexión a internet.", "Voice commands need an internet connection."], ["No se encontró ningún micrófono.", "No microphone was found."],
    ["Escuchando… di «pista tres», «reproducir», «pausa» o «ayuda».", "Listening… say “track three”, “play”, “pause” or “help”."],
    ["Órdenes por voz activadas. Di, por ejemplo: pista tres, reproducir, pausa, o ayuda.", "Voice commands on. Say, for example: track three, play, pause, or help."],
    ["Órdenes por voz desactivadas.", "Voice commands off."],
    ["Vibración: conecta un control de Xbox o PlayStation y pulsa un botón (tecla T)", "Vibration: connect an Xbox or PlayStation controller and press a button (T key)"],
    ["Firefox no hace vibrar el control: usa Chrome o Edge", "Firefox doesn't vibrate the controller: use Chrome or Edge"],
    ["Se desconectó el control.", "The controller disconnected."],
    ["No veo ningún control. Conecta un control de Xbox o PlayStation, mejor por USB, y pulsa cualquier botón.", "I don't see any controller. Connect an Xbox or PlayStation controller, preferably by USB, and press any button."],
    ["Este navegador no puede hacer vibrar el control. Usa Chrome o Edge.", "This browser can't vibrate the controller. Use Chrome or Edge."],
    ["Vibración activada.", "Vibration on."], ["Vibración desactivada.", "Vibration off."],
    ["control de PlayStation", "PlayStation controller"], ["control de Xbox", "Xbox controller"], ["control", "controller"],
    ["Pulsa la T para activar la vibración, o", "Press T to turn on vibration, or"],
    ["reproducir o pausar", "play or pause"], ["qué suena ahora", "what's playing now"], ["repetir la explicación de la pista", "repeat the track explanation"],
    ["esta ayuda", "this help"], ["Cruceta izquierda y derecha: pista anterior o siguiente.", "D-pad left and right: previous or next track."],
    ["Cruceta arriba y abajo: dato siguiente o anterior.", "D-pad up and down: next or previous data point."],
    ["Gatillo izquierdo: más lento.", "Left trigger: slower."], ["Gatillo derecho: más rápido.", "Right trigger: faster."],
    ["Botón superior derecho: cambiar de instrumento.", "Right bumper: change instrument."], ["activar o desactivar la vibración", "turn vibration on or off"],
    ["Modo accesible activado.", "Accessible mode on."], ["Modo accesible desactivado.", "Accessible mode off."],

    // ----- Escucha una imagen
    ["la temperatura global de 2025", "the 2025 global temperature"], ["el hielo del Ártico en 1979", "Arctic ice in 1979"],
    ["las corrientes del océano", "the ocean currents"], ["el CO₂ en la atmósfera", "CO₂ in the atmosphere"],
    ["el cambio en las luces nocturnas", "the change in night lights"], ["los rayos vistos desde el espacio", "lightning seen from space"],
    ["El hielo del Ártico visto desde satélite en septiembre de 1979: cubre gran parte del océano.", "Arctic ice seen from satellite in September 1979: it covers much of the ocean."],
    ["El hielo del Ártico visto desde satélite en septiembre de 2012, el mínimo récord: cubre mucho menos que en 1979.", "Arctic ice seen from satellite in September 2012, the record low: it covers much less than in 1979."],
    ["Una línea recorre la imagen de izquierda a derecha. Más arriba, más agudo. Más color o brillo, más fuerte; el fondo no suena. Rojo, naranja y amarillo suenan como campanas; verde, como marimba; azul y morado, como un tono suave; gris o blanco, como arpa. El acorde de fondo es mayor si domina lo cálido y menor si domina lo frío.",
      "A line sweeps the image from left to right. Higher up, higher pitch. More color or brightness, louder; the background is silent. Red, orange and yellow sound like bells; green, like a marimba; blue and purple, like a soft tone; gray or white, like a harp. The background chord is major if warm colors dominate and minor if cool ones do."],
    ["rojo", "red"], ["naranja", "orange"], ["amarillo", "yellow"], ["verde", "green"], ["celeste", "light blue"], ["azul", "blue"],
    ["morado", "purple"], ["rosa", "pink"], ["blanco", "white"], ["negro", "black"], ["gris", "gray"], ["fondo", "background"],
    ["50 por ciento del ancho", "50 percent of the width"], ["50 % del ancho", "50% of the width"],
    ["Primero elige una imagen: pulsa un número del 1 al 7 o sube la tuya.", "First choose an image: press a number from 1 to 7 or upload your own."],
    ["La línea va de izquierda a derecha.", "The line goes from left to right."],
    ["En pausa en el 50 % de la imagen", "Paused at 50% of the image"], ["Pulsa ▶ para seguir", "Press ▶ to continue"],
    ["a la izquierda", "on the left"], ["en el centro", "in the center"], ["a la derecha", "on the right"],
    ["arriba", "at the top"], ["a media altura", "halfway up"], ["abajo", "at the bottom"],
    ["Colores principales", "Main colors"], ["Destaca el 35 % de la imagen.", "35% of the image stands out."],
    ["El navegador no deja leer los colores de esta imagen porque la página se abrió con doble clic. Ábrela con iniciar-servidor.bat, o sube la imagen con el botón «Subir una imagen de la NASA».",
      "The browser won't read this image's colors because the page was opened with a double click. Open it with iniciar-servidor.bat, or upload the image with the “Upload a NASA image” button."],
    ["Usa las flechas para explorarla y Espacio para escucharla.", "Use the arrows to explore it and Space to listen to it."],
    ["Pulsa ▶ para escucharla, o toca la imagen para oír un punto", "Press ▶ to listen to it, or touch the image to hear a point"],
    ["Imagen", "Image"], ["Pulsa espacio para escucharla.", "Press space to listen to it."],
    ["No se pudo abrir la imagen.", "The image couldn't be opened."],
    ["Todavía no hay ninguna imagen. Elige una con los números del 1 al 7.", "There's no image yet. Pick one with the numbers 1 to 7."],
    ["muy destacado", "very prominent"], ["destacado", "prominent"], ["fondo, no suena", "background, silent"], ["solo fondo", "only background"],
    ["Al principio de la imagen.", "At the start of the image."],
    ["Espacio para escuchar, números del 1 al 7 para cambiar de imagen", "Space to listen, numbers 1 to 7 to change image"],
    ["Pulsa espacio para escuchar la pista", "Press space to listen to the track"],
    // Globo 3D
    ["la Antártida", "Antarctica"], ["Groenlandia", "Greenland"], ["Japón y Corea", "Japan and Korea"], ["el sudeste asiático", "Southeast Asia"],
    ["Oriente Medio", "Middle East"], ["Asia central", "Central Asia"], ["Rusia", "Russia"], ["Nueva Zelanda", "New Zealand"],
    ["el norte de África", "North Africa"], ["África central", "Central Africa"], ["el sur de África", "Southern Africa"], ["el Caribe", "the Caribbean"],
    ["Canadá y Alaska", "Canada and Alaska"], ["Estados Unidos", "United States"], ["México y Centroamérica", "Mexico and Central America"],
    ["Sudamérica", "South America"], ["el océano Ártico", "the Arctic Ocean"], ["el océano Austral", "the Southern Ocean"],
    ["el océano Atlántico", "the Atlantic Ocean"], ["el océano Índico", "the Indian Ocean"], ["el océano Pacífico", "the Pacific Ocean"],
    ["luces nuevas y apagadas", "new lights and lights off"], ["sobre todo luces que siguen", "mostly unchanged lights"], ["sin datos", "no data"],

    // ----- Echoes of Tomorrow (futuros.html)
    ["Echoes of Tomorrow: escucha la temperatura del planeta medida por la NASA desde 1880 y, después, dos futuros posibles hasta 2100 según los modelos del IPCC. Son proyecciones, no predicciones. No necesitas ver la pantalla. Teclas: Espacio reproducir o pausar, F cambiar de futuro (dos futuros, bajas emisiones, altas emisiones), D qué suena ahora, coma y punto dato anterior o siguiente, I repetir la explicación, M cambiar el instrumento de la parte medida, T vibración del control, V guía por voz, Inicio volver a empezar, H ayuda.",
      "Echoes of Tomorrow: listen to the planet's temperature measured by NASA since 1880 and, after that, two possible futures up to 2100 according to IPCC models. These are projections, not predictions. You don't need to see the screen. Keys: Space play or pause, F change the future (two futures, low emissions, high emissions), D what's playing now, comma and period previous or next data point, I repeat the explanation, M change the instrument of the measured part, T controller vibration, V voice guide, Home start over, H help."],
    ["También puedes manejarlo hablando: pulsa O y di «reproducir», «futuro bajo», «futuro alto» o «dos futuros».", "You can also control it by speaking: press O and say “play”, “low future”, “high future” or “two futures”."],
    ["Lee en voz alta la explicación y los subtítulos (tecla V)", "Reads the explanation and captions aloud (V key)"], ["Manéjalo hablando (tecla O)", "Control it by speaking (O key)"],
    ["Gráfica de la temperatura medida y proyectada", "Chart of measured and projected temperature"], ["Futuro", "Future"],
    ["Proyecciones del IPCC, no predicciones. Con audífonos, en «Dos futuros» cada camino suena en un oído.", "IPCC projections, not predictions. With headphones, in “Two futures” each path sounds in one ear."],
    ["Instrumento de lo medido", "Instrument for the measured part"],
    ["Prototipo para el reto “The Earth Information Jukebox” · 2026 NASA Space Apps Challenge. Temperatura medida: NASA GISS (GISTEMP v4). Proyecciones: IPCC AR6, Grupo de Trabajo I, tabla SPM.1 (escenarios SSP1-2.6 y SSP5-8.5); los años entre los periodos del IPCC son una aproximación. Imagen: NASA Scientific Visualization Studio (dominio público).",
      "Prototype for the “The Earth Information Jukebox” challenge · 2026 NASA Space Apps Challenge. Measured temperature: NASA GISS (GISTEMP v4). Projections: IPCC AR6, Working Group I, table SPM.1 (scenarios SSP1-2.6 and SSP5-8.5); the years between the IPCC periods are an approximation. Image: NASA Scientific Visualization Studio (public domain)."],
    ["Cómo funciona Echoes of Tomorrow", "How does Echoes of Tomorrow work"],
    ["Las proyecciones del clima casi siempre se muestran en gráficas difíciles de leer. Aquí", "Climate projections are almost always shown in hard-to-read charts. Here"],
    ["se escuchan", "you hear them"], ["puedes comparar el pasado medido con dos futuros posibles por sus patrones musicales.", "you can compare the measured past with two possible futures by their musical patterns."],
    ["Lo medido (1880–2025)", "The measured part (1880–2025)"],
    ["cada nota de arpa es un año de temperatura global de la NASA. Más calor, nota más aguda.", "each harp note is a year of NASA global temperature. More heat, higher note."],
    ["La campana con eco", "The echoing bell"],
    ["marca el paso a la proyección. Desde ahí no son datos medidos, sino lo que calculan los modelos del IPCC según cuánto emitamos.",
      "marks the step into the projection. From there it's not measured data, but what IPCC models calculate depending on how much we emit."],
    ["Son proyecciones, no predicciones.", "These are projections, not predictions."],
    ["(mejor con audífonos): la flauta del oído izquierdo es el camino de", "(best with headphones): the flute in the left ear is the path of"],
    ["; las cuerdas del derecho, el de", "; the strings in the right ear, the path of"],
    ["Sin audífonos se distinguen igual por el instrumento y los golpes.", "Without headphones you can still tell them apart by the instrument and the hits."],
    ["uno por encima de +0.8 °C, dos por encima de +2 °C y tres por encima de +3 °C.", "one above +0.8 °C, two above +2 °C and three above +3 °C."],
    ["Soplo de fondo", "Background breath"], ["crece cuando los modelos están menos de acuerdo (más incertidumbre).", "grows when the models agree less (more uncertainty)."],
    ["explica la pista y lee los subtítulos. Con lector de pantalla déjala apagada: los subtítulos se anuncian solos.", "explains the track and reads the captions. With a screen reader leave it off: the captions are announced on their own."],
    ["«reproducir», «pausa», «dos futuros», «futuro bajo», «futuro alto», «qué suena», «ayuda». Chrome y Edge.", "“play”, “pause”, “two futures”, “low future”, “high future”, “what's playing”, “help”. Chrome and Edge."],
    ["cambiar de futuro", "change the future"], ["qué suena (año, escenario, valor y rango de los modelos)", "what's playing (year, scenario, value and model range)"],
    ["Datos: los valores del IPCC (2021–2040, 2041–2060 y 2081–2100) se colocan en su año central y se unen con rectas; se pasan a la referencia de la NASA (1951–1980) para que lo medido y lo proyectado suenen en la misma escala.",
      "Data: the IPCC values (2021–2040, 2041–2060 and 2081–2100) are placed at their middle year and joined with straight lines; they're shifted to NASA's baseline (1951–1980) so the measured and projected parts sound on the same scale."]
  ];

  // ---------------------------------------------------------------- Motor
  const MES_ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const MES_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const ABR_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const ABR_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const MONTH = '(?:' + MES_ES.join('|') + '|' + ABR_ES.join('|') + ')(?= \\d{4})';
  const TOKEN = new RegExp(MONTH + '|[+−-]?\\d+(?:\\.\\d+)?', 'gi');
  const monthEn = (s) => {
    const l = s.toLowerCase();
    let i = MES_ES.indexOf(l); if (i >= 0) return MES_EN[i];
    i = ABR_ES.indexOf(l); return i >= 0 ? ABR_EN[i] : s;
  };

  const LEAD = /^[^\p{L}\p{N}«“"(+−-]*/u;
  const TRAIL = /[^\p{L}\p{N})»”"°%²₂]*$/u;
  // Mismo texto escrito de forma distinta: lo que la guía por voz convierte para leerlo en voz alta vuelve a su forma escrita
  function norm(s) {
    return String(s).replace(/\s+/g, ' ').trim()
      .replace(/(\d) grados (norte|sur|este|oeste)/g, (m, d, w) => `${d}° ${{ norte: 'N', sur: 'S', este: 'E', oeste: 'O' }[w]}`)
      .replace(/(\d) grados\b/g, '$1 °C').replace(/partes por millón/g, 'ppm').replace(/kilómetros cuadrados/g, 'km²')
      .replace(/\bCO2\b/g, 'CO₂').replace(/^[¿¡]+/, '');
  }
  function templ(s) {
    const toks = [];
    const t = s.replace(TOKEN, (m) => { toks.push(m); return '#'; });
    return { t, toks };
  }
  function fill(en, toks) {
    let i = 0;
    return en.replace(TOKEN, (m) => {
      if (i >= toks.length) return m;
      const v = toks[i++];
      return /\d/.test(v) ? v : monthEn(v);
    });
  }
  function core(s) {
    const lead = s.match(LEAD)[0], rest = s.slice(lead.length);
    const trail = rest.match(TRAIL)[0];
    return { lead, mid: rest.slice(0, rest.length - trail.length), trail };
  }

  const EX = new Map(), LO = new Map();
  DICT.forEach(([es, en]) => {
    const k = templ(norm(core(es).mid)).t;
    en = en.replace(/[\s.:;?!…]+$/, '');   // el signo final lo pone el texto original

    if (!k) return;
    if (!EX.has(k)) EX.set(k, en);
    if (!LO.has(k.toLowerCase())) LO.set(k.toLowerCase(), en);
  });

  function lookup(mid) {
    const n = norm(mid);
    const { t, toks } = templ(n);
    let en = EX.get(t), loose = false;
    if (en === undefined) { en = LO.get(t.toLowerCase()); loose = true; }
    if (en === undefined) return null;
    let out = fill(en, toks);
    if (loose && n && out) {
      const a = n.charAt(0), b = out.charAt(0);
      if (a === a.toLowerCase() && a !== a.toUpperCase() && !/^(NASA|NOAA|IPCC|CO₂|Earth|Jukebox|D-pad|I\b)/.test(out)) out = b.toLowerCase() + out.slice(1);
      else if (a === a.toUpperCase() && a !== a.toLowerCase()) out = b.toUpperCase() + out.slice(1);
    }
    return out;
  }

  // Frases con una parte variable (nombres, colores, posiciones…)
  const RULES = [
    [/^Vas a escuchar (.+)$/, (m) => `You're about to hear ${T(m[1])}`],
    [/^Acabas de escuchar (.+)$/, (m) => `You just heard ${T(m[1])}`],
    [/^el capítulo (\d+) de (\d+): (.+)$/i, (m) => `chapter ${m[1]} of ${m[2]}: ${T(m[3])}`],
    [/^el capítulo (\d+) de (\d+)$/i, (m) => `chapter ${m[1]} of ${m[2]}`],
    [/^Pista (\d+): (.+)$/, (m) => `Track ${m[1]}: ${T(m[2])}`],
    [/^la pista (\d+) de (\d+): (.+)$/i, (m) => `track ${m[1]} of ${m[2]}: ${T(m[3])}`],
    [/^Estás en la pista (\d+) de (\d+): (.+)$/, (m) => `You're on track ${m[1]} of ${m[2]}: ${T(m[3])}`],
    [/^(.+) \(tecla (\S+)\)$/, (m) => `${T(m[1])} (${m[2]} key)`],
    [/^(.+): sí$/, (m) => `${T(m[1])}: on`],
    [/^(.+) \(actual\)$/, (m) => `${T(m[1])} (current)`],
    [/^Tecla (.+)$/, (m) => `Key ${m[1]}`],
    [/^Foto de (.+)$/, (m) => `Photo of ${m[1]}`],
    [/^Descargar el audio de (.+)$/, (m) => `Download the audio of ${T(m[1])}`],
    [/^Original \((.+)\)$/, (m) => `Original (${T(m[1])})`],
    [/^Melodía con (.+)$/, (m) => `Melody with ${T(m[1])}`],
    [/^Volviste al principio de (.+)$/, (m) => `Back to the start of ${T(m[1])}`],
    [/^Empieza en (.+)$/, (m) => `Starts at ${T(m[1])}`],
    [/^Termina en (.+)$/, (m) => `Ends at ${T(m[1])}`],
    [/^Escuchando (.+)$/, (m) => `Listening to ${T(m[1])}`],
    [/^Cargando (.+?)…?$/, (m) => `Loading ${T(m[1])}…`],
    [/^Imagen subida: (.+)$/, (m) => `Uploaded image: ${m[1]}`],
    [/^Oí: «(.*)»$/, (m) => `I heard: “${m[1]}”`],
    [/^suena (.+)$/, (m) => `sounds: ${T(m[1])}`],
    [/^Lo que más suena está (.+?), (.+?), al (\d+) % del ancho$/, (m) => `The loudest part is ${T(m[1])}, ${T(m[2])}, at ${m[3]}% of the width`],
    [/^(.+) conectado$/, (m) => `${T(m[1])} connected`],
    [/^(.+) conectado, pero este navegador no lo puede hacer vibrar$/, (m) => `${T(m[1])} connected, but this browser can't make it vibrate`],
    [/^Activar vibración del (.+?) \(tecla T\)$/, (m) => `Turn on ${T(m[1])} vibration (T key)`],
    [/^Vibración del (.+?) activada \(tecla T\)$/, (m) => `${T(m[1])} vibration on (T key)`],
    [/^El navegador ve el (.+?), pero no ofrece vibración para él$/, (m) => `The browser sees the ${T(m[1])}, but offers no vibration for it`],
    [/^Pulsa (.+) para oír qué hace cada botón$/, (m) => `Press ${T(m[1])} to hear what each button does`],
    [/^(\d{4}) (?:a|→) (\d{4}|hoy)$/, (m) => `${m[1]} to ${m[2] === 'hoy' ? 'today' : m[2]}`],
    [/^Detenido en (.+)$/, (m) => `Stopped at ${T(m[1])}`],
    [/^Escuchar (.+)$/, (m) => `Listen to ${T(m[1])}`],
    [/^Futuro con (.+)$/, (m) => `${T(m[1])} future`],
    [/^la pista (\d+) de (\d+)$/, (m) => `track ${m[1]} of ${m[2]}`]
  ];

  // Separadores con los que se parte una frase que no está entera en el diccionario (de mayor a menor)
  const SPLITS = [/((?<=[.!?…])\s+)/, /((?<=[;:])\s+)/, /(\s·\s)/, /(,\s+)/, /(\sy\s)/];
  const cache = new Map();

  // T: traduce un trozo ya sin espacios ni signos sueltos al principio o al final
  function T(mid, level) {
    level = level || 0;
    if (!mid) return mid;
    const found = lookup(mid);
    if (found !== null) return found;
    const n = norm(mid);
    for (const [re, fn] of RULES) { const m = n.match(re); if (m) return fn(m); }
    for (let i = level; i < SPLITS.length; i++) {
      const parts = n.split(SPLITS[i]);
      if (parts.length > 1) {
        let changed = false;
        const out = parts.map((p, k) => {
          if (k % 2) return i === 4 ? ' and ' : p;
          const r = piece(p, i + 1);
          if (r !== p) changed = true;
          return r;
        }).join('');
        if (changed) return out;
      }
    }
    return mid;
  }
  function piece(s, level) {
    const c = core(s);
    if (!c.mid) return s;
    const lead = c.lead.replace(/[¿¡]/g, '');
    const trail = c.trail;
    return lead + T(c.mid, level) + trail;
  }
  function post(s) {
    return s.replace(/(\d°\s?)O\b/g, '$1W')
      .replace(new RegExp('\\b' + MONTH, 'gi'), (m) => monthEn(m));
  }
  // Traduce un texto cualquiera (conserva espacios al principio y al final)
  function translate(text) {
    if (lang !== 'en' || !text || !/[A-Za-zÁÉÍÓÚáéíóúÑñ]/.test(text)) return text;
    if (cache.has(text)) return cache.get(text);
    const ws1 = text.match(/^\s*/)[0], ws2 = text.match(/\s*$/)[0];
    const body = text.slice(ws1.length, text.length - ws2.length);
    const out = ws1 + post(piece(body, 0)) + ws2;
    if (cache.size > 4000) cache.clear();
    cache.set(text, out);
    return out;
  }
  // Para la voz: traduce y deja el texto listo para leerse en inglés
  function speech(text) {
    if (lang !== 'en') return text;
    return translate(text)
      .replace(/(\d)\s?° ?N\b/g, '$1 degrees north').replace(/(\d)\s?° ?S\b/g, '$1 degrees south')
      .replace(/(\d)\s?° ?E\b/g, '$1 degrees east').replace(/(\d)\s?° ?[WO]\b/g, '$1 degrees west')
      .replace(/°C/g, ' degrees').replace(/(\d)°/g, '$1 degrees')
      .replace(/grados norte/g, 'degrees north').replace(/grados sur/g, 'degrees south')
      .replace(/grados este/g, 'degrees east').replace(/grados oeste/g, 'degrees west').replace(/grados/g, 'degrees')
      .replace(/\bppm\b/g, 'parts per million').replace(/partes por millón/g, 'parts per million')
      .replace(/km²/g, 'square kilometers').replace(/kilómetros cuadrados/g, 'square kilometers')
      .replace(/CO₂/g, 'CO2').replace(/→/g, ' to ').replace(/(\d)–(\d)/g, '$1 to $2').replace(/ · /g, ', ');
  }

  // Órdenes por voz dichas en inglés → la palabra en español que entiende el Jukebox
  const CMD = [
    [/\b(stop listening|turn off (the )?(mic|microphone|commands))\b/g, 'deja de escuchar'],
    [/\bvoice guide (on|enable)\b|\b(turn on|enable) (the )?(voice )?guide\b/g, 'activa guia'],
    [/\bvoice guide (off|disable)\b|\b(turn off|disable) (the )?(voice )?guide\b/g, 'desactiva guia'],
    [/\bwhat'?s playing\b|\bwhat is playing\b|\bwhat'?s this\b|\bwhere am i\b|\bdescribe\b/g, 'que suena'],
    [/\bnext (data|point|value)\b/g, 'dato siguiente'], [/\bprevious (data|point|value)\b/g, 'dato anterior'],
    [/\b(two|both) futures\b|\bcompare( the)? futures\b/g, 'dos futuros'],
    [/\blow (future|emissions?)\b/g, 'futuro bajo'], [/\bhigh (future|emissions?)\b/g, 'futuro alto'], [/\bfutures?\b/g, 'futuros'],
    [/\b(from the (start|beginning)|start over|restart|again)\b/g, 'desde el principio'],
    [/\bfaster\b|\bspeed up\b/g, 'mas rapido'], [/\bslower\b|\bslow down\b/g, 'mas lento'], [/\bnormal speed\b/g, 'normal'],
    [/\b(track|song|number)\b/g, 'pista'],
    [/\bone\b|\bfirst\b/g, 'uno'], [/\btwo\b|\bsecond\b/g, 'dos'], [/\bthree\b|\bthird\b/g, 'tres'], [/\bfour\b|\bfourth\b/g, 'cuatro'],
    [/\bfive\b|\bfifth\b/g, 'cinco'], [/\bsix\b|\bsixth\b/g, 'seis'], [/\bseven\b|\bseventh\b/g, 'siete'],
    [/\b(pause|stop|quiet|silence|hold on)\b/g, 'pausa'], [/\b(play|start|resume|continue|go)\b/g, 'reproducir'],
    [/\bnext\b/g, 'siguiente'], [/\b(previous|back|last)\b/g, 'anterior'],
    [/\b(help|commands)\b/g, 'ayuda'], [/\b(explain|repeat)\b/g, 'explica'],
    [/\binstruments?\b/g, 'instrumento'], [/\b(image|picture|photo|upload)\b/g, 'imagen'], [/\bcollection\b/g, 'coleccion'],
    [/\btemperature\b|\bheat\b/g, 'temperatura'], [/\bice\b|\barctic\b/g, 'hielo'], [/\bocean\b|\bsea\b/g, 'oceano'],
    [/\bcarbon\b|\bair\b/g, 'co2'], [/\blights?\b|\bcities\b/g, 'luces'], [/\blightning\b|\bstorms?\b/g, 'rayos'],
    [/\bharp\b/g, 'arpa'], [/\bstrings\b/g, 'cuerdas'], [/\bflute\b/g, 'flauta'], [/\bbells\b/g, 'campanas'], [/\bdrums\b/g, 'tambores']
  ];
  function cmdToEs(raw) {
    if (lang !== 'en') return raw;
    let s = ' ' + String(raw).toLowerCase() + ' ';
    CMD.forEach(([re, es]) => { s = s.replace(re, es); });
    return s.trim();
  }

  // ---------------------------------------------------------------- Aplicar a la página
  const ATTRS = ['aria-label', 'title', 'alt', 'placeholder', 'aria-valuetext', 'aria-roledescription'];
  const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'CODE']);
  function doText(node) {
    const p = node.parentNode;
    if (!p || SKIP.has(p.nodeName) || (p.closest && p.closest('[data-no-i18n]'))) return;
    const v = node.nodeValue, t = translate(v);
    if (t !== v) node.nodeValue = t;
  }
  function doAttrs(el) {
    if (el.closest && el.closest('[data-no-i18n]')) return;
    ATTRS.forEach((a) => {
      if (!el.hasAttribute(a)) return;
      const v = el.getAttribute(a), t = translate(v);
      if (t !== v) el.setAttribute(a, t);
    });
  }
  function walk(root) {
    if (root.nodeType === 3) { doText(root); return; }
    if (root.nodeType !== 1 || SKIP.has(root.nodeName)) return;
    doAttrs(root);
    const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    let n;
    while ((n = tw.nextNode())) { if (n.nodeType === 3) doText(n); else doAttrs(n); }
  }
  let observer = null;
  function applyEnglish() {
    document.documentElement.lang = 'en';
    document.title = translate(document.title);
    const md = document.querySelector('meta[name="description"]');
    if (md) md.setAttribute('content', translate(md.getAttribute('content')));
    walk(document.body);
    if (observer) return;
    observer = new MutationObserver((recs) => {
      recs.forEach((r) => {
        if (r.type === 'characterData') doText(r.target);
        else if (r.type === 'attributes') doAttrs(r.target);
        else r.addedNodes.forEach(walk);
      });
    });
    observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  }

  // La voz del navegador: en inglés, con una voz inglesa (la de la guía elige la suya en js/nav.js)
  const synth = window.speechSynthesis;
  if (synth && synth.speak) {
    const orig = synth.speak.bind(synth);
    synth.speak = function (u) {
      if (lang === 'en' && u && typeof u.text === 'string') {
        u.text = speech(u.text);
        if (!/^en/i.test(u.lang || '')) {
          const v = EIJ.voz && EIJ.voz.pick ? EIJ.voz.pick() : null;
          u.voice = v && /^en/i.test(v.lang) ? v : null;
          u.lang = u.voice ? u.voice.lang : 'en-US';
        }
      }
      return orig(u);
    };
  }

  // ---------------------------------------------------------------- Botón ES / EN
  function addButton() {
    const bar = document.querySelector('.site-nav-in');
    if (!bar || bar.querySelector('.lang-btn')) return;
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'lang-btn'; b.setAttribute('data-no-i18n', '');
    b.innerHTML = '<span class="lang-opt" data-l="es">ES</span><span class="lang-opt" data-l="en">EN</span>';
    const sync = () => {
      b.querySelectorAll('.lang-opt').forEach((s) => s.classList.toggle('is-on', s.dataset.l === lang));
      b.setAttribute('aria-label', lang === 'en' ? 'Cambiar a español (Spanish)' : 'Switch to English (inglés)');
      b.title = b.getAttribute('aria-label');
      b.lang = lang === 'en' ? 'es' : 'en';
    };
    sync();
    b.addEventListener('click', () => {
      if (window.speechSynthesis) window.speechSynthesis.cancel();
      if (lang === 'en') {
        lang = 'es';
        try { localStorage.setItem(KEY, 'es'); } catch (e) { /* sin almacenamiento */ }
        location.reload();   // el HTML original está en español
        return;
      }
      lang = 'en';
      try { localStorage.setItem(KEY, 'en'); } catch (e) { /* sin almacenamiento */ }
      sync();
      applyEnglish();
    });
    const toggle = bar.querySelector('.nav-toggle');
    bar.insertBefore(b, toggle);
  }

  EIJ.i18n = { get lang() { return lang; }, t: translate, speech, cmdToEs };
  addButton();
  if (lang === 'en') applyEnglish();
})();
