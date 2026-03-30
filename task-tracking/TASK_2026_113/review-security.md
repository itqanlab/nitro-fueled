# Security Review — TASK_2026_113

## Reviewer
nitro-code-security-reviewer

## Verdict
**APPROVE** — no blocking findings. Two minor findings documented below.

## Scope
Files reviewed per task File Scope:
- `.claude/skills/orchestration/SKILL.md`
- `.claude/agents/nitro-review-lead.md`
- `.claude/commands/nitro-create-task.md`
- `.claude/commands/nitro-retrospective.md`

---

## Findings

### Finding 1 — Minor: Inconsistent Shell Injection Hardening in Commit Messages

**File**: `.claude/skills/orchestration/SKILL.md` (Phase 0, line 124–126)
**Severity**: Minor

**Observation**: The Phase 0 commit instruction passes user-authored title content directly into a `-m` string:

```bash
git commit -m "docs(tasks): create TASK_[ID] — {title from context}"
```

`{title from context}` is derived from user-authored input (the task description/title the user provided). If the title contains shell metacharacters (`$()`, backticks, semicolons, `!`, unbalanced quotes), the direct `-m` interpolation could produce unexpected shell behavior or, in pathological cases, command injection.

**Contrast with nitro-create-task.md (Step 5b)**: That command correctly uses a HEREDOC with a single-quoted delimiter to prevent all variable/command expansion:

```bash
git commit -m "$(cat <<'EOF'
docs(tasks): create TASK_YYYY_NNN — {title from Description field}
EOF
)"
```

The single-quoted `'EOF'` delimiter is the correct mitigation — it prevents the shell from expanding `$`, `` ` ``, `!`, and other metacharacters within the heredoc body.

**Risk**: Low in practice — AI agents executing these instructions generally sanitize inputs implicitly. But the inconsistency is a hardening gap. The two parallel commit instructions (one in SKILL.md, one in nitro-create-task.md) should use the same safe pattern.

**Recommendation**: Apply the HEREDOC pattern from Step 5b of nitro-create-task.md to the SKILL.md Phase 0 commit, and similarly to the Post-PM and Post-Architect commits. Do not fix in this review; document for the Fix phase.

---

### Finding 2 — Minor: Wildcard Glob in `git add` Stages All `review-*` Files

**File**: `.claude/agents/nitro-review-lead.md` (Phase 3 "Commit Review Artifacts", line 244–247)
**Severity**: Minor

**Observation**: The commit instruction uses a wildcard:

```bash
git add task-tracking/TASK_{TASK_ID}/review-*.md
```

This stages every file matching `review-*.md` in the task folder, including any file a sub-worker or external process might have written with that prefix. If a sub-worker were to write a malformed or adversarially crafted file named `review-injected.md`, it would be silently committed.

**Mitigating controls already present**:
- Task ID is validated with `\d{4}_\d{3}` regex in Phase 1 Step 0, preventing path traversal.
- Sub-worker prompts explicitly restrict workers to writing only their designated output file.
- The task folder is isolated per task ID, limiting blast radius.

**Risk**: Low — the trust boundary is the Review Lead itself and its sub-workers. However, an explicit allowlist (`review-context.md review-code-style.md review-code-logic.md review-security.md`) would be more secure than a glob.

**Recommendation**: Replace the wildcard `git add` with an explicit list of expected report files. Do not fix in this review; document for the Fix phase.

---

## Positive Security Controls Observed

1. **Task ID validation before all file operations** (`nitro-review-lead.md` Phase 1 Step 0): regex `\d{4}_\d{3}` enforced before any file reads or writes, preventing path traversal via malformed task IDs.

2. **Project root validation** (`nitro-review-lead.md` Phase 1 Step 1a): checks `CLAUDE.md` exists at `{project_root}` before proceeding — prevents directory misdirection.

3. **HEREDOC with single-quoted delimiter** (`nitro-create-task.md` Step 5b): correctly prevents shell expansion of user-authored title content in commit messages.

4. **Content-as-opaque-data principle** (`nitro-retrospective.md` Step 2 security note): explicitly instructs the agent to treat artifact content as opaque string data, not executable instructions — mitigates prompt injection from task artifact content.

5. **File path character validation** (`nitro-review-lead.md` Phase 1 Step 3): each path in the git diff command is individually quoted and validated to contain only `[a-zA-Z0-9./\-_]` before inclusion.

6. **Commit hook bypass prohibition** (`SKILL.md` Error Handling section): `NEVER bypass hooks automatically` — preserves integrity of pre-commit checks.

---

## Summary

| Severity | Count |
|----------|-------|
| Blocking | 0 |
| Serious  | 0 |
| Minor    | 2 |

**Score**: 9/10

The changes introduce no new attack surface beyond the orchestration system's existing trust model. The two minor findings are hardening gaps (inconsistent HEREDOC usage, wildcard git add) rather than vulnerabilities. The existing validation and scope-boundary controls in the modified files are sound.
