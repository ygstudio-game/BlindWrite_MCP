# Site Registry (Optional Workspace Reference)

> **Note:** The `create-content` skill is fully self-contained and already includes built-in generic profiles. 
> This file is strictly optional for teams that prefer maintaining site configurations in a standalone external file in their workspace.

---

## How to Configure Sites

Each entry maps a Claude Project or site domain to custom configuration for the content pipeline:

| Field | Description |
|---|---|
| `project_name` | Exact Claude Desktop Project name or identifier |
| `site` | Human-readable site name or domain (e.g. `example.com`) |
| `status` | `active` = pipeline runs; `out_of_scope` = do not run pipeline |
| `voice_doc_path` | Path or link to tone-of-voice document (optional) |
| `voice_guidelines` | Inline tone-of-voice description if no external document |
| `persona` | Author persona name (if persona-driven), or `null` |
| `no_live_expert_interview` | `true` = persona-driven; `false` = real expert or objective guidance |
| `pre_writing_skill` | Primary brief-building skill (`content-brief` or `semantic-seo-content`) |
| `hard_rules` | Non-negotiable constraints that survive any revision loop |
| `content_profiles` | Per content-type skill selection (`seo_article`, `blog_post`, `service_page`) |

---

## Site Profiles & Archetypes

### 1. Universal / Default Blog Profile

```json
{
  "project_name": "Default",
  "site": "example.com",
  "status": "active",
  "voice_guidelines": "Clear, engaging, reader-centric, active voice, zero AI fluff.",
  "persona": null,
  "no_live_expert_interview": false,
  "pre_writing_skill": "content-brief",
  "hard_rules": [
    "Never publish unverified claims or fabricated statistics without citation",
    "No AI detection artifacts: zero-width Unicode, curly quotes in code, repetitive transitions",
    "Active voice with natural sentence rhythm"
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
}
```

---

### 2. Corporate & B2B Services Profile

```json
{
  "project_name": "CorporateB2B",
  "site": "company.com",
  "status": "active",
  "voice_guidelines": "Authoritative, professional, solutions-focused, qualified claims.",
  "persona": null,
  "no_live_expert_interview": false,
  "pre_writing_skill": "content-brief",
  "hard_rules": [
    "Never make unqualified absolute legal or technical claims",
    "All facts and statistics must be traceable to a credible source",
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
}
```

---

### 3. Review & Affiliate Profile

```json
{
  "project_name": "ProductReviews",
  "site": "reviews.com",
  "status": "active",
  "voice_guidelines": "Hands-on, direct, objective, testing-focused.",
  "persona": "Editorial Reviewer",
  "no_live_expert_interview": true,
  "pre_writing_skill": "semantic-seo-content",
  "hard_rules": [
    "Include specific testing metrics, trade-offs, and practical comparisons",
    "Never fabricate benchmark numbers or user testimonials"
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
```