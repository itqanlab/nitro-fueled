# Development Tasks - TASK_2026_198

**Total Tasks**: 3 | **Batches**: 1 | **Status**: 0/1 complete

---

## Batch 1: Provider Validation Implementation - PENDING

**Developer**: nitro-systems-developer
**Tasks**: 3 | **Dependencies**: None

### Task 1.1: Add provider availability parsing logic

**File**: .claude/skills/auto-pilot/SKILL.md
**Description**: After calling `get_available_providers`, parse the output to extract a list of AVAILABLE providers. The output format shows providers with "AVAILABLE" or "UNAVAILABLE" status. Extract only the available ones into a list for validation.
**Status**: PENDING

### Task 1.2: Add build_provider validation

**File**: .claude/skills/auto-pilot/SKILL.md
**Description**: Before assigning `build_provider` in session config, validate that the provider (from `config.routing.build` or default) is in the AVAILABLE list. If not available:
1. Log warning: `"WARNING: build_provider {name} is not available"`
2. Find next available provider from `config.fallbackChain` (if defined)
3. Assign fallback provider to `build_provider`
4. If no available provider in fallback chain, stop session creation with error: `"ERROR: No available provider for build role. Available providers: {list}"`
**Status**: PENDING

### Task 1.3: Add review_provider validation

**File**: .claude/skills/auto-pilot/SKILL.md
**Description**: Apply the same validation logic as Task 1.2 to the `review_provider` (from `config.routing.review`). Validate against AVAILABLE list, apply fallback chain if needed, and block session creation with clear error if no provider available.
**Status**: PENDING
