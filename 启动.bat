@echo off
echo ========================================
echo Ship Maintenance System - Starting
echo ========================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo Error: Node.js not found
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

echo Node.js version:
node -v
echo.

echo ========================================
echo Step 1: Installing dependencies
echo ========================================
echo.

echo [1/2] Installing backend dependencies...
cd backend
if not exist node_modules (
    call npm install
    if %errorlevel% neq 0 (
        echo Backend dependencies installation failed
        cd ..
        pause
        exit /b 1
    )
) else (
    echo Backend dependencies already exist
)
cd ..

echo.
echo [2/2] Installing frontend dependencies...
cd frontend
if not exist node_modules (
    call npm install
    if %errorlevel% neq 0 (
        echo Frontend dependencies installation failed
        cd ..
        pause
        exit /b 1
    )
) else (
    echo Frontend dependencies already exist
)
cd ..

echo.
echo ========================================
echo Step 2: Initializing database
echo ========================================
echo.

cd backend
if not exist data\maintenance.db (
    echo Initializing database...
    call node src/db/init.js
    if %errorlevel% neq 0 (
        echo Database initialization failed
        cd ..
        pause
        exit /b 1
    )
    echo Database initialized successfully
) else (
    echo Database already exists
)
cd ..

echo.
echo ========================================
echo Step 3: Starting services
echo ========================================
echo.

echo Starting backend service (port 3000)...
start "Backend-Service" cmd /k "cd backend && npm start"
timeout /t 3 /nobreak >nul

echo Starting frontend service (port 5173)...
start "Frontend-Service" cmd /k "cd frontend && npm run dev"
timeout /t 3 /nobreak >nul

echo.
echo ========================================
echo Services started successfully!
echo ========================================
echo.
echo Frontend: http://localhost:5173
echo Backend:  http://localhost:3000
echo Login:    admin / admin123
echo.
echo Note: Two console windows will remain open
echo       Do not close them
echo       Press Ctrl+C to stop services
echo.
echo Opening browser...
timeout /t 2 /nobreak >nul
start http://localhost:5173

echo.
echo Press any key to close this window...
pause >nul
