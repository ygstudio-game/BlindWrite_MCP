# BlindWrite MCP — Windows 1-Line Remote Installer & Auto-Configurator
# Usage:
#   irm https://raw.githubusercontent.com/ygstudio-game/BlindWrite_MCP/main/scripts/install.ps1 | iex
# Or with API key:
#   $env:OPENROUTER_API_KEY="sk-or-v1-..."; irm https://raw.githubusercontent.com/ygstudio-game/BlindWrite_MCP/main/scripts/install.ps1 | iex

$ErrorActionPreference = "Stop"

Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "   BlindWrite MCP — Windows 1-Click Autonomous Setup   " -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Determine Installation Directory
$RepoUrl = "https://github.com/ygstudio-game/BlindWrite_MCP.git"
$TargetDir = ""

# Check if currently inside the repository
if (Test-Path ".\scripts\setup.js") {
    $TargetDir = (Get-Item ".").FullName
    Write-Host "[+] Running inside existing repository: $TargetDir" -ForegroundColor Green
} elseif (Test-Path "..\scripts\setup.js") {
    $TargetDir = (Get-Item "..").FullName
    Write-Host "[+] Running inside repository folder: $TargetDir" -ForegroundColor Green
} else {
    # Default destination folder in user's AppData
    $TargetDir = Join-Path $env:LOCALAPPDATA "BlindWrite_MCP"
    Write-Host "[*] Target installation folder: $TargetDir" -ForegroundColor Yellow
}

# 2. Check and Add Common Node.js / NVM Paths to Current Process
$CommonPaths = @(
    "C:\nvm4w\nodejs",
    "C:\nvm4w",
    "$env:ProgramFiles\nodejs",
    "$env:APPDATA\npm",
    "$env:LOCALAPPDATA\Programs\node"
)

foreach ($p in $CommonPaths) {
    if (Test-Path $p) {
        if ($env:PATH -notlike "*$p*") {
            $env:PATH = "$p;$env:PATH"
        }
    }
}

# 3. Check for Node.js
$NodeCmd = Get-Command node -ErrorAction SilentlyContinue
if (-not $NodeCmd) {
    Write-Host "[!] Node.js not found in PATH." -ForegroundColor Yellow
    $WingetCmd = Get-Command winget -ErrorAction SilentlyContinue
    if ($WingetCmd) {
        Write-Host "[*] Installing Node.js LTS via winget..." -ForegroundColor Cyan
        & winget install OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
        $env:PATH = "$env:ProgramFiles\nodejs;$env:APPDATA\npm;$env:PATH"
    } else {
        Write-Host "[X] winget is not available. Please install Node.js LTS from https://nodejs.org/" -ForegroundColor Red
        exit 1
    }
}

$NodeVersion = & node -v
Write-Host "[+] Detected Node.js: $NodeVersion" -ForegroundColor Green

# 4. Clone or Update Repository
if (-not (Test-Path (Join-Path $TargetDir "package.json"))) {
    Write-Host "[*] Cloning BlindWrite MCP into $TargetDir..." -ForegroundColor Cyan
    $GitCmd = Get-Command git -ErrorAction SilentlyContinue
    if (-not $GitCmd) {
        $WingetCmd = Get-Command winget -ErrorAction SilentlyContinue
        if ($WingetCmd) {
            Write-Host "[*] Installing Git via winget..." -ForegroundColor Cyan
            & winget install Git.Git --accept-package-agreements --accept-source-agreements
            $env:PATH = "$env:ProgramFiles\Git\cmd;$env:PATH"
        } else {
            Write-Host "[X] Git is required to clone the repository. Please install Git." -ForegroundColor Red
            exit 1
        }
    }
    
    if (-not (Test-Path $TargetDir)) {
        New-Item -ItemType Directory -Force -Path $TargetDir | Out-Null
    }
    & git clone $RepoUrl $TargetDir
} else {
    Write-Host "[+] BlindWrite MCP files detected in $TargetDir" -ForegroundColor Green
}

# 5. Change Location to Target Directory
Set-Location $TargetDir

# 6. Install Dependencies & Build
Write-Host "[*] Installing NPM dependencies..." -ForegroundColor Cyan
& npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "[X] Failed to install dependencies." -ForegroundColor Red
    exit 1
}

Write-Host "[*] Compiling TypeScript project..." -ForegroundColor Cyan
& npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "[X] TypeScript build failed." -ForegroundColor Red
    exit 1
}

# 7. Launch Interactive Setup Wizard
Write-Host "[*] Launching configuration wizard..." -ForegroundColor Cyan
Write-Host ""
& node scripts/setup.js $args

Write-Host ""
Write-Host "======================================================" -ForegroundColor Green
Write-Host "   BlindWrite MCP Installation & Setup Complete!      " -ForegroundColor Green
Write-Host "======================================================" -ForegroundColor Green
