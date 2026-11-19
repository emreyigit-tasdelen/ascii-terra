@echo off
rem Updates ASCII-Terra from GitHub. Never touches server\data (accounts, saves).
rem Called by start.bat; can also be run on its own. Any failure leaves the game as it is.
cd /d "%~dp0"

if exist ".git" (
  where git >nul 2>&1
  if not errorlevel 1 goto git
)
rem Downloaded as a ZIP (or no git installed): update from the GitHub ZIP.
rem Lines that may replace this file end with "& exit /b" on the same line, so cmd never reads on.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0server\update.ps1" & exit /b 0

:git
echo Checking for updates...
git fetch --quiet origin main 2>nul || (echo Could not reach GitHub, starting without update. & exit /b 0)
for /f %%a in ('git rev-parse HEAD') do set LOCAL=%%a
for /f %%a in ('git rev-parse origin/main') do set REMOTE=%%a
if "%LOCAL%"=="%REMOTE%" (echo Up to date. & exit /b 0)
rem --ff-only refuses to overwrite local changes; then nothing is changed.
(git pull --ff-only --quiet origin main && echo Updated to the latest version.) || echo Update skipped: you have local changes. & exit /b 0
