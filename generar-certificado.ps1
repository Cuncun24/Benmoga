# Genera un certificado HTTPS propio (autofirmado) para poder abrir la app
# desde el celular por la red Wi-Fi, con la camara habilitada.
#
# Uso: clic derecho > "Ejecutar con PowerShell" (o desde una terminal).
# Vuelve a ejecutarlo si cambia la IP de la Wi-Fi.

$ErrorActionPreference = 'Stop'
$raiz = $PSScriptRoot
$certs = Join-Path $raiz 'certs'
New-Item -ItemType Directory -Force -Path $certs | Out-Null

# Busca openssl (viene con Git para Windows).
$openssl = 'C:\Program Files\Git\usr\bin\openssl.exe'
if (-not (Test-Path $openssl)) {
  $cmd = Get-Command openssl -ErrorAction SilentlyContinue
  if ($cmd) { $openssl = $cmd.Source } else { throw 'No se encontro openssl. Instala Git para Windows.' }
}

# IP de la red (prefiere Wi-Fi).
$ip = (Get-NetIPAddress -AddressFamily IPv4 |
  Where-Object { $_.InterfaceAlias -like '*Wi-Fi*' -and $_.IPAddress -notlike '169.254.*' } |
  Select-Object -First 1).IPAddress
if (-not $ip) {
  $ip = (Get-NetIPAddress -AddressFamily IPv4 |
    Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } |
    Select-Object -First 1).IPAddress
}
Write-Host "Generando certificado para la IP: $ip" -ForegroundColor Cyan

$san = @"
[req]
distinguished_name=req
[ext]
basicConstraints=CA:FALSE
keyUsage=digitalSignature,keyEncipherment
extendedKeyUsage=serverAuth
subjectAltName=@alt
[alt]
IP.1=$ip
IP.2=127.0.0.1
DNS.1=localhost
"@
Set-Content -Path (Join-Path $certs 'san.cnf') -Value $san -Encoding ascii

Push-Location $certs
& $openssl genrsa -out ca.key 2048 2>$null
& $openssl req -x509 -new -nodes -key ca.key -sha256 -days 3650 -subj "/CN=BENMOGA Inventario CA" -out ca.crt 2>$null
& $openssl genrsa -out server.key 2048 2>$null
& $openssl req -new -key server.key -subj "/CN=$ip" -out server.csr 2>$null
& $openssl x509 -req -in server.csr -CA ca.crt -CAkey ca.key -CAcreateserial -days 3650 -sha256 -extfile san.cnf -extensions ext -out server.crt 2>$null
Remove-Item server.csr -ErrorAction SilentlyContinue
Pop-Location

# Copia el certificado de la CA a la carpeta pública para poder descargarlo
# desde el celular (https://IP:5173/ca.crt) e instalarlo.
$public = Join-Path $raiz 'frontend\public'
if (Test-Path $public) { Copy-Item (Join-Path $certs 'ca.crt') (Join-Path $public 'ca.crt') -Force }

Write-Host "Listo. Certificados generados en la carpeta 'certs':" -ForegroundColor Green
Get-ChildItem $certs | Select-Object Name, Length | Format-Table -AutoSize
Write-Host "Si cambia la IP de la Wi-Fi, vuelve a ejecutar este archivo." -ForegroundColor Yellow
