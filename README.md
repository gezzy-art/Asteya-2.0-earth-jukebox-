# The Earth Information Jukebox

Prototipo para el reto **"The Earth Information Jukebox"** del 2026 NASA Space Apps Challenge.
Una **colección de 7 pistas de audio originales**, creadas a partir de datos reales de la NASA, que cuentan con sonido
cómo está cambiando la Tierra.

**▶ Pruébalo en línea:** https://TU-USUARIO.github.io/NOMBRE-DEL-REPO/ (no hay que instalar nada)

- **Recorrido guiado** (`index.html`): la primera pantalla. Portada, 6 capítulos y, debajo de la portada, el equipo y el porqué del proyecto.
- **Jukebox** (`jukebox.html`): la colección de audios en un reproductor sencillo: eliges una pista arriba, pulsas ▶ y
  escuchas. La imagen, una gráfica con la posición actual y los subtítulos avanzan al ritmo del audio.

- **Escucha una imagen de la NASA** (pestaña del Jukebox, tecla `E`, o `jukebox.html#imagen`): sonificación **en tiempo
  real** de cualquier imagen. Se elige una de las 7 visualizaciones del EIC o se sube una propia; el navegador lee sus
  píxeles y una línea la recorre de izquierda a derecha. Ver "Escucha una imagen de la NASA" más abajo.

## Escucha una imagen de la NASA

`js/jukebox-imagen.js` lee la imagen en una cuadrícula de 48 × 12 celdas. Para cada celda calcula cuánto destaca del
fondo (brillo o color por encima de la mediana de la imagen, escalado hasta el percentil 95) y su color dominante.

| Imagen | Sonido |
| --- | --- |
| Columna (izquierda → derecha) | Tiempo: una columna cada 0,22 s |
| Fila (más arriba) | Nota más aguda (Do mayor pentatónica, 12 notas) |
| Cuánto destaca | Volumen; el fondo no suena (umbral 0,3); suenan las 3 celdas más destacadas de la columna |
| Color | Instrumento: rojo/naranja/amarillo = campana, verde = marimba, azul/morado = tono suave, gris/blanco = arpa |
| Mezcla cálido / frío de la columna | Acorde de fondo mayor (cálido) o menor (frío) |

Al terminar se dice dónde está lo más destacado, los colores principales y qué parte de la imagen destaca. Se puede
explorar tocando o pasando el ratón por la imagen, o con las flechas (← → columna, ↑ ↓ celda, `D` qué hay ahí);
`1`–`7` eligen imagen. También responde a las órdenes por voz («imagen», «reproducir», «siguiente», «qué hay») y al
control. Las imágenes de la galería se pueden leer en la versión en línea o con el servidor local (no abriendo el
`.html` con doble clic); una imagen subida funciona siempre.

## La colección

| Pista | Archivo | Datos | Cómo suena |
| --- | --- | --- | --- |
| 1 · El planeta se calienta | `assets/audio/01-temperatura.wav` (52 s) | GISTEMP v4, 1880–2025 | Un año = una nota de arpa; más calor = más aguda. Tono menor a partir de +0.5 °C y pulso de percusión a partir de +0.8 °C |
| 2 · El hielo desaparece | `assets/audio/02-hielo.wav` (39 s) | Hielo ártico de septiembre, 1979–2026 | Un año = un puñado de campanas: más hielo = más campanas y más volumen. El viento sube con el hielo que falta |
| 3 · El océano mueve el calor | `assets/audio/03-oceano.wav` (41 s) | Temperatura del mar (ECCO2), polo a polo | Una fila de 5° de latitud por segundo, de norte a sur; agua cálida = nota aguda, tierra = silencio |
| 4 · La causa: el aire que cambia | `assets/audio/04-co2.wav` (46 s) | CO₂ de Mauna Loa, 1958–2026 | Un tono continuo que sube con las ppm; latido cada año y campana grave al cruzar 350, 400 y 420 ppm |
| 5 · Las luces de la noche cambian | `assets/audio/05-luces.wav` (41 s) | VIIRS Black Marble, cambio 2012 → 2023 (SVS 5313) | Barrido de oeste a este: luces nuevas (morado) = campanas, luces apagadas (naranja) = tono grave; más al norte = más agudo |
| 6 · Rayos vistos desde el espacio | `assets/audio/06-rayos.wav` (41 s) | Instrumento LIS en la ISS, 2023 (SVS 5011) | Barrido de oeste a este: cada zona con rayos es un tambor (más al norte = más agudo); muchos rayos a la vez = trueno |
| 7 · Echoes of Tomorrow | (solo en el navegador, ≈ 72 s) | GISTEMP v4 1880–2025 + proyecciones IPCC AR6 (SSP1-2.6 y SSP5-8.5) hasta 2100 | La temperatura medida con arpa; una campana con eco marca el paso a la proyección. Flauta = bajas emisiones, cuerdas = altas emisiones, con eco. Golpes de alarma: 1 sobre +0.8 °C, 2 sobre +2 °C, 3 sobre +3 °C. Un soplo crece con la incertidumbre de los modelos |

En el Jukebox, las pistas 3 y 5 se ven como un **globo 3D** (`js/globo-3d.js`, Three.js desde CDN) que sigue al audio:
- **Pista 5 · luces:** la Tierra de noche gira de oeste a este; la línea vertical es la franja que suena.
- **Pista 3 · océano:** las corrientes (la animación `corrientes-oceanicas.webm` como textura) se inclinan del Polo Norte
  al Polo Sur mientras el globo gira despacio; la línea horizontal es la latitud que suena.

Si se arrastra el globo o se gira con las flechas, el audio se pausa y suena lo que queda bajo la línea (en el océano,
la celda del centro: agua cálida = nota aguda, tierra = golpe sordo). Necesita la versión en línea o el servidor local,
y WebGL; si no, se ve el mapa plano.

### Pista 7 · Echoes of Tomorrow (escuchar posibles futuros)

Compara la temperatura medida con dos escenarios climáticos, identificados siempre como **proyecciones, no predicciones**
(en la voz, los subtítulos, la leyenda y el panel). Tres modos (botones "Futuro" en el panel, tecla `F` u órdenes por voz
«dos futuros», «futuro bajo», «futuro alto»):

- **Dos futuros** (Two Futures): con audífonos, bajas emisiones en el oído izquierdo y altas en el derecho. En mono se
  distinguen igual por el timbre, la altura y los golpes de alarma.
- **Bajas emisiones** (SSP1-2.6) o **Altas emisiones** (SSP5-8.5) por separado.

Datos en `js/datos-futuro.js`: los valores de la tabla SPM.1 del IPCC AR6 (2021–2040, 2041–2060, 2081–2100, con su rango
"muy probable") se colocan en su año central, se pasan a la referencia de GISTEMP (1951–1980; 1850–1900 se aproxima con
GISTEMP 1880–1900, ≈ −0.22 °C) y se unen con rectas desde el promedio de los últimos 5 años medidos. Los años intermedios
son, por tanto, una aproximación. La música está en `futureScore` de `js/jukebox-musica.js`; la pista, sus subtítulos y la
gráfica (franjas medidas + líneas y rangos proyectados), en la sección "Pista 7" de `js/jukebox.js`.
Pendiente para una segunda versión: elegir región (NASA NEX-GDDP-CMIP6) y nivel del mar (NASA Sea Level Projection Tool).

Las pistas 5 y 6 se calculan leyendo los píxeles de las imágenes (`assets/eic/luces-nocturnas-cambio.jpg` y
`rayos-iss-2023.jpg`) en una cuadrícula de 48 × 12 celdas (luces: luminancia > 0.06, morado = nuevas, naranja = apagadas; rayos: píxeles amarillos saturados).

**Equipo:** la sección "Por qué lo hicimos" y el equipo están debajo de la portada de `index.html`. Los nombres,
roles y fotos se editan en la sección `equipo` al final de `js/recorrido.js` (las fotos pueden ir en `assets/equipo/`).

Los audios los crea `herramientas/generar-audios.ps1` (PowerShell + C#, sin instalar nada) a partir de los datos
de `js/datos-nasa.js`. Para regenerarlos, por ejemplo después de actualizar los datos:

```
powershell -ExecutionPolicy Bypass -File herramientas\generar-audios.ps1
```

El script también escribe `js/jukebox-tiempos.js`, con los tiempos que usa la página para sincronizar la gráfica y
los subtítulos. Los textos de cada pista están en `js/jukebox.js`.

El Jukebox funciona aunque se abra `jukebox.html` con doble clic (no lee píxeles).

### Música e instrumentos

**Estéreo:** cada nota de la melodía y cada señal (alarma de calor, latidos, campanas de umbral, golpes de rayo,
truenos) suena en su lugar, de izquierda a derecha:

| Pista | Izquierda → derecha |
| --- | --- |
| 1 · Temperatura, 2 · Hielo, 4 · CO₂ | El tiempo: el primer año a la izquierda, el último a la derecha (en el CO₂ también viaja el tono de fondo) |
| 3 · Océano | La longitud: cada fila suena en 6 tramos de oeste a este |
| 5 · Luces, 6 · Rayos | La longitud: la línea que recorre el mapa de oeste a este |

Acordes, bajo, viento y zumbidos se quedan al centro. El paneo no pasa del 80 % hacia un lado (nadie pierde
una nota si escucha con un solo oído) y la altura y el volumen siguen diciendo lo mismo, así que en mono no se pierde
información. Cada lado tiene su propia reverberación para que el eco no devuelva la nota al centro. Medido con la
mezcla completa, el principio de la temperatura suena unos 9 dB más a la izquierda y el final 9 dB más a la derecha.
Se nota con audífonos; con una sola bocina, casi nada. Código: sección "Estéreo" y `pan` de cada nota en
`js/jukebox-musica.js`. Los WAV de respaldo de `assets/audio/` siguen sin paneo.

El Jukebox ya no reproduce directamente esos WAV: `js/jukebox-musica.js` sintetiza cada pista en el navegador
como una pieza en cuatro capas, con las mismas reglas dato → nota:

- **Melodía** (los datos), en una escala de siete notas que se ajusta a los acordes en los tiempos fuertes.
- **Acordes**: una progresión suave (I–vi–IV–V en mayor, i–VI–III–VII en menor). En la pista 1 pasa a menor por encima de +0.5 °C.
- **Bajo**: la raíz de cada acorde.
- **Ambiente y señales**: viento, olas, latidos, truenos, la alarma de calor y las campanas de umbral del CO₂.

En la columna derecha, **Instrumentos** permite tocar la melodía con arpa, piano, marimba, cuerdas, flauta, campanas,
tono suave o tambores (tecla `M`) y apagar capas. "Descargar" guarda lo que se está escuchando. Si la síntesis
fallara, se usan los WAV de `assets/audio/`. El generador también exporta a `js/jukebox-tiempos.js` las cuadrículas
de luces y rayos (`gridNeu`, `gridOff`, `grid`) que usa el motor.

### Jukebox para personas ciegas o con baja visión

El jukebox existe para que los datos de la NASA, que normalmente se cuentan con imágenes, se puedan **escuchar**.
Por eso todo se puede hacer sin ver la pantalla:

- **Bienvenida por voz**: en la portada, junto a "Empezar", está "Ir al Jukebox" (tecla `J`). Al pulsarlo, la voz dice
  «Hola, bienvenida a nuestro jukebox, un proyecto creado por Asteya para el NASA Space Apps Challenge» y explica las
  teclas básicas; al terminar se abre el Jukebox (pulsar otra vez entra sin esperar). Se habla en la portada porque los
  navegadores solo dejan hablar tras un clic o una tecla, y ese permiso se pierde al cambiar de página. Si se abre
  `jukebox.html` directamente, intenta dar la bienvenida al cargar; si el navegador no lo deja, la primera tecla la da.

- **Guía por voz** (botón al principio de la página o tecla `V`): usa la voz del navegador (Web Speech API) para leer
  la explicación de cada pista antes de que suene y los subtítulos mientras suena, bajando la música al hablar. Se
  recuerda entre visitas. Con lector de pantalla conviene dejarla apagada: los subtítulos se anuncian solos (`aria-live`).
- **Órdenes por voz** (botón al principio de la página o tecla `O`): el jukebox se maneja hablando, con el
  reconocimiento de voz del navegador (Web Speech API). Órdenes: «pista tres» (o «la del hielo», «rayos»…),
  «reproducir», «pausa», «siguiente», «anterior», «qué suena», «dato siguiente / anterior», «explica»,
  «desde el principio», «más rápido / más lento», «instrumento» (o su nombre: «piano»), «ayuda» y «desactivar órdenes».
  Funciona en Chrome y Edge, con micrófono e internet; en otros navegadores el botón no aparece y el teclado sigue
  funcionando igual. Mientras la guía habla solo se atiende a «pausa», para que el micrófono no tome la voz de la
  página por una orden; con altavoces y lector de pantalla conviene usar auriculares. Código: sección
  "Órdenes por voz" de `js/jukebox.js`.
- **Vibración del control** (botón al principio de la página o tecla `T`): con un control de Xbox o PlayStation
  conectado (mejor por USB; hay que pulsar un botón para que el navegador lo vea), el control vibra con los mismos
  datos que suenan. Cada pista tiene su regla, que se muestra en "Qué sientes en el control" y que la guía por voz
  explica antes de empezar:

  | Pista | Vibración |
  | --- | --- |
  | 1 · Temperatura | Un pulso por año, más fuerte cuanto más cálido; doble pulso por encima de +0.5 °C y cosquilleo por encima de +0.8 °C |
  | 2 · Hielo | Un zumbido por año, más largo cuanto más hielo |
  | 3 · Océano | Una vibración por franja: agua cálida fuerte, fría suave, tierra nada |
  | 4 · CO₂ | Un latido por año, cada vez más fuerte; vibración larga al cruzar 350, 400 y 420 ppm |
  | 5 · Luces | Luces nuevas = tres golpecitos (motor agudo); luces apagadas = zumbido largo (motor grave) |
  | 6 · Rayos | Un golpe por zona con rayos; sacudida larga (trueno) donde hay muchos |

  Para que sonido y vibración no choquen: la vibración se calcula con el reloj del propio audio (el mismo de la
  gráfica y los subtítulos), así que cae sobre su nota y se detiene al pausar, saltar o cambiar de pista; cada patrón
  nuevo corta al anterior; la fuerza tiene un tope del 80 % para que el zumbido del control no tape la música, y baja
  más mientras habla la guía por voz. Con `,` y `.` en pausa se siente un solo dato. Las fuerzas se redondean a 4
  niveles, que es lo que la mano distingue. Funciona en Chrome y Edge (Firefox no hace vibrar el control).
  Código: `js/jukebox-vibracion.js` (el control) y la sección "Vibración del control" de `js/jukebox.js` (las reglas).
- **Botones del control**: el jukebox se maneja entero con el control. Se asignan por posición, no por letra
  (la "X" de Xbox está a la izquierda; la ✕ de PlayStation, abajo):

  | Botón | Acción |
  | --- | --- |
  | Abajo (A / ✕) | Reproducir o pausar |
  | Derecha (B / ○) | ¿Qué suena ahora? |
  | Izquierda (X / □) | Repetir la explicación de la pista |
  | Arriba (Y / △) | Decir qué hace cada botón |
  | Cruceta ← → | Pista anterior / siguiente |
  | Cruceta ↑ ↓ | Dato siguiente / anterior |
  | Gatillo izquierdo / derecho | Más lento / más rápido |
  | Botón superior derecho | Cambiar de instrumento |
  | Menú / Options | Activar o desactivar la vibración |
  | Vista / Create | Volver al principio |

  El botón que se pulsa para que el navegador vea el control no dispara ninguna acción. Los navegadores no cuentan
  los botones del control como "tocar la página": si no deja sonar el audio, basta pulsar una vez la barra espaciadora
  o hacer clic (para una demo, Chrome se puede abrir con `--autoplay-policy=no-user-gesture-required`). Código:
  sección "Botones del control" de `js/jukebox.js`.
- **`D`** / botón "¿Qué suena ahora?": dice la pista, el minuto y el dato que está sonando (año y valor, latitud…).
- **`,` y `.`** / botones "Dato anterior / siguiente": salta un dato y, en pausa, suena solo ese trozo.
- **`1`–`6`** o **`←` `→`** cambiar de pista, **`I`** repetir la explicación, **`Inicio`** volver al principio, **`H`** ayuda.
- La gráfica tiene un resumen de texto (primer valor, último y máximo) y el deslizador anuncia el tiempo y el dato,
  no un número de 0 a 1000.

## Recorrido guiado (`index.html`)

| Capítulo | Estado | Contenido |
| --- | --- | --- |
| 1 · El planeta se calienta | ✅ prototipo | Temperatura global 1880 → 2025 (GISTEMP v4), un año por nota, subtítulos y "Escucha la diferencia" (1880 frente al año más caliente) |
| 2 · El hielo desaparece | ✅ prototipo | Hielo ártico de septiembre 1979 → hoy (NSIDC Sea Ice Index): un acorde de campanas por año, más hielo = más notas. La imagen real de la NASA (SVS 3998) pasa de 1979 a 2012 según el hielo de cada año. "Escucha la diferencia": 1979 frente al mínimo récord |
| 3 · El océano mueve el calor | ✅ prototipo | Viaje guiado por la Corriente del Golfo sobre el mapa real de corrientes de la NASA (SVS 3912): agua cálida = nota aguda. Después, exploración libre con el dedo, el ratón o las flechas (golpe sordo = tierra). "Escucha la diferencia": Golfo de México frente a Noruega |
| 4 · La causa | ✅ prototipo | CO₂ de Mauna Loa mes a mes, 1958 → hoy (NOAA, la serie que usa la NASA): un tono continuo que sube con el CO₂; se oye el vaivén anual de las plantas ("la Tierra respirando") y la subida de fondo. Imagen de fondo NASA SVS 5196. "Escucha la diferencia": un año completo en 1959 frente al último año completo |
| 5 · Las luces de la noche cambian | ✅ prototipo | Mapa de luces nocturnas 2012 → 2023 (SVS 5313) con el audio `05-luces.wav`: una línea recorre el mapa de oeste a este, campanas = luces nuevas, tono grave = luces apagadas. "Escucha la diferencia": Europa frente a India y China |
| 6 · Rayos vistos desde el espacio | ✅ prototipo | Rayos detectados desde la ISS (SVS 5011) con el audio `06-rayos.wav`: tambor por zona con rayos, trueno donde hay muchos. "Escucha la diferencia": océano Índico frente a África central |
| Cierre | ✅ prototipo | "Lo que acabas de escuchar no es música inventada": resumen de los 6 capítulos con cifras calculadas de los datos, volver a escuchar cada capítulo, compartir, empezar de nuevo y entrar al Jukebox |

Los subtítulos se calculan a partir de los datos (por ejemplo, el primer año que supera +0.5 °C, el primer año con
menos de 4.5 millones de km² de hielo, los récords), así que se actualizan solos si cambian los archivos de datos.
Código en `js/recorrido.js`, dividido en secciones con un separador cada una: `recorrido` (capítulo 1 y
navegación), `cap2-hielo`, `cap3-oceano`, `cap4-co2` (capítulo 4 y cierre), `cap56-mapas` (capítulos 5 y 6, que
reutilizan los audios de la colección y los tiempos de `js/jukebox-tiempos.js`) y `equipo`. Estilos en `css/recorrido.css`.

Los datos de todos los capítulos están en `js/datos-nasa.js`, también dividido en secciones (`gistemp`,
`hielo-datos`, `oceano-datos`, `co2-datos`).

Datos del capítulo 4 (sección `co2-datos`): CO₂ mensual del Observatorio de Mauna Loa
([NOAA GML](https://gml.noaa.gov/ccgg/trends/), columna `average` de `co2_mm_mlo.csv`), la misma serie del
[indicador de CO₂ de la NASA](https://science.nasa.gov/earth/explore/earth-indicators/carbon-dioxide/).
Sonido: 310 ppm = 110 Hz y una octava más cada 55 ppm; un mes cada 40 ms (≈ 33 s en total).

Datos del capítulo 2 (sección `hielo-datos`): extensión de septiembre del
[NSIDC Sea Ice Index](https://nsidc.org/data/g02135) (v3), obtenida de la copia de NOAA PSL
(`n_iceextent.mon.data`) porque el servidor de NSIDC no respondía. Imágenes: `assets/eic/hielo-1979.jpg` y
`hielo-2012.jpg` de [NASA SVS 3998](https://svs.gsfc.nasa.gov/3998) (dominio público, mismo encuadre).

Datos del capítulo 3 (sección `oceano-datos`): una cuadrícula de 72 × 36 celdas (5°) con un índice de temperatura del
mar de 0 (frío) a 1 (cálido), extraído del color de `assets/eic/corrientes-oceanicas.jpg` (NASA SVS 3912) con
`herramientas/extraer-oceano.ps1`: para cada celda promedia el tono de los píxeles con color (azul = 0, rojo = 1) e
ignora el gris de la tierra y el negro del fondo. Es una lectura de la paleta, no grados exactos. Al estar precalculado,
el capítulo funciona aunque se abra `index.html` con doble clic. El dato "cerca del 90 % del calor extra" es de
[NASA · Ocean Warming](https://science.nasa.gov/earth/explore/earth-indicators/ocean-warming/).

## Cómo ejecutarlo

**En línea (lo más fácil):** abre https://TU-USUARIO.github.io/NOMBRE-DEL-REPO/ en Chrome o Edge. Todo funciona,
incluida la lectura de imágenes de la NASA.

**En tu computadora:** descarga el proyecto (botón **Code → Download ZIP** en GitHub), descomprímelo y haz doble clic
en `iniciar-servidor.bat`.
Abre la app en `http://localhost:8080` con un servidor local escrito en PowerShell (no hay que instalar nada).
También sirve la extensión **Live Server** de VS Code.

**Abriendo los `.html` con doble clic** el recorrido guiado y el Jukebox funcionan igual: todos los datos están precalculados.

Se requiere conexión a internet para cargar Tailwind CSS, Tone.js y las fuentes desde CDN.

## Visualizaciones del Earth Information Center

Copias locales en `assets/eic/` (NASA Scientific Visualization Studio, dominio público).

| Uso | Archivo | Fuente |
| --- | --- | --- |
| Temperatura | `temperatura-2025.png` | [SVS 5603](https://svs.gsfc.nasa.gov/5603) · Cambio en la temperatura global 2025 vs 1951–1980, GISTEMP v4 (NASA GISS) |
| Hielo | `hielo-1979.jpg`, `hielo-2012.jpg` | [SVS 3998](https://svs.gsfc.nasa.gov/3998) · Hielo ártico de septiembre |
| Océano | `corrientes-oceanicas.jpg` (+ `.webm`) | [SVS 3912](https://svs.gsfc.nasa.gov/3912) · Corrientes superficiales coloreadas por temperatura del mar, modelo ECCO2 (MIT/JPL) |
| CO₂ | `co2-dyamond.jpg` | [SVS 5196](https://svs.gsfc.nasa.gov/5196) · CO₂ global, enero 2020, modelo GEOS (DYAMOND) |
| Luces nocturnas | `luces-nocturnas-cambio.jpg` | [SVS 5313](https://svs.gsfc.nasa.gov/5313) · Cambio en la iluminación nocturna 2012 → 2023, VIIRS Black Marble |
| Rayos | `rayos-iss-2023.jpg` | [SVS 5011](https://svs.gsfc.nasa.gov/5011) · Rayos detectados por el instrumento LIS en la ISS (un cuadro de la animación anual) |

## Estructura

```
iniciar-servidor.bat / servidor.ps1   Servidor local para abrir la app con datos reales
assets/eic/       Visualizaciones del EIC (NASA SVS)
index.html        Recorrido guiado (primera pantalla): portada, equipo y 6 capítulos
jukebox.html      Jukebox: reproductor de la colección de audios
assets/audio/     Los 6 audios originales (generados con herramientas/generar-audios.ps1)
css/jukebox.css   Estilos del Jukebox
js/jukebox.js     Jukebox: pistas, subtítulos, gráfica sincronizada y controles
js/jukebox-tiempos.js  Tiempos de cada audio (generado)
js/jukebox-vibracion.js  Vibración del control de Xbox o PlayStation (Gamepad API)
js/jukebox-imagen.js  Escucha una imagen de la NASA: lectura de píxeles y síntesis en tiempo real (Web Audio)
css/styles.css    Tema espacial, glassmorphism y estados de los controles
css/recorrido.css Estilos del recorrido guiado
js/recorrido.js   Recorrido guiado: navegación, los 6 capítulos y el equipo (una sección por capítulo)
js/datos-nasa.js  Datos: GISTEMP v4, hielo ártico, cuadrícula del océano y CO₂ de Mauna Loa
js/data.js        Constantes, pistas (campos procedurales y paletas), instrumentos, escalas y estado compartido
js/audio.js       Motor Tone.js del recorrido: grafo de audio e instrumentos
```

Todos los módulos comparten el espacio de nombres global `window.EIJ`. El orden de los `<script>` importa:
- `jukebox.html`: `datos-nasa → jukebox-tiempos → jukebox-musica → jukebox-vibracion → jukebox → jukebox-imagen`
- `index.html`: `data → datos-nasa → audio → jukebox-tiempos → recorrido`

## Temperatura año por año (capítulo 1 del recorrido)

Sonifica la anomalía anual de temperatura global (°C respecto a 1951–1980) del
[GISTEMP v4 de NASA GISS](https://data.giss.nasa.gov/gistemp/) (columna J-D de `GLB.Ts+dSST.csv`, solo años completos).
Los valores están en la sección `gistemp` de `js/datos-nasa.js`, generada a partir del archivo oficial.

| Dato | Sonido |
| --- | --- |
| Anomalía del año | Altura de la nota y apertura del filtro (de −0.6 °C a +1.4 °C) |
| Anomalía > +0.5 °C | La armonía pasa de Pentatónica Mayor a Menor Natural |
| Anomalía > +0.8 °C | Entra el hi-hat (doble golpe por encima de +1.1 °C) |
| Calor del año | El tiempo avanza más rápido: de ~380 ms a ~190 ms por año |

Se ve como "franjas de calentamiento" (un color por año) que aparecen al ritmo del audio, con subtítulos calculados
a partir de los datos. Código en `js/recorrido.js` y `audio.yearNote` en `js/audio.js`.

### Ir a cualquier capítulo (recorrido)

Los puntos de progreso de cada capítulo son botones numerados (1–6) con un botón "Inicio": se puede saltar a
cualquier capítulo sin volver a la portada. La portada y el cierre tienen el mismo menú.

## Accesibilidad

- **Lector de pantalla:** los subtítulos están en regiones `aria-live` y todos los controles tienen `aria-label`.
- **Teclado:** el Jukebox se maneja entero con atajos (ver "Jukebox para personas ciegas o con baja visión"); en el
  recorrido, el mapa del océano se explora con las flechas.
- **Voz:** guía por voz y órdenes por voz en el Jukebox.
