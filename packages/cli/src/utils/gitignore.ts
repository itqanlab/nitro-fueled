import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const NITRO_ENTRY = '.nitro-fueled/';
// Match the exact entry on a line boundary to avoid false positives
const ENTRY_REGEX = /^\.nitro-fueled\/$/m;

export function ensureGitignore(cwd: string): void {
  const gitignorePath = resolve(cwd, '.gitignore');

  if (existsSync(gitignorePath)) {
    const content = readFileSync(gitignorePath, 'utf8');
    if (ENTRY_REGEX.test(content)) return;
    const newContent = content.endsWith('\n')
      ? content + NITRO_ENTRY + '\n'
      : content + '\n' + NITRO_ENTRY + '\n';
    writeFileSync(gitignorePath, newContent, 'utf8');
  } else {
    writeFileSync(gitignorePath, NITRO_ENTRY + '\n', 'utf8');
  }
}
