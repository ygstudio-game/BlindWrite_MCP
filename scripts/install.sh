#!/usr/bin/env bash
# BlindWrite MCP — macOS / Linux 1-Line Remote Installer & Auto-Configurator
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/ygstudio-game/BlindWrite_MCP/main/scripts/install.sh | bash
# Or with API key:
#   OPENROUTER_API_KEY="sk-or-v1-..." curl -fsSL https://raw.githubusercontent.com/ygstudio-game/BlindWrite_MCP/main/scripts/install.sh | bash

set -e

echo "======================================================"
echo "   BlindWrite MCP — 1-Click Autonomous Setup (Unix)   "
echo "======================================================"
echo ""

REPO_URL="https://github.com/ygstudio-game/BlindWrite_MCP.git"
TARGET_DIR=""

# 1. Determine Target Directory
if [ -f "./scripts/setup.js" ]; then
    TARGET_DIR="$(pwd)"
    echo "[+] Running inside existing repository: $TARGET_DIR"
elif [ -f "../scripts/setup.js" ]; then
    TARGET_DIR="$(cd .. && pwd)"
    echo "[+] Running inside repository folder: $TARGET_DIR"
else
    TARGET_DIR="$HOME/.blindwrite-mcp"
    echo "[*] Target installation folder: $TARGET_DIR"
fi

# 2. Check for Node.js
if ! command -v node >/dev/null 2>&1; then
    echo "[!] Node.js is not found in your PATH."
    echo "[*] Please install Node.js (v18+) via https://nodejs.org or your package manager (brew/apt/dnf)."
    exit 1
fi

NODE_VERSION=$(node -v)
echo "[+] Detected Node.js: $NODE_VERSION"

# 3. Clone or Update Repository
if [ ! -f "$TARGET_DIR/package.json" ]; then
    if ! command -v git >/dev/null 2>&1; then
        echo "[!] Git is required to clone the repository. Please install git."
        exit 1
    fi
    echo "[*] Cloning BlindWrite MCP into $TARGET_DIR..."
    mkdir -p "$TARGET_DIR"
    git clone "$REPO_URL" "$TARGET_DIR"
else
    echo "[+] BlindWrite MCP files detected in $TARGET_DIR"
fi

cd "$TARGET_DIR"

# 4. Install Dependencies & Build
echo "[*] Installing NPM dependencies..."
npm install

echo "[*] Compiling TypeScript project..."
npm run build

# 5. Launch Setup Wizard
echo "[*] Launching configuration wizard..."
echo ""
node scripts/setup.js "$@"

echo ""
echo "======================================================"
echo "   BlindWrite MCP Installation & Setup Complete!      "
echo "======================================================"
