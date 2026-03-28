# Benchmark Task: Multi-File Feature -- In-Memory Cache with TTL

## Metadata

| Field          | Value   |
|----------------|---------|
| Difficulty     | medium  |
| Type           | feature |
| Estimated Time | 20m     |
| Setup Required | yes     |

## Description

Build an in-memory key-value store with TTL (time-to-live) support spanning three files:

### 1. `src/cache/types.ts` -- Type Definitions

- **`CacheEntry<T>`** interface: `{ value: T; expiresAt: number | null }`
- **`CacheOptions`** interface: `{ defaultTTL?: number; maxSize?: number; onEvict?: (key: string, value: unknown) => void }`

### 2. `src/cache/cache.ts` -- The `Cache<T>` Class

Constructor accepts `CacheOptions`. Methods:

- **`set(key: string, value: T, ttl?: number): void`** -- Stores an entry with an optional TTL in milliseconds. If no `ttl` is provided, falls back to `defaultTTL` from options. If neither is set, the entry never expires. When `maxSize` is reached, evict the oldest entry (LRU by insertion order) before inserting.
- **`get(key: string): T | undefined`** -- Returns the value if the key exists and is not expired. If the entry has expired, removes it (lazy expiration) and returns `undefined`.
- **`has(key: string): boolean`** -- Returns `true` if the key exists AND is not expired. Returns `false` for missing or expired entries.
- **`delete(key: string): boolean`** -- Removes the entry and calls `onEvict` callback if configured. Returns `true` if the key existed, `false` otherwise.
- **`clear(): void`** -- Removes all entries, calling `onEvict` for each entry.
- **`size(): number`** -- Returns the count of non-expired entries (triggers lazy expiration check).

### 3. `src/cache/index.ts` -- Barrel Export

Re-exports the `Cache` class and both type interfaces (`CacheEntry`, `CacheOptions`) so consumers can import from `src/cache`.

## Setup Instructions

1. Copy `setup/` contents into the worktree root
2. `setup/src/index.ts` exists as an entry point placeholder
3. `setup/package.json` provides the TypeScript dependency
4. Create the `src/cache/` directory and all three files from scratch

## Requirements Checklist

### Correctness

- [ ] `set` + `get` round-trips for basic values (string, number, object)
- [ ] Expired entries return `undefined` from `get`
- [ ] `has` returns `false` for expired entries
- [ ] `size` does not count expired entries
- [ ] `maxSize` eviction removes the oldest entry (first inserted)
- [ ] `onEvict` callback fires on `delete`, `clear`, and maxSize eviction
- [ ] `defaultTTL` applies when no per-key TTL is provided

### Code Quality

- [ ] Proper generic typing on `Cache<T>` -- no `any` types
- [ ] Clean separation: types in `types.ts`, implementation in `cache.ts`, exports in `index.ts`
- [ ] Private internal storage (not exposed as public properties)
- [ ] Consistent code style (semicolons, quotes, indentation)

### Completeness

- [ ] All three files created at correct paths (`src/cache/types.ts`, `src/cache/cache.ts`, `src/cache/index.ts`)
- [ ] All six methods implemented (`set`, `get`, `has`, `delete`, `clear`, `size`)
- [ ] Barrel export in `index.ts` re-exports both the class and the type interfaces
- [ ] `CacheOptions` and `CacheEntry` types match the specification exactly

### Error Handling

- [ ] `set` with negative TTL treated as immediate expiry or throws
- [ ] `get` on non-existent key returns `undefined` (not throws)
- [ ] `delete` on non-existent key returns `false` (not throws)
- [ ] `maxSize` of 0 or negative is handled (throws or defaults to unlimited)

## Scoring Guide

| Dimension      | 1-3 (Failing)                                                                 | 4-6 (Partial)                                                                  | 7-8 (Good)                                                                     | 9-10 (Excellent)                                                                |
|----------------|-------------------------------------------------------------------------------|--------------------------------------------------------------------------------|--------------------------------------------------------------------------------|---------------------------------------------------------------------------------|
| Correctness    | Basic set/get fails; TTL not implemented; eviction absent                     | set/get works for simple values; TTL partially implemented but lazy expiration missing; eviction not triggered | TTL and lazy expiration work; maxSize eviction works but onEvict not called in all cases; defaultTTL partially applied | All 7 correctness criteria pass: set/get round-trips, lazy expiration on get/has/size, maxSize eviction with onEvict, defaultTTL fallback |
| Code Quality   | All code in one file; `any` types used; internal Map exposed as public        | Types separated but implementation mixed with exports; minor `any` usage       | Clean three-file separation; proper generics; storage is private; minor style inconsistencies | Proper generics on `Cache<T>` with no `any`; clean three-file separation; private storage; consistent code style throughout |
| Completeness   | Only 1-2 files created; fewer than 3 methods implemented                      | All files created but 1-2 methods missing; barrel export incomplete            | All 6 methods implemented; barrel export present but missing a type re-export  | All 3 files at correct paths; all 6 methods implemented; barrel export re-exports class and both type interfaces; types match spec exactly |
| Error Handling | `get` throws on missing key; negative TTL crashes; no maxSize validation      | Some edge cases handled; `delete` on missing key throws instead of returning false | Most edge cases handled; negative TTL or maxSize=0 not addressed               | All edge cases handled: negative TTL handled gracefully; get/delete return undefined/false for missing keys; maxSize <= 0 throws or defaults to unlimited |
