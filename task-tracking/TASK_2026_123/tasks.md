# Development Tasks - TASK_2026_123

**Total Tasks**: 16 | **Batches**: 4 | **Status**: 4/4 IMPLEMENTED

---

## Plan Validation Summary

**Validation Status**: PASSED WITH RISKS

### Assumptions Verified

- Directory `benchmark-suite/` does not exist -- all files are new creations: Verified
- No external dependencies needed -- all TypeScript files use only Node.js standard library: Verified
- No cross-batch dependencies on existing project code: Verified

### Risks Identified

| Risk | Severity | Mitigation |
|------|----------|------------|
| `capitalize` bug implementation ambiguity -- plan offers two approaches (filter empty strings vs join collapse) | LOW | Developer must pick an approach that demonstrably fails the test case `"hello  world"` -> `"Hello  World"`. Task 1.3 notes this. |
| TypeScript files cannot be validated with `tsc --noEmit` without a tsconfig in scope | LOW | Code review will verify syntax correctness manually. |

---

## Batch 1: Foundation + Easy-01 Bugfix Task  IN PROGRESS

**Developer**: nitro-backend-developer
**Tasks**: 4 | **Dependencies**: None

### Task 1.1: Create benchmark suite configuration IMPLEMENTED

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/benchmark-suite/config.md`
**Status**: IMPLEMENTED
**Developer**: nitro-backend-developer
**Spec Reference**: implementation-plan.md lines 96-125

Create the suite configuration document with:
- Header: "Benchmark Suite Configuration"
- Task Manifest table with all 5 tasks (easy-01, easy-02, medium-01, medium-02, hard-01) including difficulty, type, and estimated time
- Difficulty Weights table: easy=1.0, medium=1.5, hard=2.0
- Scoring Dimensions table: Correctness, Code Quality, Completeness, Error Handling -- each with a one-line description
- "Extending with Project-Specific Tasks" section with convention (`custom-{NN}-{slug}/`), step-by-step instructions
- "How the Evaluation Supervisor Loads Tasks" section explaining directory scanning, prefix-based identification, custom task difficulty from metadata

---

### Task 1.2: Create easy-01 bugfix task description IMPLEMENTED

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/benchmark-suite/tasks/easy-01-single-file-bugfix/task.md`
**Status**: IMPLEMENTED
**Developer**: nitro-backend-developer
**Spec Reference**: implementation-plan.md lines 128-176

Create task.md following the exact template from Requirement 2. Must include:
- Metadata table: difficulty=easy, type=bugfix, estimated-time=5m, setup-required=yes
- Description of the three bugs (truncate off-by-one, capitalize space-collapse, slugify accent handling)
- Setup Instructions (copy setup/ contents)
- Requirements Checklist with all items under Correctness, Code Quality, Completeness, Error Handling (copy exactly from implementation plan lines 151-175)
- Scoring Guide table with observable criteria for each dimension at each level (1-3, 4-6, 7-8, 9-10)

---

### Task 1.3: Create buggy string-utils.ts setup file IMPLEMENTED

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/benchmark-suite/tasks/easy-01-single-file-bugfix/setup/src/string-utils.ts`
**Status**: IMPLEMENTED
**Developer**: nitro-backend-developer
**Spec Reference**: implementation-plan.md lines 180-236

Create TypeScript file with three exported functions, each containing a specific intentional bug:
- `truncate(str, maxLength)`: Bug -- slices at `maxLength` then appends "...", so output exceeds maxLength. Should slice at `maxLength - 3`.
- `capitalize(str)`: Bug -- splits on single space, which creates empty strings for consecutive spaces. The `map` + `join` collapses multiple spaces to one.
- `slugify(str)`: Bug -- regex `[^a-z0-9\s-]` replaces accented chars (like e-acute) with '-' instead of stripping/transliterating them.

**Validation Notes**:
- The `capitalize` bug must demonstrably fail: `capitalize("hello  world")` must NOT return `"Hello  World"`. The split/map/join approach collapses double spaces. Developer should verify this behavior.
- All three functions must have JSDoc explaining intended behavior.
- File must compile without errors (bugs produce wrong results, not compilation failures).

---

### Task 1.4: Create string-utils test file IMPLEMENTED

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/benchmark-suite/tasks/easy-01-single-file-bugfix/setup/src/string-utils.test.ts`
**Status**: IMPLEMENTED
**Developer**: nitro-backend-developer
**Spec Reference**: implementation-plan.md lines 240-300

Create test file with:
- Simple `assert` and `assertEqual` helper functions (no external test framework)
- Tests for all three functions with clear comments marking which tests PASS and which FAIL with buggy code
- Use `\u00e9` for e-acute in slugify test (encoding safety)
- Tests that pass with buggy code: `truncate('Hi', 10)`, `truncate('Hello', 5)`, `capitalize('hello world')`, `slugify('Hello World')`
- Tests that fail with buggy code: `truncate('Hello World', 8)`, `capitalize('hello  world')`, `capitalize('')`, `slugify('Hello World!')`, `slugify('Caf\u00e9 Latt\u00e9')`
- Final `console.log('All tests passed!')` at end

---

**Batch 1 Verification**:
- All 4 files exist at specified paths
- config.md contains all required sections
- task.md follows exact template structure
- string-utils.ts contains three intentionally buggy functions
- string-utils.test.ts contains passing and failing test cases
- nitro-code-logic-reviewer approved

---

## Batch 2: Easy-02 + Medium-01 Tasks IMPLEMENTED

**Developer**: nitro-backend-developer
**Tasks**: 4 | **Dependencies**: Batch 1 (for pattern reference)

### Task 2.1: Create easy-02 utility function task description IMPLEMENTED

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/benchmark-suite/tasks/easy-02-add-utility-function/task.md`
**Status**: IMPLEMENTED
**Developer**: nitro-backend-developer
**Spec Reference**: implementation-plan.md lines 308-351

Create task.md following exact template. Must include:
- Metadata: difficulty=easy, type=feature, estimated-time=8m, setup-required=no
- Description of three generic utility functions to create: `chunk<T>`, `unique<T>`, `groupBy<T>`
- Setup Instructions: initialize minimal TypeScript project, create `src/array-utils.ts` from scratch
- Requirements Checklist with all Correctness, Code Quality, Completeness, Error Handling items from spec
- Scoring Guide table with observable criteria

---

### Task 2.2: Create medium-01 multi-file feature task description IMPLEMENTED

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/benchmark-suite/tasks/medium-01-multi-file-feature/task.md`
**Status**: IMPLEMENTED
**Developer**: nitro-backend-developer
**Spec Reference**: implementation-plan.md lines 355-388

Create task.md following exact template. Must include:
- Metadata: difficulty=medium, type=feature, estimated-time=20m, setup-required=yes
- Description of in-memory key-value store with TTL support spanning three files (types.ts, cache.ts, index.ts)
- Full specification of `Cache<T>` class methods: set, get, has, delete, clear, size
- Setup Instructions referencing the provided index.ts and package.json
- Requirements Checklist with all items from Requirement 5 in task-description.md
- Scoring Guide table

---

### Task 2.3: Create medium-01 setup entry point IMPLEMENTED

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/benchmark-suite/tasks/medium-01-multi-file-feature/setup/src/index.ts`
**Status**: IMPLEMENTED
**Developer**: nitro-backend-developer
**Spec Reference**: implementation-plan.md lines 392-399

Create minimal entry point placeholder:
```typescript
// Entry point -- implement the cache module in src/cache/
export {};
```

---

### Task 2.4: Create medium-01 setup package.json IMPLEMENTED

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/benchmark-suite/tasks/medium-01-multi-file-feature/setup/package.json`
**Status**: IMPLEMENTED
**Developer**: nitro-backend-developer
**Spec Reference**: implementation-plan.md lines 404-419

Create minimal package.json with name "benchmark-medium-01", version "1.0.0", private=true, and only TypeScript ^5.0.0 as devDependency. No other dependencies.

---

**Batch 2 Verification**:
- All 4 files exist at specified paths
- Both task.md files follow exact template structure
- index.ts is a minimal placeholder
- package.json has only TypeScript devDependency
- nitro-code-logic-reviewer approved

---

## Batch 3: Medium-02 Refactoring Task IMPLEMENTED

**Developer**: nitro-backend-developer
**Tasks**: 2 | **Dependencies**: Batch 1-2 (for task.md pattern)

### Task 3.1: Create medium-02 refactoring task description IMPLEMENTED

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/benchmark-suite/tasks/medium-02-refactor-extract-module/task.md`
**Status**: IMPLEMENTED
**Developer**: nitro-backend-developer
**Spec Reference**: implementation-plan.md lines 427-447

Create task.md following exact template. Must include:
- Metadata: difficulty=medium, type=refactoring, estimated-time=15m, setup-required=yes
- Description of extracting monolith.ts into parser.ts, scheduler.ts, executor.ts, types.ts, index.ts
- Target structure with file paths and function signatures
- Requirement that original monolith.ts must be deleted
- Requirements Checklist with all items from Requirement 6 in task-description.md
- Scoring Guide table

---

### Task 3.2: Create monolith.ts setup file IMPLEMENTED

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/benchmark-suite/tasks/medium-02-refactor-extract-module/setup/src/monolith.ts`
**Status**: IMPLEMENTED
**Developer**: nitro-backend-developer
**Spec Reference**: implementation-plan.md lines 451-525

Create ~200-line monolithic TypeScript file containing ALL of:
- Type definitions mixed with logic: `TaskStatus`, `Task`, `TaskConfig`, `ExecutionResult`
- `parseTasks(config)` (~30 lines): validates unique IDs, validates dependency references, returns Task[] with status='pending'
- `scheduleTasks(tasks)` (~50 lines): Kahn's algorithm or DFS topological sort, circular dependency detection with error
- `executeTasks(tasks)` (~40 lines): sequential execution, timing, per-task error capture, dependency-failure skipping
- `runTasks(config)` (~10 lines): public API composing parse -> schedule -> execute
- Export only `runTasks` and the types
- Must be working code (not stubs) -- calling `runTasks()` with valid config would work
- Total length: 180-220 lines including comments and blank lines

**Quality Requirements**:
- Code must be realistic but poorly organized (everything in one file, types mixed with logic)
- Must compile without errors conceptually (strict TypeScript)
- Uses only Node.js standard library

---

**Batch 3 Verification**:
- Both files exist at specified paths
- task.md follows exact template structure
- monolith.ts is approximately 180-220 lines
- monolith.ts contains working implementations of all four functions
- Types are exported alongside `runTasks`
- nitro-code-logic-reviewer approved

---

## Batch 4: Hard-01 Cross-Cutting Change Task IMPLEMENTED

**Developer**: nitro-backend-developer
**Tasks**: 6 | **Dependencies**: Batch 1-3 (for patterns)

### Task 4.1: Create hard-01 cross-cutting change task description IMPLEMENTED

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/benchmark-suite/tasks/hard-01-cross-cutting-change/task.md`
**Status**: IMPLEMENTED
**Developer**: nitro-backend-developer
**Spec Reference**: implementation-plan.md lines 530-556

Create task.md following exact template. Must include:
- Metadata: difficulty=hard, type=feature, estimated-time=30m, setup-required=yes
- Description of replacing naive logger with structured Logger class and refactoring all three services
- Full specification of Logger class, createLogger factory, LoggerOptions, LogLevel, LogEntry types
- Requirements Checklist with all items from Requirement 7 in task-description.md
- Scoring Guide table

---

### Task 4.2: Create naive logger.ts setup file IMPLEMENTED

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/benchmark-suite/tasks/hard-01-cross-cutting-change/setup/src/logger.ts`
**Status**: IMPLEMENTED
**Developer**: nitro-backend-developer
**Spec Reference**: implementation-plan.md lines 558-578

Create naive logger that wraps console methods:
- Export `log`, `warn`, `error` as direct console method references
- Export `createLogger(serviceName)` that returns plain object with console wrappers prefixed with `[serviceName]`
- No structured output, no level filtering, no JSON, no proper types
- Simple, naive, clearly insufficient -- must be valid TypeScript

---

### Task 4.3: Create user-service.ts setup file IMPLEMENTED

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/benchmark-suite/tasks/hard-01-cross-cutting-change/setup/src/user-service.ts`
**Status**: IMPLEMENTED
**Developer**: nitro-backend-developer
**Spec Reference**: implementation-plan.md lines 587-633

Create realistic user CRUD service with:
- `User` interface with id, name, email, createdAt
- In-memory Map storage
- `createUser(name, email)`: creates user, logs creation -- 1 console call
- `getUser(id)`: retrieves user
- `deleteUser(id)`: deletes user with error log on not-found -- 2 console calls
- Total: 3 console calls (mix of imported logger functions and direct `console.*` calls for non-trivial refactoring)

---

### Task 4.4: Create order-service.ts setup file IMPLEMENTED

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/benchmark-suite/tasks/hard-01-cross-cutting-change/setup/src/order-service.ts`
**Status**: IMPLEMENTED
**Developer**: nitro-backend-developer
**Spec Reference**: implementation-plan.md lines 639-690

Create realistic order processing service with:
- `Order` interface with id, userId, items array, total, status, createdAt
- In-memory Map storage
- `createOrder(userId, items)`: creates order with total calculation -- 1 console call
- `processOrder(orderId)`: validates and transitions status -- 2 console calls (error + warn for invalid states)
- `cancelOrder(orderId)`: cancels order
- Total: 4 console calls (mix of console.log, console.error, console.warn)
- Imports `log` and `warn` from logger but may use console directly -- inconsistency pattern

---

### Task 4.5: Create payment-service.ts setup file IMPLEMENTED

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/benchmark-suite/tasks/hard-01-cross-cutting-change/setup/src/payment-service.ts`
**Status**: IMPLEMENTED
**Developer**: nitro-backend-developer
**Spec Reference**: implementation-plan.md lines 695-749

Create realistic payment handling service with:
- `Payment` interface with id, orderId, amount, method, status, createdAt
- In-memory Map storage
- `initiatePayment(orderId, amount, method)`: creates payment -- 1 console call
- `authorizePayment(paymentId)`: simulates auth with 90% success rate -- 3 console calls (error for not-found, warn for invalid state, log/error for success/failure)
- `refundPayment(paymentId)`: refunds captured payment
- Total: 5 console calls (most of any service -- tests thoroughness)
- Imports from logger but uses console directly -- inconsistency pattern

---

### Task 4.6: Create tsconfig.json setup file IMPLEMENTED

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/benchmark-suite/tasks/hard-01-cross-cutting-change/setup/tsconfig.json`
**Status**: IMPLEMENTED
**Developer**: nitro-backend-developer
**Spec Reference**: implementation-plan.md lines 760-785

Create standard TypeScript config with:
- target: ES2020, module: commonjs, lib: [ES2020]
- outDir: ./dist, rootDir: ./src
- strict: true, esModuleInterop: true, skipLibCheck: true
- forceConsistentCasingInFileNames: true, resolveJsonModule: true
- declaration: true, declarationMap: true, sourceMap: true
- include: src/**/*, exclude: node_modules + dist

---

**Batch 4 Verification**:
- All 6 files exist at specified paths
- task.md follows exact template structure
- logger.ts is naive and clearly insufficient
- All three service files are realistic working code with correct console call counts
- Service files have mixed patterns (imported logger + direct console) for non-trivial refactoring
- tsconfig.json is standard and correct
- nitro-code-logic-reviewer approved
