# Claude Desktop Setup Guide for BlindWrite MCP

This guide walks you through connecting your local **BlindWrite MCP** server to **Claude Desktop** on Windows and macOS.

---

## 1. Prerequisites

1. **Claude Desktop**: Installed and updated to the latest version.
2. **Node.js**: v20 or v24 LTS (`node -v` in terminal).
3. **OpenRouter API Key**: Sign up at [OpenRouter](https://openrouter.ai/) and generate an API key with credits.

---

## 2. Compile BlindWrite MCP

Ensure the project is built locally:

```bash
cd "D:\COding\InternShip Work\E-STUDYPAL\LAUNCHPIT\BlindWrite_MCP"
npm install
npm run build
```

Verify that `dist/index.js` exists.

---

## 3. Configure Claude Desktop

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
        "D:\\COding\\InternShip Work\\E-STUDYPAL\\LAUNCHPIT\\BlindWrite_MCP\\dist\\index.js"
      ],
      "env": {
        "OPENROUTER_API_KEY": "sk-or-v1-your-openrouter-key-here",
        "DB_PATH": "D:\\COding\\InternShip Work\\E-STUDYPAL\\LAUNCHPIT\\BlindWrite_MCP\\data\\blindwrite.sqlite",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

> **Note on Windows Paths**: In JSON files, backslashes must be escaped with double backslashes (`\\`).

---

## 4. Test the Integration

1. Restart Claude Desktop completely (Right-click system tray icon -> Quit, then relaunch).
2. Open a new chat.
3. Look for the 🔨 (hammer) icon in the bottom right corner of the chat input box. Clicking it should list the 10 `benchmark_*` tools:
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

## 5. Recommended Prompts to Try

Try asking Claude:
- *"Benchmark the top writing models for writing executive pitch emails."*
- *"Show me my personal writing leaderboard across all models."*
- *"Analyze my writing preferences based on my past benchmark votes."*
- *"Compare Claude 3.5 Sonnet vs GPT-4o head-to-head in technical writing."*
