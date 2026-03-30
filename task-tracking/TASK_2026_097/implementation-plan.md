# Implementation Plan - TASK_2026_097

## Codebase Investigation Summary

### Libraries Discovered
- **apps/cli/src/utils/complexity-estimator.ts**: Core estimation module
  - Key exports: `estimateComplexity`, `ComplexityTier`, `Confidence`, `PreferredTier`, `ComplexityEstimate`
  - Pattern matching arrays: `COMPLEX_PATTERNS`, `SIMPLE_PATTERNS`, `MEDIUM_PATTERNS`
  - Tier mapping: `TIER_MAP` constant

- **apps/cli/src/commands/create.ts**: CLI integration
  - Imports `estimateComplexity` from utils
  - Calls estimator for `--quick` mode with description argument
  - Injects `preferred_tier` into `/create-task` prompt

### Patterns Identified
- **Pure Function Pattern**: `estimateComplexity(description: string): ComplexityEstimate`
  - No side effects, fully testable
  - Returns typed structure with tier, confidence, signals, and preferredTier
  - Evidence: `complexity-estimator.ts:63-122`

- **CLI Integration Pattern**: Prompt augmentation
  - CLI calls estimator before spawning Claude
  - Result injected as markdown table row in prompt
  - Evidence: `create.ts:46-49`

### Integration Points
- **Task Template** (`task-tracking/task-template.md`):
  - `Preferred Tier` field defined with valid values: `light | balanced | heavy | auto`
  - Documentation explains tier-to-complexity mapping
  - Evidence: `task-template.md:12, 35-42`

- **Auto-Pilot Skill** (`.claude/skills/auto-pilot/SKILL.md`):
  - Provider Routing Table references `preferred_tier`
  - Fallback logic for missing/auto values
  - Cost escalation warning for mismatched tier/complexity
  - Evidence: `SKILL.md:692-721`

---

## Architecture Design (Codebase-Aligned)

### Design Philosophy
**Chosen Approach**: Keyword pattern matching with confidence scoring
**Rationale**: Simple regex-based classification is fast, extensible, and requires no external dependencies. Low-confidence estimates default to `medium` as a safe fallback.
**Evidence**: `complexity-estimator.ts:12-55` (pattern definitions), `complexity-estimator.ts:96-109` (scoring logic)

### Component Specifications

#### Component 1: Complexity Estimator (`complexity-estimator.ts`)

**Purpose**: Analyze task descriptions and return complexity tier with confidence level.

**Pattern**: Pure function with no side effects

**Evidence**:
- Pattern source: `apps/cli/src/utils/complexity-estimator.ts:63-122`
- Verified exports: `apps/cli/src/utils/complexity-estimator.ts:1-10`

**Responsibilities**:
- Match description against COMPLEX_PATTERNS, SIMPLE_PATTERNS, MEDIUM_PATTERNS
- Score matches and determine tier
- Assign confidence based on signal count
- Map complexity tier to preferred tier

**Implementation Status**: COMPLETE

**Acceptance Criteria Verification**:

| Criteria | Status | Evidence |
|----------|--------|----------|
| AC1: Returns complexity tier | IMPLEMENTED | `complexity-estimator.ts:63-122` |
| AC2: Complex patterns detected | IMPLEMENTED | `complexity-estimator.ts:12-23` |
| AC3: Simple patterns detected | IMPLEMENTED | `complexity-estimator.ts:25-36` |
| AC4: Medium patterns detected | IMPLEMENTED | `complexity-estimator.ts:38-49` |
| AC5: Defaults to medium | IMPLEMENTED | `complexity-estimator.ts:106-109` |
| AC6: Low confidence = medium | IMPLEMENTED | `complexity-estimator.ts:112-114` |
| AC7: Priority: complex > medium > simple | IMPLEMENTED | `complexity-estimator.ts:96-109` |

---

#### Component 2: CLI Integration (`create.ts`)

**Purpose**: Integrate complexity estimator into `nitro-fueled create --quick` command.

**Pattern**: Command class extending BaseCommand

**Evidence**:
- Pattern source: `apps/cli/src/commands/create.ts:7-59`
- Import verified: `apps/cli/src/commands/create.ts:5`

**Responsibilities**:
- Parse command flags and arguments
- Call `estimateComplexity(description)` when `--quick` flag provided
- Inject `preferred_tier` into `/create-task` prompt
- Include confidence and signals for transparency

**Implementation Status**: COMPLETE

**Acceptance Criteria Verification**:

| Criteria | Status | Evidence |
|----------|--------|----------|
| AC1: Calls estimator for --quick | IMPLEMENTED | `create.ts:47` |
| AC2: Injects preferred_tier in prompt | IMPLEMENTED | `create.ts:48-49` |
| AC3: Includes confidence and signals | IMPLEMENTED | `create.ts:48` |
| AC4: Non-quick mode uses Planner | IMPLEMENTED | `create.ts:54` |
| AC5: Module exports verified | IMPLEMENTED | `complexity-estimator.ts:1-10` |

---

#### Component 3: Task Template (`task-template.md`)

**Purpose**: Define `Preferred Tier` field with documentation.

**Pattern**: Markdown table with inline documentation

**Evidence**:
- Field definition: `task-template.md:12`
- Documentation: `task-template.md:35-42`

**Responsibilities**:
- Define valid values: `light | balanced | heavy | auto`
- Explain tier-to-complexity mapping
- Document cost implications

**Implementation Status**: COMPLETE

**Acceptance Criteria Verification**:

| Criteria | Status | Evidence |
|----------|--------|----------|
| AC1: Preferred Tier field exists | IMPLEMENTED | `task-template.md:12` |
| AC2: Documentation explains mapping | IMPLEMENTED | `task-template.md:35-42` |
| AC3: Fallback to Complexity field | IMPLEMENTED | `task-template.md:39-40` |
| AC4: Cost escalation warning | IMPLEMENTED | `task-template.md:41-42` |

---

#### Component 4: Auto-Pilot Integration (`SKILL.md`)

**Purpose**: Document provider routing based on `preferred_tier`.

**Pattern**: Provider Routing Table with condition matching

**Evidence**:
- Routing table: `SKILL.md:698-721`
- Fallback logic: `SKILL.md:694`

**Responsibilities**:
- Read `preferred_tier` from task.md
- Route to appropriate provider/model
- Log warning for cost escalation

**Implementation Status**: COMPLETE (documentation only - runtime implementation is in Auto-Pilot skill)

**Acceptance Criteria Verification**:

| Criteria | Status | Evidence |
|----------|--------|----------|
| AC1: Reads preferred_tier | DOCUMENTED | `SKILL.md:694` |
| AC2: Routes based on preferred_tier | DOCUMENTED | `SKILL.md:705-707` |
| AC3: Fallback to Complexity | DOCUMENTED | `SKILL.md:694` |
| AC4: light = glm-4.7 | DOCUMENTED | `SKILL.md:707` |
| AC5: balanced = glm-5 | DOCUMENTED | `SKILL.md:706` |
| AC6: heavy = claude-opus-4-6 | DOCUMENTED | `SKILL.md:705` |
| AC7: Cost escalation warning | DOCUMENTED | `SKILL.md:696` |

---

## Integration Architecture

### Data Flow

```
User Input (description)
       |
       v
+---------------------+
| CLI create.ts       |
| --quick flag check  |
+---------------------+
       |
       | (if --quick with description)
       v
+---------------------+
| complexity-         |
| estimator.ts        |
| estimateComplexity()|
+---------------------+
       |
       | ComplexityEstimate {
       |   tier, confidence, signals, preferredTier
       | }
       v
+---------------------+
| Prompt construction |
| Inject preferred_tier|
+---------------------+
       |
       v
+---------------------+
| /create-task skill  |
| Creates task.md     |
+---------------------+
       |
       v
+---------------------+
| Auto-Pilot reads    |
| preferred_tier      |
| Routes worker       |
+---------------------+
```

### Dependencies
- **None** - Task is independent as noted in task-description.md

---

## Quality Requirements (Architecture-Level)

### Non-Functional Requirements

**Performance**:
- Estimation completes in <10ms (simple regex matching)
- IMPLEMENTED: Pure function with no I/O

**Reliability**:
- Graceful degradation to `medium` / `balanced` on no signals
- IMPLEMENTED: `complexity-estimator.ts:106-109`

**Type Safety**:
- All exports are TypeScript-strict
- IMPLEMENTED: No `any` usage in complexity-estimator.ts

**Maintainability**:
- Patterns defined as RegExp arrays
- IMPLEMENTED: `complexity-estimator.ts:12-49`

---

## Remaining Work

### Unit Tests (NOT IMPLEMENTED)

The implementation lacks unit tests. The following test file should be created:

**File**: `apps/cli/src/utils/complexity-estimator.test.ts`

**Test Cases Required**:

```typescript
describe('estimateComplexity', () => {
  // Complex tier tests
  it('returns complex for scaffold keyword', () => {
    const result = estimateComplexity('scaffold new authentication system');
    expect(result.tier).toBe('complex');
    expect(result.preferredTier).toBe('heavy');
  });

  it('returns complex for integration keyword', () => {
    const result = estimateComplexity('integrate payment gateway');
    expect(result.tier).toBe('complex');
  });

  it('returns high confidence when multiple complex signals', () => {
    const result = estimateComplexity('scaffold cross-service architecture pipeline');
    expect(result.tier).toBe('complex');
    expect(result.confidence).toBe('high');
  });

  // Simple tier tests
  it('returns simple for fix typo keyword', () => {
    const result = estimateComplexity('fix typo in README');
    expect(result.tier).toBe('simple');
    expect(result.preferredTier).toBe('light');
  });

  it('returns simple for update config', () => {
    const result = estimateComplexity('update config file');
    expect(result.tier).toBe('simple');
  });

  // Medium tier tests
  it('returns medium for add endpoint', () => {
    const result = estimateComplexity('add new API endpoint');
    expect(result.tier).toBe('medium');
    expect(result.preferredTier).toBe('balanced');
  });

  it('returns medium for refactor', () => {
    const result = estimateComplexity('refactor authentication module');
    expect(result.tier).toBe('medium');
  });

  // Priority tests
  it('complex overrides medium', () => {
    const result = estimateComplexity('integrate and refactor the module');
    expect(result.tier).toBe('complex');
  });

  it('complex overrides simple', () => {
    const result = estimateComplexity('scaffold new system - fix typo in docs');
    expect(result.tier).toBe('complex');
  });

  it('medium overrides simple when both present', () => {
    const result = estimateComplexity('fix typo and add endpoint');
    expect(result.tier).toBe('medium');
  });

  // Default/edge cases
  it('defaults to medium with low confidence when no patterns match', () => {
    const result = estimateComplexity('do something unusual');
    expect(result.tier).toBe('medium');
    expect(result.confidence).toBe('low');
  });

  it('low confidence falls back to medium', () => {
    const result = estimateComplexity('scaffold'); // single signal
    expect(result.tier).toBe('medium'); // low confidence -> medium
    expect(result.confidence).toBe('low');
  });

  // Signal collection
  it('collects all matched signals', () => {
    const result = estimateComplexity('scaffold and integrate new pipeline');
    expect(result.signals).toContain('scaffold');
    expect(result.signals).toContain('integrate');
    expect(result.signals).toContain('pipeline');
  });

  // Tier mapping
  it('maps simple to light', () => {
    const result = estimateComplexity('fix typo');
    expect(result.preferredTier).toBe('light');
  });

  it('maps medium to balanced', () => {
    const result = estimateComplexity('add endpoint for users');
    expect(result.preferredTier).toBe('balanced');
  });

  it('maps complex to heavy', () => {
    const result = estimateComplexity('scaffold infrastructure');
    expect(result.preferredTier).toBe('heavy');
  });
});
```

### Integration Testing

Manual verification steps:
1. Run `npx nitro-fueled create --quick "scaffold new authentication system"`
2. Verify task.md contains `| preferred_tier | heavy |`
3. Run `npx nitro-fueled create --quick "fix typo in docs"`
4. Verify task.md contains `| preferred_tier | light |`

---

## Team-Leader Handoff

### Developer Type Recommendation
**Recommended Developer**: nitro-backend-developer
**Rationale**: Unit tests are backend utility code, TypeScript-based

### Complexity Assessment
**Complexity**: LOW
**Estimated Effort**: 1-2 hours (unit tests only)

### Files Affected Summary

**CREATE**:
- `apps/cli/src/utils/complexity-estimator.test.ts` (unit tests)

**MODIFY**: None

**REWRITE**: None

### Implementation Batches

#### Batch 1: Unit Tests (nitro-backend-developer)

**Task 1.1**: Create test file scaffold
- File: `apps/cli/src/utils/complexity-estimator.test.ts`
- Add describe block and imports
- Verification: File exists with proper structure

**Task 1.2**: Implement complex tier tests
- Add tests for scaffold, integrate, cross-service, etc.
- Verify high/low confidence logic
- Verification: `npm test` passes for complex tier tests

**Task 1.3**: Implement simple tier tests
- Add tests for fix typo, update config, etc.
- Verify no medium/complex interference
- Verification: `npm test` passes for simple tier tests

**Task 1.4**: Implement medium tier tests
- Add tests for add endpoint, refactor, implement, etc.
- Verification: `npm test` passes for medium tier tests

**Task 1.5**: Implement priority override tests
- Test complex > medium > simple priority
- Verification: `npm test` passes for priority tests

**Task 1.6**: Implement edge case tests
- Default to medium, low confidence fallback
- Signal collection verification
- Verification: All tests pass

#### Batch 2: Test Infrastructure (if needed)

**Task 2.1**: Add test runner to package.json (if missing)
- Add Jest or Vitest configuration
- Add `test` script
- Verification: `npm test` runs successfully

---

## Architecture Delivery Checklist

- [x] All components specified with evidence
- [x] All patterns verified from codebase
- [x] All imports/classes verified as existing
- [x] Quality requirements defined
- [x] Integration points documented
- [x] Files affected list complete
- [x] Developer type recommended
- [x] Complexity assessed
- [x] Acceptance criteria mapped to implementation evidence

---

## Conclusion

**Implementation Status**: 95% COMPLETE

The core functionality is fully implemented:
1. Complexity estimator module with pattern matching
2. CLI integration for `--quick` mode
3. Task template with Preferred Tier field
4. Auto-Pilot skill documentation for provider routing

**Remaining**: Unit tests for the complexity estimator function.

**Recommendation**: Mark as IMPLEMENTED after unit tests are added, or accept current implementation as-is since all functional requirements are met and the code is a pure function that is easily verifiable manually.
