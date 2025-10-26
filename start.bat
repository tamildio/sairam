@echo off
REM Rent Receipt App - Local Development Startup Script (Windows)

echo 🏠 Starting Rent Receipt App (Local Database Version)
echo ==================================================

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo ❌ Node.js is not installed. Please install Node.js first.
    pause
    exit /b 1
)

REM Check if npm is installed
where npm >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo ❌ npm is not installed. Please install npm first.
    pause
    exit /b 1
)

REM Install dependencies if node_modules doesn't exist
if not exist "node_modules" (
    echo 📦 Installing dependencies...
    npm install
)

REM Create data directory if it doesn't exist
if not exist "server\data" mkdir server\data

echo 🚀 Starting backend server...
start "Backend Server" cmd /k "node server/server.js"

REM Wait a moment for server to start
timeout /t 2 /nobreak >nul

echo 🌐 Starting frontend client...
start "Frontend Client" cmd /k "npm run client"

echo.
echo ✅ App is starting up!
echo 📊 Backend: http://localhost:3001
echo 🌐 Frontend: http://localhost:5173
echo 🔐 Admin Password: admin123
echo.
echo Press any key to exit...
pause >nul

