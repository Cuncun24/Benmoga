@echo off
REM Doble clic en este archivo para permitir el acceso desde el celular/lector.
REM Pedira permiso de administrador (UAC): acepta para continuar.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0abrir-firewall-red.ps1"
