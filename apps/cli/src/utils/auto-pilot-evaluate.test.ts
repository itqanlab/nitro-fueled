/**
 * Smoke tests for TASK_2026_124 — Evaluation Supervisor (Single Model Mode)
 *
 * All changed files in scope are markdown prompt templates, not executable
 * TypeScript code. These tests verify that the markdown files exist and contain
 * the expected keywords and structural elements introduced by this task.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

// Path from apps/cli back to repo root
const ROOT = resolve(__dirname, '../../../../');

const SKILL_PATH = resolve(ROOT, '.claude/skills/auto-pilot/SKILL.md');
const COMMAND_PATH = resolve(ROOT, '.claude/commands/nitro-auto-pilot.md');

describe('TASK_2026_124 — markdown file presence', () => {
  it('auto-pilot SKILL.md exists', () => {
    expect(existsSync(SKILL_PATH)).toBe(true);
  });

  it('nitro-auto-pilot.md command file exists', () => {
    expect(existsSync(COMMAND_PATH)).toBe(true);
  });
});

describe('TASK_2026_124 — SKILL.md evaluation mode content', () => {
  let content: string;

  beforeAll(() => {
    content = readFileSync(SKILL_PATH, 'utf8');
  });

  it('contains Evaluation Mode section heading', () => {
    expect(content).toContain('## Evaluation Mode');
  });

  it('contains --evaluate flag reference', () => {
    expect(content).toContain('--evaluate');
  });

  it('contains Evaluate entry in Modes table', () => {
    expect(content).toContain('**Evaluate**');
  });

  it('references benchmark-suite directory', () => {
    expect(content).toContain('benchmark-suite/');
  });

  it('references evaluations output directory', () => {
    expect(content).toContain('evaluations/');
  });

  it('references model-id parameter', () => {
    expect(content).toContain('model-id');
  });

  it('describes metrics collection (wall-clock time)', () => {
    expect(content).toContain('wall-clock');
  });

  it('references per-task results storage path', () => {
    expect(content).toMatch(/evaluations\/<date>-<model>\/|evaluations\/\{EVAL_DATE\}-\{eval_model_id\}\//);
  });

  it('contains fatal error for missing benchmark-suite config', () => {
    expect(content).toContain('benchmark-suite/config.md');
  });

  it('describes worktree isolation for evaluation runs', () => {
    expect(content.toLowerCase()).toContain('worktree');
  });
});

describe('TASK_2026_124 — nitro-auto-pilot.md command content', () => {
  let content: string;

  beforeAll(() => {
    content = readFileSync(COMMAND_PATH, 'utf8');
  });

  it('contains --evaluate flag in usage examples', () => {
    expect(content).toContain('--evaluate');
  });

  it('documents --evaluate parameter in parameters table', () => {
    // Parameter table row: | --evaluate | model-id string | ...
    expect(content).toMatch(/--evaluate\s*\|/);
  });

  it('describes evaluation mode in parameter table description', () => {
    expect(content).toContain('evaluation mode');
  });

  it('lists evaluate in Quick Reference modes', () => {
    // Quick Reference section should list evaluate as a mode
    expect(content).toContain('evaluate');
  });

  it('contains usage example with a real model ID', () => {
    // Should show a concrete example like claude-opus-4-6
    expect(content).toMatch(/--evaluate\s+[\w.-]+/);
  });

  it('references the Evaluation Mode section in SKILL.md', () => {
    // Command file should direct reader to SKILL.md for evaluation flow
    expect(content).toContain('Evaluation Mode');
  });

  it('documents that --evaluate skips Steps 3 and 4', () => {
    // Command flow should note that evaluation bypasses pre-flight validation
    expect(content).toContain('--evaluate');
    // The command text directs to evaluation mode, bypassing normal registry steps
    expect(content).toMatch(/skip Steps 3 and 4|Evaluation Mode sequence/i);
  });
});
