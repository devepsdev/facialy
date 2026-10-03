<#
.SYNOPSIS
  Crea (o actualiza) una cuenta con rol en un Facialy ya levantado con Docker.
  La contrasena se pide por teclado (sin eco): no queda en el historial.

.EXAMPLE
  .\scripts\add-admin.ps1 -Email yo@correo.com -Name "Mi Nombre"            # superadmin (por defecto)
  .\scripts\add-admin.ps1 -Email otra@correo.com -Role admin
  .\scripts\add-admin.ps1 -Email prueba@correo.com -Role user
  .\scripts\add-admin.ps1 -Email yo@correo.com -Remote sbc                 # en la Orange Pi (ssh sbc)
#>
param(
    [Parameter(Mandatory)][string]$Email,
    [ValidateSet('user', 'admin', 'superadmin')][string]$Role = 'superadmin',
    [string]$Name = '',
    [string]$Remote = ''
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$cmd = "python manage.py add_user --email `"$Email`" --role $Role"
if ($Name) { $cmd += " --name `"$Name`"" }

if ($Remote) {
    # En la SBC: ssh con TTY para poder escribir la contrasena
    ssh -t $Remote "docker exec -it facialy_web $cmd"
} else {
    Set-Location $root
    docker compose --env-file .env.local exec web sh -c $cmd
    # (exec sin -T: reserva TTY, por lo que la contrasena se pide sin eco)
}
