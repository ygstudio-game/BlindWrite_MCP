# Claude + OpenRouter + Firecrawl + DataForSEO: One-Click Content Production Pipeline

## 1. Objective

Build a fully orchestrated content-production workflow in Claude where the user starts the entire process with a single command/click and does not manually move content between tools.

Claude remains the **orchestrator, researcher, strategist, editor, auditor, proofreader, and finalizer**.

OpenRouter is used as the **production-writing layer**, allowing the system to use lower-cost specialist models for high-volume drafting while preserving Claude for higher-value reasoning and editorial decisions.

Firecrawl provides web research/crawling/extraction.

DataForSEO provides quantitative SEO and SERP intelligence.

### Target user experience

User provides:

```text
Create article
Topic/keyword: [INPUT]
Content type: [INPUT]
Optional requirements: [INPUT]
```

Then the system executes:

```text
Pre-writing skills
        ↓
DataForSEO research
        ↓
Firecrawl research
        ↓
Claude analysis + synthesis
        ↓
Master writing brief
        ↓
OpenRouter production draft
        ↓
Claude post-writing skills
        ↓
Audit
        ↓
Fix
        ↓
Proofread
        ↓
Finalization
        ↓
Publish-ready content
```

No manual copy/paste should be required between stages.

---

# 2. Core Architecture

```text
                         USER
                           │
                           ▼
                    CLAUDE ORCHESTRATOR
                           │
                           ▼
                 TASK / CONTENT TYPE DETECTION
                           │
                           ▼
                  APPLICABLE CLAUDE SKILLS
                           │
             ┌─────────────┴─────────────┐
             ▼                           ▼
        DATAFORSEO                    FIRECRAWL
             │                           │
      SEO/SERP data                Web research
      Keywords                     Competitors
      Search intent                Source extraction
      Ranking pages                Page analysis
      Related terms               Content discovery
             │                           │
             └─────────────┬─────────────┘
                           ▼
                    CLAUDE SYNTHESIS
                           │
                           ▼
                 MASTER WRITING BRIEF
                           │
                           ▼
                      OPENROUTER
                           │
                  Selected model for task
                           │
                           ▼
                    ARTICLE / POST DRAFT
                           │
                           ▼
                    CLAUDE POST-WRITING
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
            AUDIT      PROOFREAD     FINALIZE
              │            │            │
              └────────────┼────────────┘
                           ▼
                     FINAL OUTPUT
```

---

# 3. Responsibilities by System

## 3.1 Claude

Claude is the control plane.

Claude must:

- interpret the user's request
- determine the content type
- determine which existing skills are applicable
- execute all required pre-writing skills
- call DataForSEO where SEO data is required
- call Firecrawl where web research or extraction is required
- synthesize all research
- create the master writing brief
- select the appropriate OpenRouter model
- send the brief to OpenRouter
- receive the draft
- execute post-writing skills
- run audits
- fix identified issues
- proofread
- finalize the content
- validate that the final output satisfies the original request
- return the final publish-ready content

Claude should remain the main interface throughout the process.

## 3.2 DataForSEO

DataForSEO is the quantitative SEO intelligence layer.

Use it when the content task has an SEO/search objective.

Potential inputs/outputs include:

- primary keyword
- keyword variations
- search volume
- keyword difficulty or competition metrics where available
- related keywords
- SERP results
- ranking URLs
- search intent signals
- SERP feature information
- competitor ranking data

DataForSEO should provide evidence for SEO decisions rather than forcing Claude to guess.

## 3.3 Firecrawl

Firecrawl is the web research and extraction layer.

Use it for:

- crawling competitor pages
- extracting page content
- retrieving source material
- analyzing current web pages
- collecting supporting information
- extracting page structure and headings
- finding gaps between competing pages

Firecrawl should be used selectively. Do not crawl unnecessarily when the requested task does not require web research.

## 3.4 OpenRouter

OpenRouter is the production-writing layer.

Its role is intentionally narrower than Claude's.

The selected model receives a completed, highly structured master brief and produces the draft.

OpenRouter should not be responsible for deciding the SEO strategy, research plan, search intent, competitor strategy, or editorial direction when Claude has already established these in the brief.

---

# 4. One-Click Execution Contract

**Confirmed scope, not aspirational (see Section 33): this is one-click within an attended session, not unattended/scheduled automation.** The actual drafting call (`writer_generate`, via `blindwrite`) only works while the device bridge to the machine hosting `blindwrite` is connected — there is no path to running this pipeline on a cron schedule with nobody at the computer, short of replacing that drafting mechanism with a cloud-reachable OpenRouter integration, which is a bigger change than this pipeline currently makes. "One invocation triggers the entire pipeline" below means one skill invocation inside an active, connected Claude session — the user still has to be at their computer to kick it off.

The developer should implement a single top-level orchestration command/skill, for example:

```text
/create-content
```

or an equivalent single-click UI action.

The user should not need to manually execute:

```text
/run-keyword-research
/run-serp-analysis
/run-firecrawl
/create-brief
/write
/run-audit
/proofread
/finalize
```

Instead, one invocation triggers the entire pipeline.

Example:

```text
/create-content

Keyword: [KEYWORD]
Topic: [TOPIC]
Content type: SEO article
Target length: [OPTIONAL]
Special requirements: [OPTIONAL]
```

The orchestrator determines the required workflow automatically.

---

# 5. Step-by-Step Execution Workflow

## STEP 0: Intake and Validation

Claude receives the user request.

Capture:

```text
content_type
primary_topic
primary_keyword
secondary_keywords if supplied
audience
target market/location if supplied
goal
target length if supplied
brand/voice requirements
CMS/publishing destination if supplied
special constraints
```

Validate minimum required information.

Do not ask unnecessary questions. Use information already available in the workspace, project, files, skills, and connected systems where appropriate.

Create a unique `job_id`.

Example:

```json
{
  "job_id": "content_2026_09_12_001",
  "status": "started",
  "content_type": "seo_article"
}
```

---

# 6. STEP 1: Determine Applicable Claude Skills

Claude should inspect the available skills and select those appropriate for the task.

For an SEO article on faceshapetool.com, the concrete skill set (from the currently installed `anthropic-skills` and `searchfit-seo` skills) is:

- keyword research → `anthropic-skills:keyword-deep-dive`
- topic cluster planning → `anthropic-skills:topic-cluster-planning`
- semantic brief + evidence-calibrated writing method → `semantic-seo-content` (see below — this skill now does most of what the four bullets after it used to do separately)
- content brief creation + SERP read → `anthropic-skills:content-brief` (see the open decision on overlap with Section 8/9 below)
- semantic/triple analysis → `anthropic-skills:semantic-triples-seo`
- knowledge graph/entity planning → `anthropic-skills:knowledge-graph-content-architect`
- featured snippet optimization → `anthropic-skills:featured-snippet-optimizer`
- internal linking → `searchfit-seo:internal-linking` (no `anthropic-skills` equivalent exists yet)
- schema/on-page requirements → `searchfit-seo:schema-markup` (and `searchfit-seo:on-page-seo` if the destination CMS needs meta-level checks)
- writing style/voice → not a fixed skill for any one site (see Section 11): each project supplies its own uploaded tone-of-voice document, compiled into `style_requirements`/`voice_requirements` at brief time. `anthropic-skills:blog-writer` (faceshapetool.com) and `anthropic-skills:juriszone-content-writer` (Juriszone) are this account's current examples of that mechanism, not the mechanism itself — a new site gets a new document, not a new hardcoded skill
- AI-search citability groundwork → `anthropic-skills:cite-me`, `anthropic-skills:wikipedia-ai-writing-signs`

**`semantic-seo-content` overlaps three other entries above by design.** It covers entity-attribute-value mapping and semantic triples (`semantic-triples-seo`'s job), topical/query mapping and brief-building (`content-brief`'s and `knowledge-graph-content-architect`'s job), and it also includes its own factual audit checklist and, critically, detailed direct-writing rules — meaning it is not purely a pre-writing skill, it can produce finished copy itself. Treat `semantic-seo-content` as the brief-building and writing-rules skill for faceshapetool.com, and keep `content-brief`/`semantic-triples-seo`/`knowledge-graph-content-architect` available for content types or one-off tasks where the lighter, narrower skill is a better fit than the full semantic method.

**Resolved: `semantic-seo-content` calls `content-brief` internally for research.** It doesn't have its own DataForSEO/Firecrawl grounding, and it shouldn't get a separate, duplicate upgrade either — when `semantic-seo-content` is the active pre-writing skill, it invokes `content-brief` first (which does the real DataForSEO/Firecrawl research per Sections 8-9) and then applies its own EAV/semantic-triple/evidence-calibration writing method on top of that research, rather than re-deriving research with a plain search or running two separate API-calling skills side by side.

Do not force every skill to run for every content type. See Section 27 for per-content-type profiles.

Create a workflow manifest:

```json
{
  "pre_writing_skills": [
    "anthropic-skills:keyword-deep-dive",
    "anthropic-skills:topic-cluster-planning",
    "semantic-seo-content",
    "anthropic-skills:cite-me"
  ],
  "post_writing_skills": [
    "anthropic-skills:google-helpful-content-grader",
    "anthropic-skills:eeat-audit",
    "anthropic-skills:semantic-gap-analysis",
    "anthropic-skills:no-ai-slop",
    "anthropic-skills:avoid-ai-detection",
    "anthropic-skills:heading-microcopy-writer",
    "anthropic-skills:improve-content",
    "anthropic-skills:page-audit"
  ]
}
```

This manifest is the default for `content_type: seo_article`, with `semantic-seo-content` now doing the work `content-brief` + `semantic-triples-seo` + `knowledge-graph-content-architect` did in the previous version of this manifest. Section 27 gives the Juriszone variant.

---

# 7. STEP 2: Execute Pre-Writing Skills

Run the applicable Claude skills before any production writing occurs.

The purpose of this stage is to transform the user's raw request into a validated content strategy.

Important principle:

**OpenRouter should receive the result of Claude's thinking, not the raw user request alone.**

Outputs from each skill should be stored as structured intermediate results.

Example:

```text
User Request
    ↓
Keyword Research
    ↓
SERP Analysis
    ↓
Competitor Analysis
    ↓
Semantic / Entity Analysis
    ↓
Content Architecture
    ↓
Editorial Direction
```

---

# 8. STEP 3: DataForSEO Research

**Resolved (see Section 33, Open decision 1).** This no longer runs as an independent orchestrator-level stage. `content-brief` is upgraded to call `mcp__dfseo__*` internally instead of a generic web search, absorbing this section's logic into itself as the single pre-writing research step. The sequence and structured-object shape below are retained as the spec for what `content-brief` must do internally, not as a separate stage Claude runs before or alongside `content-brief`.

**Resolved:** `semantic-seo-content` is often used *instead of* `content-brief` for faceshapetool.com content (Section 6). It now calls `content-brief` internally for research grounding (real DataForSEO/Firecrawl data) rather than getting its own separate, duplicate API-calling upgrade or continuing with a lighter research pass — one research path, shared by both skills.

For SEO content, call DataForSEO after the initial task interpretation and during the pre-writing phase.

### Recommended sequence

```text
Primary keyword
      ↓
DataForSEO keyword/SERP research
      ↓
Collect ranking results
      ↓
Identify search intent patterns
      ↓
Identify relevant SERP features
      ↓
Identify related terms
      ↓
Feed results into Claude analysis
```

Do not simply paste raw API responses into the final writer prompt.

Claude should normalize and interpret the results first.

Create a structured research object:

```json
{
  "primary_keyword": "...",
  "search_intent": "...",
  "keyword_metrics": {},
  "related_keywords": [],
  "serp_features": [],
  "ranking_pages": []
}
```

---

# 9. STEP 4: Firecrawl Research

**Resolved (see Section 33, Open decision 1).** Same resolution as Section 8: `content-brief` calls `mcp__firecrawl__*` internally rather than this running as a separate stage. The process and analysis goals below describe what `content-brief` must do internally.

Use Firecrawl to obtain the actual content and structure of relevant web pages.

Recommended process:

```text
DataForSEO ranking URLs
        ↓
Select relevant competitors/sources
        ↓
Firecrawl pages
        ↓
Extract content + structure
        ↓
Claude analysis
```

Claude should use the extracted material to determine:

- what competitors cover
- how competitors structure the topic
- important concepts/entities
- common explanations
- useful factual material
- areas of weakness
- missing information
- opportunities for differentiation

Do not reproduce competitor content.

The objective is research and gap identification.

---

# 10. STEP 5: Claude Research Synthesis

Claude now combines:

```text
User requirements
+
Existing Claude skill outputs, including content-brief's internal
  DataForSEO + Firecrawl research (Sections 8-9, now internal to it)
+
Brand/voice requirements (this project's uploaded tone-of-voice document — see Section 11)
+
Existing site/context information
```

The output is a single normalized **MASTER_WRITING_BRIEF**.

This is the most important handoff object in the entire system.

---

# 11. MASTER_WRITING_BRIEF Specification

The brief should be structured, not merely a paragraph.

Recommended schema:

```json
{
  "job_id": "...",
  "content_type": "seo_article",
  "topic": "...",
  "primary_keyword": "...",
  "secondary_keywords": [],
  "search_intent": "...",
  "target_audience": "...",
  "business_goal": "...",
  "research_summary": [],
  "serp_findings": [],
  "competitor_findings": [],
  "content_gaps": [],
  "required_entities": [],
  "required_topics": [],
  "required_claims_or_facts": [],
  "source_requirements": [],
  "recommended_structure": [],
  "section_instructions": [],
  "internal_linking_requirements": [],
  "seo_requirements": [],
  "style_requirements": [],
  "voice_requirements": [],
  "things_to_avoid": [],
  "editorial_direction": "...",
  "quality_bar": "...",
  "persona_experience_details": [],
  "no_live_expert_interview": true
}
```

`persona_experience_details` and `no_live_expert_interview` apply to any site whose content model uses a scripted author persona rather than real subject-matter-expert interviews (faceshapetool.com is the current example, not the only case this schema supports). Because `eeat-audit` (see post-writing skills) checks for demonstrated first-hand experience and no rewrite pass can manufacture that after the fact, the specific, persona-consistent experience details (a product, a date, a concrete failure) must be decided at brief time for that site and passed to OpenRouter explicitly in this field, rather than left for the model to invent generically. Set `no_live_expert_interview: true` for persona-driven sites; set it `false` for sites where real subject-matter input is used instead (Juriszone, for example, per Section 27).

## `style_requirements` and `voice_requirements` — generic mechanism, no site hardcoded

This pipeline is built to run for any site or client, not for faceshapetool.com specifically — so neither this section nor the pipeline's core mechanics (Sections 1-26, 28-33) hardcode any one site's persona, name, or voice rules. Site-specific voice lives outside this document, as **a tone-of-voice document uploaded per project** — one per site/niche, supplied by the user when that project is set up, not derived or invented by Claude. Section 27's task profiles are illustrative examples of the generic mechanism applied to specific clients, not part of the pipeline's core structure.

At brief time, populate these two fields by locating that project's tone-of-voice document (ask the user where it is if it isn't obvious from the connected folder or project files) and copying the relevant rules from it — verbatim excerpts, per the same principle established for the pre-writing checklist in Section 15/`openrouter-draft-audit` Step 1, not a Claude paraphrase of the document's content:
- `style_requirements`: mechanical writing rules that hold across sentence level — sentence length limits, punctuation rules (e.g. no em dashes), voice (active vs. passive), structural conventions (answer-first, etc.). Some of these may be the user's own general preferences that apply to every project regardless of site; others are site-specific and come from that project's tone-of-voice document.
- `voice_requirements`: the site's actual persona/brand voice — tone, personality, any author persona and its consistency rules, content arc/ratios, what to avoid. This one always comes from the per-project document; there is no generic default for it.

If a project has no tone-of-voice document uploaded yet, say so explicitly rather than inventing one — an invented voice is worse than no voice layer, because `eeat-audit`'s persona-consistency check (Section 15) will grade the draft against whatever voice was actually specified, and a fabricated one produces a false pass.

The brief should contain enough context that the writing model does not need to conduct the strategic work again.

---

# 12. STEP 6: Select OpenRouter Model

**Resolved (see Section 33, decision 3):** this step is no longer implemented by this pipeline directly. `writing-orchestrator` (pre-existing, plugin-backed) owns model selection now, and `openrouter-draft-audit` hands it the brief rather than calling `writer_generate` or the benchmark tools itself. The description below is retained as background on what `writing-orchestrator` does internally, not as a separate implementation to build.

The developer should build OpenRouter model selection so the model can eventually be selected by task.

Example concept:

```text
SEO article       → best benchmarked SEO model
Long-form article → best benchmarked long-form model
Cold outreach     → best benchmarked outreach model
Social post       → best benchmarked social model
Email             → best benchmarked email model
```

This is not purely a future-phase idea for this system: the `blindwrite` MCP server (`mcp__remote-devices__blindwrite__*`, reachable only while the device bridge is connected) already implements the benchmark loop described here. `benchmark_get_leaderboard` (scoped by `category`) returns the Bradley-Terry/Elo ranking for a task category once enough duels exist; `benchmark_create_task` + `benchmark_generate_outputs` + `benchmark_start_duel` + `benchmark_submit_vote` build that history.

For the first implementation, until a category has enough votes, use a configurable default model. As of the model-set change described below, that default is **`deepseek/deepseek-v4.1-flash`** ($0.15 in / $0.60 out per million tokens — the cheaper of the two enabled models), with **`z-ai/glm-5.3`** ($0.936 / $3.168) as the deliberate quality option rather than an automatic one. Once `benchmark_get_leaderboard` for that category returns results with `min_battles` above a configured threshold, switch to the top-ranked model automatically instead of the hardcoded default.

**Model set, current (changed 2026-09-14):** the registry's original six models (Claude 3.5 Sonnet, GPT-4o, Gemini 1.5 Pro, DeepSeek V3, Llama 3.3 70B, Qwen 2.5 72B) are replaced by exactly two: `z-ai/glm-5.3` and `deepseek/deepseek-v4.1-flash`. Any earlier reference in this document to `deepseek/deepseek-chat` (DeepSeek V3) as a default is superseded.

**Verified failure mode, must be handled before first run:** `benchmark_get_leaderboard` currently returns `total_models_ranked: 0` — the personal leaderboard is empty, no duels have ever been run. `writer_generate`'s documented behavior is to query that leaderboard and, failing that, fall back to a hardcoded default of DeepSeek V3. DeepSeek V3 is one of the models being disabled. So an empty leaderboard plus a disabled fallback default means the first `writer_generate` call after the model-set change has no valid model to select. The hardcoded fallback must be repointed to `deepseek/deepseek-v4.1-flash` as part of the same change, not afterwards.

Important:

**Do not hard-code the assumption that one model is best for every content type.** Run real benchmark duels per category before trusting a default — an empty leaderboard is a reason to run `benchmark_create_task`/`benchmark_generate_outputs`, not a reason to guess.

---

# 13. STEP 7: Send MASTER_WRITING_BRIEF to OpenRouter

**Resolved (see Section 33, decision 3):** Claude does not call `writer_generate` directly for this step either. `openrouter-draft-audit` Step 1 compiles the brief plus the quality checklist (see Section 15's rewrite) and hands both to `writing-orchestrator`, which issues the actual OpenRouter call(s). One consequence worth being explicit about: a Skill's instructions have no execution path inside a raw OpenRouter completion — there is no skill-loading mechanism on that side of the call. So "the audit happens inside OpenRouter" means the relevant skills' rules get compiled into prompt text before the call, not that the skills themselves run there. The prompt architecture below is still the right shape for that compiled text.

OpenRouter receives:

1. task type
2. writing role
3. complete master brief
4. formatting requirements
5. explicit instruction to follow the brief

Recommended prompt architecture:

```text
SYSTEM ROLE
You are the production writer.

TASK
Write the requested content using the supplied MASTER_WRITING_BRIEF.

IMPORTANT
- Follow the strategic direction in the brief.
- Do not replace the research strategy with your own assumptions.
- Do not invent unsupported facts.
- Do not invent sources.
- Follow the specified voice and structure.
- Return the complete draft.

MASTER_WRITING_BRIEF
[STRUCTURED BRIEF]
```

The OpenRouter response should be stored as:

```json
{
  "job_id": "...",
  "model": "...",
  "draft": "...",
  "usage": {},
  "cost": {}
}
```

Track token usage and cost where the provider makes the information available.

Concretely, this step is `mcp__remote-devices__blindwrite__writer_generate` — but as of decision 3, `openrouter-draft-audit` doesn't call it directly anymore; `writing-orchestrator` does, using the prompt/system_prompt this pipeline hands it. The parameter mapping still holds as background: `prompt` carries the TASK + MASTER_WRITING_BRIEF body, `system_prompt` carries the SYSTEM ROLE + IMPORTANT constraints (including voice/persona rules and, now, the compiled quality checklist from Section 15), `model_id` is `writing-orchestrator`'s own selection (its leaderboard logic, not a separate implementation here), `include_critique: true` gets a cheap self-review folded into the same call, and `export_file: true` gives a local drafts-folder copy for free. This tool only works while the device bridge to the machine hosting `blindwrite` is connected; if it is not, this stage cannot run and the job should move to `DEGRADED`, not fall back to Claude drafting silently, since the whole point of this pipeline is that OpenRouter does the first draft.

Note on `include_critique: true`: if this uses the same model that drafted, it's self-grading — the model checking its own draft against the checklist it was just given. That doesn't reliably catch overclaiming or slop from a model prone to producing them in the first place. **Resolved:** neither of the two options originally floated here (accept the risk, or route critique through a stronger OpenRouter `model_id`) was adopted. Grading happens in Claude and fixing happens in OpenRouter, as a capped loop — see Section 33 decision 3 for the actual resolution. `include_critique: true` survives only as an optional cheap pre-filter before Claude's grading gate, never as a substitute for it.

---

# 14. STEP 8: Return Draft to Claude

The draft must automatically return to the Claude orchestrator.

There should be no manual paste operation.

```text
OpenRouter
    ↓
Draft
    ↓
Claude orchestration state
```

Claude now treats the draft as an intermediate artifact, not the final output.

---

# 15. STEP 9: Execute Post-Writing Skills

**Resolved and narrowed (see Section 33, decision 2 and decision 3).** The 8-skill sequence below was this document's original design. The user has since decided that post-writing, Claude-side auditing narrows to exactly two skills — `eeat-audit` and `avoid-ai-detection` — with the rest of this list's substance moved to *pre*-writing (compiled into the OpenRouter prompt, per `openrouter-draft-audit` Step 1) instead of run as an independent Claude pass afterward. The original 8-step sequence is kept below for the record and because it's still the right reference for *which rules* get compiled into the pre-writing checklist — it just no longer runs as written.

Original (superseded) sequence, ordered so structural fixes happen before sentence-level polish:

```text
DRAFT
  ↓
anthropic-skills:google-helpful-content-grader   (substantive/content audit)
  ↓
anthropic-skills:eeat-audit                       (experience/expertise/authority/trust)
  ↓
anthropic-skills:semantic-gap-analysis            (did the draft close the gaps from the brief?)
  ↓
anthropic-skills:no-ai-slop                       (style: repetition stacks, cliche openers)
  ↓
anthropic-skills:avoid-ai-detection                (OpenRouter-specific artifact cleanup: citation junk, curly quotes)
  ↓
anthropic-skills:heading-microcopy-writer          (heading/microcopy polish, now that structure is settled)
  ↓
anthropic-skills:improve-content                   (proofreading/finalization pass — see Sections 17-18)
  ↓
anthropic-skills:page-audit                        (final holistic pre-publish check)
```

**Current (resolved) sequence — now a loop, not a one-shot gate:**

```text
BRIEF
  ↓  (openrouter-draft-audit Step 1: compile google-helpful-content-grader,
  ↓   semantic-gap-analysis, no-ai-slop, and heading-microcopy-writer rules
  ↓   into the prompt/system_prompt — pre-writing, not post-writing)
writing-orchestrator drafts via OpenRouter
  ↓
anthropic-skills:eeat-audit + avoid-ai-detection   (Claude grades — see Section 16)
  ↓
needs_revision? → writing-orchestrator revises via OpenRouter, fed Claude's findings
  ↓                (Claude does not rewrite the draft itself — see Section 16)
  └──────────────→ re-grade, up to MAX_REVISION_LOOPS times
```

This is a real coverage cut relative to the original 8-step sequence, not a relabeling of the same work: `google-helpful-content-grader`, `semantic-gap-analysis`, `no-ai-slop`, `heading-microcopy-writer`, `improve-content`, and `page-audit` no longer run as independent checks against the actual draft. Their rules only reach the draft as instructions given to a cheap model before it writes — which that model may or may not follow faithfully. `eeat-audit` and `avoid-ai-detection` stay as Claude's gate specifically because they need something an isolated OpenRouter call structurally can't supply: `eeat-audit`'s authorship/trust check needs site-level context (which persona, which client, what fabrication risk applies), and `avoid-ai-detection`'s artifact scan is catching exactly the class of defect a generating model won't reliably self-report — this pipeline's own planning document had invisible-Unicode citation junk in it that read as clean text until it was checked byte-by-byte. Because Claude, not the drafting model, does this grading, the earlier self-grading concern doesn't apply to these two checks — see Section 16 for how that's structured as a loop.

If quality on the six removed dimensions degrades in practice, that's a signal to tighten the pre-writing checklist for that content type, or reinstate one specific post-writing pass — not to silently restore the full 8-step sequence.

---

# 16. STEP 10: Audit and Correction Loop

**Resolved, with one correction to this section's original design.** The original text below said "Claude should then fix the draft." That's wrong for this pipeline as decided: Claude grades (Section 15's `eeat-audit` + `avoid-ai-detection`, producing the structured findings below), but the *fix* is delegated back to `writing-orchestrator`/OpenRouter, using Claude's findings as the revision brief — not written by Claude directly. This keeps the three roles clean: OpenRouter drafts, Claude grades, OpenRouter fixes. Claude only writes revision *instructions*, never revised *copy*, in the normal path.

This also finishes resolving the self-grading concern raised earlier in Section 33 decision 3: routing the fix through a second, stronger OpenRouter `model_id` was one option considered there; grading in Claude and fixing in OpenRouter from Claude's feedback is the option actually chosen, and it's a cleaner fix than either self-critique or a stronger-model critique, since Claude was never the model that produced the draft in the first place.

Audits should produce structured findings.

Example:

```json
{
  "status": "needs_revision",
  "issues": [
    {
      "severity": "high",
      "section": "Introduction",
      "problem": "...",
      "required_fix": "..."
    }
  ]
}
```

Claude should then fix the draft.

The process should support a controlled revision loop:

```text
Draft (OpenRouter)
 ↓
Audit (Claude: eeat-audit + avoid-ai-detection)
 ↓
Issues found?
 ├─ No → continue to Section 18 (finalization)
 └─ Yes
      ↓
   OpenRouter revises, fed Claude's structured findings as the brief
   (Claude does NOT rewrite the draft itself in this path)
      ↓
   Re-audit (Claude, same two skills)
```

Set a configurable maximum number of revision loops (`MAX_REVISION_LOOPS = 3`) to avoid infinite execution and runaway cost — each loop spends Claude tokens on grading in addition to the OpenRouter draft/revision cost, so this cap also bounds spend, not just wall-clock time. If a draft still shows `needs_revision` after `MAX_REVISION_LOOPS`, stop and escalate to the user rather than looping indefinitely: offer to ship with the remaining issues noted, have Claude fix them directly as a one-off, named exception, or retry with a different `model_id`. Don't pick silently among those for the user.

---

# 17. STEP 11: Proofreading

**Resolved (see Section 33, decision 2).** "Proofreading" in this system is not a separate skill or a grammar pass — it's `eeat-audit`'s authorship/trust check, run as part of Section 15's narrowed sequence. `improve-content`, named here in the original draft of this section, is no longer in the pipeline at all; its function (light grammar/consistency) was one of the six dimensions moved to the pre-writing checklist in Section 15, on the theory that a model told the rules up front needs less correction after the fact. If that theory doesn't hold in practice — grammar/consistency problems keep shipping — that's a concrete, checkable failure of decision 2's premise, worth surfacing rather than absorbing silently.

The list below is retained for reference on what a grammar/consistency pass used to cover, in case `improve-content` needs to be reinstated for a specific content type:

- grammar
- spelling
- punctuation
- awkward constructions
- clarity
- consistency
- formatting
- terminology consistency
- duplicated ideas
- accidental contradictions

Proofreading should not change the strategic intent unless an error requires it.

---

# 18. STEP 12: Finalization

**Resolved (see Section 33, decision 2).** "Finalization" is `avoid-ai-detection`, the second and last step of Section 15's narrowed sequence — not `page-audit`, which (like `improve-content`) is no longer part of this pipeline; its holistic pre-publish checks were folded into the pre-writing checklist along with the other four removed skills. `avoid-ai-detection`'s pass/fail gates `COMPLETED` below.

The finalization stage turns the revised draft into the exact requested deliverable.

If `semantic-seo-content` produced or governed the draft and it contains extractive answers with an exact word or character target, run its `scripts/check_answers.py` here as a deterministic gate before `page-audit`: it checks stated word/character counts precisely, which none of the other audit skills do numerically. It is a length checker only, not a quality signal, so it complements `page-audit` rather than replacing it.

Claude should confirm:

```text
✓ Topic covered
✓ Search intent satisfied
✓ Required sections present
✓ Required entities/topics addressed
✓ Required style followed
✓ Required sources/claims handled
✓ SEO requirements satisfied
✓ Audit issues resolved
✓ Proofreading completed
✓ No placeholders remain
✓ No internal process instructions remain
✓ Output is publish-ready
```

Only after these checks should the status become:

```text
COMPLETED
```

---

# 19. Final Output Object

The system should maintain a machine-readable final result.

Example:

```json
{
  "job_id": "...",
  "status": "completed",
  "content_type": "seo_article",
  "model_used": "...",
  "draft_version": 1,
  "revision_count": 1,
  "final_content": "...",
  "research_summary": {},
  "validation": {
    "passed": true,
    "issues": []
  },
  "usage": {},
  "estimated_cost": 0
}
```

---

# 20. Error Handling

The pipeline must never silently continue after a critical tool failure.

## DataForSEO failure

If SEO research is required and DataForSEO fails:

```text
Do not fabricate metrics.
Retry according to configured retry policy.
If still unavailable, mark the research stage as degraded.
```

The system may continue only if the configured workflow explicitly allows a degraded SEO research mode.

## Firecrawl failure

If Firecrawl fails:

```text
Retry.
If still unavailable, mark web research as degraded.
Do not pretend competitor/source research was completed.
```

## OpenRouter failure

Retry according to configured policy.

Do not fall back to a different model without recording the fallback.

Example:

```json
{
  "provider": "openrouter",
  "requested_model": "model_a",
  "actual_model": "model_b",
  "fallback": true,
  "reason": "provider_error"
}
```

## Claude skill failure

Record:

```text
skill name
stage
error
input artifact
retry count
```

Continue only when the missing skill is non-critical.

---

# 21. Retry Policy

Implement configurable retries.

Suggested starting configuration:

```text
API_MAX_RETRIES = 2
API_RETRY_BACKOFF = exponential
MAX_REVISION_LOOPS = 3
```

Do not retry indefinitely.

---

# 22. State Management

The orchestration system should maintain explicit state for each job.

Recommended states:

```text
CREATED
INTAKE_COMPLETE
SKILLS_SELECTED
PRE_RESEARCH_RUNNING
DATAFORSEO_COMPLETE
FIRECRAWL_COMPLETE
RESEARCH_SYNTHESIZED
BRIEF_COMPLETE
OPENROUTER_RUNNING
DRAFT_COMPLETE
AUDIT_RUNNING
REVISION_REQUIRED
PROOFREADING
FINALIZING
VALIDATING
COMPLETED
FAILED
DEGRADED
```

Every stage should write its output to the job state so that failures can be diagnosed and, where possible, resumed.

---

# 23. Logging and Observability

Every job should log:

```text
job_id
start/end time
stage
skill
API/provider
model
input size
output size
token usage where available
cost where available
retry count
errors
revision count
final status
```

The log should make it possible to answer:

- Which model wrote this article?
- How much did it cost?
- Which research steps ran?
- Which skills ran?
- How many revisions occurred?
- Why did the final article change?
- Which stage failed if the job failed?

---

# 24. Cost Tracking

The system should separately track:

```text
Claude cost/usage
DataForSEO cost/usage
Firecrawl cost/usage
OpenRouter cost/usage
Total job cost
```

The business objective is to shift high-volume production writing to inexpensive OpenRouter models while preserving Claude's higher-value reasoning/editorial work.

Do not optimize solely for lowest token cost. Quality and successful finalization remain the primary constraints.

---

# 25. Security Requirements

API keys must never be included directly in prompts or stored in plain-text project files.

Use environment variables or the project's existing secure secret-management mechanism.

Example:

```text
OPENROUTER_API_KEY
FIRECRAWL_API_KEY
DATAFORSEO_LOGIN
DATAFORSEO_PASSWORD
```

Never expose API credentials in logs, generated prompts, or final content.

---

# 26. Prompt and Data Boundaries

The developer must keep the following boundaries clear:

### Claude → OpenRouter

Send:

- final research synthesis
- content strategy
- structure
- requirements
- source facts/constraints
- voice/style direction

Do not send:

- unnecessary internal tool logs
- API credentials
- irrelevant intermediate reasoning
- raw tool output when normalized results are available

### OpenRouter → Claude

Return:

- draft content
- model identifier
- usage/cost metadata where available

The OpenRouter model should not need access to DataForSEO or Firecrawl directly for the standard production path.

---

# 27. Task-Specific Routing

The system should support multiple content types from the same orchestrator.

Example:

```text
CONTENT TYPE
     ↓
TASK PROFILE
     ↓
Applicable pre-writing skills
Applicable tools
Applicable OpenRouter model
Applicable post-writing skills
```

Two concrete profiles for this system, **illustrative of the generic mechanism, not the mechanism itself** (see Section 11) — a third client/site gets a third profile with its own uploaded tone-of-voice document, not a new pipeline structure. Both updated per Section 33 decisions 2 and 3: `writer_mode` is resolved (delegated to OpenRouter, no exception carved out for `semantic-seo-content`), and `post_writing_skills` is narrowed to the two-skill Claude gate, with the former post-writing skills moved into `pre_writing_checklist_skills` — read for their rules at prompt-compile time, not run against the draft afterward.

```json
{
  "content_type": "seo_article",
  "client": "faceshapetool.com",
  "requires_dataforseo": true,
  "requires_firecrawl": true,
  "pre_writing_skills": [
    "anthropic-skills:keyword-deep-dive",
    "anthropic-skills:topic-cluster-planning",
    "semantic-seo-content",
    "anthropic-skills:cite-me"
  ],
  "pre_writing_checklist_skills": [
    "anthropic-skills:google-helpful-content-grader",
    "anthropic-skills:semantic-gap-analysis",
    "anthropic-skills:no-ai-slop",
    "anthropic-skills:heading-microcopy-writer"
  ],
  "voice_skill": "anthropic-skills:blog-writer",
  "drafting_mechanism": "writing-orchestrator (writer_generate via blindwrite) — resolved, see Section 33 decision 3. semantic-seo-content's writing rules are compiled into the system_prompt like the checklist skills above; Claude does not write this directly.",
  "openrouter_model": "writing-orchestrator's own leaderboard selection — this pipeline no longer implements Section 12 separately",
  "post_writing_skills": [
    "anthropic-skills:eeat-audit",
    "anthropic-skills:avoid-ai-detection"
  ]
}
```

```json
{
  "content_type": "legal_service_page",
  "client": "Juriszone",
  "requires_dataforseo": true,
  "requires_firecrawl": true,
  "pre_writing_skills": [
    "anthropic-skills:keyword-deep-dive",
    "anthropic-skills:content-brief",
    "semantic-seo-content"
  ],
  "pre_writing_checklist_skills": [
    "anthropic-skills:google-helpful-content-grader",
    "anthropic-skills:no-ai-slop"
  ],
  "voice_skill": "anthropic-skills:juriszone-content-writer",
  "drafting_mechanism": "writing-orchestrator (writer_generate via blindwrite) — resolved, see Section 33 decision 3",
  "openrouter_model": "writing-orchestrator's own leaderboard selection",
  "post_writing_skills": [
    "anthropic-skills:eeat-audit",
    "anthropic-skills:avoid-ai-detection"
  ]
}
```

Worth naming plainly for Juriszone specifically: this is a YMYL-adjacent legal service page, and the resolved pipeline now gives it the same two-skill post-writing gate as a face-shape blog post. `eeat-audit`'s authorship check matters more here, not less, than on faceshapetool.com — Juriszone doesn't have the fabricated-persona problem (real lawyer review is available, per the existing note below on `no_live_expert_interview: false`), but a legal page getting E-E-A-T wrong carries more real-world weight than a face-shape article. If the removed `google-helpful-content-grader`/`semantic-gap-analysis` post-writing checks were doing meaningful work specifically for this client, narrowing them to pre-writing-only instructions is a real risk, not a rounding error — a deliberate choice to accept was made in Section 33, but Juriszone is the profile where it's most worth watching.

The Juriszone profile drops `topic-cluster-planning`, `knowledge-graph-content-architect`, `cite-me`, and `heading-microcopy-writer` from the default set: those earn their keep on an informational blog trying to win AI-Overview citations, less so on a law firm's bottom-of-funnel service page, where `semantic-gap-analysis` also matters less than getting E-E-A-T and helpfulness right for a YMYL-adjacent topic. `no_live_expert_interview` should be `false` for Juriszone if real lawyer input is available; unlike the faceshapetool.com persona model, a legal service page benefits from genuine practitioner review rather than manufactured specificity.

This should be configurable rather than hard-coded throughout the implementation.

---

# 28. Future Model Benchmark Integration

The system should be designed so the writing model can later be selected using benchmark data.

The desired future architecture is:

```text
Task type
   ↓
Benchmark data
   ↓
Model quality score
   ↓
Cost/value score
   ↓
Recommended OpenRouter model
```

This follows the principle that the best writing model may differ by task: blind pairwise testing rather than assuming one universal winner.

As noted in Section 12, this is not purely a later enhancement here: `blindwrite`'s benchmark tools already implement this loop. The one remaining gap is that the personal leaderboard has no votes yet, so the "later enhancement" that remains is running enough `benchmark_create_task`/`benchmark_generate_outputs`/`benchmark_submit_vote` cycles per content type to make the leaderboard trustworthy, not building the mechanism itself.

---

# 29. Recommended First Implementation

Implement in this order.

## Phase 1: Orchestration skeleton

1. Create `/create-content` top-level skill/command.
2. Create job state.
3. Add stage-by-stage execution.
4. Add structured logs.
5. Add failure handling.

## Phase 2: Existing Claude skills

6. Connect pre-writing skills: `keyword-deep-dive`, `topic-cluster-planning`, `content-brief`, `semantic-triples-seo`, `knowledge-graph-content-architect`, `cite-me`, `wikipedia-ai-writing-signs`, plus `searchfit-seo:internal-linking` and `searchfit-seo:schema-markup`.
7. Connect audit skills: `google-helpful-content-grader`, `eeat-audit`, `semantic-gap-analysis`, `no-ai-slop`, `avoid-ai-detection`, `heading-microcopy-writer`.
8. Connect the proofreading pass: `improve-content` (see Section 17's naming-gap note).
9. Connect the finalization check: `page-audit`.
10. Ensure Claude can execute them automatically in sequence, per the ordering in Section 15.

## Phase 3: DataForSEO

11. Connect DataForSEO credentials.
12. Implement keyword/SERP retrieval.
13. Normalize the responses.
14. Feed normalized data into Claude synthesis.

## Phase 4: Firecrawl

15. Connect Firecrawl credentials.
16. Crawl selected SERP competitors/sources.
17. Extract relevant page content/structure.
18. Feed normalized research into Claude synthesis.

## Phase 5: Master brief

19. Define MASTER_WRITING_BRIEF schema.
20. Build deterministic assembly from all research/skill outputs.
21. Validate the brief before sending it to OpenRouter.

## Phase 6: OpenRouter

22. Connect OpenRouter.
23. Implement configurable model selection.
24. Send the master brief.
25. Store draft + usage + cost.
26. Return draft automatically to Claude.

## Phase 7: Post-writing

27. Execute audits.
28. Create structured issues.
29. Run automatic correction loop.
30. Run proofreading.
31. Run finalization.
32. Validate final result.

## Phase 8: One-click completion

33. Expose the whole pipeline behind one command/button.
34. Confirm no manual copy/paste is required.
35. Return only the final result plus concise execution metadata.

---

# 30. Acceptance Criteria

The implementation is complete when all of the following are true.

### One-click

A user can start the full workflow from a single command/button.

### Automated tool usage

For an SEO article, Claude automatically invokes the applicable Claude skills, DataForSEO, and Firecrawl without requiring the user to manually move information between them.

### Automated writing handoff

Claude automatically builds a master brief and passes it to OpenRouter.

### Automated return

The OpenRouter draft automatically returns to Claude.

### Automated quality process

Claude automatically runs the configured audits, correction loop, proofreading, and finalization.

### No manual transfer

The user never needs to copy a brief into OpenRouter or copy a draft back into Claude.

### Traceability

Every job records which skills, tools, models, revisions, costs, and failures were involved.

### Safe failure

A failed API call is visible and does not get represented as successfully completed research.

### Final validation

The pipeline does not mark a job complete until the final content passes configured validation rules.

---

# 31. Developer Implementation Principle

Do not build four independent automations that happen to run in sequence.

Build **one stateful content orchestrator** with pluggable stages.

The orchestrator should treat:

```text
Claude skills
DataForSEO
Firecrawl
OpenRouter
Claude audits
Proofreading
Finalization
```

as modules inside one controlled pipeline.

The most important architectural boundary is:

```text
CLAUDE = intelligence, research, planning, editorial control, QA

OPENROUTER = low-cost production writing
```

This preserves the benefit discussed in the source material: use the stronger model and existing tooling for research, planning, audience decisions, and editorial control, while shifting the large volume of production-writing tokens to cheaper OpenRouter models.

**Recalibration of the cost claim (2026-09-14).** That framing was written when the default drafting model was DeepSeek V3 at $0.14 / $0.28 per million tokens, roughly twenty to fifty times cheaper than Claude for the same word count. The current model set changes the math materially. `deepseek/deepseek-v4.1-flash` at $0.15 / $0.60 is still a large saving. `z-ai/glm-5.3` at $0.936 / $3.168 is roughly three to five times cheaper than Claude Sonnet's output pricing, not an order of magnitude. On top of that, this pipeline now spends real Claude tokens grading every draft and every revision loop, and sends longer OpenRouter prompts than originally designed because the quality checklist and voice layer are copied verbatim rather than paraphrased. The pipeline is still cheaper than drafting in Claude, and the delegation of bulk writing still holds as a design principle. But "a fraction of the cost" describes the DeepSeek Flash path accurately and overstates the GLM-5.3 path. Treat cost per finished article, measured after the revision loop settles, as the number that matters — not the per-token sticker price of the drafting model.

---

# 32. Final Target Workflow

```text
USER
 │
 │ One click / one command
 ▼
CLAUDE ORCHESTRATOR
 │
 ├── Determine content type
 │
 ├── Select applicable skills
 │
 ├── Run pre-writing skills
 │
 ├── Query DataForSEO
 │
 ├── Query Firecrawl
 │
 ├── Analyze and synthesize research
 │
 ├── Build MASTER_WRITING_BRIEF
 │
 ├── Select OpenRouter model
 │
 ├── Send brief to OpenRouter
 │
 ├── Receive draft
 │
 ├── Run content/SEO audits
 │
 ├── Fix issues
 │
 ├── Re-audit if required
 │
 ├── Proofread
 │
 ├── Finalize
 │
 ├── Validate
 │
 └── Return final content
 │
 ▼
PUBLISH-READY OUTPUT
```

## Reference principle from the source discussion

The source discussion describes a workflow where Claude Code/Codex remains the main interface, constructs the research/content brief, and calls OpenRouter for the production writing. The example described a large prepared brief being sent to the writing model, with the rationale being to keep the smarter model focused on research/planning/editorial decisions while using inexpensive model tokens for production copy.

This specification adapts that architecture to the existing Claude skill system and adds DataForSEO, Firecrawl, automatic auditing, proofreading, and finalization into a single end-to-end workflow.

---

# 33. Concrete Skill Mapping: Rationale and Open Decisions

This section records why each skill was assigned to its slot, and tracks the implementation decisions that shaped this pipeline so they don't get buried in the JSON above. All four original open decisions are resolved, plus three more (voice-layer genericness, automation scope, semantic-seo-content's research path) raised and resolved in the same round while checking whether this document was actually complete.

## Why these skills and not others

The `anthropic-skills` namespace was preferred over `searchfit-seo` and `marketing` wherever both offered something similar, because `anthropic-skills:blog-writer`, `juriszone-content-writer`, and `openrouter-draft-audit` are already built specifically for this operation (faceshapetool.com's persona and Juriszone's voice), while `searchfit-seo` and `marketing` are generic marketplace skills with no knowledge of either. `searchfit-seo:internal-linking` and `searchfit-seo:schema-markup` are the exceptions: no equivalent exists in `anthropic-skills`, so the generic version is the only option until a custom one is built.

Audit ordering (Section 15) follows the cost-of-fixing principle from the earlier discussion of this pipeline: `google-helpful-content-grader` and `eeat-audit` run first because their findings can require rewriting whole sections, and `no-ai-slop`/`avoid-ai-detection`/`heading-microcopy-writer` run last because sentence-level polish on a section about to be restructured is wasted work.

## Open decision 1 — RESOLVED: content-brief absorbs Sections 8-9 internally

User's decision: upgrade `content-brief` itself to call `mcp__dfseo__*` (keyword/SERP data) and `mcp__firecrawl__*` (competitor extraction) internally instead of a generic web search, making it the single pre-writing research step, rather than running Sections 8-9 as separate stages that `content-brief` then re-derives with less precise data.

Trade-off accepted knowingly: this was chosen over keeping `content-brief` usable standalone outside this pipeline (the option not picked) — `content-brief` now depends on the DataForSEO/Firecrawl API access this pipeline provides, so an ad hoc brief run outside this orchestrator either needs that same access wired up wherever `content-brief` runs, or falls back to a plain search when it isn't available. Worth a quick check next time `content-brief` is invoked standalone, rather than assuming it still behaves the same way it did before this change.

The one residual thread this raised — whether `semantic-seo-content` (used instead of `content-brief` for some faceshapetool.com content) needed its own research upgrade — is resolved below in Decision 7.

## Open decision 2 — RESOLVED: proofreading and finalization are eeat-audit + avoid-ai-detection

User's decision, verbatim: *"what proofreading and finalization actually mean here [skills specific to post content audit like /openrouter-draft-audit except checking for eeat like who has written it part /avoid-ai-detection]."*

Resolution: "proofreading" (Section 17) is `eeat-audit`, used specifically for its authorship/trust dimension — who this is attributed to, whether the persona holds up, fabricated-experience risk. "Finalization" (Section 18) is `avoid-ai-detection` — the mechanical artifact scan. `improve-content` and `page-audit`, this document's original guesses for these two slots, are dropped from the pipeline entirely, not repurposed. Their substance (and the substance of `google-helpful-content-grader`, `semantic-gap-analysis`, `no-ai-slop`, `heading-microcopy-writer`, which used to run alongside them in Section 15) becomes pre-writing checklist material — see decision 3 immediately below, since this decision and decision 3 are really one design, not two.

This is worth naming as a coverage trade rather than a pure simplification: six skills stop checking the actual draft and instead only inform the prompt that produced it. That's reasonable if the OpenRouter drafting+self-critique loop reliably follows the compiled instructions; it's a real quality risk if it doesn't, and there's no post-writing check left in this pipeline that would catch the gap except `eeat-audit` and `avoid-ai-detection`, neither of which was designed to catch slop, thin content, or semantic gaps.

## Open decision 3 — RESOLVED: writing-orchestrator is the sole drafting mechanism; audit moves into the prompt

User's decisions, verbatim: *"orchestrator should become the one drafting mechanism instead — yes no overlapping"* and *"delegated to OpenRouter — everywriting based on brief, instructions and audit should happen inside open router."*

Resolution, in two parts:

1. **No overlap.** `writing-orchestrator` (pre-existing, plugin-backed, third-party) is now the only thing that calls `writer_generate`, selects a model, and runs the drafting loop. `openrouter-draft-audit` no longer reimplements any of that — it was rewritten (via `propose_skills`, this session) into a thin skill that builds the brief + compiled checklist, hands off to `writing-orchestrator`, and then runs the two-skill Claude gate from decision 2. This pipeline's Sections 12-13 were updated the same way: they describe `writing-orchestrator`'s behavior as background, not a separate implementation to build. The `writing-orchestrator`/`openrouter-draft-audit`/Sections-12-16 three-way overlap this document previously flagged is closed.

   **Resolved concretely, not just flagged.** `writing-orchestrator`'s exact rule is: *"Strictly DO NOT generate an unprompted analysis, critique, or rewrite"* unless the user asks or `include_critique: true` is set. That's written for `writing-orchestrator` used standalone. The risk is that once `openrouter-draft-audit` has loaded `writing-orchestrator` as a sub-step, both skills' instructions sit in the same context, and the Anti-Tax Rule reads like a general instruction — one that could be (mis)applied to skip the eeat-audit/avoid-ai-detection gate itself, since the user's specific request didn't explicitly ask for critique. The rewritten `openrouter-draft-audit` SKILL.md now states this explicitly and up front, before Step 2: the Anti-Tax Rule governs `writing-orchestrator` standalone only; once `openrouter-draft-audit` is the skill in use, its Step 3 gate is mandatory and unconditional, and a draft that skips it is a bug in execution, not a legitimate default. This is a case where the fix had to live in the skill's own instruction text — there's no separate config flag to set; skills are followed as written, so the override has to be written just as plainly as the rule it overrides.

2. **Audit "inside OpenRouter" means prompt text, not skill execution — and the text should be copied verbatim, not paraphrased.** This is a technical point worth being precise about rather than letting the phrase "audit happens inside OpenRouter" imply more automation than exists: a raw OpenRouter completion has no mechanism to load or run a Claude Skill. What "inside OpenRouter" can actually mean is that the relevant paragraphs of `google-helpful-content-grader`, `semantic-gap-analysis`, `no-ai-slop`, and `heading-microcopy-writer` get copied by Claude, word for word, into the `system_prompt`/`prompt` sent to `writer_generate`. This was confirmed against OpenRouter's own documented pattern for this exact idea (their Agent SDK's "skills-loader" example): even there, a Skill never executes inside the model — client-side code reads the SKILL.md file and pastes its literal text into the next message, gated by the model calling a tool for it. That's the same mechanism this pipeline uses, minus the tool-calling gate (which `writer_generate`'s plain string parameters don't support anyway).

   The one refinement made from studying that example: Step 1 originally had Claude read these four skills and summarize their rules in its own words before pasting the summary in. That paraphrase step is now removed — Claude copies the actual relevant text verbatim instead, to close the compilation-drift risk (a paraphrase can silently drop a qualifier or the example that made a rule concrete). The trade is a longer `system_prompt` per call, which itself needs managing: pasting whole SKILL.md files rather than the specific relevant excerpt risks a cheap drafting model losing track of a long instruction block, which defeats the purpose as surely as an over-compressed summary would. `openrouter-draft-audit` Step 1 now says explicitly: copy the real text, but only the part that's actually relevant to the job.

3. **Self-grading risk — RESOLVED.** Flagged initially: if the same cheap model both drafts and self-critiques (`include_critique: true` against the same `model_id`), it checks its own output for the exact failure modes — overclaiming, invented causation, mechanical repetition — that cheap models are most prone to in the first place. Two mitigations were proposed (accept the risk, or route critique through a stronger OpenRouter `model_id`). The user picked a third, better option instead: **grading happens in Claude, fixing happens in OpenRouter, structured as a loop.** Claude runs `eeat-audit` + `avoid-ai-detection` against the actual draft (not a pre-compiled prompt instruction); if issues are found, Claude produces structured findings (`status`/`issues` JSON, Section 16), and those findings — not Claude's own rewrite — become the revision brief sent back through `writing-orchestrator`/`writer_generate`. The revised draft is re-graded by Claude, capped at `MAX_REVISION_LOOPS = 3` (Section 16).

   This is a cleaner fix than either original option: Claude was never the model that produced the draft, so there's no self-grading question at all, and it required no second OpenRouter call or model-selection logic on top of what `writing-orchestrator` already does. The real cost is Claude tokens spent on grading every loop iteration — that cuts into the token savings this pipeline exists to capture, and is worth watching per content type: if a given model/content-type combination keeps needing multiple loops, that's a signal to sharpen Section 15's pre-writing checklist or switch `model_id`, not to keep paying for more rounds against the same weak draft. `openrouter-draft-audit`'s SKILL.md (updated again this session) implements this loop and its escalation path when `MAX_REVISION_LOOPS` is exhausted without a clean pass.

## Open decision 4 — RESOLVED by decision 3: semantic-seo-content's writing rules are delegated, not written directly by Claude

The user's decision 3 (*"everywriting based on brief, instructions... should happen inside open router"*) directly answers this: `semantic-seo-content`'s direct-writing rules (predicate precision, evidence-calibrated modality, exact-word-count extractive answers) are folded into the `system_prompt` alongside the other checklist skills, per decision 3's compiled-prompt mechanism — not used by Claude to write the copy itself. Section 27's `seo_article` profile reflects this (`drafting_mechanism` field, `writer_mode` removed as unresolved).

This carries the same risk this document originally flagged when the decision was still open: `semantic-seo-content`'s rules exist specifically because generic models violate them (overclaim, invent causation, generic filler) — and a cheap OpenRouter model is exactly that profile. Folding the rules into a prompt is necessary but not sufficient; whether it's sufficient in practice depends on the self-grading question in decision 3 above. If `eeat-audit`/`avoid-ai-detection` keep passing content that still violates `semantic-seo-content`'s evidence-calibration or extractive-answer rules — since neither of those two gate skills checks for that — that's a concrete sign this decision needs revisiting for this specific skill, given how much more precision-dependent it is than the others folded into the same checklist.

## Decision 5 — RESOLVED: this pipeline is site-agnostic; voice is a per-project upload, not a pipeline fact

Raised when checking whether this document was actually finished: an earlier draft of the voice-layer discussion (Section 11) was heading toward hardcoding faceshapetool.com's Mandy Milburn persona details directly into the pipeline's core sections. The user corrected this directly: *"this is build for any site not in particular... dont make it for any particular for any site the complete structure"* and *"for each site different tone of voice will be uploaded for which ever site or niche we are working or projects."*

Resolution: the pipeline's core mechanics (Sections 1-26, 28-32, this section) never hardcode a specific site's persona, name, or voice. `style_requirements`/`voice_requirements` (Section 11) are populated at brief time from that project's own uploaded tone-of-voice document — one per site/niche, supplied by the user, read and excerpted verbatim (same principle as decision 3's checklist injection), never invented by Claude when one hasn't been provided. Section 27's faceshapetool.com/Juriszone profiles are this account's current examples of the mechanism, not the mechanism itself.

This also means the "Mandy Milburn" vs. "Mandy Miller" naming question raised alongside this is explicitly out of scope for this document — it's a fact about one project's own materials, not a pipeline design decision, and belongs in that project's own memory/skill, not here.

## Decision 6 — RESOLVED: automation target is on-demand, attended-session use, not scheduled/unattended

Asked directly, since Section 4's "one-click execution contract" language reads as an aspiration toward full unattended automation: given `writer_generate` only works while the device bridge to the user's own computer is connected, is scheduled/unattended execution actually the goal? User's answer: **on-demand only — the user runs jobs themselves when at their computer.**

This is now stated as confirmed scope in Section 4, not a future goal this pipeline is incrementally building toward. It also means "one-click" should be read as "one invocation, minimal manual steps within a session" rather than "runs without anyone present" — a genuinely unattended version would require replacing `writer_generate`/`blindwrite` with a cloud-reachable OpenRouter integration (no device-bridge dependency), which is out of scope unless the user asks for it later.

## Decision 7 — RESOLVED: semantic-seo-content calls content-brief internally for research

Raised while closing decision 1: `semantic-seo-content` is used instead of `content-brief` for some faceshapetool.com content (Section 6), and didn't have content-brief's new internal DataForSEO/Firecrawl grounding. Three options were on the table — route through `content-brief` internally, duplicate the API-calling upgrade directly into `semantic-seo-content`, or accept a lighter research pass for that path. The user picked the first: `semantic-seo-content` calls `content-brief` internally for research, then applies its own entity-attribute-value/semantic-triple/evidence-calibration writing method on top of that research. One research path, shared by both skills, rather than two skills separately calling the same DataForSEO/Firecrawl APIs or one of them running on weaker grounding.

## Sigma CapSeal — explicitly out of scope

Checked directly rather than assumed: Sigma CapSeal (B2B outreach/LinkedIn work) does not run through this content pipeline. It has no persona/voice document and none should be invented for it. If Sigma CapSeal content work is ever brought into scope later, it needs its own uploaded tone-of-voice document first, per Decision 5 — not a bespoke exception grafted onto this pipeline's structure.
