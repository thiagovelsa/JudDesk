@echo off
setlocal enabledelayedexpansion
title JurisDesk - Inicializador

cd /d "%~dp0"

echo.
echo ===============================================
echo   JurisDesk - Inicializador
echo ===============================================
echo.
echo Este script inicia o app em modo de desenvolvimento.
echo Esta janela deve permanecer aberta para manter os logs.
echo.

where npm >nul 2>nul
if errorlevel 1 (
  echo [ERRO] npm nao encontrado. Instale o Node.js e tente novamente.
  echo.
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo [INFO] Dependencias nao encontradas. Instalando...
  echo.
  call npm install
  if errorlevel 1 (
    echo.
    echo [ERRO] Falha ao instalar dependencias.
    pause
    exit /b 1
  )
)

echo [INFO] Iniciando JurisDesk (tauri dev)...
echo.
call npm run tauri dev

echo.
echo [INFO] Processo finalizado.
pause
