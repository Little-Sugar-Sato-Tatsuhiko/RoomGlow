@echo off
REM Opens the display screen in Microsoft Edge kiosk mode.
timeout /t 5 /nobreak >nul
start msedge --kiosk http://localhost:3000/display --edge-kiosk-type=fullscreen --autoplay-policy=no-user-gesture-required
