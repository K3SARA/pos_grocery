@echo off
setlocal
cd /d "%~dp0"

echo ============================
echo   POS LOCAL CLIENT MODE
echo ============================
echo This mode uses LOCAL backend DB and LOCAL frontend API only.
echo It does NOT change Railway/host settings.
echo.

set "LOCAL_DB=file:./client_local.db"
set "LOCAL_API=http://localhost:4000"
set "LOCAL_JWT=local_client_secret_change_me"

echo Starting BACKEND with DATABASE_URL=%LOCAL_DB%
start "POS Backend Local" cmd /k "cd backend && set DATABASE_URL=%LOCAL_DB% && set JWT_SECRET=%LOCAL_JWT% && npm install && npx prisma db push && npm run dev"

timeout /t 3 >nul

echo Starting FRONTEND with REACT_APP_API_URL=%LOCAL_API%
start "POS Frontend Local" cmd /k "cd frontend && set REACT_APP_API_URL=%LOCAL_API% && npm install && npm start"

echo.
echo Open in browser: http://localhost:3000
echo Local backend API: %LOCAL_API%
echo Local DB file: backend\client_local.db
echo.
pause
