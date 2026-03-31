import { existsSync, mkdirSync, readdirSync, copyFileSync } from 'node:fs';
import { resolve, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const CURRENT_FILE = fileURLToPath(import.meta.url);

/**
 * Resolves the scaffold source directory.
 * Checks published package location first (scaffold/ next to dist/),
 * then falls back to repo root for development.
 */
export function resolveScaffoldRoot(): string {
  // Published: apps/cli/dist/utils/scaffold.js -> apps/cli/scaffold/
  const packageScaffold = resolve(CURRENT_FILE, '..', '..', '..', 'scaffold');
  if (existsSync(resolve(packageScaffold, 'nitro', 'agents'))) {
    return packageScaffold;
  }

  // Development: apps/cli/src/utils/ -> repo root
  const repoRoot = resolve(CURRENT_FILE, '..', '..', '..', '..', '..');
  const repoScaffold = resolve(repoRoot, 'apps', 'cli', 'scaffold');
  if (existsSync(resolve(repoScaffold, 'nitro', 'agents'))) {
    return repoScaffold;
  }

  throw new Error(
    'Could not find scaffold source directory. ' +
    'Run scripts/prepare-scaffold.sh to populate apps/cli/scaffold/.'
  );
}

/**
 * Maps a scaffold-relative path to the target-project-relative path.
 * scaffold/nitro/X  → .claude/X  (lands in .claude/ in target project)
 * scaffold/nitro-root/X → .nitro/X  (lands in .nitro/ in target project)
 * All other paths are returned unchanged.
 */
export function mapScaffoldRelPath(relPath: string): string {
  if (relPath.startsWith('nitro/')) return '.claude/' + relPath.slice('nitro/'.length);
  if (relPath.startsWith('nitro-root/')) return '.nitro/' + relPath.slice('nitro-root/'.length);
  return relPath;
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
 * Recursively walks a scaffold directory and returns a map of targetRelPath -> absPath.
 * targetRelPath is the destination-relative path in the target project (forward slashes):
 *   nitro/X  → .claude/X
 *   nitro-root/X → .nitro/X
 *   other/X → other/X (unchanged)
 * Symlinks are skipped.
 */
export function walkScaffoldFiles(scaffoldRoot: string): Map<string, string> {
  const result = new Map<string, string>();

  function walk(dir: string): void {
    if (!existsSync(dir)) return;
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const absPath = join(dir, entry.name);
      if (entry.isSymbolicLink()) {
        continue;
      } else if (entry.isDirectory()) {
        walk(absPath);
      } else if (entry.isFile()) {
        const scaffoldRel = relative(scaffoldRoot, absPath).replace(/\\/g, '/');
        const targetRel = mapScaffoldRelPath(scaffoldRel);
        result.set(targetRel, absPath);
      }
    }
  }

  walk(scaffoldRoot);
  return result;
}

/**
 * Scaffolds a specific subdirectory from scaffold source to target.
 * srcSubdir is relative to scaffoldRoot; destSubdir is relative to targetRoot.
 * If destSubdir is omitted, srcSubdir is used for both (legacy behaviour).
 */
export function scaffoldSubdir(
  scaffoldRoot: string,
  targetRoot: string,
  srcSubdir: string,
  overwrite: boolean,
  destSubdir?: string
): CopyResult {
  const src = resolve(scaffoldRoot, srcSubdir);
  const dest = resolve(targetRoot, destSubdir ?? srcSubdir);
  return copyDirRecursive(src, dest, overwrite);
}
