# Servidor web local mínimo (sin instalar nada) para abrir Earth Information Jukebox.
# Hace falta porque, abriendo index.html con doble clic (file://), el navegador
# no deja leer los píxeles de las imágenes y videos de la NASA.
# Con -Red también se puede abrir desde otros aparatos del mismo Wi-Fi (celular, tablet).
param([int]$Port = 8080, [switch]$NoBrowser, [switch]$Red)

$root = $PSScriptRoot
$types = @{
  '.html' = 'text/html; charset=utf-8'; '.css' = 'text/css; charset=utf-8'
  '.js' = 'text/javascript; charset=utf-8'; '.json' = 'application/json'
  '.png' = 'image/png'; '.jpg' = 'image/jpeg'; '.jpeg' = 'image/jpeg'; '.svg' = 'image/svg+xml'
  '.webm' = 'video/webm'; '.mp4' = 'video/mp4'; '.wav' = 'audio/wav'; '.mp3' = 'audio/mpeg'; '.md' = 'text/plain; charset=utf-8'
}

$listener = New-Object System.Net.HttpListener
# "localhost" = solo esta PC; "+" = cualquier dirección (necesario para que entre el celular)
$listener.Prefixes.Add($(if ($Red) { "http://+:$Port/" } else { "http://localhost:$Port/" }))
try { $listener.Start() } catch {
  $denied = $_.Exception.InnerException -is [System.Net.HttpListenerException] -and $_.Exception.InnerException.ErrorCode -eq 5
  if ($Red -and $denied) {
    Write-Host "Windows no deja escuchar en la red sin un permiso que se da una sola vez." -ForegroundColor Yellow
    Write-Host "Abre PowerShell como administrador y ejecuta:"
    Write-Host "  netsh http add urlacl url=http://+:$Port/ user=`"$env:USERDOMAIN\$env:USERNAME`""
    Write-Host "  New-NetFirewallRule -DisplayName 'Jukebox $Port' -Direction Inbound -Protocol TCP -LocalPort $Port -Action Allow -Profile Private"
    Write-Host "Luego vuelve a abrir este servidor con -Red."
  } else {
    Write-Host "No se pudo abrir el puerto $Port. Puede que ya haya otro servidor abierto (prueba http://localhost:$Port/ en el navegador)." -ForegroundColor Yellow
    Write-Host "Cierra esa otra ventana o usa otro puerto: powershell -ExecutionPolicy Bypass -File servidor.ps1 -Port $($Port + 1)"
  }
  exit 1
}
Write-Host "Earth Information Jukebox en http://localhost:$Port/  (Ctrl+C para detener)"
if ($Red) {
  # Direcciones de esta PC en la red local (se omiten 127.x y 169.254.x, que no sirven desde otro aparato)
  $ips = @(Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object { $_.IPAddress -notmatch '^(127\.|169\.254\.)' } | ForEach-Object { $_.IPAddress })
  Write-Host "Desde el celular (mismo Wi-Fi) abre:" -ForegroundColor Cyan
  foreach ($ip in $ips) { Write-Host "  http://${ip}:$Port/" -ForegroundColor Cyan }
  Write-Host "Si no carga, revisa que el Wi-Fi de esta PC esté como red 'Privada' en Windows."
}
if (-not $NoBrowser) { Start-Process "http://localhost:$Port/" }

try {
  while ($listener.IsListening) {
    # Esperar en intervalos de 200 ms (en vez de bloquear con GetContext) para que Ctrl+C funcione
    $pending = $listener.GetContextAsync()
    while (-not $pending.AsyncWaitHandle.WaitOne(200)) { }
    $ctx = $pending.GetAwaiter().GetResult()
    $res = $ctx.Response
    try {
      $path = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath.TrimStart('/'))
      if ($path -eq '') { $path = 'index.html' }
      $file = [IO.Path]::GetFullPath((Join-Path $root $path))
      # Solo archivos dentro de la carpeta del proyecto (la barra final evita carpetas hermanas tipo "proyecto-otro")
      $inside = $file.StartsWith($root.TrimEnd('\') + '\', [StringComparison]::OrdinalIgnoreCase)
      if ($inside -and (Test-Path $file -PathType Leaf)) {
        $ext = [IO.Path]::GetExtension($file).ToLower()
        $res.ContentType = if ($types.ContainsKey($ext)) { $types[$ext] } else { 'application/octet-stream' }
        $res.AddHeader('Accept-Ranges', 'bytes')
        $len = (Get-Item $file).Length
        $start = 0; $end = $len - 1
        # Los videos se piden por partes (Range). Se entregan trozos de 1 MB como máximo
        # para que el servidor (de un solo hilo) nunca quede bloqueado esperando al navegador.
        $range = $ctx.Request.Headers['Range']
        if ($range -match '^bytes=(\d*)-(\d*)$') {
          if ($Matches[1] -ne '') {
            $start = [int64]$Matches[1]
            $end = if ($Matches[2] -ne '') { [int64]$Matches[2] } else { $len - 1 }
            $end = [Math]::Min($end, $start + 1MB - 1)
          } else {
            $start = [Math]::Max(0, $len - [int64]$Matches[2])
          }
          $end = [Math]::Min($end, $len - 1)
          $res.StatusCode = 206
          $res.AddHeader('Content-Range', "bytes $start-$end/$len")
        }
        $count = [int]($end - $start + 1)
        $buf = New-Object byte[] $count
        $fs = [IO.File]::OpenRead($file)
        try { [void]$fs.Seek($start, 'Begin'); [void]$fs.Read($buf, 0, $count) } finally { $fs.Close() }
        $res.ContentLength64 = $count
        $res.OutputStream.Write($buf, 0, $count)
      } else {
        $res.StatusCode = 404
      }
    } catch {
      # El navegador cortó la conexión (p. ej. al buscar en un video); se ignora
    } finally {
      $res.Close()
    }
  }
} finally {
  $listener.Stop()
  Write-Host 'Servidor detenido.'
}
