@echo off
setlocal

REM Campus Clarity launcher (Windows)
REM Starts a local server (needed for fetch()) and opens the browser.

cd /d "%~dp0"

where python >nul 2>nul
if errorlevel 1 (
  echo Python not found on PATH.
  echo Install Python from https://www.python.org/ and try again.
  pause
  exit /b 1
)

set "PORT=5500"
set "URL=http://localhost:%PORT%/"

echo Starting server on %URL%
echo (Keep this window open while using the app)
echo.

start "" "%URL%"
python -m http.server %PORT%

