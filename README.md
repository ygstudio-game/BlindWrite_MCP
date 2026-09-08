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

Run a single command in your terminal. It will automatically check/install Node.js & Git, clone into your user directory, build the project, prompt for your OpenRouter key, and configure Claude Desktop:

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

---

## 7. Example Workflows in Claude Desktop

### Workflow A: Direct Token-Saving Drafting (Daily Work)

**You:**
> *"Help me draft a 120-word cold outreach email to a VP of Sales about our developer platform. Outline the strategy and use writer_generate to draft it."*

**Claude:**
1. Briefly outlines the strategy, target persona, and hook in 2-3 bullets (saving Claude output tokens).
2. Calls `writer_generate(category: "Emails", prompt: "...")`.
3. OpenRouter generates the complete draft in ~1 second using your personal #1 model (or DeepSeek V3 for ~$0.0003).
4. Claude presents the generated draft, reports the tokens saved and cost, and provides 1-2 sharp polish recommendations!

---

### Workflow B: Blind A/B Benchmark Duel (Style Discovery)

**You:**
> *"Benchmark the best models for writing an executive pitch email to CTOs."*

**Claude:**
1. Calls `benchmark_create_task` with category `"Emails"` and your prompt.
2. Calls `benchmark_generate_outputs` to query competing frontier models via OpenRouter simultaneously.
3. Calls `benchmark_start_duel` and displays:
   > **Response A:**  
   > *[Anonymous output]*  
   >  
   > **Response B:**  
   > *[Anonymous output]*  
   >  
   > *Which response is more compelling, A or B?*
4. You reply: *"Response A is much punchier and has clearer ROI bullets."*
5. Claude calls `benchmark_submit_vote` and presents the next matchup.
6. Once satisfied, you say: *"Show me the results!"*
7. Claude calls `benchmark_get_results(reveal: true)` and reveals:
   - Response A was generated by **Claude 3.5 Sonnet** (Latency: 780ms, Cost: $0.0012).
   - Response B was generated by **GPT-4o** (Latency: 910ms, Cost: $0.0010).
8. Claude calls `benchmark_get_leaderboard` and `benchmark_analyze_preferences` to present your personalized writing style profile!

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
