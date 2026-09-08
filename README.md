# BlindWrite MCP 🖋️

> **Production-grade Model Context Protocol (MCP) server for blind, bias-free AI writing benchmarks inside Claude Desktop using OpenRouter.**

[![Tests](https://img.shields.io/badge/tests-26%20passed-brightgreen.svg)](#testing)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7+-blue.svg)](#tech-stack)
[![Node](https://img.shields.io/badge/Node.js-24%20LTS-green.svg)](#tech-stack)
[![License](https://img.shields.io/badge/License-MIT-purple.svg)](#license)

---

## 1. Problem & Purpose

Public AI benchmarks (e.g. Chatbot Arena, LMSYS, MMLU, AlpacaEval) measure general coding or broad knowledge. They fail to answer the most critical question for writers, knowledge workers, and marketers:

> **"Which AI writing model is actually best for *me* and *my* personal style, tone, and specific writing tasks?"**

Furthermore, evaluations are heavily skewed by **brand bias**: when an evaluator sees "OpenAI GPT-4o" or "Anthropic Claude 3.5 Sonnet", cognitive bias leads them to rate prominent brand names higher.

**BlindWrite MCP** transforms Claude Desktop into an objective blind evaluation arena:
- **Zero Model Leakage**: Competing models generate responses to the identical prompt, but outputs are stripped of names, providers, and logos, receiving cryptographically randomized tokens (`Response A` vs `Response B`).
- **Cryptographic Anti-Bias Pairing**: Random 50/50 position assignment eliminates positional bias.
- **Mathematical Pairwise Rankings**: Evaluates choices using **Bradley-Terry Maximum Likelihood Estimation (MM iteration)** with Laplace prior regularization and Fisher Information confidence intervals, alongside dynamic **Elo** ratings.
- **Preference Analytics Engine**: Correlates user voting behavior with writing metrics (brevity, bulleted structure, formality) to explain *why* top models work best for you.
- **Tournament Reveal Stage**: Model identities are unmasked only when you conclude voting and request final results.

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

## 3. The 10 MCP Tools

| Tool Name | Purpose | Blindness Protection |
|---|---|---|
| `benchmark_create_task` | Creates a new writing task with category and prompt | Assigns clean task ID; status `created` |
| `benchmark_list_models` | Lists models in the registry with pricing and status | Used for benchmark configuration |
| `benchmark_generate_outputs` | Dispatches prompt to models via OpenRouter in parallel | Returns ONLY anonymous tokens (`anon_xxxx`), zero model names |
| `benchmark_start_duel` | Starts a randomized, blind A/B battle | 50/50 coin toss determines Response A vs B; identities hidden |
| `benchmark_submit_vote` | Submits preference (`A`, `B`, or `tie`) with optional scores | Records vote, updates Elo; models remain hidden |
| `benchmark_get_results` | Retrieves task results; unmasks when `reveal: true` | Identities remain masked until explicit reveal |
| `benchmark_get_leaderboard` | Returns personal or global model leaderboards | Ranked by Bradley-Terry MLE or Elo with confidence levels |
| `benchmark_compare_models` | Head-to-head comparison between two specific models | Direct win/loss/tie record, win percentages, and dimension ratings |
| `benchmark_analyze_preferences` | Discovers writing preferences (conciseness, structure) | Empirical correlation without LLM hallucination |
| `benchmark_get_model_stats` | Exhaustive performance card for a single model | Battle record, win rate, average latency, and token cost |

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

### Prerequisites
- [Node.js](https://nodejs.org/) v20+ or v24 LTS
- An [OpenRouter API Key](https://openrouter.ai/keys)

### 1. Clone and Install
```bash
git clone https://github.com/your-org/BlindWrite_MCP.git
cd BlindWrite_MCP
npm install
```

### 2. Configure Environment
Create your `.env` file from the example:
```bash
cp .env.example .env
```
Edit `.env`:
```ini
OPENROUTER_API_KEY=sk-or-v1-your-actual-openrouter-key
DB_PATH=./data/blindwrite.sqlite
LOG_LEVEL=info
```

### 3. Build the Server
```bash
npm run build
```

---

## 6. Claude Desktop Configuration

To connect BlindWrite MCP to Claude Desktop:

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
*(Adjust the absolute path to match your local installation)*

3. Restart Claude Desktop. You will see the hammer icon with 10 BlindWrite tools ready to use!

---

## 7. Example Workflow in Claude Desktop

**You:**
> *"Benchmark the best models for writing a cold outreach email to CTOs."*

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

MIT © BlindWrite Contributors.
