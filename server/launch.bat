@echo off
rem Starts the server and opens the game. Called by start.bat after the update check.
cd /d "%~dp0.."
where node >nul 2>&1
if %errorlevel%==0 (
  start "ASCII-Terra server" /min node server\server.js
) else (
  echo Node.js not found: starting a Python server for single player only.
  start "ASCII-Terra server" /min python -m http.server 8765
)
timeout /t 2 >nul
start "" http://localhost:8765/index.html
