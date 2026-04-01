import { describe, it, expect } from 'vitest';
import {
  buildAdjacencyList,
  detectCycles,
  resolveUnblockedTasks,
  markNewlyUnblocked,
  type ResolverTask,
} from './resolver.js';

// ── helpers ──────────────────────────────────────────────────────────────────

function task(
  id: string,
  status: ResolverTask['status'] = 'CREATED',
  priority: ResolverTask['priority'] = 'P2-Medium',
  deps: string[] = [],
): ResolverTask {
  return { id, status, priority, dependencies: JSON.stringify(deps) };
}

// ── buildAdjacencyList ────────────────────────────────────────────────────────

describe('buildAdjacencyList', () => {
  it('returns empty map for empty task array', () => {
    expect(buildAdjacencyList([])).toEqual(new Map());
  });

  it('includes only deps that exist in the task set', () => {
    const tasks = [task('A', 'CREATED', 'P2-Medium', ['B', 'GHOST'])];
    // GHOST is not in the task set, so it should be filtered out
    const adj = buildAdjacencyList(tasks);
    expect(adj.get('A')).toEqual([]);
  });

  it('builds correct adjacency list for multiple tasks', () => {
    const tasks = [
      task('A', 'CREATED', 'P2-Medium', ['B']),
      task('B', 'COMPLETE', 'P1-High', []),
    ];
    const adj = buildAdjacencyList(tasks);
    expect(adj.get('A')).toEqual(['B']);
    expect(adj.get('B')).toEqual([]);
  });
});

// ── detectCycles ──────────────────────────────────────────────────────────────

describe('detectCycles', () => {
  it('returns [] for tasks with no dependencies', () => {
    const tasks = [task('A'), task('B'), task('C')];
    expect(detectCycles(tasks)).toEqual([]);
  });

  it('returns [] for a linear chain', () => {
    const tasks = [
      task('A', 'CREATED', 'P2-Medium', ['B']),
      task('B', 'CREATED', 'P2-Medium', ['C']),
      task('C', 'COMPLETE'),
    ];
    expect(detectCycles(tasks)).toEqual([]);
  });

  it('detects a direct self-loop', () => {
    // A depends on itself — a known edge case; adjacency list filters external deps,
    // but self-loops should still be detected
    const tasks = [task('A', 'CREATED', 'P2-Medium', ['A'])];
    const cycles = detectCycles(tasks);
    expect(cycles).toContain('A');
  });

  it('detects a two-node cycle', () => {
    const tasks = [
      task('A', 'CREATED', 'P2-Medium', ['B']),
      task('B', 'CREATED', 'P2-Medium', ['A']),
    ];
    const cycles = detectCycles(tasks);
    expect(cycles).toContain('A');
    expect(cycles).toContain('B');
  });

  it('detects a three-node cycle', () => {
    const tasks = [
      task('A', 'CREATED', 'P2-Medium', ['B']),
      task('B', 'CREATED', 'P2-Medium', ['C']),
      task('C', 'CREATED', 'P2-Medium', ['A']),
    ];
    const cycles = detectCycles(tasks);
    expect(cycles).toContain('A');
    expect(cycles).toContain('B');
    expect(cycles).toContain('C');
  });

  it('does not flag tasks outside the cycle', () => {
    const tasks = [
      task('A', 'CREATED', 'P2-Medium', ['B']),
      task('B', 'CREATED', 'P2-Medium', ['A']),
      task('C', 'COMPLETE'), // independent task
    ];
    const cycles = detectCycles(tasks);
    expect(cycles).not.toContain('C');
  });
});

// ── resolveUnblockedTasks ─────────────────────────────────────────────────────

describe('resolveUnblockedTasks', () => {
  it('returns [] for empty array', () => {
    expect(resolveUnblockedTasks([])).toEqual([]);
  });

  it('returns CREATED tasks with no dependencies', () => {
    const tasks = [task('A'), task('B', 'COMPLETE')];
    const result = resolveUnblockedTasks(tasks);
    expect(result.map(t => t.id)).toEqual(['A']);
  });

  it('returns tasks whose deps are all COMPLETE', () => {
    const tasks = [
      task('A', 'CREATED', 'P2-Medium', ['B']),
      task('B', 'COMPLETE'),
    ];
    const result = resolveUnblockedTasks(tasks);
    expect(result.map(t => t.id)).toContain('A');
  });

  it('returns tasks whose deps are all CANCELLED', () => {
    const tasks = [
      task('A', 'CREATED', 'P2-Medium', ['B']),
      task('B', 'CANCELLED'),
    ];
    const result = resolveUnblockedTasks(tasks);
    expect(result.map(t => t.id)).toContain('A');
  });

  it('excludes tasks with non-terminal deps', () => {
    const tasks = [
      task('A', 'CREATED', 'P2-Medium', ['B']),
      task('B', 'IN_PROGRESS'),
    ];
    expect(resolveUnblockedTasks(tasks)).toEqual([]);
  });

  it('excludes non-CREATED tasks even when deps are terminal', () => {
    const tasks = [
      task('A', 'IN_PROGRESS', 'P2-Medium', ['B']),
      task('B', 'COMPLETE'),
    ];
    expect(resolveUnblockedTasks(tasks)).toEqual([]);
  });

  it('excludes tasks that are in a cycle', () => {
    const tasks = [
      task('A', 'CREATED', 'P2-Medium', ['B']),
      task('B', 'CREATED', 'P2-Medium', ['A']),
    ];
    expect(resolveUnblockedTasks(tasks)).toEqual([]);
  });

  it('sorts results by priority: P0 before P1 before P2 before P3', () => {
    const tasks = [
      task('C', 'CREATED', 'P3-Low'),
      task('A', 'CREATED', 'P0-Critical'),
      task('B', 'CREATED', 'P2-Medium'),
      task('D', 'CREATED', 'P1-High'),
    ];
    const result = resolveUnblockedTasks(tasks).map(t => t.id);
    expect(result).toEqual(['A', 'D', 'B', 'C']);
  });

  it('handles diamond dependencies', () => {
    // A -> B, A -> C, B -> D, C -> D  (diamond where D is the root dep)
    const tasks = [
      task('A', 'CREATED', 'P2-Medium', ['B', 'C']),
      task('B', 'CREATED', 'P2-Medium', ['D']),
      task('C', 'CREATED', 'P2-Medium', ['D']),
      task('D', 'COMPLETE'),
    ];
    const result = resolveUnblockedTasks(tasks).map(t => t.id);
    // B and C are unblocked (D is COMPLETE); A still depends on B and C (not COMPLETE yet)
    expect(result).toContain('B');
    expect(result).toContain('C');
    expect(result).not.toContain('A');
    expect(result).not.toContain('D');
  });

  it('handles mixed statuses: some tasks ready, some blocked', () => {
    const tasks = [
      task('A', 'CREATED', 'P1-High', ['X']),
      task('B', 'CREATED', 'P2-Medium', ['Y']),
      task('X', 'COMPLETE'),
      task('Y', 'IN_PROGRESS'),
    ];
    const result = resolveUnblockedTasks(tasks);
    expect(result.map(t => t.id)).toEqual(['A']);
  });

  it('handles malformed dependencies JSON gracefully', () => {
    const tasks: ResolverTask[] = [
      { id: 'A', status: 'CREATED', priority: 'P2-Medium', dependencies: 'not-json' },
    ];
    // No deps parsed → task is unblocked
    const result = resolveUnblockedTasks(tasks);
    expect(result.map(t => t.id)).toContain('A');
  });
});

// ── markNewlyUnblocked ────────────────────────────────────────────────────────

describe('markNewlyUnblocked', () => {
  it('returns [] when no task depends on the completed task', () => {
    const tasks = [task('A', 'COMPLETE'), task('B', 'CREATED')];
    expect(markNewlyUnblocked('A', tasks)).toEqual([]);
  });

  it('returns dependent task when its only dep just completed', () => {
    const tasks = [
      task('A', 'CREATED', 'P2-Medium', ['B']),
      task('B', 'COMPLETE'),
    ];
    const result = markNewlyUnblocked('B', tasks);
    expect(result).toContain('A');
  });

  it('does not return task when it has other non-terminal deps', () => {
    const tasks = [
      task('A', 'CREATED', 'P2-Medium', ['B', 'C']),
      task('B', 'COMPLETE'),
      task('C', 'IN_PROGRESS'),
    ];
    const result = markNewlyUnblocked('B', tasks);
    expect(result).not.toContain('A');
  });

  it('returns task when all deps including completedId are now terminal', () => {
    const tasks = [
      task('A', 'CREATED', 'P2-Medium', ['B', 'C']),
      task('B', 'COMPLETE'),
      task('C', 'COMPLETE'),
    ];
    const result = markNewlyUnblocked('C', tasks);
    expect(result).toContain('A');
  });

  it('does not return non-CREATED tasks', () => {
    const tasks = [
      task('A', 'IN_PROGRESS', 'P2-Medium', ['B']),
      task('B', 'COMPLETE'),
    ];
    expect(markNewlyUnblocked('B', tasks)).not.toContain('A');
  });

  it('does not return cyclic tasks', () => {
    const tasks = [
      task('A', 'CREATED', 'P2-Medium', ['B', 'C']),
      task('B', 'CREATED', 'P2-Medium', ['A']),
      task('C', 'COMPLETE'),
    ];
    // C just completed, but A and B are in a cycle
    const result = markNewlyUnblocked('C', tasks);
    expect(result).not.toContain('A');
    expect(result).not.toContain('B');
  });

  it('handles a linear chain: completing the head unblocks the next', () => {
    const tasks = [
      task('A', 'CREATED', 'P2-Medium', ['B']),
      task('B', 'COMPLETE'),
      task('C', 'CREATED', 'P2-Medium', ['A']),
    ];
    // B just completed, A becomes unblocked
    const result = markNewlyUnblocked('B', tasks);
    expect(result).toContain('A');
    expect(result).not.toContain('C'); // C depends on A which is still CREATED
  });
});
