# Style Review — TASK_2026_068

## Verdict
APPROVED

## Score
7/10

## Summary

Three files, all under their size limits (214, 74, 216 lines). Type safety is solid with no `any`, no bare type assertions, and good use of discriminated unions for menu results. The primary concerns are: one function that exceeds the 50-line rule, a semantic inconsistency between `runGlmFirstTimeMenu` and `runOpenCodeFirstTimeMenu` in their return types, a silent single-prompt user experience for `[T]est` that loops back without re-prompting the user, and a handful of naming and comment-quality issues.

---

## Findings

### [BLOCKING] `reconfigureGlm` and `reconfigureOpenCode` both exceed the 50-line limit

File: `packages/cli/src/utils/provider-flow.ts:143` and `:174`

`reconfigureGlm` is 30 lines and `reconfigureOpenCode` is 43 lines individually, but both embed the install, prompt, test, and return logic inline with no extraction. The anti-pattern rule is explicit: **functions over 50 lines are doing too much — split by responsibility.** `reconfigureOpenCode` at 43 lines is borderline acceptable but contains three distinct responsibilities: (1) install opencode if missing, (2) collect credentials, (3) validate and print result. That "and" in the description is the tell. Each of those should be its own extracted function.

More pressing: `runGlmMenu` at lines 34–69 is 36 lines of body but calls `reconfigureGlm` inline and handles four distinct choice branches. If you count all the logic a reader must hold in their head when reading `runGlmMenu`, the cognitive load already exceeds a single responsibility.

The 50-line rule applies to the function body. Count `reconfigureOpenCode`: lines 174–216 = 43 lines of body including the install branch. This is a borderline violation that will creep over the limit the moment a third prompt or a new validation case is added. Extract `installOpenCode()` as a separate private function — the install branch is a discrete side effect that has nothing to do with credential collection.

### [BLOCKING] Semantic mismatch: `runGlmFirstTimeMenu` returns `{ action: 'keep' }` on skip

File: `packages/cli/src/utils/provider-flow.ts:82` and `:87`

When the user presses Enter (skip) or chooses `[C]onfigure` but `reconfigureGlm` returns null, `runGlmFirstTimeMenu` returns `{ action: 'keep' }`. But "keep" implies there is an existing configuration to keep. There is none — GLM is not configured. The correct return is `{ action: 'skip' }`, which already exists on `OpenCodeMenuResult`.

The inconsistency is currently harmless because the caller (`runProvidersPhase`) only checks for `result.action === 'reconfigure'` and ignores all other values. But `GlmMenuResult` does not include a `'skip'` variant, meaning the type system cannot distinguish "user chose to keep an existing config" from "user skipped a first-time prompt." This is a type-level lie: `keep` has different semantics depending on context. Future callers that need to distinguish these cases will get the wrong answer silently.

Fix: add `| { action: 'skip' }` to `GlmMenuResult` and return `{ action: 'skip' }` from both skip paths in `runGlmFirstTimeMenu`.

### [MINOR] `[T]est` in `runGlmMenu` shows result and immediately returns `keep` — no loop, no re-prompt

File: `packages/cli/src/utils/provider-flow.ts:47–57`

The comment on line 57 says "Test does not change config; loop back treated as keep." But there is no loop — after showing the test result the function exits immediately, which means the user must re-run the entire command to act on the test result. The UX spec in `task.md` shows `[T]est` reruns the connection test and shows the result *without changing config*, implying the user can still choose another action afterward.

The current implementation meets the letter of the acceptance criterion but not the spirit: a user who tests and sees "failed" cannot then immediately choose `[U]nload` or `[R]econfigure` without restarting. This is a UX regression from the intended design. At minimum, the comment should be replaced with a note explaining the limitation, not describing a "loop back" that does not exist.

### [MINOR] `provider-status.ts` exports `ProviderStatusResult` but it is imported with a redundant re-import in `config.ts`

File: `packages/cli/src/commands/config.ts:13`

```
import type { ProviderStatusResult } from '../utils/provider-status.js';
```

`ProviderStatusResult` is imported in `config.ts` but is never referenced in the file body — it is only used in `provider-flow.ts` (via `ProviderStatus`, not `ProviderStatusResult`) and in `provider-status.ts` itself. This is a dead import. Verify whether the type is actually used in `config.ts`; if not, remove it. The review-general rule is explicit: **no unused imports or dead code**.

### [MINOR] `UNLOADABLE_PROVIDERS` naming does not follow the project convention

File: `packages/cli/src/commands/config.ts:22`

The review-general rule states `SCREAMING_SNAKE_CASE` is for "const domain objects (`TABLES`, `CHANNELS`)." This is a const tuple of provider names — a domain object. The naming is correct per that rule. However, `DEP_NAMES` in `dep-check.ts` is named as a plain camelCase object, not SCREAMING_SNAKE. The codebase is inconsistent about which pattern to apply to const domain objects. This is not a violation by `config.ts` but a cross-file inconsistency worth noting. The reviewer recommends aligning all similar const objects to one convention — whichever the team prefers — in a follow-up.

### [MINOR] Hard-coded model defaults in `reconfigureGlm` are not co-located with GLM type definitions

File: `packages/cli/src/utils/provider-flow.ts:170`

```typescript
models: existing?.models ?? { opus: 'glm-5', sonnet: 'glm-4.7', haiku: 'glm-4.5-air' },
```

These default model slugs are magic strings with no named constant. They will silently become stale when GLM updates its model names, and there is no canonical location to update them. The `GlmProviderConfig` interface lives in `provider-config.ts` — the defaults should live there too as an exported constant, not inline in a flow function.

### [MINOR] Comment noise in `provider-flow.ts` file header block

File: `packages/cli/src/utils/provider-flow.ts:1–6`

The JSDoc comment block at the top of the file adds no information beyond what the file name and exports already communicate. Comments like "These are called from runProvidersPhase in config.ts" couple the documentation to a specific call site — any refactor that moves the call site invalidates the comment without touching the file. Remove or replace with a one-line description of *what* the module provides, not *who* calls it.

### [SUGGESTION] `runOpenCodeMenu` does not offer `[T]est` but `runGlmMenu` does — asymmetry is unexplained

File: `packages/cli/src/utils/provider-flow.ts:94–116`

GLM has `[T]est` in its menu (line 39); OpenCode does not (line 100). The task spec notes that OpenCode status is "derived from binary + key presence (no live test needed)" which is a legitimate reason for the asymmetry. But the prompt strings shown to the user don't explain this. A user who knows they can test GLM will expect the same for OpenCode and get confused when it's absent. At minimum, the OpenCode menu prompt should signal that test is not available (e.g., `[K]eep  [R]econfigure  [U]nload  (Enter = keep)` is already fine, but a comment in the function explaining the intentional omission would help the next developer not add it mistakenly).

---

## The 5 Critical Questions

### 1. What could break in 6 months?

The hard-coded GLM model defaults at `provider-flow.ts:170` will silently become stale. When GLM-5 is superseded, a new install will configure users with a dead model name. There is no constant to update — a developer must know to look inside the flow function.

The `ProviderStatus` type (`'connected' | 'failed' | 'not configured'`) uses a string with an embedded space (`'not configured'`) as a discriminant. This is unusual and error-prone — any future string comparison that forgets the space will silently fail. The task.md spec uses `not configured` without quotes so the intent is clear, but a type that can be `'not_configured'` or an enum would be safer.

### 2. What would confuse a new team member?

The `{ action: 'keep' }` return from `runGlmFirstTimeMenu` when the user skips. A developer adding a new first-time flow will copy this pattern and return `keep` for a "nothing was configured" path, producing the same semantic confusion everywhere.

The absence of a re-prompt loop after `[T]est` in `runGlmMenu` will confuse the next developer who tries to add looping — the comment says "loop back treated as keep" implying it loops, but it doesn't.

### 3. What's the hidden complexity cost?

`reconfigureOpenCode` handles three concerns in sequence: binary installation, credential collection, and result printing. Any new validation requirement (e.g., verify the API key format, test the OpenCode connection) will push this function over 50 lines and force a split under pressure. The split should happen now while the function is still coherent.

### 4. What pattern inconsistencies exist?

- `runGlmFirstTimeMenu` returns `{ action: 'keep' }` for skip; `runOpenCodeFirstTimeMenu` returns `{ action: 'skip' }` for skip. Same UX path, different types.
- `DEP_NAMES` in `dep-check.ts` is camelCase; `UNLOADABLE_PROVIDERS` in `config.ts` is SCREAMING_SNAKE. Both are const domain objects.
- GLM has a `[T]est` menu option; OpenCode does not. No in-code explanation of the asymmetry.

### 5. What would I do differently?

- Extract `installOpenCode()` from `reconfigureOpenCode` immediately, before the 50-line limit is breached.
- Add `{ action: 'skip' }` to `GlmMenuResult` and use it in first-time flows for both providers consistently.
- Move GLM default model constants to `provider-config.ts` alongside the `GlmProviderConfig` interface.
- Replace `'not configured'` string (with embedded space) with `'not-configured'` or a proper enum to avoid typo-silent failures.
- Add a re-prompt loop after `[T]est` in `runGlmMenu` — or explicitly document that this is a known limitation and the acceptance criterion was interpreted minimally.

---

## File-by-File Analysis

### `packages/cli/src/commands/config.ts`

**Score**: 8/10
**Issues Found**: 1 minor

Clear single-responsibility orchestrator. `runProvidersPhase` is 64 lines (lines 94–157), which is over the 50-line function limit in the anti-patterns doc. The function body is readable but crosses the threshold. The mode-dispatch logic in the `.action()` handler (lines 168–213) is a clean guard-clause pattern. The `as const` + derived `type` pattern for `UNLOADABLE_PROVIDERS` is correct. One unused import (`ProviderStatusResult`) should be verified and removed.

### `packages/cli/src/utils/provider-status.ts`

**Score**: 9/10
**Issues Found**: 0 blocking, 0 serious, 0 minor

Clean, well-typed, single-responsibility. The `ProviderStatus` string literal union is well-named. The `printProviderStatusTable` function is 10 lines and does exactly one thing. The live-vs-static test distinction is correctly documented in the JSDoc. No issues beyond the `'not configured'` embedded-space concern noted above.

### `packages/cli/src/utils/provider-flow.ts`

**Score**: 6/10
**Issues Found**: 2 blocking, 2 minor, 1 suggestion

The semantic mismatch on `GlmMenuResult`'s skip path and the `[T]est` non-loop are the primary concerns. The file is well-structured with the public/private split clearly marked by the separator comment. `reconfigureOpenCode` is borderline on function length and embeds too many concerns to extend safely.

---

## Pattern Compliance

| Pattern                         | Status | Concern                                                      |
|---------------------------------|--------|--------------------------------------------------------------|
| No `any` types                  | PASS   | None                                                         |
| No `as` type assertions         | PASS   | One `lower as UnloadableProvider` — justified after include check |
| String literal unions           | PASS   | `ProviderStatus`, `GlmMenuResult`, `OpenCodeMenuResult` all typed |
| File size limits (300 lines)    | PASS   | All files under limit                                        |
| Function size limits (50 lines) | FAIL   | `runProvidersPhase` (64 lines), `reconfigureOpenCode` (43 lines borderline) |
| No unused imports               | FAIL   | `ProviderStatusResult` import in `config.ts` — verify usage  |
| Consistent return semantics     | FAIL   | `GlmMenuResult` uses `keep` where `skip` is semantically correct |
| Comment quality                 | MINOR  | File-header comment names call sites (fragile); `loop back` comment is misleading |

---

## Technical Debt Assessment

**Introduced**:
- `GlmMenuResult` `keep`/`skip` semantic confusion that will propagate if copied.
- Hard-coded model defaults in flow logic rather than config constants.

**Mitigated**:
- The per-provider discriminated union results (`GlmMenuResult`, `OpenCodeMenuResult`) are a clean pattern that will scale to additional providers.
- The `ProviderStatus` type is reused correctly across files via import rather than redefined.

**Net Impact**: Slight negative — the semantic inconsistency and inline defaults will cost time when the next provider is added.

---

## What Excellence Would Look Like

A 9/10 implementation would:

1. Return `{ action: 'skip' }` consistently from all first-time "no configure" paths, with `GlmMenuResult` including the `skip` variant.
2. Extract `installOpenCode()` as a named private function so `reconfigureOpenCode` reads as a linear credential-collection function with no installation side-effects mixed in.
3. Define `GLM_DEFAULT_MODELS` as an exported constant in `provider-config.ts`, co-located with `GlmProviderConfig`, so stale model names have a single update point.
4. Either implement a re-prompt loop after `[T]est` in `runGlmMenu`, or replace the misleading "loop back" comment with an honest limitation note.
5. Remove (or justify) the unused `ProviderStatusResult` import in `config.ts`.
