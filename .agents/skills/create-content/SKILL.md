---
name: create-content
description: "Top-level content pipeline orchestrator. Single invocation runs the full Claude + OpenRouter + DataForSEO + Firecrawl content production pipeline: preflight checks, intake, pre-writing research, brief compilation, OpenRouter drafting via writing-orchestrator, Claude grading loop (eeat-audit + avoid-ai-detection), and clean delivery. One invocation produces one publish-ready article. Triggers on: /create-content, create article, create seo article, create content, run content pipeline, produce content."
---

# Create Content -- Pipeline Orchestrator Skill

## One Invocation. One Publish-Ready Article.

This skill is the single entry point for the full content production pipeline. You do not
manually execute the sub-steps (keyword research, SERP analysis, brief creation, drafting,
audit, etc.) one at a time. One invocation of this skill runs the entire Phase 0-5 sequence.

---

## Invocation Format

```
/create-content

Keyword: [PRIMARY_KEYWORD]
Topic: [TOPIC -- if different from keyword]
Content type: [seo_article | legal_service_page | listicle | blog_post | ...]
Target length: [OPTIONAL -- e.g. "1500-2000 words"]
Special requirements: [OPTIONAL -- constraints beyond the registry's hard_rules]
```

Only ask for information not inferable from the Claude Project, registry, or workspace.
Do not ask for voice/persona -- that comes from the site registry.

---

## PHASE 0 -- Preflight (4 Hard Stops)

Run all 4 checks before doing anything else. Any failure = stop and tell the user exactly why.

### Stop 1: Confirm device bridge is connected

Call `benchmark_list_models`. If the call errors (MCP server unreachable), stop:
> "BlindWrite MCP is not responding. The content pipeline requires the device bridge to be
> connected. Please check that Claude Desktop has BlindWrite MCP announced as connected,
> then retry."

Do not fall back to drafting in Claude directly.

### Stop 2: Resolve which site this job is for

Determine site from the active Claude Project name. Look up the Project name in
`.agents/skills/create-content/site-registry.md`.

- If the Project maps to a registry entry with `status: active`: load that entry. Continue.
- If the Project maps to an entry with `status: out_of_scope`: stop and show the
  `out_of_scope_reason` from the registry. Do not proceed.
- If the Project name maps to no entry: ask the user once which site this job is for.
  Do not guess. A wrong site produces fully-polished content in the wrong voice.

### Stop 3: Confirm voice document is readable

The registry entry's `voice_doc_path` must be non-null and the document must be readable
(open it and confirm you can read its text).

- If `voice_doc_path` is null, "PENDING", or unreadable: stop.
  > "The voice document for [SITE] is missing or unreadable. The pipeline requires it to
  > populate style_requirements and voice_requirements in the writing brief. Please:
  > (a) Add the document path to site-registry.md and confirm it's accessible, or
  > (b) Explicitly sign off on proceeding with voice_requirements left empty (this will
  > be flagged in the delivery summary and will likely cause the eeat-audit gate to fail)."

Never invent a voice to fill the gap.

### Stop 4: Confirm a usable drafting model exists

`benchmark_list_models` must return at least one model with `enabled: true`. If not:
> "benchmark_list_models returned no enabled models. This is a configuration fault --
> writer_generate has no valid model to select. Check the BlindWrite database."

---

## PHASE 1 -- Intake

Capture from the user's invocation and the registry (do not ask for what's already known):

```json
{
  "job_id": "content_YYYY_MM_DD_NNN",
  "site": "...",
  "content_type": "...",
  "primary_topic": "...",
  "primary_keyword": "...",
  "secondary_keywords": [],
  "target_audience": "...",
  "business_goal": "...",
  "target_length": "...",
  "special_constraints": []
}
```

Generate `job_id` as `content_` + today's date (YYYY_MM_DD) + `_001` (increment if multiple
jobs run today). Create `data/jobs/` directory if it does not exist.

Write initial job state to `data/jobs/{job_id}.json`:
```json
{
  "job_id": "...",
  "status": "INTAKE_COMPLETE",
  "site": "...",
  "content_type": "...",
  "primary_keyword": "...",
  "model_used": null,
  "revision_count": 0,
  "draft_version": 1,
  "audit_findings": [],
  "validation": { "passed": false, "issues": [] },
  "errors": [],
  "cost_summary": { "openrouter_usd": 0, "dataforseo_usd": 0, "firecrawl_usd": 0, "total_usd": 0 },
  "started_at": "ISO_TIMESTAMP",
  "completed_at": null
}
```

Select the content-type profile from the registry entry's `content_profiles` for this
`content_type`. If no profile exists for the requested content type, tell the user --
do not invent a profile. Update job status to `SKILLS_SELECTED`.

---

## PHASE 2 -- Pre-Writing Research and Brief

Update job status to `PRE_RESEARCH_RUNNING`.

### 2a. Determine which pre-writing skill builds the brief

From the registry entry's `pre_writing_skill`:

- **`semantic-seo-content`**: entity-attribute-value precision, semantic triples, evidence-
  calibrated writing. Used for faceshapetool.com SEO articles. This skill calls `content-brief`
  internally for DataForSEO + Firecrawl research -- do not run DataForSEO/Firecrawl separately.
- **`content-brief`**: for other content types, or when the lighter skill fits better.
  This skill runs DataForSEO (`mcp__dfseo__*`) and Firecrawl (`mcp__firecrawl__*`) internally.

Run the selected skill. Do not duplicate the research by also running DataForSEO/Firecrawl
manually as separate stages -- that duplication was resolved.

After DataForSEO research completes: update status to `DATAFORSEO_COMPLETE`.
After Firecrawl research completes: update status to `FIRECRAWL_COMPLETE`.
After synthesis/normalization: update status to `RESEARCH_SYNTHESIZED`.

### 2b. Run additional pre-writing skills per content-type profile

Run each skill listed in the content-type profile's `pre_writing_skills` (after the primary
brief-building skill).

### 2c. Assemble the MASTER_WRITING_BRIEF

Synthesize all research into a single structured object per Section 11 of the pipeline spec:

```json
{
  "job_id": "...",
  "content_type": "...",
  "topic": "...",
  "primary_keyword": "...",
  "secondary_keywords": [],
  "search_intent": "...",
  "target_audience": "...",
  "business_goal": "...",
  "research_summary": {},
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

For `persona_experience_details`: if `no_live_expert_interview: true`, decide the specific
concrete experience detail (a product, a date, a concrete failure or success) at this point --
after the fact, no rewrite can manufacture genuine first-hand specificity. If
`no_live_expert_interview: false`, leave this array empty.

`style_requirements` and `voice_requirements` are populated in Phase 3, not here.

Update job status to `BRIEF_COMPLETE`.

---

## PHASE 3 -- Compile Checklist + Voice Layer

Invoke `openrouter-draft-audit` STEP 1.

That step:
- Reads the relevant checklist skill excerpts verbatim (from `pre_writing_checklist_skills`)
- Reads the voice document via `voice_skill` (falls back to `voice_doc_path` if null)
- Populates `style_requirements` and `voice_requirements` in the brief
- Assembles the full `system_prompt` + `prompt` for the drafting call

Update job status to `OPENROUTER_RUNNING`.

---

## PHASE 4 -- Draft, Grade, Fix Loop

Invoke `openrouter-draft-audit` STEPS 2-4.

That runs:
- STEP 2: Delegates to `writing-orchestrator` -> `writer_generate` -> returns draft
- STEP 3: Claude grades with `eeat-audit` + `avoid-ai-detection` -> structured findings
- STEP 4: Loop (max 3 revisions) or escalate

Update status to `AUDIT_RUNNING` at start of each grading pass.
Update status to `REVISION_REQUIRED` when issues found and loop continues.
Update status to `DRAFT_COMPLETE` when grading gate passes.

After each loop iteration, update job state:
```json
{
  "status": "AUDIT_RUNNING | REVISION_REQUIRED | DRAFT_COMPLETE",
  "revision_count": 1,
  "audit_findings": [{ "loop": 1, "status": "needs_revision", "issues": [] }],
  "model_used": "model_id from writer_generate response"
}
```

If `openrouter-draft-audit` escalates (3 loops, unresolved issues): pause and wait for
the user's explicit choice per the escalation options. Update job status to `DEGRADED`.
Do not pick a resolution for the user.

---

## PHASE 5 -- Finalize and Deliver

When the draft passes the grading gate:

### 5a. Save the final file

Save the final (graded) draft to `data/drafts/` -- `writer_generate` does this automatically
via `export_file: true`. Confirm the file exists. Update status to `PROOFREADING`.

### 5b. Run finalization checklist (Section 18 gate)

Update status to `FINALIZING`. Confirm every item below against the actual draft:

```
[ ] Topic covered
[ ] Search intent satisfied
[ ] Required sections present
[ ] Required entities/topics addressed
[ ] Required style followed (check against voice doc)
[ ] Required sources/claims handled
[ ] SEO requirements satisfied
[ ] Audit issues resolved (all issues from audit_findings are fixed)
[ ] No placeholder text remains ([INSERT X], template variables, etc.)
[ ] No internal process instructions remain in the draft body
[ ] Output is publish-ready Markdown (no raw tool output, no badges, no preamble)
```

Update status to `VALIDATING`.

If any item fails: update `validation.issues` in the job log with the specific failure.
Do not mark `COMPLETED` until all 11 items pass.

If a failure cannot be fixed automatically (e.g. required entity was never in the brief):
stop, surface it to the user, and update status to `DEGRADED`.

Update `validation` in the job log:
```json
{
  "passed": true,
  "issues": []
}
```

### 5c. Deliver clean Markdown to the user

Output ONLY the final drafted content as clean Markdown. No:
- Technical jargon or MCP tool references
- Cost/token/latency badges
- Audit review blocks or step recaps
- Process summaries

### 5d. Write the final job log

Update `data/jobs/{job_id}.json` to `COMPLETED` with the full Section 19 schema:
```json
{
  "job_id": "...",
  "status": "COMPLETED",
  "content_type": "...",
  "model_used": "...",
  "draft_version": 1,
  "revision_count": 0,
  "final_content": "(path to saved file in data/drafts/)",
  "research_summary": "(summary of what pre-writing research ran)",
  "validation": { "passed": true, "issues": [] },
  "audit_findings": [],
  "cost_summary": {
    "openrouter_usd": 0.00,
    "dataforseo_usd": 0.00,
    "firecrawl_usd": 0.00,
    "total_usd": 0.00
  },
  "draft_file": "data/drafts/...",
  "started_at": "ISO_TIMESTAMP",
  "completed_at": "ISO_TIMESTAMP"
}
```

This log is internal only -- do not output it to the user unless they ask for diagnostics.

---

## Quick Reference: Stop Conditions

Stop and do not proceed past these without explicit user input:

| Condition | Stop After |
|---|---|
| Device bridge not connected | Phase 0, Stop 1 |
| Site can't be resolved | Phase 0, Stop 2 |
| Voice document missing/unreadable without sign-off | Phase 0, Stop 3 |
| Site `status: out_of_scope` | Phase 0, Stop 2 |
| No enabled drafting model | Phase 0, Stop 4 |
| No content-type profile for requested type | Phase 1 |
| No voice document at Phase 3 (after passing Stop 3 with sign-off) | Phase 3 |
| Revision loop exhausted (MAX_REVISION_LOOPS = 3) | Phase 4 escalation |
| Finalization checklist item fails (unfixable) | Phase 5b |

---

## Full State Machine (Section 22)

```
CREATED
  -> INTAKE_COMPLETE
  -> SKILLS_SELECTED
  -> PRE_RESEARCH_RUNNING
  -> DATAFORSEO_COMPLETE
  -> FIRECRAWL_COMPLETE
  -> RESEARCH_SYNTHESIZED
  -> BRIEF_COMPLETE
  -> OPENROUTER_RUNNING
  -> DRAFT_COMPLETE
  -> AUDIT_RUNNING
  -> REVISION_REQUIRED  (loops back to AUDIT_RUNNING, max 3 times)
  -> PROOFREADING
  -> FINALIZING
  -> VALIDATING
  -> COMPLETED
  | FAILED
  | DEGRADED
```

Every state transition writes to `data/jobs/{job_id}.json` so failures can be diagnosed
and, where possible, resumed from the last completed state.

---

## What the User Sees

Only:
1. The final publish-ready Markdown content
2. (Optional) If they ask: which model wrote it, how many revision loops, total cost

Never output: tool names, MCP calls, audit findings, token counts, file paths -- unless
the user explicitly asks for technical diagnostics.