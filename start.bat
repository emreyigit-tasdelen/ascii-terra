@echo off
cd /d "%~dp0"
rem The block is read whole before it runs, so an update that rewrites this file is safe.
(
  call "%~dp0update.bat"
  call server\launch.bat
  exit /b
)
