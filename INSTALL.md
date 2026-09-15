# Install BlindWrite MCP

## Windows

1. Open PowerShell.
2. Run:
   ```powershell
   irm https://raw.githubusercontent.com/ygstudio-game/BlindWrite_MCP/main/scripts/install.ps1 | iex
   ```
3. Enter your OpenRouter API key when prompted.
4. Restart Claude Desktop.
5. In Claude Desktop, go to **Customize > Skills**, click **+ > Upload a skill**, and upload `skills/writing-orchestrator/SKILL.md` (or `skills/writing-orchestrator.zip`).
6. Open Claude Desktop **Settings > Profile > Custom Instructions**, and paste the contents of [`CLAUDE_PROMPT.md`](./CLAUDE_PROMPT.md).

## macOS / Linux

1. Open a terminal.
2. Run:
   ```bash
   curl -fsSL https://raw.githubusercontent.com/ygstudio-game/BlindWrite_MCP/main/scripts/install.sh | bash
   ```
3. Enter your OpenRouter API key when prompted.
4. Restart Claude Desktop.
5. In Claude Desktop, go to **Customize > Skills**, click **+ > Upload a skill**, and upload `skills/writing-orchestrator/SKILL.md` (or `skills/writing-orchestrator.zip`).
6. Open Claude Desktop **Settings > Profile > Custom Instructions**, and paste the contents of [`CLAUDE_PROMPT.md`](./CLAUDE_PROMPT.md).

## Verify

1. Open a new Claude Desktop chat.
2. Check the 🔨 hammer icon in the chat input box — it should list `writer_generate` and the other BlindWrite tools.
3. Ask Claude to draft something (e.g. "write a short blog post about X"). Confirm it calls `writer_generate` instead of writing the draft itself.
