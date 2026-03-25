# Task: Dashboard Pipeline and Squad Visualization

## Metadata

| Field      | Value       |
|------------|-------------|
| Type       | FEATURE     |
| Priority   | P2-Medium   |
| Complexity | Complex     |

## Description

Add two new views to the dashboard that visualize the new parallel pipeline (TASK_2026_037) and the Lead→sub-worker squad structure (TASK_2026_035, TASK_2026_036).

### View 1: Pipeline View

A per-task pipeline diagram showing the flow of phases, which completed, which are active, and which are pending.

```
TASK_2026_025
┌──────┐    ┌─────────────────────────┐    ┌──────┐    ┌──────────┐
│ Build │───→│ Review Lead ─┐ parallel │───→│ Fix  │───→│ Complete │
│  ✓    │    │ Test Lead   ─┘          │    │  ✓   │    │    ✓     │
└──────┘    └─────────────────────────┘    └──────┘    └──────────┘
  3m              5m (parallel)               2m           Done
```

Features:
- Each phase is a node with status (pending/active/complete/failed)
- Active phases pulse/glow
- Duration shown per phase
- Model badge on each phase node (e.g., "Opus" or "Sonnet")
- Cost per phase shown on hover
- Click a phase to jump to its artifacts (reviews, tests, etc.)
- Parallel phases shown as stacked/branched paths

### View 2: Squad View (Team Dashboard)

A real-time view of all active "squads" — groups of workers collaborating on a task.

```
┌─ TASK_2026_030 ─────────────────────────────────────┐
│                                                       │
│  Build Worker          Review Lead                    │
│  ● Opus (healthy)      ● Sonnet (orchestrating)      │
│  12m elapsed           │                              │
│  45k tokens            ├─ Style Reviewer              │
│                        │  ● Sonnet (writing report)   │
│                        ├─ Logic Reviewer              │
│                        │  ● Opus (analyzing code)     │
│                        └─ Security Reviewer            │
│                           ● Sonnet (complete ✓)       │
│                                                       │
│  Test Lead                                            │
│  ● Sonnet (waiting for reviewers)                     │
│  └─ Unit Tester                                       │
│     ● Sonnet (writing tests)                          │
└───────────────────────────────────────────────────────┘
```

Features:
- One card per active task showing all its workers as a tree
- Lead nodes show their sub-workers nested underneath
- Each worker shows: model, health status, elapsed time, role
- Real-time updates via WebSocket (workers appear/disappear as spawned/completed)
- Color-coded health: green (healthy), yellow (high context), red (stuck)
- Completed sub-workers show checkmark and collapse
- Click any worker to see its detailed stats (tokens, cost, last action)

### Data requirements

**Data Service** needs new/extended endpoints:
1. `GET /api/tasks/:id/pipeline` — pipeline phases with status, duration, cost, model per phase
2. `GET /api/workers/tree` — hierarchical worker view (Lead → sub-workers grouped by task)
3. WebSocket events for sub-worker spawn/complete (already planned in TASK_035/036)

**State tracking** needs:
- Worker parent-child relationships (which Lead spawned which sub-worker)
- Per-phase timing (when each phase started/ended)
- These should be tracked in the session state by the Leads

## Dependencies

- TASK_2026_023 — Dashboard Web Client (base dashboard)
- TASK_2026_035 — Review Lead (provides review squad structure)
- TASK_2026_036 — Test Lead (provides test squad structure)
- TASK_2026_037 — Updated Pipeline (provides parallel Review + Test flow)

## Acceptance Criteria

- [ ] Pipeline view shows per-task phase diagram with status indicators
- [ ] Active phases have visual pulse/glow animation
- [ ] Duration and model shown per phase
- [ ] Cost per phase available on hover
- [ ] Parallel phases (Review + Test) shown as branched paths
- [ ] Squad view shows hierarchical Lead→sub-worker tree per task
- [ ] Sub-workers appear in real-time as spawned
- [ ] Health status color-coded per worker
- [ ] Completed workers collapse with checkmark
- [ ] Click-through from pipeline phase to related artifacts
- [ ] Click-through from worker to detailed stats

## References

- `TASK_2026_023` — Base dashboard
- `TASK_2026_035` — Review Lead architecture
- `TASK_2026_036` — Test Lead architecture
- `TASK_2026_037` — Pipeline flow with parallel phases
