@echo off
rem Doble clic para abrir Earth Information Jukebox en el navegador con datos reales de la NASA.
rem Para detenerlo: Ctrl+C o cerrar esta ventana.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0servidor.ps1"
if errorlevel 1 pause
