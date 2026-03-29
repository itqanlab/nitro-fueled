# Code Logic Review — TASK_2026_112

## Score: 6/10

## Acceptance Criteria Status

| Criterion | Status | Notes |
|-----------|--------|-------|
| No hardcoded provider names (claude, glm, opencode) in routing decisions | PARTIAL | `claude-sonnet-4-6` appears in Review Lead and Test Lead routing — whether intentional is the core question |
| No hardcoded model names in routing decisions | PARTIAL | `claude-sonnet-4-6` is hardcoded in Review Lead note, Test Lead note, and Test Lead routing table (lines 395, 396, 402) |
| Routing reads from config `routing` section | PASS | Step 5d resolution procedure correctly reads `config.routing[slot]` → `providerName` |
| Supervisor passes `{ provider, tier }` to `spawn_worker` | PASS | Step 6 of resolution procedure and Step 5e both describe this correctly |
| `codex` and `openai-codex` documented as valid provider options | PASS | Lines 389 and 391 document both, with harness behavior distinction |
| Spawn fallback delegates to resolver — no hardcoded fallback model string | PARTIAL | Step 5g line 482 states the fallback is `anthropic/claude-sonnet-4-6` via `claude` launcher inline — this is factual documentation but it repeats the hardcoded value the task aimed to remove |
| Existing routing behavior preserved when config matches current defaults | PASS | The slot mapping in the routing table matches `DEFAULT_ROUTING` and `DEFAULT_PROVIDERS` |

---

## The 5 Paranoid Questions

### 1. How does this fail silently?

`resolveProviderForSpawn` returns `null` when all config providers and their launchers are
unavailable (line 149 of `provider-resolver.ts`). Step 5d, resolution step 5, says "walk the
resolver fallback chain; last resort is always `anthropic/claude-sonnet-4-6` via `claude`
launcher." This is false. The actual resolver does NOT fall back to a hardcoded constant if
`anthropic` itself is absent from `config.providers` or its launcher is marked
`authenticated: false`. The `FALLBACK_PROVIDER` constant is defined in the resolver file but
`resolveProviderForSpawn` never calls it — the function returns `null` instead (see the comment
on line 149: "All config providers (including anthropic) are unavailable — return null").

The SKILL.md procedure therefore describes a guarantee the resolver does not provide. A
supervisor following this procedure will believe fallback is always available, will not
implement a null-check after step 5, and will pass `undefined` or crash silently when
`resolveProviderForSpawn` returns `null`.

### 2. What user action causes unexpected behavior?

A user who sets `"review-logic": "zai"` in their config to route logic reviews to ZAI will
also silently change the provider for their Review Lead worker's sub-workers, because the
Review Lead model note (line 395: "always pass `model: claude-sonnet-4-6`") is written as a
provider-independent override but does not specify which provider `claude-sonnet-4-6` belongs
to. A Supervisor passing `provider: zai, model: claude-sonnet-4-6` would hand mismatched
arguments to spawn_worker. The note conflates model pinning with provider pinning without
saying "and provider must be `anthropic`."

### 3. What data makes this produce wrong results?

A config where `routing['balanced']` is absent but `routing['default']` is present: the
routing table row for "Build Worker + preferred_tier=balanced" reads
`routing['balanced']` or `routing['default']` (line 372). However, resolution step 1 says
"look up the routing slot value" with no mention of this fallback. The fallback between
`balanced` and `default` is documented only in the condition table, not in the resolution
procedure, so a literal reading of the six resolution steps would produce `undefined` for
`providerName` when `balanced` is absent from config, silently falling through to an
unrecognized-combination row instead of checking `default`.

### 4. What happens when dependencies fail?

The resolver returns `null` (not the last-resort fallback) when every launcher in config is
unauthenticated. Step 5g describes behavior assuming a fallback always exists. There is no
instruction in Step 5d or 5g for handling a `null` result from the resolver. The supervisor
would attempt to use `null` as a provider name, passing it to `spawn_worker`, which would
either error with an unhelpful message or silently spawn with the MCP default.

### 5. What's missing that the requirements didn't mention?

The task requirements explicitly say to change Step 5g to reference "resolver's last-resort
provider" and not to hardcode the model string. Step 5g line 482 still contains the inline
parenthetical: "(always `anthropic/claude-sonnet-4-6` via `claude` launcher — the resolver
owns this fallback, not this file)". The parenthetical acknowledges the resolver owns the
value but then documents the value anyway — defeating the stated purpose of the change.
A future change to the resolver's `FALLBACK_PROVIDER` constant would not automatically
update this parenthetical, recreating the same drift problem the task was meant to fix.

---

## Blocking Issues (must fix)

### BLOCK-1: Step 5d Resolution Step 5 Misrepresents the Resolver's Fallback Contract

**Location**: `parallel-mode.md` line 382
**Text**: "last resort is always `anthropic/claude-sonnet-4-6` via `claude` launcher"

The actual resolver (`resolveProviderForSpawn` in `provider-resolver.ts`) returns `null`
when all providers are unavailable. The `FALLBACK_PROVIDER` constant is defined but is
never used inside `resolveProviderForSpawn` — only `tryProvider` is called in the iteration
loop, and if that exhausts all candidates, the function returns `null` on line 150.

This creates a false safety guarantee. Every supervisor reading Step 5 will omit a null-check
because the spec says last-resort is "always" available. The spawning code must handle `null`
from `resolveProviderForSpawn`, but the SKILL.md gives no instruction for that path.

**Fix**: Change step 5 to say: "If unavailable, walk the resolver fallback chain. Note:
`resolveProviderForSpawn` returns `null` if all launchers are unauthenticated — treat this
the same as a spawn failure (proceed to Step 5g with error "no providers available")."

### BLOCK-2: Review Lead and Test Lead Model Hardcoding Not Addressed

**Location**: `parallel-mode.md` lines 395, 396, 402
**Text**: "always pass `model: claude-sonnet-4-6`" (Review Lead); the Test Lead table hardcodes
`claude` / `claude-sonnet-4-6`.

The task's acceptance criterion reads: "Auto-pilot SKILL.md has no hardcoded model names in
routing decisions." Lines 395–402 are routing decisions — they direct the supervisor to pass
a specific model string. These lines were not modified by this task.

The task description only explicitly listed Step 5d and Step 5g as change targets, and added
a note: "The Test Lead routing section (fixed `claude/claude-sonnet-4-6`) — is this
intentionally kept hardcoded?" — this question was never answered in the implementation.

If the intent is to keep Review Lead and Test Lead hardcoded, the acceptance criterion must
be narrowed to "no hardcoded model names in Build Worker and Review Worker routing decisions."
If the intent is to make them config-driven too, the implementation is incomplete.

As written, the acceptance criterion fails against the delivered text.

---

## Serious Issues (should fix)

### SERIOUS-1: Step 5g Fallback Still Documents the Hardcoded Value It Claims to Delegate

**Location**: `parallel-mode.md` line 482
**Text**: "(always `anthropic/claude-sonnet-4-6` via `claude` launcher — the resolver owns
this fallback, not this file)"

The parenthetical documents the exact value while saying the resolver owns it. When
`FALLBACK_PROVIDER` in the resolver changes, this line becomes stale. The task acceptance
criterion says "no hardcoded fallback model string." A parenthetical that states the model
string is still a hardcoded model string, even if wrapped in a disclaimer.

**Fix**: Remove the parenthetical entirely. Write: "Retry `spawn_worker` using the resolver's
last-resort provider and model (as returned by the resolver — do not specify them here)."

### SERIOUS-2: `routing['balanced']` / `routing['default']` Fallback Is Not in the Resolution Procedure

**Location**: `parallel-mode.md` line 372 (condition table) vs lines 378–383 (resolution
procedure)

The condition table row for `preferred_tier=balanced` shows `routing['balanced']` or
`routing['default']` as the slot. The six-step resolution procedure (steps 1–6) says only
"look up the routing slot value" with no mention of the `default` fallback. A literal
implementation of the resolution procedure would produce `undefined` when `balanced` is
absent, rather than falling back to `default`.

**Fix**: Add to resolution step 1: "If the primary slot is absent from config, check
`routing['default']` as a secondary fallback before treating the combination as
unrecognized."

### SERIOUS-3: `spawn_worker` Model Parameter Instruction Is Inconsistent With Config-Driven Model Resolution

**Location**: `parallel-mode.md` line 426
**Text**: "`model`: the resolved model from step 5d (omit if `default` sentinel was never
resolved — should not happen after routing table lookup)"

Step 5d now says "the model is always determined by the resolver from the provider's entry
in config." But the model is resolved locally in steps 2–3 of the resolution procedure
(look up `config.providers[providerName]`, select `entry.models[tier]`), not by a call to
`resolveProviderForSpawn`. The actual resolver call happens server-side as "Phase 2
re-validation" (step 6 of the resolution procedure). The model passed to `spawn_worker`
is therefore the locally-resolved model, which then gets re-validated or overridden by the
server. Step 5e should clarify that this model may be substituted by the resolver during
Phase 2 re-validation.

---

## Minor Issues (nice to fix)

### MINOR-1: Inline Model Reference in the Unrecognized-Combination Row

**Location**: `parallel-mode.md` line 375
**Text**: `| *(unrecognized combination)* | resolver's last-resort | `balanced` | `anthropic/claude-sonnet-4-6` via `claude` launcher |`

The Notes column documents the specific fallback model string. This is documentation
rather than a routing decision, so it may be considered acceptable, but it is another
location that will drift if the resolver's `FALLBACK_PROVIDER` constant changes.

### MINOR-2: The `routing['light']` Slot Is in the Condition Table But Not in `RoutingConfig`

**Location**: `parallel-mode.md` line 373 vs `provider-config.ts` lines 41–49

`RoutingConfig` defines slots: `default`, `heavy`, `balanced`, `light`, `review-logic`,
`review-style`, `review-simple`, `documentation`. The `light` slot exists in the type and
is used in `DEFAULT_ROUTING`. The condition table at line 373 references `routing['light']`
for `preferred_tier=light` — this is correct and matches the type. No action needed, but
worth confirming that `light` is in `DEFAULT_ROUTING` (it is, set to `anthropic`).

### MINOR-3: The `model` Field Behavior for Provider-Overridden Spawns Is Undocumented

**Location**: `parallel-mode.md` Step 5g line 483
When the fallback spawn succeeds, the instruction says to "record the worker in state.md
using the last-resort provider and model returned by the resolver." But `resolveProviderForSpawn`
returns the model from `tryProvider`, which picks `balanced` → `heavy` → `light` regardless
of the originally requested tier. The tier passed at spawn may not match the model tier
actually selected. This is an existing ambiguity surfaced by the new procedure, not
introduced by this task.

---

## Verdict: FAIL

The core routing table (Step 5d) is correctly rewritten and meets the spirit of the task.
The config-driven approach, slot names, and `codex`/`openai-codex` documentation are all
present and accurate.

However two blocking issues prevent a pass:

1. **The resolver's actual `null` return on total launcher failure is misrepresented** as a
   guaranteed last-resort fallback. Any supervisor implementing the six-step procedure will
   have no null-check and will behave incorrectly when all launchers are unavailable.

2. **The Review Lead and Test Lead hardcoded model names remain**, and the acceptance
   criterion as written does not carve them out. Either the criterion must be narrowed to
   explicitly exclude Test Lead and Review Lead, or the hardcoded values must be changed.

The serious issues (Step 5g still documenting the model string, and the `balanced`/`default`
fallback omitted from the resolution procedure) compound the blocking issues but are
individually fixable in a small follow-on.
