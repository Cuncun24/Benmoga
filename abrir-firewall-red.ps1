# Abre el puerto de la app (5173) para entrar desde el celular o el lector Zebra
# en la MISMA red Wi-Fi. Se ejecuta una sola vez.
#
# Uso: doble clic en este archivo (pedira permiso de administrador) o
#      clic derecho > "Ejecutar con PowerShell".

# Si no se esta ejecutando como administrador, se relanza pidiendo elevacion (UAC).
if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  Start-Process powershell -Verb RunAs -ArgumentList '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', "`"$PSCommandPath`""
  exit
}

$ErrorActionPreference = 'Stop'

$nombre = 'BENMOGA Inventario Web (5173)'
if (Get-NetFirewallRule -DisplayName $nombre -ErrorAction SilentlyContinue) {
  Write-Host "Ya existe la regla: $nombre"
} else {
  New-NetFirewallRule -DisplayName $nombre -Direction Inbound -Action Allow -Protocol TCP -LocalPort 5173 -Profile Any | Out-Null
  Write-Host "Regla creada: $nombre (TCP 5173)"
}

Write-Host ""
Write-Host "Listo. Desde el celular (misma Wi-Fi) abre esta direccion:" -ForegroundColor Green
Get-NetIPAddress -AddressFamily IPv4 |
  Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' -and $_.IPAddress -notlike '192.168.56.*' } |
  ForEach-Object { Write-Host ("  https://{0}:5173" -f $_.IPAddress) -ForegroundColor Cyan }
Write-Host ""
Write-Host "Pulsa una tecla para cerrar..."
$null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')
