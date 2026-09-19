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

# Helper for interactive prompt with fallback (works even when piped via curl | bash)
prompt_user() {
    local prompt_text="$1"
    local default_val="$2"
    local response=""

    if [ -t 0 ]; then
        read -r -p "$prompt_text" response
    elif [ -c /dev/tty ] && { exec < /dev/tty; } 2>/dev/null; then
        read -r -p "$prompt_text" response
    else
        response="$default_val"
    fi

    if [ -z "$response" ]; then
        echo "$default_val"
    else
        echo "$response"
    fi
}

# 1. Determine & Select Installation Directory
REPO_URL="https://github.com/ygstudio-game/BlindWrite_MCP.git"
DEFAULT_INSTALL_DIR="$HOME/.blindwrite-mcp"
DETECTED_DIR=""

# Check Claude Desktop configuration for existing blindwrite path
CLAUDE_CONFIG=""
if [ "$(uname)" = "Darwin" ]; then
    CLAUDE_CONFIG="$HOME/Library/Application Support/Claude/claude_desktop_config.json"
else
    CLAUDE_CONFIG="$HOME/.config/Claude/claude_desktop_config.json"
fi

if [ -f "$CLAUDE_CONFIG" ] && command -v node >/dev/null 2>&1; then
    CLAUDE_DETECTED=$(node -e '
      try {
        const c = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
        const p = c.mcpServers?.blindwrite?.args?.[0];
        if (p) {
          const path = require("path");
          const dir = path.resolve(path.dirname(p), "..");
          if (require("fs").existsSync(path.join(dir, "package.json"))) {
            console.log(dir);
          }
        }
      } catch(e) {}
    ' "$CLAUDE_CONFIG" 2>/dev/null || true)
    if [ -n "$CLAUDE_DETECTED" ]; then
        DETECTED_DIR="$CLAUDE_DETECTED"
    fi
fi

# Check current directory, parent directory, and default directory
if [ -f "./scripts/setup.js" ]; then
    DETECTED_DIR="$(pwd)"
elif [ -f "../scripts/setup.js" ]; then
    DETECTED_DIR="$(cd .. && pwd)"
elif [ -z "$DETECTED_DIR" ] && [ -f "$DEFAULT_INSTALL_DIR/package.json" ]; then
    DETECTED_DIR="$DEFAULT_INSTALL_DIR"
fi

# Check for explicit override via environment or argument
TARGET_DIR=""
if [ -n "$INSTALL_PATH" ]; then
    TARGET_DIR="$INSTALL_PATH"
    echo ">> Using installation path from environment: $TARGET_DIR"
elif [ -n "$1" ] && [[ "$1" == --path=* ]]; then
    TARGET_DIR="${1#--path=}"
    echo ">> Using installation path from argument: $TARGET_DIR"
elif [ -n "$DETECTED_DIR" ]; then
    echo "[+] Detected existing BlindWrite MCP installation at: $DETECTED_DIR"
    echo ""
    KEEP=$(prompt_user "Use this installation directory? (Y/n - 'n' to choose a different path) [Y]: " "Y")
    if [ "$KEEP" = "n" ] || [ "$KEEP" = "N" ]; then
        CUSTOM=$(prompt_user "Enter new installation directory [$DEFAULT_INSTALL_DIR]: " "$DEFAULT_INSTALL_DIR")
        TARGET_DIR="${CUSTOM:-$DEFAULT_INSTALL_DIR}"
    else
        TARGET_DIR="$DETECTED_DIR"
    fi
else
    echo "[*] Default target installation folder: $DEFAULT_INSTALL_DIR"
    echo ""
    CUSTOM=$(prompt_user "Enter installation directory (press Enter to accept default) [$DEFAULT_INSTALL_DIR]: " "$DEFAULT_INSTALL_DIR")
    TARGET_DIR="${CUSTOM:-$DEFAULT_INSTALL_DIR}"
fi

# Expand tilde ~ if present
TARGET_DIR="${TARGET_DIR/#\~/$HOME}"
echo "[+] Target installation path set to: $TARGET_DIR"
echo ""

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
    echo "[+] Existing BlindWrite MCP installation detected in $TARGET_DIR"
    echo "[*] Pulling latest updates from GitHub..."
    DEFAULT_INSTALL_DIR="$HOME/.blindwrite-mcp"
    if [ -d "$TARGET_DIR/.git" ]; then
        if [ "$TARGET_DIR" = "$DEFAULT_INSTALL_DIR" ]; then
            git -C "$TARGET_DIR" fetch origin main
            git -C "$TARGET_DIR" reset --hard origin/main
        else
            git -C "$TARGET_DIR" checkout -- skills/writing-orchestrator.zip .claude/skills/writing-orchestrator/SKILL.md package-lock.json 2>/dev/null || true
            git -C "$TARGET_DIR" pull origin main
        fi
    else
        echo "[*] Directory is not a git repository clone. Skipping git pull."
    fi
fi

cd "$TARGET_DIR"

# 4. Install Dependencies & Build
echo "[*] Installing NPM dependencies (using precompiled native binaries)..."
npm install --ignore-scripts || npm install

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
