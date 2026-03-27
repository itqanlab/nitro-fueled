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

  const inDegree = new Map<string, number>();
  const outEdges = new Map<string, string[]>();
  for (const n of nodes) {
    inDegree.set(n.id, 0);
    outEdges.set(n.id, []);
  }
  for (const e of edges) {
    outEdges.get(e.from)?.push(e.to);
    inDegree.set(e.to, (inDegree.get(e.to) ?? 0) + 1);
  }

  // Longest-path column assignment (cycle-safe)
  const col = new Map<string, number>();
  const visited = new Set<string>();
  const nodeIds = nodes.map((n) => n.id);

  function assignCol(id: string, depth: number): void {
    const current = col.get(id) ?? 0;
    if (depth > current) col.set(id, depth);
    if (visited.has(id)) return;
    visited.add(id);
    for (const next of outEdges.get(id) ?? []) {
      assignCol(next, (col.get(id) ?? depth) + 1);
    }
  }

  for (const id of nodeIds) {
    if ((inDegree.get(id) ?? 0) === 0) assignCol(id, 0);
  }
  for (const id of nodeIds) {
    if (!col.has(id)) col.set(id, 0);
  }

  const colGroups = new Map<number, string[]>();
  for (const id of nodeIds) {
    const c = col.get(id) ?? 0;
    const group = colGroups.get(c) ?? [];
    group.push(id);
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

  const memo = new Map<string, number>();
  function longestFrom(id: string, visiting: Set<string>): number {
    if (memo.has(id)) return memo.get(id)!;
    if (visiting.has(id)) return 0;
    visiting.add(id);
    const nexts = outEdges.get(id) ?? [];
    const len =
      nexts.length === 0 ? 0 : 1 + Math.max(...nexts.map((n) => longestFrom(n, visiting)));
    visiting.delete(id);
    memo.set(id, len);
    return len;
  }

  for (const n of nodes) longestFrom(n.id, new Set());

  const maxLen = Math.max(...[...memo.values()]);
  if (maxLen === 0) return new Set();

  const criticalNodes = new Set<string>();
  function trace(id: string): void {
    criticalNodes.add(id);
    for (const next of outEdges.get(id) ?? []) {
      if ((memo.get(next) ?? 0) === (memo.get(id) ?? 0) - 1) trace(next);
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
