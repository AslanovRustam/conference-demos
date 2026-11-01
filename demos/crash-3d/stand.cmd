@echo off
rem Clickable Rocket on the stand: serves the production build and opens it full screen in Chrome on the discrete GPU.
rem Chrome gets its own profile, so the flags apply even while your usual Chrome is open. Alt+F4 closes the kiosk.
cd /d "%~dp0"

set "CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" set "CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" set "CHROME=%LocalAppData%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" (
  echo Chrome not found. Install Google Chrome or edit the CHROME path in this file.
  pause
  exit /b 1
)

if not exist "dist\index.html" call npm run build

start "Clickable Rocket server" /min cmd /c npm run preview
timeout /t 4 /nobreak > nul

start "" "%CHROME%" --user-data-dir="%LocalAppData%\ClickableRocketStand" --force_high_performance_gpu --kiosk --autoplay-policy=no-user-gesture-required --no-first-run --no-default-browser-check http://localhost:4185/
