@echo off
cd /d "%~dp0"
start "ASCII-Terra sunucu" /min python -m http.server 8765
timeout /t 2 >nul
start "" http://localhost:8765/index.html
