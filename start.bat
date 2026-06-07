@echo off
title Teleprompter Server

echo ==================================
echo   English Teleprompter - Server
echo ==================================
echo.

python --version >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo [OK] Python found, starting server on port 8080...
    echo [URL] http://localhost:8080
    echo [STOP] Ctrl+C
    echo.
    python -m http.server 8080
    goto end
)

node --version >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo [OK] Node.js found, starting server on port 8080...
    echo [URL] http://localhost:8080
    echo [STOP] Ctrl+C
    echo.
    npx --yes http-server . -p 8080 -c-1
    goto end
)

echo [ERROR] Neither Python nor Node.js found.
echo Please install Python or Node.js first.
pause

:end
