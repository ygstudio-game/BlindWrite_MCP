# Claude Desktop Setup Guide for BlindWrite MCP

This guide walks you through connecting your local **BlindWrite MCP** server to **Claude Desktop** on Windows and macOS.

---

## 1. Prerequisites

1. **Claude Desktop**: Installed and updated to the latest version.
2. **Node.js**: v20 or v24 LTS (`node -v` in terminal).
3. **OpenRouter API Key**: Sign up at [OpenRouter](https://openrouter.ai/) and generate an API key with credits.

---

## 2. 1-Click Automated Setup (Recommended)

### On Windows:
Run `setup.bat` (or double-click it in File Explorer):
```cmd
setup.bat
```
- Checks for Node.js (installs it via winget if missing)
- Runs `npm install` and `npm run build`
- Asks for your OpenRouter API key
- Automatically merges the configuration into `%APPDATA%\Claude\claude_desktop_config.json`

### On macOS / Linux:
```bash
npm run setup
```

---

## 3. Manual Configuration (Alternative)

If you prefer to configure manually:

### Compile BlindWrite MCP
```bash
cd /path/to/BlindWrite_MCP
npm install
npm run build
```

### Locate Configuration File

- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`  
  *(Typically: `C:\Users\<YourUsername>\AppData\Roaming\Claude\claude_desktop_config.json`)*
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`

### Add the Server Entry

Open `claude_desktop_config.json` in a text editor (e.g. Notepad, VS Code) and add the `blindwrite` entry under `mcpServers`:

```json
{
  "mcpServers": {
    "blindwrite": {
      "command": "node",
      "args": [
        "/absolute/path/to/BlindWrite_MCP/dist/index.js"
      ],
      "env": {
        "OPENROUTER_API_KEY": "sk-or-v1-your-openrouter-key-here",
        "DB_PATH": "/absolute/path/to/BlindWrite_MCP/data/blindwrite.sqlite",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

> **Note on Paths**:
> - On **Windows**, escape backslashes with double backslashes: e.g. `"C:\\Users\\yourname\\projects\\BlindWrite_MCP\\dist\\index.js"`.
> - On **macOS / Linux**, use standard forward slashes: e.g. `"/Users/yourname/projects/BlindWrite_MCP/dist/index.js"`.

---

## 4. Test the Integration

1. Restart Claude Desktop completely (Right-click system tray icon -> Quit, then relaunch).
2. Open a new chat.
3. Look for the 🔨 (hammer) icon in the bottom right corner of the chat input box. Clicking it should list all 11 BlindWrite tools:
   - `writer_generate` (Primary token-saving writing delegator)
   - `benchmark_create_task`
   - `benchmark_list_models`
   - `benchmark_generate_outputs`
   - `benchmark_start_duel`
   - `benchmark_submit_vote`
   - `benchmark_get_results`
   - `benchmark_get_leaderboard`
   - `benchmark_compare_models`
   - `benchmark_analyze_preferences`
   - `benchmark_get_model_stats`

---

## 5. Skills & Prompts Architecture by Interface

Anthropic handles skills differently depending on which interface you use:

### Interface 1: Claude Desktop App (Chat / Cowork)
In the Claude Desktop App, custom skills are synced directly to your Anthropic cloud account rather than read from a local folder. You have three instant options:

- **Option A: Upload Skill (1 Click via UI — ZIP or Direct MD)**:
  1. In Claude Desktop, go to **Customize** > **Skills** in the sidebar.
  2. Click the **`+`** button and select **"Upload a skill"**.
  3. You can upload either:
     - **Option 1: ZIP Archive**: Select [`skills/writing-orchestrator.zip`](../skills/writing-orchestrator.zip) (or download [**`writing-orchestrator.zip`**](https://github.com/ygstudio-game/BlindWrite_MCP/raw/main/skills/writing-orchestrator.zip)). *Note: If you manually zip the folder on Windows, right-click the `writing-orchestrator` folder → Compress to ZIP file (or use 7-Zip).*
     - **Option 2: Direct `.md` file (No zip needed!)**: Directly select [`skills/writing-orchestrator/SKILL.md`](../skills/writing-orchestrator/SKILL.md). Claude Desktop natively accepts single `.md` skill files.
  4. Ensure the `writing-orchestrator` skill is toggled **ON**.
  5. The full skill documentation is accessible in [`skills/writing-orchestrator/SKILL.md`](../skills/writing-orchestrator/SKILL.md).

- **Option B: Native MCP Prompt (Zero Upload Needed)**:
  BlindWrite MCP automatically registers an official MCP Prompt named `writing-orchestrator`. You can invoke it immediately in Claude Desktop chat by typing `/writing-orchestrator`.

- **Option C: Project Custom Instructions**:
  If you organize your work with Claude Projects, copy [`CLAUDE_PROMPT.md`](../CLAUDE_PROMPT.md) into your Project's *Custom Instructions*.

### Interface 2: Claude Code / Terminal Integration
For CLI users, personal global and project-scoped skills are read from local filesystem directories:
- **Personal Global**: `%USERPROFILE%\.claude\skills\writing-orchestrator\SKILL.md` (macOS/Linux: `~/.claude/skills/writing-orchestrator/SKILL.md`)
- **Project-Scoped**: `.claude/skills/writing-orchestrator/SKILL.md` in your repository root
- The setup script auto-populates all of these directories automatically!

#### Manual Installation Commands (for Remote Installer Users)
- **Windows PowerShell**:
  ```powershell
  New-Item -ItemType Directory -Force -Path "$HOME\.claude\skills\writing-orchestrator"
  Invoke-WebRequest -Uri "https://raw.githubusercontent.com/ygstudio-game/BlindWrite_MCP/main/skills/writing-orchestrator/SKILL.md" -OutFile "$HOME\.claude\skills\writing-orchestrator\SKILL.md"
  ```
- **macOS / Linux**:
  ```bash
  mkdir -p ~/.claude/skills/writing-orchestrator && curl -fsSL https://raw.githubusercontent.com/ygstudio-game/BlindWrite_MCP/main/skills/writing-orchestrator/SKILL.md -o ~/.claude/skills/writing-orchestrator/SKILL.md
  ```

---

## 6. Recommended Prompts to Try

### Mode 1: Daily Direct Writing (Save Claude Tokens)

**Example 1: High-Converting B2B Cold Outreach Email**
> *"Help me draft a 120-word cold outreach email to a VP of Sales about our developer platform. Use the writing-orchestrator skill to outline the strategy first and call writer_generate to draft it."*
- **What happens**: Claude outlines the value hook, calls `writer_generate(category: "Emails")` via OpenRouter (takes ~0.8s, costs $0.0003), saves ~300 Claude output tokens, auto-saves to `data/drafts/`, and delivers directly to user without burning extra tokens on unprompted critique.

**Example 2: Technical Architecture RFC / Migration Spec**
> *"We need a technical RFC for migrating our monolithic PostgreSQL database to a globally distributed database with zero downtime. Use the writing-orchestrator skill to structure the technical plan and delegate the drafting."*
- **What happens**: Claude produces an architectural risk breakdown, then calls `writer_generate(category: "Technical Writing", max_tokens: 2500)` to stream the complete 1,500-word RFC document.

**Example 3: High-Converting SaaS Landing Page Copy**
> *"Write landing page hero section copy and 3 core value pillars for an AI agent observability tool. Use the writing-orchestrator skill."*
- **What happens**: Claude outlines positioning against market pain points and calls `writer_generate(category: "Marketing Copy")` for headlines and benefit pillars.

**Example 4: Thought Leadership / Engineering Blog Post**
> *"Draft an engineering blog post arguing why autonomous agent swarms will replace traditional CI/CD pipelines by 2027. Use the writing-orchestrator skill."*
- **What happens**: Claude establishes the contrarian hook and outline, delegating the full draft to OpenRouter using your personal #1 model.

---

### Mode 2: Blind A/B Benchmarking (Discover Your Style)
- *"Benchmark the top writing models for writing executive pitch emails."*
- *"Show me my personal writing leaderboard across all models."*
- *"Analyze my writing preferences based on my past benchmark votes."*
- *"Compare Claude 3.5 Sonnet vs GPT-4o head-to-head in technical writing."*

---

**Author:** Yadnyesh Borole  
**Repository:** [https://github.com/ygstudio-game/BlindWrite_MCP](https://github.com/ygstudio-game/BlindWrite_MCP)

