# BlindWrite MCP 🖋️
 
> **Think with Claude, Write with OpenRouter.**
> Production-grade Model Context Protocol (MCP) server for blind, bias-free AI writing benchmarks and high-speed token-saving writing delegation inside Claude Desktop.
 
[![Tests](https://img.shields.io/badge/tests-29%20passed-brightgreen.svg)](#testing)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7+-blue.svg)](#tech-stack)
[![Node](https://img.shields.io/badge/Node.js-24%20LTS-green.svg)](#tech-stack)
[![License](https://img.shields.io/badge/License-MIT-purple.svg)](#license)
 
---
 
## 1. Problem & Purpose
 
Writers, marketers, and knowledge workers face two major challenges when using LLMs for writing:
1. **Token Inefficiency & Cost**: Asking Claude to generate thousands of words of draft text burns through Claude output limits and tokens rapidly.
2. **Brand Bias in Model Selection**: When picking an AI model, brand names ("GPT-4o", "Claude 3.5 Sonnet") skew perception, even when lightweight, ultra-cheap models (e.g. DeepSeek V3 at $0.14/1M tokens) might write better copy for your specific voice.
 
**BlindWrite MCP** introduces the **"Think with Claude, Write with OpenRouter"** hybrid workflow:
- **Claude for Thinking & Strategy**: Claude handles deep reasoning, structural outlines, audience angles, and critical review.
- **OpenRouter for Heavy Writing**: Claude delegates long-form drafting directly via `writer_generate` to your top-ranked OpenRouter model (or DeepSeek V3), generating drafts in seconds while saving thousands of Claude generation tokens.
- **Blind A/B Benchmarking**: When testing styles, competing frontier models generate blind drafts (`Response A` vs `Response B`) with zero brand leakage. You vote, and the Bradley-Terry MLE & Elo engine trains your personal leaderboard!
- **Preference Analytics**: Discovers empirical writing metrics (conciseness, bulleted structure, formality) to show *why* your top models resonate with you.

---

## 2. Architecture

```
 ┌─────────────────────────────────────────────────────────────┐
 │                 Claude Desktop (Client UI)                  │
 └──────────────────────────────┬──────────────────────────────┘
                                │
                                │ stdio JSON-RPC (MCP)
                                ▼
 ┌─────────────────────────────────────────────────────────────┐
 │                       BlindWrite MCP                        │
 │                                                             │
 │  ┌───────────────────────────────────────────────────────┐  │
 │  │                    MCP Tools Layer                    │  │
 │  │  10 Tools • Zod Schemas • Strict Blindness Gating     │  │
 │  └───────────────────────────┬───────────────────────────┘  │
 │                              │                              │
 │  ┌───────────────────────────▼───────────────────────────┐  │
 │  │                 Domain Services Layer                 │  │
 │  │  - BenchmarkService    - Duel & RandomizationService  │  │
 │  │  - VotingService       - Bradley-Terry & Elo Engine   │  │
 │  │  - AnalyticsService    - OpenRouterClient & Cost      │  │
 │  └─────────────┬───────────────────────────┬─────────────┘  │
 │                │                           │                │
 │                ▼                           ▼                │
 │  ┌──────────────────────────┐ ┌──────────────────────────┐  │
 │  │   SQLite Data Layer      │ │    OpenRouter Gateway    │  │
 │  │  - WAL mode & Pragma FK  │ │  - Latency measurement   │  │
 │  │  - Repositories: Tasks,  │ │  - Token & cost tracking │  │
 │  │    Models, Outputs,      │ │  - Error & retry policy  │  │
 │  │    Battles, Votes        │ └────────────┬─────────────┘  │
 │  └──────────────────────────┘              │                │
 └────────────────────────────────────────────┼────────────────┘
                                              │ HTTPS
                                              ▼
                               ┌─────────────────────────────┐
                               │       OpenRouter API        │
                               │ ┌─────────┬─────────┬─────┐ │
                               │ │ Claude  │ GPT-4o  │ ... │ │
                               │ └─────────┴─────────┴─────┘ │
                               └─────────────────────────────┘
```

> **Critical Stdio Hygiene:** Standard output (`stdout`) is strictly reserved for MCP JSON-RPC protocol packets. All internal diagnostics, logging, and error output route exclusively to `stderr`, guaranteeing that Claude Desktop never crashes from corrupted transport data.

---

## 3. The 11 MCP Tools

| Tool Name | Purpose | Role in "Think with Claude, Write with OpenRouter" |
|---|---|---|
| `writer_generate` | Directly generates drafts with OpenRouter | **Token-Saver**: Claude outlines; OpenRouter model writes the draft |
| `benchmark_create_task` | Creates a new writing benchmark task | Assigns clean task ID; status `created` |
| `benchmark_list_models` | Lists models with pricing & status | Used for model selection and registry status |
| `benchmark_generate_outputs` | Dispatches prompt to models in parallel | Returns ONLY anonymous tokens (`anon_xxxx`), zero model names |
| `benchmark_start_duel` | Starts a randomized, blind A/B battle | 50/50 coin toss determines Response A vs B; eliminates brand bias |
| `benchmark_submit_vote` | Submits preference (`A`, `B`, or `tie`) | Records vote, updates Bradley-Terry & Elo ratings |
| `benchmark_get_results` | Retrieves task results; unmasks on reveal | Identities remain hidden until explicit user reveal |
| `benchmark_get_leaderboard` | Returns personal or global leaderboards | Bradley-Terry MLE & Elo rankings guide `writer_generate` |
| `benchmark_compare_models` | Head-to-head comparison of two models | Direct win/loss record and dimensional ratings |
| `benchmark_analyze_preferences` | Discovers personal writing style preferences | Explains why certain models work best for you |
| `benchmark_get_model_stats` | Deep performance card for a single model | Battle record, win rate, latency, and token cost |

---

## 4. Pre-Seeded Writing Categories & Models

### Writing Categories
- `General Writing`
- `Emails` (Cold outreach, executive memos, customer service)
- `Business Writing` (Proposals, pitches, quarterly summaries)
- `Creative Writing` (Narrative storytelling, dialogue, fiction)
- `Marketing` (Ad copy, landing pages, taglines)
- `Summarization` (Executive briefs, meeting notes)
- `Rewriting` (Tone shifting, simplifying complex text)
- `Technical Writing` (API documentation, engineering RFCs)
- `Persuasive Writing` (Op-eds, debate arguments, sales letters)
- `Research Writing` (Literature synthesis, analytical essays)
- `Social Media` (Threads, LinkedIn posts, announcements)
- `Instruction Following` (Constraint adherence, exact formatting)

### Seed Models (OpenRouter)
- **Anthropic Claude 3.5 Sonnet** (`anthropic/claude-3.5-sonnet`)
- **OpenAI GPT-4o** (`openai/gpt-4o`)
- **Google Gemini 1.5 Pro** (`google/gemini-pro-1.5`)
- **DeepSeek V3** (`deepseek/deepseek-chat`)
- **Meta Llama 3.3 70B Instruct** (`meta-llama/llama-3.3-70b-instruct`)
- **Qwen 2.5 72B Instruct** (`qwen/qwen-2.5-72b-instruct`)

---

## 5. Quickstart & Installation

### Option A: 1-Line Autonomous Remote Installer (Fastest — No Git Clone Required)

Run a single command in your terminal. It will automatically check/install Node.js & Git, clone into your user directory, build the project, prompt for your OpenRouter key, auto-install the Writing Orchestrator Skill, and configure Claude Desktop:

#### Windows (PowerShell):
```powershell
irm https://raw.githubusercontent.com/ygstudio-game/BlindWrite_MCP/main/scripts/install.ps1 | iex
```
*(Tip: You can pre-supply your key to make it 100% headless: `$env:OPENROUTER_API_KEY="sk-or-v1-..."; irm https://raw.githubusercontent.com/ygstudio-game/BlindWrite_MCP/main/scripts/install.ps1 | iex`)*

#### macOS & Linux (Terminal):
```bash
curl -fsSL https://raw.githubusercontent.com/ygstudio-game/BlindWrite_MCP/main/scripts/install.sh | bash
```
*(Tip: Or headless: `OPENROUTER_API_KEY="sk-or-v1-..." curl -fsSL https://raw.githubusercontent.com/ygstudio-game/BlindWrite_MCP/main/scripts/install.sh | bash`)*

#### Manual Skill Installation (If using 1-Line Remote Installer):
While the remote installer automatically registers the MCP server in `claude_desktop_config.json`, you can also manually install or upload the Writing Orchestrator Skill to your Claude environment:

1. **Claude Desktop App (Account Upload via UI)**:
   - Download the pre-packaged ZIP archive: [**`writing-orchestrator.zip`**](https://github.com/ygstudio-game/BlindWrite_MCP/raw/main/skills/writing-orchestrator.zip) (or grab it from your installation folder at `%LOCALAPPDATA%\BlindWrite_MCP\skills\writing-orchestrator.zip` on Windows, or `~/.blindwrite-mcp/skills/writing-orchestrator.zip` on macOS/Linux).
   - In Claude Desktop, open **Customize** > **Skills** from the sidebar.
   - Click the **`+`** button and choose **"Upload a skill"**, then select `writing-orchestrator.zip`.
   - Ensure the skill toggle is switched **ON** (synced directly to your Anthropic account in the cloud).

2. **Claude Code / Terminal Integration (Local Filesystem)**:
   - **Windows (PowerShell)**:
     ```powershell
     New-Item -ItemType Directory -Force -Path "$HOME\.claude\skills\writing-orchestrator"
     Invoke-WebRequest -Uri "https://raw.githubusercontent.com/ygstudio-game/BlindWrite_MCP/main/skills/writing-orchestrator/SKILL.md" -OutFile "$HOME\.claude\skills\writing-orchestrator\SKILL.md"
     ```
   - **macOS / Linux (Bash)**:
     ```bash
     mkdir -p ~/.claude/skills/writing-orchestrator && curl -fsSL https://raw.githubusercontent.com/ygstudio-game/BlindWrite_MCP/main/skills/writing-orchestrator/SKILL.md -o ~/.claude/skills/writing-orchestrator/SKILL.md
     ```

3. **Zero-Setup Native MCP Prompt**:
   - The installer already configures Claude Desktop to expose the `/writing-orchestrator` MCP Prompt natively. You can type `/writing-orchestrator` directly in any chat without copying any files!

---

### Option B: Local 1-Click Setup (If already cloned)

#### On Windows:
Simply run `setup.bat` (or double-click it in File Explorer):
```cmd
setup.bat
```
* **Auto-installs Node.js** via `winget` if not detected on your system.
* Installs dependencies (`npm install`).
* Compiles TypeScript (`npm run build`).
* Prompts for your OpenRouter API key.
* **Automatically merges** the configuration into `%APPDATA%\Claude\claude_desktop_config.json` (with automatic backup).
* **Auto-installs the Writing Orchestrator Skill** into `~/.claude/skills/writing-orchestrator` and agent environments.

#### On macOS / Linux:
```bash
chmod +x setup.sh
./setup.sh
# or after npm install:
npm run setup
```

---

### Option C: Manual Setup

1. **Clone and Install**:
```bash
git clone https://github.com/ygstudio-game/BlindWrite_MCP.git
cd BlindWrite_MCP
npm install
```

2. **Configure Environment**:
```bash
cp .env.example .env
```
Edit `.env` and set `OPENROUTER_API_KEY=sk-or-v1-...`.

3. **Build and Run Setup Wizard**:
```bash
npm run build
npm run setup
```
The interactive wizard will automatically resolve exact paths and update Claude Desktop for you!

---

## 6. Claude Desktop Configuration (Manual)

If you prefer to configure Claude Desktop manually instead of using `npm run setup`:

1. Open your Claude Desktop configuration file:
   - **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
   - **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
2. Add the `blindwrite` server:

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

> **Platform Path Examples:**
> - **macOS / Linux:** `"/Users/yourname/projects/BlindWrite_MCP/dist/index.js"`
> - **Windows:** `"C:\\Users\\yourname\\projects\\BlindWrite_MCP\\dist\\index.js"` *(ensure backslashes are escaped with `\\`)*

3. Restart Claude Desktop. You will see the hammer icon with all 11 BlindWrite tools ready to use!
4. **Writing Orchestrator Skill & Prompt:**
   - **Skill Source**: Read the complete skill definition in [`skills/writing-orchestrator/SKILL.md`](https://github.com/ygstudio-game/BlindWrite_MCP/blob/main/skills/writing-orchestrator/SKILL.md).
   - **1-Click Upload ZIP**: Download the pre-packaged [**`writing-orchestrator.zip`**](https://github.com/ygstudio-game/BlindWrite_MCP/raw/main/skills/writing-orchestrator.zip) and upload it directly in Claude Desktop (**Customize** > **Skills** > **`+`** > **Upload a skill**).
   - **Auto-Installed Local Folders**: The setup script auto-populates `%APPDATA%\Claude\skills\writing-orchestrator\SKILL.md`, `~/.claude/skills/writing-orchestrator/SKILL.md`, and project-level `.claude/skills/`.
   - **Native MCP Prompt**: The server natively registers the `/writing-orchestrator` prompt accessible directly inside Claude Desktop chat without uploading any files!
   - **Project Instructions**: For Claude Desktop Projects, copy [`CLAUDE_PROMPT.md`](https://github.com/ygstudio-game/BlindWrite_MCP/blob/main/CLAUDE_PROMPT.md) into your Project's *Custom Instructions*.
   - **How to invoke in chat**: Simply tell Claude:
     > *"Use the writing-orchestrator skill to outline our strategy and draft..."*  
     or select the `/writing-orchestrator` prompt template from the chat input menu.

---

## 7. Example Workflows in Claude Desktop

### Workflow A: High-Conversion B2B Cold Outreach Email
**Goal**: Craft a personalized, high-response email while saving Claude output tokens.

**You:**
> *"Help me draft a 120-word cold outreach email to a VP of Sales about our developer platform. Use the writing-orchestrator skill to outline the strategy first and use writer_generate to draft it."*

**Claude (Thinking & Strategy Brain):**
1. Analyzes the VP of Sales persona (time-poor, quota-focused, values proven ROI).
2. Formulates the prompt blueprint (Hook: shortening deal cycles by 40%; Body: 2 concrete metrics; CTA: 10-minute intro).
3. **Delegates drafting**: Calls `writer_generate(category: "Emails", prompt: "...", max_tokens: 400)`.
4. OpenRouter generates the draft in ~800ms using your personal #1 model (e.g. DeepSeek V3 for $0.0003).
5. Claude presents the generated email, reports token metrics (saved ~300 Claude output tokens), and suggests two high-impact subject lines.

---

### Workflow B: Technical Architecture RFC / Migration Spec
**Goal**: Generate a comprehensive 1,500-word engineering RFC with deep strategic framing.

**You:**
> *"We need an RFC for migrating our monolithic PostgreSQL database to a globally distributed database with zero downtime. Use the writing-orchestrator skill to structure the technical plan and delegate the drafting."*

**Claude (Thinking & Strategy Brain):**
1. Produces an architectural breakdown:
   - Problem statement & current bottlenecks
   - Dual-write replication architecture & cutover sequence
   - Failure modes, rollback triggers, and data validation
2. Calls `writer_generate(category: "Technical Writing", prompt: "Write section 2 and 3 covering dual-write synchronization and consistency models...", max_tokens: 2500)`.
3. OpenRouter streams the extensive technical draft in seconds.
4. Claude critically audits the draft, flags edge cases in network partition scenarios, and polishes the summary.

---

### Workflow C: High-Converting SaaS Landing Page Copy
**Goal**: Draft hero headlines, subheads, and 3 value pillars.

**You:**
> *"Write landing page hero section copy and 3 core value pillars for an AI agent observability tool. Use the writing-orchestrator skill."*

**Claude (Thinking & Strategy Brain):**
1. Outlines the positioning: Anti-hype, focused on debugging production hallucinations and latency spikes.
2. Calls `writer_generate(category: "Marketing Copy", prompt: "Craft punchy H1 headline, 2-sentence subhead, and 3 customer-outcome pillars with proof points...", max_tokens: 800)`.
3. Displays the full landing page copy with clear visual hierarchy, ready for deployment.

---

### Workflow D: Thought Leadership / Technical Blog Post
**Goal**: Write an engaging 800-word essay with a contrarian engineering thesis.

**You:**
> *"Draft an engineering blog post arguing why autonomous agent swarms will replace traditional CI/CD pipelines by 2027. Use the writing-orchestrator skill."*

**Claude (Thinking & Strategy Brain):**
1. Establishes the contrarian hook, 3 narrative beats, and concrete code pipeline analogies.
2. Calls `writer_generate(category: "Blog Posts", prompt: "...", max_tokens: 1500)`.
3. OpenRouter drafts the essay using your preferred style profile.
4. Claude reviews flow, rhythm, and tone, delivering an impactful publication-ready draft.

---

### Workflow E: Blind A/B Benchmark Duel (Style Discovery)
**Goal**: Objectively determine which frontier model writes best for your personal voice without brand bias.

**You:**
> *"Benchmark the best models for writing an executive pitch email to CTOs."*

**Claude:**
1. Calls `benchmark_create_task(title: "CTO Pitch", category: "Emails", prompt: "...")`.
2. Calls `benchmark_generate_outputs(taskId)` to query competing models in parallel via OpenRouter.
3. Calls `benchmark_start_duel(taskId)` and displays anonymous options:
   > **Response A:**  
   > *[Anonymous output]*  
   >  
   > **Response B:**  
   > *[Anonymous output]*  
   >  
   > *Which response is more compelling, A or B?*
4. You vote: *"Response A is punchier and highlights developer productivity much better."*
5. Claude calls `benchmark_submit_vote(battleId, choice: "A")`.
6. When satisfied, you ask: *"Reveal results!"*
7. Claude calls `benchmark_get_results(taskId, reveal: true)`:
   - Response A was **Claude 3.5 Sonnet** (Score: 1240, Latency: 780ms)
   - Response B was **GPT-4o** (Score: 1195, Latency: 910ms)
8. Claude calls `benchmark_get_leaderboard` and `benchmark_analyze_preferences` to update your personal ranking!

---

## 8. Mathematical Ranking Details

### Bradley-Terry Maximum Likelihood Estimation (MLE)
Pairwise choice probabilities follow:
$$P(i \succ j) = \frac{\pi_i}{\pi_i + \pi_j} = \frac{e^{\beta_i}}{e^{\beta_i} + e^{\beta_j}}$$

The model latent parameters $\pi$ are solved using the iterative **Minorization-Maximization (MM / Hunter 2004)** algorithm with Laplace prior regularization ($\alpha = 1.0$) for numerical stability with disconnected matchup graphs:
$$\pi_i^{(t+1)} = \frac{W_i + \alpha}{\sum_{j \ne i} \frac{N_{ij}}{\pi_i^{(t)} + \pi_j^{(t)}} + \alpha}$$

- **Uncertainty Quantification**: Standard errors are derived from the observed Fisher Information matrix:
  - $< 5$ battles: *Preliminary (High Uncertainty)*
  - $5–15$ battles: *Emerging (Moderate Uncertainty)*
  - $> 15$ battles: *Established (High Confidence)*

---

## 9. Testing

The project includes an extensive test suite verifying mathematical correctness, zero-bias coin toss distributions, strict anonymity boundaries, and end-to-end tournament simulations:

```bash
# Run all unit and integration tests
npm test

# Run tests in watch mode
npm run test:watch
```

---

## 10. License

MIT © Yadnyesh Borole.
