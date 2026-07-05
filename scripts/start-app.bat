@echo off
REM Starts the RoomGlow server (production build).
REM Expects `npm install` and `npm run build` to have been run already.
cd /d "%~dp0.."
npm run start
