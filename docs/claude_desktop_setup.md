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

## 5. Skills & Prompts for Claude Desktop

BlindWrite MCP offers three seamless ways to instruct Claude to think while delegating writing:

1. **Auto-Installed Skill**: The setup wizard automatically installs the `writing-orchestrator` skill to `%APPDATA%\Claude\skills\writing-orchestrator\SKILL.md` (and `~/.claude/skills/writing-orchestrator/SKILL.md`).
2. **Native MCP Prompt**: BlindWrite registers an official MCP prompt named `writing-orchestrator`. You can invoke it directly inside Claude Desktop via prompt menus / `/writing-orchestrator`.
3. **Project Custom Instructions**: If you use Claude Desktop Projects, copy the contents of [`CLAUDE_PROMPT.md`](../CLAUDE_PROMPT.md) directly into your Project's *Custom Instructions*.

---

## 6. Recommended Prompts to Try

### Mode 1: Daily Direct Writing (Save Claude Tokens)
- *"Help me write a cold outreach email to a VP of Sales. Outline the strategy first and use writer_generate to draft it with my top-ranked model."*
- *"Outline a technical RFC for our authentication migration and delegate the draft using writer_generate."*

### Mode 2: Blind A/B Benchmarking (Discover Your Style)
- *"Benchmark the top writing models for writing executive pitch emails."*
- *"Show me my personal writing leaderboard across all models."*
- *"Analyze my writing preferences based on my past benchmark votes."*
- *"Compare Claude 3.5 Sonnet vs GPT-4o head-to-head in technical writing."*

---

**Author:** Yadnyesh Borole  
**Repository:** [https://github.com/ygstudio-game/BlindWrite_MCP](https://github.com/ygstudio-game/BlindWrite_MCP)

