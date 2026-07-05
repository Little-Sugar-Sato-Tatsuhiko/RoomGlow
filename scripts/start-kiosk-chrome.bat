@echo off
REM Opens the display screen in Google Chrome kiosk mode.
timeout /t 5 /nobreak >nul
start chrome --kiosk http://localhost:3000/display --autoplay-policy=no-user-gesture-required
