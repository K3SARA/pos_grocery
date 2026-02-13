@echo off
cd /d "%~dp0"
echo ============================
echo   POS DEMO STARTING
echo ============================

echo Starting BACKEND...
start "POS Backend" cmd /k "cd backend && npm install && npm run dev"

timeout /t 3 >nul

echo Starting FRONTEND...
start "POS Frontend" cmd /k "cd frontend && npm install && npm start"

echo.
echo Open this in browser:
echo http://localhost:3000
pause
