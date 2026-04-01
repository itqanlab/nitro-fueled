/**
 * SupervisorEngine — Prompt Builder
 *
 * Provides complexity-aware worker prompt selection so that Simple tasks skip
 * the PM and Architect phases, reducing token cost by ~50%.
 *
 * Pipeline matrix:
 *  - Simple   → Team-Leader MODE 2 + Developer  (PM and Architect skipped)
 *  - Medium   → PM → Architect → Team-Leader + Developer
 *  - Complex  → PM → Architect → Team-Leader + Developer
 *
 * The full SupervisorEngine class (event loop, worker management) will be
 * added to this file by TASK_2026_338. This module is a standalone utility
 * that can be imported and tested independently.
 */

/** Worker types that receive a dynamically built prompt. */
export type PromptWorkerType = 'build' | 'prep' | 'implement' | 'review' | 'cleanup';

/** Context injected into every worker prompt. */
export interface PromptContext {
  taskId: string;
  workerId: string;
  sessionId: string;
  complexity: 'Simple' | 'Medium' | 'Complex' | string;
  priority: string;
  provider: string;
  model: string;
  retryCount: number;
  maxRetries: number;
  projectRoot: string;
}

/** Phases that a build worker will execute, derived from complexity. */
export interface BuildPipelineConfig {
  runPM: boolean;
  runArchitect: boolean;
  skippedPhases: string[];
}

/**
 * Returns the build pipeline configuration for a given complexity level.
 *
 * Simple tasks skip PM and Architect — they go directly to Team-Leader MODE 2
 * (tasks.md already exists from manual task creation) or the developer.
 * Medium and Complex tasks run the full PM → Architect → Team-Leader pipeline.
 */
export function getBuildPipelineConfig(complexity: string): BuildPipelineConfig {
  if (complexity === 'Simple') {
    return {
      runPM: false,
      runArchitect: false,
      skippedPhases: ['PM', 'Architect'],
    };
  }
  return {
    runPM: true,
    runArchitect: true,
    skippedPhases: [],
  };
}

/**
 * Build the orchestration instruction block for a Build Worker prompt.
 *
 * Returns the phase instruction paragraph that is injected into the
 * worker prompt template. For Simple tasks the PM and Architect instructions
 * are replaced with a direct jump to the dev loop.
 */
export function buildOrchestrationInstructions(complexity: string): string {
  const config = getBuildPipelineConfig(complexity);

  if (!config.runPM && !config.runArchitect) {
    return [
      '3. Run the orchestration flow: Team-Leader → Dev.',
      '   Phases SKIPPED for Simple complexity: PM, Architect.',
      '   The task description and plan are already defined in task.md.',
      '   Go directly to Team-Leader MODE 1 (if tasks.md is missing) or',
      '   MODE 2 (if tasks.md already exists with PENDING batches).',
      '   Complete ALL batches until tasks.md shows all tasks COMPLETE.',
    ].join('\n');
  }

  return [
    '3. Run the orchestration flow: PM -> Architect -> Team-Leader -> Dev.',
    '   Complete ALL batches until tasks.md shows all tasks COMPLETE.',
  ].join('\n');
}

/**
 * Build the phase telemetry annotation appended to each commit footer.
 *
 * Lists which phases were skipped so that cost analytics can attribute
 * savings to the complexity-aware skip logic.
 */
export function buildPhaseTelemetry(complexity: string): string {
  const config = getBuildPipelineConfig(complexity);
  if (config.skippedPhases.length === 0) return '';
  return `Skipped-Phases: ${config.skippedPhases.join(', ')}`;
}

/**
 * Render the full Build Worker prompt for the given context.
 *
 * This is the single entry point for prompt generation. It reads the
 * complexity from the context and injects the correct pipeline instructions.
 */
export function buildWorkerPrompt(ctx: PromptContext): string {
  const orchestrationInstructions = buildOrchestrationInstructions(ctx.complexity);
  const phaseTelemetry = buildPhaseTelemetry(ctx.complexity);
  const metaFooter = [
    `Task: ${ctx.taskId}`,
    `Agent: {agent-value}`,
    `Phase: implementation`,
    `Worker: build-worker`,
    `Session: ${ctx.sessionId}`,
    `Provider: ${ctx.provider}`,
    `Model: ${ctx.model}`,
    `Retry: ${ctx.retryCount}/${ctx.maxRetries}`,
    `Complexity: ${ctx.complexity}`,
    `Priority: ${ctx.priority}`,
    phaseTelemetry,
    `Generated-By: nitro-fueled v0.1.0 (https://github.com/itqanlab/nitro-fueled)`,
  ]
    .filter(Boolean)
    .join('\n');

  return `Run /orchestrate ${ctx.taskId}

BUILD WORKER — AUTONOMOUS MODE
WORKER_ID: ${ctx.workerId}

You are a Build Worker. Your job is to take this task from CREATED
through implementation. Follow these rules strictly:

1. FIRST: Write task-tracking/${ctx.taskId}/status with the single word
   IN_PROGRESS (no trailing newline). This signals the Supervisor that work has begun.

2. Do NOT pause for any user validation checkpoints. Auto-approve
   ALL checkpoints and continue immediately. There is no human at this terminal.

${orchestrationInstructions}

4. After ALL development is complete (all batches COMPLETE in tasks.md):
   a. Write task-tracking/${ctx.taskId}/handoff.md — MANDATORY before committing
   b. Create a git commit with all implementation code AND handoff.md
   c. Write task-tracking/${ctx.taskId}/status with the single word IMPLEMENTED
   d. Commit the status file

5. Before developers write any code, they MUST read:
   - .claude/review-lessons/*.md (all lesson files)
   - .claude/anti-patterns.md

6. EXIT GATE — verify all tasks in tasks.md COMPLETE, handoff.md written, code committed.

7. You do NOT run reviews. You do NOT write completion-report.md. Stop after IMPLEMENTED.

## Commit Metadata (REQUIRED for all commits)

${metaFooter}

Working directory: ${ctx.projectRoot}
Task folder: task-tracking/${ctx.taskId}/`;
}
