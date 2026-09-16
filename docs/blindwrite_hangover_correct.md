# Handover: Verify and harden the BlindWrite MCP → OpenRouter connection

## Context, one paragraph

The content pipeline (see `claude-openrouter-content-pipeline.md` and `content-pipeline-execution-sop.md`) is built on `writing-orchestrator` calling `writer_generate` through BlindWrite MCP, which you built. This is not a request to build something new — BlindWrite MCP is already installed and running. It's a request to verify the OpenRouter connection actually works end to end, harden the failure behavior, and confirm a few specifics the pipeline now depends on that weren't true when BlindWrite was first built for lighter, ad hoc use.

## What's confirmed working right now

- The BlindWrite MCP server is running and connected (`localMcpServers` shows `blindwrite` as `announced`).
- `benchmark_list_models` returns 6 models with pricing (Claude 3.5 Sonnet, GPT-4o, Gemini 1.5 Pro, DeepSeek V3, Llama 3.3 70B, Qwen 2.5 72B).

## What's NOT confirmed, and needs a real check

`benchmark_list_models` reads a local registry — it proves the server is up, not that `OPENROUTER_API_KEY` is valid or that the account has credit. Nobody has actually run a real `writer_generate` call in this setup yet. That's the first thing to do, not the last.

## Access and deployment

You'll work via remote access directly on the laptop that actually runs the live BlindWrite instance — not a separate copy in your own environment. That means there's no extra deployment or sync step: whatever you change there is already live. It also means the OpenRouter key you were given is the same one already configured and in production use, not a separate test key — no key swap needed before or after.

One coordination note, not a technical one: this machine is used for real client content jobs (not a spare dev box). Restarting the BlindWrite process or editing its config while a job is mid-run will fail that job. Agree on a time window with the machine's owner before you start, rather than jumping in whenever your remote session connects.

## Model set change — do this first, it's concrete and blocking

The writing model set is changing. **Replace** the current 6-model default registry (Claude 3.5 Sonnet, GPT-4o, Gemini 1.5 Pro, DeepSeek V3, Llama 3.3 70B, Qwen 2.5 72B) with exactly these two:

```json
[
  {
    "id": "glm-5-3",
    "openrouter_model_id": "z-ai/glm-5.3",
    "display_name": "GLM 5.3",
    "provider": "Z.ai",
    "enabled": true,
    "prompt_price_per_m_usd": 0.936,
    "completion_price_per_m_usd": 3.168
  },
  {
    "id": "deepseek-v4-1-flash",
    "openrouter_model_id": "deepseek/deepseek-v4.1-flash",
    "display_name": "DeepSeek V4.1 Flash",
    "provider": "DeepSeek",
    "enabled": true,
    "prompt_price_per_m_usd": 0.15,
    "completion_price_per_m_usd": 0.6
  }
]
```

Set the old 6 to `enabled: false` rather than deleting their entries outright, in case historical benchmark/leaderboard data references them by `id` — deleting could break `benchmark_get_leaderboard`/`benchmark_get_model_stats` calls that look up past results. Confirm with us before hard-deleting anything with history attached.

Slugs and pricing above were pulled directly from OpenRouter's own model pages on 2026-09-14 ([GLM 5.3](https://openrouter.ai/z-ai/glm-5.3), [DeepSeek V4.1 Flash](https://openrouter.ai/deepseek/deepseek-v4.1-flash)) — worth a quick re-check against OpenRouter at implementation time in case pricing moved between now and then.

### Critical: repoint the hardcoded fallback default in the same change

This one will break the first real run if it's missed, and it's caused by the change itself, so please read it before starting.

`benchmark_get_leaderboard` currently returns `total_models_ranked: 0` — verified, not assumed. The personal leaderboard is empty; no duels have ever been run. Per your own skill documentation, `writer_generate` queries that leaderboard and, when it comes back empty, falls back to a hardcoded default of **DeepSeek V3** — which is one of the six models this change disables.

So after the registry swap above, the very first `writer_generate` call will consult an empty leaderboard, fall through to a default pointing at a disabled model, and have nothing valid to select.

Required: repoint that hardcoded fallback to **`deepseek/deepseek-v4.1-flash`** as part of this same change, not as a follow-up. Then tell us explicitly what `writer_generate` does when the leaderboard is empty *and* the requested model is unavailable — does it error clearly, or fall through to something unlisted? That answer matters more than the happy path, because it's the state the system will actually be in for its first several jobs.

Also confirm what `benchmark_get_leaderboard` and `benchmark_get_model_stats` return once models with no history are the only enabled ones — an empty result is fine, an error is not.

**Before editing anything:** copy the current model registry file/config to a backup (timestamped filename is fine). This is a five-second step that makes the whole change reversible if something breaks — don't skip it to save time.

**Slug stability warning:** the DeepSeek V4 family uses dated snapshot suffixes elsewhere (`0731`, `0813`), which signals OpenRouter treats these as point-in-time releases that can get superseded or removed. Confirm `deepseek/deepseek-v4.1-flash` is still live on OpenRouter at implementation time, not just that the price we quoted is current.

**Budget guardrail:** when running the acceptance test calls below, set a `max_tokens` cap on the request. GLM-5.3 (full) costs $3.168 per million output tokens, the most expensive model in this new set — an uncapped test call is a way to accidentally spend real money testing, not a hypothetical.

After this change, confirm `benchmark_list_models` returns only these two as `enabled: true`, and that a real `writer_generate` call against each succeeds (see item 1 below) before treating this as done.

## Checklist

1. **Run one real `writer_generate` call, against each of the two new models.** A few hundred words, any topic. Confirm it returns actual generated text, a real cost/token badge, and a file in the expected export location. If it fails, that's the most useful outcome — see item 3.

2. **Confirm where the live key actually lives.** `OPENROUTER_API_KEY` can be set in a `.env` file next to the BlindWrite install, or in `claude_desktop_config.json`'s `env` block, or passed at launch. Confirm which one the *currently running* process is actually reading. If more than one copy exists, one can go stale while the other looks current — that's a real failure mode, not a hypothetical.

3. **Confirm failure behavior on a broken key or empty credit.** Temporarily break the key (or test with an account known to be out of credit) and capture what `writer_generate` actually returns: a clear thrown error, an empty string, or a silent fallback to a different model. This matters because the pipeline's rule is "never proceed silently on failure" — if BlindWrite fails quietly instead of erroring clearly, that rule can't be enforced on top of it.

4. **Confirm there's no silent model fallback on any error.** If the requested model is unavailable and BlindWrite substitutes another model without saying so in the response, that needs to change to at minimum flag it in the returned metadata. Silent substitution defeats the benchmarking/leaderboard logic and hides which model actually wrote a given piece.

5. **Confirm the prompt-length ceiling.** The pipeline now sends longer prompts than BlindWrite was likely tested with — a verbatim-copied quality checklist plus a verbatim-copied tone-of-voice excerpt, not a short paraphrase. Confirm `system_prompt`/`prompt` isn't silently truncated past some length, and if there is a hard limit, tell us the number.

6. **Confirm `export_file` behavior.** Where does the exported draft actually land on this machine (`data/drafts/` relative to what root), what's the filename pattern, and what happens on a collision (overwrite, or auto-incremented name)?

7. **Confirm the pricing numbers are current.** `benchmark_list_models`'s per-model prices — are they hardcoded at install time, or pulled live from OpenRouter? OpenRouter's prices change. If they're static, tell us how often they need manual updating so cost badges don't quietly go stale.

8. **Confirm the benchmark/leaderboard tools work end to end**: `benchmark_create_task`, `benchmark_generate_outputs`, `benchmark_start_duel`, `benchmark_submit_vote`, `benchmark_get_leaderboard`, `benchmark_get_model_stats`. We intend to use these to track which model writes best for each site's voice over time — confirm a full create → generate → duel → vote → leaderboard cycle actually completes.

## Open questions for you specifically (can't be verified from outside the code)

- Does `writer_generate` retry on a transient OpenRouter error (rate limit, brief outage), or does one failure just fail the whole call?
- Internally, is it a single flat completion call to OpenRouter, or does it do anything closer to OpenRouter's own multi-turn "skills-loader" pattern? Not a blocker either way — just tell us which, since it changes how we reason about prompt size and cost.

## Explicitly out of scope for this handover

- No scheduler or unattended automation. Confirmed decision: this runs on demand, with a human at the machine. Don't add cron/queue infrastructure.
- No bypass path that calls OpenRouter directly instead of through BlindWrite. That was considered and rejected for now — Claude's own tool calls can't reach `openrouter.ai` directly regardless (blocked by an org egress policy, confirmed by testing), so BlindWrite remains the only working channel, and there's no current need to change that.
- No new orchestration logic. Model selection, grading, and revision looping are handled on the Claude side (skills), not inside BlindWrite. BlindWrite's job stays narrow: take a prompt, call OpenRouter, return the result and its cost, reliably and with clear errors.

## Definition of done

- The model registry contains exactly `z-ai/glm-5.3` and `deepseek/deepseek-v4.1-flash` as `enabled: true`, the old six are disabled (not deleted), and a backup of the pre-change config exists.
- The hardcoded fallback default is repointed to `deepseek/deepseek-v4.1-flash`, and a `writer_generate` call succeeds against an empty leaderboard without manual model selection.
- One real `writer_generate` call succeeds **against each of the two models** and is shown to us (output + cost badge + export path), with `max_tokens` capped.
- One deliberately broken call (bad key or empty credit) is shown to us, with the exact error/response it produces.
- Answers in writing to: where the live key is read from, whether silent model fallback can occur, the prompt-length ceiling, the export path/collision behavior, whether pricing is live or static, what happens on an empty leaderboard with an unavailable model, plus the two open questions above.
