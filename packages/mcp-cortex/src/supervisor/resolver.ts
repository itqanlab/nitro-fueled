/**
 * Dependency Resolver — pure functions for task graph construction and priority sorting.
 *
 * No DB calls. All functions operate on plain task arrays and return new arrays/sets.
 */

export type ResolverTaskStatus =
  | 'CREATED'
  | 'IN_PROGRESS'
  | 'PREPPED'
  | 'IMPLEMENTING'
  | 'IMPLEMENTED'
  | 'IN_REVIEW'
  | 'FIXING'
  | 'COMPLETE'
  | 'FAILED'
  | 'BLOCKED'
  | 'CANCELLED'
  | 'ARCHIVE';

export type ResolverTaskPriority = 'P0-Critical' | 'P1-High' | 'P2-Medium' | 'P3-Low';

export interface ResolverTask {
  id: string;
  status: ResolverTaskStatus;
  priority: ResolverTaskPriority;
  /** JSON-encoded string array of dependency task IDs, e.g. '["TASK_2026_001"]' */
  dependencies: string;
}

const PRIORITY_ORDER: Record<ResolverTaskPriority, number> = {
  'P0-Critical': 0,
  'P1-High': 1,
  'P2-Medium': 2,
  'P3-Low': 3,
};

const TERMINAL_STATUSES = new Set<ResolverTaskStatus>(['COMPLETE', 'CANCELLED']);

/** Parse the dependencies JSON field into an array of task IDs. Returns [] on error. */
function parseDeps(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((d): d is string => typeof d === 'string');
  } catch {
    return [];
  }
}

/**
 * Build an adjacency list (task ID → dependency IDs) from the task array.
 * Only includes IDs that are present in the task set.
 */
export function buildAdjacencyList(tasks: ResolverTask[]): Map<string, string[]> {
  const known = new Set(tasks.map(t => t.id));
  const adj = new Map<string, string[]>();
  for (const task of tasks) {
    const deps = parseDeps(task.dependencies).filter(d => known.has(d));
    adj.set(task.id, deps);
  }
  return adj;
}

/**
 * Detect cycles in the dependency graph using iterative DFS.
 *
 * @returns Array of task IDs that are part of a cycle. Empty if no cycles.
 */
export function detectCycles(tasks: ResolverTask[]): string[] {
  const adj = buildAdjacencyList(tasks);
  // 0 = unvisited, 1 = in-stack, 2 = done
  const state = new Map<string, 0 | 1 | 2>();
  for (const task of tasks) state.set(task.id, 0);

  const cycleNodes = new Set<string>();

  for (const start of state.keys()) {
    if (state.get(start) !== 0) continue;

    // Stack entries: [nodeId, iterator over its deps, path set]
    const stack: Array<{ id: string; deps: string[]; depIdx: number }> = [];
    const path = new Set<string>();

    stack.push({ id: start, deps: adj.get(start) ?? [], depIdx: 0 });
    state.set(start, 1);
    path.add(start);

    while (stack.length > 0) {
      const top = stack[stack.length - 1];

      if (top.depIdx < top.deps.length) {
        const neighbor = top.deps[top.depIdx++];
        const nState = state.get(neighbor);

        if (nState === 1) {
          // Back-edge → cycle. Mark all nodes currently in path that are in the cycle.
          let recording = false;
          for (const id of path) {
            if (id === neighbor) recording = true;
            if (recording) cycleNodes.add(id);
          }
          cycleNodes.add(neighbor);
        } else if (nState === 0) {
          state.set(neighbor, 1);
          path.add(neighbor);
          stack.push({ id: neighbor, deps: adj.get(neighbor) ?? [], depIdx: 0 });
        }
        // nState === 2 → already fully explored, skip
      } else {
        state.set(top.id, 2);
        path.delete(top.id);
        stack.pop();
      }
    }
  }

  return [...cycleNodes];
}

/**
 * Return tasks whose status is CREATED and whose every dependency has a terminal
 * status (COMPLETE or CANCELLED), sorted by priority (P0 first).
 *
 * Tasks in cycles or with unresolved dependencies are excluded.
 */
export function resolveUnblockedTasks(tasks: ResolverTask[]): ResolverTask[] {
  const statusMap = new Map(tasks.map(t => [t.id, t.status]));
  const cycleSet = new Set(detectCycles(tasks));

  const unblocked = tasks.filter(task => {
    if (task.status !== 'CREATED') return false;
    if (cycleSet.has(task.id)) return false;

    const deps = parseDeps(task.dependencies);
    return deps.every(dep => {
      const depStatus = statusMap.get(dep);
      return depStatus !== undefined && TERMINAL_STATUSES.has(depStatus);
    });
  });

  return unblocked.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
}

/**
 * After task `completedId` transitions to COMPLETE or CANCELLED, return the IDs
 * of tasks that became newly unblocked (i.e. all of their dependencies are now terminal).
 *
 * Assumes `completedId` is already reflected as terminal in the `tasks` array.
 */
export function markNewlyUnblocked(
  completedId: string,
  tasks: ResolverTask[],
): string[] {
  const statusMap = new Map(tasks.map(t => [t.id, t.status]));
  const cycleSet = new Set(detectCycles(tasks));

  return tasks
    .filter(task => {
      if (task.status !== 'CREATED') return false;
      if (cycleSet.has(task.id)) return false;

      const deps = parseDeps(task.dependencies);
      if (!deps.includes(completedId)) return false;

      return deps.every(dep => {
        const depStatus = statusMap.get(dep);
        return depStatus !== undefined && TERMINAL_STATUSES.has(depStatus);
      });
    })
    .map(t => t.id);
}
