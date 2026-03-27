# Logic Review — TASK_2026_054

## Score: 6/10

## Summary

| Metric              | Value                                     |
|---------------------|-------------------------------------------|
| Overall Score       | 6/10                                      |
| Assessment          | NEEDS_REVISION                            |
| Critical Issues     | 1                                         |
| Serious Issues      | 2                                         |
| Moderate Issues     | 1                                         |
| Failure Modes Found | 4                                         |

All six acceptance criteria pass on the happy path. The type definition, wizard flow, and
pre-flight check are correctly implemented. The critical failure is in `provider-status.ts`:
subscription auth is reported as `connected` without any verification that the user has
actually completed `opencode auth login`. The remaining issues are UX gaps and misleading
prompts.

---

## The 5 Paranoid Questions

### 1. How does this fail silently?

`provider-status.ts` line 51-52 reports `status: 'connected'` for any OpenCode config
where `authMethod === 'subscription'`. No check is made for the existence of
`~/.local/share/opencode/auth.json` or any other auth artifact. A user who ran the config
wizard, chose "subscription", but never executed `opencode auth login` will see:

```
✓ OpenCode     connected (openai/gpt-4.1-mini) (subscription)
```

This is a false positive. The first time they try to use OpenCode it will fail with an
auth error, but the status dashboard said everything was fine.

### 2. What user action causes unexpected behavior?

On first-time configuration (`existing` is `undefined`), the auth method prompt shows:

```
? OpenCode auth method [api-key]:
  1) ChatGPT Plus/Pro subscription (OAuth)
  2) API key
Choice (Enter = keep current):
```

Pressing Enter on a first-time config silently selects `api-key` even though there is
nothing to "keep". The phrase "Enter = keep current" implies a prior selection exists.
A new user may press Enter expecting to be asked again or to be told there is no current
value. Instead they silently proceed down the API key path. This is a UX mismatch between
the prompt text and the actual state.

### 3. What data makes this produce wrong results?

A config file written by this task with `authMethod: 'subscription'` and no `apiKey` field
will cause `provider-status.ts` to unconditionally return `connected`. If the OAuth session
later expires or is revoked (e.g., user logs out of ChatGPT), the status table still shows
`connected` because there is no live verification for subscription auth. The system has no
mechanism to detect stale OAuth credentials.

### 4. What happens when dependencies fail?

The `installOpenCode()` path in `provider-flow.ts` (line 182) uses `spawnSync` with
`stdio: 'inherit'`. If `npm i -g opencode` fails with a non-zero exit code, the function
returns `false` and `reconfigureOpenCode` returns `null`, which causes the calling menu to
fall back to `{ action: 'keep' }`. This is safe for an already-configured provider but for
a first-time menu it returns `{ action: 'skip' }`. The result is correct but the user sees
no explicit "skipped" message from the menu — the install failure message from
`installOpenCode` is the last thing printed. Acceptable but not ideal.

### 5. What's missing that the requirements didn't mention?

- No validation that `opencode auth login` has been completed before saving a subscription
  config (or at minimum a check that `~/.local/share/opencode/auth.json` exists).
- No live status verification for subscription auth in `provider-status.ts`. GLM does a
  live connection test; OpenCode subscription does nothing.
- No `[T]est` option in the `runOpenCodeMenu` for testing the current OpenCode session
  (pre-existing gap, but now more significant since subscription auth cannot be validated
  by key presence alone).

---

## Failure Mode Analysis

### Failure Mode 1: False-Positive "connected" Status for Subscription Auth

- **Trigger**: User chooses subscription auth during config but never runs
  `opencode auth login`, or runs it but later the session expires.
- **Symptoms**: `provider-status.ts` returns `{ status: 'connected' }` — the status
  dashboard shows a green checkmark. Runtime calls to OpenCode fail with auth errors.
- **Impact**: User believes the system is ready to run; a task or session starts, hits
  OpenCode, and fails mid-execution with a cryptic error. Data loss risk if the task was
  partially written.
- **Current Handling**: None. Line 51 of `provider-status.ts` returns `connected`
  unconditionally for subscription auth.
- **Recommendation**: At minimum, check `existsSync(os.homedir() + '/.local/share/opencode/auth.json')`.
  If absent, return `{ status: 'failed', detail: 'run opencode auth login' }`.

### Failure Mode 2: First-Time Config Silently Selects "api-key" on Enter

- **Trigger**: User configures OpenCode for the first time and presses Enter at the auth
  method prompt, intending to review options or select later.
- **Symptoms**: The wizard proceeds to the API key prompt. User is confused about why they
  are being asked for a key when they wanted subscription auth. If they enter nothing for
  the key either, they end up with a broken `api-key` config containing only
  `$OPENAI_API_KEY`.
- **Impact**: Misconfigured provider that fails at runtime; user frustration.
- **Current Handling**: `existingAuthMethod` defaults to `'api-key'` when `existing` is
  undefined (line 200). Empty answer falls through to `authMethod = existingAuthMethod`
  (line 215), so `api-key` is silently selected.
- **Recommendation**: When `existing` is `undefined`, change the prompt hint from
  `[api-key]` to `[no current]` and treat empty input as requiring an explicit selection,
  or default to `subscription` (the more common use case for this feature), or show a
  mandatory choice prompt that does not accept empty input on first config.

### Failure Mode 3: Stale OAuth Session Undetectable

- **Trigger**: User configured subscription auth, ran `opencode auth login` successfully,
  later the OAuth token expires or is revoked (ChatGPT session logout, token rotation).
- **Symptoms**: `provider-status.ts` continues to show `connected`. All downstream
  orchestration that uses OpenCode fails silently at the point of invocation.
- **Impact**: Long-running autonomous sessions (auto-pilot) may run many tasks before
  anyone notices OpenCode calls are failing.
- **Current Handling**: No session validation at status check time. Once `authMethod` is
  `subscription`, the status is permanently `connected` until manually reconfigured.
- **Recommendation**: Run `opencode auth status` (if that CLI command exists) or check the
  auth JSON file modification time as a proxy for freshness.

### Failure Mode 4: Empty-Enter on API Key Prompt Stores Env Var Reference Silently

- **Trigger**: `authMethod === 'api-key'`, user presses Enter at the key prompt with no
  existing config.
- **Symptoms**: Config stores `apiKey: '$OPENAI_API_KEY'`. At runtime, if the env var is
  not set, `resolveApiKey` returns `''`. Pre-flight catches this, but only if the user
  runs the pre-flight check. The wizard itself prints a warning ("API key is empty or env
  var unset") but does not block save.
- **Impact**: Provider is configured in a way that will fail until the env var is set.
  The warning is easily missed in CLI output.
- **Current Handling**: Line 241-242 of `provider-flow.ts` prints a warning. This is
  adequate but the warning could be more prominent (e.g., colored output or explicit
  "Configuration saved with unresolved credentials — provider will not work until
  OPENAI_API_KEY is set").
- **Severity**: LOW — pre-flight validation (`checkProviderConfig`) catches this before
  any task runs.

---

## Acceptance Criteria Verification

| Requirement | Status | Notes |
|---|---|---|
| `authMethod: 'api-key' | 'subscription'` on `OpenCodeProviderConfig` | COMPLETE | Field is optional (`authMethod?`), correct for backwards compat |
| `apiKey` is optional | COMPLETE | `apiKey?: string` at line 23 |
| Config wizard asks auth method before API key prompt | COMPLETE | Lines 204-216 precede key prompt at line 235 |
| Subscription: skip key prompt, print `opencode auth login` | COMPLETE | Lines 226-229 return early with reminder |
| API key: existing flow unchanged | COMPLETE | Lines 232-247 |
| Pre-flight skips key check for subscription | COMPLETE | Line 133: `opencode.authMethod !== 'subscription'` |
| Old configs without `authMethod` work | COMPLETE | `undefined !== 'subscription'` is `true`; falls to API key check as before |

All six acceptance criteria pass. The issues found are gaps not covered by the stated
requirements.

---

## Critical Issues

### Issue 1: False-Positive "connected" Status for Unverified Subscription Auth

- **File**: `packages/cli/src/utils/provider-status.ts:51-52`
- **Scenario**: Any OpenCode config with `authMethod === 'subscription'` — regardless of
  whether `opencode auth login` has been run.
- **Impact**: Status dashboard permanently shows `connected` for subscription auth. Users
  who have not completed OAuth setup believe the provider is ready. Autonomous sessions
  that depend on OpenCode will fail mid-run.
- **Evidence**:
  ```typescript
  if (opencode.authMethod === 'subscription') {
    results.push({ name: 'OpenCode', status: 'connected', detail: `${opencode.defaultModel} (subscription)` });
  }
  ```
  No filesystem check, no CLI invocation, no auth artifact verification.
- **Fix**: Check for `~/.local/share/opencode/auth.json` existence before reporting
  `connected`. If absent, return `{ status: 'failed', detail: 'run: opencode auth login' }`.

---

## Serious Issues

### Issue 2: Misleading "Enter = keep current" Prompt on First-Time Configuration

- **File**: `packages/cli/src/utils/provider-flow.ts:207`
- **Scenario**: `existing` is `undefined` (first-time OpenCode configuration).
- **Impact**: User pressing Enter silently commits to `api-key` mode. Users who intended
  to choose subscription and pressed Enter thinking it was a "show me options" action will
  be confused when immediately asked for an API key.
- **Evidence**:
  ```typescript
  const existingAuthMethod = existing?.authMethod ?? 'api-key';
  // ...
  const authAnswer = await prompt('  Choice (Enter = keep current): ');
  // empty answer → authMethod = existingAuthMethod = 'api-key'
  ```
- **Fix**: When `existing` is `undefined`, use a different prompt: `'  Choice (1 or 2, required): '`
  and loop until a valid choice is entered, OR change the hint to `[default: api-key]` to
  make the implicit selection explicit.

### Issue 3: No Detection of Stale Subscription OAuth Session

- **File**: `packages/cli/src/utils/provider-status.ts:51-52`
- **Scenario**: OAuth token expires after initial successful setup.
- **Impact**: All downstream OpenCode usage fails silently while the status dashboard
  permanently shows green. No recovery prompt is offered.
- **Evidence**: There is no mechanism anywhere in the codebase to detect token expiry for
  subscription auth. Once the `authMethod` field is set, it is trusted forever.
- **Fix**: At minimum, document the known limitation in the status output:
  `detail: '${opencode.defaultModel} (subscription — not verified)'`. Ideally, check the
  auth JSON file or invoke `opencode auth status`.

---

## Moderate Issues

### Issue 4: Model Prompt Accepts Invalid Format With Only a Warning

- **File**: `packages/cli/src/utils/provider-flow.ts:222-224`
- **Scenario**: User enters a model name not matching `provider/model` format (e.g., just
  `gpt-4`).
- **Impact**: Config is saved with a model name that may fail at runtime when OpenCode
  tries to resolve it. The warning is easy to miss in CLI output.
- **Evidence**:
  ```typescript
  if (!MODEL_FORMAT_RE.test(modelAnswer)) {
    console.log(`  Warning: "${modelAnswer}" does not match...`);
  }
  ```
  No prompt to correct or confirm. Applies to both subscription and api-key paths.
- **Fix**: Re-prompt with confirmation: `'  This may cause runtime errors. Continue? (y/N)'`.
  If user says no, loop back to the model prompt.

---

## Edge Case Analysis

| Edge Case | Handled | How | Concern |
|---|---|---|---|
| Old config, no `authMethod` field | YES | `undefined !== 'subscription'` → API key check | None |
| Old config, `authMethod` absent, key present | YES | Resolves key normally | None |
| Subscription config, no auth.json on disk | NO | Returns `connected` unconditionally | CRITICAL |
| First-time config, Enter at auth prompt | PARTIAL | Defaults to `api-key` silently | SERIOUS — prompt text lies |
| Empty string for model on first config | YES | Falls back to `defaultModel ?? 'openai/gpt-4.1-mini'` | None |
| Invalid model format | PARTIAL | Warning printed, saves anyway | MODERATE |
| opencode binary not found, install fails | YES | Returns `null` → `action: 'skip'` | None |
| Subscription then reconfigure to api-key | YES | `existingAuthMethod` reads current value, updates correctly | None |

---

## Data Flow Analysis

```
User selects auth method in wizard
  └─ reconfigureOpenCode()
       ├─ subscription → { enabled, authMethod: 'subscription', defaultModel } (no apiKey)
       │    └─ written to config.json via writeConfig()
       └─ api-key → { enabled, authMethod: 'api-key', apiKey, defaultModel }
            └─ written to config.json via writeConfig()

Later: getProviderStatus(cwd)
  └─ readConfig(cwd)
       └─ opencode.authMethod === 'subscription'?
            ├─ YES → status: 'connected'  ← NO VERIFICATION HERE [GAP]
            └─ NO  → resolveApiKey(opencode.apiKey ?? '') !== ''
                 ├─ true  → status: 'connected'
                 └─ false → status: 'failed', detail: 'API key unset'

Later: checkProviderConfig(cwd)
  └─ opencode.authMethod !== 'subscription'?
       ├─ true  → check key (same resolve logic)
       └─ false → skip (correct for subscription)
```

Gap points:
1. Subscription auth path in `getProviderStatus` has zero verification — always returns
   `connected` once `authMethod === 'subscription'` is stored.
2. No cross-check between `authMethod === 'subscription'` and actual OAuth credential
   files at any point in the system.

---

## What Robust Implementation Would Include

1. **Auth artifact check in `getProviderStatus`**: Before reporting `connected` for
   subscription auth, verify `~/.local/share/opencode/auth.json` exists and is non-empty.
   Report `failed` with a specific message if absent.

2. **Mandatory choice on first-time auth method prompt**: When `existing` is `undefined`,
   require an explicit `1` or `2` input. Do not silently default to `api-key` behind a
   misleading "keep current" prompt.

3. **Token freshness check**: Either invoke `opencode auth status` (if it exists) or check
   the mtime of `auth.json` against a configurable TTL and warn when the session may be
   stale.

4. **Post-subscription-config verification step**: After the user chooses subscription and
   before saving, check if `auth.json` already exists. If it does, confirm it. If it does
   not, make the `opencode auth login` reminder more prominent and optionally offer to run
   it interactively.
