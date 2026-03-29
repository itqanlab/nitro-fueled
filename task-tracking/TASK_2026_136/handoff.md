# TASK_2026_136 — Handoff

## Files Changed

| File | Change |
|------|--------|
| `.claude/skills/auto-pilot/references/parallel-mode.md` | JIT quality gate refactor: partial read, metadata cache write, metadata reuse note, Metadata Cache state.md format |
| `apps/cli/scaffold/.claude/skills/auto-pilot/references/parallel-mode.md` | Synced from source (identical copy) |

## Commits

None yet. Git operations handled by nitro-team-leader.

## Summary of Changes

### Change 1 — 5a-jit: Partial read + metadata cache

**Before**: Step 1 read the full `task.md` file. Steps 1-3 validated Type, Priority, Description length, and Acceptance Criteria count.

**After**:
- Step 1 checks `## Metadata Cache` in `{SESSION_DIR}state.md` first. Cache hit skips all file reading (goes directly to timing fields at step 5).
- Step 2 reads only the first 20 lines of `task.md` (the metadata table). No full-file read.
- Step 3 extracts 10 fields: Type, Priority, Complexity, Model, Provider, Preferred Tier, Testing, Poll Interval, Health Check Interval, Max Retries.
- Step 4 validates only Type, Priority, Complexity enums (Description/AC checks removed — those are body content not present in first 20 lines).
- Step 9 (new) writes extracted values to `## Metadata Cache` in state.md after successful validation. Durations stored as resolved seconds.

**Step numbering**: Original steps 4-7 renumbered to 5-8 to maintain flat sequential numbering per review-general.md lesson.

### Change 2 — 5b: Review/Fix Worker metadata reuse

Added a `> **Metadata reuse**` blockquote after the worker type labels table in **5b. Determine Worker Type**. When a Review Lead or Fix Worker is spawned for a task already in the `## Metadata Cache`, the supervisor skips the 5a-jit read entirely and uses the cached values.

### Change 3 — state.md Metadata Cache format

Added `**Metadata Cache**` documentation block immediately after the `## Serialized Reviews` table definition in Step 3c (File Scope Overlap Detection). Defines the cache table schema (11 columns) with an example row. Notes that the cache persists through session compaction.

## Decisions

1. **Removed Description/AC validation from supervisor level**: These checks require reading the body of task.md, not just the metadata table. Moved the responsibility to workers (they read the full task.md in their own context setup). The supervisor only needs enum validation to make routing decisions.

2. **Cache write in step 9, not step 8**: The cache write happens after validation passes (step 8 is "if validation passes → proceed to 5b"). Step 9 is the correct position to write the cache — at the end of the JIT gate, after all timing fields are resolved to seconds.

3. **Preferred Tier added to Extract step**: The task description specified extracting `preferred_tier` but the original step 2 extract list did not include it. Added to step 3 extract list for completeness, since 5d already reads it from task.md.

4. **`default` sentinel preserved in cache**: Per task description spec, `default` is stored as-is in the cache for fields not explicitly set in the task. The cache stores resolved durations (seconds) for Poll/Health Check intervals and `default` for Model/Provider when not overridden.

## Known Risks

1. **First 20 lines assumption**: The metadata table must be in the first 20 lines of task.md. If the task template ever adds preamble lines before the metadata table (e.g., a frontmatter block), the partial read may miss fields. Current task template puts the metadata table immediately after the `# Task:` heading, so this is safe for now.

2. **Cache invalidation**: The cache has no TTL and no invalidation mechanism. If a task's metadata is edited mid-session (e.g., someone changes the Complexity), the cached value will be stale. This is documented as an accepted trade-off — task metadata is expected to be stable within a session.

3. **Step 3c placement**: The Metadata Cache documentation was placed in Step 3c (File Scope Overlap Detection) alongside the Serialized Reviews table. This is technically the section that introduces the `{SESSION_DIR}state.md` format tables — the placement is logical. However, the Metadata Cache is populated in Step 5a-jit, not Step 3c. Future readers may find this slightly non-obvious.
