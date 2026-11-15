# Convierte la imagen de NASA SVS 3912 (corrientes coloreadas por temperatura del mar, mapa
# equirrectangular 2048x1024) en una cuadrícula de 72x36 celdas (5° x 5°) con un índice de
# temperatura 0..1, y la guarda en la sección "oceano-datos" de js/datos-nasa.js.
#
# Paleta de la imagen: azul (frío) → cian → verde → amarillo → naranja → rojo (cálido).
# Para cada celda se toman los píxeles con color (saturados y no oscuros), se convierte su tono
# a temperatura (rojo = 1, azul = 0) y se promedia. Las celdas sin color (tierra gris, hielo,
# fondo negro) quedan como -1 = "no es océano".
#
# Uso (desde la carpeta del proyecto):  powershell -ExecutionPolicy Bypass -File herramientas\extraer-oceano.ps1

Add-Type -AssemblyName System.Drawing
$root = Split-Path $PSScriptRoot -Parent
$src = Join-Path $root 'assets\eic\corrientes-oceanicas.jpg'
$bmp = [System.Drawing.Bitmap]::FromFile($src)
$COLS = 72; $ROWS = 36; $STEP = 3
$cw = $bmp.Width / $COLS; $ch = $bmp.Height / $ROWS

# Copia los píxeles a un arreglo para leerlos rápido
$rect = New-Object System.Drawing.Rectangle 0, 0, $bmp.Width, $bmp.Height
$data = $bmp.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadOnly, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
$stride = $data.Stride
$bytes = New-Object byte[] ($stride * $bmp.Height)
[System.Runtime.InteropServices.Marshal]::Copy($data.Scan0, $bytes, 0, $bytes.Length)
$bmp.UnlockBits($data)

$values = New-Object System.Collections.Generic.List[string]
for ($row = 0; $row -lt $ROWS; $row++) {
  for ($col = 0; $col -lt $COLS; $col++) {
    $sum = 0.0; $n = 0; $total = 0
    for ($y = [int]($row * $ch); $y -lt [int](($row + 1) * $ch); $y += $STEP) {
      for ($x = [int]($col * $cw); $x -lt [int](($col + 1) * $cw); $x += $STEP) {
        $i = $y * $stride + $x * 3
        $b = $bytes[$i] / 255.0; $g = $bytes[$i + 1] / 255.0; $r = $bytes[$i + 2] / 255.0
        $total++
        $max = [Math]::Max($r, [Math]::Max($g, $b)); $min = [Math]::Min($r, [Math]::Min($g, $b))
        if ($max -lt 0.12) { continue }                 # fondo negro entre las líneas de corriente
        $sat = ($max - $min) / $max
        if ($sat -lt 0.35) { continue }                 # gris: tierra o hielo
        $d = $max - $min
        if ($max -eq $r) { $h = ($g - $b) / $d; if ($h -lt 0) { $h += 6 }; $hue = 60 * $h }
        elseif ($max -eq $g) { $hue = 60 * ((($b - $r) / $d) + 2) }
        else { $hue = 60 * ((($r - $g) / $d) + 4) }
        if ($hue -gt 300) { $hue = 0 }                  # rosas/rojos al otro lado del círculo
        # 0.0 y 1.0 (no 0 y 1): con enteros, PowerShell elegiría Math.Min(int, int) y redondearía
        $sum += [Math]::Max(0.0, [Math]::Min(1.0, 1.0 - $hue / 240.0)); $n++
      }
    }
    if ($n -lt [Math]::Max(3, $total * 0.05)) { $values.Add('-1') }
    else { $values.Add(([Math]::Round($sum / $n, 2)).ToString([Globalization.CultureInfo]::InvariantCulture)) }
  }
}
$bmp.Dispose()

$today = Get-Date -Format 'yyyy-MM-dd'
$js = @"
/* Índice de temperatura del mar 0..1 (0 = frío, 1 = cálido) en una cuadrícula de $COLS x $ROWS celdas de 5°,
 * de norte (90°N) a sur y de oeste (180°O) a este. -1 = no es océano (tierra, hielo).
 * Extraído del color de la imagen de NASA SVS 3912 (modelo ECCO2, MIT/JPL) con herramientas/extraer-oceano.ps1
 * el $today. Es una lectura de la paleta de colores, no la temperatura medida en °C. */
(function () {
  'use strict';
  window.EIJ.OCEAN = {
    cols: $COLS,
    rows: $ROWS,
    source: 'NASA SVS 3912 · modelo ECCO2 (MIT/JPL)',
    url: 'https://svs.gsfc.nasa.gov/3912',
    grid: [$($values -join ',')]
  };
})();
"@
# Reemplaza solo la sección del océano dentro de js/datos-nasa.js (entre sus separadores)
$dest = Join-Path $root 'js\datos-nasa.js'
$txt = [IO.File]::ReadAllText($dest, [Text.Encoding]::UTF8)
$re = [regex]'(?s)(   oceano-datos\r?\n   =+ \*/\r?\n).*?(\r?\n\r?\n/\* =+\r?\n   co2-datos)'
if (-not $re.IsMatch($txt)) { throw "No encontré la sección 'oceano-datos' en js\datos-nasa.js" }
$nuevo = $js.Trim()
$txt = $re.Replace($txt, [Text.RegularExpressions.MatchEvaluator]{ param($m) $m.Groups[1].Value + $nuevo + $m.Groups[2].Value }, 1)
[IO.File]::WriteAllText($dest, $txt, (New-Object Text.UTF8Encoding $false))
$ocean = ($values | Where-Object { $_ -ne '-1' }).Count
"Listo: $ocean de $($values.Count) celdas son océano."
