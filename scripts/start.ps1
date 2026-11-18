$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$pythonCandidates = @(
    (Join-Path $projectRoot '.runtime\python.exe'),
    (Join-Path $projectRoot '.venv\Scripts\python.exe'),
    (Join-Path (Split-Path -Parent $projectRoot) 'RoboticaLab\.venv\Scripts\python.exe')
)
$environmentPython = $pythonCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (-not $environmentPython) { throw 'Falta el entorno de desarrollo. Ejecuta Configurar_RoboticaLab.ps1 una vez.' }
$appUrl = 'http://127.0.0.1:8766'
$serverFile = Join-Path $projectRoot 'server.py'
$running = $false
try {
    $info = Invoke-RestMethod -Uri "$appUrl/api/bootstrap" -TimeoutSec 2
    $running = $info.application -eq 'RoboticaLabCoppelia'
} catch {}
if ($running -and $info.serverSourceHash -ne (Get-FileHash -LiteralPath $serverFile -Algorithm SHA256).Hash) {
    if (-not $info.serverPid) { throw 'El servicio local antiguo sigue abierto. Ciérralo una vez y vuelve a iniciar el cuaderno.' }
    $oldServer = Get-Process -Id ([int]$info.serverPid) -ErrorAction Stop
    if ($oldServer.ProcessName -notlike 'python*') { throw 'El puerto 8766 pertenece a otro proceso; no se reinició.' }
    Stop-Process -Id $oldServer.Id -ErrorAction Stop
    for ($attempt = 0; $attempt -lt 20; $attempt++) {
        Start-Sleep -Milliseconds 150
        try { Invoke-RestMethod -Uri "$appUrl/api/bootstrap" -TimeoutSec 1 | Out-Null } catch { break }
    }
    $running = $false
}
if (-not $running) {
    $logDirectory = Join-Path $projectRoot '.local-data'
    New-Item -ItemType Directory -Force -Path $logDirectory | Out-Null
    $serverArgument = '"' + $serverFile + '"'
    Start-Process -FilePath $environmentPython -ArgumentList @($serverArgument, '--no-browser') -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logDirectory 'server.log') -RedirectStandardError (Join-Path $logDirectory 'server-error.log')
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        Start-Sleep -Milliseconds 200
        try {
            $info = Invoke-RestMethod -Uri "$appUrl/api/bootstrap" -TimeoutSec 1
            if ($info.application -eq 'RoboticaLabCoppelia') { $running = $true; break }
        } catch {}
    }
}
if (-not $running) { throw 'No se pudo iniciar SIMPY - CEAR. Revisa .local-data/server-error.log o si el puerto 8766 está ocupado.' }
Start-Process $appUrl
