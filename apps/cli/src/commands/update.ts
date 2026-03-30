import { existsSync, copyFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname, sep } from 'node:path';
import { Flags } from '@oclif/core';
import { BaseCommand } from '../base-command.js';
import { resolveScaffoldRoot, walkScaffoldFiles } from '../utils/scaffold.js';
import { readManifest, writeManifest, computeChecksum, buildCoreFileEntry } from '../utils/manifest.js';
import type { Manifest } from '../utils/manifest.js';
import { detectStack } from '../utils/stack-detect.js';
import { generateAntiPatterns } from '../utils/anti-patterns.js';
import { getPackageVersion } from '../utils/package-version.js';
import { runCortexStep } from '../utils/cortex-hydrate.js';

type FileOutcome = 'updated' | 'added' | 'skipped' | 'reinstalled';

interface FileResult {
  relPath: string;
  outcome: FileOutcome;
}

function ensureParentDir(filePath: string): void {
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function copyFile(srcPath: string, destPath: string, dryRun: boolean): void {
  if (dryRun) return;
  ensureParentDir(destPath);
  copyFileSync(srcPath, destPath);
}

function getCurrentChecksum(filePath: string): string | null {
  if (!existsSync(filePath)) return null;
  try {
    return computeChecksum(filePath);
  } catch {
    return null;
  }
}

function processScaffoldFiles(
  scaffoldFiles: Map<string, string>,
  manifest: Manifest,
  cwd: string,
  dryRun: boolean
): FileResult[] {
  const results: FileResult[] = [];

  for (const [relPath, srcPath] of scaffoldFiles) {
    // Skip generated files — those are project-specific
    if (relPath in manifest.generatedFiles) {
      continue;
    }

    const destPath = resolve(cwd, relPath);
    const cwdNorm = resolve(cwd) + sep;
    if (!destPath.startsWith(cwdNorm) && destPath !== resolve(cwd)) {
      console.error(`Warning: skipping ${relPath} — resolved path escapes project root`);
      continue;
    }
    const inManifest = relPath in manifest.coreFiles;

    if (!inManifest) {
      // New file introduced in the update — add automatically
      copyFile(srcPath, destPath, dryRun);
      results.push({ relPath, outcome: 'added' });
      continue;
    }

    if (!existsSync(destPath)) {
      // File was deleted by user — reinstall from scaffold
      copyFile(srcPath, destPath, dryRun);
      results.push({ relPath, outcome: 'reinstalled' });
      continue;
    }

    const currentChecksum = getCurrentChecksum(destPath);
    const manifestChecksum = manifest.coreFiles[relPath].checksum;

    if (currentChecksum === manifestChecksum) {
      // File is unchanged — safe to auto-update
      copyFile(srcPath, destPath, dryRun);
      results.push({ relPath, outcome: 'updated' });
    } else {
      // User has modified this file — skip it
      results.push({ relPath, outcome: 'skipped' });
    }
  }

  return results;
}

function updateManifestData(
  manifest: Manifest,
  results: FileResult[],
  scaffoldFiles: Map<string, string>,
  cwd: string,
  latestVersion: string
): void {
  const now = new Date().toISOString();
  manifest.version = latestVersion;
  manifest.updatedAt = now;

  // Update entries for all processed files (updated, added, reinstalled)
  for (const result of results) {
    if (result.outcome === 'skipped') continue;
    const destPath = resolve(cwd, result.relPath);
    if (!existsSync(destPath)) continue;
    try {
      manifest.coreFiles[result.relPath] = buildCoreFileEntry(destPath, latestVersion);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`Warning: could not checksum ${result.relPath}: ${msg}`);
    }
  }

  // Remove keys no longer present in scaffold
  const scaffoldKeys = new Set(scaffoldFiles.keys());
  for (const key of Object.keys(manifest.coreFiles)) {
    if (!scaffoldKeys.has(key)) {
      delete manifest.coreFiles[key];
    }
  }
}

function printResults(
  results: FileResult[],
  manifest: Manifest,
  latestVersion: string,
  dryRun: boolean
): void {
  const updated = results.filter((r) => r.outcome === 'updated');
  const added = results.filter((r) => r.outcome === 'added');
  const reinstalled = results.filter((r) => r.outcome === 'reinstalled');
  const skipped = results.filter((r) => r.outcome === 'skipped');

  const dryRunLabel = dryRun ? ' [dry-run]' : '';

  for (const r of updated) {
    console.log(`  ✓ ${r.relPath.padEnd(55)} auto-updated (unchanged)${dryRunLabel}`);
  }
  for (const r of reinstalled) {
    console.log(`  ✓ ${r.relPath.padEnd(55)} reinstalled (was deleted)${dryRunLabel}`);
  }
  for (const r of added) {
    console.log(`  + ${r.relPath.padEnd(55)} new in v${latestVersion} — added${dryRunLabel}`);
  }
  for (const r of skipped) {
    console.log(`  ~ ${r.relPath.padEnd(55)} modified by you — skipped`);
  }

  console.log('');
  const totalChanged = updated.length + reinstalled.length + added.length;
  console.log(`Updated: ${totalChanged} file${totalChanged !== 1 ? 's' : ''}`);
  if (skipped.length > 0) {
    console.log(`Skipped (modified): ${skipped.length} file${skipped.length !== 1 ? 's' : ''}`);
  }
  if (added.length > 0) {
    console.log(`New files added: ${added.length} file${added.length !== 1 ? 's' : ''}`);
  }

  const generatedKeys = Object.keys(manifest.generatedFiles);
  if (generatedKeys.length > 0) {
    console.log('');
    console.log('Generated files (not touched):');
    for (const key of generatedKeys) {
      console.log(`  ${key.padEnd(55)} (use --regen to regenerate)`);
    }
  }

  if (!dryRun) {
    console.log('');
    console.log(`Manifest updated to v${latestVersion}`);
  }
}

function handleRegen(cwd: string, scaffoldRoot: string, manifest: Manifest, dryRun: boolean): void {
  console.log('');
  console.log('Regenerating project-specific files...');
  if (dryRun) {
    console.log('(dry-run — skipping regeneration)');
    return;
  }

  // Regenerate anti-patterns based on current stack
  const stacks = detectStack(cwd);
  const generated = generateAntiPatterns(cwd, stacks, scaffoldRoot);
  if (generated) {
    console.log('  anti-patterns.md: regenerated');
  } else {
    console.log('  anti-patterns.md: master file not found; skipped');
  }

  // AI agents cannot be auto-regenerated
  const aiAgents = Object.entries(manifest.generatedFiles)
    .filter(([, entry]) => entry.generator === 'ai')
    .map(([relPath]) => relPath);

  if (aiAgents.length > 0) {
    console.log('');
    console.log('Re-generation of AI agents is not yet automated. Use /create-agent to regenerate manually:');
    for (const agentPath of aiAgents) {
      console.log(`  ${agentPath}`);
    }
  }
}

export default class Update extends BaseCommand {
  public static override description = 'Update core agents, skills, and commands to the latest version';

  public static override flags = {
    'dry-run': Flags.boolean({ description: 'Show what would change without writing any files', default: false }),
    regen: Flags.boolean({ description: 'Also regenerate AI agents and anti-patterns', default: false }),
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(Update);
    const cwd = process.cwd();

    console.log('');
    console.log('nitro-fueled update');
    console.log('===================');
    console.log('');

    // Step 1: Read the manifest
    const manifest = readManifest(cwd);
    if (manifest === null) {
      console.error('Error: No manifest found. Run `npx nitro-fueled init` first.');
      process.exitCode = 1;
      return;
    }

    // Step 2: Resolve scaffold root
    let scaffoldRoot: string;
    try {
      scaffoldRoot = resolveScaffoldRoot();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`Error: ${msg}`);
      process.exitCode = 1;
      return;
    }

    // Step 3: Determine versions
    const latestVersion = getPackageVersion();
    console.log(`Current version: ${manifest.version}`);
    console.log(`Latest version:  ${latestVersion}`);
    console.log('');

    if (flags['dry-run']) {
      console.log('(dry-run — no files will be written)');
      console.log('');
    }

    // Step 4: Walk scaffold and process files
    console.log('Checking core files...');
    let scaffoldFiles: Map<string, string>;
    try {
      scaffoldFiles = walkScaffoldFiles(scaffoldRoot);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`Error: Failed to walk scaffold directory: ${msg}`);
      process.exitCode = 1;
      return;
    }

    const results = processScaffoldFiles(scaffoldFiles, manifest, cwd, flags['dry-run']);

    // Step 5: Print summary
    printResults(results, manifest, latestVersion, flags['dry-run']);

    // Step 5.5: Cortex DB check — create/migrate/reconcile
    if (!flags['dry-run']) {
      console.log('');
      console.log('Checking cortex database...');
      const cortexResult = runCortexStep(cwd, 'init-or-migrate');
      if (cortexResult !== null) {
        if (cortexResult.migrationsApplied > 0) {
          console.log(`  Applied ${cortexResult.migrationsApplied} schema migration${cortexResult.migrationsApplied !== 1 ? 's' : ''}`);
        }
        if (cortexResult.tasks.imported > 0 || cortexResult.sessions.imported > 0) {
          console.log(`  Hydrated ${cortexResult.tasks.imported} tasks, ${cortexResult.sessions.imported} sessions`);
        }
        if (cortexResult.handoffs.imported > 0) {
          console.log(`  Hydrated ${cortexResult.handoffs.imported} handoffs`);
        }
        if (cortexResult.drifted > 0) {
          console.log(`  Fixed ${cortexResult.drifted} status drift(s)`);
        }
        if (cortexResult.tasks.errors.length > 0) {
          for (const e of cortexResult.tasks.errors) {
            console.warn(`  Warning: ${e}`);
          }
        }
        if (cortexResult.tasks.imported === 0 && cortexResult.drifted === 0) {
          console.log('  Database in sync with files');
        }
      }
    }

    // Step 6: Handle --regen (must run before manifest write to capture new generatedAt)
    if (flags.regen) {
      handleRegen(cwd, scaffoldRoot, manifest, flags['dry-run']);
      // Update generatedAt for regenerated files in manifest
      if (!flags['dry-run']) {
        const now = new Date().toISOString();
        const apRelPath = '.claude/anti-patterns.md';
        if (apRelPath in manifest.generatedFiles) {
          manifest.generatedFiles[apRelPath].generatedAt = now;
        }
      }
    }

    // Step 7: Write updated manifest
    if (!flags['dry-run']) {
      updateManifestData(manifest, results, scaffoldFiles, cwd, latestVersion);
      try {
        writeManifest(cwd, manifest);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`Error: Failed to write manifest: ${msg}`);
        process.exitCode = 1;
        return;
      }
    }
  }
}
