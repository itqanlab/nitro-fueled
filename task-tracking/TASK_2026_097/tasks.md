# Development Tasks - TASK_2026_097

**Total Tasks**: 7 | **Batches**: 2 | **Status**: 0/2 complete

---

## Plan Validation Summary

**Validation Status**: PASSED

### Assumptions Verified

- Complexity estimator implementation: Verified - pure function with no side effects
- CLI integration: Verified - calls estimator for --quick mode
- Type exports: Verified - all types exported from complexity-estimator.ts
- Tier mapping logic: Verified - TIER_MAP constant defines correct mappings

### Risks Identified

| Risk                              | Severity | Mitigation                                           |
|-----------------------------------|----------|------------------------------------------------------|
| No test framework configured      | LOW      | Batch 1 Task 1.1 adds Vitest configuration          |
| Pattern matching edge cases       | LOW      | Comprehensive test cases in Batch 1                 |

---

## Batch 1: Test Infrastructure & Core Tests IN PROGRESS

**Developer**: nitro-backend-developer
**Tasks**: 4 | **Dependencies**: None

### Task 1.1: Add Vitest Configuration PENDING

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/cli/package.json`
**Spec Reference**: implementation-plan.md:412-418
**Pattern to Follow**: Standard Vitest ESM configuration

**Quality Requirements**:

- Add vitest to devDependencies
- Add test script to package.json
- Configuration must support ESM modules (type: module in package.json)

**Validation Notes**:

- Current package.json has no test framework
- Must use Vitest (lightweight, ESM-native)

**Implementation Details**:

- Add to devDependencies: `"vitest": "^1.0.0"`
- Add script: `"test": "vitest run"`
- Add script: `"test:watch": "vitest"`

---

### Task 1.2: Create Test File Scaffold PENDING

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/cli/src/utils/complexity-estimator.test.ts`
**Spec Reference**: implementation-plan.md:246-349
**Pattern to Follow**: Vitest describe/it pattern with imports

**Quality Requirements**:

- Import describe, it, expect from vitest
- Import estimateComplexity and all types from complexity-estimator.ts
- Organize tests by category (complex, simple, medium, priority, edge cases)

**Validation Notes**:

- Test file must be adjacent to source file for co-location

**Implementation Details**:

- Imports:
  ```typescript
  import { describe, it, expect } from 'vitest';
  import { estimateComplexity, type ComplexityTier, type Confidence, type PreferredTier } from './complexity-estimator.js';
  ```
- Structure: One describe block per test category

---

### Task 1.3: Implement Complex Tier Tests PENDING

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/cli/src/utils/complexity-estimator.test.ts`
**Spec Reference**: implementation-plan.md:255-270, task-description.md:35-36
**Pattern to Follow**: Implementation plan test cases lines 255-270

**Quality Requirements**:

- Test all complex patterns: scaffold, integrate, cross-service, architecture, pipeline
- Verify preferredTier is 'heavy' for complex tier
- Test high confidence when 2+ complex signals match
- Test low confidence fallback to medium

**Validation Notes**:

- Per implementation-plan.md:96-98, single complex signal = low confidence -> falls back to medium
- Per implementation-plan.md:97-98, 2+ complex signals = high confidence -> stays complex

**Implementation Details**:

- Test cases:
  - 'scaffold new authentication system' -> complex (low confidence -> medium after fallback)
  - 'integrate payment gateway' -> complex (low confidence -> medium after fallback)
  - 'scaffold cross-service architecture pipeline' -> complex, high confidence, heavy tier

---

### Task 1.4: Implement Simple Tier Tests PENDING

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/cli/src/utils/complexity-estimator.test.ts`
**Spec Reference**: implementation-plan.md:272-282, task-description.md:38-39
**Pattern to Follow**: Implementation plan test cases lines 272-282

**Quality Requirements**:

- Test all simple patterns: fix typo, update config, add field, rename
- Verify preferredTier is 'light' for simple tier
- Test that simple only applies when NO medium/complex patterns present

**Validation Notes**:

- Per implementation-plan.md:99-101, simple requires NO medium signals

**Implementation Details**:

- Test cases:
  - 'fix typo in README' -> simple, light tier
  - 'update config file' -> simple
  - 'fix typo and add endpoint' -> NOT simple (medium override)

---

## Batch 2: Complete Test Coverage PENDING

**Developer**: nitro-backend-developer
**Tasks**: 3 | **Dependencies**: Batch 1

### Task 2.1: Implement Medium Tier Tests PENDING

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/cli/src/utils/complexity-estimator.test.ts`
**Spec Reference**: implementation-plan.md:284-295, task-description.md:41-42
**Pattern to Follow**: Implementation plan test cases lines 284-295

**Quality Requirements**:

- Test all medium patterns: add endpoint, create component, refactor, implement
- Verify preferredTier is 'balanced' for medium tier
- Test high/low confidence logic for medium signals

**Validation Notes**:

- Per implementation-plan.md:102-104, medium requires at least 1 medium signal

**Implementation Details**:

- Test cases:
  - 'add new API endpoint' -> medium, balanced tier
  - 'refactor authentication module' -> medium
  - 'add endpoint for users' -> medium, balanced

---

### Task 2.2: Implement Priority Override Tests PENDING

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/cli/src/utils/complexity-estimator.test.ts`
**Spec Reference**: implementation-plan.md:297-311, task-description.md:31
**Pattern to Follow**: Implementation plan test cases lines 297-311

**Quality Requirements**:

- Test complex > medium > simple priority order
- Verify signals array captures all matched patterns
- Test mixed signal scenarios

**Validation Notes**:

- Per implementation-plan.md:96-109, complex takes priority, then medium, then simple

**Implementation Details**:

- Test cases:
  - 'integrate and refactor the module' -> complex (complex overrides medium)
  - 'scaffold new system - fix typo in docs' -> complex (complex overrides simple)
  - 'fix typo and add endpoint' -> medium (medium overrides simple)

---

### Task 2.3: Implement Edge Case Tests PENDING

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/cli/src/utils/complexity-estimator.test.ts`
**Spec Reference**: implementation-plan.md:313-349
**Pattern to Follow**: Implementation plan test cases lines 313-349

**Quality Requirements**:

- Test default to medium when no patterns match
- Test low confidence fallback to medium
- Test signal collection in signals array
- Test tier mapping (simple->light, medium->balanced, complex->heavy)

**Validation Notes**:

- Per implementation-plan.md:106-109, no signals -> medium with low confidence
- Per implementation-plan.md:112-114, low confidence -> always medium

**Implementation Details**:

- Test cases:
  - 'do something unusual' -> medium, low confidence
  - 'scaffold' (single signal) -> medium (low confidence fallback)
  - 'scaffold and integrate new pipeline' -> signals contain all matched words
  - 'fix typo' -> preferredTier: light
  - 'add endpoint for users' -> preferredTier: balanced
  - 'scaffold infrastructure' -> preferredTier: heavy

---

**Batch 1 Verification**:

- All files exist at paths
- Tests pass: `cd apps/cli && npm test`
- nitro-code-logic-reviewer approved

---

**Batch 2 Verification**:

- All files exist at paths
- Tests pass: `cd apps/cli && npm test`
- nitro-code-logic-reviewer approved
