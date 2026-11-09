@echo off
cd /d "%~dp0"
where node >nul 2>&1
if %errorlevel%==0 (
  start "ASCII-Terra sunucu" /min node server\server.js
) else (
  echo Node.js bulunamadi: tek oyunculu mod icin Python sunucusu aciliyor.
  start "ASCII-Terra sunucu" /min python -m http.server 8765
)
timeout /t 2 >nul
start "" http://localhost:8765/index.html
