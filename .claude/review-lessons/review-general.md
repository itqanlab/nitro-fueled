# General Review Lessons

Cross-cutting rules that apply to ALL code regardless of layer. Every agent reads this file.
Auto-updated after each task's review cycle. Append new findings — do not remove existing ones.

## File Size Limits (MOST VIOLATED RULE — 7/14 tasks)

- **Components: max 150 lines. Inline templates: max 50 lines.**
- **Services/repositories/stores: max 200 lines. Spec files: max 300 lines.**
- Split by responsibility DURING implementation, not after review.
- If a deliverable will likely exceed limits, pre-plan the split before writing code.

## TypeScript Conventions

- **Explicit access modifiers on ALL class members** — `public`, `private`, `protected`. Never bare. (T03, T04, T07, T09)
- **No `any` type ever** — use `unknown` + type guards, or proper generics. (T01)
- **No `as` type assertions** — if the type system fights you, the type is wrong. Use type guards or generics. (T03, T05, T07, T09)
- **String literal unions for status/type/category fields** — never bare `string`. (T04, T07, T09, T10)
- **Use `Pick<>`/`Omit<>` for interface subsets** — never duplicate fields manually. (T04, T09)
- **No unused imports or dead code** — if exported but never imported, remove it. (T01, T04, T08)
- **No redundant `as const`** on already-typed `readonly` arrays. (T06)
- **Falsy checks skip zero values** — `if (x || y)` skips when both are 0. Use `!== undefined` or `!= null`. (T04)

## Naming

- **kebab-case** for file names
- **SCREAMING_SNAKE_CASE** for const domain objects (`TABLES`, `CHANNELS`)
- **camelCase** for variables, functions, methods
- **PascalCase** for classes, interfaces, types, enums

## File Structure

- **One interface/type per file** — don't define models inside component files. Move to `*.model.ts`. (T08)
- **File suffixes must follow convention** — `.model.ts` for types, `.service.ts` for services. No `.type.ts`. (T07)
- **Constants files: single responsibility** — don't pack multiple domains into one file. (T05)

## Imports

- **Model types from shared types library** — never import from the database library in handlers or renderer. (T09)
- **No double re-exports** — either named exports or wildcard in barrel, not both. (T07)
- **No duplicate type definitions** — if a type exists in shared, import it. Don't redefine. (T07)

## Error Handling

- **Never swallow errors** — at minimum, log them. No empty catch blocks. (7/14 tasks)
- **Error messages must be human-readable** — not raw exception strings. Wrap at boundaries. (T08, T09)
- **Delete/update on non-existent ID must return indicator** — never silent void success. (T09)

## Documentation & Template Consistency

- **Enum values must match canonical source character-for-character** — if SKILL.md defines statuses or types, every template, command, and guide must use the exact same values, casing, and separators. No synonyms (e.g., `COMPLETE` vs `COMPLETED`), no separator divergence (`|` vs `/`). (TASK_001)
- **Commands that claim "read template as source of truth" must not hardcode template content** — if a command duplicates enum values inline, changes to the template require multi-file updates, defeating the single-source-of-truth pattern. (TASK_001)
- **New status/enum values must be added to the canonical reference first** — before any command or guide uses a value like `CREATED`, it must exist in the reference document (e.g., `task-tracking.md` Registry Status table). Undefined values cause downstream tooling failures. (TASK_001)
- **Named concepts must use one term everywhere** — if a mode, role, or concept has a name (e.g., "Supervisor mode"), every file must use that exact phrase. Do not introduce synonyms like "autonomous mode" or "autonomous (Supervisor) mode" — agents parse terms literally and may not recognize variants as equivalent. (TASK_2026_003)
- **Prompt templates must reference canonical definitions, not duplicate them** — if a skill defines an Exit Gate checklist, worker prompt templates should reference it ("Run the Exit Gate from orchestration SKILL.md") rather than embedding a simplified copy. Duplicated specs drift silently when the canonical source is updated. (TASK_2026_003)

## Cross-File References

- **Cross-file section references must use names, not numbers** — if a command references "Planner protocol 5b", and the agent renumbers sections, the reference silently breaks. Use descriptive references like "Planner Status Mode (Section 3b)" so the name survives renumbering. (TASK_2026_004)
- **Session log event definitions must have matching log instructions in step logic** — if the Session Log table defines an event format (e.g., "Plan not found"), the corresponding step logic must include an explicit log instruction that produces that event. Dead event definitions confuse maintainers. (TASK_2026_004)
- **Step logic that reads external artifacts must handle malformed input** — if a step reads a section from a file written by another agent (e.g., Supervisor reads plan.md "Current Focus"), include a fallback for missing/malformed sections. Cross-agent artifacts are not guaranteed well-formed after crashes or interruptions. (TASK_2026_004)

## Configuration & Parameter Consistency

- **Every configurable parameter must be consumed by logic** — if a Configuration table exposes a parameter (e.g., `--stuck Nm`), there must be a corresponding step in the core logic that reads and uses that value. Dead configuration that has no effect is worse than no configuration — it misleads users and erodes trust. (TASK_2026_002)
- **Parameter sets must be synchronized across skill and command** — if a skill's Configuration table defines overridable parameters, the command's Parameters table and argument parsing must include all of them. Split definitions cause silent omissions. (TASK_2026_002)
- **Behavioral specifications should live in the skill, not split across skill and command** — if a skill has multiple operating modes (e.g., single-task, dry-run, all-tasks), all modes should be at least referenced in the skill. The command handles argument parsing and pre-flight, but the skill should be the complete behavioral reference. (TASK_2026_002)

## Security Basics (all agents must know)

- **All SQL queries use parameterized `?` placeholders** — never interpolate. (all tasks)
- **LIKE patterns: escape `%` and `_`** in user input. (T03, T04)
- **No `eval()`, `Function()`, or dynamic `require()`** — ever. (general)
- **Validate at system boundaries** — every IPC handler validates via Zod schema. (all tasks)
- **Secrets never appear in error messages** — strip credentials before surfacing to UI. (T10)
- **Glob-to-regex conversion must escape special chars** — `.`, `+`, `?`, `^`, `$`, etc. must be escaped before converting `*` / `**` to regex. (T75)
- **IPC handlers must validate entity exists** — before delegating to service. Return structured error, not opaque DB exception. (T45, T75)
- **LLM-to-LLM shared files must constrain free-text fields** — when one agent writes a file that another agent reads and acts upon (e.g., plan.md Guidance Note read by Supervisor), the writing agent must be constrained to factual/descriptive content, and the reading agent must be told to never interpret the field as instructions. Unbounded free-text fields are prompt injection vectors. (TASK_2026_004)
- **Check-then-act on shared files is a TOCTOU race** — reading a registry to compute the next ID, then writing, is not atomic. If two processes can run concurrently (e.g., /plan + /create-task), add a defensive verify-before-write check (e.g., confirm folder does not exist before mkdir). Cannot be fully eliminated without locking but can be reduced. (TASK_2026_004)
- **Silent reconciliation must log before fixing** — when an agent silently fixes discrepancies between two sources of truth (e.g., plan.md vs registry.md), it must log each discrepancy before overwriting. Silent fixes mask corruption and make debugging impossible. (TASK_2026_004)
- **Concurrent writer guards on shared files** — when two agents/commands can write to the same file (e.g., Planner and Supervisor both write registry.md), the less-frequent writer must check for active sessions of the other (e.g., check orchestrator-state.md for RUNNING status) and warn before proceeding. File-based systems have no locking; defensive checks reduce race windows. (TASK_2026_004)
- **Command argument parsing must use exact-match for mode keywords** — if a command supports modes via keyword arguments (e.g., `/plan status`, `/plan reprioritize`), the keyword must match the entire argument string exactly, not be a substring or first-word match. Otherwise `/plan status dashboard` triggers status mode instead of planning a "status dashboard" feature. (TASK_2026_004)
- **Bidirectional consistency checks on cross-referenced artifacts** — when two files reference each other's entities (e.g., plan.md references task IDs that should exist in registry.md, and registry.md has tasks that should be in plan.md), consistency checks must run in both directions. One-directional orphan detection leaves ghost entries in the unchecked direction. (TASK_2026_004)
- **Interrupted session recovery must cover ALL written artifacts** — if an agent writes to multiple files (e.g., task folders, registry.md, AND plan.md), the recovery checklist must validate all of them, not just the obvious ones. A half-written plan.md is just as damaging as a missing registry entry. (TASK_2026_004)
- **Guidance/enum action tables must include a default/fallback row** — when a step acts on a field that could contain any string (e.g., Supervisor Guidance: PROCEED|REPRIORITIZE|ESCALATE|NO_ACTION), always include an "unrecognized value" row that logs a warning and falls back to safe default behavior. Typos in cross-agent fields should not cause undefined behavior. (TASK_2026_004)

## Documentation Accuracy

- **Documentation listing counts and enumerations must be verified against the filesystem** — when a doc claims "N agents" or lists specific skills/commands, run `ls` or `find` to confirm the count and names match reality. Stale counts (e.g., "15 agents" when 16 exist) and incomplete listings erode trust and mislead contributors. (TASK_2026_007)
- **File renames must be grepped across all docs** — when renaming a file (e.g., `claude-orchestrate-package-design.md` to `nitro-fueled-design.md`), grep the entire repo for the old filename. Sibling docs that cross-reference the old name become broken links. A rename task is not complete until all references are updated. (TASK_2026_007)

## Agent Definition Structural Consistency

- **Same-role agents must share a common section skeleton** — when multiple agents serve the same function category (e.g., all developer agents), they must have the same mandatory sections in the same order. Domain-specific content varies, but workflow-critical sections (escalation protocol, review lessons step, file size enforcement) must never be omitted from one agent when present in its peers. Structural divergence causes the orchestrator and team-leader to make incorrect assumptions about agent capabilities. (TASK_2026_005)
- **Catalog header counts must be verified after adding/removing agents** — if a reference file declares "catalog of all N agents", N must be updated whenever the agent list changes. Stale counts become anchors for future miscounts and signal that the file was not fully reviewed after modification. (TASK_2026_005)
- **Genericization must cover all files in scope, not just the primary targets** — when removing project-specific references (e.g., Electron, Angular, SQLite) from agent definitions, also audit and update all reference files modified in the same task. Partial genericization creates inconsistency where some parts of the same file are generic and others are project-specific. (TASK_2026_005)
- **Files must not exceed the size limits they define** — if an agent definition specifies file size limits (e.g., "Agent definition: max 400 lines"), that agent's own file must comply. A file that violates its own rules undermines the credibility of the enforcement mechanism. (TASK_2026_005)
