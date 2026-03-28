# Code Style Review — TASK_2026_110

**Reviewer:** nitro-code-style-reviewer
**Task:** Launcher-Aware Config Schema + Provider Resolver Engine
**Files reviewed:** 4 (per File Scope in task.md)
**Verdict:** NEEDS FIXES

---

## Summary

| File | Lines | Issues |
|------|-------|--------|
| `apps/cli/src/utils/provider-config.ts` | 397 | 4 issues |
| `apps/cli/src/commands/config.ts` | 169 | 1 issue |
| `apps/cli/src/utils/provider-flow.ts` | 344 | 3 issues |
| `apps/cli/src/utils/provider-status.ts` | 67 | ✓ Clean |

---

## Issues by File

### `apps/cli/src/utils/provider-config.ts`

#### [HIGH] `as` type assertion — L150
```ts
const providers = value['providers'] as Record<string, unknown>;
```
**Convention violated:** No `as` assertions — use type guards or generics.
The preceding `isRecord(value['providers'])` check already narrows `value['providers']` to `Record<string, unknown>` inside the `if` block. The `as` assertion is redundant and can be replaced by extracting the narrowed value directly from the guard: `const providers = value['providers'];` (TypeScript already knows the type from the `in` + `isRecord` check).

---

#### [HIGH] `as` type assertion — L246
```ts
const old = raw as { providers: OldProviders };
```
**Convention violated:** No `as` assertions.
`raw` was checked with `isRecord(raw)` on L245, but only narrowed to `Record<string, unknown>` — no validation of the nested `providers` shape. This asserts a concrete type without verifying it. Should use a type guard or access `raw['providers']` directly with `isRecord` checks on each nested field.

---

#### [HIGH] Empty / swallowed catch — L263–265
```ts
try {
  renameSync(projectPath, migratedPath);
} catch {
  // If rename fails, just continue
}
```
**Convention violated:** Never swallow errors — no empty catch blocks.
A comment alone does not satisfy this rule. At minimum the error should be logged: `console.warn('Could not rename old config:', err instanceof Error ? err.message : String(err));`. Silently continuing means the user gets no signal when migration silently fails.

---

#### [MEDIUM] File size exceeds 200-line limit — 397 lines
**Convention violated:** Services/utilities max 200 lines.
The file is nearly double the limit. Likely split points:
- Migration logic (`migrateOldConfig`, `OldProviders`, `isOldFormatConfig`) → `provider-migration.ts`
- GLM test helpers (`resolveApiKey`, `testGlmConnection`, `GlmTestResult`) → `glm-test.ts`
- Default constants (`DEFAULT_PROVIDERS`, `DEFAULT_ROUTING`) → `provider-defaults.ts`

---

### `apps/cli/src/commands/config.ts`

#### [MEDIUM] Unused parameter `cwd` in `runDetectionWizard` — L85
```ts
async function runDetectionWizard(cwd: string): Promise<void> {
```
**Convention violated:** No unused imports or dead code.
`cwd` is accepted but never used in the function body. `readConfig(cwd)` is not called — only `readGlobalConfig()` on L93. The parameter should either be removed or the call should be changed to `readConfig(cwd) ?? readGlobalConfig()` (which may be the intended behavior).

---

### `apps/cli/src/utils/provider-flow.ts`

#### [MEDIUM] Duplicate `isRecord` helper — L27–29
```ts
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
```
**Convention violated:** No dead code / unnecessary duplication.
Identical helper already defined in `provider-config.ts` L134. Since `provider-flow.ts` already imports from `provider-config.ts`, `isRecord` should be exported from `provider-config.ts` and imported here rather than redefined.

---

#### [HIGH] `as` type assertion — L276
```ts
const model = provider.models[tier as 'heavy' | 'balanced' | 'light'];
```
**Convention violated:** No `as` assertions.
`tier` comes from `tiers: RoutingSlot[] = ['heavy', 'balanced', 'light']` (L270), but the type is still `RoutingSlot`. Rather than casting, the loop should be typed to use `ModelTier` directly: `const tiers: ModelTier[] = ['heavy', 'balanced', 'light']` (since `ModelTier = 'heavy' | 'balanced' | 'light'` is already defined). No assertion needed.

---

#### [MEDIUM] File size exceeds 200-line limit — 344 lines
**Convention violated:** Services/utilities max 200 lines.
Likely split: detection helpers (`detectClaude`, `detectOpenCode`, `detectCodex`, `parseOpenCodeAuthList`, `detectLaunchers`, `printLauncherResult`) → `launcher-detect.ts`; routing and build helpers can remain in `provider-flow.ts`.

---

### `apps/cli/src/utils/provider-status.ts`

No issues. Clean implementation, correct types, no assertions, no swallowed errors, well within 200-line limit.

---

## Advisory (out-of-scope, do not fix)

- **`resolveApiKey` / `testGlmConnection` in `provider-config.ts`**: Both are exported but no in-scope file imports them. If no out-of-scope caller exists (e.g., `run.ts`), these are dead code. Verify before removing.
- **`AuthMethod[]` vs `Array<'oauth' | 'api-key'>`** in `provider-flow.ts` L111: Minor — `AuthMethod` is already defined as this union and should be preferred for consistency.

---

## Issues Count

| Severity | Count |
|----------|-------|
| HIGH     | 4     |
| MEDIUM   | 4     |
| LOW      | 0     |
| Total    | 8     |
