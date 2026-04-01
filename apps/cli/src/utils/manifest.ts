import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { logger } from './logger.js';

/** Maximum content length to store as merge base (200 KB). Larger files are not stored. */
const MAX_BASE_CONTENT_LENGTH = 200_000;

export interface CoreFileEntry {
  checksum: string;
  installedVersion: string;
  /**
   * Original scaffold content stored as the merge base.
   * Present when the file was installed/updated at or after the version that
   * introduced three-way merge support. Absent for older manifest entries.
   */
  scaffoldContent?: string;
}

export interface GeneratedFileEntry {
  generatedAt: string;
  stack: string;
  generator: 'ai' | 'template';
}

export interface Manifest {
  version: string;
  installedAt: string;
  updatedAt: string;
  coreFiles: Record<string, CoreFileEntry>;
  generatedFiles: Record<string, GeneratedFileEntry>;
}

function isManifest(val: unknown): val is Manifest {
  if (typeof val !== 'object' || val === null) return false;
  const obj = val as Record<string, unknown>;
  return (
    typeof obj['version'] === 'string' &&
    typeof obj['installedAt'] === 'string' &&
    typeof obj['updatedAt'] === 'string' &&
    typeof obj['coreFiles'] === 'object' && obj['coreFiles'] !== null &&
    typeof obj['generatedFiles'] === 'object' && obj['generatedFiles'] !== null
  );
}

/**
 * Reads and parses `.nitro-fueled/manifest.json` from the given directory.
 * Returns null if the file does not exist or cannot be parsed.
 */
export function readManifest(cwd: string): Manifest | null {
  const manifestPath = resolve(cwd, '.nitro-fueled', 'manifest.json');
  if (!existsSync(manifestPath)) return null;

  try {
    const raw = readFileSync(manifestPath, 'utf8');
    const parsed: unknown = JSON.parse(raw);
    if (!isManifest(parsed)) {
      logger.error(`Warning: manifest.json has unexpected shape, ignoring`);
      return null;
    }
    return parsed;
  } catch (err: unknown) {
    logger.error(`Warning: failed to read manifest.json: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

/**
 * Writes the manifest to `.nitro-fueled/manifest.json`.
 * Creates the `.nitro-fueled/` directory if it does not exist.
 */
export function writeManifest(cwd: string, manifest: Manifest): void {
  const manifestPath = resolve(cwd, '.nitro-fueled', 'manifest.json');
  const dir = dirname(manifestPath);
  try {
    mkdirSync(dir, { recursive: true });
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  } catch (err: unknown) {
    throw new Error(`Failed to write manifest: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Computes the SHA-256 checksum of a file, prefixed with `sha256:`.
 */
export function computeChecksum(filePath: string): string {
  try {
    const content = readFileSync(filePath);
    const hash = createHash('sha256').update(content).digest('hex');
    return `sha256:${hash}`;
  } catch (err: unknown) {
    throw new Error(`Failed to checksum ${filePath}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Builds a CoreFileEntry for a single file: reads it, computes its checksum,
 * and stores the content as merge base (if within the size limit).
 */
export function buildCoreFileEntry(filePath: string, version: string): CoreFileEntry {
  const entry: CoreFileEntry = {
    checksum: computeChecksum(filePath),
    installedVersion: version,
  };
  try {
    const content = readFileSync(filePath, 'utf8');
    if (content.length <= MAX_BASE_CONTENT_LENGTH) {
      entry.scaffoldContent = content;
    }
  } catch {
    // Not critical — merge base is optional
  }
  return entry;
}
