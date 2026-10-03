<#
.SYNOPSIS
  Levanta Facialy en local: PostgreSQL + Django en Docker y, delante, el Apache de XAMPP
  como proxy en http://localhost:8080/facialy/ (igual que en la Orange Pi).

.EXAMPLE
  .\scripts\local-up.ps1            # build + arranque
  .\scripts\local-up.ps1 -Down      # parar todo (conserva los datos)
  .\scripts\local-up.ps1 -Down -Purge   # parar y borrar la base de datos local
#>
param(
    [switch]$Down,
    [switch]$Purge,
    [string]$XamppPath = 'C:\xampp',
    [int]$Port = 8080
)

$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
$envFile = Join-Path $root '.env.local'
$apacheConf = Join-Path $root 'deploy\apache.local.conf'
$pidFile = Join-Path $root 'deploy\.apache.pid'

function New-Secret([int]$bytes = 32) {
    $b = New-Object byte[] $bytes
    [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b)
    ([BitConverter]::ToString($b) -replace '-', '').ToLower()
}

function Stop-LocalApache {
    if (Test-Path $pidFile) {
        $id = [int](Get-Content $pidFile)
        Get-Process -Id $id -ErrorAction SilentlyContinue | Stop-Process -Force
        Remove-Item $pidFile -ErrorAction SilentlyContinue
    }
    # Apache arranca procesos hijos: se cierran los que usan nuestra configuracion
    Get-CimInstance Win32_Process -Filter "Name='httpd.exe'" |
        Where-Object { $_.CommandLine -like "*apache.local.conf*" } |
        ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
}

if ($Down) {
    Stop-LocalApache
    if ($Purge) { docker compose --env-file $envFile down -v } else { docker compose --env-file $envFile down }
    Write-Host 'Servicios detenidos.' -ForegroundColor Yellow
    return
}

# 1) .env.local con secretos aleatorios (solo la primera vez)
if (-not (Test-Path $envFile)) {
    @"
SECRET_KEY=$(New-Secret 40)
DB_NAME=facialy
DB_USER=facialy
DB_PASSWORD=$(New-Secret 16)
DB_HOST=db
DB_HOST_PORT=5433
# http://localhost no es HTTPS: la cookie del refresh token no puede ser "Secure" aqui
SECURE_COOKIES=false
GUEST_LOGIN_ENABLED=true
SEED_DEMO=true
REGISTRATION_ENABLED=true
ALLOWED_HOSTS=localhost,127.0.0.1
CSRF_TRUSTED_ORIGINS=http://localhost:$Port
"@ | Set-Content -Encoding ascii $envFile
    Write-Host "Creado $envFile" -ForegroundColor Green
}

# 2) Contenedores
$env:ENV_FILE = '.env.local'
docker compose --env-file $envFile up -d --build
if ($LASTEXITCODE -ne 0) { throw 'docker compose fallo' }

Write-Host 'Esperando a que facialy_web este healthy...' -NoNewline
for ($i = 0; $i -lt 60; $i++) {
    $s = docker inspect --format '{{.State.Health.Status}}' facialy_web 2>$null
    if ($s -eq 'healthy') { break }
    Start-Sleep -Seconds 3; Write-Host '.' -NoNewline
}
Write-Host " $s"
if ($s -ne 'healthy') { docker compose --env-file $envFile logs --tail 60 web; throw 'El servicio no llego a estar healthy' }

# 3) Proxy Apache (XAMPP) sin abrir el panel de control
$httpd = Join-Path $XamppPath 'apache\bin\httpd.exe'
if (Test-Path $httpd) {
    Stop-LocalApache
    $conf = (Get-Content (Join-Path $root 'deploy\apache.local.conf.template') -Raw) `
        -replace '@XAMPP@', ($XamppPath -replace '\\', '/') -replace '@PORT@', $Port -replace '@ROOT@', ($root -replace '\\', '/')
    Set-Content -Encoding ascii $apacheConf $conf
    $p = Start-Process -FilePath $httpd -ArgumentList @('-f', "`"$apacheConf`"") -WindowStyle Hidden -PassThru
    $p.Id | Set-Content $pidFile
    Start-Sleep -Seconds 2
    Write-Host "Apache (XAMPP) escuchando en http://localhost:$Port/facialy/" -ForegroundColor Green
} else {
    Write-Host "No encontre ${httpd}: usa http://localhost:8000/ (sin prefijo /facialy)." -ForegroundColor Yellow
}

Write-Host "`nFacialy: http://localhost:$Port/facialy/" -ForegroundColor Cyan
Write-Host 'Crear tu cuenta de administrador:  .\scripts\add-admin.ps1 -Email tu@email.com'

