@echo off
cd /d "%~dp0backend"
if not exist .env (
  echo Falta backend\.env. Copia backend\.env.example a backend\.env y configura MySQL.
  pause
  exit /b 1
)
npm run dev
pause
