@echo off
setlocal enabledelayedexpansion

echo 🚀 Installing dependencies for Infinite Visual Story...

:: Check if Node.js is installed
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js is not installed. Please install Node.js v18 or higher.
    pause
    exit /b 1
)

:: Get Node.js version
for /f "tokens=1" %%i in ('node --version') do set NODE_VERSION=%%i
set NODE_VERSION=%NODE_VERSION:v=%

echo ✅ Node.js version: %NODE_VERSION%

:: Install frontend dependencies
echo 📦 Installing frontend dependencies...
call npm install

if %errorlevel% neq 0 (
    echo ❌ Failed to install frontend dependencies
    pause
    exit /b 1
)

echo ✅ Frontend dependencies installed successfully

:: Install backend dependencies
echo 📦 Installing backend dependencies...
cd backend
call npm install

if %errorlevel% neq 0 (
    echo ❌ Failed to install backend dependencies
    pause
    exit /b 1
)

echo ✅ Backend dependencies installed successfully

cd ..

:: Check if .env file exists
if not exist "backend\.env" (
    echo ⚠️  Environment file not found!
    echo 📝 Please create a .env file in the backend\ directory with your API keys.
    echo 📖 See setup.md for detailed instructions.
    echo.
    echo Required environment variables:
    echo   - REPLICATE_API_TOKEN
    echo   - GEMINI_API_KEY
    echo.
)

echo 🎉 Installation complete!
echo.
echo 🔧 Next steps:
echo   1. Set up your API keys in backend\.env
echo   2. Run the backend: cd backend ^&^& npm run dev
echo   3. Run the frontend: npm run dev
echo   4. Open http://localhost:5173 in your browser
echo.
echo 📚 For detailed setup instructions, see setup.md

pause 