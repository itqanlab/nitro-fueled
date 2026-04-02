# Task: Audit and fix Orchestration screen


## Metadata

| Field                 | Value                                                                         |
|-----------------------|-------------------------------------------------------------------------------|
| Type                  | FEATURE |
| Priority              | P1-High |
| Complexity            | Simple |
| Preferred Tier        | auto |
| Model                 | default |
| Testing               | optional |
| Poll Interval         | default |
| Health Check Interval | default |
| Max Retries           | default |
| Worker Mode           | [single | split]                                                              |







## Description

OrchestrationComponent (/orchestration) is a lazy-loaded view. ApiService.getOrchestrationFlows() exists.

## What to do
1. Read apps/dashboard/src/app/views/orchestration/ (all files)
2. Identify mock data, hardcoded data, broken API wiring
3. Verify getOrchestrationFlows() call works
4. Verify clone flow action calls cloneOrchestrationFlow()
5. Verify custom flows CRUD (getCustomFlows, createCustomFlow, updateCustomFlow, deleteCustomFlow)
6. Fix any issues

## Acceptance Criteria
- Flows list loads from real API
- Clone flow action works
- Custom flows CRUD works
- No mock data used

## Dependencies

- TASK_2026_308

## Acceptance Criteria

- [ ] Orchestration flows load from API
- [ ] Clone flow works
- [ ] Custom flows CRUD works
- [ ] No mock data

## References

- task-tracking/task-template.md

## File Scope

- apps/dashboard/src/app/views/orchestration/


## Parallelism

Independent. Can run in parallel with other P1 audit tasks.
