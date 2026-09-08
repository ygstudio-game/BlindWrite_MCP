@echo off
setlocal enabledelayedexpansion

echo ======================================================
echo    BlindWrite MCP -- Windows 1-Click Setup and Configuration
echo ======================================================
echo.

:: Auto-detect common Node.js and NVM paths if not already in PATH
if exist "C:\nvm4w\nodejs" set "PATH=C:\nvm4w\nodejs;C:\nvm4w;%PATH%"
if defined NVM_SYMLINK if exist "%NVM_SYMLINK%" set "PATH=%NVM_SYMLINK%;%NVM_HOME%;%PATH%"
if exist "%ProgramFiles%\nodejs" set "PATH=%ProgramFiles%\nodejs;%APPDATA%\npm;%PATH%"
if exist "%LOCALAPPDATA%\Programs\node" set "PATH=%LOCALAPPDATA%\Programs\node;%PATH%"

:: 1. Check for Node.js
node -v >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [!] Node.js is not installed or not in your PATH.
    echo [*] Attempting to install Node.js LTS via winget...
    
    where winget >nul 2>nul
    if %ERRORLEVEL% equ 0 (
        echo [*] Running winget install OpenJS.NodeJS.LTS...
        winget install OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
        
        :: Add standard Node.js path to current session
        set "PATH=%ProgramFiles%\nodejs;%APPDATA%\npm;%PATH%"
    ) else (
        echo [!] winget is not available on your system.
        echo [*] Opening the official Node.js download page...
        start https://nodejs.org/en/download/
        echo Please install Node.js LTS and run setup.bat again.
        pause
        exit /b 1
    )
)

:: Re-verify Node.js
node -v >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [!] Node.js is still not detected in PATH.
    echo Please restart your terminal/computer after installing Node.js and run setup.bat again.
    pause
    exit /b 1
)

for /f "tokens=*" %%v in ('node -v') do set NODE_VER=%%v
for /f "tokens=*" %%v in ('npm -v') do set NPM_VER=%%v
echo [+] Detected Node.js: %NODE_VER% (npm: %NPM_VER%)
echo.

:: 2. Check for Git
where git >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [!] Git is not found in PATH.
    echo [*] Checking for winget to install Git...
    where winget >nul 2>nul
    if %ERRORLEVEL% equ 0 (
        echo [*] Installing Git via winget...
        winget install Git.Git --accept-package-agreements --accept-source-agreements
        set "PATH=%ProgramFiles%\Git\cmd;%PATH%"
    )
)

:: 3. Install NPM dependencies
echo [*] Installing dependencies with npm install (using precompiled native binaries)...
call npm install --ignore-scripts
if %ERRORLEVEL% neq 0 (
    echo [*] Retrying with standard npm install...
    call npm install
    if %ERRORLEVEL% neq 0 (
        echo [!] Failed to install npm dependencies.
        pause
        exit /b 1
    )
)

:: 4. Build TypeScript project
echo [*] Compiling TypeScript with npm run build...
call npm run build
if %ERRORLEVEL% neq 0 (
    echo [!] Build failed.
    pause
    exit /b 1
)

:: 5. Launch interactive setup wizard
echo [*] Launching BlindWrite MCP configuration wizard...
echo.
node scripts/setup.js %*

echo.
echo ======================================================
echo    Setup completed successfully!
echo ======================================================
pause
