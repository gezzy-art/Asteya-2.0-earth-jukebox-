@echo off
rem Doble clic para abrir Earth Information Jukebox y poder entrar tambien desde el celular (mismo Wi-Fi).
rem La ventana muestra la direccion que hay que escribir en el celular.
rem Para detenerlo: Ctrl+C o cerrar esta ventana.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0servidor.ps1" -Red
if errorlevel 1 pause
