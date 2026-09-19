---
name: create-content
description: "Top-level content pipeline orchestrator. Single invocation runs the full Claude + OpenRouter + DataForSEO + Firecrawl content production pipeline: preflight checks, intake, pre-writing research, brief compilation, OpenRouter drafting via writing-orchestrator, Claude grading loop (eeat-audit + avoid-ai-detection), and clean delivery. One invocation produces one publish-ready article for ANY website or client. Triggers on: /create-content, create article, create seo article, create content, run content pipeline, produce content."
---

# Create Content -- Universal Pipeline Orchestrator Skill

## One Invocation. One Publish-Ready Article.

This skill is the single entry point for the full content production pipeline. You do not
manually execute the sub-steps (keyword research, SERP analysis, brief creation, drafting,
audit, etc.) one at a time. One invocation of this skill runs the entire Phase 0-5 sequence.

This skill is **100% self-contained** and works out-of-the-box for **any website or domain**.
Site profiles and editorial guidelines can be passed directly in the invocation prompt or configured
in the built-in Site Configuration section below.

---

## Invocation Format

```
/create-content

Site / Domain: [OPTIONAL -- e.g. "myblog.com", "Acme Tech", or omit for default]
Keyword: [PRIMARY_KEYWORD]
Topic: [TOPIC -- if different from keyword]
Content type: [seo_article | b2b_service_page | listicle | blog_post | how_to_guide | ...]
Voice / Tone: [OPTIONAL -- e.g. "Authoritative, conversational, no jargon", or path to voice doc]
Target length: [OPTIONAL -- e.g. "1500-2000 words"]
Special requirements: [OPTIONAL -- specific domain constraints]
```

Only ask for information not inferable from the prompt, project, or workspace.

---

## PHASE 0 -- Preflight (4 Hard Stops)

Run all 4 checks before doing anything else. Any failure = stop and tell the user exactly why.

### Stop 1: Confirm device bridge is connected

Call `benchmark_list_models`. If the call errors (MCP server unreachable), stop:
> "BlindWrite MCP is not responding. The content pipeline requires the device bridge to be
> connected. Please check that Claude Desktop has BlindWrite MCP announced as connected,
> then retry."

Do not fall back to drafting in Claude directly.

### Stop 2: Resolve site identity & profile

Determine site identity from:
1. The `Site / Domain:` field in the user's invocation (highest priority)
2. The active Claude Project name (if running inside a specific Project)
3. The built-in Site Profiles in this skill (or an optional `site-registry.md` if present in the workspace)

Resolution rules:
- If a matching profile exists: load that configuration.
- If no specific site profile is matched: apply the built-in `_default` universal profile for the specified domain/brand. If no domain was provided, proceed using `_default`.
- If an entry has `status: out_of_scope`: stop and report the `out_of_scope_reason`.

### Stop 3: Confirm voice and style guidelines

Resolve voice guidelines from:
1. The `Voice / Tone:` parameter provided in the user's invocation (highest priority)
2. The resolved site profile's `voice_doc_path` (if a file/link is provided and accessible)
3. The site profile's `voice_guidelines` or `voice_skill`
4. Standard editorial guidelines: Clear, direct, authoritative, reader-centric, active voice, devoid of AI clichés and filler.

- If an explicit `voice_doc_path` was specified in the profile but cannot be read, inform the user and proceed with inline guidelines.
- Never invent fabricated credentials or inconsistent persona details.

### Stop 4: Confirm a usable drafting model exists

`benchmark_list_models` must return at least one model with `enabled: true`. If not:
> "benchmark_list_models returned no enabled models. This is a configuration fault --
> writer_generate has no valid model to select. Check the BlindWrite database."

---

## PHASE 1 -- Intake

Capture from the user's invocation and the resolved profile:

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

Select the content profile from the site entry's `content_profiles` for this `content_type` (falling back to `_default.content_profiles`). Update job status to `SKILLS_SELECTED`.

---

## PHASE 2 -- Pre-Writing Research and Brief

Update job status to `PRE_RESEARCH_RUNNING`.

### 2a. Determine which pre-writing skill builds the brief

From the site profile's `pre_writing_skill`:

- **`semantic-seo-content`**: entity-attribute-value precision, semantic triples, evidence-calibrated writing. Ideal for technical, competitive, or entity-rich SEO articles. This skill calls `content-brief` internally for DataForSEO + Firecrawl research -- do not run DataForSEO/Firecrawl separately.
- **`content-brief`**: standard research brief for general articles, service pages, and blog posts. Runs DataForSEO (`mcp__dfseo__*`) and Firecrawl (`mcp__firecrawl__*`) internally.

Run the selected skill without duplicating manual research stages.

After DataForSEO research completes: update status to `DATAFORSEO_COMPLETE`.
After Firecrawl research completes: update status to `FIRECRAWL_COMPLETE`.
After synthesis/normalization: update status to `RESEARCH_SYNTHESIZED`.

### 2b. Run additional pre-writing skills per content-type profile

Run any skills listed in the content-type profile's `pre_writing_skills` (after the primary brief-building skill).

### 2c. Assemble the MASTER_WRITING_BRIEF

Synthesize all research into a single structured object:

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
  "no_live_expert_interview": false
}
```

For `persona_experience_details`: if the profile has `no_live_expert_interview: true`, decide the specific concrete experience detail (e.g. testing context, workflow detail) at brief time. If `no_live_expert_interview: false`, leave this array empty.

`style_requirements` and `voice_requirements` are populated in Phase 3.

Update job status to `BRIEF_COMPLETE`.

---

## PHASE 3 -- Compile Checklist + Voice Layer

Invoke `openrouter-draft-audit` STEP 1.

That step:
- Reads the relevant checklist skill excerpts verbatim (from `pre_writing_checklist_skills`)
- Reads the voice guidelines (from invocation or resolved site profile)
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

### 5b. Run finalization checklist

Update status to `FINALIZING`. Confirm every item below against the actual draft:

```
[ ] Topic covered
[ ] Search intent satisfied
[ ] Required sections present
[ ] Required entities/topics addressed
[ ] Required style followed (check against voice guidelines)
[ ] Required sources/claims handled
[ ] SEO requirements satisfied
[ ] Audit issues resolved (all issues from audit_findings are fixed)
[ ] No placeholder text remains ([INSERT X], template variables, etc.)
[ ] No internal process instructions remain in the draft body
[ ] Output is publish-ready Markdown (no raw tool output, no badges, no preamble)
```

Update status to `VALIDATING`.

If any item fails: update `validation.issues` in the job log with the specific failure.
Do not mark `COMPLETED` until all items pass.

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

Update `data/jobs/{job_id}.json` to `COMPLETED`:
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

| Condition | Stop After |
|---|---|
| Device bridge not connected | Phase 0, Stop 1 |
| Drafting model not enabled | Phase 0, Stop 4 |
| Site `status: out_of_scope` | Phase 0, Stop 2 |
| Revision loop exhausted (MAX_REVISION_LOOPS = 3) | Phase 4 escalation |
| Finalization checklist item fails (unfixable) | Phase 5b |

---

## Full State Machine

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

---

## Site Configuration & Profiles (Self-Contained)

This skill is completely self-contained. Site configuration can be supplied dynamically in the
`/create-content` invocation, defined here, or optionally read from a local workspace `site-registry.md`.

### Built-in Archetypes & Profiles

```json
{
  "_default": {
    "site": "Default / Universal",
    "status": "active",
    "voice_guidelines": "Conversational yet authoritative, clear, engaging, concise. Avoid corporate jargon, buzzwords, and AI filler phrases.",
    "persona": null,
    "no_live_expert_interview": false,
    "pre_writing_skill": "content-brief",
    "hard_rules": [
      "Never publish fabricated statistics without a cited source",
      "No AI detection artifacts: zero-width Unicode, curly quotes, repetitive transitions",
      "Active voice with natural sentence rhythm",
      "No filler intros or generic summary conclusions"
    ],
    "content_profiles": {
      "seo_article": {
        "voice_skill": "anthropic-skills:blog-writer",
        "pre_writing_skills": [
          "anthropic-skills:keyword-deep-dive",
          "anthropic-skills:topic-cluster-planning",
          "semantic-seo-content"
        ],
        "pre_writing_checklist_skills": [
          "anthropic-skills:google-helpful-content-grader",
          "anthropic-skills:semantic-gap-analysis",
          "anthropic-skills:no-ai-slop",
          "anthropic-skills:heading-microcopy-writer"
        ],
        "post_writing_skills": [
          "anthropic-skills:eeat-audit",
          "anthropic-skills:avoid-ai-detection"
        ]
      },
      "blog_post": {
        "voice_skill": "anthropic-skills:blog-writer",
        "pre_writing_skills": [
          "anthropic-skills:content-brief"
        ],
        "pre_writing_checklist_skills": [
          "anthropic-skills:google-helpful-content-grader",
          "anthropic-skills:no-ai-slop"
        ],
        "post_writing_skills": [
          "anthropic-skills:eeat-audit",
          "anthropic-skills:avoid-ai-detection"
        ]
      }
    }
  },
  "b2b_expert": {
    "site": "B2B / SaaS / Professional Services",
    "status": "active",
    "voice_guidelines": "Expert, professional, outcome-focused, qualified claims ('typically', 'in most environments'). High domain accuracy.",
    "persona": null,
    "no_live_expert_interview": false,
    "pre_writing_skill": "content-brief",
    "hard_rules": [
      "Never make unqualified absolute legal or technical claims",
      "All facts and metrics must trace to a verifiable industry source",
      "Focus on ROI, operational efficiency, and practitioner value"
    ],
    "content_profiles": {
      "service_page": {
        "voice_skill": "anthropic-skills:content-brief",
        "pre_writing_skills": [
          "anthropic-skills:keyword-deep-dive",
          "anthropic-skills:content-brief"
        ],
        "pre_writing_checklist_skills": [
          "anthropic-skills:google-helpful-content-grader",
          "anthropic-skills:no-ai-slop"
        ],
        "post_writing_skills": [
          "anthropic-skills:eeat-audit",
          "anthropic-skills:avoid-ai-detection"
        ]
      }
    }
  },
  "product_review": {
    "site": "E-Commerce & Product Reviews",
    "status": "active",
    "voice_guidelines": "Hands-on, direct, objective, testing-focused. Clear pros, cons, and bottom-line verdict.",
    "persona": "Editorial Reviewer",
    "no_live_expert_interview": true,
    "pre_writing_skill": "semantic-seo-content",
    "hard_rules": [
      "Include specific testing metrics, trade-offs, and practical comparisons",
      "Never fabricate benchmark numbers or user testimonials",
      "Clear recommendation based on use-case (who it is for vs who should skip)"
    ],
    "content_profiles": {
      "review_article": {
        "voice_skill": "anthropic-skills:blog-writer",
        "pre_writing_skills": [
          "anthropic-skills:keyword-deep-dive",
          "semantic-seo-content"
        ],
        "pre_writing_checklist_skills": [
          "anthropic-skills:google-helpful-content-grader",
          "anthropic-skills:no-ai-slop",
          "anthropic-skills:heading-microcopy-writer"
        ],
        "post_writing_skills": [
          "anthropic-skills:eeat-audit",
          "anthropic-skills:avoid-ai-detection"
        ]
      }
    }
  }
}
```

### Adding Any New Site
To add custom rules for a specific client or site, you can either:
1. Pass `Site / Domain:` and `Voice / Tone:` directly into `/create-content`.
2. Add a new site key to the JSON block above.
3. Or optionally place a `site-registry.md` in your project root if you prefer external file storage.