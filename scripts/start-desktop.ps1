$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$baseProject = Join-Path (Split-Path -Parent $projectRoot) 'RoboticaLab'
$pythonCandidates = @(
    (Join-Path $projectRoot '.venv\Scripts\python.exe'),
    (Join-Path $baseProject '.venv\Scripts\python.exe')
)
$python = $pythonCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (-not $python) { throw 'Falta Python. Prepara .venv en este proyecto o en RoboticaLab.' }

$data = Join-Path $projectRoot '.local-data'
New-Item -ItemType Directory -Force -Path $data | Out-Null
$url = 'http://127.0.0.1:8766'
$server = Join-Path $projectRoot 'server.py'
$ready = $false
try {
    $info = Invoke-RestMethod -Uri "$url/api/bootstrap" -TimeoutSec 2
    $ready = $info.application -eq 'RoboticaLabCoppelia'
} catch {}
if ($ready -and $info.serverSourceHash -ne (Get-FileHash -LiteralPath $server -Algorithm SHA256).Hash) {
    if (-not $info.serverPid) { throw 'El servicio local antiguo sigue abierto. Ciérralo una vez y vuelve a iniciar el cuaderno.' }
    $oldServer = Get-Process -Id ([int]$info.serverPid) -ErrorAction Stop
    if ($oldServer.ProcessName -notlike 'python*') { throw 'El puerto 8766 pertenece a otro proceso; no se reinició.' }
    Stop-Process -Id $oldServer.Id -ErrorAction Stop
    for ($attempt = 0; $attempt -lt 20; $attempt++) {
        Start-Sleep -Milliseconds 150
        try { Invoke-RestMethod -Uri "$url/api/bootstrap" -TimeoutSec 1 | Out-Null } catch { break }
    }
    $ready = $false
}
if (-not $ready) {
    Start-Process -FilePath $python -ArgumentList @("`"$server`"", '--port', '8766', '--no-browser') -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $data 'server.log') -RedirectStandardError (Join-Path $data 'server-error.log')
    for ($attempt = 0; $attempt -lt 40; $attempt++) {
        Start-Sleep -Milliseconds 250
        try {
            $info = Invoke-RestMethod -Uri "$url/api/bootstrap" -TimeoutSec 1
            if ($info.application -eq 'RoboticaLabCoppelia') { $ready = $true; break }
        } catch {}
    }
}
if (-not $ready) { throw 'No inició el cuaderno. Revisa .local-data/server-error.log.' }

$browserCandidates = @(
    (Join-Path $env:LOCALAPPDATA 'Vivaldi\Application\vivaldi.exe'),
    'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
)
$browser = $browserCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (-not $browser) { throw 'No se encontró Vivaldi ni Microsoft Edge para abrir la ventana lateral.' }

Add-Type -AssemblyName System.Windows.Forms
$area = [System.Windows.Forms.Screen]::PrimaryScreen.WorkingArea
$width = [Math]::Max(430, [Math]::Round($area.Width * 0.35))
$height = $area.Height
$profile = Join-Path $data 'browser-profile'
Start-Process -FilePath $browser -ArgumentList @("--app=$url", "--window-size=$width,$height", "--window-position=$($area.X),$($area.Y)", "--user-data-dir=`"$profile`"", '--no-first-run') -WorkingDirectory $projectRoot

# La ventana del cuaderno permanece visible al operar CoppeliaSim.
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class RoboLabWindow {
    [DllImport("user32.dll")]
    public static extern bool SetWindowPos(IntPtr handle, IntPtr insertAfter,
        int x, int y, int width, int height, uint flags);
}
'@
for ($attempt = 0; $attempt -lt 40; $attempt++) {
    Start-Sleep -Milliseconds 250
    $window = Get-Process -Name 'vivaldi','msedge' -ErrorAction SilentlyContinue |
        Where-Object { $_.MainWindowTitle -like 'SIMPY - CEAR*' -and $_.MainWindowHandle -ne [IntPtr]::Zero } |
        Select-Object -First 1
    if ($window) {
        [RoboLabWindow]::SetWindowPos($window.MainWindowHandle, [IntPtr](-1), 0, 0, 0, 0, 0x0013) | Out-Null
        break
    }
}
