# Task: Provider Config UX — State Display, Per-Provider Test and Unload

## Metadata

| Field      | Value       |
|------------|-------------|
| Type       | BUGFIX      |
| Priority   | P1-High     |
| Complexity | Simple      |
| Model      | default     |
| Provider   | default     |
| Testing    | skip        |

## Description

The `nitro-fueled config` command has three UX gaps that make it confusing to use:

1. **No state shown on entry.** When a user re-runs `config --providers`, they see prompts before knowing what is already configured. There is no "here is your current state" screen.

2. **No per-provider test or unload.** The only way to test a live connection is `--check` (read-only mode). The only way to remove a provider is `--reset` which removes the entire config. There is no way to say "test just GLM" or "unload GLM but keep OpenCode."

3. **Re-entering always overwrites with prompts.** If the user added GLM and wants to re-run config, they must re-enter the key or lose it. There is no "keep existing / reconfigure / test / unload" menu per provider.

## Acceptance Criteria

- [ ] Running `nitro-fueled config --providers` shows current provider state BEFORE any prompts
- [ ] Current state shows: connected/failed/not configured for each provider, with live connection test for GLM
- [ ] User is shown a per-provider menu: `[K]eep / [R]econfigure / [T]est / [U]nload / [S]kip`
- [ ] `[T]est` reruns the connection test and shows result without changing config
- [ ] `[U]nload` removes that provider from config (sets `enabled: false` or removes the key entirely)
- [ ] `[K]eep` skips without changes (default if user presses Enter)
- [ ] `[R]econfigure` runs the existing configure flow for that provider
- [ ] New flag: `--test` tests all configured provider connections and exits (equivalent to `--check` provider section only, faster)
- [ ] New flag: `--unload <provider>` removes a single provider non-interactively (`--unload glm`, `--unload opencode`)
- [ ] `--reset` still removes everything (unchanged)

## UX Flow

```
nitro-fueled config --providers

Provider Status
───────────────
  Claude     ✓ connected (subscription)
  GLM        ✗ failed (HTTP 401 — check API key)
  OpenCode   - not configured

Configure each provider:

  GLM (currently: failed)
  [K]eep  [R]econfigure  [T]est  [U]nload  (Enter = keep): r

  ? Z.AI API key [keep existing]: sk-...
  ✓ Testing connection... OK (glm-5 available)
  ✓ GLM reconfigured

  OpenCode (currently: not configured)
  [K]eep  [S]kip  [C]onfigure  (Enter = skip):
  ↳ (skipped)

Config saved to .nitro-fueled/config.json
```

## File Scope

- `packages/cli/src/commands/config.ts`
- `packages/cli/src/utils/provider-config.ts` (if new helpers needed)

## Parallelism

Can run in parallel with any other task. No dependencies.
Wave: independent.
