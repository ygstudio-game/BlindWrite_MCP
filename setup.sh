#!/usr/bin/env bash
set -e

echo "======================================================"
echo "   BlindWrite MCP -- Unix 1-Click Setup & Install     "
echo "======================================================"
echo ""

# 1. Check for Node.js
if ! command -v node >/dev/null 2>&1; then
    echo "[!] Node.js is not installed."
    if command -v brew >/dev/null 2>&1; then
        echo "[*] Installing Node.js via Homebrew..."
        brew install node
    elif command -v apt-get >/dev/null 2>&1; then
        echo "[*] Installing Node.js via apt..."
        curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
        sudo apt-get install -y nodejs
    else
        echo "[!] Please install Node.js from https://nodejs.org/ and re-run setup.sh"
        exit 1
    fi
fi

echo "[+] Detected Node.js: $(node -v) (npm: $(npm -v))"
echo ""

# 2. Install dependencies
echo "[*] Installing dependencies with npm install (using precompiled native binaries)..."
npm install --ignore-scripts || npm install

# 3. Build project
echo "[*] Compiling TypeScript with npm run build..."
npm run build

# 4. Run setup wizard
echo "[*] Launching BlindWrite MCP configuration wizard..."
echo ""
node scripts/setup.js "$@"
