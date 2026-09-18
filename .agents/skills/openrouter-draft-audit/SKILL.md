---
name: openrouter-draft-audit
description: "Content pipeline Phase 3-4 orchestrator. Compiles the quality checklist and voice layer verbatim into the drafting prompt, delegates writing to writing-orchestrator, then runs Claude's mandatory eeat-audit + avoid-ai-detection grading gate in a revision loop (MAX_REVISION_LOOPS=3). Use this skill after you have a completed MASTER_WRITING_BRIEF from pre-writing research."
---

# OpenRouter Draft + Audit Skill

## CRITICAL RULE -- Read Before Anything Else

### The Anti-Tax Rule override

The `writing-orchestrator` skill contains an "Anti-Tax Rule": *"Strictly DO NOT generate an unprompted analysis, critique, or rewrite."* That rule governs `writing-orchestrator` used **standalone**. When **this skill (`openrouter-draft-audit`) is active**, that rule does **NOT apply** to this skill's own Step 3 grading gate.

**Step 3 of this skill is mandatory and unconditional.** It is not optional critique. It is a quality gate that every draft must pass before delivery. A draft delivered to the user without running Step 3 is a bug in execution, not a legitimate default.

---

## When to Use

Use this skill after:
1. You have a fully assembled `MASTER_WRITING_BRIEF` (from `content-brief`, `semantic-seo-content`, or the `create-content` skill's pre-writing phase).
2. You are ready to delegate drafting to OpenRouter and then grade the result.

This skill does **not** do the pre-writing research -- that is the job of `content-brief` / `semantic-seo-content`. This skill's scope is Phase 3 (prompt compile) + Phase 4 (draft-grade-fix loop).

---

## STEP 1 -- Compile the Prompt Package

Before any drafting call, assemble the complete `system_prompt` + `prompt` package.

### 1a. Read the quality checklist rules -- verbatim, not paraphrased.

Open the following skills and copy the relevant paragraphs (only the sections relevant to this content type -- not entire files) **word-for-word** into the quality checklist block:

- `anthropic-skills:google-helpful-content-grader` -- substantive helpfulness rules
- `anthropic-skills:semantic-gap-analysis` -- gap coverage rules
- `anthropic-skills:no-ai-slop` -- repetition stacks, cliche opener rules
- `anthropic-skills:heading-microcopy-writer` -- heading/microcopy rules

**Why verbatim?** A paraphrase can silently drop a qualifier or the concrete example that made a rule enforceable. Copy the actual text. Trade-off: the `system_prompt` will be longer -- that is intentional. Do not compress to save tokens; only copy the section relevant to this job, not the full skill file.

### 1b. Read the site's voice document -- verbatim excerpts.

Retrieve the voice document path from the site-registry entry (loaded in Phase 0 of `create-content`). Use the `voice_skill` field from the content-type profile if present; fall back to reading `voice_doc_path` directly. Copy the relevant excerpts verbatim into:

- `style_requirements`: mechanical rules -- sentence length limits, punctuation rules (no em dashes, etc.), voice (active vs. passive), structural conventions (answer-first, etc.)
- `voice_requirements`: persona/brand voice, tone, author persona consistency, content arc/ratios, what to avoid

Never summarize or paraphrase the voice document. An invented or compressed voice produces a false pass at the eeat-audit gate later.

If no voice document exists for this site: **stop here.** Do not proceed. Do not invent a voice. Tell the user the voice document is missing and ask them to supply it or sign off explicitly on proceeding without one.

### 1c. Assemble the prompt architecture.

`
SYSTEM PROMPT:
==============
You are the production writer for [SITE_NAME].

WRITING ROLE
[Content type, audience, purpose from MASTER_WRITING_BRIEF]

CRITICAL REQUIREMENTS -- follow these exactly:
[Verbatim quality checklist excerpts from 1a]

VOICE AND STYLE -- follow these exactly:
[Verbatim style_requirements from 1b]
[Verbatim voice_requirements from 1b]

IMPORTANT CONSTRAINTS:
- Follow the strategic direction in the brief exactly.
- Do not replace the research strategy with your own assumptions.
- Do not invent unsupported facts or fabricate statistics.
- Do not invent sources or citations.
- Follow the specified voice and structure without deviation.
- Return the complete draft. No meta-commentary, no preamble.

USER PROMPT:
==============
Write [CONTENT_TYPE] using the MASTER_WRITING_BRIEF below.

MASTER_WRITING_BRIEF:
[Full MASTER_WRITING_BRIEF JSON object from pre-writing phase]
`

Set loop counter n = 0.

---

## STEP 2 -- Delegate Drafting to `writing-orchestrator`

**Do NOT call `writer_generate` directly.** Invoke the `writing-orchestrator` skill and pass it the assembled prompt package.

Parameters to pass:
- `prompt`: the USER PROMPT section (task instruction + MASTER_WRITING_BRIEF)
- `system_prompt`: the SYSTEM PROMPT section (role + checklist + voice)
- `category`: the content category from the registry (e.g. "SEO Article", "Legal Service Page")
- `model_id`: leave unset (let `writing-orchestrator` use its leaderboard / default selection)
- `include_critique`: `false` -- self-grading by the drafting model is not the grading gate; Claude does that in Step 3
- `export_file`: `true` -- save a local copy to `data/drafts/` automatically

Once the draft returns, proceed immediately to Step 3. Do not show the raw draft to the user yet -- it is an intermediate artifact, not the final output.

---

## STEP 3 -- Run Claude's Grading Gate (Mandatory)

Run **exactly these two skills** against the returned draft, always, unconditionally:

### 3a. `anthropic-skills:eeat-audit`

Focus: authorship/trust dimension for this specific site and content type.

Check:
- Does the byline/persona hold up against the voice document and the registry's `persona` field?
- Are there fabricated experience claims inconsistent with the persona's established details?
- Is there a fabricated-experience risk that would fail a real E-E-A-T review?
- Does the author's demonstrated experience feel genuine and site-consistent, or generic?

For sites with `no_live_expert_interview: true` (persona-driven): verify the `persona_experience_details` from the brief were actually used in the draft, not omitted or replaced with generic claims.

For sites with `no_live_expert_interview: false` (real expert input available): verify the draft does not fabricate expert credentials or invent quotes.

### 3b. `anthropic-skills:avoid-ai-detection`

Scan for:
- Invisible Unicode artifacts (citation junk, zero-width characters) -- check byte-by-byte, not just visually
- Tracking parameters appended to URLs
- Unfilled placeholder text ([INSERT X], KEYWORD, template variable syntax)
- Curly / "smart" quotes where straight quotes are required
- Title-case headings where sentence case is required (or vice versa per site style)
- Mechanical AI tells: repetitive sentence openers, stacked qualifiers, generic closing summaries

### 3c. Produce structured findings

`json
{
  "status": "pass | needs_revision",
  "revision_loop": 0,
  "issues": [
    {
      "severity": "high | medium | low",
      "skill": "eeat-audit | avoid-ai-detection",
      "section": "Introduction | Section heading | ...",
      "problem": "Specific description of what is wrong",
      "required_fix": "Specific description of what the fix must accomplish"
    }
  ]
}
`

---

## STEP 4 -- Loop or Deliver

### If `status: pass`

Proceed to Phase 5 of `create-content` (deliver). The graded draft (the version that just passed) is the final output, not the raw first draft.

### If `status: needs_revision` and `n < 3` (MAX_REVISION_LOOPS)

1. Increment n.
2. Log: "Revision loop {n}: {issue_count} issues found by {skills}"
3. Assemble a revision prompt:
   `
   REVISION TASK -- Loop {n}

   Original draft is provided below. Fix ONLY the specific issues listed.
   Do not rewrite sections that are not listed. Do not add new content
   beyond what the fixes require.

   ISSUES TO FIX:
   [Structured issues array -- include severity, section, problem, required_fix for each]

   ORIGINAL DRAFT:
   [Full draft text]
   `
4. Send back through `writing-orchestrator` (same model unless escalating, same category).
5. Return to Step 3 with the revised draft. **Claude does NOT rewrite the draft itself in this path.**

### If `status: needs_revision` and `n >= 3` (MAX_REVISION_LOOPS exhausted)

**STOP.** Do not loop again. Escalate to the user with all three of these pieces of information:

1. **What issues persisted** -- exact list from the last findings JSON, not a summary
2. **Which loop count was reached** -- "3 revision loops without a clean pass"
3. **Three explicit choices** -- do not pick for the user:
   - (a) Ship the current draft with the remaining issues noted explicitly in the delivery
   - (b) Have Claude fix the remaining issues directly as a one-time named exception (Claude writes copy this once)
   - (c) Retry the entire draft with the other model -- if currently on DeepSeek Flash, switch to GLM 5.3 (costs approx. 5x more per output token); if on GLM 5.3, there is no higher-tier model available

---

## Cost Awareness

Each revision loop costs:
- Claude tokens for grading (eeat-audit + avoid-ai-detection runs)
- OpenRouter tokens for the revised draft

If a content type is consistently hitting 2-3 loops for a given model, that is a signal to tighten the pre-writing checklist for that content type (Step 1's compiled rules), not to silently accept the loop cost as normal.

---

## What This Skill Does NOT Do

- Does not run pre-writing research (DataForSEO, Firecrawl, content-brief, semantic-seo-content)
- Does not run the 6 removed post-writing skills (google-helpful-content-grader, semantic-gap-analysis, no-ai-slop, heading-microcopy-writer, improve-content, page-audit) as passes against the actual draft -- their rules are compiled into the prompt in Step 1 instead
- Does not write the final revision itself (OpenRouter writes, Claude grades)
- Does not call `writer_generate` directly (that is `writing-orchestrator`'s job)