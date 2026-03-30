# Implementation Plan - TASK_2026_110

## Codebase Investigation Summary

### Files That Reference Provider Types/Functions

| File | Imports/Uses |
|------|-------------|
| `apps/cli/src/utils/provider-config.ts` | Defines all types + functions (source of truth) |
| `apps/cli/src/utils/provider-flow.ts` | Imports `GlmProviderConfig`, `OpenCodeProviderConfig`, `testGlmConnection`, `resolveApiKey` |
| `apps/cli/src/utils/provider-status.ts` | Imports `readConfig`, `testGlmConnection`, `resolveApiKey` |
| `apps/cli/src/commands/config.ts` | Imports `readConfig`, `writeConfig`, `getConfigPath`, `NitroFueledConfig`; imports all 4 flow functions from `provider-flow.ts` |
| `apps/cli/src/commands/run.ts` | Imports `checkProviderConfig` (line 20, used at line 347) |

### Patterns Identified

- **Config path**: Currently `getConfigPath(cwd)` returns `resolve(cwd, '.nitro-fueled', 'config.json')` — project-relative. Must change to `~/.nitro-fueled/config.json` (user home).
- **Config read/write**: Atomic write via temp file + rename. Permission 0o600 for file, 0o700 for directory. This pattern is solid and should be preserved.
- **API key resolution**: `resolveApiKey()` expands `$ENV_VAR` references — reusable as-is for the new schema.
- **Connection testing**: `testGlmConnection()` is Anthropic-API-specific (uses `x-api-key` header + `anthropic-version`). The new schema calls this `apiType: "anthropic"`. This function should be generalized to `testProviderConnection()` that dispatches based on `apiType`.
- **Provider status**: `getProviderStatus()` hardcodes Claude as always connected, then checks GLM and OpenCode individually. Must be rewritten to iterate over `config.providers` dynamically.
- **Interactive flow**: Per-provider menus (`runGlmMenu`, `runGlmFirstTimeMenu`, `runOpenCodeMenu`, `runOpenCodeFirstTimeMenu`) are provider-specific. Must be replaced with a single unified flow.
- **Prompt utility**: `apps/cli/src/utils/prompt.ts` provides `prompt(question): Promise<string>` — reusable as-is.
- **Config validation**: `isValidConfig()` checks `value.providers` exists and is a record — needs update for new shape.
- **All callers pass `cwd = process.cwd()`**: The signature change from `cwd: string` to no-arg (or optional override) affects `readConfig`, `writeConfig`, `getConfigPath`, `checkProviderConfig`, and `getProviderStatus`.

### Key Design Decision: Config Location Change

The `cwd` parameter on `readConfig`/`writeConfig`/`getConfigPath`/`checkProviderConfig` currently resolves to `<project>/.nitro-fueled/config.json`. The new design moves to `~/.nitro-fueled/config.json` (user home). This means:
- `getConfigPath()` no longer needs a `cwd` parameter
- All callers (`config.ts`, `run.ts`, `provider-status.ts`, `provider-config.ts` internal) must stop passing `cwd`
- Existing project-level `.nitro-fueled/config.json` files should be migrated via the migration function

---

## Architecture Design

### Design Philosophy

**Direct replacement** — no backward compatibility layer. The old per-provider interfaces (`ClaudeProviderConfig`, `GlmProviderConfig`, `OpenCodeProviderConfig`, `ProvidersConfig`) are deleted entirely and replaced with a single unified `ProviderConfig` interface. A one-time migration function converts old schema to new on first read.

### Component Specifications

#### Component 1: New Type System (`provider-config.ts`)

**Purpose**: Define the unified provider config schema.
**Evidence**: Current types at `provider-config.ts:4-35`. Direct replacement.

**New types**:

```typescript
/** API protocol this provider speaks — determines which launcher handles it */
export type ApiType = 'anthropic' | 'openai';

export type AuthMethod = 'api-key' | 'oauth';

export interface ProviderAuth {
  method: AuthMethod;
  /** API key value or $ENV_VAR reference. Required when method is 'api-key'. */
  key?: string;
}

export interface ProviderModels {
  heavy: string;
  balanced: string;
  light: string;
}

export interface ProviderConfig {
  apiType: ApiType;
  enabled: boolean;
  auth: ProviderAuth;
  baseUrl?: string;
  models: ProviderModels;
}

export type RoutingTarget =
  | 'default'
  | 'complex-tasks'
  | 'review-logic'
  | 'review-style'
  | 'simple-tasks'
  | 'documentation';

export interface LauncherConfig {
  supports: ApiType[];
  binary: string;
}

export interface NitroFueledConfig {
  providers: Record<string, ProviderConfig>;
  routing: Record<RoutingTarget, string>;
  launchers: Record<string, LauncherConfig>;
}
```

**What gets deleted**:
- `ClaudeProviderConfig` (line 4-7)
- `GlmProviderConfig` (line 9-18)
- `OpenCodeProviderConfig` (line 20-25)
- `ProvidersConfig` (line 27-31)

**Files affected**:
- `apps/cli/src/utils/provider-config.ts` (REWRITE)

#### Component 2: Config Path Change (`provider-config.ts`)

**Purpose**: Move config from project-relative to user home directory.
**Evidence**: Current `getConfigPath(cwd)` at `provider-config.ts:37-39`.

**New implementation**:

```typescript
import { homedir } from 'node:os';

export function getConfigPath(): string {
  return resolve(homedir(), '.nitro-fueled', 'config.json');
}
```

**Signature change**: Remove `cwd` parameter from:
- `getConfigPath()` — no param needed
- `readConfig()` — no param needed
- `writeConfig(config)` — only takes config
- `checkProviderConfig()` — no param needed

**Callers that must update**:
- `apps/cli/src/commands/config.ts` — lines 74, 83, 99, 146, 184 (remove `cwd` args)
- `apps/cli/src/commands/run.ts` — line 347 (remove `cwd` arg)
- `apps/cli/src/utils/provider-status.ts` — line 25 (remove `cwd` arg)

**Files affected**:
- `apps/cli/src/utils/provider-config.ts` (REWRITE — part of same rewrite)
- `apps/cli/src/commands/config.ts` (MODIFY)
- `apps/cli/src/commands/run.ts` (MODIFY)
- `apps/cli/src/utils/provider-status.ts` (MODIFY)

#### Component 3: Migration Function (`provider-config.ts`)

**Purpose**: Detect old config shape and convert to new schema on first read.
**Evidence**: Old schema shape at `provider-config.ts:27-35`.

**Logic**:

```typescript
function migrateV1ToV2(old: Record<string, unknown>): NitroFueledConfig {
  // Detect old shape: old.providers has 'claude', 'glm', 'opencode' keys with old shapes
  // Convert:
  //   claude: { enabled, source } → anthropic: { apiType: 'anthropic', enabled, auth: { method: 'oauth' }, baseUrl: 'https://api.anthropic.com', models: defaults }
  //   glm: { enabled, apiKey, baseUrl, models: {opus,sonnet,haiku} } → zai: { apiType: 'anthropic', enabled, auth: { method: 'api-key', key: apiKey }, baseUrl, models: { heavy: opus, balanced: sonnet, light: haiku } }
  //   opencode: { enabled, authMethod, apiKey, defaultModel } → openai: { apiType: 'openai', enabled, auth: { method: authMethod, key: apiKey }, models: { heavy: defaultModel, balanced: defaultModel, light: defaultModel } }
  // Add default routing and launchers
  // Write migrated config back to disk
}
```

**Detection heuristic**: If `config.providers` contains keys named `claude` or `glm` or `opencode` AND lacks `apiType` on any provider entry, it is V1.

**Behavior**: `readConfig()` calls migration transparently. After migration, the old config is overwritten with the new shape. The caller always receives `NitroFueledConfig` in new format.

**Also handle project-level migration**: If `~/.nitro-fueled/config.json` does not exist but `<cwd>/.nitro-fueled/config.json` does, copy and migrate. This provides a one-time lift from project-level to user-level.

**Files affected**:
- `apps/cli/src/utils/provider-config.ts` (REWRITE — part of same rewrite)

#### Component 4: Connection Testing Generalization (`provider-config.ts`)

**Purpose**: Generalize `testGlmConnection` to work for any provider based on `apiType`.
**Evidence**: Current `testGlmConnection` at `provider-config.ts:149-187` uses Anthropic-specific headers.

**New function**:

```typescript
export async function testProviderConnection(provider: ProviderConfig): Promise<ConnectionTestResult> {
  // Resolve auth key
  // Based on apiType:
  //   'anthropic' → use current GLM test logic (x-api-key header, anthropic-version, /v1/models)
  //   'openai' → use Authorization: Bearer header, /v1/models endpoint
  // Return { ok, modelCount?, error? }
}
```

**What gets deleted**: `testGlmConnection` and `GlmTestResult` interface — replaced by `testProviderConnection` and `ConnectionTestResult`.

**Callers that must update**:
- `apps/cli/src/utils/provider-flow.ts` — lines 50, 180 (currently calls `testGlmConnection`)
- `apps/cli/src/utils/provider-status.ts` — line 40 (currently calls `testGlmConnection`)

**Files affected**:
- `apps/cli/src/utils/provider-config.ts` (REWRITE)
- `apps/cli/src/utils/provider-flow.ts` (REWRITE)
- `apps/cli/src/utils/provider-status.ts` (MODIFY)

#### Component 5: Unified Provider Wizard (`provider-flow.ts`)

**Purpose**: Replace 4 per-provider menu functions with a single unified flow.
**Evidence**: Current per-provider menus at `provider-flow.ts:35-251`.

**New exported functions**:

```typescript
/** Result of the provider add/edit wizard */
export type ProviderMenuResult =
  | { action: 'keep' }
  | { action: 'skip' }
  | { action: 'unload' }
  | { action: 'reconfigure'; name: string; config: ProviderConfig };

/** Known provider presets */
interface KnownProvider {
  label: string;
  name: string;         // key in config.providers
  apiType: ApiType;
  defaultBaseUrl?: string;
  defaultModels: ProviderModels;
  defaultAuthMethod: AuthMethod;
  defaultKeyEnvVar?: string;
}

const KNOWN_PROVIDERS: KnownProvider[] = [
  { label: 'Anthropic (Claude)', name: 'anthropic', apiType: 'anthropic', defaultBaseUrl: 'https://api.anthropic.com', defaultModels: { heavy: 'claude-opus-4-6', balanced: 'claude-sonnet-4-6', light: 'claude-haiku-4-5-20251001' }, defaultAuthMethod: 'api-key', defaultKeyEnvVar: '$ANTHROPIC_API_KEY' },
  { label: 'Z.AI (GLM)', name: 'zai', apiType: 'anthropic', defaultBaseUrl: 'https://api.z.ai/api/anthropic', defaultModels: { heavy: 'glm-5', balanced: 'glm-4.7', light: 'glm-4.5-air' }, defaultAuthMethod: 'api-key', defaultKeyEnvVar: '$ZAI_API_KEY' },
  { label: 'OpenAI', name: 'openai', apiType: 'openai', defaultModels: { heavy: 'gpt-4.1', balanced: 'gpt-4.1', light: 'gpt-4.1-mini' }, defaultAuthMethod: 'api-key', defaultKeyEnvVar: '$OPENAI_API_KEY' },
];

/** Main entry: add a new provider */
export async function runAddProviderWizard(): Promise<ProviderMenuResult>
// Shows numbered list: 1. Anthropic  2. Z.AI  3. OpenAI  4. Custom
// For 1-3: auto-fills apiType, baseUrl, models from KNOWN_PROVIDERS
// For 4 (Custom): asks apiType (Anthropic-compatible or OpenAI-compatible?), name, baseUrl, models
// Then asks: auth method, key, tests connection, asks "set as default?"

/** Menu for an existing provider */
export async function runProviderMenu(
  name: string,
  provider: ProviderConfig,
  status: ProviderStatus,
): Promise<ProviderMenuResult>
// Shows: [K]eep [R]econfigure [T]est [U]nload
// Reconfigure re-runs the config prompts with existing values as defaults
```

**What gets deleted**: All 4 current exported functions (`runGlmMenu`, `runGlmFirstTimeMenu`, `runOpenCodeMenu`, `runOpenCodeFirstTimeMenu`) and all internal helpers (`reconfigureGlm`, `reconfigureOpenCode`, `promptAuthMethod`, `promptApiKey`, `installOpenCode`).

**What gets adapted**: The `installOpenCode` function logic is no longer needed — launcher binary availability is a separate concern from provider configuration.

**Files affected**:
- `apps/cli/src/utils/provider-flow.ts` (REWRITE)

#### Component 6: Config Command Update (`config.ts`)

**Purpose**: Update the config command to use unified provider wizard.
**Evidence**: Current `runProvidersPhase` at `config.ts:93-163` hardcodes Claude/GLM/OpenCode flow.

**Changes**:

1. **`runProvidersPhase`**: Rewrite to:
   - Read config, show status table for all configured providers
   - For each existing provider: call `runProviderMenu()`
   - Offer "Add a provider?" → call `runAddProviderWizard()`
   - Loop until user says done
   - Save config

2. **`runUnloadMode`**: Update to work with dynamic provider names (remove `UNLOADABLE_PROVIDERS` whitelist — any provider except one that's the sole default can be unloaded).

3. **Remove `cwd` passing**: All `readConfig(cwd)`, `writeConfig(cwd, ...)`, `getConfigPath(cwd)` calls drop the `cwd` arg.

4. **Import updates**: Replace 4 flow function imports with 2 new ones (`runAddProviderWizard`, `runProviderMenu`). Remove `NitroFueledConfig` type import (used at line 100 — replace with new type).

**Files affected**:
- `apps/cli/src/commands/config.ts` (REWRITE)

#### Component 7: Provider Status Update (`provider-status.ts`)

**Purpose**: Rewrite status to iterate dynamically over all providers.
**Evidence**: Current hardcoded provider iteration at `provider-status.ts:24-73`.

**Changes**:

```typescript
export async function getProviderStatus(): Promise<ProviderStatusResult[]> {
  const config = readConfig();
  if (config === null) return [];

  const results: ProviderStatusResult[] = [];
  for (const [name, provider] of Object.entries(config.providers)) {
    if (!provider.enabled) {
      results.push({ name, status: 'not configured' });
      continue;
    }
    if (provider.auth.method === 'oauth') {
      // OAuth providers: check for auth file or assume connected
      results.push({ name, status: 'connected', detail: 'oauth' });
      continue;
    }
    // API key providers: resolve key, optionally test connection
    const test = await testProviderConnection(provider);
    results.push({ name, status: test.ok ? 'connected' : 'failed', detail: test.ok ? test.modelCount + ' models' : test.error });
  }
  return results;
}
```

**Signature change**: Remove `cwd` parameter.

**Callers that must update**:
- `apps/cli/src/commands/config.ts` — lines 45, 55, 96 (remove `cwd` arg)

**Files affected**:
- `apps/cli/src/utils/provider-status.ts` (REWRITE)

#### Component 8: Pre-flight Check Update (`provider-config.ts` — `checkProviderConfig`)

**Purpose**: Generalize pre-flight validation to iterate all providers.
**Evidence**: Current hardcoded GLM + OpenCode checks at `provider-config.ts:118-141`.

**New logic**:

```typescript
export function checkProviderConfig(): ProviderConfigIssue[] {
  const config = readConfig();
  if (config === null) return [];

  const issues: ProviderConfigIssue[] = [];
  for (const [name, provider] of Object.entries(config.providers)) {
    if (!provider.enabled) continue;
    if (provider.auth.method === 'api-key') {
      const key = resolveApiKey(provider.auth.key ?? '');
      if (key === '') {
        issues.push({ provider: name, message: `API key is empty (run 'npx nitro-fueled config')` });
      }
    }
  }
  return issues;
}
```

**Signature change**: Remove `cwd` parameter.

**Files affected**:
- `apps/cli/src/utils/provider-config.ts` (REWRITE — part of same rewrite)
- `apps/cli/src/commands/run.ts` (MODIFY — remove `cwd` arg at line 347)

#### Component 9: Default Routing and Launchers

**Purpose**: Provide sensible defaults when config is first created.

**Default routing** (applied during migration and new config creation):
```json
{
  "default": "<first enabled provider>",
  "complex-tasks": "<first enabled provider>",
  "review-logic": "<first enabled provider>",
  "review-style": "<first enabled provider>",
  "simple-tasks": "<first enabled provider>",
  "documentation": "<first enabled provider>"
}
```

**Default launchers** (system-defined, always present):
```json
{
  "claude-code": { "supports": ["anthropic"], "binary": "claude" },
  "opencode": { "supports": ["openai"], "binary": "opencode" }
}
```

The `launchers` section is NOT user-editable via the wizard. It is written automatically and documents what launchers exist. It could be extended later for custom launchers.

**Files affected**:
- `apps/cli/src/utils/provider-config.ts` (REWRITE — constants + migration logic)

---

## Integration Architecture

### Data Flow

```
User runs `npx nitro-fueled config`
  → config.ts reads config via readConfig() (no cwd)
  → readConfig() checks ~/.nitro-fueled/config.json
  → If old format detected → migrateV1ToV2() → writes new format back
  → config.ts shows provider status table via getProviderStatus()
  → For each provider: runProviderMenu() → returns action
  → User adds provider: runAddProviderWizard() → returns name + ProviderConfig
  → config.ts saves via writeConfig(config)

User runs `npx nitro-fueled run`
  → run.ts calls checkProviderConfig() (no cwd)
  → Iterates all enabled providers, validates auth keys
  → Returns issues[] — run.ts fails fast if non-empty
```

### File Change Summary

| File | Action | Scope |
|------|--------|-------|
| `apps/cli/src/utils/provider-config.ts` | REWRITE | New types, config path (homedir), migration, generalized connection test, generalized pre-flight |
| `apps/cli/src/utils/provider-flow.ts` | REWRITE | Unified wizard replacing 4 per-provider menus |
| `apps/cli/src/utils/provider-status.ts` | REWRITE | Dynamic provider iteration replacing hardcoded checks |
| `apps/cli/src/commands/config.ts` | REWRITE | New wizard orchestration, remove cwd passing |
| `apps/cli/src/commands/run.ts` | MODIFY | Remove `cwd` arg from `checkProviderConfig(cwd)` at line 347 |

---

## Quality Requirements

### Non-Functional Requirements
- **Security**: API keys stored with 0o600 permissions (preserved from current). Environment variable references (`$VAR`) preferred over raw keys.
- **Atomicity**: Write-via-temp-file-then-rename pattern preserved from current implementation.
- **Migration safety**: Migration writes new format atomically. If migration fails mid-way, the old file is untouched (temp file pattern).
- **Idempotency**: Running migration on already-migrated config is a no-op (detection heuristic must be reliable).

### Functional Requirements
- Old configs (V1) are auto-migrated on first `readConfig()` call
- Project-level configs (`<cwd>/.nitro-fueled/config.json`) are migrated to user-level on first read if user-level does not exist
- All providers are equal peers — no special-casing of Claude, GLM, or OpenCode in the core config/read/write logic
- Known provider presets auto-fill defaults but are NOT hardcoded in the config layer — only in the wizard layer
- `routing` section defaults are set during config creation; editing routing is out of scope for this task (future Part 2/3)

### Testing Notes
- Task metadata specifies `Testing: skip`
- Manual verification: create old-format config, run `npx nitro-fueled config`, confirm migration + wizard works

---

## Team-Leader Handoff

### Developer Type Recommendation
**Recommended Developer**: nitro-backend-developer
**Rationale**: Pure Node.js/TypeScript CLI work — file I/O, JSON schema, interactive prompts. No frontend.

### Complexity Assessment
**Complexity**: MEDIUM
**Estimated Effort**: 4-6 hours

### Files Affected Summary

**REWRITE** (Direct Replacement):
- `apps/cli/src/utils/provider-config.ts`
- `apps/cli/src/utils/provider-flow.ts`
- `apps/cli/src/utils/provider-status.ts`
- `apps/cli/src/commands/config.ts`

**MODIFY** (Targeted Changes):
- `apps/cli/src/commands/run.ts` (1 line — remove `cwd` arg)

### Architecture Delivery Checklist
- [x] All components specified with evidence
- [x] All patterns verified from codebase
- [x] All imports/classes verified as existing
- [x] Quality requirements defined
- [x] Integration points documented
- [x] Files affected list complete
- [x] Developer type recommended
- [x] Complexity assessed
- [x] No step-by-step implementation (that's nitro-team-leader's job)
