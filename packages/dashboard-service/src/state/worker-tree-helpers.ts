import type { WorkerTree, WorkerTreeNode, WorkerHealth } from '../events/event-types.js';

type WorkerInput = {
  readonly workerId: string;
  readonly taskId: string;
  readonly label: string;
  readonly workerType: string;
  readonly status: string;
  readonly spawnTime: string;
  readonly stuckCount: number;
  readonly lastHealth: string;
  readonly expectedEndState: string;
};

const REVIEW_LEAD_CHILDREN = new Set([
  'style reviewer', 'logic reviewer', 'security reviewer',
  'code style', 'code logic', 'code security',
  'code-style', 'code-logic', 'code-security',
]);

const TEST_LEAD_CHILDREN = new Set([
  'unit tester', 'integration tester', 'e2e tester',
  'unit-tester', 'integration-tester', 'e2e-tester',
]);

export function inferRole(label: string): string {
  const lower = label.toLowerCase();
  if (lower.includes('build worker')) return 'Build Worker';
  if (lower.includes('review lead')) return 'Review Lead';
  if (lower.includes('test lead')) return 'Test Lead';
  if (lower.includes('fix worker')) return 'Fix Worker';
  if (lower.includes('completion worker')) return 'Completion Worker';
  if (lower.includes('style reviewer') || lower.includes('code style') || lower.includes('code-style')) return 'Style Reviewer';
  if (lower.includes('logic reviewer') || lower.includes('code logic') || lower.includes('code-logic')) return 'Logic Reviewer';
  if (lower.includes('security reviewer') || lower.includes('code security') || lower.includes('code-security')) return 'Security Reviewer';
  if (lower.includes('unit tester') || lower.includes('unit-tester')) return 'Unit Tester';
  if (lower.includes('integration tester') || lower.includes('integration-tester')) return 'Integration Tester';
  if (lower.includes('e2e tester') || lower.includes('e2e-tester')) return 'E2E Tester';
  return label;
}

export function computeHealth(stuckCount: number): WorkerHealth {
  if (stuckCount > 2) return 'stuck';
  if (stuckCount > 0) return 'warning';
  return 'healthy';
}

export function buildWorkerTrees(
  workers: ReadonlyArray<WorkerInput>,
): ReadonlyArray<WorkerTree> {
  const byTask = new Map<string, WorkerInput[]>();
  for (const w of workers) {
    const group = byTask.get(w.taskId) ?? [];
    group.push(w);
    byTask.set(w.taskId, group);
  }

  return Array.from(byTask.entries()).map(([taskId, taskWorkers]) => {
    return buildTaskTree(taskId, taskWorkers);
  });
}

function buildTaskTree(taskId: string, taskWorkers: ReadonlyArray<WorkerInput>): WorkerTree {
  const roots: WorkerTreeNode[] = [];
  const reviewLeadChildren: WorkerTreeNode[] = [];
  const testLeadChildren: WorkerTreeNode[] = [];
  let reviewLeadNode: WorkerTreeNode | null = null;
  let testLeadNode: WorkerTreeNode | null = null;

  for (const w of taskWorkers) {
    const role = inferRole(w.label);
    const health = computeHealth(w.stuckCount);
    const spawnMs = w.spawnTime ? new Date(w.spawnTime).getTime() : NaN;
    const elapsedMs = Number.isNaN(spawnMs) ? 0 : Math.max(0, Date.now() - spawnMs);

    const node: WorkerTreeNode = {
      workerId: w.workerId,
      taskId: w.taskId,
      label: w.label,
      role,
      workerType: w.workerType,
      status: w.status,
      health,
      elapsedMs,
      spawnTime: w.spawnTime,
      stuckCount: w.stuckCount,
      children: [],
    };

    if (role === 'Review Lead') {
      reviewLeadNode = node;
    } else if (role === 'Test Lead') {
      testLeadNode = node;
    } else if (REVIEW_LEAD_CHILDREN.has(role.toLowerCase())) {
      reviewLeadChildren.push(node);
    } else if (TEST_LEAD_CHILDREN.has(role.toLowerCase())) {
      testLeadChildren.push(node);
    } else {
      roots.push(node);
    }
  }

  if (reviewLeadNode !== null) {
    roots.push({ ...reviewLeadNode, children: reviewLeadChildren });
  } else {
    roots.push(...reviewLeadChildren);
  }

  if (testLeadNode !== null) {
    roots.push({ ...testLeadNode, children: testLeadChildren });
  } else {
    roots.push(...testLeadChildren);
  }

  return { taskId, roots };
}
