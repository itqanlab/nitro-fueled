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

/**
 * Reads and parses `.nitro-fueled/manifest.json` from the given directory.
 * Returns null if the file does not exist or cannot be parsed.
 */
export function readManifest(cwd: string): Manifest | null {
  const manifestPath = resolve(cwd, '.nitro-fueled', 'manifest.json');
  if (!existsSync(manifestPath)) return null;

  try {
    const raw = readFileSync(manifestPath, 'utf8');
    return JSON.parse(raw) as Manifest;
  } catch {
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
  mkdirSync(dir, { recursive: true });
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
}

/**
 * Computes the SHA-256 checksum of a file, prefixed with `sha256:`.
 */
export function computeChecksum(filePath: string): string {
  const content = readFileSync(filePath);
  const hash = createHash('sha256').update(content).digest('hex');
  return `sha256:${hash}`;
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
