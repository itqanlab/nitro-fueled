# Style Review — TASK_2026_054

## Score: 6/10

## Summary

The three files are generally readable and accomplish the task requirements. However,
`provider-flow.ts` exceeds the 200-line utility file limit, contains one `as` type
assertion in a sibling file, has a spaced string literal union member that violates a
documented project lesson, and the `reconfigureOpenCode` function needs "and" to
describe it — a documented split signal. These are not catastrophic but each one has
a corresponding rule in `.claude/review-lessons/review-general.md` or `anti-patterns.md`
that was either added after a previous incident or is standing project policy.

---

## Issues Found

### HIGH

- **[provider-flow.ts — file]** File is 249 lines, exceeding the 200-line max for utility
  files (review-general.md "File Size Limits"). The split is natural: public menu
  functions (lines 1–138) belong in `provider-flow.ts`; internal helpers
  `reconfigureGlm`, `reconfigureOpenCode`, and `installOpenCode` (lines 140–249) could
  move to `provider-flow-helpers.ts`. At 249 lines the file is not catastrophically
  over-limit, but the rule exists because files at this size tend to grow, not shrink.
  (severity: HIGH)

- **[provider-status.ts:7]** `ProviderStatus` is `'connected' | 'failed' | 'not configured'`.
  The member `'not configured'` embeds a space. The review lesson added in TASK_2026_068
  explicitly flags this: "String literal union members must not embed spaces in discriminant
  values — prefer `'not-configured'`." This value propagates to at least 6 call sites
  across `provider-status.ts` and `provider-flow.ts` (the hard-coded `console.log`
  strings at provider-flow.ts:77 and :126 use the prose form, not the discriminant,
  so renaming would not break them — but the type guard at provider-status.ts:75
  does a string compare against the discriminant). Embedded spaces are typo-silent:
  `'not configured'` and `'not-configured'` look identical in a quick scan.
  (severity: HIGH)

### MEDIUM

- **[provider-config.ts:175]** `as Array<unknown>` is a type assertion — the rule says
  "No `as` type assertions." The surrounding code already confirms `Array.isArray(data['data'])`
  on the same line, which is a sufficient type guard. The cast is defensive but
  unnecessary: after `Array.isArray(x)` TypeScript narrows `x` to `unknown[]`, which
  is the same as `Array<unknown>`. Remove the `as` and use the narrowed type directly.
  (severity: MEDIUM)

- **[provider-flow.ts:191–248]** `reconfigureOpenCode` handles: (1) checking/installing
  the binary, (2) selecting auth method, (3) prompting for a model slug, (4) prompting
  for an API key, and (5) validation warnings. That is five distinct responsibilities.
  The function is 58 lines and needs "and" multiple times to describe it. The
  anti-patterns rule says "functions over 50 lines are doing too much — split by
  responsibility." At minimum, the API key collection path (lines 232–247) is
  independently extractable. The current shape also makes the subscription path
  (early return at line 229) invisible at a glance because it is buried mid-function
  after three other concerns. (severity: MEDIUM)

- **[provider-flow.ts:200–202]** The `authHint` variable is computed and then used only
  inside a `console.log` two lines later. It adds no clarity over inlining the ternary
  directly. More importantly it shadows the name pattern: `existingAuthMethod` is the
  meaningful name; `authHint` is a display alias that looks like a different concept.
  A reader must mentally trace both names. Inline or rename to `authDisplay`.
  (severity: LOW — but the naming confusion is real)

### LOW

- **[provider-config.ts:111–112]** `ZAI_API_KEY_ENV` and `OPENAI_API_KEY_ENV` are
  module-private constants (not exported). That is correct. But the project naming
  convention from review-general.md says constants (domain objects) use
  `SCREAMING_SNAKE_CASE`. These already do — passing. However they are single-use
  (each appears exactly once in a string template). Single-use local constants are
  noise unless they signal intent (e.g., a value that will change). The env var names
  are unlikely to change; consider inlining them and noting this in a comment. Minor.
  (severity: LOW)

- **[provider-flow.ts:29]** `MODEL_FORMAT_RE` is a module-level regex constant. It is
  used only inside `reconfigureOpenCode`. Keeping it at module level is fine, but if
  `reconfigureOpenCode` is ever extracted to a helper file, this constant must move
  with it. It has no other consumers. Flag for extraction if the file split happens.
  (severity: LOW)

- **[provider-status.ts:73]** The ternary `s.status === 'connected' ? '✓' : s.status === 'failed' ? '✗' : '-'`
  works today with three statuses. If a fourth status value is ever added to the
  `ProviderStatus` union, there is no compile-time signal to update this ternary — the
  `-` icon would be silently reused. A switch with an exhaustiveness check (`default:
  assertNever(s.status)`) would catch future additions. Not blocking, but the pattern
  degrades silently. (severity: LOW)

---

## Passed Checks

- **No `any` types** — all three files use `unknown` with explicit narrowing where needed.
- **kebab-case file names** — all three files follow the convention.
- **Explicit return types** — every exported function has an explicit return type annotation.
- **Error handling** — `readConfig` wraps `JSON.parse` in try/catch and surfaces a human-readable
  `console.warn`; `testGlmConnection` catches all fetch errors and trims long messages.
- **Backwards compatibility** — `authMethod?: 'api-key' | 'subscription'` is optional, so
  existing configs without the field continue to work. `checkProviderConfig` at line 133
  correctly treats `authMethod !== 'subscription'` (including `undefined`) as requiring a key.
- **Import hygiene** — imports are grouped (node: built-ins, then local), no unused imports
  detected, `import type` used correctly for type-only imports.
- **`provider-config.ts` line count** — 187 lines, within the 200-line limit.
- **`provider-status.ts` line count** — 78 lines, well within limit.
- **Atomic config write** — `writeConfig` writes to `.tmp` then renames, guarding against
  partial writes on SIGKILL. The chmod is wrapped in a try/catch with a documented reason.
- **String union types used for `authMethod`** — `'api-key' | 'subscription'` instead of bare
  `string`. Discriminated union results (`GlmMenuResult`, `OpenCodeMenuResult`) are well-formed.
- **`isRecord` type guard** — used consistently to narrow `unknown` before field access; no
  unchecked index access on the JSON parse result.
- **`resolveApiKey` used at every key-reading site** — both `checkProviderConfig` and
  `getProviderStatus` route through `resolveApiKey`, so the `$ENV_VAR` indirection
  is applied uniformly.

---

## The 5 Critical Questions

### 1. What could break in 6 months?

`provider-status.ts:73` — if a new `ProviderStatus` variant is added (e.g., `'degraded'`),
the icon ternary silently falls through to `'-'` with no compiler warning. The `label`
variable at line 75 has the same problem: it only special-cases `'not configured'`, so any
new status would print as the raw enum string, which may be acceptable but is untested.

### 2. What would confuse a new team member?

`provider-flow.ts:200–216` — the `authHint` variable is computed as a display string but
then `authMethod` is re-derived from `authAnswer` below it. The two variables look related
but serve different purposes. A reader will wonder: why compute `authHint` and not use it
for the actual decision? The answer is that it is display-only, but this is not documented.

### 3. What's the hidden complexity cost?

`reconfigureOpenCode` (provider-flow.ts:191–248) is 58 lines with two early-return paths.
The subscription branch returns at line 229 before the API key section — a reader scanning
from the bottom sees the API key section and may not realize it is dead code for the
subscription path. Functions with early returns that change which later sections are
reachable require active mental tracking of all paths. When requirements change, this
function will attract more cases without a natural forcing function to split.

### 4. What pattern inconsistencies exist?

`'not configured'` (with space) in `ProviderStatus` vs all other union members which use
single-word or hyphenated values. This is the only multi-word union member in these three
files. The existing lesson (TASK_2026_068) explicitly calls this pattern out.

### 5. What would I do differently?

Split `reconfigureOpenCode` into two named helpers (`collectSubscriptionConfig`,
`collectApiKeyConfig`) invoked by a thin dispatch function. Replace the spaced union member
with `'not-configured'`. Remove the `as Array<unknown>` cast — it is redundant after
`Array.isArray`. Add an exhaustive switch with `assertNever` in `printProviderStatusTable`.

---

## New Lesson

- **String literal union members with embedded spaces are a recurring violation** — `'not configured'`
  passed through this review despite the TASK_2026_068 lesson explicitly forbidding it. The lesson
  is present in review-general.md but was not applied during implementation. Implementations should
  be checked against review-general.md TypeScript Return Semantics section before marking IMPLEMENTED.
  (TASK_2026_054)
