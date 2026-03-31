/**
 * PromptBuilderService — constructs the prompt passed to Build and Review workers.
 *
 * Mirrors the prompt structure used by the auto-pilot skill's spawn logic,
 * ensuring workers get the same instructions regardless of whether they were
 * spawned from a Claude Code conversation or from this persistent service.
 */
import { Injectable } from '@nestjs/common';
import type { ProviderType, WorkerType, SupervisorConfig, CustomFlow } from './auto-pilot.types';

export interface BuildPromptOpts {
  taskId: string;
  sessionId: string;
  provider: ProviderType;
  model: string;
  retryNumber: number;
  maxRetries: number;
  complexity: string;
  priority: string;
  workingDirectory: string;
  previousFailureReason?: string;
  customFlow?: CustomFlow | null;
}

export interface ReviewPromptOpts {
  taskId: string;
  sessionId: string;
  provider: ProviderType;
  model: string;
  workingDirectory: string;
}

@Injectable()
export class PromptBuilderService {

  public buildWorkerPrompt(opts: BuildPromptOpts): string {
    const isRetry = opts.retryNumber > 0;
    const modeHeader = isRetry
      ? `BUILD WORKER — CONTINUATION MODE\nThis task was previously attempted ${opts.retryNumber} time(s).\n${opts.previousFailureReason ? `Previous failure: ${opts.previousFailureReason}.\n` : ''}`
      : 'BUILD WORKER — AUTONOMOUS MODE\nWORKER_ID: auto-assigned';

    const resumeInstructions = isRetry
      ? `
3. Check the task folder for existing deliverables:
   - context.md exists? -> PM phase already done
   - task-description.md exists? -> Requirements already done
   - plan.md (or legacy: implementation-plan.md) exists? -> Architecture already done
   - tasks.md exists? -> Check task statuses to see dev progress
   The orchestration skill's phase detection will automatically
   determine where to resume based on which files exist.

4. Do NOT restart from scratch. Resume from the detected phase.`
      : `
3. Run the orchestration flow: PM -> Architect -> Team-Leader -> Dev.
   Complete ALL batches until tasks.md shows all tasks COMPLETE.`;

    const customFlowSection = opts.customFlow
      ? `\nCUSTOM FLOW OVERRIDE (flow: "${opts.customFlow.name}", id: ${opts.customFlow.id}):\nThis task has a custom orchestration flow assigned. Use this agent sequence instead of the default type-based strategy:\n${opts.customFlow.steps.map((s, i) => `Step ${i + 1}: ${s.agent} (${s.label})`).join('\n')}\nRun the agents in this exact order. Do not use the default FEATURE/BUGFIX/etc. auto-detection strategy.\n`
      : '';

    return `Run /orchestrate ${opts.taskId}

${modeHeader}
${customFlowSection}
AUTONOMOUS MODE — follow these rules strictly:

1. FIRST: Write task-tracking/${opts.taskId}/status with the single word
   IN_PROGRESS (no trailing newline)${isRetry ? ', if not already.' : '. This signals the Supervisor that work has begun.'}
   If the nitro-cortex MCP server is available:
   also call update_task("${opts.taskId}", fields=JSON.stringify({status: "IN_PROGRESS"})).
   Best-effort — if it fails, continue.

2. Do NOT pause for any user validation checkpoints. Auto-approve
   ALL checkpoints and continue immediately. No human at this terminal.
${resumeInstructions}

5. Before developers write any code, they MUST read
   ALL review-lessons files and anti-patterns:
   - Read .claude/review-lessons/*.md (all lesson files)
   - Read .claude/anti-patterns.md

6. After ALL development is complete (all batches COMPLETE in tasks.md):
   a. Write task-tracking/${opts.taskId}/handoff.md — this is MANDATORY before committing:
      # Handoff — ${opts.taskId}
      ## Files Changed
      - path/to/file (new/modified, +N -N lines)
      ## Commits
      - <hash>: <commit message>
      ## Decisions
      - Key architectural decision and why
      ## Known Risks
      - Areas with weak coverage or edge cases
   b. Create a git commit with all implementation code AND handoff.md
   c. Populate file scope
   d. Write task-tracking/${opts.taskId}/status with the single word IMPLEMENTED
      If the nitro-cortex MCP server is available:
      also call update_task("${opts.taskId}", fields=JSON.stringify({status: "IMPLEMENTED"})).
   e. Commit the status file: docs: mark ${opts.taskId} IMPLEMENTED

7. EXIT GATE — Before exiting, verify:
   - [ ] All tasks in tasks.md are COMPLETE
   - [ ] task-tracking/${opts.taskId}/handoff.md exists with all 4 sections
   - [ ] Implementation code is committed (handoff.md included in commit)
   - [ ] task-tracking/${opts.taskId}/status contains IMPLEMENTED
   - [ ] Status file commit exists in git log
   If any check fails, fix it before exiting.
   If you cannot pass the Exit Gate, write exit-gate-failure.md.

8. You do NOT run reviews. Stop after IMPLEMENTED.

## Commit Metadata (REQUIRED for all commits)

Task: ${opts.taskId}
Agent: nitro-frontend-developer
Phase: implementation
Worker: build-worker
Session: ${opts.sessionId}
Provider: ${opts.provider}
Model: ${opts.model}
Retry: ${opts.retryNumber}/${opts.maxRetries}
Complexity: ${opts.complexity}
Priority: ${opts.priority}
Generated-By: nitro-fueled v1.0 (https://github.com/itqanlab/nitro-fueled)

Working directory: ${opts.workingDirectory}
Task folder: task-tracking/${opts.taskId}/`;
  }

  public reviewWorkerPrompt(opts: ReviewPromptOpts): string {
    return `Run /orchestrate ${opts.taskId} --review-only

REVIEW WORKER — AUTONOMOUS MODE

AUTONOMOUS MODE — follow these rules strictly:

1. Read task-tracking/${opts.taskId}/handoff.md to understand what was built.

2. Run all review phases: code-style, code-logic, security.
   For each review:
   - Read the relevant files listed in handoff.md
   - Apply review criteria from .claude/review-lessons/*.md
   - Write findings to task-tracking/${opts.taskId}/ as review artifacts

3. If reviews pass (no critical/serious findings):
   - Write COMPLETE to task-tracking/${opts.taskId}/status
   - Call update_task("${opts.taskId}", fields=JSON.stringify({status: "COMPLETE"}))
   - Write completion-report.md

4. If reviews fail:
   - Write findings to review artifacts
   - Set status to FIXING
   - Apply fixes
   - Re-run failed reviews
   - If fixes pass, write COMPLETE to status
   - If fixes fail after 2 cycles, write BLOCKED to status

## Commit Metadata

Task: ${opts.taskId}
Agent: nitro-review-lead
Phase: review
Worker: review-worker
Session: ${opts.sessionId}
Provider: ${opts.provider}
Model: ${opts.model}
Generated-By: nitro-fueled v1.0 (https://github.com/itqanlab/nitro-fueled)

Working directory: ${opts.workingDirectory}
Task folder: task-tracking/${opts.taskId}/`;
  }
}
