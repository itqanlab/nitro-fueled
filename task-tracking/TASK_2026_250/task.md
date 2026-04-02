# Task: Dashboard API: Session Cost Breakdown Response

## Metadata

| Field                 | Value                                                                         |
|-----------------------|-------------------------------------------------------------------------------|
| Type                  | FEATURE |
| Priority              | P2-Medium |
| Complexity            | Simple |
| Preferred Tier        | auto |
| Model                 | default |
| Testing               | optional |
| Poll Interval         | default |
| Health Check Interval | default |
| Max Retries           | default |
| Worker Mode           | single |

## Description

Update the dashboard-api session detail controller to read cost_breakdown from the cortex get_session_summary MCP tool and include it in the GET /api/sessions/:id response. The cost_breakdown object contains supervisor_cost, worker_cost_by_model, and total_cost (provided by TASK_2026_249). Add the CostBreakdown type to the cortex types file and map the cortex response fields through to the API consumer. No new endpoints needed -- just extend the existing session detail response.

## Dependencies

- TASK_2026_249 -- provides cost_breakdown in get_session_summary MCP tool response

## Acceptance Criteria

- [ ] GET /api/sessions/:id includes cost_breakdown with supervisor_cost, worker_cost_by_model, total_cost
- [ ] Handles sessions with no cost data gracefully (null defaults)
- [ ] Existing session detail response fields unchanged

## References

- apps/dashboard-api/src/dashboard/dashboard.controller.ts
- apps/dashboard-api/src/dashboard/cortex.types.ts

## File Scope

- apps/dashboard-api/src/dashboard/dashboard.controller.ts
- apps/dashboard-api/src/dashboard/cortex.types.ts

## Parallelism

Must run after TASK_2026_249. Can run in parallel with dashboard frontend tasks. Wave 3b.
