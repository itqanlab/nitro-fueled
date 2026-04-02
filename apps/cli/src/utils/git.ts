import { spawnSync } from 'node:child_process';
import { logger } from './logger.js';

/**
 * Returns true if cwd is inside a git repository.
 * Handles subdirectories, worktrees, and all other git repo layouts.
 */
export function isInsideGitRepo(cwd: string): boolean {
  const result = spawnSync('git', ['rev-parse', '--git-dir'], {
    cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return result.status === 0;
}

/**
 * Stages the specified files and creates a git commit.
 * Only the listed files are staged — pre-existing unstaged changes are untouched.
 * On commit failure, unstages the files (rollback) and returns false.
 */
export function commitFiles(
  cwd: string,
  files: string[],
  message: string
): boolean {
  const addResult = spawnSync('git', ['add', '--', ...files], {
    cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (addResult.status !== 0) {
    const stderr = addResult.stderr?.toString().trim() ?? '';
    logger.error(`Commit: git add failed${stderr !== '' ? ': ' + stderr : ''}`);
    return false;
  }

  const commitResult = spawnSync('git', ['commit', '-m', message], {
    cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (commitResult.status !== 0) {
    // Rollback: unstage the files we just staged
    spawnSync('git', ['reset', 'HEAD', '--', ...files], {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const stderr = commitResult.stderr?.toString().trim() ?? '';
    logger.error(`Commit: git commit failed${stderr !== '' ? ': ' + stderr : ''}`);
    return false;
  }

  return true;
}
