@echo off
cd /d "%~dp0frontend"
if not exist .env copy .env.example .env
npm run dev
pause
