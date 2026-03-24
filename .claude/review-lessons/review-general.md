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
