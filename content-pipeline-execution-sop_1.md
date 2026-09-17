# Content Pipeline Execution SOP

This is the step-by-step procedure for running one content job through the Claude + OpenRouter + Firecrawl + DataForSEO pipeline, as resolved in `claude-openrouter-content-pipeline.md`. It assumes that document's architecture decisions are final; this SOP is the "what to actually do, in order" checklist, not the rationale — check the main spec for why each step exists.

Scope note, confirmed: this SOP runs on demand, inside an active session, with the user at their computer. There is no scheduled/unattended mode — `writer_generate` requires the device bridge to be connected, so every job starts with a human present.

Model set, current: `z-ai/glm-5.3` and `deepseek/deepseek-v4.1-flash`. Flash is the cost default; GLM-5.3 is chosen deliberately when quality matters more than per-token price.

Site-specific facts live in `site-registry.md`, never in this document. This SOP names no site.

---

## Phase 0 — Preflight (before touching the job)

1. **Confirm the device bridge is connected.** `writing-orchestrator`/`blindwrite` cannot draft without it. If it's not connected, stop here — don't proceed and don't fall back to Claude drafting silently.
2. **Resolve which site this job is for, then load its registry entry.** Site identity is inferred from the Claude Project this session is running in; `site-registry.md` maps that Project to the site and everything site-specific (voice doc, persona, content profiles, hard rules). If the session has no Project, or the Project maps to no entry, ask once which site this is — do not guess. A wrong site produces a fully polished article in the wrong voice that passes every downstream gate.
3. **Confirm the site's voice document is actually readable.** The registry names a Drive file per site; open it and confirm you can read its text, since Phase 3 copies from it verbatim. If the registry entry says `status: blocked`, or the voice doc is missing or unreadable:
   - Stop. Ask the user to file it, or get explicit sign-off to proceed with `voice_requirements` left empty and flagged in the final delivery summary.
   - Never invent a voice to fill the gap. An invented voice produces a false pass later at the `eeat-audit` gate (Phase 4) instead of an honest failure.
4. **Confirm the site is in scope.** An entry marked `status: out_of_scope` (currently Sigma CapSeal) does not run through this pipeline, even if asked, until a voice document exists and its entry is updated.
5. **Confirm a usable drafting model is actually selectable.** Call `benchmark_list_models` and confirm at least one model returns `enabled: true`. This check exists because of a verified failure mode: the personal leaderboard is empty (`total_models_ranked: 0`), so `writer_generate` falls through to its hardcoded default, and if that default still points at a now-disabled model, the call has nothing valid to select. An empty enabled list, or a drafting call that errors on model selection, is a configuration fault — stop, don't retry.

---

## Phase 1 — Intake

6. Capture from the user (don't ask for what the registry entry or the workspace already answers):
   - `content_type` (SEO article, service page, listicle, etc.)
   - `primary_topic`, `primary_keyword`, `secondary_keywords` if any
   - `target_audience`, `business_goal`
   - `target_length` if specified
   - any special constraints beyond the registry's `hard_rules`
7. Create a `job_id` for traceability.
8. Select the content-type profile from the registry entry's `content_profiles` (detailed in Section 27 of the main spec). This determines which pre-writing skills run and which persona, if any, the draft is bylined to.

---

## Phase 2 — Pre-writing research and brief

9. Determine which pre-writing skill builds the brief, from the registry entry's `pre_writing_skill` (Section 6):
   - **`semantic-seo-content`** — where entity-attribute-value precision, semantic triples, and evidence-calibrated writing matter most.
   - **`content-brief`** — for other content types, or when the lighter, narrower skill fits better.
   - If `semantic-seo-content` is selected, it calls `content-brief` internally for research grounding (step 10 below) before applying its own EAV/triple/evidence method on top. This is not optional — don't let `semantic-seo-content` run on a plain web search when `content-brief`'s real research is available.
10. Run `content-brief` (directly, or internally via `semantic-seo-content`). It performs the DataForSEO (`mcp__dfseo__*`) and Firecrawl (`mcp__firecrawl__*`) research itself now — keyword/SERP data, competitor extraction, content-gap mapping. Do not run DataForSEO/Firecrawl as separate manual stages alongside it; that duplication was resolved away.
11. Run any additional pre-writing skills the content-type profile calls for (`keyword-deep-dive`, `topic-cluster-planning`, `cite-me`, `wikipedia-ai-writing-signs`, etc.).
12. Synthesize everything into a single **MASTER_WRITING_BRIEF** object (Section 11 schema): topic, keywords, research summary, required entities/topics/claims, recommended structure, `persona_experience_details` + `no_live_expert_interview` if the registry entry names a persona, the entry's `hard_rules`, and empty slots for `style_requirements`/`voice_requirements` — those get filled in Phase 3, not here.

---

## Phase 3 — Compile the checklist and voice layer

13. Open the specific, relevant paragraphs (not whole files) of `google-helpful-content-grader`, `semantic-gap-analysis`, `no-ai-slop`, and `heading-microcopy-writer` for this content type, and **copy them verbatim** into the brief's quality-checklist material. Do not paraphrase — copy the actual text.
14. Open the site's voice document from Drive (confirmed readable in Phase 0, step 3) and **copy the relevant excerpts verbatim** into `style_requirements` (mechanical rules: sentence length, punctuation, active voice, structural conventions) and `voice_requirements` (the site's actual persona/brand voice, arc/ratios, what to avoid). Same rule: copy, don't summarize.
15. Assemble the final `system_prompt`/`prompt` for the drafting call: SYSTEM ROLE + task instructions + the brief + the verbatim checklist + the verbatim voice layer (Section 13's prompt architecture).

---

## Phase 4 — Draft, grade, fix loop

16. Invoke `writing-orchestrator` (Skill tool) with the assembled brief + checklist + voice layer. Let it select the model and call `writer_generate`. Do not call `writer_generate` directly. Set loop counter `n = 0`.
17. Once a draft returns, immediately run Claude's grading gate — **exactly two skills, always, regardless of whether this specific request asked for critique**:
    - `eeat-audit` — authorship/trust dimension: does the byline/persona hold together against the voice document and the registry's `persona` field, is there a fabricated-experience risk.
    - `avoid-ai-detection` — citation junk, invisible Unicode artifacts, tracking params, unfilled placeholders, curly quotes, title-case headings.
18. Output structured findings:
    ```json
    { "status": "pass" | "needs_revision", "issues": [ { "severity": "...", "section": "...", "problem": "...", "required_fix": "..." } ] }
    ```
19. **If `status: pass`** → go to Phase 5.
20. **If `status: needs_revision`**:
    - Increment `n`.
    - If `n > 3` (MAX_REVISION_LOOPS), stop looping and go to step 21 (escalation) instead of continuing.
    - Otherwise: package the `issues` array into a revision prompt (original draft + specific issues + required fixes + instruction to fix only those issues) and send it back through `writing-orchestrator`/`writer_generate`. Do not rewrite the draft yourself. Return to step 17 with the revised draft.
21. **Escalation (only reached if 3 loops didn't resolve it):** stop, tell the user plainly which issues persisted, and give them the explicit choice — ship with the caveat noted, have Claude fix the remaining issues directly as a one-time named exception, or retry with a different `model_id` (the realistic switch is Flash → GLM-5.3, at roughly six times the output cost). Don't pick for them.

---

## Phase 5 — Deliver

22. Save the final version as a file (never the raw, ungraded draft).
23. Deliver the final drafted content directly to the user as clean, pure Markdown—completely free of technical jargon, MCP tool wrappers, latency/cost metrics badges, token counts, or audit reviews.
24. Internal job logging: Record execution metadata (site and registry entry, model used, revision loop count, audit findings, escalation details) into the local file / session logs only. Do NOT output technical summaries, audit results, or MCP details to the user chat unless explicitly asked for technical diagnostics.
25. Optional: if tracking model quality over time, log the result into `blindwrite`'s benchmark tools (`benchmark_create_task` + `benchmark_generate_outputs` + `benchmark_start_duel`/`benchmark_submit_vote`). Note the leaderboard is currently empty and only two models are enabled, so this is a slow-burn investment, not something that pays off on the first few jobs.

---

## Quick-reference: stop conditions

Stop and do not proceed past these without explicit user input:

- Device bridge not connected (step 1)
- Site can't be resolved and hasn't been confirmed by the user (step 2)
- Voice document missing or unreadable, with no sign-off to proceed without one (step 3)
- Site marked `out_of_scope` in the registry (step 4)
- No enabled drafting model, or model selection errors (step 5)
- Revision loop exhausted at `MAX_REVISION_LOOPS = 3` without a clean pass (step 21)
