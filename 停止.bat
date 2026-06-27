@echo off
echo ========================================
echo Ship Maintenance System - Stopping
echo ========================================
echo.

echo Finding and stopping services...
echo.

echo [1/2] Stopping frontend service...
taskkill /FI "WINDOWTITLE eq Frontend-Service*" /F >nul 2>&1
if %errorlevel% equ 0 (
    echo Frontend service stopped
) else (
    echo Frontend service not found
)

echo [2/2] Stopping backend service...
taskkill /FI "WINDOWTITLE eq Backend-Service*" /F >nul 2>&1
if %errorlevel% equ 0 (
    echo Backend service stopped
) else (
    echo Backend service not found
)

echo.
echo ========================================
echo Services stopped
echo ========================================
echo.
pause
