# Task: OpenCode Provider — Subscription/OAuth Auth Support

## Metadata

| Field      | Value       |
|------------|-------------|
| Type       | FEATURE     |
| Priority   | P2-Medium   |
| Complexity | Simple      |
| Model      | default     |
| Testing    | optional    |

## Description

The current `OpenCodeProviderConfig` assumes an API key is always required to use the OpenCode provider. This is incorrect — OpenCode v1.1.11+ supports OAuth authentication for ChatGPT Plus/Pro subscribers, which does not require an API key at all. Users authenticate once via `opencode auth login` (browser OAuth) and credentials are stored in `~/.local/share/opencode/auth.json`.

Update the config type, the wizard flow, and the pre-flight validator to support both auth methods. Scope is limited to the OpenAI/ChatGPT Plus subscription path only — other OpenCode providers are out of scope.

### Changes Required

**`packages/cli/src/utils/provider-config.ts`**
- Add `authMethod: 'api-key' | 'subscription'` to `OpenCodeProviderConfig`
- Make `apiKey` optional (`apiKey?: string`) — only present when `authMethod === 'api-key'`
- Update `checkProviderConfig` to skip the API key check when `authMethod === 'subscription'`

**`packages/cli/src/commands/config.ts`**
- In `configureOpenCodeProvider`, ask for auth method first:
  ```
  ? OpenCode auth method:
    > ChatGPT Plus/Pro subscription (OAuth)
      API key
  ```
- If subscription: skip API key prompt, print reminder: `Run: opencode auth login` (once)
- If API key: existing flow unchanged

## Dependencies

- None

## Acceptance Criteria

- [ ] `OpenCodeProviderConfig` has `authMethod: 'api-key' | 'subscription'` and `apiKey` is optional
- [ ] Config wizard asks for auth method before prompting for an API key
- [ ] Selecting "subscription" skips the key prompt and prints `opencode auth login` reminder
- [ ] Selecting "api-key" follows the existing prompt flow unchanged
- [ ] Pre-flight validation (`checkProviderConfig`) does not report a missing key when `authMethod === 'subscription'`
- [ ] Existing configs without `authMethod` field continue to work (backwards compatible read)

## References

- `packages/cli/src/utils/provider-config.ts` — type definitions and validation
- `packages/cli/src/commands/config.ts` — wizard flow
- OpenCode docs: subscription auth added in v1.1.11 via `opencode auth login` → OpenAI → "ChatGPT Plus/Pro"

## File Scope

- `packages/cli/src/utils/provider-config.ts`
- `packages/cli/src/commands/config.ts`

## Parallelism

✅ Can run in parallel

No CREATED tasks touch `provider-config.ts` or `commands/config.ts`. Safe to run alongside any current backlog task.
