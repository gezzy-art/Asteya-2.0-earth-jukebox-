# The Earth Information Jukebox

*[Versión en español](README.md)*

Prototype for the **"The Earth Information Jukebox"** challenge of the 2026 NASA Space Apps Challenge.
A **collection of 7 original audio tracks**, made from real NASA data, that use sound to tell how the Earth is changing.

**▶ Try it online:** https://gezzy-art.github.io/Asteya-2.0-earth-jukebox-/

- **Guided tour** (`index.html`): the first screen. A cover page, 6 chapters and, below the cover, the team and why we made the project.
- **Jukebox** (`jukebox.html`): the audio collection in a simple player. Pick a track at the top, press ▶ and listen.
  The image, a chart showing the current position and the subtitles all move along with the audio.
- **Listen to a NASA image** (a Jukebox tab, key `E`, or `jukebox.html#imagen`): **real-time** sonification of any
  image. Pick one of the 7 EIC visualizations or upload your own. The browser reads its pixels and a line sweeps
  across it from left to right. See "Listen to a NASA image" below.

## Listen to a NASA image

`js/jukebox-imagen.js` reads the image as a grid of 48 × 12 cells. For each cell it works out how much the cell
stands out from the background (brightness or color above the image's median, scaled up to the 95th percentile) and
its dominant color.

| Image | Sound |
| --- | --- |
| Column (left → right) | Time: one column every 0.22 s |
| Row (higher up) | Higher note (C major pentatonic, 12 notes) |
| How much it stands out | Volume. The background is silent (threshold 0.3). The 3 cells that stand out most in each column play |
| Color | Instrument: red/orange/yellow = bell, green = marimba, blue/purple = soft tone, gray/white = harp |
| Warm/cool mix of the column | Background chord: major (warm) or minor (cool) |

When the sweep ends, the app says where the most prominent area is, what the main colors are and which part of the
image stands out. You can explore by touching the image, hovering over it with the mouse, or using the arrow keys
(← → column, ↑ ↓ cell, `D` what's there). Keys `1`–`7` choose an image. It also responds to voice commands ("image",
"play", "next", "what's here") and to the game controller. Gallery images can only be read in the online version or
through the local server, not by double-clicking the `.html` file. An uploaded image always works.

## The collection

| Track | File | Data | How it sounds |
| --- | --- | --- | --- |
| 1 · The planet is warming | `assets/audio/01-temperatura.wav` (52 s) | GISTEMP v4, 1880–2025 | One year = one harp note. Hotter = higher. Switches to a minor key from +0.5 °C and adds a percussion pulse from +0.8 °C |
| 2 · The ice is disappearing | `assets/audio/02-hielo.wav` (39 s) | September Arctic sea ice, 1979–2026 | One year = a handful of bells. More ice = more bells and more volume. The wind rises with the missing ice |
| 3 · The ocean moves heat | `assets/audio/03-oceano.wav` (41 s) | Sea temperature (ECCO2), pole to pole | One 5° latitude row per second, north to south. Warm water = high note, land = silence |
| 4 · The cause: the changing air | `assets/audio/04-co2.wav` (46 s) | Mauna Loa CO₂, 1958–2026 | A continuous tone that rises with ppm. A heartbeat every year and a low bell when crossing 350, 400 and 420 ppm |
| 5 · The night lights are changing | `assets/audio/05-luces.wav` (41 s) | VIIRS Black Marble, change 2012 → 2023 (SVS 5313) | West-to-east sweep. New lights (purple) = bells, lights gone dark (orange) = low tone. Farther north = higher |
| 6 · Lightning seen from space | `assets/audio/06-rayos.wav` (41 s) | LIS instrument on the ISS, 2023 (SVS 5011) | West-to-east sweep. Each area with lightning is a drum (farther north = higher). Lots of lightning at once = thunder |
| 7 · Echoes of Tomorrow | (browser only, ≈ 72 s) | GISTEMP v4 1880–2025 + IPCC AR6 projections (SSP1-2.6 and SSP5-8.5) to 2100 | Measured temperature on harp. An echoing bell marks the switch to the projection. Flute = low emissions, strings = high emissions, with echo. Alarm hits: 1 above +0.8 °C, 2 above +2 °C, 3 above +3 °C. A breathy sound grows with model uncertainty |

In the Jukebox, tracks 3 and 5 are shown as a **3D globe** (`js/globo-3d.js`, Three.js from a CDN) that follows the audio:
- **Track 5 · lights:** the Earth at night rotates from west to east. The vertical line is the strip that is playing.
- **Track 3 · ocean:** the currents (the `corrientes-oceanicas.webm` animation as a texture) tilt from the North Pole
  to the South Pole while the globe spins slowly. The horizontal line is the latitude that is playing.

If you drag the globe or turn it with the arrow keys, the audio pauses and you hear whatever is under the line (for the
ocean, the center cell: warm water = high note, land = dull thud). It needs the online version or the local server,
plus WebGL. Otherwise the flat map is shown.

### Track 7 · Echoes of Tomorrow (listening to possible futures)

This track compares measured temperature with two climate scenarios. They are always labeled as **projections, not
predictions** (in the voice, subtitles, legend and panel). There are three modes, selected with the "Future" buttons
in the panel, the `F` key, or the voice commands "two futures", "low future" and "high future":

- **Two Futures:** with headphones, low emissions play in the left ear and high emissions in the right. In mono you
  can still tell them apart by timbre, pitch and the alarm hits.
- **Low emissions** (SSP1-2.6) or **High emissions** (SSP5-8.5) on their own.

Data is in `js/datos-futuro.js`. The IPCC AR6 Table SPM.1 values (2021–2040, 2041–2060, 2081–2100, with their "very
likely" range) are placed at the middle year of each period and converted to the GISTEMP baseline (1951–1980). The
1850–1900 baseline is approximated with GISTEMP 1880–1900, ≈ −0.22 °C. The points are then joined with straight lines
starting from the average of the last 5 measured years, so the in-between years are an approximation. The music is in
`futureScore` in `js/jukebox-musica.js`. The track, its subtitles and the chart (measured stripes + projected lines
and ranges) are in the "Pista 7" section of `js/jukebox.js`.
Planned for a second version: choosing a region (NASA NEX-GDDP-CMIP6) and sea level (NASA Sea Level Projection Tool).

Tracks 5 and 6 are computed by reading the pixels of the images (`assets/eic/luces-nocturnas-cambio.jpg` and
`rayos-iss-2023.jpg`) as a 48 × 12 grid (lights: luminance > 0.06, purple = new, orange = gone dark; lightning:
saturated yellow pixels).

**Team:** the "Why we made it" section and the team are below the cover of `index.html`. Names, roles and photos are
edited in the `equipo` section at the end of `js/recorrido.js` (photos can go in `assets/equipo/`).

The audio files are created by `herramientas/generar-audios.ps1` (PowerShell + C#, nothing to install) from the data
in `js/datos-nasa.js`. To regenerate them, for example after updating the data:

```
powershell -ExecutionPolicy Bypass -File herramientas\generar-audios.ps1
```

The script also writes `js/jukebox-tiempos.js`, with the timings the page uses to sync the chart and subtitles.
Each track's text is in `js/jukebox.js`.

The Jukebox works even if you open `jukebox.html` by double-clicking it (but it can't read pixels that way).

### Music and instruments

**Stereo:** each melody note and each signal (heat alarm, heartbeats, threshold bells, lightning hits, thunder) plays
in its own position, from left to right:

| Track | Left → right |
| --- | --- |
| 1 · Temperature, 2 · Ice, 4 · CO₂ | Time: the first year on the left, the last on the right (for CO₂, the background tone also travels) |
| 3 · Ocean | Longitude: each row plays in 6 segments from west to east |
| 5 · Lights, 6 · Lightning | Longitude: the line that sweeps the map from west to east |

Chords, bass, wind and hums stay in the center. Panning never goes past 80 % to one side (nobody misses a note when
listening with one ear), and pitch and volume carry the same information, so nothing is lost in mono. Each side has
its own reverb so the echo doesn't pull the note back to the center. Measured on the full mix, the start of the
temperature track is about 9 dB louder on the left and the end about 9 dB louder on the right. You notice it with
headphones; with a single speaker, hardly at all. Code: the "Estéreo" section and the `pan` of each note in
`js/jukebox-musica.js`. The backup WAV files in `assets/audio/` are still unpanned.

The Jukebox no longer plays those WAV files directly: `js/jukebox-musica.js` synthesizes each track in the browser
as a four-layer piece that follows the same data → note rules:

- **Melody** (the data), in a seven-note scale that adjusts to the chords on the strong beats.
- **Chords:** a gentle progression (I–vi–IV–V in major, i–VI–III–VII in minor). Track 1 switches to minor above +0.5 °C.
- **Bass:** the root of each chord.
- **Ambience and signals:** wind, waves, heartbeats, thunder, the heat alarm and the CO₂ threshold bells.

In the right column, **Instruments** lets you play the melody on harp, piano, marimba, strings, flute, bells, soft
tone or drums (key `M`) and turn layers off. "Download" saves what you are hearing. If synthesis fails, the WAV files
in `assets/audio/` are used instead. The generator also exports the lights and lightning grids (`gridNeu`, `gridOff`,
`grid`) that the engine uses to `js/jukebox-tiempos.js`.

### A jukebox for blind and low-vision people

The jukebox exists so that NASA data, which is usually told through images, can be **heard**. That's why you can do
everything without seeing the screen:

- **Voice welcome:** on the cover page, next to "Start", there is "Go to the Jukebox" (key `J`). When you press it,
  the voice says "Hello, welcome to our jukebox, a project created by Asteya for the NASA Space Apps Challenge" and
  explains the basic keys; when it finishes, the Jukebox opens (pressing it again goes in without waiting). The welcome
  is spoken on the cover page because browsers only allow speech after a click or keypress, and that permission is lost
  when you change pages. If you open `jukebox.html` directly, it tries to give the welcome on load; if the browser
  doesn't allow it, the first keypress triggers it.
- **Voice guide** (button at the top of the page or key `V`): uses the browser's voice (Web Speech API) to read each
  track's explanation before it plays and the subtitles while it plays, lowering the music while it speaks. The
  setting is remembered between visits. With a screen reader it's best to leave it off: the subtitles are announced
  on their own (`aria-live`).
- **Voice commands** (button at the top of the page or key `O`): you can control the jukebox by speaking, using the
  browser's speech recognition (Web Speech API). Commands (spoken in Spanish): "track three" (or "the ice one",
  "lightning"…), "play", "pause", "next", "previous", "what's playing", "next / previous data point", "explain",
  "from the beginning", "faster / slower", "instrument" (or its name: "piano"), "help" and "turn off commands".
  Works in Chrome and Edge, with a microphone and internet; in other browsers the button doesn't appear and the
  keyboard still works the same. While the guide is speaking, only "pause" is accepted, so the microphone doesn't
  mistake the page's voice for a command; with speakers and a screen reader, headphones are recommended. Code: the
  "Órdenes por voz" section of `js/jukebox.js`.
- **Controller vibration** (button at the top of the page or key `T`): with an Xbox or PlayStation controller
  connected (USB works best; you have to press a button for the browser to detect it), the controller vibrates with
  the same data you hear. Each track has its own rule, shown under "What you feel on the controller" and explained by
  the voice guide before the track starts:

  | Track | Vibration |
  | --- | --- |
  | 1 · Temperature | One pulse per year, stronger the warmer it is; double pulse above +0.5 °C and a tingle above +0.8 °C |
  | 2 · Ice | One buzz per year, longer the more ice there is |
  | 3 · Ocean | One vibration per strip: warm water strong, cold water soft, land none |
  | 4 · CO₂ | One heartbeat per year, getting stronger; a long vibration when crossing 350, 400 and 420 ppm |
  | 5 · Lights | New lights = three light taps (high-frequency motor); lights gone dark = long buzz (low-frequency motor) |
  | 6 · Lightning | One hit per area with lightning; a long shake (thunder) where there's a lot of it |

  To keep sound and vibration from clashing: the vibration is timed with the audio's own clock (the same one used by
  the chart and subtitles), so it lands on its note and stops when you pause, skip or change track; each new pattern
  cuts off the previous one; strength is capped at 80 % so the controller's buzz doesn't drown out the music, and it
  drops further while the voice guide is speaking. With `,` and `.` while paused you feel a single data point.
  Strengths are rounded to 4 levels, which is what a hand can tell apart. Works in Chrome and Edge (Firefox doesn't
  vibrate the controller). Code: `js/jukebox-vibracion.js` (the controller) and the "Vibración del control" section
  of `js/jukebox.js` (the rules).
- **Controller buttons:** the whole jukebox can be operated with the controller. Buttons are mapped by position, not
  by letter (the Xbox "X" is on the left; the PlayStation ✕ is on the bottom):

  | Button | Action |
  | --- | --- |
  | Bottom (A / ✕) | Play or pause |
  | Right (B / ○) | What's playing now? |
  | Left (X / □) | Repeat the track explanation |
  | Top (Y / △) | Say what each button does |
  | D-pad ← → | Previous / next track |
  | D-pad ↑ ↓ | Next / previous data point |
  | Left / right trigger | Slower / faster |
  | Right bumper | Change instrument |
  | Menu / Options | Turn vibration on or off |
  | View / Create | Go back to the beginning |

  The button you press so the browser detects the controller doesn't trigger any action. Browsers don't count
  controller buttons as "interacting with the page": if audio won't play, just press the space bar once or click (for
  a demo, Chrome can be launched with `--autoplay-policy=no-user-gesture-required`). Code: the "Botones del control"
  section of `js/jukebox.js`.
- **`D`** / "What's playing now?" button: says the track, the minute and the data point that's playing (year and
  value, latitude…).
- **`,` and `.`** / "Previous / next data point" buttons: jump one data point and, while paused, play just that bit.
- **`1`–`6`** or **`←` `→`** change track, **`I`** repeats the explanation, **`Home`** goes back to the beginning,
  **`H`** opens help.
- The chart has a text summary (first value, last value and maximum), and the slider announces the time and the data
  point, not a number from 0 to 1000.

## Guided tour (`index.html`)

| Chapter | Status | Content |
| --- | --- | --- |
| 1 · The planet is warming | ✅ prototype | Global temperature 1880 → 2025 (GISTEMP v4), one note per year, subtitles and "Hear the difference" (1880 vs. the hottest year) |
| 2 · The ice is disappearing | ✅ prototype | September Arctic sea ice 1979 → today (NSIDC Sea Ice Index): one bell chord per year, more ice = more notes. The real NASA image (SVS 3998) shifts from 1979 to 2012 according to each year's ice. "Hear the difference": 1979 vs. the record low |
| 3 · The ocean moves heat | ✅ prototype | Guided journey along the Gulf Stream over NASA's real ocean-currents map (SVS 3912): warm water = high note. Then free exploration with your finger, the mouse or the arrow keys (dull thud = land). "Hear the difference": Gulf of Mexico vs. Norway |
| 4 · The cause | ✅ prototype | Mauna Loa CO₂ month by month, 1958 → today (NOAA, the series NASA uses): a continuous tone that rises with CO₂; you can hear the yearly swing of plants ("the Earth breathing") and the underlying rise. Background image NASA SVS 5196. "Hear the difference": a full year in 1959 vs. the latest full year |
| 5 · The night lights are changing | ✅ prototype | Night-lights map 2012 → 2023 (SVS 5313) with the `05-luces.wav` audio: a line sweeps the map from west to east, bells = new lights, low tone = lights gone dark. "Hear the difference": Europe vs. India and China |
| 6 · Lightning seen from space | ✅ prototype | Lightning detected from the ISS (SVS 5011) with the `06-rayos.wav` audio: a drum per area with lightning, thunder where there's a lot. "Hear the difference": Indian Ocean vs. Central Africa |
| Closing | ✅ prototype | "What you just heard isn't made-up music": a summary of the 6 chapters with figures computed from the data, replay any chapter, share, start over and enter the Jukebox |

Subtitles are computed from the data (for example, the first year above +0.5 °C, the first year with less than
4.5 million km² of ice, the records), so they update on their own if the data files change.
The code is in `js/recorrido.js`, split into sections, each with a separator: `recorrido` (chapter 1 and navigation),
`cap2-hielo`, `cap3-oceano`, `cap4-co2` (chapter 4 and closing), `cap56-mapas` (chapters 5 and 6, which reuse the
collection's audio and the timings from `js/jukebox-tiempos.js`) and `equipo`. Styles are in `css/recorrido.css`.

The data for all chapters is in `js/datos-nasa.js`, also split into sections (`gistemp`, `hielo-datos`,
`oceano-datos`, `co2-datos`).

Chapter 4 data (section `co2-datos`): monthly CO₂ from the Mauna Loa Observatory
([NOAA GML](https://gml.noaa.gov/ccgg/trends/), `average` column of `co2_mm_mlo.csv`), the same series used by
[NASA's CO₂ indicator](https://science.nasa.gov/earth/explore/earth-indicators/carbon-dioxide/).
Sound: 310 ppm = 110 Hz, and one octave higher every 55 ppm; one month every 40 ms (≈ 33 s in total).

Chapter 2 data (section `hielo-datos`): September extent from the
[NSIDC Sea Ice Index](https://nsidc.org/data/g02135) (v3), taken from the NOAA PSL copy (`n_iceextent.mon.data`)
because the NSIDC server wasn't responding. Images: `assets/eic/hielo-1979.jpg` and `hielo-2012.jpg` from
[NASA SVS 3998](https://svs.gsfc.nasa.gov/3998) (public domain, same framing).

Chapter 3 data (section `oceano-datos`): a 72 × 36 grid (5° cells) with a sea-temperature index from 0 (cold) to
1 (warm), extracted from the colors of `assets/eic/corrientes-oceanicas.jpg` (NASA SVS 3912) with
`herramientas/extraer-oceano.ps1`. For each cell, the script averages the hue of the colored pixels (blue = 0,
red = 1) and ignores the gray of land and the black background. It's a reading of the color palette, not exact
degrees. Because it's precomputed, the chapter works even if you open `index.html` by double-clicking it. The figure
"about 90 % of the extra heat" comes from
[NASA · Ocean Warming](https://science.nasa.gov/earth/explore/earth-indicators/ocean-warming/).

## How to run it

**Online (easiest):** open https://gezzy-art.github.io/Asteya-2.0-earth-jukebox-/ in Chrome or Edge. Everything works,
including reading NASA images.

**On your computer:** download the project (**Code → Download ZIP** on GitHub), unzip it and double-click
`iniciar-servidor.bat`. It opens the app at `http://localhost:8080` using a local server written in PowerShell
(nothing to install). The VS Code **Live Server** extension also works.

**Opening the `.html` files by double-clicking:** the guided tour and the Jukebox work the same, since all the data
is precomputed.

An internet connection is needed to load Tailwind CSS, Tone.js and the fonts from a CDN.

## Earth Information Center visualizations

Local copies are in `assets/eic/` (NASA Scientific Visualization Studio, public domain).

| Use | File | Source |
| --- | --- | --- |
| Temperature | `temperatura-2025.png` | [SVS 5603](https://svs.gsfc.nasa.gov/5603) · Global temperature change 2025 vs. 1951–1980, GISTEMP v4 (NASA GISS) |
| Ice | `hielo-1979.jpg`, `hielo-2012.jpg` | [SVS 3998](https://svs.gsfc.nasa.gov/3998) · September Arctic sea ice |
| Ocean | `corrientes-oceanicas.jpg` (+ `.webm`) | [SVS 3912](https://svs.gsfc.nasa.gov/3912) · Surface currents colored by sea temperature, ECCO2 model (MIT/JPL) |
| CO₂ | `co2-dyamond.jpg` | [SVS 5196](https://svs.gsfc.nasa.gov/5196) · Global CO₂, January 2020, GEOS model (DYAMOND) |
| Night lights | `luces-nocturnas-cambio.jpg` | [SVS 5313](https://svs.gsfc.nasa.gov/5313) · Change in nighttime lighting 2012 → 2023, VIIRS Black Marble |
| Lightning | `rayos-iss-2023.jpg` | [SVS 5011](https://svs.gsfc.nasa.gov/5011) · Lightning detected by the LIS instrument on the ISS (one frame from the yearly animation) |

## Structure

```
iniciar-servidor.bat / servidor.ps1   Local server to open the app with real data
assets/eic/       EIC visualizations (NASA SVS)
index.html        Guided tour (first screen): cover, team and 6 chapters
jukebox.html      Jukebox: player for the audio collection
assets/audio/     The 6 original audio files (generated with herramientas/generar-audios.ps1)
css/jukebox.css   Jukebox styles
js/jukebox.js     Jukebox: tracks, subtitles, synced chart and controls
js/jukebox-tiempos.js  Timings for each audio file (generated)
js/jukebox-vibracion.js  Xbox or PlayStation controller vibration (Gamepad API)
js/jukebox-imagen.js  Listen to a NASA image: pixel reading and real-time synthesis (Web Audio)
css/styles.css    Space theme, glassmorphism and control states
css/recorrido.css Guided tour styles
js/recorrido.js   Guided tour: navigation, the 6 chapters and the team (one section per chapter)
js/datos-nasa.js  Data: GISTEMP v4, Arctic sea ice, ocean grid and Mauna Loa CO₂
js/data.js        Constants, tracks (procedural fields and palettes), instruments, scales and shared state
js/audio.js       Tone.js engine for the guided tour: audio graph and instruments
```

All modules share the global namespace `window.EIJ`. The order of the `<script>` tags matters:
- `jukebox.html`: `datos-nasa → jukebox-tiempos → jukebox-musica → jukebox-vibracion → jukebox → jukebox-imagen`
- `index.html`: `data → datos-nasa → audio → jukebox-tiempos → recorrido`

## Temperature year by year (chapter 1 of the tour)

Sonifies the annual global temperature anomaly (°C relative to 1951–1980) from
[NASA GISS GISTEMP v4](https://data.giss.nasa.gov/gistemp/) (J-D column of `GLB.Ts+dSST.csv`, complete years only).
The values are in the `gistemp` section of `js/datos-nasa.js`, generated from the official file.

| Data | Sound |
| --- | --- |
| Year's anomaly | Note pitch and filter opening (from −0.6 °C to +1.4 °C) |
| Anomaly > +0.5 °C | The harmony switches from Major Pentatonic to Natural Minor |
| Anomaly > +0.8 °C | The hi-hat comes in (double hit above +1.1 °C) |
| How hot the year is | Time moves faster: from ~380 ms to ~190 ms per year |

It's shown as "warming stripes" (one color per year) that appear in time with the audio, with subtitles computed from
the data. Code in `js/recorrido.js` and `audio.yearNote` in `js/audio.js`.

### Jump to any chapter (tour)

Each chapter's progress dots are numbered buttons (1–6), plus a "Home" button, so you can jump to any chapter without
going back to the cover. The cover and the closing have the same menu.

## Accessibility

- **Screen reader:** subtitles are in `aria-live` regions and every control has an `aria-label`.
- **Keyboard:** the Jukebox can be operated entirely with shortcuts (see "A jukebox for blind and low-vision people");
  in the tour, the ocean map can be explored with the arrow keys.
- **Voice:** voice guide and voice commands in the Jukebox.
