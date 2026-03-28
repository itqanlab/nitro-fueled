# Benchmark Task: Add Utility Function

## Metadata

| Field          | Value   |
|----------------|---------|
| Difficulty     | easy    |
| Type           | feature |
| Estimated Time | 8m      |
| Setup Required | no      |

## Description

Create a new `src/array-utils.ts` module from scratch with three generic utility functions:

1. **`chunk<T>(array: T[], size: number): T[][]`** -- Split an array into chunks of the given size. The last chunk may be smaller than `size` if the array length is not evenly divisible.

2. **`unique<T>(array: T[], keyFn?: (item: T) => unknown): T[]`** -- Return unique elements from the array. When `keyFn` is provided, use it to derive a comparison key for each element (e.g., unique by `.id`). When `keyFn` is omitted, use strict equality (`===`). The first occurrence of each unique element is kept.

3. **`groupBy<T>(array: T[], keyFn: (item: T) => string): Record<string, T[]>`** -- Group array elements by the string key returned by `keyFn`. Each key in the returned record maps to an array of all elements that produced that key.

All three functions must use proper TypeScript generics, be exported as named exports, and include JSDoc comments describing parameters and return type.

## Setup Instructions

1. Initialize a minimal TypeScript project (`tsconfig.json` + `package.json`)
2. Create `src/array-utils.ts` from scratch -- the file does not exist yet

## Requirements Checklist

### Correctness

- [ ] `chunk([1,2,3,4,5], 2)` returns `[[1,2],[3,4],[5]]`
- [ ] `chunk([], 3)` returns `[]`
- [ ] `unique([1,2,2,3,1])` returns `[1,2,3]`
- [ ] `unique([{id:1,n:"a"},{id:1,n:"b"}], x => x.id)` returns `[{id:1,n:"a"}]`
- [ ] `groupBy(["one","two","three"], s => String(s.length))` returns `{"3":["one","two"],"5":["three"]}`

### Code Quality

- [ ] All functions use proper TypeScript generics (no `any`)
- [ ] Functions are exported with named exports
- [ ] Code is readable with clear variable names
- [ ] JSDoc comments present on all three functions describing parameters and return type

### Completeness

- [ ] All three functions are implemented
- [ ] File is created at the correct path (`src/array-utils.ts`)
- [ ] All specified signatures are respected exactly

### Error Handling

- [ ] `chunk` throws or returns `[]` for `size <= 0`
- [ ] `chunk` handles `size > array.length` (returns single chunk)
- [ ] `unique` handles empty array
- [ ] `groupBy` handles empty array (returns `{}`)

## Scoring Guide

| Dimension      | 1-3 (Failing)                                                                 | 4-6 (Partial)                                                                  | 7-8 (Good)                                                                     | 9-10 (Excellent)                                                                |
|----------------|-------------------------------------------------------------------------------|--------------------------------------------------------------------------------|--------------------------------------------------------------------------------|---------------------------------------------------------------------------------|
| Correctness    | 0-1 of 5 test cases pass; functions return wrong types or crash               | 2-3 of 5 test cases pass; at least one function fully correct                  | 4 of 5 test cases pass; minor edge case missed in one function                 | All 5 test cases pass with exact expected output                                |
| Code Quality   | No generics used; `any` types present; no JSDoc; unreadable variable names    | Generics on some functions but not all; JSDoc missing on one or more functions  | All functions generic with JSDoc; minor style issues (inconsistent naming)      | All functions use proper generics; complete JSDoc on all three; clean readable code with clear variable names |
| Completeness   | Only 1 of 3 functions implemented; file at wrong path                         | 2 of 3 functions implemented; file at correct path                             | All 3 functions implemented; one signature deviates from spec                  | All 3 functions implemented at correct path with exact specified signatures     |
| Error Handling | `chunk` crashes on size <= 0; no edge case handling                           | Some edge cases handled; `chunk` with size <= 0 not addressed                  | Most edge cases handled; one function missing empty-array guard                | All edge cases handled: `chunk` throws or returns `[]` for size <= 0; `chunk` returns single chunk for size > length; `unique` and `groupBy` handle empty arrays |
