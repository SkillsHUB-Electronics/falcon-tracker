@echo off
rem ==================================================================
rem  Falcon Tracker - dashboard (base station over USB serial)
rem   Starts the dashboard server and opens it in the browser.
rem   If the ESP32-C3 base station is plugged in it connects by itself;
rem   otherwise press Connect USB on the page or pick the port in Settings.
rem   Close the Arduino / PlatformIO serial monitor first.
rem   Extra options are passed on, e.g.:  START_DASHBOARD.bat --port COM7
rem                                       START_DASHBOARD.bat --demo
rem ==================================================================
setlocal
cd /d "%~dp0app"
set "PYTHONUTF8=1"

set "PY="
python --version >nul 2>&1
if not errorlevel 1 set "PY=python"
if defined PY goto havepy
py -3 --version >nul 2>&1
if not errorlevel 1 set "PY=py -3"
if defined PY goto havepy
echo [ERROR] Python 3 was not found.
echo Install it from https://www.python.org/downloads/ and tick "Add python.exe to PATH".
goto end

:havepy
%PY% -c "import serial" >nul 2>&1
if errorlevel 1 (
  echo Installing pyserial...
  %PY% -m pip install pyserial
)
echo Starting the dashboard...  (close this window or press Ctrl+C to stop it)
echo.
%PY% -m falcon_tracker %*

:end
echo.
pause
