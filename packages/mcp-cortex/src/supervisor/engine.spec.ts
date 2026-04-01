import { describe, it, expect } from 'vitest';
import {
  getBuildPipelineConfig,
  buildOrchestrationInstructions,
  buildPhaseTelemetry,
  buildWorkerPrompt,
} from './engine.js';
import type { PromptContext } from './engine.js';

const baseCtx: PromptContext = {
  taskId: 'TASK_2026_001',
  workerId: 'WID_test1234',
  sessionId: 'SESSION_2026-01-01T10-00-00',
  complexity: 'Simple',
  priority: 'P2-Medium',
  provider: 'claude',
  model: 'claude-sonnet-4-6',
  retryCount: 0,
  maxRetries: 2,
  projectRoot: '/project',
};

describe('getBuildPipelineConfig', () => {
  it('skips PM and Architect for Simple', () => {
    const config = getBuildPipelineConfig('Simple');
    expect(config.runPM).toBe(false);
    expect(config.runArchitect).toBe(false);
    expect(config.skippedPhases).toEqual(['PM', 'Architect']);
  });

  it('runs full pipeline for Medium', () => {
    const config = getBuildPipelineConfig('Medium');
    expect(config.runPM).toBe(true);
    expect(config.runArchitect).toBe(true);
    expect(config.skippedPhases).toHaveLength(0);
  });

  it('runs full pipeline for Complex', () => {
    const config = getBuildPipelineConfig('Complex');
    expect(config.runPM).toBe(true);
    expect(config.runArchitect).toBe(true);
    expect(config.skippedPhases).toHaveLength(0);
  });

  it('runs full pipeline for unknown complexity', () => {
    const config = getBuildPipelineConfig('Unknown');
    expect(config.runPM).toBe(true);
    expect(config.runArchitect).toBe(true);
    expect(config.skippedPhases).toHaveLength(0);
  });
});

describe('buildOrchestrationInstructions', () => {
  it('mentions skipped phases for Simple', () => {
    const result = buildOrchestrationInstructions('Simple');
    expect(result).toContain('SKIPPED');
    expect(result).toContain('PM');
    expect(result).toContain('Architect');
    expect(result).not.toContain('PM -> Architect');
  });

  it('includes full pipeline instruction for Medium', () => {
    const result = buildOrchestrationInstructions('Medium');
    expect(result).toContain('PM -> Architect -> Team-Leader -> Dev');
    expect(result).not.toContain('SKIPPED');
  });

  it('includes full pipeline instruction for Complex', () => {
    const result = buildOrchestrationInstructions('Complex');
    expect(result).toContain('PM -> Architect -> Team-Leader -> Dev');
  });
});

describe('buildPhaseTelemetry', () => {
  it('returns skipped phases annotation for Simple', () => {
    const result = buildPhaseTelemetry('Simple');
    expect(result).toBe('Skipped-Phases: PM, Architect');
  });

  it('returns empty string for Medium (no skips)', () => {
    expect(buildPhaseTelemetry('Medium')).toBe('');
  });

  it('returns empty string for Complex (no skips)', () => {
    expect(buildPhaseTelemetry('Complex')).toBe('');
  });
});

describe('buildWorkerPrompt', () => {
  it('Simple prompt includes skipped phases annotation in footer', () => {
    const prompt = buildWorkerPrompt({ ...baseCtx, complexity: 'Simple' });
    expect(prompt).toContain('Skipped-Phases: PM, Architect');
  });

  it('Medium prompt does not include skipped phases', () => {
    const prompt = buildWorkerPrompt({ ...baseCtx, complexity: 'Medium' });
    expect(prompt).not.toContain('Skipped-Phases');
  });

  it('Simple prompt skips PM/Architect orchestration instructions', () => {
    const prompt = buildWorkerPrompt({ ...baseCtx, complexity: 'Simple' });
    expect(prompt).toContain('SKIPPED');
    expect(prompt).not.toContain('PM -> Architect');
  });

  it('Medium prompt includes full pipeline instructions', () => {
    const prompt = buildWorkerPrompt({ ...baseCtx, complexity: 'Medium' });
    expect(prompt).toContain('PM -> Architect -> Team-Leader -> Dev');
  });

  it('prompt contains task ID and worker ID', () => {
    const prompt = buildWorkerPrompt(baseCtx);
    expect(prompt).toContain('TASK_2026_001');
    expect(prompt).toContain('WID_test1234');
  });

  it('commit footer contains all required metadata fields', () => {
    const prompt = buildWorkerPrompt(baseCtx);
    expect(prompt).toContain('Task: TASK_2026_001');
    expect(prompt).toContain('Session: SESSION_2026-01-01T10-00-00');
    expect(prompt).toContain('Provider: claude');
    expect(prompt).toContain('Model: claude-sonnet-4-6');
    expect(prompt).toContain('Retry: 0/2');
    expect(prompt).toContain('Complexity: Simple');
    expect(prompt).toContain('Priority: P2-Medium');
    expect(prompt).toContain('Generated-By: nitro-fueled');
  });
});
