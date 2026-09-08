---
name: writing-orchestrator
description: "Orchestrates AI writing workflows using Claude as the thinking/strategy brain and OpenRouter models as the writing execution engine via BlindWrite MCP. Use when drafting content, benchmarking models, or saving Claude output tokens."
---

# Writing Orchestrator Skill 🖋️⚡

> **Core Philosophy:** Think with Claude, Write with OpenRouter.  
> Claude provides the strategic intelligence (audience analysis, prompt framing, angle refinement, outline structure, and critical review). OpenRouter models handle the token-heavy drafting in seconds at a fraction of the cost.

Author: **Yadnyesh Borole**  
Repository: [https://github.com/ygstudio-game/BlindWrite_MCP](https://github.com/ygstudio-game/BlindWrite_MCP)

---

## When to Use

Use this skill whenever:
1. **Drafting content**: You need cold outreach emails, executive memos, blog posts, sales copy, technical RFCs, or social threads.
2. **Saving tokens**: You want to avoid burning Claude output limits and quota on generating 1,000+ words of text.
3. **Benchmarking models**: You want to objectively discover which frontier model (DeepSeek V3, Claude 3.5 Sonnet, GPT-4o, Llama 3.3, Gemini Pro) writes best for your personal voice without brand bias.

---

## The 3-Step Orchestration Loop (Zero Token Waste) ⚡

```
┌─────────────────────────────────────────────────────────────┐
│ 1. THINK & OUTLINE (Claude — 30-50 tokens)                  │
│ - Clarify target audience, desired tone, and core goal.     │
│ - Structure an outline or prompt blueprint (2-4 bullets).   │
│ - DO NOT generate the final long text with Claude tokens.   │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│ 2. DELEGATE GENERATION (OpenRouter via writer_generate)     │
│ - Daily Work: Call `writer_generate` (uses #1 ranked model) │
│ - Optional: Pass `include_critique: true` for cheap review  │
│ - Auto-exports a local copy to data/drafts/                 │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│ 3. DIRECT DELIVERY (Zero Token Waste)                       │
│ - Present the draft verbatim with the token/cost badge.     │
│ - DO NOT burn Claude output tokens on unprompted critique.  │
│ - Ask: "Want me to critique this or refine any section?"    │
└─────────────────────────────────────────────────────────────┘
```

---

## Two Execution Workflows

### Workflow 1: Direct Token-Saving Drafting (80% of Daily Tasks)

When the user asks: *"Help me draft a sales pitch email to engineering leaders"*:

1. **Think & Outline**:
   - Objective: Secure a 15-minute product intro.
   - Persona: Engineering VP/CTO (values brevity, ROI, developer happiness).
   - Angle: Highlighting 70% reduction in setup time.
2. **Execute Delegation**:
   - Call `writer_generate`:
     ```json
     {
       "prompt": "Write a punchy 120-word cold outreach email to a CTO. Emphasize a 70% setup time reduction, zero developer friction, and include a soft call to action.",
       "category": "Emails",
       "include_critique": false,
       "export_file": true,
       "temperature": 0.7
     }
     ```
   - **Why this works**: `writer_generate` automatically queries your personal leaderboard, selects your #1 model for "Emails" (or defaults to DeepSeek V3 at $0.14/1M tokens), and auto-exports a local markdown file to `data/drafts/`.
3. **Direct Delivery (Zero Token Waste)**:
   - Present the draft immediately with the metrics badge:
     > ⚡ **Generated via DeepSeek V3** | ⏱️ 820ms | 💰 $0.0003 | 🛡️ **~420 Claude tokens saved** | 📁 Saved to: `data/drafts/...`
   - Ask 1 closing question: *"Want me to critique this or refine any specific section?"*
   - **The Anti-Tax Rule**: Strictly DO NOT generate an unprompted analysis, critique, or rewrite. If the user wants an automated critique without burning Claude tokens, set `include_critique: true` in `writer_generate`!

---

### Workflow 2: Blind A/B Benchmark Duel (20% of Critical Tasks)

When the user asks: *"Benchmark models for my executive memos"* or *"Compare GPT-4o vs Claude 3.5 Sonnet on this pitch"*:

1. **Create Task**:
   - Call `benchmark_create_task(title: "Q3 Strategy Memo", category: "Business Writing", prompt: "...")`.
2. **Dispatch Parallel Models**:
   - Call `benchmark_generate_outputs(task_id: "...")`. Competing models generate outputs simultaneously.
3. **Present Blind Duel**:
   - Call `benchmark_start_duel(task_id: "...")`.
   - Present `Response A` vs `Response B` blindly with zero brand logos or names.
4. **Record Preference**:
   - Call `benchmark_submit_vote(battle_id: "...", choice: "A")`.
   - Bradley-Terry MLE and Elo update dynamically.
5. **Tournament Reveal**:
   - Call `benchmark_get_results(task_id: "...", reveal: true)` to unmask model identities and display latency and cost.

---

## Best Practices & Rules

- **Strict Stdio Hygiene**: BlindWrite MCP communicates strictly over stdio JSON-RPC. Diagnostics always go to `stderr`.
- **Zero Brand Bias**: Never guess or reveal model identities before the user explicitly requests results.
- **Cost Awareness**: Highlight the cost comparison (DeepSeek V3 costs ~$0.0003 per draft vs ~$0.03+ for frontier models).
