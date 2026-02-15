@echo off
setlocal
cd /d "%~dp0"

echo ===============================
echo   POS MOBILE SAFE LOCAL MODE
echo ===============================
echo This starts Expo locally only.
echo It does NOT publish updates or change hosted apps.
echo.

set "LOCAL_API=http://192.168.88.73:4000"

echo Using local API: %LOCAL_API%
echo.

cd mobile
set "EXPO_PUBLIC_API_URL=%LOCAL_API%"

echo Starting Expo (local config, no remote updates)...
call npx expo start -c --config app.local.json

endlocal
