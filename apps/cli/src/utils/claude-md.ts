import { existsSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const IMPORT_LINE = '@./.nitro/CLAUDE.nitro.md';

export function ensureClaudeMdImport(cwd: string): boolean {
  const claudeMdPath = resolve(cwd, 'CLAUDE.md');

  if (!existsSync(claudeMdPath)) {
    try {
      writeFileSync(claudeMdPath, `${IMPORT_LINE}\n`, 'utf-8');
      console.log('  CLAUDE.md created with nitro import line');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`Error: Could not write CLAUDE.md: ${msg}`);
      return false;
    }
    return true;
  }

  const existing = readFileSync(claudeMdPath, 'utf-8');

  if (existing.includes(IMPORT_LINE)) {
    console.log('  CLAUDE.md already imports .nitro/CLAUDE.nitro.md (skipped)');
    return true;
  }

  try {
    writeFileSync(claudeMdPath, `${existing}\n${IMPORT_LINE}\n`, 'utf-8');
    console.log('  CLAUDE.md updated: appended nitro import line');
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`Error: Could not update CLAUDE.md: ${msg}`);
    return false;
  }
  return true;
}
