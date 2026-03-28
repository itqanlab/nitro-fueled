# Code Logic Review — TASK_2026_110

**Reviewer:** nitro-code-logic-reviewer
**Date:** 2026-03-28
**Scope:** Launcher-Aware Config Schema + Provider Resolver Engine

## Files Reviewed

- apps/cli/src/utils/provider-config.ts (397 lines)
- apps/cli/src/commands/config.ts (169 lines)
- apps/cli/src/utils/provider-flow.ts (344 lines)
- apps/cli/src/utils/provider-status.ts (67 lines)

---

## Summary

| Severity | Count |
|----------|-------|
| Critical | 0     |
| Major    | 2     |
| Medium   | 2     |
| Minor    | 3     |

**Overall Assessment:** Implementation is functionally correct. The launcher detection, config migration, and routing assignment logic all align with the task specification. Two major issues relate to type safety and error handling patterns flagged in review-lessons.

---

## Issues

### MAJOR-1: Type Assertion Without Full Validation

**File:** `apps/cli/src/utils/provider-config.ts`
**Location:** Line 246
**Pattern:** Uses `as { providers: OldProviders }` type assertion

```typescript
function migrateOldConfig(projectPath: string, raw: unknown): void {
  if (!isRecord(raw)) return;
  const old = raw as { providers: OldProviders };  // <-- assertion
```

**Problem:** `isOldFormatConfig()` validates that `providers` exists with old-style keys, but the assertion on line 246 bypasses TypeScript's type narrowing. If the structure doesn't match `OldProviders` exactly (e.g., missing nested fields), runtime errors could occur.

**Expected:** Use type guard or validate structure before accessing nested properties like `old.providers.glm?.enabled`.

---

### MAJOR-2: Empty Catch Blocks (Swallowed Errors)

**File:** `apps/cli/src/utils/provider-config.ts`
**Locations:** Lines 226-228, 263-265

```typescript
// Line 226-228
try {
  chmodSync(tmpPath, 0o600);
} catch {
  // non-fatal — some platforms may not support chmod
}

// Line 263-265
try {
  renameSync(projectPath, migratedPath);
} catch {
  // If rename fails, just continue
}
```

**File:** `apps/cli/src/utils/provider-flow.ts`
**Location:** Line 163

```typescript
try {
  parsed = JSON.parse(readFileSync(authFile, 'utf8'));
} catch {
  return { found: true, authenticated: false, models: [] };
}
```

**Problem:** Review-lessons mandate "Never swallow errors — no empty catch blocks." While these are intentionally non-fatal, they should at least log a debug message or the error reason to aid troubleshooting.

**Expected:** Add `console.debug()` or similar logging when ignoring errors intentionally.

---

### MEDIUM-1: Potential Model Duplication in detectOpenCode()

**File:** `apps/cli/src/utils/provider-flow.ts`
**Location:** Lines 85-96, 113-128

```typescript
for (const line of output.split('\n')) {
  const lower = line.toLowerCase();
  if (lower.includes('openai') && ...) {
    rows.push({ prefix: 'openai', method: 'oauth' });
  }
  if (lower.includes('zai') && ...) {
    rows.push({ prefix: 'zai', method: 'api-key' });
  }
}
```

**Problem:** If `opencode auth list` output contains multiple lines matching the same prefix (e.g., multiple 'openai' lines), duplicate rows are added. Downstream, this causes duplicate models to be pushed to the `models` array (lines 113-121).

**Impact:** Cosmetic — duplicate models in the config's `launchers.opencode.models` array.

**Expected:** Either deduplicate `authRows` after parsing, or use a `Set` when building the models array.

---

### MEDIUM-2: promptRoutingAssignment Allows Unavailable Providers

**File:** `apps/cli/src/utils/provider-flow.ts`
**Location:** Lines 314-319

```typescript
if (availableProviders.includes(answer) || Object.keys(DEFAULT_PROVIDERS).includes(answer)) {
  routing[slot] = answer;
}
```

**Problem:** Users can assign routing slots to providers defined in `DEFAULT_PROVIDERS` even if the provider's launcher is not authenticated. This allows configuring `openai-codex` when codex is not installed.

**Impact:** Config validation via `checkProviderConfig()` will catch this at runtime, but the wizard doesn't warn during assignment.

**Expected:** Either warn the user during assignment, or restrict choices to `availableProviders` only.

---

### MINOR-1: Unnecessary Async Function

**File:** `apps/cli/src/utils/provider-status.ts`
**Location:** Line 16

```typescript
export async function getProviderStatus(cwd: string): Promise<ProviderStatusResult[]> {
```

**Problem:** Function is declared `async` but contains no `await` statements. The function body is fully synchronous.

**Impact:** None — Promise wrapper adds negligible overhead.

**Expected:** Remove `async` keyword and return array directly, or add comment explaining async signature is for future extensibility.

---

### MINOR-2: Type Assertion in printDerivedTiers

**File:** `apps/cli/src/utils/provider-flow.ts`
**Location:** Line 276

```typescript
const model = provider.models[tier as 'heavy' | 'balanced' | 'light'];
```

**Problem:** Type assertion required because `tier` is typed as `RoutingSlot` (8 values) but `provider.models` is `Record<ModelTier, string>` (3 values).

**Impact:** None — the loop explicitly filters to only 'heavy', 'balanced', 'light' on line 270.

**Expected:** Extract tier subset as a typed constant or use type narrowing to avoid the cast.

---

### MINOR-3: Unused cwd Parameter

**File:** `apps/cli/src/commands/config.ts`
**Location:** Line 85

```typescript
async function runDetectionWizard(cwd: string): Promise<void> {
```

**Problem:** The `cwd` parameter is accepted but never used within the function. The wizard operates on global config only.

**Impact:** None — parameter is harmless but misleading.

**Expected:** Remove `cwd` parameter if not needed, or document why it's reserved for future use.

---

## Logic Correctness Assessment

### Launcher Detection Flow
- **detectClaude():** Correctly tries `claude auth status`, falls back to `claude status`. Returns appropriate model list when authenticated.
- **detectOpenCode():** Parses `opencode auth list` output for oauth/api-key rows. Correctly checks `ZAI_API_KEY` env fallback. Always includes free-tier model.
- **detectCodex():** Reads `~/.codex/auth.json`, checks `auth_mode` field. Correctly falls back to `OPENAI_API_KEY` env.

### Config Migration Flow
- **isOldFormatConfig():** Correctly identifies old schema by checking for `providers.claude/glm/opencode` with `enabled` field.
- **migrateOldConfig():** Renames old file to `.migrated`, derives routing from old `glm.enabled` state, writes new schema to global path.

### Config Merge Flow
- **readConfig():** Global + project merge with project-wins semantics is correct.
- **writeConfig():** Atomic write pattern (tmp + rename) is correct.

### Routing Assignment Flow
- **promptRoutingAssignment():** Interactive prompts work correctly. Empty input preserves existing value.
- **buildConfig():** Correctly assembles final config from launchers + routing.

---

## Verdict

**PASS with minor issues**

The implementation correctly implements the launcher-aware config schema as specified. The two major issues (type assertion, swallowed errors) are style violations from review-lessons rather than functional bugs. The medium issues have negligible runtime impact but should be addressed for robustness.

No blocking issues found. Implementation can proceed to next review phase.
