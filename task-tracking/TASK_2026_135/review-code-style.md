# Code Style Review — TASK_2026_135

## Review Summary

| Metric          | Value                                 |
|-----------------|---------------------------------------|
| Overall Score   | 6/10                                  |
| Assessment      | PASS WITH NOTES                       |
| Blocking Issues | 1                                     |
| Serious Issues  | 3                                     |
| Minor Issues    | 4                                     |
| Files Reviewed  | 1 (parallel-mode.md)                  |

---

## The 5 Critical Questions

### 1. What could break in 6 months?

**parallel-mode.md:78-88** — The "Cache behaviour" block in Step 2 says: "On all other loop-backs from Step 7f, Step 2 is a no-op — the supervisor goes straight to Step 3." But Change 4 (Step 7f, line 841) now routes back to **Step 4**, not Step 2. This sentence describes a path that can no longer occur. A future editor reading Step 2 will see "loop-backs from Step 7f" as a valid scenario and may introduce logic anticipating that case. Six months from now, someone extending Step 7f could re-introduce a Step 2 loop-back based on this sentence and silently break the caching model.

### 2. What would confuse a new team member?

**parallel-mode.md:127-133** — The "Writing the Cached Task Roster" paragraph appears after the cortex availability detection note. A new reader following the cortex preferred path (lines 91-99) will have already written the `## Cached Status Map` but will not know whether the `## Cached Task Roster` is also expected from the cortex path. The paragraph is positioned after the cortex detection logic and before nothing — it looks like it applies to both paths, but the cortex preferred path never explicitly writes the task roster. The fallback path implicitly writes the roster because the paragraph follows it, but the cortex path writes the Status Map (line 99) and then falls through to this paragraph. The dual-purpose positioning creates a "does this apply to me?" ambiguity that a new developer cannot resolve without reading both paths carefully.

### 3. What's the hidden complexity cost?

**parallel-mode.md:316-333** — The `### Cache Invalidation Rules` section is a standalone reference block with no incoming cross-references from Steps 2, 3b, or 7f. Each of those steps defines invalidation triggers inline (e.g., Step 2's "Refresh triggers" at line 84, Step 3b's "Refresh triggers" at line 231), but neither step points forward to Cache Invalidation Rules as the canonical source. The result is that invalidation logic is documented in two places: inline in each step and summarized in the table. When an invalidation trigger is added or changed in one location, it must be updated in both. The Cache Invalidation Rules section adds maintenance surface without being the clear single source of truth.

### 4. What pattern inconsistencies exist?

**parallel-mode.md:145-160 vs 157-160** — The Step 3 cortex preferred path says "Use the task list returned by `get_tasks()` in Step 2" (in-memory MCP result) and never references the `## Cached Status Map`. The fallback path explicitly says "Use the `## Cached Status Map` from `{SESSION_DIR}state.md`". The cortex path does write the `## Cached Status Map` in Step 2 (line 99), but Step 3 never reads it — it reads the in-memory get_tasks result. This asymmetry means the Cached Status Map populated by the cortex path in Step 2 is never consumed in Step 3, only updated in Step 7f. A reader checking how the cortex path's Status Map cache is used will find no explicit Step 3 consumer, which calls into question why it is written at all on the cortex path.

### 5. What would I do differently?

- Make Step 7f's "Go to Step 4 (NOT Step 2)" self-contained by removing the historical "(NOT Step 2)" reminder and adding a comment explaining the cache makes a full Step 2 re-read unnecessary. The parenthetical is defensive commentary that pollutes the spec.
- Add a forward-reference at the end of Step 2's "Cache behaviour" block: "See `### Cache Invalidation Rules` for conditions that force startup mode." This makes the invalidation table the explicit canonical source rather than a duplicate.
- Clarify in the cortex preferred path of Step 3 whether the `## Cached Status Map` written in Step 2 is the authoritative source for Step 3 or just a persistence artifact for compaction recovery. Right now it is both, but this is only documented in Step 7f and the Cache Invalidation section, not in Step 3 itself.

---

## Blocking Issues

### Issue 1: Dead-path sentence in Step 2 "Cache behaviour"

- **File**: `parallel-mode.md:88`
- **Problem**: The sentence "On all other loop-backs from Step 7f, Step 2 is a no-op — the supervisor goes straight to Step 3" describes a routing path that no longer exists. Step 7f (Change 4, line 841) now routes to Step 4, not Step 2. No loop-back from Step 7f to Step 2 exists except via the refresh triggers. The sentence is literally unreachable.
- **Impact**: A developer extending the loop may add "Step 2 → Step 3" logic for a new event type, believing Step 2 → Step 3 fast-path is a documented pattern. This would silently bypass Step 4 and break task selection for that event type.
- **Fix**: Replace the sentence with: "Step 7f goes directly to Step 4 — it does not re-enter Step 2. Step 2 is only re-entered when an explicit refresh trigger fires (see above)."

---

## Serious Issues

### Issue 1: Cached Task Roster write — cortex path ambiguity

- **File**: `parallel-mode.md:91-133`
- **Problem**: The cortex preferred path (lines 91-99) explicitly writes the `## Cached Status Map` but does not mention writing the `## Cached Task Roster`. The "Writing the Cached Task Roster" paragraph at lines 127-133 appears after the cortex detection note and applies structurally to both paths, but it is never stated in the cortex path itself. The fallback path also doesn't state it — it is positioned to appear as a shared post-read action, but without explicit "both paths do this" language, the association is inferred, not stated.
- **Tradeoff**: If a developer adds cortex-specific logic between lines 99 and 127, they may not realize the Task Roster write is required, and will only write the Status Map. At recovery, `task_roster_cached` will be false and Step 2 will re-read unnecessarily on every startup that comes after the first compaction.
- **Recommendation**: Add an explicit sentence at the end of the cortex preferred path block (after line 99): "Then proceed to 'Writing the Cached Task Roster' below — this applies to both cortex and fallback paths."

### Issue 2: Cache Invalidation Rules has no incoming cross-references

- **File**: `parallel-mode.md:316-333`
- **Problem**: The section documents invalidation conditions for all three caches, but neither Step 2 nor Step 3b points to it. Step 2 has its own inline "Refresh triggers" block (lines 84-87) and Step 3b has its own inline "Refresh triggers" block (lines 231-233). Both exist independently of the Cache Invalidation Rules table. The section was inserted as a standalone reference, but without a "See also: Cache Invalidation Rules" note in Steps 2 and 3b, it is invisible to a reader working through the steps.
- **Tradeoff**: When a new invalidation trigger is added, a developer editing Step 2's inline "Refresh triggers" block may not update the Cache Invalidation Rules table, and vice versa. Two copies of the same rule diverge silently.
- **Recommendation**: At the end of Step 2's "Refresh triggers" block (line 87) add: "See also: `### Cache Invalidation Rules`." Do the same at the end of Step 3b's "Refresh triggers" block (line 233). This creates a single authoritative source with explicit forward references rather than two independent copies.

### Issue 3: Step 3 cortex path does not clarify the Status Map's role

- **File**: `parallel-mode.md:145-160`
- **Problem**: Step 3 cortex path reads the in-memory get_tasks result (line 147: "Use the task list returned by `get_tasks()` in Step 2") and never references the `## Cached Status Map` that Step 2 wrote to state.md (line 99). The Status Map is written in Step 2 on the cortex path, but Step 3 ignores it. Step 7f updates it (line 830). This means the Cached Status Map on the cortex path is a persistence artifact (for compaction recovery) but is never the Step 3 data source — unlike on the fallback path, where it is the explicit Step 3 source.
- **Tradeoff**: A developer reading the cortex path for Step 3 will see no use of the Cached Status Map and reasonably conclude it is unimportant on this path. They may optimize it away (e.g., "on cortex path, we don't need to write the Status Map at startup"). This would break compaction recovery for the cortex path.
- **Recommendation**: Add a note in the cortex Step 3 path: "Note: The `## Cached Status Map` written in Step 2 is not used as the Step 3 data source on the cortex path (the in-memory `get_tasks()` result is used instead). It exists for compaction recovery and is updated incrementally in Step 7f."

---

## Minor Issues

1. **`parallel-mode.md:841`** — "Go to **Step 4** (NOT Step 2)" — the parenthetical "(NOT Step 2)" is historical commentary that explains the change from the previous behavior. It adds no value to a future reader who never knew the old behavior and may create confusion ("why would Step 2 ever be mentioned here?"). Replace with just "Go to **Step 4**."

2. **`parallel-mode.md:99`** — The cortex preferred path writes `## Cached Status Map` with the note "(same format as fallback)". The fallback format definition (the table with Task ID / Status / Last Updated columns) appears at lines 113-118, which is *after* line 99 in reading order. A reader following the cortex path encounters "same format as fallback" before seeing the format definition. The format should either be defined above both paths (before line 91) or the cortex note should include a forward-reference line number.

3. **`parallel-mode.md:267`** — In the "Apply guidance" table, the `REPRIORITIZE` row says "Then continue to Step 4." After a plan re-read, the supervisor proceeds to Step 4 without re-running Step 3 (dependency graph). Since plan priorities are applied in Step 4's sort, this is correct — but it is not stated. Add a parenthetical: "(Step 3 dependency graph is unchanged — only ordering is affected)." A reader may wonder whether the dependency graph needs rebuilding after a reprioritize.

4. **`parallel-mode.md:320-324`** — The Cache Invalidation Rules table header has inconsistent column spacing:
   ```
   | Cache | state.md Section | Populated | Invalidated (force re-read) |
   |-------|-----------------|-----------|------------------------------|
   ```
   The second separator row `|-------|-----------------|` uses 15 dashes while the header "state.md Section" is 16 characters. The fourth separator `|------------------------------|` uses 30 dashes while "Invalidated (force re-read)" is 28 characters. These are cosmetically inconsistent with the tighter table formatting used elsewhere in the file (e.g., the dependency classification table at line 164). Low priority but visually jarring against the rest of the file.

---

## File-by-File Analysis

### parallel-mode.md

**Score**: 6/10
**Issues Found**: 1 blocking, 3 serious, 4 minor

**Analysis**:

This is a documentation spec file, not executable code. The five changes introduced by this task are functionally correct — the caching model is internally consistent, the three caches are distinct and non-overlapping, and the event-driven loop-back to Step 4 is the right architectural choice. The core mechanics are sound.

The problems are structural: the spec introduces three new named constructs (Cached Task Roster, Cached Plan Guidance, Cached Status Map) and documents each in its step of origin, then adds a cross-cutting Cache Invalidation Rules section — but does not wire these two layers together with forward references. Each layer can be read in isolation, which seems convenient, but in practice means a developer making a change to one step's inline invalidation rule will not see the Cache Invalidation Rules table as a related document requiring update.

The dead-path sentence in Step 2 (the blocking issue) is the most dangerous finding: it says "loop-backs from Step 7f cause Step 2 to be a no-op" but Step 7f no longer loops back to Step 2 at all. This is a direct residue of the Change 4 edit not being fully propagated into the Change 1 prose.

**Specific Concerns**:

1. `line 88` — Dead-path sentence says Step 7f loops back to Step 2. Step 7f now routes to Step 4.
2. `line 91-133` — Cached Task Roster write is not explicitly bound to the cortex path; positional inference is required.
3. `line 145-160` — No explanation of why Step 3 cortex path does not consume the Cached Status Map.
4. `lines 316-333` — Cache Invalidation Rules is an island; no incoming references from Steps 2 or 3b.

---

## Pattern Compliance

| Pattern                            | Status          | Concern                                                    |
|------------------------------------|-----------------|------------------------------------------------------------|
| Consistent terminology             | MOSTLY PASS     | Three cache names used consistently; minor positional ambiguity for Task Roster write |
| Cross-reference completeness       | FAIL            | Cache Invalidation Rules section has no incoming refs from Steps 2/3b |
| No contradictory language          | FAIL            | Step 2 line 88 contradicts Step 7f line 841               |
| Formatting consistency             | PASS            | Heading levels, table structure, bold/code usage consistent throughout |
| No duplicate concepts              | PARTIAL         | Invalidation triggers documented inline in each step AND in Cache Invalidation Rules table |

---

## Technical Debt Assessment

**Introduced**: The parallel inline-triggers + Cache Invalidation Rules table dual-documentation pattern creates a maintenance surface. When a trigger is added in the future, it must be updated in two places that have no explicit link.

**Mitigated**: The task correctly eliminates the per-loop registry and plan re-reads. The incremental Step 7f update removes a significant complexity footgun (full graph rebuild on every completion).

**Net Impact**: Slight increase in documentation debt due to dual invalidation documentation. Functional complexity is reduced.

---

## Verdict

PASS WITH NOTES

The caching model introduced by this task is architecturally correct and well-reasoned. One blocking issue must be fixed before this spec is followed by a worker: the dead-path sentence at line 88 of Step 2 directly contradicts the Step 7f routing change and will mislead future developers. The three serious issues are real maintenance risks but do not prevent the current spec from being correctly followed. All serious issues should be addressed in a follow-on pass or within this task if scope allows.

---

## What Excellence Would Look Like

A 9/10 version of this spec would:

1. Remove the dead-path sentence at line 88 and replace it with an accurate statement that Step 7f routes to Step 4.
2. Add explicit forward references from Steps 2 and 3b to the Cache Invalidation Rules section, making it the single canonical invalidation record.
3. Explicitly state in the cortex Step 2 path that both `## Cached Status Map` and `## Cached Task Roster` are written, with a note that the Status Map is a compaction-recovery artifact on the cortex path (not the Step 3 data source).
4. Remove the "(NOT Step 2)" parenthetical from Step 7f line 841 — it is historical commentary, not spec content.
