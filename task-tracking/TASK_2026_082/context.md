# Context — TASK_2026_082

## User Intent
Implement the Model Assignments view at route `/models` matching the N.Gine mockup. This is a dashboard view with provider toggle, assignments table, sub-agent section, and quick presets.

## Strategy
FEATURE — Full pipeline: PM -> Architect -> Team-Leader -> QA

## Complexity
Medium — multi-component UI view with mock data integration

## Dependencies
- TASK_2026_077 — shell layout and MockDataService (available)

## Key Decisions
- All data from MockDataService (no backend)
- Uses NG-ZORRO component library
- Follows existing component patterns from MCP view
