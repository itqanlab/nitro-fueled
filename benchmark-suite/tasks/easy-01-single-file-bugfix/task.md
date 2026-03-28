# Benchmark Task: Single File Bugfix

## Metadata

| Field          | Value   |
|----------------|---------|
| Difficulty     | easy    |
| Type           | bugfix  |
| Estimated Time | 5m      |
| Setup Required | yes     |

## Description

A `src/string-utils.ts` file contains three utility functions with subtle bugs. The model must identify and fix all three bugs. A test file (`src/string-utils.test.ts`) is provided with failing tests that document the expected behavior. All previously passing tests must continue to pass.

The three bugs:

1. **`truncate(str, maxLength)`** -- Off-by-one error: the function truncates at `maxLength` and then appends `"..."`, so the output length is `maxLength + 3` instead of exactly `maxLength`. The correct behavior is to slice at `maxLength - 3` before appending `"..."`.

2. **`capitalize(str)`** -- Fails on multiple consecutive spaces. The function splits on a single space character, which produces empty strings for consecutive spaces. The `map` and `join(' ')` pipeline collapses multiple spaces into a single space. For example, `capitalize("hello  world")` returns `"Hello World"` instead of `"Hello  World"`.

3. **`slugify(str)`** -- Does not handle accented or special characters correctly. The regex `[^a-z0-9\s-]` replaces accented characters (like é) with `"-"`. For example, `slugify("Café Latté")` (both e's have acute accents) produces `"caf-latt"` instead of `"cafe-latte"` — each accented character becomes a hyphen, and trailing hyphens are stripped by the cleanup pass.

## Setup Instructions

1. Copy `setup/` contents into the worktree root
2. The `src/string-utils.ts` file contains the buggy implementations
3. The `src/string-utils.test.ts` file contains tests -- some pass with the buggy code, some fail to document expected behavior

## Requirements Checklist

### Correctness

- [ ] `truncate("Hello World", 8)` returns `"Hello..."` (length exactly 8)
- [ ] `truncate("Hi", 10)` returns `"Hi"` (no truncation when under limit)
- [ ] `truncate("Hello", 5)` returns `"Hello"` (no truncation at exact limit)
- [ ] `capitalize("hello  world")` returns `"Hello  World"` (preserves multiple spaces)
- [ ] `capitalize("")` returns `""` (empty string edge case)
- [ ] `slugify("Hello World!")` returns `"hello-world"` (strips special chars)
- [ ] `slugify("Cafe Latte")` returns `"cafe-latte"` (handles accented characters gracefully -- the e in Cafe has an acute accent)

### Code Quality

- [ ] Bug fixes are minimal -- only the broken logic is changed, not wholesale rewrites
- [ ] No `any` types introduced
- [ ] Existing function signatures preserved (no breaking changes)

### Completeness

- [ ] All three bugs are identified and fixed
- [ ] All existing passing tests still pass
- [ ] All previously failing tests now pass

### Error Handling

- [ ] Functions handle `null`/`undefined` input without throwing
- [ ] `truncate` handles `maxLength <= 3` gracefully (returns truncated string without "...")

## Scoring Guide

| Dimension      | 1-3 (Failing)                                                                 | 4-6 (Partial)                                                                  | 7-8 (Good)                                                                     | 9-10 (Excellent)                                                                |
|----------------|-------------------------------------------------------------------------------|--------------------------------------------------------------------------------|--------------------------------------------------------------------------------|---------------------------------------------------------------------------------|
| Correctness    | 0-1 of 7 test assertions pass; bugs remain unfixed or new bugs introduced     | 3-4 of 7 test assertions pass; at least one bug correctly fixed                | 5-6 of 7 test assertions pass; two bugs fixed correctly                        | All 7 test assertions pass; all three bugs fixed with correct output            |
| Code Quality   | Wholesale rewrite of functions; `any` types added; function signatures changed | Fixes are functional but include unnecessary changes beyond the bug            | Fixes are targeted with minor unnecessary modifications                        | Fixes change only the broken logic; no `any` types; signatures preserved exactly |
| Completeness   | 0-1 of 3 bugs identified; failing tests still fail                            | 2 of 3 bugs fixed; some previously failing tests now pass                      | All 3 bugs fixed; most tests pass but one edge case missed                     | All 3 bugs fixed; all previously passing tests still pass; all failing tests now pass |
| Error Handling | All functions throw on `null`/`undefined`; `truncate` crashes on `maxLength <= 3` | Some null/undefined cases handled; `truncate` with `maxLength <= 3` not addressed | null/undefined handled; `truncate` with `maxLength <= 3` returns reasonable result | null/undefined handled without throwing; `truncate` with `maxLength <= 3` returns truncated string without "..." |
