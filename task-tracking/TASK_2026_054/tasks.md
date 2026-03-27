# Development Tasks - TASK_2026_054

## Batch 1: OpenCode OAuth Auth Support - COMPLETE

**Developer**: nitro-backend-developer

### Task 1.1: Update OpenCodeProviderConfig type

**File**: packages/cli/src/utils/provider-config.ts
**Status**: COMPLETE

- Added `authMethod?: 'api-key' | 'subscription'` to `OpenCodeProviderConfig`
- Made `apiKey` optional (`apiKey?: string`)
- Updated `checkProviderConfig` to skip the API key check when `authMethod === 'subscription'`
- Guarded `resolveApiKey` call with `?? ''` fallback for optional `apiKey`

### Task 1.2: Update configureOpenCodeProvider wizard

**File**: packages/cli/src/utils/provider-flow.ts
**Status**: COMPLETE

- Updated `reconfigureOpenCode` to prompt for auth method before the API key
- Subscription choice skips the key prompt and prints: `Run: opencode auth login`
- API key choice follows the existing prompt flow unchanged
- Backwards compatible: configs without `authMethod` default to `'api-key'`

### Task 1.3: Fix provider-status.ts for subscription auth

**File**: packages/cli/src/utils/provider-status.ts
**Status**: COMPLETE

- Updated OpenCode status check to treat `authMethod === 'subscription'` as connected without requiring a key
- Falls back to key-presence check for `'api-key'` auth (existing behaviour)
