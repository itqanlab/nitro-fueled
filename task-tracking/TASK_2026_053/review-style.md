# Style Review — TASK_2026_053

## Score: 5/10

## The 5 Critical Questions

### 1. What could break in 6 months?

The command count stat (15) in `docs/index.html:44` will silently diverge from reality. There are currently 17 files in `.claude/commands/`. Two commands that exist (`/retrospective`, `/evaluate-agent`) are not listed in the commands section (index.html:731-779) and are missing from the hero stat. As more commands are added, this number will never be updated because there is no single source of truth — the HTML embeds the count inline.

### 2. What would confuse a new team member?

The design doc (`docs/nitro-fueled-design.md:51-53`) describes `frontend-developer` and `backend-developer` as **project agents** that are "generated at init time" and do NOT use the `nitro-` prefix. But the actual files on disk are `nitro-frontend-developer.md` and `nitro-backend-developer.md` — they are core agents with the prefix. The index.html agent roster (lines 549-560) also lists them as `nitro-frontend-developer` and `nitro-backend-developer`. The design doc has not been updated to reflect this, so a new reader gets directly contradictory information depending on which file they read first.

### 3. What's the hidden complexity cost?

The "How It Stays Current" section (index.html:974-1009) describes a `nitro-manifest.json` file as a version registry generated at `init` time. This mechanism is not mentioned anywhere in `CLAUDE.md`, `docs/nitro-fueled-design.md`, or `task-tracking/plan.md`. The design doc's "What Gets Copied (init)" section (lines 217-231) has no reference to manifest generation. If `nitro-manifest.json` is aspirational rather than implemented, the HTML is documenting future state as if it is present — a pattern the review lessons explicitly flag.

### 4. What pattern inconsistencies exist?

- `CLAUDE.md:15` says "22 nitro-* agent definitions" — this matches the actual count (22 files on disk). The HTML hero stat (line 42) also says 22. These agree. Good.
- `CLAUDE.md:15` references `nitro-planner.md` as the example under `agents/`. This is the filename-level reference and is accurate.
- `plan.md:5` names the project `claude-nitro-fueled` ("claude-nitro-fueled is a reusable AI development orchestration package"). `CLAUDE.md` and `index.html` refer to it only as `Nitro-Fueled` or `nitro-fueled`. The `plan.md` Project Overview name is a stale remnant of the older package name recorded in Decisions Log:line 239.
- Phase 10 status in `plan.md` (`NOT STARTED`, line 190) contradicts its own task map: both TASK_2026_061 and TASK_2026_062 are listed as COMPLETE (lines 200-201). The phase header status was never updated when tasks completed.

### 5. What would I do differently?

- Move the agent/command/skill counts in `index.html` out of hardcoded strings and into a comment noting they are manually maintained, with an explicit synchronization instruction. Or consolidate into the footer only (less critical visibility).
- Update the design doc's Agent Separation section to reflect the actual state: `nitro-frontend-developer` and `nitro-backend-developer` are now core agents that ship as-is, not project-generated agents. The section currently actively misleads.
- Fix the Phase 10 status header in `plan.md` to match task statuses.
- Add `nitro-manifest.json` to the design doc if implemented, or add a note in the HTML that it is planned.

---

## Critical Issues (must fix)

### 1. Design doc contradicts current agent architecture for developer agents

- **File**: `docs/nitro-fueled-design.md:39-55`
- **Problem**: The "Agent Separation: Core vs Project" section says `frontend-developer` and `backend-developer` do not use the `nitro-` prefix and are generated at init time — but the actual agents on disk are `nitro-frontend-developer.md` and `nitro-backend-developer.md`, and the HTML lists them identically. The design doc was not updated when the rename happened.
- **Impact**: Any reader of the design doc will believe these are project-generated agents that will be overwritten or handled differently during `update`. The "How It Stays Current" section (index.html:991-998) specifically says only `nitro-*` files are safe to overwrite — a reader following the design doc's definition would think developer agents are protected when they are actually replaceable core agents.

### 2. Command count stat is factually wrong

- **File**: `docs/index.html:44`
- **Problem**: Hero stat shows `15` Commands. Actual `.claude/commands/` directory contains 17 files (`/retrospective` and `/evaluate-agent` are absent from the count and from the commands listing section at line 731-779).
- **Impact**: The stat is the first concrete number a visitor sees. It is wrong on the page as shipped. The commands section also omits `/retrospective` and `/evaluate-agent` without explanation, so readers cannot discover these commands from the HTML.

### 3. Phase 10 status header contradicts its own task map

- **File**: `task-tracking/plan.md:190`
- **Problem**: Phase 10 header says `**Status**: NOT STARTED` but both tasks in its Task Map (TASK_2026_061, TASK_2026_062) are `COMPLETE`. The phase should be `COMPLETE`.
- **Impact**: The Supervisor reads `plan.md` to determine which phases are active. A `NOT STARTED` phase with completed tasks is an internal contradiction that would cause any automated consumer to misclassify the phase.

---

## Minor Issues (should fix)

- **`plan.md:5`** — Project Overview still uses the old package name `claude-nitro-fueled` ("claude-nitro-fueled is a reusable AI development orchestration package"). All other files use `nitro-fueled` or `Nitro-Fueled`. The Decisions Log at line 239 shows the name was decided as `claude-nitro-fueled` on 2026-03-24, but CLAUDE.md and the HTML never use this name. One of these needs to be canonical.

- **`docs/index.html:78-80`** — The Install section mentions `npx nitro-fueled update` in the ww-note div but this command is not listed in the Commands section (lines 731-779). If the HTML commands section is intended to be a complete reference, `update` and `config` (which also exists as `packages/cli/src/commands/config.ts`) are missing from it.

- **`docs/index.html:974-1009` (How It Stays Current)** — Describes `nitro-manifest.json` as a generated artifact but this file is not referenced in `docs/nitro-fueled-design.md` at all. Either the design doc needs a section covering the manifest mechanism, or a note should clarify whether this is current behavior or planned behavior. Per review-lessons (TASK_2026_064): "implementation-era language must be removed before merge" — the inverse is also true: future-state features must not be presented as current.

- **`CLAUDE.md:16`** — Under `agents/`, the example file listed is `nitro-planner.md`. This is accurate but the comment format is inconsistent with the original file it replaced — the old file listed `planner.md`. Minor, but the comment `# Strategic planning agent (roadmap, task creation, backlog)` is the only example shown. It would be more useful to show the pattern (prefix + role) rather than just one file, since this is readers' first exposure to the naming convention.

- **`docs/nitro-fueled-design.md:43-49`** — The Core agents bullet list does not include `nitro-frontend-developer` or `nitro-backend-developer` even though those files now carry the `nitro-` prefix and exist as core agents. They appear in the "Project agents" section instead (line 52-53). Once Issue 1 is fixed, this list must be updated to include them.

- **`task-tracking/plan.md:203-222` (Phase 12)** — Milestone checkboxes and task statuses are misaligned: `TASK_2026_053` is listed as `IN_PROGRESS` in the task map (line 221) but the milestone says `[ ] Docs and workspace updated to reflect package vision (TASK_2026_053)` (line 210) — the unchecked milestone is correct while the task is being reviewed, but if this document is reviewed after completion it needs both updated together. Not a bug in this changeset, but the format creates a two-step update requirement that is likely to be missed.

---

## Suggestions (optional)

- The `section-label` / `section-title` pattern in `index.html` uses "Staying Current" as the label for the section-label div (line 976) while all other sections follow the pattern "Step N · Name". This section intentionally breaks the pattern (it is post-"getting started"), but the inconsistency could confuse someone who expects a Step 13. Consider adding a note like "After Setup" or giving it a consistent label treatment.

- `CLAUDE.md` "Current State" line 46 says "All agents renamed to `nitro-*` prefix (Phase 12 — CLI Maturity in progress)". Phase 12 is complete for the rename task (TASK_2026_051). The phrase "in progress" refers to the broader Phase 12, not the rename itself. This is technically accurate but could be tightened: "Agent rename complete; scaffold sync, /run update, and docs update in progress (Phase 12)".

- The design doc's "Resolved Design Decisions" section (line 233-241) still has 4 items. As Phase 12 resolves the naming architecture, a new resolved decision capturing "All developer agents promoted to core nitro-* agents" would make the evolution traceable for future contributors.
