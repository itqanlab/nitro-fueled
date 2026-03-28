# Requirements Document - TASK_2026_097

## Introduction

This task implements automatic complexity estimation at task creation time. The system analyzes task descriptions using keyword pattern matching to determine the appropriate provider tier (`light`, `balanced`, `heavy`) without any user interaction. This enables intelligent routing of Build Workers to the most cost-effective model based on task characteristics.

**Business Value**: Reduces cognitive load on users by eliminating manual complexity decisions, ensures consistent cost optimization through automated tier selection, and enables faster task creation workflow.

---

## Requirements

### Requirement 1: Complexity Estimation Engine

**User Story:** As a developer using the CLI, I want the system to automatically analyze my task description and determine its complexity, so that I do not need to manually specify which model tier to use.

#### Acceptance Criteria

1. WHEN a task description is provided to the complexity estimator THEN the system SHALL analyze the text against predefined keyword patterns and return a complexity tier (`simple`, `medium`, or `complex`).

2. WHEN complex patterns are detected (scaffold, integrate, cross-service, architecture, pipeline, migrate database) THEN the estimator SHALL return `complex` tier with at least one matched signal.

3. WHEN simple patterns are detected (fix typo, update config, add field, rename, documentation update) AND no medium/complex patterns are present THEN the estimator SHALL return `simple` tier.

4. WHEN medium patterns are detected (add endpoint, create component, migrate command, implement service, refactor) AND no complex patterns are present THEN the estimator SHALL return `medium` tier.

5. WHEN no patterns match any category THEN the estimator SHALL default to `medium` tier with `low` confidence.

6. WHEN confidence is `low` THEN the estimator SHALL always return `medium` tier as the safe default.

7. WHEN multiple patterns of different tiers match THEN complex patterns SHALL take priority over medium, and medium SHALL take priority over simple.

#### Signal Detection Specifications

**Complex Signals** (result in `heavy` tier):
- Keywords: `scaffold`, `integrate`/`integration`, `cross-service`, `architecture`, `pipeline`, `migrate database`, `new subsystem`, `infrastructure`, `multi-service`, `full-stack`

**Simple Signals** (result in `light` tier):
- Keywords: `fix typo`, `update config`, `add field`, `rename`, `single file`, `documentation update`, `config change`, `typo`, `update readme`, `add comment`

**Medium Signals** (result in `balanced` tier):
- Keywords: `add endpoint`, `new endpoint`, `create component`, `new component`, `migrate command`, `implement service`, `refactor`, `add feature`, `implement`, `create service`

---

### Requirement 2: Tier-to-Provider Mapping

**User Story:** As the Supervisor, I want a consistent mapping between complexity tiers and provider tiers, so that I can route tasks to appropriate models without custom logic.

#### Acceptance Criteria

1. WHEN the estimator returns `simple` tier THEN the `preferredTier` SHALL be `light` (maps to `glm-4.7`).

2. WHEN the estimator returns `medium` tier THEN the `preferredTier` SHALL be `balanced` (maps to `glm-5`).

3. WHEN the estimator returns `complex` tier THEN the `preferredTier` SHALL be `heavy` (maps to `claude-opus-4-6`).

4. WHEN the mapping function is called THEN it SHALL return a `PreferredTier` value that matches the TIER_MAP constant.

---

### Requirement 3: CLI Integration

**User Story:** As a developer using `nitro-fueled create --quick`, I want the complexity estimator to run automatically on my task description, so that `preferred_tier` is set without any extra steps.

#### Acceptance Criteria

1. WHEN `nitro-fueled create --quick "<description>"` is executed THEN the system SHALL call `estimateComplexity(description)` before spawning the Claude session.

2. WHEN the estimator returns a result THEN the CLI SHALL inject the `preferred_tier` value into the `/create-task` prompt with format: `| preferred_tier | <value> |`.

3. WHEN the CLI constructs the prompt THEN it SHALL include the confidence level and matched signals for transparency.

4. WHEN `nitro-fueled create` (non-quick mode) is executed THEN the Planner agent SHALL handle complexity estimation during the planning discussion (no CLI-side estimation).

5. WHEN the estimator module is imported THEN it SHALL export the `estimateComplexity` function and all related types (`ComplexityTier`, `Confidence`, `PreferredTier`, `ComplexityEstimate`).

---

### Requirement 4: Task Template Metadata Field

**User Story:** As a developer reading task.md, I want to see the `Preferred Tier` field with clear documentation, so that I understand how auto-estimation works and when to override it.

#### Acceptance Criteria

1. WHEN the task template is read THEN it SHALL contain a `Preferred Tier` field with options: `light`, `balanced`, `heavy`, `auto`.

2. WHEN the field documentation is displayed THEN it SHALL explain the tier-to-complexity mapping and cost implications.

3. WHEN `preferred_tier` is set to `auto` or omitted THEN the Supervisor SHALL use the Complexity field for routing as a fallback.

4. WHEN a user manually sets `preferred_tier: heavy` on a Simple complexity task THEN the Supervisor SHALL log a warning about cost escalation.

---

### Requirement 5: Auto-Pilot Supervisor Integration

**User Story:** As the Auto-Pilot Supervisor, I want to read `preferred_tier` from task.md when deciding worker routing, so that I use the pre-computed tier instead of re-estimating at runtime.

#### Acceptance Criteria

1. WHEN the Supervisor prepares to spawn a Build Worker THEN it SHALL read the `preferred_tier` field from the task.md metadata table using pattern `| preferred_tier | <value> |`.

2. WHEN `preferred_tier` is present and valid (`light`, `balanced`, `heavy`) THEN the Supervisor SHALL use it for provider routing according to the Provider Routing Table.

3. WHEN `preferred_tier` is absent, empty, or set to `auto` THEN the Supervisor SHALL fall back to the Complexity field (Simple -> light, Medium -> balanced, Complex -> heavy).

4. WHEN routing a Build Worker with `preferred_tier=light` THEN the Supervisor SHALL use `glm` provider with `glm-4.7` model.

5. WHEN routing a Build Worker with `preferred_tier=balanced` THEN the Supervisor SHALL use `glm` provider with `glm-5` model.

6. WHEN routing a Build Worker with `preferred_tier=heavy` THEN the Supervisor SHALL use `claude` provider with `claude-opus-4-6` model.

7. WHEN `preferred_tier=heavy` is set on a task with `Complexity=Simple` THEN the Supervisor SHALL log warning: `"[warn] TASK_X: preferred_tier=heavy overrides Simple complexity — verify this is intentional"`.

---

### Requirement 6: No User Prompts

**User Story:** As a developer creating tasks, I want complexity estimation to be fully automatic without any prompts, so that my workflow is not interrupted.

#### Acceptance Criteria

1. WHEN task creation is initiated THEN the system SHALL NOT prompt the user to select a complexity tier.

2. WHEN the estimator has low confidence THEN the system SHALL silently default to `medium` without user notification during creation.

3. WHEN the task is created THEN `preferred_tier` SHALL be written to task.md automatically as part of the metadata table.

---

## Non-Functional Requirements

### Performance Requirements

- **Estimation Latency**: Complexity estimation SHALL complete in under 10ms for any task description (simple regex matching).
- **Memory Usage**: The estimator module SHALL have minimal footprint (< 50KB in bundle).

### Reliability Requirements

- **Graceful Degradation**: If estimation fails for any reason, default to `medium` / `balanced` tier.
- **Type Safety**: All exported types SHALL be TypeScript-strict with no `any` usage.

### Maintainability Requirements

- **Pattern Extensibility**: Keyword patterns SHALL be defined as arrays of RegExp, allowing easy addition of new signals.
- **Clear Separation**: The estimator SHALL be a pure function with no side effects, enabling unit testing.

---

## Stakeholder Analysis

### Primary Stakeholders

| Stakeholder | Impact Level | Involvement | Success Criteria |
|-------------|--------------|-------------|------------------|
| CLI Users | High | Direct usage | Zero prompts, automatic tier assignment |
| Supervisor (Auto-Pilot) | High | Consumer | Correct tier routing from task.md |
| Build Workers | Medium | Downstream | Receive appropriate model allocation |

### Secondary Stakeholders

| Stakeholder | Impact Level | Involvement | Success Criteria |
|-------------|--------------|-------------|------------------|
| Project Owners | Medium | Cost visibility | Reduced costs via light tier for simple tasks |
| DevOps | Low | Monitoring | Log visibility for tier decisions |

---

## Risk Assessment

| Risk | Probability | Impact | Score | Mitigation Strategy |
|------|-------------|--------|-------|---------------------|
| Misclassification of complex tasks as simple | Medium | High | 6 | Default to medium on low confidence; users can override in task.md |
| Keyword patterns miss edge cases | Medium | Medium | 4 | Extensible pattern arrays; iterative refinement based on real usage |
| Cost escalation from manual heavy overrides | Low | Medium | 2 | Warning logs for mismatched tier/complexity; access control to task files |
| Pattern matching too aggressive | Low | Low | 1 | Multiple signals required for high confidence; single signal = low confidence |

---

## Dependencies

- **None** - This task is independent of TASK_2026_095 (Provider Routing) and TASK_2026_096 (Model Configuration). Can run in parallel with both.

---

## Parallelism

**Wave**: 1 (independent)
**Can run in parallel with**: TASK_2026_095, TASK_2026_096, TASK_2026_098
**Conflicts with**: None

---

## References

- `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/cli/src/commands/create.ts` - CLI command that invokes the estimator
- `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/cli/src/utils/complexity-estimator.ts` - Core estimation module
- `/Volumes/SanDiskSSD/mine/nitro-fueled/task-tracking/task-template.md` - Task template with Preferred Tier field
- `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/auto-pilot/SKILL.md` - Supervisor integration documentation

---

## Implementation Notes

The implementation is already in place:

1. **Complexity Estimator** (`apps/cli/src/utils/complexity-estimator.ts`):
   - Exports `estimateComplexity(description: string): ComplexityEstimate`
   - Pattern matching for complex, medium, and simple signals
   - Confidence scoring and tier mapping

2. **CLI Integration** (`apps/cli/src/commands/create.ts`):
   - Imports and calls `estimateComplexity` for `--quick` mode
   - Injects `preferred_tier` into the `/create-task` prompt

3. **Task Template** (`task-tracking/task-template.md`):
   - `Preferred Tier` field with documentation
   - Tier-to-complexity mapping explained

4. **Auto-Pilot Skill** (`.claude/skills/auto-pilot/SKILL.md`):
   - Provider Routing Table with `preferred_tier` column
   - Fallback logic when `preferred_tier` is absent or `auto`
   - Warning log for cost escalation scenarios

Remaining work (if any):
- Unit tests for the complexity estimator
- Validation that all acceptance criteria are met
- Integration testing with auto-pilot
