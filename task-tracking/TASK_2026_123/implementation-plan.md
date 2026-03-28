# Implementation Plan - TASK_2026_123: Benchmark Suite for Model Evaluation Pipeline

## Overview

Create the `benchmark-suite/` directory at the project root with 5 benchmark tasks (easy x2, medium x2, hard x1), each containing a `task.md` with scoring rubrics and a `setup/` directory with seed files where required. All content is markdown and TypeScript -- no build tooling, no library dependencies.

## File Inventory (20 files total)

```
benchmark-suite/
  config.md                                          # Suite configuration and task manifest
  tasks/
    easy-01-single-file-bugfix/
      task.md                                        # Bugfix task description + scoring rubric
      setup/
        src/
          string-utils.ts                            # Buggy string utility implementations
          string-utils.test.ts                       # Failing test cases documenting expected behavior
    easy-02-add-utility-function/
      task.md                                        # Feature task description + scoring rubric
    medium-01-multi-file-feature/
      task.md                                        # Multi-file feature task + scoring rubric
      setup/
        src/
          index.ts                                   # Minimal entry point placeholder
        package.json                                 # Minimal package.json with TS devDependency
    medium-02-refactor-extract-module/
      task.md                                        # Refactoring task + scoring rubric
      setup/
        src/
          monolith.ts                                # ~200-line monolithic task runner
    hard-01-cross-cutting-change/
      task.md                                        # Cross-cutting change task + scoring rubric
      setup/
        src/
          logger.ts                                  # Naive logger (re-exports console.log)
          user-service.ts                            # User CRUD with 3 console calls
          order-service.ts                           # Order processing with 4 console calls
          payment-service.ts                         # Payment handling with 5 console calls
        tsconfig.json                                # Standard TypeScript config
```

## Implementation Order and Batching

### Batch 1: Foundation + Easy Tasks (4 files)

**Files:**
1. `benchmark-suite/config.md`
2. `benchmark-suite/tasks/easy-01-single-file-bugfix/task.md`
3. `benchmark-suite/tasks/easy-01-single-file-bugfix/setup/src/string-utils.ts`
4. `benchmark-suite/tasks/easy-01-single-file-bugfix/setup/src/string-utils.test.ts`

**Why first:** config.md establishes the suite structure. Easy-01 is the most complex easy task (has setup files with intentional bugs + tests) and sets the pattern for all other task.md files.

### Batch 2: Easy-02 + Medium-01 (4 files)

**Files:**
1. `benchmark-suite/tasks/easy-02-add-utility-function/task.md`
2. `benchmark-suite/tasks/medium-01-multi-file-feature/task.md`
3. `benchmark-suite/tasks/medium-01-multi-file-feature/setup/src/index.ts`
4. `benchmark-suite/tasks/medium-01-multi-file-feature/setup/package.json`

**Why second:** Easy-02 has no setup files (simplest task). Medium-01 setup files are trivial (placeholder entry point + package.json).

### Batch 3: Medium-02 (2 files)

**Files:**
1. `benchmark-suite/tasks/medium-02-refactor-extract-module/task.md`
2. `benchmark-suite/tasks/medium-02-refactor-extract-module/setup/src/monolith.ts`

**Why separate:** The monolith.ts is the most complex single setup file (~200 lines). Needs dedicated attention to get the code realistic and correctly structured.

### Batch 4: Hard-01 (6 files)

**Files:**
1. `benchmark-suite/tasks/hard-01-cross-cutting-change/task.md`
2. `benchmark-suite/tasks/hard-01-cross-cutting-change/setup/src/logger.ts`
3. `benchmark-suite/tasks/hard-01-cross-cutting-change/setup/src/user-service.ts`
4. `benchmark-suite/tasks/hard-01-cross-cutting-change/setup/src/order-service.ts`
5. `benchmark-suite/tasks/hard-01-cross-cutting-change/setup/src/payment-service.ts`
6. `benchmark-suite/tasks/hard-01-cross-cutting-change/setup/tsconfig.json`

**Why last:** Most files, most complexity. The four service files must be realistic and internally consistent. The logger.ts must be naive enough to justify replacement.

---

## Per-File Specifications

---

### Batch 1

---

#### 1. `benchmark-suite/config.md`

The suite configuration document. Follow the exact structure from Requirement 8 in task-description.md.

**Must contain:**

1. **Header**: "Benchmark Suite Configuration"
2. **Task Manifest table** with all 5 tasks:

| Task ID | Difficulty | Type | Est. Time |
|---|---|---|---|
| easy-01-single-file-bugfix | easy | bugfix | 5m |
| easy-02-add-utility-function | easy | feature | 8m |
| medium-01-multi-file-feature | medium | feature | 20m |
| medium-02-refactor-extract-module | medium | refactoring | 15m |
| hard-01-cross-cutting-change | hard | feature | 30m |

3. **Difficulty Weights table**: easy=1.0, medium=1.5, hard=2.0
4. **Scoring Dimensions table**: Correctness, Code Quality, Completeness, Error Handling -- each with a one-line description
5. **Extending with Project-Specific Tasks** section:
   - Convention: `benchmark-suite/tasks/custom-{NN}-{slug}/`
   - Custom tasks follow the same task.md format
   - Custom tasks appear after generic tasks in the manifest
   - Custom tasks can define additional scoring dimensions beyond the standard four
   - Step-by-step instructions for adding a custom task (create dir, create task.md, add setup files, add to manifest)
6. **How the Evaluation Supervisor Loads Tasks** section:
   - Scans all subdirectories of `benchmark-suite/tasks/`
   - Identifies task type by directory prefix (`easy-`, `medium-`, `hard-`, `custom-`)
   - Custom tasks have difficulty specified in their task.md Metadata table (not inferred from prefix)
   - Custom task results reported separately from generic task aggregate scores

---

#### 2. `benchmark-suite/tasks/easy-01-single-file-bugfix/task.md`

Follow the exact task.md template from Requirement 2.

**Metadata table:**
- Difficulty: easy
- Type: bugfix
- Estimated Time: 5m
- Setup Required: yes

**Description:**
A `src/string-utils.ts` file contains three utility functions with subtle bugs. The model must identify and fix all three bugs. A test file (`src/string-utils.test.ts`) is provided with failing tests that document the expected behavior. All previously passing tests must continue to pass.

The three bugs:
1. `truncate(str, maxLength)` -- Off-by-one: truncates at `maxLength` instead of `maxLength - 3`, so output with "..." exceeds maxLength.
2. `capitalize(str)` -- Fails on multiple consecutive spaces (either collapses them or crashes).
3. `slugify(str)` -- Does not handle special characters; accented letters become "-" instead of being stripped or transliterated.

**Setup Instructions:**
1. Copy `setup/` contents into the worktree root
2. The `src/string-utils.ts` file contains the buggy implementations
3. The `src/string-utils.test.ts` file contains failing tests

**Requirements Checklist** (copy exactly from Requirement 3):

Correctness:
- `truncate("Hello World", 8)` returns `"Hell..."` (length exactly 8)
- `truncate("Hi", 10)` returns `"Hi"` (no truncation when under limit)
- `truncate("Hello", 5)` returns `"Hello"` (no truncation at exact limit)
- `capitalize("hello  world")` returns `"Hello  World"` (preserves multiple spaces)
- `capitalize("")` returns `""` (empty string edge case)
- `slugify("Hello World!")` returns `"hello-world"` (strips special chars)
- `slugify("Cafe Latte")` returns `"cafe-latte"` (handles accented/special characters gracefully)

Code Quality:
- Bug fixes are minimal -- only broken logic changed, not wholesale rewrites
- No `any` types introduced
- Existing function signatures preserved

Completeness:
- All three bugs identified and fixed
- All existing passing tests still pass
- All previously failing tests now pass

Error Handling:
- Functions handle `null`/`undefined` input without throwing (if TS strict mode allows)
- `truncate` handles `maxLength <= 3` gracefully (returns truncated without "...")

**Scoring Guide:** Map each dimension to 1-3 (failing), 4-6 (partial), 7-8 (good), 9-10 (excellent) with observable criteria. Reference the Requirement 2 template for format.

---

#### 3. `benchmark-suite/tasks/easy-01-single-file-bugfix/setup/src/string-utils.ts`

**This is a critical file -- it contains intentionally buggy TypeScript that must compile and run, but produce wrong results.**

Three exported functions, each with a specific bug:

```typescript
/**
 * truncate -- BUG: off-by-one error
 * Current (buggy): slices at maxLength then appends "..."
 * Result: output length = maxLength + 3 (exceeds limit)
 * Correct: should slice at maxLength - 3, then append "..."
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) {
    return str;
  }
  return str.slice(0, maxLength) + '...';  // BUG: should be maxLength - 3
}

/**
 * capitalize -- BUG: fails on multiple consecutive spaces
 * Current (buggy): splits on single space, capitalizes, joins with single space
 * Result: multiple spaces are collapsed to one
 * Correct: should preserve the original spacing
 */
export function capitalize(str: string): string {
  return str
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');  // BUG: split(' ') creates empty strings for consecutive spaces,
                 // but map + join collapses them. Or use a regex approach that
                 // replaces first char of each word while preserving whitespace.
}

/**
 * slugify -- BUG: does not handle special/accented characters
 * Current (buggy): lowercases, replaces spaces with hyphens, but leaves
 * accented characters as-is or replaces them with hyphens incorrectly
 * Correct: should strip or transliterate accented characters, then clean up
 */
export function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '-')  // BUG: replaces special chars with '-'
    .replace(/\s+/g, '-')            //       instead of stripping/transliterating
    .replace(/-+/g, '-')             //       accented chars like e-acute
    .replace(/^-|-$/g, '');
}
```

**Key requirements for this file:**
- Must compile without errors (`tsc --noEmit` passes)
- Each function has JSDoc explaining what it should do
- The bugs must be subtle but clearly discoverable by reading the code + running tests
- The `capitalize` bug: when you `split(' ')` on `"hello  world"`, you get `["hello", "", "world"]`. The empty string gets `.charAt(0).toUpperCase()` which returns `""`, and when joined back, the double space is lost. The developer should make this actually fail -- e.g., filter out empty strings, or the join collapses them.
- The `slugify` bug: `"Cafe Latte"` (with e-acute on the e in Cafe) becomes `"caf--latte"` or `"caf-latte"` instead of `"cafe-latte"`. The regex `[^a-z0-9\s-]` treats the accented e as a non-matching character and replaces it with `-`.

---

#### 4. `benchmark-suite/tasks/easy-01-single-file-bugfix/setup/src/string-utils.test.ts`

**Test file with failing tests documenting expected behavior.**

Use a simple test runner pattern (no external test framework dependency -- project-agnostic). Use a minimal `assert`-style approach or just plain Node.js `assert`:

```typescript
import { truncate, capitalize, slugify } from './string-utils';

// Simple test helper
function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`FAIL: ${message}`);
  }
}

function assertEqual(actual: unknown, expected: unknown, message: string): void {
  if (actual !== expected) {
    throw new Error(`FAIL: ${message}\n  Expected: ${JSON.stringify(expected)}\n  Actual:   ${JSON.stringify(actual)}`);
  }
}

// --- truncate tests ---

// These PASS with buggy code:
assertEqual(truncate('Hi', 10), 'Hi', 'truncate: no truncation when under limit');
assertEqual(truncate('Hello', 5), 'Hello', 'truncate: no truncation at exact limit');

// These FAIL with buggy code:
assertEqual(truncate('Hello World', 8), 'Hell...', 'truncate: truncated output length should be exactly maxLength');
// Buggy code returns 'Hello Wo...' (length 11) instead of 'Hell...' (length 8)

// --- capitalize tests ---

// These PASS with buggy code:
assertEqual(capitalize('hello world'), 'Hello World', 'capitalize: basic case');

// These FAIL with buggy code:
assertEqual(capitalize('hello  world'), 'Hello  World', 'capitalize: preserves multiple spaces');
assertEqual(capitalize(''), '', 'capitalize: empty string');
// Buggy code returns 'Hello World' (single space) instead of 'Hello  World' (double space)

// --- slugify tests ---

// These PASS with buggy code:
assertEqual(slugify('Hello World'), 'hello-world', 'slugify: basic case');

// These FAIL with buggy code:
assertEqual(slugify('Hello World!'), 'hello-world', 'slugify: strips special characters');
assertEqual(slugify('Caf\u00e9 Latt\u00e9'), 'cafe-latte', 'slugify: handles accented characters');
// Buggy code returns 'caf--latte' or similar because accented e becomes '-'

console.log('All tests passed!');
```

**Key requirements:**
- No external test framework (project-agnostic -- must work with just `ts-node` or `tsx`)
- Tests that should PASS with the buggy code do pass (to verify the bugs are targeted)
- Tests that should FAIL with the buggy code do fail (to document expected behavior)
- Use `\u00e9` for e-acute in the source code to avoid encoding issues
- Include comments explaining which tests pass and which fail with the buggy code

---

### Batch 2

---

#### 5. `benchmark-suite/tasks/easy-02-add-utility-function/task.md`

Follow exact task.md template.

**Metadata:** Difficulty: easy, Type: feature, Estimated Time: 8m, Setup Required: no

**Description:**
Create a new `src/array-utils.ts` module from scratch with three generic utility functions:

1. `chunk<T>(array: T[], size: number): T[][]` -- Split array into chunks. Last chunk may be smaller.
2. `unique<T>(array: T[], keyFn?: (item: T) => unknown): T[]` -- Unique elements. Optional keyFn for custom equality. Without keyFn, use strict equality.
3. `groupBy<T>(array: T[], keyFn: (item: T) => string): Record<string, T[]>` -- Group by string key.

**Setup Instructions:**
1. Initialize a minimal TypeScript project (tsconfig.json + package.json)
2. Create `src/array-utils.ts` from scratch

**Requirements Checklist** (copy from Requirement 4):

Correctness:
- `chunk([1,2,3,4,5], 2)` returns `[[1,2],[3,4],[5]]`
- `chunk([], 3)` returns `[]`
- `unique([1,2,2,3,1])` returns `[1,2,3]`
- `unique([{id:1,n:"a"},{id:1,n:"b"}], x => x.id)` returns `[{id:1,n:"a"}]`
- `groupBy(["one","two","three"], s => String(s.length))` returns `{"3":["one","two"],"5":["three"]}`

Code Quality:
- All functions use proper TypeScript generics (no `any`)
- Functions exported with named exports
- Readable with clear variable names
- JSDoc comments on all three functions

Completeness:
- All three functions implemented
- File at correct path (`src/array-utils.ts`)
- All specified signatures respected exactly

Error Handling:
- `chunk` throws or returns `[]` for `size <= 0`
- `chunk` handles `size > array.length` (returns single chunk)
- `unique` handles empty array
- `groupBy` handles empty array (returns `{}`)

**Scoring Guide:** Standard 1-10 rubric per dimension.

---

#### 6. `benchmark-suite/tasks/medium-01-multi-file-feature/task.md`

Follow exact task.md template.

**Metadata:** Difficulty: medium, Type: feature, Estimated Time: 20m, Setup Required: yes

**Description:**
Build an in-memory key-value store with TTL support spanning three files:

1. `src/cache/types.ts` -- Type definitions:
   - `CacheEntry<T>`: `{ value: T; expiresAt: number | null }`
   - `CacheOptions`: `{ defaultTTL?: number; maxSize?: number; onEvict?: (key: string, value: unknown) => void }`

2. `src/cache/cache.ts` -- `Cache<T>` class with:
   - Constructor accepting `CacheOptions`
   - `set(key, value, ttl?)` -- stores with optional TTL (ms). Falls back to defaultTTL. No TTL = no expiry.
   - `get(key)` -- returns value if not expired, removes + returns undefined if expired (lazy expiration)
   - `has(key)` -- checks existence AND expiration
   - `delete(key)` -- removes entry, calls onEvict
   - `clear()` -- removes all, calls onEvict for each
   - `size()` -- count of non-expired entries
   - maxSize eviction: evict oldest entry (LRU by insertion order) on set

3. `src/cache/index.ts` -- barrel export

**Setup Instructions:**
1. Copy `setup/` contents into worktree root
2. `setup/src/index.ts` exists as entry point
3. `setup/package.json` provides TypeScript dependency

**Requirements Checklist** (copy from Requirement 5 -- all items under Correctness, Code Quality, Completeness, Error Handling).

**Scoring Guide:** Standard 1-10 rubric per dimension.

---

#### 7. `benchmark-suite/tasks/medium-01-multi-file-feature/setup/src/index.ts`

Minimal entry point. Content:

```typescript
// Entry point -- implement the cache module in src/cache/
export {};
```

Just a placeholder so the src/ directory exists and the model knows where to build.

---

#### 8. `benchmark-suite/tasks/medium-01-multi-file-feature/setup/package.json`

Minimal package.json:

```json
{
  "name": "benchmark-medium-01",
  "version": "1.0.0",
  "private": true,
  "devDependencies": {
    "typescript": "^5.0.0"
  }
}
```

No other dependencies. Keep it minimal.

---

### Batch 3

---

#### 9. `benchmark-suite/tasks/medium-02-refactor-extract-module/task.md`

Follow exact task.md template.

**Metadata:** Difficulty: medium, Type: refactoring, Estimated Time: 15m, Setup Required: yes

**Description:**
A single `src/monolith.ts` (~200 lines) contains a task runner with three concerns mixed together: task parsing, task scheduling (topological sort), and task execution (async with timing). The model must extract these into separate modules while preserving the public API.

Target structure:
- `src/task-runner/parser.ts` -- `parseTasks(config: TaskConfig): Task[]`
- `src/task-runner/scheduler.ts` -- `scheduleTasks(tasks: Task[]): Task[]` (topologically sorted)
- `src/task-runner/executor.ts` -- `executeTasks(tasks: Task[]): Promise<ExecutionResult[]>`
- `src/task-runner/types.ts` -- shared type definitions
- `src/task-runner/index.ts` -- barrel export preserving original public API

The original `src/monolith.ts` must be deleted.

**Requirements Checklist** (copy from Requirement 6).

**Scoring Guide:** Standard 1-10 rubric per dimension.

---

#### 10. `benchmark-suite/tasks/medium-02-refactor-extract-module/setup/src/monolith.ts`

**This is the most complex single setup file. Must be ~200 lines of working but poorly organized TypeScript.**

The file must contain ALL of the following, interleaved (not cleanly separated):

**Type definitions (mixed in with logic):**
```typescript
// TaskStatus type
type TaskStatus = 'pending' | 'running' | 'completed' | 'failed';

// Task interface
interface Task {
  id: string;
  name: string;
  dependencies: string[];
  execute: () => Promise<void>;
  status: TaskStatus;
}

// TaskConfig -- the input format
interface TaskConfig {
  tasks: Array<{
    id: string;
    name: string;
    dependencies?: string[];
    handler: () => Promise<void>;
  }>;
}

// ExecutionResult
interface ExecutionResult {
  taskId: string;
  status: TaskStatus;
  duration: number;  // milliseconds
  error?: string;
}
```

**parseTasks function (~30 lines):**
- Takes a TaskConfig object
- Validates that task IDs are unique
- Validates that all dependency references point to existing task IDs
- Returns an array of Task objects with status initialized to 'pending'
- Throws on invalid input (missing id, duplicate ids, unknown dependencies)

**scheduleTasks function (~50 lines):**
- Takes Task[] and returns them in topological order (dependencies before dependents)
- Uses Kahn's algorithm or DFS-based topological sort
- Detects circular dependencies and throws an error with the cycle path
- This is the most algorithmically complex part

**executeTasks function (~40 lines):**
- Takes a topologically sorted Task[]
- Runs tasks sequentially in order
- For each task: sets status to 'running', records start time, calls execute(), records end time, sets status to 'completed' or 'failed'
- Returns ExecutionResult[] with timing and status per task
- Individual task failures do not stop the runner -- subsequent tasks whose dependencies all succeeded still run; tasks whose dependencies failed are skipped (marked 'failed')

**runTasks function (~10 lines) -- the public API:**
```typescript
export async function runTasks(config: TaskConfig): Promise<ExecutionResult[]> {
  const tasks = parseTasks(config);
  const sorted = scheduleTasks(tasks);
  return executeTasks(sorted);
}
```

**Key requirements for this file:**
- Must compile with `tsc --noEmit`
- Must be working code (not stubs) -- if you called `runTasks()` with a valid config, it would work
- The code should be realistic but clearly in need of refactoring (everything in one file, types mixed with logic, no clear module boundaries)
- Export only `runTasks` and the types (`Task`, `TaskConfig`, `ExecutionResult`, `TaskStatus`) -- this is the public API the refactored version must preserve
- Total length: approximately 180-220 lines including comments and blank lines

---

### Batch 4

---

#### 11. `benchmark-suite/tasks/hard-01-cross-cutting-change/task.md`

Follow exact task.md template.

**Metadata:** Difficulty: hard, Type: feature, Estimated Time: 30m, Setup Required: yes

**Description:**
An existing codebase has four files. A naive `logger.ts` just re-exports console.log. Three service files each do their own ad-hoc console logging. The model must:

1. Replace `src/logger.ts` with a structured Logger:
   - `Logger` class with configurable log levels: debug, info, warn, error
   - Structured JSON output: `{ timestamp, level, service, message, data? }`
   - `createLogger(serviceName, options?)` factory function
   - `LoggerOptions`: `{ level?: LogLevel; output?: (entry: LogEntry) => void }`
   - Level filtering (setting level to "warn" suppresses debug and info)

2. Refactor all three services to use the structured logger (replace every console.log/warn/error call)

3. Preserve all existing service functionality

**Requirements Checklist** (copy from Requirement 7 -- all items).

**Scoring Guide:** Standard 1-10 rubric per dimension.

---

#### 12. `benchmark-suite/tasks/hard-01-cross-cutting-change/setup/src/logger.ts`

Naive logger that the model must replace entirely:

```typescript
// Naive logger -- just wraps console methods
// This should be replaced with a structured logger

export const log = console.log;
export const warn = console.warn;
export const error = console.error;

export function createLogger(serviceName: string) {
  return {
    log: (...args: unknown[]) => console.log(`[${serviceName}]`, ...args),
    warn: (...args: unknown[]) => console.warn(`[${serviceName}]`, ...args),
    error: (...args: unknown[]) => console.error(`[${serviceName}]`, ...args),
  };
}
```

**Key requirements:**
- Simple, naive, clearly insufficient
- The `createLogger` function exists but returns a plain object with console wrappers (not a proper Logger class)
- No structured output, no level filtering, no JSON, no types
- Must be valid TypeScript

---

#### 13. `benchmark-suite/tasks/hard-01-cross-cutting-change/setup/src/user-service.ts`

A realistic user CRUD service with **3 direct console calls** mixed in:

```typescript
import { log, error } from './logger';

interface User {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
}

const users = new Map<string, User>();

export function createUser(name: string, email: string): User {
  const id = Math.random().toString(36).substring(2, 10);
  const user: User = { id, name, email, createdAt: new Date() };
  users.set(id, user);
  console.log(`User created: ${id} - ${name}`);          // console call 1
  return user;
}

export function getUser(id: string): User | undefined {
  return users.get(id);
}

export function deleteUser(id: string): boolean {
  const user = users.get(id);
  if (!user) {
    console.error(`Failed to delete: user ${id} not found`);  // console call 2
    return false;
  }
  users.delete(id);
  console.log(`User deleted: ${id}`);                     // console call 3
  return true;
}
```

**Key requirements:**
- 3 console calls: 2x `console.log`, 1x `console.error`
- Some use the imported `log`/`error` from logger.ts, some use `console` directly -- mix the patterns to make refactoring non-trivial
- Working CRUD operations (not stubs)
- Uses an in-memory Map for storage

**Variation note for the developer:** You can make 1-2 of the calls use the imported `log`/`error` and the remaining use `console.log`/`console.error` directly. This tests whether the model catches both patterns.

---

#### 14. `benchmark-suite/tasks/hard-01-cross-cutting-change/setup/src/order-service.ts`

Order processing service with **4 direct console calls**:

```typescript
import { log, warn } from './logger';

interface Order {
  id: string;
  userId: string;
  items: Array<{ productId: string; quantity: number; price: number }>;
  total: number;
  status: 'pending' | 'processing' | 'completed' | 'cancelled';
  createdAt: Date;
}

const orders = new Map<string, Order>();

export function createOrder(userId: string, items: Order['items']): Order {
  const id = `ORD-${Date.now()}`;
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const order: Order = { id, userId, items, total, status: 'pending', createdAt: new Date() };
  orders.set(id, order);
  console.log(`Order created: ${id} for user ${userId}, total: $${total}`);  // call 1
  return order;
}

export function processOrder(orderId: string): boolean {
  const order = orders.get(orderId);
  if (!order) {
    console.error(`Order ${orderId} not found`);          // call 2
    return false;
  }
  if (order.status !== 'pending') {
    console.warn(`Order ${orderId} cannot be processed - status: ${order.status}`);  // call 3
    return false;
  }
  order.status = 'processing';
  console.log(`Order ${orderId} is now processing`);      // call 4
  return true;
}

export function cancelOrder(orderId: string): boolean {
  const order = orders.get(orderId);
  if (!order || order.status === 'completed') return false;
  order.status = 'cancelled';
  return true;
}
```

**Key requirements:**
- 4 console calls: 2x `console.log`, 1x `console.error`, 1x `console.warn`
- Imports `log` and `warn` from logger but may not use them (or uses a mix) -- creates inconsistency the model must resolve
- Realistic order processing with status transitions
- Uses in-memory Map

---

#### 15. `benchmark-suite/tasks/hard-01-cross-cutting-change/setup/src/payment-service.ts`

Payment handling service with **5 direct console calls**:

```typescript
import { log, error } from './logger';

interface Payment {
  id: string;
  orderId: string;
  amount: number;
  method: 'credit_card' | 'bank_transfer' | 'wallet';
  status: 'pending' | 'authorized' | 'captured' | 'failed' | 'refunded';
  createdAt: Date;
}

const payments = new Map<string, Payment>();

export function initiatePayment(orderId: string, amount: number, method: Payment['method']): Payment {
  const id = `PAY-${Date.now()}`;
  const payment: Payment = { id, orderId, amount, method, status: 'pending', createdAt: new Date() };
  payments.set(id, payment);
  console.log(`Payment initiated: ${id} for order ${orderId}, $${amount} via ${method}`);  // call 1
  return payment;
}

export function authorizePayment(paymentId: string): boolean {
  const payment = payments.get(paymentId);
  if (!payment) {
    console.error(`Payment ${paymentId} not found`);       // call 2
    return false;
  }
  if (payment.status !== 'pending') {
    console.warn(`Payment ${paymentId} cannot be authorized - status: ${payment.status}`);  // call 3
    return false;
  }
  // Simulate authorization
  const authorized = Math.random() > 0.1;  // 90% success rate
  if (authorized) {
    payment.status = 'authorized';
    console.log(`Payment ${paymentId} authorized`);        // call 4
  } else {
    payment.status = 'failed';
    console.error(`Payment ${paymentId} authorization failed`);  // call 5
  }
  return authorized;
}

export function refundPayment(paymentId: string): boolean {
  const payment = payments.get(paymentId);
  if (!payment || payment.status !== 'captured') return false;
  payment.status = 'refunded';
  return true;
}
```

**Key requirements:**
- 5 console calls: 2x `console.log`, 2x `console.error`, 1x `console.warn`
- Most console calls of any service -- tests thoroughness
- Imports from logger but uses console directly -- inconsistency pattern
- Realistic payment flow with status transitions
- Simulated authorization with random success/failure

---

#### 16. `benchmark-suite/tasks/hard-01-cross-cutting-change/setup/tsconfig.json`

Standard TypeScript config:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

---

## Developer Guidance

### task.md Scoring Guide Format

Every task.md must include a scoring guide table. Use this format for all five tasks:

```markdown
## Scoring Guide

| Dimension      | 1-3 (Failing)                      | 4-6 (Partial)                       | 7-8 (Good)                          | 9-10 (Excellent)                     |
|----------------|-------------------------------------|--------------------------------------|--------------------------------------|--------------------------------------|
| Correctness    | [specific failing observable]       | [specific partial observable]        | [specific good observable]           | [specific excellent observable]      |
| Code Quality   | [specific failing observable]       | [specific partial observable]        | [specific good observable]           | [specific excellent observable]      |
| Completeness   | [specific failing observable]       | [specific partial observable]        | [specific good observable]           | [specific excellent observable]      |
| Error Handling | [specific failing observable]       | [specific partial observable]        | [specific good observable]           | [specific excellent observable]      |
```

Each cell must describe an **observable outcome**, not a vague judgment. For example:
- Good: "2 of 3 bugs fixed, all fixed bugs pass tests"
- Bad: "Most bugs fixed"

### Setup File Quality Bar

All setup TypeScript files must:
1. Compile without errors with `tsc --noEmit` (assuming tsconfig with strict: true)
2. Be realistic code (not lorem-ipsum stubs)
3. Have intentional flaws that are specific, documented (in the task.md), and discoverable
4. Use only Node.js standard library -- no external packages

### No Project-Specific References

Zero tolerance. No imports from:
- `@itqanlab/*`
- Any Electron APIs
- Any nitro-fueled internals
- Any npm packages (except TypeScript as a devDependency in package.json)

---

## Team-Leader Handoff

### Developer Type Recommendation
**Recommended Developer**: nitro-backend-developer
**Rationale**: All files are markdown and TypeScript. No frontend, no UI. The setup TypeScript files require understanding of data structures, algorithms (topological sort), and realistic service patterns.

### Complexity Assessment
**Complexity**: MEDIUM
**Estimated Effort**: 2-3 hours across 4 batches

### Files Affected Summary

**CREATE (20 files):**
- `benchmark-suite/config.md`
- `benchmark-suite/tasks/easy-01-single-file-bugfix/task.md`
- `benchmark-suite/tasks/easy-01-single-file-bugfix/setup/src/string-utils.ts`
- `benchmark-suite/tasks/easy-01-single-file-bugfix/setup/src/string-utils.test.ts`
- `benchmark-suite/tasks/easy-02-add-utility-function/task.md`
- `benchmark-suite/tasks/medium-01-multi-file-feature/task.md`
- `benchmark-suite/tasks/medium-01-multi-file-feature/setup/src/index.ts`
- `benchmark-suite/tasks/medium-01-multi-file-feature/setup/package.json`
- `benchmark-suite/tasks/medium-02-refactor-extract-module/task.md`
- `benchmark-suite/tasks/medium-02-refactor-extract-module/setup/src/monolith.ts`
- `benchmark-suite/tasks/hard-01-cross-cutting-change/task.md`
- `benchmark-suite/tasks/hard-01-cross-cutting-change/setup/src/logger.ts`
- `benchmark-suite/tasks/hard-01-cross-cutting-change/setup/src/user-service.ts`
- `benchmark-suite/tasks/hard-01-cross-cutting-change/setup/src/order-service.ts`
- `benchmark-suite/tasks/hard-01-cross-cutting-change/setup/src/payment-service.ts`
- `benchmark-suite/tasks/hard-01-cross-cutting-change/setup/tsconfig.json`

**MODIFY**: None
**DELETE**: None
