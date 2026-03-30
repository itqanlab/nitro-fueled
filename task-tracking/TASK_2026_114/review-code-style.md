# Code Style Review — TASK_2026_114

**Reviewer**: nitro-code-style-reviewer
**Task**: Enforce Review-Lessons Pre-Read in Build Worker Prompt
**File reviewed**: `.claude/skills/auto-pilot/SKILL.md`
**Commit**: `d6391ee`

---

## Verdict

**PASS WITH NOTES** — 8/10

The change is directionally correct and solves the stated problem. Three style issues identified; two are non-trivial and could cause confusion or silent drift.

---

## Findings

### F1 — Parenthetical file list duplicates the glob (MODERATE)

**Location**: Both prompts, Step 5, same line in each

```
- Read .claude/review-lessons/*.md (all lesson files: review-general.md, backend.md, frontend.md, security.md)
```

The glob `*.md` is already the authoritative pattern that picks up all lesson files. The parenthetical `(all lesson files: review-general.md, backend.md, frontend.md, security.md)` adds a hardcoded enumeration that creates a second source of truth.

When a new lesson file is added (e.g., `devops.md`, `testing.md`), the glob silently captures it but the parenthetical list will be stale, implying those files should be read while the new one is invisibly omitted from the description. This violates the project convention: *"Delegating to a single source of truth means removing the duplicate, not adding a summary."*

**Recommendation**: Remove the parenthetical. The glob is sufficient.

```
- Read .claude/review-lessons/*.md
```

---

### F2 — Step 5 is positioned after the post-implementation commit step in First-Run prompt (MODERATE)

**Location**: First-Run Build Worker Prompt, Steps 4–5

The current step order in the First-Run prompt is:

```
3. Run the orchestration flow: PM -> Architect -> Team-Leader -> Dev.
4. After ALL development is complete (commit implementation code, update status...)
5. Before developers write any code, they MUST read ALL review-lessons files...
```

Step 5 is a pre-implementation action — it says "Before developers write any code" — yet it is positioned *after* Step 4, which is explicitly a post-implementation action (commits, status file write). A Build Worker reading this sequentially will encounter "commit your code" before "read lessons before you write code."

This placement inconsistency is introduced by this change. The Retry prompt does not have this problem — its Step 5 appears after phase detection (Step 4) and before the implementation completion step (Step 6), which is the correct position.

**Recommendation**: In the First-Run prompt, move Step 5 to appear after Step 2 (auto-approve checkpoints) and before Step 3 (run orchestration flow):

```
2. Do NOT pause for any user validation checkpoints...
5. Before developers write any code, they MUST read...  ← move here
3. Run the orchestration flow...
4. After ALL development is complete...
```

(Renumber steps accordingly.)

---

### F3 — Language inconsistency between the two updated sections (MINOR)

**Location**: First-Run Step 5 vs. Retry Step 5

- First-Run: `"they MUST read ALL review-lessons files and anti-patterns:"`
- Retry: `"ensure they read ALL review-lessons files and anti-patterns:"`

Both prompts are addressed to the same Build Worker persona. First-Run uses third-person imperative ("they MUST"), while Retry uses second-person directive ("ensure they read"). The Retry phrasing is softer and less direct. Prompt instructions in worker templates should use consistent voice.

**Recommendation**: Align to the stronger, consistent form used in the First-Run prompt: `"they MUST read"` or, if the prompt is written second-person throughout, use `"Before writing any code, read"`.

---

## Summary Table

| # | Finding | Severity | Location |
|---|---------|----------|----------|
| F1 | Parenthetical file list duplicates the glob — will drift | Moderate | Both prompts, Step 5 |
| F2 | Step 5 placed after post-implementation commit in First-Run prompt | Moderate | First-Run prompt, Steps 4–5 |
| F3 | Language inconsistency between prompts ("they MUST" vs "ensure they read") | Minor | First-Run Step 5 / Retry Step 5 |

---

## Out-of-Scope Observations

The following pre-existing inconsistency was noted but is outside this task's file scope. Documented only — not for fixing:

- **EXIT GATE divergence**: First-Run Step 6 includes "If any check fails, fix it before exiting." The Retry Step 7 EXIT GATE omits this instruction. This existed before TASK_2026_114.
