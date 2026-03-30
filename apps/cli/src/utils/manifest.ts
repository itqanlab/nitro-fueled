import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

export interface CoreFileEntry {
  checksum: string;
  installedVersion: string;
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
      console.error(`Warning: manifest.json has unexpected shape, ignoring`);
      return null;
    }
    return parsed;
  } catch (err: unknown) {
    console.error(`Warning: failed to read manifest.json: ${err instanceof Error ? err.message : String(err)}`);
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
 * Builds a CoreFileEntry for a single file: reads it and computes its checksum.
 */
export function buildCoreFileEntry(filePath: string, version: string): CoreFileEntry {
  return {
    checksum: computeChecksum(filePath),
    installedVersion: version,
  };
}
