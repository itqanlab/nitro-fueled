import type { GraphNode, GraphEdge } from '../types/index.js';

export const NODE_W = 140;
export const NODE_H = 60;
const COL_GAP = 80;
const ROW_GAP = 24;

export interface LayoutNode extends GraphNode {
  x: number;
  y: number;
  col: number;
  row: number;
}

export function computeLayout(
  nodes: ReadonlyArray<GraphNode>,
  edges: ReadonlyArray<GraphEdge>,
): LayoutNode[] {
  if (nodes.length === 0) return [];

  const outEdges = new Map<string, string[]>();
  const inDegree = new Map<string, number>();
  for (const n of nodes) {
    outEdges.set(n.id, []);
    inDegree.set(n.id, 0);
  }
  for (const e of edges) {
    outEdges.get(e.from)?.push(e.to);
    inDegree.set(e.to, (inDegree.get(e.to) ?? 0) + 1);
  }

  // Kahn's BFS for longest-path column assignment (correct on DAGs, skips cycles)
  const col = new Map<string, number>();
  const remaining = new Map(inDegree);
  const queue: string[] = [];
  for (const n of nodes) {
    col.set(n.id, 0);
    if ((inDegree.get(n.id) ?? 0) === 0) queue.push(n.id);
  }

  while (queue.length > 0) {
    const id = queue.shift()!;
    const myCol = col.get(id) ?? 0;
    for (const next of outEdges.get(id) ?? []) {
      // Longest-path: child column = max(current, parent + 1)
      col.set(next, Math.max(col.get(next) ?? 0, myCol + 1));
      const left = (remaining.get(next) ?? 1) - 1;
      remaining.set(next, left);
      if (left === 0) queue.push(next);
    }
  }
  // Nodes still in cycles stay at col 0 (already initialised)

  // Assign rows within each column
  const colGroups = new Map<number, string[]>();
  for (const n of nodes) {
    const c = col.get(n.id) ?? 0;
    const group = colGroups.get(c) ?? [];
    group.push(n.id);
    colGroups.set(c, group);
  }

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const result: LayoutNode[] = [];
  for (const [c, ids] of colGroups) {
    const x = c * (NODE_W + COL_GAP);
    ids.forEach((id, rowIdx) => {
      const n = nodeMap.get(id);
      if (!n) return;
      result.push({ ...n, col: c, row: rowIdx, x, y: rowIdx * (NODE_H + ROW_GAP) });
    });
  }
  return result;
}

export function computeCriticalPath(
  nodes: ReadonlyArray<GraphNode>,
  edges: ReadonlyArray<GraphEdge>,
): Set<string> {
  if (nodes.length === 0) return new Set();

  const outEdges = new Map<string, string[]>();
  for (const n of nodes) outEdges.set(n.id, []);
  for (const e of edges) outEdges.get(e.from)?.push(e.to);

  // Iterative longest-path using memoization (avoids spread-spread stack issues)
  const memo = new Map<string, number>();
  function longestFrom(id: string, visiting: Set<string>): number {
    if (memo.has(id)) return memo.get(id)!;
    if (visiting.has(id)) return 0; // cycle guard
    visiting.add(id);
    const nexts = outEdges.get(id) ?? [];
    let len = 0;
    for (const n of nexts) {
      const nLen = longestFrom(n, visiting);
      if (nLen + 1 > len) len = nLen + 1;
    }
    visiting.delete(id);
    memo.set(id, len);
    return len;
  }

  for (const n of nodes) longestFrom(n.id, new Set());

  let maxLen = 0;
  for (const v of memo.values()) { if (v > maxLen) maxLen = v; }
  if (maxLen === 0) return new Set();

  const criticalNodes = new Set<string>();
  function trace(id: string): void {
    criticalNodes.add(id);
    const myLen = memo.get(id) ?? 0;
    for (const next of outEdges.get(id) ?? []) {
      if ((memo.get(next) ?? 0) === myLen - 1) trace(next);
    }
  }
  for (const n of nodes) {
    if ((memo.get(n.id) ?? 0) === maxLen) trace(n.id);
  }
  return criticalNodes;
}

export function computeChain(
  nodeId: string,
  edges: ReadonlyArray<GraphEdge>,
): Set<string> {
  const result = new Set<string>([nodeId]);

  const bfsUp = edges.filter((e) => e.to === nodeId).map((e) => e.from);
  while (bfsUp.length > 0) {
    const curr = bfsUp.shift()!;
    result.add(curr);
    for (const e of edges) {
      if (e.to === curr && !result.has(e.from)) bfsUp.push(e.from);
    }
  }

  const bfsDown = edges.filter((e) => e.from === nodeId).map((e) => e.to);
  while (bfsDown.length > 0) {
    const curr = bfsDown.shift()!;
    result.add(curr);
    for (const e of edges) {
      if (e.from === curr && !result.has(e.to)) bfsDown.push(e.to);
    }
  }

  return result;
}
