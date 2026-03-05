@echo off
echo ========================================
echo UniFlow AI Chat - Setup Script
echo ========================================
echo.

echo [1/4] Checking Node.js installation...
node --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js is not installed!
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)
echo Node.js is installed: 
node --version
echo.

echo [2/4] Installing dependencies...
call npm install
if errorlevel 1 (
    echo ERROR: Failed to install dependencies!
    pause
    exit /b 1
)
echo Dependencies installed successfully!
echo.

echo [3/4] Checking environment configuration...
if not exist .env (
    echo WARNING: .env file not found!
    echo Creating .env from .env.example...
    copy .env.example .env
    echo.
    echo IMPORTANT: Please edit .env and add your GROQ_API_KEY!
    echo Get your API key from: https://console.groq.com/keys
    echo.
    pause
) else (
    echo .env file exists!
)
echo.

echo [4/4] Setup complete!
echo.
echo ========================================
echo Next Steps:
echo ========================================
echo 1. Make sure your GROQ_API_KEY is set in .env
echo 2. Run: npm run dev
echo 3. Open: http://localhost:3002
echo.
echo For more information:
echo - Quick Start: QUICKSTART.md
echo - Full Documentation: README.md
echo - Optional Features: ENHANCEMENTS.md
echo ========================================
echo.
pause
