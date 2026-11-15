# Genera los 4 audios originales de Earth Jukebox a partir de los datos reales del proyecto.
# No necesita instalar nada: usa PowerShell y C# incluidos en Windows.
#
#   powershell -ExecutionPolicy Bypass -File herramientas\generar-audios.ps1
#
# Lee js\datos-nasa.js (temperatura, hielo, océano y CO2)
# Escribe assets\audio\*.wav y js\jukebox-tiempos.js (los tiempos que usa la página
# para mover la línea y los subtítulos al ritmo del audio).
param()
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent

function Read-Array([string]$file, [string]$key) {
  $txt = [IO.File]::ReadAllText((Join-Path $root $file))
  $m = [regex]::Match($txt, "$key\s*:\s*\[([^\]]*)\]")
  if (-not $m.Success) { throw "No encontré '$key' en $file" }
  return [double[]]($m.Groups[1].Value -split ',' | ForEach-Object { [double]::Parse($_.Trim(), [Globalization.CultureInfo]::InvariantCulture) })
}

$temp  = Read-Array 'js\datos-nasa.js' 'anomalies'
$ice   = Read-Array 'js\datos-nasa.js' 'extent'
$ocean = Read-Array 'js\datos-nasa.js' 'grid'
$co2   = Read-Array 'js\datos-nasa.js' 'ppm'

Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System;
using System.IO;
using System.Text;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

// Cuenta píxeles de un mapa equirrectangular en una cuadrícula columnas x bandas de latitud.
// tipo 0 = luces nuevas (moradas), 1 = luces apagadas (naranjas), 2 = destellos de rayo (amarillos).
// Mismos criterios que el detector del Laboratorio (js/laboratorio.js, currentFeatures).
public static class Mapa {
  public static int[] Contar(string path, int cols, int bands) {
    var res = new int[cols * bands * 3];
    using (var bmp = new Bitmap(path)) {
      int W = bmp.Width, H = bmp.Height;
      var data = bmp.LockBits(new Rectangle(0, 0, W, H), ImageLockMode.ReadOnly, PixelFormat.Format24bppRgb);
      byte[] px = new byte[data.Stride * H];
      Marshal.Copy(data.Scan0, px, 0, px.Length);
      bmp.UnlockBits(data);
      for (int y = 0; y < H; y++) {
        int band = Math.Min(bands - 1, y * bands / H);
        for (int x = 0; x < W; x++) {
          int i = y * data.Stride + x * 3;
          int b = px[i], g = px[i + 1], r = px[i + 2];
          int col = Math.Min(cols - 1, x * cols / W), k = (col * bands + band) * 3;
          double lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255.0;
          if ((r + g) / 2.0 - b > 30 && r > 70 && g > 55) res[k + 2]++;
          if (lum > 0.06) { if (b > r + 4) res[k]++; else if (r > b + 6) res[k + 1]++; }
        }
      }
    }
    return res;
  }
}

public static class Synth {
  public const int SR = 22050;
  static Random rng = new Random(7);

  public static double Mtof(double m) { return 440.0 * Math.Pow(2.0, (m - 69.0) / 12.0); }
  static double Clamp(double v, double a, double b) { return v < a ? a : v > b ? b : v; }

  // Nota de una escala: k pasos por encima de la tónica
  public static double ScaleMidi(int root, int[] scale, int k) {
    int o = k / scale.Length, s = k % scale.Length;
    return root + 12 * o + scale[s];
  }

  // Cuerda pulsada (Karplus-Strong): suena a arpa
  public static void Pluck(float[] b, double t, double freq, double amp, double dur) {
    int start = (int)(t * SR), N = Math.Max(2, (int)Math.Round(SR / freq));
    double[] d = new double[N];
    double prev = 0;
    for (int i = 0; i < N; i++) { double w = rng.NextDouble() * 2 - 1; prev = 0.5 * prev + 0.5 * w; d[i] = prev; }
    double loss = Math.Pow(0.001, 1.0 / (freq * dur));
    int len = (int)(dur * SR), idx = 0;
    for (int i = 0; i < len && start + i < b.Length; i++) {
      int j = (idx + 1) % N;
      double v = d[idx];
      d[idx] = 0.5 * (d[idx] + d[j]) * loss;
      idx = j;
      double fade = i > len - 600 ? (len - i) / 600.0 : 1;
      b[start + i] += (float)(v * amp * fade);
    }
  }

  // Campana de cristal: parciales inarmónicos que se apagan
  public static void Bell(float[] b, double t, double freq, double amp, double dur) {
    double[] ratio = { 1, 2.01, 3.0, 4.23, 5.41 };
    double[] gain = { 1, 0.45, 0.22, 0.12, 0.06 };
    int start = (int)(t * SR), len = (int)(dur * SR);
    for (int i = 0; i < len && start + i < b.Length; i++) {
      double tt = (double)i / SR, s = 0;
      for (int p = 0; p < ratio.Length; p++) {
        double f = freq * ratio[p];
        if (f > SR / 2.2) continue;
        s += gain[p] * Math.Exp(-tt * (2.5 + 2.2 * p) / dur) * Math.Sin(2 * Math.PI * f * tt);
      }
      double att = Math.Min(1, tt / 0.004);
      b[start + i] += (float)(s * amp * att);
    }
  }

  // Tono suave con ataque y caída (agua, pads)
  public static void Soft(float[] b, double t, double freq, double amp, double dur, double attack) {
    int start = (int)(t * SR), len = (int)(dur * SR);
    for (int i = 0; i < len && start + i < b.Length; i++) {
      double tt = (double)i / SR;
      double env = Math.Min(1, tt / attack) * Math.Exp(-3.0 * tt / dur);
      double s = Math.Sin(2 * Math.PI * freq * tt) + 0.25 * Math.Sin(4 * Math.PI * freq * tt) + 0.08 * Math.Sin(6 * Math.PI * freq * tt);
      b[start + i] += (float)(s * amp * env);
    }
  }

  // Golpe grave (pulso de corazón)
  public static void Thump(float[] b, double t, double amp) {
    int start = (int)(t * SR), len = (int)(0.25 * SR);
    for (int i = 0; i < len && start + i < b.Length; i++) {
      double tt = (double)i / SR;
      double f = 48 + 60 * Math.Exp(-tt * 30);
      b[start + i] += (float)(Math.Sin(2 * Math.PI * f * tt) * Math.Exp(-tt * 14) * amp);
    }
  }

  // Tambor afinado (tono que cae rápido)
  public static void Drum(float[] b, double t, double freq, double amp) {
    int start = (int)(t * SR), len = (int)(0.3 * SR);
    double phase = 0;
    for (int i = 0; i < len && start + i < b.Length; i++) {
      double tt = (double)i / SR, f = freq * (1 + 1.2 * Math.Exp(-tt * 40));
      phase += 2 * Math.PI * f / SR;
      b[start + i] += (float)(Math.Sin(phase) * Math.Exp(-tt * 11) * amp);
    }
  }

  // Trueno: ruido grave que retumba y se apaga despacio
  public static void Thunder(float[] b, double t, double amp) {
    int start = (int)(t * SR), len = (int)(1.8 * SR);
    double y1 = 0, y2 = 0, a = Math.Exp(-2 * Math.PI * 160.0 / SR);
    for (int i = 0; i < len && start + i < b.Length; i++) {
      double tt = (double)i / SR;
      y1 = (1 - a) * (rng.NextDouble() * 2 - 1) + a * y1;
      y2 = (1 - a) * y1 + a * y2;
      double env = Math.Min(1, tt / 0.03) * Math.Exp(-tt * 2.2) * (0.7 + 0.3 * Math.Sin(tt * 23));
      b[start + i] += (float)(y2 * env * amp * 9);
    }
  }

  // Chasquido de ruido (percusión)
  public static void Tick(float[] b, double t, double amp) {
    int start = (int)(t * SR), len = (int)(0.06 * SR);
    double last = 0;
    for (int i = 0; i < len && start + i < b.Length; i++) {
      double w = rng.NextDouble() * 2 - 1, hp = w - last; last = w;
      b[start + i] += (float)(hp * Math.Exp(-(double)i / SR * 70) * amp);
    }
  }

  // Bordón continuo: gain[] da el volumen en cada segundo (se interpola)
  public static void Drone(float[] b, double freq, double[] gainPerSec) {
    for (int i = 0; i < b.Length; i++) {
      double sec = (double)i / SR, g = Interp(gainPerSec, sec);
      double s = Math.Sin(2 * Math.PI * freq * sec) + 0.5 * Math.Sin(2 * Math.PI * freq * 1.5 * sec + 0.3) * 0.6
               + 0.15 * Math.Sin(2 * Math.PI * freq * 2 * sec);
      b[i] += (float)(s * g);
    }
  }

  // Viento / olas: ruido filtrado, volumen por segundo
  public static void Wind(float[] b, double[] gainPerSec, double cutoff, double lfoHz) {
    double y = 0, a = Math.Exp(-2 * Math.PI * cutoff / SR);
    for (int i = 0; i < b.Length; i++) {
      double sec = (double)i / SR;
      y = (1 - a) * (rng.NextDouble() * 2 - 1) + a * y;
      double lfo = lfoHz > 0 ? 0.6 + 0.4 * Math.Sin(2 * Math.PI * lfoHz * sec) : 1;
      b[i] += (float)(y * Interp(gainPerSec, sec) * lfo * 4);
    }
  }

  // Tono que se desliza siguiendo una serie (CO2): freq[] y bright[] por muestra de control
  public static void Glide(float[] b, double t0, double stepSec, double[] freq, double[] bright, double amp) {
    double phase = 0;
    int start = (int)(t0 * SR), end = (int)((t0 + stepSec * (freq.Length - 1)) * SR) + SR * 2;
    for (int i = start; i < end && i < b.Length; i++) {
      double pos = ((double)(i - start) / SR) / stepSec;
      double f = InterpIdx(freq, pos), br = InterpIdx(bright, pos);
      phase += 2 * Math.PI * f / SR;
      double s = 0;
      for (int k = 1; k <= 8; k++) { if (f * k > SR / 2.2) break; s += Math.Sin(phase * k) * Math.Pow(0.2 + 0.7 * br, k - 1) / k; }
      double env = Math.Min(1, (i - start) / (0.5 * SR)) * Math.Min(1, (end - i) / (1.5 * SR));
      b[i] += (float)(s * amp * env);
    }
  }

  static double InterpIdx(double[] arr, double pos) {
    if (pos <= 0) return arr[0];
    if (pos >= arr.Length - 1) return arr[arr.Length - 1];
    int k = (int)pos; double f = pos - k;
    return arr[k] * (1 - f) + arr[k + 1] * f;
  }
  static double Interp(double[] perSec, double sec) { return InterpIdx(perSec, sec); }

  // Reverberación tipo Schroeder (espacio)
  public static float[] Reverb(float[] dry, double wet) {
    int[] comb = { 1116, 1188, 1277, 1356, 1422, 1491 };
    int[] ap = { 225, 341, 441 };
    double scale = SR / 44100.0;
    float[] outp = new float[dry.Length];
    double[] sum = new double[dry.Length];
    foreach (int c0 in comb) {
      int c = (int)(c0 * scale); double[] line = new double[c]; int p = 0; double lp = 0;
      for (int i = 0; i < dry.Length; i++) {
        double y = line[p]; lp = y * 0.6 + lp * 0.4;
        line[p] = dry[i] + lp * 0.82; p = (p + 1) % c; sum[i] += y;
      }
    }
    foreach (int a0 in ap) {
      int c = (int)(a0 * scale); double[] line = new double[c]; int p = 0;
      for (int i = 0; i < dry.Length; i++) {
        double bufv = line[p], x = sum[i];
        double y = -x + bufv; line[p] = x + bufv * 0.5; p = (p + 1) % c; sum[i] = y;
      }
    }
    for (int i = 0; i < dry.Length; i++) outp[i] = (float)(dry[i] * (1 - wet) + sum[i] / comb.Length * wet * 1.6);
    return outp;
  }

  // Normaliza, suaviza el principio y el final y guarda WAV mono de 16 bits
  public static void Save(float[] b, string path) {
    double peak = 1e-9;
    foreach (float v in b) peak = Math.Max(peak, Math.Abs(v));
    double g = 0.89 / peak;
    int fadeIn = SR / 50, fadeOut = SR;
    using (var fs = new FileStream(path, FileMode.Create))
    using (var w = new BinaryWriter(fs)) {
      int dataLen = b.Length * 2;
      w.Write(Encoding.ASCII.GetBytes("RIFF")); w.Write(36 + dataLen); w.Write(Encoding.ASCII.GetBytes("WAVE"));
      w.Write(Encoding.ASCII.GetBytes("fmt ")); w.Write(16); w.Write((short)1); w.Write((short)1);
      w.Write(SR); w.Write(SR * 2); w.Write((short)2); w.Write((short)16);
      w.Write(Encoding.ASCII.GetBytes("data")); w.Write(dataLen);
      for (int i = 0; i < b.Length; i++) {
        double e = 1;
        if (i < fadeIn) e = (double)i / fadeIn;
        if (i > b.Length - fadeOut) e = (double)(b.Length - i) / fadeOut;
        double v = Math.Tanh(b[i] * g * 1.1) * e;   // limitador suave
        w.Write((short)Math.Round(Clamp(v, -1, 1) * 32000));
      }
    }
  }
}
'@

$SR = [Synth]::SR
$PENTA_MAJ = [int[]](0, 2, 4, 7, 9)
$PENTA_MIN = [int[]](0, 3, 5, 7, 10)
$outDir = Join-Path $root 'assets\audio'
New-Item -ItemType Directory -Force $outDir | Out-Null
$tiempos = [ordered]@{}

function Clamp($v, $a, $b) { [Math]::Max($a, [Math]::Min($b, $v)) }
function New-Buffer([double]$sec) { New-Object 'float[]' ([int]($sec * $SR)) }

# ---------- 1 · El planeta se calienta (GISTEMP, un año = una nota de arpa) ----------
$intro = 1.0; $step = 0.32; $n = $temp.Length; $dur = $intro + $n * $step + 4.5
$b = New-Buffer $dur
$droneGain = @(); for ($s = 0; $s -le [int]$dur + 1; $s++) { $droneGain += 0.035 + 0.11 * (Clamp (($s - $intro) / ($n * $step)) 0 1) }
[Synth]::Drone($b, [Synth]::Mtof(38), [double[]]$droneGain)
for ($i = 0; $i -lt $n; $i++) {
  $a = $temp[$i]; $t = $intro + $i * $step
  $u = Clamp (($a + 0.55) / 1.85) 0 1
  $scale = if ($a -gt 0.5) { $PENTA_MIN } else { $PENTA_MAJ }
  $midi = [Synth]::ScaleMidi(50, $scale, [int][Math]::Round($u * 12))
  [Synth]::Pluck($b, $t, [Synth]::Mtof($midi), 0.45 + 0.35 * $u, 1.8)
  if ($a -gt 0.8) { [Synth]::Tick($b, $t, 0.12 + 0.2 * ($a - 0.8)); [Synth]::Thump($b, $t, 0.25) }
}
$tEnd = $intro + $n * $step
foreach ($m in 50, 53, 57, 62) { [Synth]::Pluck($b, $tEnd + 0.1, [Synth]::Mtof($m), 0.35, 4) }
[Synth]::Bell($b, $tEnd + 0.1, [Synth]::Mtof(74), 0.12, 4)
[Synth]::Save([Synth]::Reverb($b, 0.3), (Join-Path $outDir '01-temperatura.wav'))
$tiempos.temp = @{ intro = $intro; step = $step; n = $n; dur = [Math]::Round($dur, 2) }
Write-Host "01-temperatura.wav  $([Math]::Round($dur,1)) s"

# ---------- 2 · El hielo desaparece (hielo de septiembre: menos hielo = menos campanas) ----------
$intro = 1.0; $step = 0.7; $n = $ice.Length; $dur = $intro + $n * $step + 4.5
$b = New-Buffer $dur
$wind = @(); for ($s = 0; $s -le [int]$dur + 1; $s++) {
  $k = [int](Clamp ([Math]::Floor(($s - $intro) / $step)) 0 ($n - 1))
  $wind += 0.01 + 0.06 * (Clamp ((7.6 - $ice[$k]) / 4.0) 0 1)
}
[Synth]::Wind($b, [double[]]$wind, 500, 0.15)
for ($i = 0; $i -lt $n; $i++) {
  $e = $ice[$i]; $t = $intro + $i * $step
  $notes = [int](Clamp ([Math]::Round(1 + ($e - 3.5) / (7.7 - 3.5) * 6)) 1 7)
  for ($j = 0; $j -lt $notes; $j++) {
    [Synth]::Bell($b, $t + $j * 0.07, [Synth]::Mtof([Synth]::ScaleMidi(69, $PENTA_MAJ, $j)), 0.2 * ($e / 7.7), 1.6)
  }
  [Synth]::Soft($b, $t, [Synth]::Mtof(45), 0.10 * ($e / 7.7), 0.9, 0.05)
}
[Synth]::Bell($b, $intro + $n * $step + 0.2, [Synth]::Mtof(81), 0.12, 4)
[Synth]::Save([Synth]::Reverb($b, 0.38), (Join-Path $outDir '02-hielo.wav'))
$tiempos.ice = @{ intro = $intro; step = $step; n = $n; dur = [Math]::Round($dur, 2) }
Write-Host "02-hielo.wav        $([Math]::Round($dur,1)) s"

# ---------- 3 · El océano mueve el calor (recorrido de norte a sur, una fila = 5° de latitud) ----------
$intro = 1.0; $step = 1.0; $rows = 36; $cols = 72; $per = 12; $dur = $intro + $rows * $step + 3.5
$b = New-Buffer $dur
$waves = @(); for ($s = 0; $s -le [int]$dur + 1; $s++) { $waves += 0.035 }
[Synth]::Wind($b, [double[]]$waves, 350, 0.12)
for ($r = 0; $r -lt $rows; $r++) {
  for ($g = 0; $g -lt $per; $g++) {
    $sum = 0; $cnt = 0
    for ($c = $g * 6; $c -lt $g * 6 + 6; $c++) { $v = $ocean[$r * $cols + $c]; if ($v -ge 0) { $sum += $v; $cnt++ } }
    if ($cnt -lt 2) { continue }
    $v = $sum / $cnt; $t = $intro + $r * $step + $g * ($step / $per)
    $midi = [Synth]::ScaleMidi(45, $PENTA_MAJ, [int][Math]::Round($v * 14))
    [Synth]::Soft($b, $t, [Synth]::Mtof($midi), 0.16 * ($cnt / 6), 0.55, 0.025)
  }
}
[Synth]::Soft($b, $intro + $rows * $step + 0.1, [Synth]::Mtof(45), 0.25, 3.0, 0.3)
[Synth]::Save([Synth]::Reverb($b, 0.4), (Join-Path $outDir '03-oceano.wav'))
$tiempos.ocean = @{ intro = $intro; step = $step; n = $rows; dur = [Math]::Round($dur, 2) }
Write-Host "03-oceano.wav       $([Math]::Round($dur,1)) s"

# ---------- 4 · La causa: el aire que cambia (CO2 mes a mes: el tono sube con las ppm) ----------
$intro = 1.0; $step = 0.05; $n = $co2.Length; $dur = $intro + $n * $step + 3.5
$b = New-Buffer $dur
$freq = New-Object 'double[]' $n; $bright = New-Object 'double[]' $n
for ($i = 0; $i -lt $n; $i++) {
  $u = Clamp (($co2[$i] - 310) / 125) 0 1
  $freq[$i] = 110 * [Math]::Pow(2, 2 * $u); $bright[$i] = $u
}
[Synth]::Glide($b, $intro, $step, $freq, $bright, 0.22)
$crossed = @{}
for ($i = 0; $i -lt $n; $i++) {
  $t = $intro + $i * $step
  if ((($i + 2) % 12) -eq 0) { [Synth]::Thump($b, $t, 0.2 + 0.35 * $bright[$i]) }   # cada enero (la serie empieza en marzo)
  foreach ($lim in 350, 400, 420) {
    if (-not $crossed[$lim] -and $co2[$i] -ge $lim) { $crossed[$lim] = $true; [Synth]::Bell($b, $t, [Synth]::Mtof(52), 0.35, 3.5) }
  }
}
[Synth]::Save([Synth]::Reverb($b, 0.28), (Join-Path $outDir '04-co2.wav'))
$tiempos.co2 = @{ intro = $intro; step = $step; n = $n; dur = [Math]::Round($dur, 2) }
Write-Host "04-co2.wav          $([Math]::Round($dur,1)) s"

# ---------- 5 y 6 · Mapas de luces y rayos: una línea recorre el mundo de oeste a este ----------
# 48 columnas de 7.5° de longitud y 12 bandas de 15° de latitud (banda 0 = la más al norte).
$COLS = 48; $BANDS = 12

function Get-Grid([string]$img, [int]$kind) {
  $raw = [Mapa]::Contar((Join-Path $root $img), $COLS, $BANDS)
  $g = New-Object 'double[,]' $COLS, $BANDS; $max = 1
  for ($c = 0; $c -lt $COLS; $c++) { for ($k = 0; $k -lt $BANDS; $k++) { $v = $raw[($c * $BANDS + $k) * 3 + $kind]; $g[$c, $k] = $v; if ($v -gt $max) { $max = $v } } }
  for ($c = 0; $c -lt $COLS; $c++) { for ($k = 0; $k -lt $BANDS; $k++) { $g[$c, $k] = $g[$c, $k] / $max } }
  return ,$g
}
# Cuadrícula completa (columna a columna, 12 bandas cada una) para que la página pueda sintetizar en el navegador
function Grid-Flat($g) { $s = @(); for ($c = 0; $c -lt $COLS; $c++) { for ($k = 0; $k -lt $BANDS; $k++) { $v = $g[$c, $k]; $s += [Math]::Round($v, 3) } }; return ,$s }
function Col-Sums($g) { $s = @(); for ($c = 0; $c -lt $COLS; $c++) { $t = 0; for ($k = 0; $k -lt $BANDS; $k++) { $t += $g[$c, $k] }; $s += [Math]::Round($t, 3) }; return ,$s }

# --- 5 · Luces de la noche 2012 → 2023: morado = luces nuevas (campanas agudas), naranja = apagadas (tono grave)
$neu = Get-Grid 'assets\eic\luces-nocturnas-cambio.jpg' 0
$off = Get-Grid 'assets\eic\luces-nocturnas-cambio.jpg' 1
$intro = 1.0; $step = 0.75; $dur = $intro + $COLS * $step + 4
$b = New-Buffer $dur
$pad = @(); for ($s = 0; $s -le [int]$dur + 1; $s++) { $pad += 0.03 }
[Synth]::Drone($b, [Synth]::Mtof(38), [double[]]$pad)
for ($c = 0; $c -lt $COLS; $c++) {
  $t0 = $intro + $c * $step
  for ($k = 0; $k -lt $BANDS; $k++) {
    $t = $t0 + $k * ($step / $BANDS)
    $vn = $neu[$c, $k]; $vo = $off[$c, $k]
    if ($vn -gt 0.04) { [Synth]::Bell($b, $t, [Synth]::Mtof([Synth]::ScaleMidi(62, $PENTA_MAJ, $BANDS - 1 - $k)), 0.08 + 0.3 * [Math]::Sqrt($vn), 1.4) }
    if ($vo -gt 0.04) { [Synth]::Soft($b, $t, [Synth]::Mtof([Synth]::ScaleMidi(38, $PENTA_MIN, $BANDS - 1 - $k)), 0.1 + 0.4 * [Math]::Sqrt($vo), 0.9, 0.03) }
  }
}
[Synth]::Bell($b, $intro + $COLS * $step + 0.1, [Synth]::Mtof(74), 0.15, 3.5)
[Synth]::Save([Synth]::Reverb($b, 0.35), (Join-Path $outDir '05-luces.wav'))
$tiempos.lights = @{ intro = $intro; step = $step; n = $COLS; dur = [Math]::Round($dur, 2); neu = (Col-Sums $neu); off = (Col-Sums $off); gridNeu = (Grid-Flat $neu); gridOff = (Grid-Flat $off) }
Write-Host "05-luces.wav        $([Math]::Round($dur,1)) s"

# --- 6 · Rayos vistos desde la ISS: cada zona con rayos es un tambor (más al norte = más agudo); muchos = trueno
$fl = Get-Grid 'assets\eic\rayos-iss-2023.jpg' 2
$intro = 1.0; $step = 0.75; $dur = $intro + $COLS * $step + 4
$b = New-Buffer $dur
$rain = @(); for ($s = 0; $s -le [int]$dur + 1; $s++) { $rain += 0.012 }
[Synth]::Wind($b, [double[]]$rain, 2500, 0)
$sums = Col-Sums $fl; $maxSum = ($sums | Measure-Object -Maximum).Maximum
for ($c = 0; $c -lt $COLS; $c++) {
  $t0 = $intro + $c * $step
  for ($k = 0; $k -lt $BANDS; $k++) {
    $v = $fl[$c, $k]
    if ($v -lt 0.04) { continue }
    $t = $t0 + $k * ($step / $BANDS)
    [Synth]::Drum($b, $t, [Synth]::Mtof([Synth]::ScaleMidi(43, $PENTA_MIN, $BANDS - 1 - $k)), 0.25 + 0.5 * [Math]::Sqrt($v))
    [Synth]::Tick($b, $t, 0.08 + 0.25 * $v)
  }
  if ($sums[$c] -gt 0.45 * $maxSum) { [Synth]::Thunder($b, $t0, 0.5 * $sums[$c] / $maxSum) }
}
[Synth]::Thunder($b, $intro + $COLS * $step + 0.2, 0.3)
[Synth]::Save([Synth]::Reverb($b, 0.3), (Join-Path $outDir '06-rayos.wav'))
# Rayos por banda de latitud (de norte a sur), para calcular cuántos caen en los trópicos
$bandSums = @(); for ($k = 0; $k -lt $BANDS; $k++) { $t = 0; for ($c = 0; $c -lt $COLS; $c++) { $t += $fl[$c, $k] }; $bandSums += [Math]::Round($t, 3) }
$tiempos.lightning = @{ intro = $intro; step = $step; n = $COLS; dur = [Math]::Round($dur, 2); flash = $sums; bands = $bandSums; grid = (Grid-Flat $fl) }
Write-Host "06-rayos.wav        $([Math]::Round($dur,1)) s"
Write-Host ("  luces nuevas por columna: " + ((Col-Sums $neu) -join ' '))
Write-Host ("  luces apagadas:           " + ((Col-Sums $off) -join ' '))
Write-Host ("  rayos:                    " + ($sums -join ' '))

# ---------- Tiempos para la página ----------
$json = ($tiempos | ConvertTo-Json -Compress)
$js = "/* Generado por herramientas/generar-audios.ps1: no editar a mano. */`nwindow.JUKEBOX_TIEMPOS = $json;`n"
[IO.File]::WriteAllText((Join-Path $root 'js\jukebox-tiempos.js'), $js, (New-Object Text.UTF8Encoding $false))
Write-Host 'Listo: assets\audio\ y js\jukebox-tiempos.js'
