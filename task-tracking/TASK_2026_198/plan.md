# Implementation Plan — TASK_2026_198

## Overview

Fix provider availability validation in auto-pilot supervisor. Currently, the supervisor creates session configs with providers that may not be available (e.g., `review_provider: "openai-opencode"` when `get_available_providers` returns only `anthropic` and `zai` as AVAILABLE).

## Root Cause

In `.claude/skills/auto-pilot/SKILL.md`, the supervisor calls `get_available_providers` to check available providers, but does NOT validate that the providers specified in the user's routing configuration (`config.routing`) are actually in the AVAILABLE list before creating session configs.

## Solution

Add validation logic after `get_available_providers` call:

1. **Validate provider availability**: Check if `build_provider` and `review_provider` (from routing config) are in the AVAILABLE list
2. **Warning + fallback**: If a provider is not available, log warning and fall back to next available provider from the fallback chain
3. **Hard fail**: If no provider is available for a role, block session creation with clear error

## Implementation Steps

### Step 1: Identify the validation point in SKILL.md

- Find where `get_available_providers` is called
- Find where session config is built with provider assignments

### Step 2: Parse available providers from `get_available_providers` output

- Extract the list of AVAILABLE providers
- Store for validation use

### Step 3: Validate build_provider

- Check if `config.routing.build` is in AVAILABLE list
- If not available:
  - Log warning: `"build_provider {name} not available"`
  - Find next available provider from `config.fallbackChain`
  - Assign fallback provider
- If no available provider in fallback chain:
  - Block session creation: `"No available provider for build role"`

### Step 4: Validate review_provider

- Same validation logic as build_provider
- Apply to `config.routing.review` slot

### Step 5: Update documentation

- Document fallback behavior in auto-pilot help

## Files to Modify

- `.claude/skills/auto-pilot/SKILL.md` - Add provider validation logic after `get_available_providers` call

## Acceptance Criteria

✅ Supervisor validates provider availability before creating session config
✅ Unavailable provider triggers warning and fallback to next available
✅ Session creation blocked with clear error if no provider available for a role
✅ Fallback logic documented in auto-pilot help

## Risk Assessment

- **Risk**: Low - Logic is straightforward validation and fallback
- **Mitigation**: Clear error messages will help users configure correctly
