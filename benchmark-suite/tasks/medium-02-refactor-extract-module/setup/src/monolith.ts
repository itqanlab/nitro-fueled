// Task Runner -- monolithic implementation combining parsing, scheduling,
// and execution in a single file. Types are mixed in with logic throughout.

export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface Task {
  id: string;
  name: string;
  dependencies: string[];
  execute: () => Promise<void>;
  status: TaskStatus;
}

export interface TaskConfig {
  tasks: Array<{
    id: string;
    name: string;
    dependencies?: string[];
    handler: () => Promise<void>;
  }>;
}

// -- Parsing logic --
function parseTasks(config: TaskConfig): Task[] {
  if (!config || !Array.isArray(config.tasks)) {
    throw new Error('Invalid task config: expected an object with a "tasks" array');
  }

  const seenIds = new Set<string>();
  for (const entry of config.tasks) {
    if (!entry.id || typeof entry.id !== 'string') {
      throw new Error('Invalid task config: each task must have a non-empty string "id"');
    }
    if (seenIds.has(entry.id)) {
      throw new Error(`Duplicate task ID: "${entry.id}"`);
    }
    seenIds.add(entry.id);
  }

  // Validate dependency references
  for (const entry of config.tasks) {
    const deps = entry.dependencies ?? [];
    for (const dep of deps) {
      if (!seenIds.has(dep)) {
        throw new Error(
          `Task "${entry.id}" depends on unknown task "${dep}"`
        );
      }
    }
  }

  return config.tasks.map((entry) => ({
    id: entry.id,
    name: entry.name,
    dependencies: entry.dependencies ?? [],
    execute: entry.handler,
    status: 'pending',
  }));
}

// Result type -- defined here between parsing and scheduling (poor organization)
export interface ExecutionResult {
  taskId: string;
  status: TaskStatus;
  duration: number; // milliseconds
  error?: string;
}

// -- Scheduling logic (Kahn's algorithm for topological sort) --
function scheduleTasks(tasks: Task[]): Task[] {
  const taskMap = new Map<string, Task>();
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  // Build graph
  for (const task of tasks) {
    taskMap.set(task.id, task);
    inDegree.set(task.id, 0);
    adjacency.set(task.id, []);
  }

  // Calculate in-degrees and adjacency lists
  for (const task of tasks) {
    for (const dep of task.dependencies) {
      const neighbors = adjacency.get(dep);
      if (neighbors) {
        neighbors.push(task.id);
      }
      inDegree.set(task.id, (inDegree.get(task.id) ?? 0) + 1);
    }
  }

  // Collect nodes with zero in-degree
  const queue: string[] = [];
  for (const [id, degree] of inDegree.entries()) {
    if (degree === 0) {
      queue.push(id);
    }
  }

  const sorted: Task[] = [];

  while (queue.length > 0) {
    const current = queue.shift()!;
    const task = taskMap.get(current)!;
    sorted.push(task);

    const neighbors = adjacency.get(current) ?? [];
    for (const neighbor of neighbors) {
      const newDegree = (inDegree.get(neighbor) ?? 1) - 1;
      inDegree.set(neighbor, newDegree);
      if (newDegree === 0) {
        queue.push(neighbor);
      }
    }
  }

  // If we didn't process all tasks, there must be a cycle
  if (sorted.length !== tasks.length) {
    const remaining = tasks
      .filter((t) => !sorted.some((s) => s.id === t.id))
      .map((t) => t.id);
    throw new Error(
      `Circular dependency detected among tasks: ${remaining.join(' -> ')}`
    );
  }

  return sorted;
}

// -- Execution logic --
async function executeTasks(tasks: Task[]): Promise<ExecutionResult[]> {
  const results: ExecutionResult[] = [];
  const statusMap = new Map<string, TaskStatus>();

  for (const task of tasks) {
    // Check if any dependency has failed
    const hasFailedDep = task.dependencies.some(
      (dep) => statusMap.get(dep) === 'failed'
    );

    if (hasFailedDep) {
      task.status = 'failed';
      statusMap.set(task.id, 'failed');
      results.push({
        taskId: task.id,
        status: 'failed',
        duration: 0,
        error: 'Skipped: one or more dependencies failed',
      });
      continue;
    }

    task.status = 'running';
    const startTime = Date.now();

    try {
      await task.execute();
      const duration = Date.now() - startTime;
      task.status = 'completed';
      statusMap.set(task.id, 'completed');
      results.push({
        taskId: task.id,
        status: 'completed',
        duration,
      });
    } catch (err: unknown) {
      const duration = Date.now() - startTime;
      const errorMessage = err instanceof Error ? err.message : String(err);
      task.status = 'failed';
      statusMap.set(task.id, 'failed');
      results.push({
        taskId: task.id,
        status: 'failed',
        duration,
        error: errorMessage,
      });
    }
  }

  return results;
}

// -- Public API --
export async function runTasks(config: TaskConfig): Promise<ExecutionResult[]> {
  const tasks = parseTasks(config);
  const sorted = scheduleTasks(tasks);
  return executeTasks(sorted);
}
