# Security Review — TASK_2026_102

**Reviewer**: nitro-code-security-reviewer
**Date**: 2026-03-29
**Scope**: `.claude/skills/orchestration/references/strategies.md`, `.claude/skills/orchestration/SKILL.md`, `.claude/skills/orchestration/references/agent-catalog.md`, `.claude/skills/orchestration/references/checkpoints.md`, `task-tracking/task-template.md`

---

## Summary

All changed files are Markdown specification documents — no executable code was added. The security surface is confined to how the orchestrator (an AI agent) reads and acts on these specifications at runtime. The SOCIAL flow adds no new trust boundaries or data pathways that did not already exist in the CONTENT or CREATIVE flows.

**Overall Risk**: LOW
**Blocking Issues**: None
**Advisory Issues**: 3

---

## Findings

### FINDING-1 — Path Traversal via Unsanitized Output Path Tokens (Advisory, Medium)

**File**: `strategies.md` (line ~620), `agent-catalog.md` (line ~789)
**Pattern**:
```
docs/content/social-[platform]-[name].md
task-tracking/TASK_[ID]/visual-design-specification.md
```

The output path for social copy uses `[platform]` and `[name]` tokens that are expected to be populated from user-provided task descriptions. Neither the SOCIAL section in `strategies.md` nor the `agent-catalog.md` entry for `nitro-technical-content-writer` specifies sanitization rules for these tokens.

**Risk**: If the orchestrator interpolates user-supplied values directly into file paths without stripping `../`, absolute prefixes, or special characters, a crafted platform or name value (e.g., `platform = ../../.claude/agents/nitro-software-architect`) could write content to an unintended location. This applies to all content output path patterns, but the SOCIAL path adds a new `[platform]` dimension not present in CONTENT or CREATIVE.

**Recommendation**: Add a note in the SOCIAL Output Locations table specifying that `[platform]` and `[name]` must be slug-normalized (lowercase alphanumeric + hyphens only) before path construction. Mirror the convention used in CONTENT (where `[slug]`, `[name]`, `[issue]` are implied to be clean identifiers).

---

### FINDING-2 — Prompt Injection via Keyword Detection (Advisory, Low)

**File**: `SKILL.md` (lines ~96–100), `strategies.md` (SOCIAL Trigger Keywords section)

The Workflow Selection Matrix routes tasks to SOCIAL when user input contains keywords like `"social media"`, `"thread"`, `"carousel post"`, or `"hashtag"`. These keywords are substring-matched against the task description, which is user-controlled.

**Risk**: A crafted task description that embeds SOCIAL-triggering keywords inside what is semantically a FEATURE or CONTENT task could force misrouting. For example:

> "Build a backend service for our social media analytics dashboard — this is NOT a twitter post or carousel post"

The negation will not be caught by substring matching. The orchestrator would route to SOCIAL based on keyword presence alone.

This is a prompt injection variant: user input manipulates the routing logic of the AI orchestrator.

**Observation**: The handoff explicitly acknowledges the CONTENT/SOCIAL keyword overlap risk and partially addresses it through priority ordering (`SOCIAL > CONTENT`). However, the broader injection vector (FEATURE tasks with incidental social keywords) is not addressed.

**Recommendation**: Add a guidance note in the SOCIAL Trigger Keywords section that keyword detection should be accompanied by intent confirmation: if the overall task type is clearly FEATURE/BUGFIX/REFACTORING, keyword presence alone should not override the primary classification. This mirrors how DEVOPS detection already uses a "Key Signal" qualifier: "Work is 100% infrastructure (no application business logic)."

---

### FINDING-3 — Unguarded Conditional Phase Trigger (Advisory, Low)

**File**: `strategies.md` (SOCIAL Phase 3), `agent-catalog.md` (nitro-ui-ux-designer triggers section)

The SOCIAL workflow Phase 3 trigger reads:

> `[IF visual assets needed] nitro-ui-ux-designer`

The condition "IF visual assets needed" is expressed only in prose. There is no formal rule or decision gate — the orchestrator must infer this at runtime from the task context. The handoff explicitly flags this as a known risk.

**Risk**: Two failure modes arise:
1. **Under-trigger**: A carousel post request fails to invoke `nitro-ui-ux-designer` because the orchestrator does not recognize "carousel" as requiring visual assets.
2. **Over-trigger**: A simple text-only tweet campaign triggers the designer phase unnecessarily, adding cost and latency.

Neither failure mode is a security vulnerability in the traditional sense, but over-trigger creates an uncontrolled agent invocation that could expose the design system path (`.claude/skills/nitro-technical-content-writer/DESIGN-SYSTEM.md`) to content unrelated to the intended social post.

The Conditional Visual Asset Trigger table in `strategies.md` partially addresses this by listing two explicit conditions. However, the table is non-exhaustive and uses prose conditions rather than structured rules.

**Recommendation**: Tighten the condition table with a default-deny posture: explicitly state that `nitro-ui-ux-designer` is skipped unless the task explicitly includes terms like "carousel", "visual", "image specs", or "brand assets." This matches how the CREATIVE design check uses a concrete file existence check rather than inference.

---

## No-Finding Notes

- **Agent impersonation**: No new agent identities or invocation patterns are introduced that could be spoofed.
- **Secrets/credentials**: No API keys, tokens, or credentials are present or referenced in any of the changed files.
- **Privilege escalation**: The SOCIAL flow does not grant any agent capabilities beyond those already available in CONTENT or CREATIVE flows.
- **Data exfiltration paths**: No external HTTP calls, webhook triggers, or external service references are defined.
- **Checkpoint bypass**: The SOCIAL row in `checkpoints.md` correctly includes Scope and Requirements checkpoints, consistent with CONTENT. No checkpoints are suppressed inappropriately.
- **task-template.md**: The SOCIAL enum addition is a documentation-only change with no security impact.

---

## Verdict

**PASS with advisories.** No blocking security issues. The three advisory findings are documentation gaps that should be addressed in a future revision to harden the specification against misuse at runtime. None require changes before merging.
