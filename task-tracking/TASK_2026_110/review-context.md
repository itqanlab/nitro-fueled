# Review Context — TASK_2026_110

## Task Scope
- Task ID: 2026_110
- Task type: FEATURE
- Files in scope: [these are the ONLY files reviewers may touch]
  - apps/cli/src/utils/provider-config.ts (rewritten: new schema with launchers/providers/routing, global config path, merge logic, migration)
  - apps/cli/src/commands/config.ts (rewritten: detection-first wizard, removed per-provider menus)
  - apps/cli/src/utils/provider-flow.ts (rewritten: launcher detection for claude/opencode/codex, routing assignment prompts)
  - apps/cli/src/utils/provider-status.ts (rewritten: reads from launchers section instead of per-provider auth)

## Git Diff Summary
Implementation commit: `d3afd44 feat(cli): launcher-aware config schema + provider resolver engine (TASK_2026_110)`

### apps/cli/src/utils/provider-config.ts (397 lines)
- Complete rewrite of config schema: old `ProvidersConfig` with per-provider (claude/glm/opencode) replaced with `LaunchersConfig` + `ProviderEntry` + `RoutingConfig`
- New types: `LauncherName`, `AuthMethod`, `LauncherInfo`, `ModelTier`, `RoutingSlot`, `NitroFueledConfig`
- `DEFAULT_PROVIDERS` (4 entries: anthropic, zai, openai-opencode, openai-codex) and `DEFAULT_ROUTING` constants added
- `getGlobalConfigPath()` returns `~/.nitro-fueled/config.json`; `getProjectConfigPath(cwd)` returns `{cwd}/.nitro-fueled/config.json`
- `getConfigPath(cwd)` deprecated but kept for backward-compat
- `readConfig(cwd)` now merges global + project (project wins)
- `readGlobalConfig()` reads global only
- `writeConfig(config)` writes to global path (no longer takes `cwd`)
- `isOldFormatConfig()` type guard for migration detection
- `migrateOldConfig()` renames old project config to `.migrated`, writes new global config
- `parseConfigFile()` helper extracted from `readConfig`
- `checkProviderConfig()` rewritten: validates routing slots have working launchers
- `getAvailableProviders()` new utility
- `checkProviderConfig()` removed (old per-provider API key checks) and reimplemented (launcher validation)

### apps/cli/src/commands/config.ts (169 lines)
- `runProvidersPhase()` replaced with `runDetectionWizard()`
- `runUnloadMode()` now deletes from `config.routing` and `config.providers`, calls `writeConfig(config)` (no cwd)
- `runCheckMode()` now reads from `launchers` section, calls `readConfig(cwd) ?? readGlobalConfig()`
- Old `--providers` flag removed; `DEP_NAMES`, `runDependencyChecks`, `ensureGitignore` imports removed
- Imports updated: `readGlobalConfig`, `getGlobalConfigPath`, `DEFAULT_ROUTING` added

### apps/cli/src/utils/provider-flow.ts (344 lines)
- Entirely rewritten: old per-provider menus (GLM/OpenCode) replaced with launcher detection + routing assignment
- `detectClaude()`: `which claude` + `claude auth status` (or `claude status` fallback)
- `detectOpenCode()`: `which opencode` + `opencode auth list` parsing; also checks `ZAI_API_KEY` env var
- `detectCodex()`: `which codex` + reads `~/.codex/auth.json` for `auth_mode`; also checks `OPENAI_API_KEY`
- `detectLaunchers()`: calls all three, prints results
- `deriveAvailableProviders()`: maps launcher detection to available providers from `DEFAULT_PROVIDERS`
- `printDerivedTiers()`: shows derived tier → model → provider table
- `promptRoutingAssignment()`: iterates `ROUTING_SLOTS`, prompts with defaults
- `buildConfig()`: assembles final `NitroFueledConfig`

### apps/cli/src/utils/provider-status.ts (67 lines)
- Rewritten to read from `launchers` section instead of running live connection tests
- No more `testGlmConnection` call
- Shows `connected/failed/not configured` status derived from stored launcher state
- Updated `printProviderStatusTable` label: "Launcher Status"

## Project Conventions
From CLAUDE.md:
- Git: conventional commits with scopes
- TypeScript is the primary language for CLI apps
- CLI package lives in `apps/cli/`
- No agent-specific conventions apply here (TypeScript utility files)

From review-lessons (TypeScript):
- **No `any` type** — use `unknown` + type guards
- **No `as` type assertions** — use type guards or generics
- **Explicit access modifiers on ALL class members**
- **String literal unions for status/type/category fields**
- **File size limits**: services/utilities max 200 lines
- **Never swallow errors** — no empty catch blocks
- **No unused imports or dead code**
- **`tsconfig.json` must not disable `noImplicitAny` or `strictNullChecks`**

## Style Decisions from Review Lessons
Relevant to TypeScript CLI utilities:
- No `any` type: use `unknown` + type guards (multiple `isRecord` type guard functions present)
- No `as` assertions: code uses `as { providers: OldProviders }` in migrateOldConfig — potential violation
- String literal unions: `LauncherName`, `AuthMethod`, `ModelTier`, `RoutingSlot` are unions ✓
- Empty catch blocks: `migrateOldConfig` has `} catch { /* If rename fails, just continue */ }` — potential violation (missing log)
- File size limits: `provider-config.ts` (397 lines) and `provider-flow.ts` (344 lines) exceed the 200-line service limit
- Falsy checks that skip zero values: check `!== undefined` patterns
- No unused imports/dead code

## Findings Summary
- Blocking: 4
- Serious: 10
- Minor: 6

## Scope Boundary (CRITICAL)
Reviewers MUST only flag and fix issues in these files:
- apps/cli/src/utils/provider-config.ts
- apps/cli/src/commands/config.ts
- apps/cli/src/utils/provider-flow.ts
- apps/cli/src/utils/provider-status.ts

Issues found outside this scope: document only, do NOT fix.
