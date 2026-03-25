# Task: Dashboard Dependency Graph Visualization

## Metadata

| Field      | Value       |
|------------|-------------|
| Type       | FEATURE     |
| Priority   | P2-Medium   |
| Complexity | Medium      |

## Description

Add an interactive dependency graph (DAG) visualization to the dashboard. Currently the Queue view lists tasks in priority order with text-based dependency info. This task adds a visual graph where tasks are nodes and dependencies are directed edges.

### Graph view

```
  ┌─────┐     ┌─────┐     ┌─────┐
  │ 019 │────→│ 026 │────→│ 032 │
  └─────┘     └─────┘     └─────┘
  ┌─────┐        │
  │ 020 │────┐   │
  └─────┘    ▼   │
           ┌─────┐
           │ 021 │
           └─────┘
  ┌─────┐     ┌─────┐     ┌─────┐
  │ 022 │────→│ 023 │────→│ 024 │
  └─────┘     └─────┘     └─────┘
                ▲
                │
              ┌─────┐
              │ 022 │
              └─────┘
```

### Features

1. **DAG layout** — tasks as nodes positioned with dependency flow left-to-right (or top-to-bottom)
2. **Status coloring** — each node colored by current state (same palette as Task Board)
3. **Interactive nodes** — click a task node to open Task Detail view
4. **Hover info** — tooltip with task title, type, priority, assignee model
5. **Critical path highlight** — longest dependency chain highlighted (shows bottleneck)
6. **Live updates** — nodes change color in real-time as tasks progress via WebSocket
7. **Zoom and pan** — for large graphs (20+ tasks)
8. **Filter controls**:
   - Filter by status (show only CREATED, hide COMPLETE, etc.)
   - Filter by type (FEATURE, BUGFIX, etc.)
   - Show/hide completed tasks (declutter the graph)
9. **Dependency chains** — select a task to highlight all its upstream dependencies and downstream dependents
10. **Unblocked indicator** — tasks with all dependencies met glow or have a "ready" badge

### Tech approach

Use a lightweight graph rendering library:
- **Option A**: `@xyflow/react` (React Flow) — mature, interactive, good for DAGs
- **Option B**: `dagre` for layout + custom SVG rendering — lighter weight, more control
- **Option C**: `d3-dag` — D3-based, powerful but more complex

Recommend Option A (React Flow) — it handles layout, zoom, pan, and interactivity out of the box.

### Data requirements

**Data Service**:
1. `GET /api/graph` — returns nodes (tasks with status) and edges (dependencies)
2. Or: derive from existing `GET /api/registry` + reading each task's dependencies

No new WebSocket events needed — existing `task:state_changed` events update node colors.

## Dependencies

- TASK_2026_023 — Dashboard Web Client (base dashboard)

## Acceptance Criteria

- [ ] Dependency graph renders all tasks as nodes with directed edges
- [ ] Nodes colored by task status
- [ ] Click node opens Task Detail
- [ ] Hover shows task summary tooltip
- [ ] Critical path highlighted
- [ ] Nodes update in real-time via WebSocket
- [ ] Zoom, pan, and fit-to-view controls
- [ ] Filter by status and type
- [ ] Select a task highlights its full dependency chain
- [ ] Unblocked tasks visually distinguished
- [ ] Handles 30+ tasks without performance issues

## References

- `TASK_2026_023` — Base dashboard
- `task-tracking/registry.md` — task list with status
- Task dependency format in `task.md` files (`## Dependencies` section)
- React Flow: https://reactflow.dev/
