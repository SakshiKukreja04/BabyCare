@echo off
REM BabyCare Development Startup Script for Windows
REM This script starts both frontend and backend servers

setlocal enabledelayedexpansion

echo.
echo ╔════════════════════════════════════════════════════════════╗
echo ║          BabyCare Development Environment Setup             ║
echo ║         Windows IPv4 Development Setup (127.0.0.1)         ║
echo ╚════════════════════════════════════════════════════════════╝
echo.

REM Colors
set GREEN=[92m
set BLUE=[94m
set YELLOW=[93m
set RESET=[0m

REM Check if node is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo %YELLOW%Warning: Node.js is not installed or not in PATH%RESET%
    exit /b 1
)

echo %BLUE%Node.js version:%RESET%
node --version
echo.

REM Check if npm is installed
where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo %YELLOW%Warning: npm is not installed or not in PATH%RESET%
    exit /b 1
)

echo %BLUE%npm version:%RESET%
npm --version
echo.

REM Start backend
echo %BLUE%Starting BabyCare Backend Server...%RESET%
echo Location: C:\BabyCare\server
start "BabyCare Backend" cmd /k "cd C:\BabyCare\server && npm install && npm start"
timeout /t 2 /nobreak
echo %GREEN%✓ Backend server started on http://127.0.0.1:5000%RESET%
echo.

REM Start frontend
echo %BLUE%Starting BabyCare Frontend Server...%RESET%
echo Location: C:\BabyCare\client
start "BabyCare Frontend" cmd /k "cd C:\BabyCare\client && npm install && npm run dev"
timeout /t 2 /nobreak
echo %GREEN%✓ Frontend server started on http://127.0.0.1:5173 (or 5174+ if port in use)%RESET%
echo.

echo ╔════════════════════════════════════════════════════════════╗
echo ║                  DEVELOPMENT SERVERS STARTED                ║
echo ╠════════════════════════════════════════════════════════════╣
echo ║  Backend:  http://127.0.0.1:5000                            ║
echo ║  Frontend: http://127.0.0.1:5173                            ║
echo ║  Health:   curl http://127.0.0.1:5000/health               ║
echo ╠════════════════════════════════════════════════════════════╣
echo ║  API Calls: /api/* → proxied to http://127.0.0.1:5000/api  ║
echo ║  CORS:      Enabled for frontend URL                        ║
echo ║  IPv4:      All services use 127.0.0.1 (no IPv6)           ║
echo ╚════════════════════════════════════════════════════════════╝
echo.

echo %BLUE%Waiting for servers to start... (check the console windows)%RESET%
timeout /t 5 /nobreak

echo.
echo %BLUE%To stop development:%RESET%
echo  - Close the BabyCare Backend console window
echo  - Close the BabyCare Frontend console window
echo.

pause
