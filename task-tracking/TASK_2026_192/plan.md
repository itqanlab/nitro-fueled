# Development Plan — TASK_2026_192

## Overview
Add unit tests for utility functions in three existing tasks that were identified as missing tests during the RETRO_2026-03-30_2 review. This is a BUGFIX task with parallel execution capability.

## Task Decomposition
The work is split into three independent batches, one for each task area:

### Batch 1: TASK_2026_148 — Settings Component Utilities
- **File Scope**: `apps/dashboard/src/app/pages/settings/**/*.spec.ts` (new)
- **Target Files**: 
  - `apps/dashboard/src/app/pages/settings/services/settings.service.ts`
  - `apps/dashboard/src/app/pages/settings/models/settings.model.ts`
  - `apps/dashboard/src/app/pages/settings/utils/settings.utils.ts`
- **Test Focus**: Mock data service, utility functions, component logic
- **Parallel**: ✅ Can run independently

### Batch 2: TASK_2026_155 — Task Queue Board Utilities  
- **File Scope**: `apps/dashboard/src/app/pages/project/**/*.spec.ts` (new)
- **Target Files**:
  - `apps/dashboard/src/app/pages/project/services/task-queue.service.ts`
  - `apps/dashboard/src/app/pages/project/utils/filter.utils.ts`
  - `apps/dashboard/src/app/pages/project/utils/sort.utils.ts`
- **Test Focus**: Filtering/sorting logic, queue management
- **Parallel**: ✅ Can run independently

### Batch 3: TASK_2026_159 — New Task Page Utilities
- **File Scope**: `apps/dashboard/src/app/pages/new-task/**/*.spec.ts` (new)  
- **Target Files**:
  - `apps/dashboard/src/app/pages/new-task/services/task-creator.service.ts`
  - `apps/dashboard/src/app/pages/new-task/utils/validation.utils.ts`
  - `apps/dashboard/src/app/pages/new-task/utils/form.utils.ts`
- **Test Focus**: Form validation, submission logic
- **Parallel**: ✅ Can run independently

## Implementation Strategy
1. **Create test files** for each utility file following the existing testing patterns
2. **Mock dependencies** as needed (services, HTTP clients)
3. **Write comprehensive tests** covering:
   - Happy path functionality
   - Edge cases and boundary conditions
   - Error handling scenarios
4. **Run tests** to ensure they pass
5. **Commit test files** with appropriate metadata

## Quality Requirements
- Follow existing testing patterns in the codebase
- Maintain file size limits (tests files should be concise)
- Use proper TypeScript typing
- Include necessary mocks and test utilities
- Ensure test coverage of all utility functions

## Dependencies
- None (parallel execution allowed)

## Exit Criteria
- All three batches complete with passing tests
- Test files committed with proper metadata
- No new anti-patterns introduced