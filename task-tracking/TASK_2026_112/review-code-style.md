# Code Style Review — TASK_2026_112

## Score: 5/10

## Review Summary

| Metric          | Value                        |
|-----------------|------------------------------|
| Overall Score   | 5/10                         |
| Assessment      | NEEDS_REVISION               |
| Blocking Issues | 3                            |
| Serious Issues  | 3                            |
| Minor Issues    | 2                            |
| Files Reviewed  | 1 (parallel-mode.md, ~352–500) |

---

## The 5 Critical Questions

### 1. What could break in 6 months?

The fallback chain description at line 375 and line 382 hardcodes `anthropic/claude-sonnet-4-6` as an inline note. This directly contradicts the task acceptance criterion ("no hardcoded model names in routing decisions") and will drift when the resolver's `FALLBACK_PROVIDER` constant is updated. A future developer reading line 482 (step 5g) sees the same hardcoded string and treats it as the authoritative value — they won't know to look at the resolver source. The `resolveProviderForSpawn` fallback chain actually tries ALL providers in insertion order from `config.providers` before hitting the hardcoded constant (`provider-resolver.ts:143–147`). The doc skips that intermediate step entirely.

### 2. What would confuse a new team member?

Line 372 documents the balanced Build Worker routing as `routing['balanced']` OR `routing['default']` — the dual-slot behavior with no explanation of precedence. Does it try `balanced` first and fall back to `default`? Does `default` act as a global override? The `RoutingConfig` type in `provider-config.ts:41–49` includes `'default'` as a valid slot, but the Resolution procedure in lines 377–383 does not mention it. The dual-slot notation is visible in one table row only; a reader following the Resolution procedure step-by-step will not know what to do when `routing['balanced']` is absent.

### 3. What's the hidden complexity cost?

The Resolution procedure at step 3 (line 380) says: "fallback within the entry: `balanced` → `heavy` → `light`". But `tryProvider()` in `provider-resolver.ts:114` actually picks `balanced ?? heavy ?? light` — which means it picks `balanced` for ALL tiers, not the tier requested. The doc implies tier-specific fallback within a provider entry, but the code does not implement that. A supervisor following the doc's procedure would pass `tier: 'heavy'` to `spawn_worker` while the resolver may have resolved a `balanced` model. The passed tier and the resolved model are decoupled — this is a real behavioral gap worth documenting or fixing.

### 4. What pattern inconsistencies exist?

The Test Lead Provider Routing table at lines 398–402 hardcodes `claude` (launcher name) and `claude-sonnet-4-6` (model name) in a table row without the "the resolver owns this" disclaimer. This is inside step 5d, alongside the config-driven routing section that explicitly avoids hardcoding. Two rows apart we have one section delegating to the resolver and another pinning values directly — no explanation for why Test Lead routing is exempt from config-driven selection. Also: line 427 says `omit if 'claude' — that is the MCP default`. This hardcodes the launcher name `claude` as an optimization hint, creating coupling to MCP default behavior that could silently break if the MCP default changes.

### 5. What would I do differently?

- Remove the model name `anthropic/claude-sonnet-4-6` from lines 375, 382, and 482 entirely. Replace with: "the resolver's last-resort (defined in `FALLBACK_PROVIDER` constant in `provider-resolver.ts`)." The string belongs in one place.
- Document the `routing['balanced']` / `routing['default']` precedence rule explicitly in the Resolution procedure.
- Align the tier-within-entry fallback description (step 3 of Resolution procedure) with what `tryProvider()` actually does, or raise a bug against the resolver.
- Add the "resolver owns this" disclaimer to the Test Lead hardcoded table row, or route Test Lead through config as a fixed-override slot.

---

## Blocking Issues

### Issue 1: Hardcoded model names remain in routing decisions — acceptance criterion unmet

- **File**: `parallel-mode.md:375`
- **Problem**: The "unrecognized combination" row in the routing table reads: `resolver's last-resort | balanced | 'anthropic/claude-sonnet-4-6' via 'claude' launcher`. The Notes column hardcodes both the provider name and model name. The task acceptance criterion explicitly requires "no hardcoded model names in routing decisions."
- **Impact**: When the resolver's `FALLBACK_PROVIDER` constant is updated, this row becomes stale and misleads supervisors into passing a wrong model as a hard override. The whole point of delegating to the resolver is broken.
- **Fix**: Replace the Notes column value with: `see resolver's FALLBACK_PROVIDER constant`. Remove the inline model string.

### Issue 2: Same hardcoded model string repeated in Resolution procedure and step 5g

- **File**: `parallel-mode.md:382` and `parallel-mode.md:482`
- **Problem**: Two additional instances of `anthropic/claude-sonnet-4-6 via 'claude' launcher` appear: once in the Resolution procedure step 5 ("last resort is always `anthropic/claude-sonnet-4-6` via `claude` launcher") and again in step 5g item 3 ("always `anthropic/claude-sonnet-4-6` via `claude` launcher — the resolver owns this fallback, not this file"). The parenthetical in 5g at least says "the resolver owns this fallback" — but then the model is still spelled out, defeating the delegation claim.
- **Impact**: Three separate locations must be updated synchronously whenever the fallback model changes. This is the exact coupling the task was supposed to eliminate.
- **Fix**: Both lines should read: "fall back to the resolver's last-resort (defined in `FALLBACK_PROVIDER` in `provider-resolver.ts`)". Do not spell out the model name here.

### Issue 3: Resolution procedure step 3 misrepresents actual resolver behavior

- **File**: `parallel-mode.md:380`
- **Problem**: Step 3 says "Select model for the resolved tier (e.g., `entry.models['heavy']`); fallback within the entry: `balanced` → `heavy` → `light`". The actual `tryProvider()` in `provider-resolver.ts:114` is: `entry.models['balanced'] ?? entry.models['heavy'] ?? entry.models['light']` — it always starts from `balanced` regardless of the requested tier. There is no tier-aware selection within a provider entry. The supervisor following this doc will believe it passes `tier: heavy` and receives a heavy model, when in fact the resolver may resolve a balanced model.
- **Impact**: The supervisor's state.md recording (step 5f) will log a `tier: heavy` intent but the spawned worker gets the `balanced` model. Cost analysis, debugging, and audit logs will all be wrong. This is a behavioral gap that the doc should acknowledge or the resolver should fix.
- **Fix**: Either (a) rewrite step 3 to say "the resolver picks the model based on its internal selection logic — consult `tryProvider()` in `provider-resolver.ts` for the exact tier-to-model mapping" and remove the inline code claim, or (b) raise a resolver bug and update `tryProvider()` to be tier-aware.

---

## Serious Issues

### Issue 1: Dual-slot balanced routing undocumented in Resolution procedure

- **File**: `parallel-mode.md:372` vs `parallel-mode.md:377–383`
- **Problem**: The routing table says Build Worker + preferred_tier=balanced maps to "`routing['balanced']` or `routing['default']`" but the 6-step Resolution procedure never mentions the `default` slot. Step 1 says "look up the routing slot value from config `routing` section" — it gives no instruction on what to do when `routing['balanced']` is absent but `routing['default']` exists.
- **Tradeoff**: A supervisor executing the procedure literally will fail to find `routing['balanced']` and fall through to the last-resort chain, skipping `routing['default']` entirely — while a user's config is correctly set up with a `default` slot.
- **Recommendation**: Add a sub-rule to step 1: "For Build Worker + balanced tier: try `routing['balanced']` first; if absent, fall back to `routing['default']`."

### Issue 2: Test Lead routing table hardcodes provider and model with no exemption rationale

- **File**: `parallel-mode.md:398–402`
- **Problem**: The Test Lead routing table pinpoints `claude` launcher and `claude-sonnet-4-6` model directly inside step 5d. The surrounding text has two callout boxes at lines 395–396 that also hardcode `model: claude-sonnet-4-6`. This was apparently intentional (Test Lead is orchestration-only) but there is no note explaining why this role is exempt from config-driven routing. The "always pass `model: claude-sonnet-4-6`" callouts also violate the "no hardcoded model names in routing decisions" acceptance criterion if interpreted strictly.
- **Recommendation**: Add an inline note: "Test Lead routing is fixed and not config-driven — it always uses the last-resort provider because it performs orchestration only, and the cost savings of routing are irrelevant at this tier." This removes ambiguity without requiring a code change.

### Issue 3: `omit if 'claude'` in step 5e couples doc to MCP default behavior

- **File**: `parallel-mode.md:427`
- **Problem**: "omit if `claude` — that is the MCP default, so omitting is equivalent" encodes knowledge of an MCP server implementation detail as a supervisor behavior rule. If the MCP server's default provider changes, the supervisor will silently send wrong workers without any warning.
- **Recommendation**: Either always pass the provider explicitly, or add a comment noting the MCP default version this was true for: "MCP default as of session-orchestrator v{N} — verify before relying on omission."

---

## Minor Issues

1. **Table column alignment inconsistency** (`parallel-mode.md:366–375`): The header row uses `|-----------|-------------|------|-------|` while other tables in the file use uniform column widths. This does not affect parsing but is inconsistent with the surrounding tables (e.g., the watch conditions table at lines 449–458 uses padded columns). Low impact, cosmetic.

2. **"Condition" column wording inconsistency** (`parallel-mode.md:368–374`): Review Worker rows use `Type=logic` while Build Worker rows use `preferred_tier=heavy`. Different field names are used in the same column. The Review Worker rows read `Type=logic (code-logic-reviewer)` with a parenthetical annotation; the Build Worker rows have no annotation. Future additions may use yet another format. A style note clarifying the column format would help contributors.

---

## File-by-File Analysis

### `.claude/skills/auto-pilot/references/parallel-mode.md` (lines 352–500)

**Score**: 5/10
**Issues Found**: 3 blocking, 3 serious, 2 minor

**Analysis**:

The new config-driven routing section represents a genuine improvement over the hardcoded provider table it replaced. The routing slot names (`review-logic`, `review-style`, `review-simple`, `heavy`, `balanced`, `light`, `documentation`) are confirmed correct against `RoutingConfig` in `provider-config.ts:41–49`. The `default` slot is defined in the type but not exposed as a routing target in `DEFAULT_ROUTING` for most slots — that inconsistency pre-exists this task. The `codex`/`openai-codex` documentation is clear and adds genuine value.

The critical failure is that the task's primary acceptance criterion — "no hardcoded model names in routing decisions" — is not fully met. The model string `anthropic/claude-sonnet-4-6` appears in three locations in the reviewed range. The parenthetical disclaimers ("the resolver owns this fallback") soften the problem but do not eliminate it: the model name is still embedded in a document that is supposed to delegate that knowledge to code.

The Resolution procedure is also inaccurate at step 3 in a way that will mislead supervisors about which model tier they actually requested.

**Specific Concerns**:

1. Line 375: Notes column hardcodes `anthropic/claude-sonnet-4-6 via 'claude' launcher` — violates acceptance criterion
2. Lines 382, 482: Same hardcoded string repeated in prose — three sync points for one value
3. Line 380: "`balanced` → `heavy` → `light`" fallback does not match `tryProvider()` — which always starts from `balanced` regardless of tier
4. Line 372: Dual-slot `routing['balanced']` or `routing['default']` not reconciled in Resolution procedure steps
5. Lines 395–396, 402: Test Lead model hardcoded — inconsistent with the surrounding delegation pattern

---

## Pattern Compliance

| Pattern                          | Status | Concern                                                           |
|----------------------------------|--------|-------------------------------------------------------------------|
| Config-driven routing slot names | PASS   | All 7 slots match `RoutingConfig` type definition                 |
| No hardcoded provider in routing | PASS   | Routing decisions use slot references, not provider names         |
| No hardcoded models in routing   | FAIL   | `claude-sonnet-4-6` appears at lines 375, 382, 395, 396, 402, 482 |
| Resolution procedure accuracy    | FAIL   | Step 3 misrepresents `tryProvider()` tier selection logic         |
| Delegation to resolver           | PARTIAL| 5g says "resolver owns this" but still spells out the model       |
| Canonical single source of truth | FAIL   | Model name defined in 3 doc locations + 1 code location           |

---

## Technical Debt Assessment

**Introduced**: The three inline occurrences of `anthropic/claude-sonnet-4-6` as documentation "examples" create a shadow copy of `FALLBACK_PROVIDER`. Any future model upgrade requires a code change AND three doc changes.

**Mitigated**: Eliminates the original hardcoded routing table (claude/glm/opencode provider names in routing decisions). This is real progress.

**Net Impact**: Slightly positive but not complete — the most visible hardcoded values (provider names in routing rows) are gone; the most subtle one (fallback model as inline note) remains.

---

## Verdict: FAIL

**Recommendation**: REVISE
**Confidence**: HIGH
**Key Concern**: Three instances of `anthropic/claude-sonnet-4-6` remain in routing decision prose, directly violating the primary acceptance criterion. The Resolution procedure step 3 also misrepresents actual resolver behavior in a way that creates audit log discrepancies.

## What Excellence Would Look Like

A 9/10 implementation would:
- Replace all three inline occurrences of `anthropic/claude-sonnet-4-6` with a reference to the `FALLBACK_PROVIDER` constant in `provider-resolver.ts`
- Add a step 1a to the Resolution procedure specifying the `balanced`/`default` slot fallback rule
- Align step 3 of the Resolution procedure with actual `tryProvider()` behavior, or add a note: "the resolver's internal tier selection may differ — consult `tryProvider()` for the exact algorithm"
- Add an inline note to the Test Lead section explaining the exemption from config-driven routing
- Remove the `omit if 'claude'` optimization hint in step 5e or scope it to a specific MCP version

---

## Review Lessons (New Patterns Found)

The following patterns were identified during this review and should be appended to `.claude/review-lessons/review-general.md`:

- **Delegation prose that still names the delegatee's value is not delegation** — when a doc step says "delegate to X (which is always Y)", the inline mention of Y defeats the delegation. Either delegate fully (no inline value) or own the value with no delegation claim. A half-delegation creates N sync points instead of 1. (TASK_2026_112)
- **Resolution procedure steps in doc must match the actual code algorithm, not an idealized version** — when a doc documents a multi-step resolution procedure that maps to real code (e.g., `tryProvider()`), the step ordering and fallback logic must match the code character-for-character. An inaccurate procedure description produces correct subjective behavior but wrong audit data and wrong developer mental models. (TASK_2026_112)
