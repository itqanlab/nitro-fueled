import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ENTRIES = ['.nitro-fueled/', '.nitro/cortex.db'];

/**
 * Ensures `.nitro-fueled/` and `.nitro/cortex.db` are present in the project's .gitignore.
 * Returns true if the file was created or modified, false if no change was needed.
 */
export function ensureGitignore(cwd: string): boolean {
  const gitignorePath = resolve(cwd, '.gitignore');

  let existing = '';
  if (existsSync(gitignorePath)) {
    existing = readFileSync(gitignorePath, 'utf8');
  }

  const missing = ENTRIES.filter(e => !existing.split('\n').some(line => line.trim() === e));
  if (missing.length === 0) return false;

  const newContent = existing.length === 0
    ? missing.join('\n') + '\n'
    : (existing.endsWith('\n') ? existing : existing + '\n') + missing.join('\n') + '\n';

  writeFileSync(gitignorePath, newContent, 'utf8');
  return true;
}
