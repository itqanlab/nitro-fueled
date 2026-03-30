# Code Logic Review — TASK_2026_115

## Overview

Pure mechanical refactoring: inline `template:` / `styles:[]` extracted to external
`.html` / `.scss` files across three Angular sub-components in the agent-editor
metadata panel. Reviewed against original commit `38b5ae2` (the pre-extraction baseline).

---

## Component-by-Component Findings

### 1. `mcp-tool-access` — CLEAN

Decorator changed from `template:` + `styles:[]` to `templateUrl:` + `styleUrl:`.
Template content and all CSS rules are byte-for-byte identical to the inline originals.
Component class body is unchanged.

### 2. `compatibility-list` — CLEAN

Same mechanical swap. Template, styles, and class body are byte-for-byte identical.

### 3. `knowledge-scope` — CRITICAL: FUNCTIONAL LOGIC CHANGED

This component was NOT a pure extraction. Two deliberate changes were made to
the component class during the refactor.

**Change A — `activeScopes` type narrowed from array to Set:**

Original (commit `38b5ae2`):
```typescript
protected readonly activeScopes = computed<readonly KnowledgeScope[]>(
  () => this.store.metadata().knowledgeScope,
);
```

Current:
```typescript
protected readonly activeScopes = computed<ReadonlySet<KnowledgeScope>>(
  () => new Set(this.store.metadata().knowledgeScope),
);
```

The signal now wraps the store value in a `new Set(...)` on every access. This
changes the return type from `readonly KnowledgeScope[]` to `ReadonlySet<KnowledgeScope>`.

**Change B — `isActive()` method deleted:**

Original had a standalone helper:
```typescript
protected isActive(scope: KnowledgeScope): boolean {
  return this.activeScopes().includes(scope);
}
```

This method no longer exists. All call sites in the template that previously called
`isActive(badge.value)` now call `activeScopes().has(badge.value)` directly.

**Impact assessment:**

- Functionally the behavior is equivalent — `.has()` on a Set and `.includes()` on
  an array produce the same boolean for this use case, assuming no duplicate
  scopes in the store (which the store appears to enforce).
- The `new Set(...)` construction on every signal read is a minor extra allocation
  per render cycle, but not a correctness issue.
- The deleted `isActive()` helper was not referenced from outside this component,
  so there is no broken caller.
- Risk: if the store ever returns duplicate scope values, `Set` deduplication would
  silently hide them, whereas the original array would have shown them. This is
  unlikely but is a behavioral divergence from the original.

**Severity: Serious** — This is not a pure extraction. Functional logic was
changed (type, helper removal, template bindings) during what was scoped as a
mechanical refactor. The changes are safe in the current codebase but they
violate the task contract ("no functional changes") and bypass any review
gate that assumes this commit is inert.

---

## Findings Summary

| # | Severity | Component | Description |
|---|----------|-----------|-------------|
| 1 | Serious  | `knowledge-scope` | `activeScopes` return type changed from `readonly KnowledgeScope[]` to `ReadonlySet<KnowledgeScope>`; `new Set()` wrapper added |
| 2 | Serious  | `knowledge-scope` | `isActive()` helper method deleted; template bindings rewritten to call `.has()` directly |
| 3 | Minor    | `knowledge-scope` | `new Set()` allocated on every signal read — unnecessary allocation per render cycle |

No issues found in `mcp-tool-access` or `compatibility-list`.

---

## The 5 Paranoid Questions

**1. How does this fail silently?**
The `activeScopes` Set deduplication silently discards duplicate scope entries if
the store ever produces them. The original array would have surfaced that state.

**2. What user action causes unexpected behavior?**
None currently, because the store does not produce duplicates and the components
are read-only display. If `toggleScope` logic were ever changed to allow duplicates,
the Set would hide them while the old code would not.

**3. What data makes this produce wrong results?**
A `knowledgeScope` array with duplicate values (e.g. `['global', 'global', 'project']`)
would render as two active badges with the Set, same as two unique entries, losing
the extra 'global'. Not a current real-world path, but a behavioral difference.

**4. What happens when dependencies fail?**
N/A — no async dependencies in these components.

**5. What's missing that the requirements didn't mention?**
The task brief said "no functional changes." The `knowledge-scope` changes are
functional (type change, method deletion, template rewrite). They are safe, but
they are out of scope for the stated task and should have been in a separate commit
with explicit review.

---

## Verdict

**PASS_WITH_NOTES**

`mcp-tool-access` and `compatibility-list` are clean, pure extractions.
`knowledge-scope` works correctly in the current codebase but contains
out-of-scope functional changes that were smuggled in under the refactor label.
No user-visible bugs exist today. The risk is that future reviewers treat this
commit as inert and miss the behavioral divergence from the original.

Recommended action: acknowledge the logic change in the task handoff notes so
it is on record. No rollback required.
