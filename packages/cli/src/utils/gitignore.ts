import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const NITRO_ENTRY = '.nitro-fueled/';
// Match the exact entry on a line boundary to avoid false positives
const ENTRY_REGEX = /^\.nitro-fueled\/$/m;

/**
 * Ensures `.nitro-fueled/` is present in the project's .gitignore.
 * Returns true if the file was created or modified, false if no change was needed.
 */
export function ensureGitignore(cwd: string): boolean {
  const gitignorePath = resolve(cwd, '.gitignore');

  if (existsSync(gitignorePath)) {
    const content = readFileSync(gitignorePath, 'utf8');
    if (ENTRY_REGEX.test(content)) return false;
    const newContent = content.endsWith('\n')
      ? content + NITRO_ENTRY + '\n'
      : content + '\n' + NITRO_ENTRY + '\n';
    writeFileSync(gitignorePath, newContent, 'utf8');
    return true;
  } else {
    writeFileSync(gitignorePath, NITRO_ENTRY + '\n', 'utf8');
    return true;
  }
}
