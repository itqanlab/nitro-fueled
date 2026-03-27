import { existsSync, mkdirSync, readdirSync, copyFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const CURRENT_FILE = fileURLToPath(import.meta.url);

/**
 * Resolves the scaffold source directory.
 * Checks published package location first (scaffold/ next to dist/),
 * then falls back to repo root for development.
 */
export function resolveScaffoldRoot(): string {
  // Published: packages/cli/dist/utils/scaffold.js -> packages/cli/scaffold/
  const packageScaffold = resolve(CURRENT_FILE, '..', '..', '..', 'scaffold');
  if (existsSync(resolve(packageScaffold, '.claude', 'agents'))) {
    return packageScaffold;
  }

  // Development: packages/cli/src/utils/ -> repo root
  const repoRoot = resolve(CURRENT_FILE, '..', '..', '..', '..', '..');
  const repoScaffold = resolve(repoRoot, 'packages', 'cli', 'scaffold');
  if (existsSync(resolve(repoScaffold, '.claude', 'agents'))) {
    return repoScaffold;
  }

  throw new Error(
    'Could not find scaffold source directory. ' +
    'Run scripts/prepare-scaffold.sh to populate packages/cli/scaffold/.'
  );
}

export interface CopyResult {
  /** Number of files written (new or overwritten). */
  copied: number;
  /** Number of files skipped because they already existed and overwrite was false. */
  skipped: number;
  /** Number of directories created. */
  dirs: number;
  /** Absolute destination paths of files actually written (new or overwritten). */
  files: string[];
}

/**
 * Recursively copies a directory tree from src to dest.
 * If overwrite is false, existing files are skipped.
 */
export function copyDirRecursive(
  src: string,
  dest: string,
  overwrite: boolean
): CopyResult {
  const result: CopyResult = { copied: 0, skipped: 0, dirs: 0, files: [] };

  if (!existsSync(src)) {
    return result;
  }

  if (!existsSync(dest)) {
    mkdirSync(dest, { recursive: true });
    result.dirs++;
  }

  const entries = readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);

    if (entry.isSymbolicLink()) {
      continue;
    } else if (entry.isDirectory()) {
      const sub = copyDirRecursive(srcPath, destPath, overwrite);
      result.copied += sub.copied;
      result.skipped += sub.skipped;
      result.dirs += sub.dirs;
      result.files.push(...sub.files);
    } else if (entry.isFile()) {
      if (!overwrite && existsSync(destPath)) {
        result.skipped++;
      } else {
        copyFileSync(srcPath, destPath);
        result.copied++;
        result.files.push(destPath);
      }
    }
  }

  return result;
}

/**
 * Lists files in a directory (non-recursive, files only).
 */
export function listFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => e.name);
}

/**
 * Scaffolds a specific subdirectory from scaffold source to target.
 * Returns the copy result.
 */
export function scaffoldSubdir(
  scaffoldRoot: string,
  targetRoot: string,
  subdir: string,
  overwrite: boolean
): CopyResult {
  const src = resolve(scaffoldRoot, subdir);
  const dest = resolve(targetRoot, subdir);
  return copyDirRecursive(src, dest, overwrite);
}
