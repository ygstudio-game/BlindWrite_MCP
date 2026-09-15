# Writing must route through BlindWrite MCP

This project's whole point is to avoid burning Claude output tokens on long-form drafting. That rule holds **regardless of which skill handled the request that led up to it.**

## The rule

Whenever a task requires producing a long-form written draft — a blog post, article, email, memo, RFC, social post, ad copy, or any other substantial piece of prose (roughly 150+ words) — the actual drafting step MUST be delegated to `writer_generate` via the BlindWrite MCP server (see `writing-orchestrator` skill), not written directly by Claude.

This applies even when a *different* skill is the one that got invoked for the surrounding task (research, SEO strategy, content briefing, outlining, competitor analysis, etc.). Those skills may legitimately do their own analysis/strategy work directly — but the moment the task calls for generating the actual draft text, stop and call `writer_generate` instead of writing it out yourself.

## What does NOT need to go through BlindWrite MCP

- Short answers, explanations, code, or analysis (not long-form prose drafting).
- Outlines, briefs, or bullet-point structures (these are inputs *to* a draft, not the draft itself) — e.g. `seo-content-brief` producing a content brief is fine to do directly.
- Critique/review of an already-generated draft, if the user explicitly wants Claude's own judgment rather than another model's.

## If BlindWrite MCP is unavailable or fails

Don't silently fall back to writing the draft yourself. Say so explicitly — e.g. "BlindWrite MCP isn't responding / the writer_generate call failed with X" — and ask the user whether to retry, troubleshoot, or proceed with Claude writing it directly as a one-off exception.
