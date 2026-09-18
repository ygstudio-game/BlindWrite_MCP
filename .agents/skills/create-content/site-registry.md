# Site Registry

Maps Claude Projects to site-specific configuration for the content pipeline.
The `create-content` skill loads this file during Phase 0 (Preflight) to resolve
site identity, voice document location, persona rules, and content profiles.

**This file must never hardcode pipeline logic.** It is data only -- the pipeline
structure lives in `create-content/SKILL.md` and `openrouter-draft-audit/SKILL.md`.

---

## How to Read This Registry

Each entry covers one site/client. Fields:

| Field | Description |
|---|---|
| `project_name` | Exact Claude Desktop Project name for this site |
| `site` | Human-readable site/client name |
| `status` | `active` = pipeline runs; `out_of_scope` = do not run pipeline |
| `voice_doc_path` | Path or Drive link to the tone-of-voice document. Must be readable. |
| `persona` | Author persona name, if site uses a scripted persona (not a real person) |
| `no_live_expert_interview` | `true` = persona-driven (decide persona_experience_details at brief time); `false` = real expert input available |
| `pre_writing_skill` | Which skill builds the MASTER_WRITING_BRIEF |
| `hard_rules` | Non-negotiable constraints that survive any revision loop |
| `content_profiles` | Per content-type skill selection. Each profile's `voice_skill` tells Phase 3 which voice skill to read style from (falls back to `voice_doc_path` when null). |

---

## Entries

### faceshapetool.com

```json
{
  "project_name": "FaceShapeTool",
  "site": "faceshapetool.com",
  "status": "active",
  "voice_doc_path": "PENDING -- add the Google Drive link or local path to the faceshapetool.com tone-of-voice document here",
  "persona": "PENDING -- add the author persona name here (e.g. Mandy Miller)",
  "no_live_expert_interview": true,
  "pre_writing_skill": "semantic-seo-content",
  "hard_rules": [
    "Never publish fabricated statistics without a cited source",
    "Persona must be internally consistent across all content -- same voice, same backstory",
    "No AI detection artifacts: invisible Unicode, curly quotes, title-case headings",
    "No em dashes"
  ],
  "content_profiles": {
    "seo_article": {
      "voice_skill": "anthropic-skills:blog-writer",
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
      "post_writing_skills": [
        "anthropic-skills:eeat-audit",
        "anthropic-skills:avoid-ai-detection"
      ]
    }
  }
}
```

> **ACTION REQUIRED**: Replace both `PENDING` values above before running the first job for this site.
> `voice_doc_path`: add the Google Drive link or local file path to the tone-of-voice document.
> `persona`: add the exact author persona name used consistently across all faceshapetool.com content.

---

### Juriszone

```json
{
  "project_name": "Juriszone",
  "site": "Juriszone",
  "status": "active",
  "voice_doc_path": "PENDING -- add the Google Drive link or local path to the Juriszone tone-of-voice document here",
  "persona": null,
  "no_live_expert_interview": false,
  "pre_writing_skill": "content-brief",
  "hard_rules": [
    "Never fabricate legal citations or case law references",
    "Never make definitive legal claims without qualification (use 'generally', 'typically', 'in most jurisdictions')",
    "All legal facts must be traceable to a real source",
    "No AI detection artifacts: invisible Unicode, curly quotes"
  ],
  "content_profiles": {
    "legal_service_page": {
      "voice_skill": "anthropic-skills:juriszone-content-writer",
      "pre_writing_skills": [
        "anthropic-skills:keyword-deep-dive",
        "anthropic-skills:content-brief",
        "semantic-seo-content"
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
}
```

> **ACTION REQUIRED**: Replace the `voice_doc_path` PENDING value with the actual Juriszone voice document path before the first Juriszone job.

---

### Sigma CapSeal

```json
{
  "project_name": "SigmaCapSeal",
  "site": "Sigma CapSeal",
  "status": "out_of_scope",
  "voice_doc_path": null,
  "persona": null,
  "no_live_expert_interview": null,
  "pre_writing_skill": null,
  "hard_rules": [],
  "content_profiles": {},
  "out_of_scope_reason": "No tone-of-voice document exists for this client. Do not run any content through this pipeline for Sigma CapSeal until: (1) a voice document is supplied, (2) this registry entry is updated with that document path, (3) status is changed to 'active'."
}
```

---

## Adding a New Site

1. Duplicate an existing entry block.
2. Fill in ALL fields -- do not leave `voice_doc_path` as PENDING before running a job.
3. Set `status: active` only after the voice document is confirmed readable.
4. Add at least one `content_profiles` entry with a `voice_skill` field.
5. Commit this file.

The pipeline will refuse to run for any site with `status: out_of_scope` or a `voice_doc_path` that is null or unreadable.