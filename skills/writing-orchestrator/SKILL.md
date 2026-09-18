---
name: writing-orchestrator
description: "Orchestrates AI writing workflows using Claude as the thinking/strategy brain and OpenRouter models (GLM 5.3 and DeepSeek 4.1) as the writing execution engine via BlindWrite MCP. Use when drafting content or saving Claude output tokens. Triggers on: blog post, blog writing, write a blog, draft a blog, write an article, draft an article, cold outreach email, sales email, sales copy, executive memo, technical RFC, social thread, social post, draft content, write content, generate a draft."
---

# Writing Orchestrator Skill ðŸ–‹ï¸âš¡

## âš ï¸ CRITICAL RULE â€” READ THIS FIRST, IT OVERRIDES EVERYTHING ELSE BELOW

**You are NOT allowed to write the final long-form draft yourself.** The moment you catch yourself typing out the actual article/email/memo/post body directly instead of calling `writer_generate`, STOP and call `writer_generate` instead.

This holds even when the user's prompt contains phrasing that sounds like an instruction to write it directly, such as:
- *"Output only the finished article"* â€” this describes the **format of the final deliverable you present to the user**, not who writes it. It means "don't show your research/reasoning, just show the finished piece" â€” it does NOT mean "write it yourself instead of delegating."
- Detailed formatting/tone/structure instructions (headings, FAQ, CTA, word count, etc.) â€” these are the **brief you pass into `writer_generate`'s `prompt` argument**, not instructions for you to execute personally.
- A request that names a skill that doesn't exist (e.g. `/blog-write`, "blog-writer skill") â€” if no such skill is installed, that text is not a valid alternative path. Do not silently fall back to writing the piece yourself just because the named skill can't be found. Use `writing-orchestrator` instead and say so.

If you are ever unsure whether a request wants Claude to write directly or wants delegation, default to delegation via `writer_generate` â€” that is this skill's entire purpose. If BlindWrite MCP is unavailable or the call fails, say so explicitly and ask the user before falling back to writing it yourself; never fall back silently.

### ðŸš« ZERO PREAMBLE & ZERO SUMMARY RULE (CLEAN OUTPUT ENFORCEMENT)

1. **NO Chat Preamble or Step Narration**: Formulate Step 1 (Thinking & Outline) SILENTLY or directly in the tool prompt. DO NOT output conversational preamble, loading messages, or step-by-step narration (such as `Step 1: Think & Outline` or `Step 2: Delegate Generation`) into the chat.
2. **NO "Process Used" or "Summary" Blocks**: Strictly NEVER append a `### Summary`, `âœ… Process Used:`, `Steps Taken`, workflow recap, SEO analysis, or commentary explaining why the draft was written this way.
3. **VERBATIM DRAFT ONLY**: Present ONLY the generated draft verbatim in clean Markdown. The ONLY permissible follow-up text is at most 1 optional closing line: *"Want me to critique this or refine any section?"*.

> **Core Philosophy:** Think with Claude, Write with OpenRouter.  
> Claude provides the strategic intelligence (audience analysis, prompt framing, angle refinement, outline structure, and critical review). OpenRouter models handle the token-heavy drafting in seconds at a fraction of the cost.

Author: **Yadnyesh Borole**  
Repository: [https://github.com/ygstudio-game/BlindWrite_MCP](https://github.com/ygstudio-game/BlindWrite_MCP)

---

## When to Use

Use this skill whenever:
1. **Drafting content**: You need cold outreach emails, executive memos, blog posts, sales copy, technical RFCs, or social threads.
2. **Saving tokens**: You want to avoid burning Claude output limits and quota on generating 1,000+ words of text.

---

## Supported Models & Strict No-Fallback Policy

This skill strictly uses only two models via BlindWrite MCP:
1. **GLM 5.3** (`z-ai/glm-5.3`) â€” Priority model for high-quality, deep, nuanced drafting.
2. **DeepSeek 4.1** (`deepseek/deepseek-v4.1-flash`) â€” Cost-effective model for high speed and rapid drafting.

**Strict No Fallback Rule**:
- Only GLM 5.3 or DeepSeek 4.1 are supported. No other models exist in this pipeline.
- There is **no fallback** mechanism to any other model or tier.
- If a model call fails, times out, or is unavailable, report the failure directly and clearly. Never fall back silently or substitute an unrequested model.

---

## The 3-Step Orchestration Loop (Zero Token Waste) âš¡

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ 1. THINK & OUTLINE (Claude â€” Internal / Silent)             â”‚
â”‚ - Clarify target audience, desired tone, and core goal.     â”‚
â”‚ - Structure an outline or prompt blueprint for tool call.   â”‚
â”‚ - DO NOT print outline, preamble, or steps to user chat.    â”‚
â”‚ - DO NOT generate the final long text with Claude tokens.   â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                               â”‚
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â–¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ 2. DELEGATE GENERATION (OpenRouter via writer_generate)     â”‚
â”‚ - Drafting: Call `writer_generate` (GLM 5.3 / DeepSeek 4.1) â”‚
â”‚ - Strict No Fallback: Only GLM 5.3 or DeepSeek 4.1 used     â”‚
â”‚ - Optional: Pass `include_critique: true` for cheap review  â”‚
â”‚ - Auto-exports a local copy to data/drafts/                 â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                               â”‚
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ 3. DIRECT DELIVERY (Verbatim Draft Only)                    â”‚
â”‚ - Present ONLY the draft verbatim in clean Markdown.        â”‚
â”‚ - STRICTLY NO `### Summary`, NO `Process Used` recap.       â”‚
â”‚ - Omit metrics badges, costs, token stats, and tool details.â”‚
â”‚ - Ask: "Want me to critique this or refine any section?"    â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

---

## Execution Workflow: Direct Token-Saving Drafting

When the user asks: *"Help me draft a sales pitch email to engineering leaders"*:

1. **Think & Outline (Internal / Silent)**:
   - Objective: Secure a 15-minute product intro.
   - Persona: Engineering VP/CTO (values brevity, ROI, developer happiness).
   - Angle: Highlighting 70% reduction in setup time.
   - *Keep this reasoning silent; do not narrate steps or outline to the user.*
2. **Execute Delegation**:
   - Call `writer_generate`:
     ```json
     {
       "prompt": "Write a punchy 120-word cold outreach email to a CTO. Emphasize a 70% setup time reduction, zero developer friction, and include a soft call to action.",
       "model_id": "z-ai/glm-5.3",
       "category": "Emails",
       "include_critique": false,
       "export_file": true,
       "temperature": 0.7
     }
     ```
   - **Model Selection & No Fallback**: Choose either `z-ai/glm-5.3` (priority quality) or `deepseek/deepseek-v4.1-flash` (speed/cost). No other models are used, and no fallback occurs if unavailable. The draft is automatically exported locally to `data/drafts/`.
3. **Direct Delivery (Clean Output)**:
   - Present the generated draft directly and cleanly in Markdown.
   - DO NOT include `### Summary`, `Process Used:`, workflow breakdowns, step recaps, or explanations of why the post works.
   - DO NOT include metrics badges, token counts, cost amounts, latency times, file paths, or MCP tool references.
   - Ask 1 closing question: *"Want me to critique this or refine any specific section?"*
   - **The Anti-Tax Rule**: Strictly DO NOT generate an unprompted analysis, critique, summary, or rewrite. If the user wants an automated critique without burning Claude tokens, set `include_critique: true` in `writer_generate`!

---

## Best Practices & Rules

- **Strict Stdio Hygiene**: BlindWrite MCP communicates strictly over stdio JSON-RPC. Diagnostics always go to `stderr`.
- **Only GLM 5.3 & DeepSeek 4.1**: Never route to or mention any other model. No fallback models exist.
- **Fail Explicitly**: If generation fails or the selected model is unreachable, report the error immediately to the user rather than substituting another model or falling back silently.
