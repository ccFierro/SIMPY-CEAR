$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$stage = [System.IO.Path]::GetFullPath((Join-Path $projectRoot '.build\win'))
$dist = [System.IO.Path]::GetFullPath((Join-Path $projectRoot 'dist'))
$bundle = Join-Path $dist 'SIMPY - CEAR'
$version = (Get-Content -LiteralPath (Join-Path $projectRoot 'package.json') -Raw | ConvertFrom-Json).version
$archive = Join-Path $dist "SIMPY-CEAR-$version-win-x64.zip"
$python = Join-Path $projectRoot '.venv\Scripts\python.exe'
if (-not (Test-Path -LiteralPath $python)) {
    $python = Join-Path $projectRoot '..\RoboticaLab\.venv\Scripts\python.exe'
}

function Assert-InProject([string]$target) {
    $resolved = [System.IO.Path]::GetFullPath($target)
    if (-not $resolved.StartsWith($projectRoot + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Ruta fuera del proyecto: $resolved"
    }
}

if (-not (Test-Path -LiteralPath $python)) { throw 'Prepara primero un entorno Python 3.14 con PyInstaller.' }
& $python -c 'import sys; assert sys.version_info[:2] == (3, 14) and sys.maxsize > 2**32'
if ($LASTEXITCODE -ne 0) { throw 'El paquete requiere CPython 3.14 x64.' }

foreach ($target in @($stage, $bundle, $archive)) {
    Assert-InProject $target
    if (Test-Path -LiteralPath $target) { Remove-Item -LiteralPath $target -Recurse -Force }
}
New-Item -ItemType Directory -Force -Path $stage, $bundle | Out-Null

$pythonZip = Join-Path $projectRoot '.build\cache\python-3.14.7-embed-amd64.zip'
$pythonUrl = 'https://www.python.org/ftp/python/3.14.7/python-3.14.7-embed-amd64.zip'
$expectedHash = 'd297e5ff019966817ad8502465176139f2d3d840fa4ed84b13bed399a6ab1f15'
Assert-InProject $pythonZip
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $pythonZip) | Out-Null
if (-not (Test-Path -LiteralPath $pythonZip)) {
    Write-Host 'Descargando Python embebido 3.14.7...'
    Invoke-WebRequest -Uri $pythonUrl -OutFile $pythonZip
}
if ((Get-FileHash -LiteralPath $pythonZip -Algorithm SHA256).Hash.ToLowerInvariant() -ne $expectedHash) {
    throw 'La suma SHA-256 del runtime Python no coincide con python.org.'
}
$runtime = Join-Path $bundle 'runtime'
Expand-Archive -LiteralPath $pythonZip -DestinationPath $runtime
$sitePackages = Join-Path $runtime 'pkgs'
New-Item -ItemType Directory -Force -Path $sitePackages | Out-Null
@('python314.zip', '.', 'pkgs', '..\app\python') | Set-Content -LiteralPath (Join-Path $runtime 'python314._pth') -Encoding ascii

Write-Host 'Preparando bibliotecas del cuaderno...'
$wheels = Join-Path $projectRoot '.build\wheels'
if (-not (Test-Path -LiteralPath $wheels)) { throw 'Faltan las ruedas Python en .build\wheels.' }
& $python -m pip install --disable-pip-version-check --no-index --find-links $wheels --no-compile --target $sitePackages -r (Join-Path $projectRoot 'requirements.lock')
if ($LASTEXITCODE -ne 0) { throw 'No se pudieron empaquetar las bibliotecas Python.' }
& icacls $sitePackages /inheritance:e /T /C | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'No se pudieron ajustar los permisos del runtime Python.' }
foreach ($relative in @('jedi\third_party\typeshed\stubs', 'jedi\third_party\django-stubs')) {
    $unusedStubs = Join-Path $sitePackages $relative
    Assert-InProject $unusedStubs
    if (Test-Path -LiteralPath $unusedStubs) { Remove-Item -LiteralPath $unusedStubs -Recurse -Force }
}

$app = Join-Path $bundle 'app'
$pythonApp = Join-Path $app 'python'
New-Item -ItemType Directory -Force -Path $pythonApp | Out-Null
foreach ($name in @('server.py', 'index.html', 'styles.css', 'storage.js', 'editor.js', 'execution.js', 'workspace.js', 'visual-flow.js', 'python-runtime.js', 'bootstrap.js', 'app.js', 'coppelia-panel.js', 'notifications.js', 'pose-marker.js', 'python-reference.js')) {
    Copy-Item -LiteralPath (Join-Path $projectRoot $name) -Destination $app
}
foreach ($name in @('kernel.py', 'probe_coppelia.py', 'complete.py')) {
    Copy-Item -LiteralPath (Join-Path $projectRoot "python\$name") -Destination $pythonApp
}
Copy-Item -LiteralPath (Join-Path $projectRoot 'python\roboticalab') -Destination $pythonApp -Recurse
Copy-Item -LiteralPath (Join-Path $projectRoot 'examples') -Destination $bundle -Recurse
Copy-Item -LiteralPath (Join-Path $projectRoot 'scripts\LEEME-portable.txt') -Destination (Join-Path $bundle 'LEEME.txt')

Write-Host 'Compilando lanzador de Windows...'
& $python -m PyInstaller --noconfirm --clean --onefile --windowed --name 'SIMPY - CEAR' --distpath (Join-Path $stage 'launcher') --workpath (Join-Path $stage 'pyinstaller') --specpath $stage (Join-Path $projectRoot 'scripts\launcher.py')
if ($LASTEXITCODE -ne 0) { throw 'No se pudo compilar el lanzador.' }
Copy-Item -LiteralPath (Join-Path $stage 'launcher\SIMPY - CEAR.exe') -Destination $bundle

Write-Host 'Probando el ejecutable con una sesión Python real...'
& $python (Join-Path $projectRoot 'scripts\test-package.py') $bundle
if ($LASTEXITCODE -ne 0) { throw 'El ejecutable no superó la prueba de integración.' }

Write-Host 'Comprimiendo distribución portátil...'
Compress-Archive -LiteralPath $bundle -DestinationPath $archive -CompressionLevel Optimal
Write-Host "Ejecutable: $(Join-Path $bundle 'SIMPY - CEAR.exe')"
Write-Host "Paquete: $archive"
