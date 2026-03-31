import { existsSync, copyFileSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline';
import { Flags } from '@oclif/core';
import { BaseCommand } from '../base-command.js';
import { logger } from '../utils/logger.js';
import { configureMcp } from '../utils/mcp-configure.js';
import { resolveScaffoldRoot, scaffoldSubdir, listFiles } from '../utils/scaffold.js';
import { detectStack, analyzeWorkspace } from '../utils/stack-detect.js';
import type { AgentProposal, DetectedStack } from '../utils/stack-detect.js';
import { generateAntiPatterns, buildStackLabel } from '../utils/anti-patterns.js';
import { ensureClaudeMdImport } from '../utils/claude-md.js';
import { isClaudeAvailable } from '../utils/preflight.js';
import { ensureGitignore } from '../utils/gitignore.js';
import { isInsideGitRepo, commitFiles } from '../utils/git.js';
import { readManifest, writeManifest, buildCoreFileEntry } from '../utils/manifest.js';
import type { Manifest, GeneratedFileEntry } from '../utils/manifest.js';
import { getPackageVersion } from '../utils/package-version.js';

interface InitFlags {
  'cortex-path': string | undefined;
  'skip-cortex': boolean;
  'skip-agents': boolean;
  overwrite: boolean;
  yes: boolean;
  commit: boolean;
}

function prompt(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolvePrompt) => {
    rl.question(question, (answer) => {
      rl.close();
      resolvePrompt(answer.trim());
    });
  });
}

function generateAgent(cwd: string, proposal: AgentProposal): boolean {
  const agentPath = resolve(cwd, '.claude', 'agents', `${proposal.agentName}.md`);
  if (existsSync(agentPath)) {
    logger.log(`  ${proposal.agentName}: already exists (skipped)`);
    return true;
  }

  logger.log(`  Generating ${proposal.agentTitle} (${proposal.stack})...`);

  const result = spawnSync('claude', [
    '-p',
    `/create-agent ${proposal.agentName}`,
    '--allowedTools', 'Read,Write,Glob,Grep,Edit',
  ], {
    cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 120_000,
  });

  if (result.status !== 0) {
    const stderr = result.stderr?.toString().trim() ?? '';
    logger.error(`  Warning: Failed to generate ${proposal.agentName}${stderr !== '' ? ': ' + stderr : ''}`);
    return false;
  }

  if (existsSync(agentPath)) {
    logger.log(`  ${proposal.agentTitle} generated`);
    return true;
  }

  logger.error(`  Warning: ${proposal.agentName} generation completed but file not found`);
  return false;
}

function scaffoldFiles(cwd: string, scaffoldRoot: string, overwrite: boolean): string[] {
  const createdFiles: string[] = [];

  // Core agents
  const agentResult = scaffoldSubdir(scaffoldRoot, cwd, 'nitro/agents', overwrite, '.claude/agents');
  const agentNames = listFiles(resolve(scaffoldRoot, 'nitro', 'agents'));
  logger.log(`  Agents: ${agentResult.copied} copied, ${agentResult.skipped} existing (${agentNames.length} core agents)`);
  createdFiles.push(...agentResult.files);

  // Skills (each skill is a subdirectory, discovered dynamically)
  const skillsSrc = resolve(scaffoldRoot, 'nitro', 'skills');
  const skillDirs = existsSync(skillsSrc)
    ? readdirSync(skillsSrc, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name)
    : [];
  let skillsCopied = 0;
  let skillsSkipped = 0;
  for (const skill of skillDirs) {
    const r = scaffoldSubdir(scaffoldRoot, cwd, `nitro/skills/${skill}`, overwrite, `.claude/skills/${skill}`);
    skillsCopied += r.copied;
    skillsSkipped += r.skipped;
    createdFiles.push(...r.files);
  }
  logger.log(`  Skills: ${skillsCopied} copied, ${skillsSkipped} existing (${skillDirs.length} skills)`);

  // Commands
  const cmdResult = scaffoldSubdir(scaffoldRoot, cwd, 'nitro/commands', overwrite, '.claude/commands');
  logger.log(`  Commands: ${cmdResult.copied} copied, ${cmdResult.skipped} existing`);
  createdFiles.push(...cmdResult.files);

  // Anti-patterns master (tag catalog — always copy so planner can regenerate)
  const apMasterSrc = resolve(scaffoldRoot, 'nitro', 'nitro-anti-patterns-master.md');
  const apMasterDest = resolve(cwd, '.claude', 'nitro-anti-patterns-master.md');
  if (existsSync(apMasterSrc) && (overwrite || !existsSync(apMasterDest))) {
    mkdirSync(resolve(cwd, '.claude'), { recursive: true });
    copyFileSync(apMasterSrc, apMasterDest);
    createdFiles.push(apMasterDest);
  }
  // anti-patterns.md is generated after stack detection (see handleAntiPatterns)

  // Review lessons (empty templates)
  const reviewResult = scaffoldSubdir(scaffoldRoot, cwd, 'nitro/review-lessons', overwrite, '.claude/review-lessons');
  logger.log(`  Review lessons: ${reviewResult.copied} template files`);
  createdFiles.push(...reviewResult.files);

  // Task tracking structure
  const taskResult = scaffoldSubdir(scaffoldRoot, cwd, 'task-tracking', overwrite);
  logger.log(`  Task tracking: ${taskResult.copied} files`);
  createdFiles.push(...taskResult.files);

  // Nitro managed files (.nitro/CLAUDE.nitro.md)
  const nitroResult = scaffoldSubdir(scaffoldRoot, cwd, 'nitro-root', overwrite, '.nitro');
  if (nitroResult.copied > 0 || nitroResult.skipped > 0) {
    logger.log(`  Nitro files: ${nitroResult.copied} copied, ${nitroResult.skipped} existing`);
  }
  createdFiles.push(...nitroResult.files);

  return createdFiles;
}

/**
 * Detects the project stack and generates a stack-aware anti-patterns.md.
 * Always runs (even if --skip-agents is set) so the anti-patterns file is always accurate.
 * Returns the detected stacks for downstream use.
 */
function handleAntiPatterns(cwd: string, scaffoldRoot: string, overwrite: boolean): DetectedStack[] {
  const stacks = detectStack(cwd);

  const apDest = resolve(cwd, '.claude', 'anti-patterns.md');
  if (!overwrite && existsSync(apDest)) {
    // Already exists — regenerate only when overwrite is set
    logger.log('  Anti-patterns: already exists (skipped — run with --overwrite to regenerate)');
    return stacks;
  }

  const generated = generateAntiPatterns(cwd, stacks, scaffoldRoot);
  if (generated) {
    logger.log(`  Anti-patterns: generated for stack [${buildStackLabel(stacks)}]`);
  } else {
    logger.log('  Anti-patterns: master file not found; skipped');
  }

  return stacks;
}

async function handleStackDetection(
  cwd: string,
  opts: InitFlags
): Promise<string[]> {
  if (opts['skip-agents']) return [];

  const claudeAvailable = isClaudeAvailable();

  if (!claudeAvailable) {
    logger.log('  Claude CLI not available — using basic stack detection.');
    logger.log('  Re-run init after installing Claude CLI for full workspace analysis.');
  }

  // Run full workspace analysis (AI-assisted if Claude available, heuristic fallback otherwise)
  logger.log('');
  logger.log('Analyzing workspace...');
  const analysis = analyzeWorkspace(cwd, claudeAvailable);

  if (analysis.method === 'ai' && analysis.aiAnalysis !== null) {
    logger.log(`  Analysis method: AI-assisted`);
    logger.log(`  Summary: ${analysis.aiAnalysis.summary}`);
    if (analysis.aiAnalysis.domains.length > 0) {
      logger.log(`  Domains: ${analysis.aiAnalysis.domains.join(', ')}`);
    }
  } else {
    logger.log('  Analysis method: heuristic (basic stack detection)');
  }

  if (analysis.proposals.length === 0) {
    logger.log('  No agent proposals generated.');
    logger.log('  Use /create-agent to manually generate developer agents later.');
    return [];
  }

  // Display proposals with reasoning when available
  logger.log('');
  logger.log('Proposed developer agents:');
  for (const p of analysis.proposals) {
    const confidence = p.confidence !== undefined ? ` [${p.confidence}]` : '';
    logger.log(`  - ${p.agentTitle} (${p.agentName}) [${p.stack}]${confidence}`);
    if (p.reason !== undefined) {
      logger.log(`    Reason: ${p.reason}`);
    }
  }

  let shouldGenerate = opts.yes;
  if (!shouldGenerate) {
    const answer = await prompt('\nGenerate these developer agents? (y/n) [y]: ');
    shouldGenerate = answer.toLowerCase() !== 'n';
  }

  if (!shouldGenerate) {
    logger.log('Skipping agent generation. Use /create-agent to generate later.');
    return [];
  }

  if (!claudeAvailable) {
    logger.log('  Claude CLI not available; cannot generate agent files.');
    logger.log('  Use /create-agent to manually generate developer agents later.');
    return [];
  }

  logger.log('');
  logger.log('Generating developer agents (this may take a moment)...');
  const createdPaths: string[] = [];
  let generated = 0;
  for (const p of analysis.proposals) {
    const agentPath = resolve(cwd, '.claude', 'agents', `${p.agentName}.md`);
    const preExisted = existsSync(agentPath);
    if (generateAgent(cwd, p)) {
      generated++;
      if (!preExisted && existsSync(agentPath)) {
        createdPaths.push(agentPath);
      }
    }
  }
  logger.log(`  ${generated}/${analysis.proposals.length} developer agents generated`);
  return createdPaths;
}

async function handleNitroCortexConfig(cwd: string, opts: InitFlags): Promise<void> {
  logger.log('');
  if (opts['skip-cortex']) {
    logger.log('MCP nitro-cortex: skipped (--skip-cortex)');
    return;
  }

  // Check if already configured
  const projectMcp = resolve(cwd, '.mcp.json');
  if (existsSync(projectMcp)) {
    try {
      const parsed: unknown = JSON.parse(readFileSync(projectMcp, 'utf-8'));
      if (parsed !== null && typeof parsed === 'object') {
        const cfg = parsed as Record<string, unknown>;
        const maybeServers = cfg['mcpServers'];
        if (maybeServers !== null && typeof maybeServers === 'object') {
          const servers = maybeServers as Record<string, unknown>;
          if ('nitro-cortex' in servers) {
            logger.log('MCP nitro-cortex: already configured');
            return;
          }
        }
      }
    } catch {
      logger.warn('Warning: Could not parse existing .mcp.json — falling through to reconfigure.');
    }
  }

  let serverPath = opts['cortex-path'];
  if (serverPath === undefined) {
    serverPath = await prompt('Path to nitro-cortex directory (or press Enter to skip): ');
    if (serverPath === '') {
      logger.log('Skipping nitro-cortex configuration. Configure manually later.');
      return;
    }
  }

  const locationAnswer = opts.yes
    ? 'project'
    : await prompt('Configure nitro-cortex globally or per-project? (global/project) [project]: ');
  const location: 'project' | 'global' = locationAnswer === 'global' ? 'global' : 'project';

  const success = await configureMcp(cwd, serverPath, location);
  if (!success) {
    logger.error('nitro-cortex configuration failed. You can configure it manually later.');
  }
}

function commitScaffold(cwd: string, files: string[]): boolean {
  if (files.length === 0) {
    logger.log('Commit: no new files to commit (all files already existed)');
    return true;
  }

  if (!isInsideGitRepo(cwd)) {
    logger.error('Commit: not inside a git repository. Run `git init` first.');
    return false;
  }

  const success = commitFiles(cwd, files, 'chore: initialize nitro-fueled orchestration');
  if (success) {
    logger.log('Committed: chore: initialize nitro-fueled orchestration');
    logger.log(`  ${files.length} files staged and committed`);
  }
  return success;
}

interface GeneratedFileInfo {
  path: string;
  stack: string;
  generator: 'ai' | 'template';
}

function buildAndWriteManifest(
  cwd: string,
  coreFilePaths: string[],
  generatedFileInfos: GeneratedFileInfo[],
): void {
  const version = getPackageVersion();
  const now = new Date().toISOString();

  // Read existing manifest to preserve entries on re-runs
  const existing = readManifest(cwd);

  const manifest: Manifest = {
    version,
    installedAt: existing?.installedAt ?? now,
    updatedAt: now,
    coreFiles: { ...(existing?.coreFiles ?? {}) },
    generatedFiles: { ...(existing?.generatedFiles ?? {}) },
  };

  // Add/update core file entries
  for (const absPath of coreFilePaths) {
    if (!existsSync(absPath)) continue;
    const relPath = relative(cwd, absPath);
    manifest.coreFiles[relPath] = buildCoreFileEntry(absPath, version);
  }

  // Add/update generated file entries
  for (const info of generatedFileInfos) {
    if (!existsSync(info.path)) continue;
    const relPath = relative(cwd, info.path);
    const entry: GeneratedFileEntry = {
      generatedAt: now,
      stack: info.stack,
      generator: info.generator,
    };
    manifest.generatedFiles[relPath] = entry;
  }

  writeManifest(cwd, manifest);
  logger.log('  Manifest: written (.nitro-fueled/manifest.json)');
}

function printSummary(skipCortex: boolean): void {
  logger.log('');
  logger.log('=================');
  logger.log('Init complete!');
  logger.log('');
  logger.log('What was installed:');
  logger.log('  .claude/agents/        Core agent definitions');
  logger.log('  .claude/skills/        Orchestration and content skills');
  logger.log('  .claude/commands/      Slash commands (/orchestrate, /plan, etc.)');
  logger.log('  .claude/review-lessons/ Empty review templates (grow over time)');
  logger.log('  task-tracking/         Task registry and template');
  logger.log('  .nitro/CLAUDE.nitro.md Nitro-fueled conventions (nitro-managed)');
  logger.log('  CLAUDE.md              Your project conventions (user-owned, import added)');
  logger.log('');
  logger.log('Next steps:');
  let step = 1;
  logger.log(`  ${step++}. npx nitro-fueled create     Create your first task`);
  logger.log(`  ${step++}. npx nitro-fueled run         Run the orchestration pipeline`);
  logger.log(`  ${step++}. npx nitro-fueled status      Check project status`);
  if (skipCortex) {
    logger.log(`  ${step++}. npx nitro-fueled init --cortex-path <path>   Configure nitro-cortex MCP server`);
  }
  logger.log('');
}

export default class Init extends BaseCommand {
  public static override description = 'Scaffold .claude/ and task-tracking/ into the current project';

  public static override flags = {
    'cortex-path': Flags.string({ description: 'Path to nitro-cortex MCP server (packages/mcp-cortex in this repo)' }),
    'skip-cortex': Flags.boolean({ description: 'Skip nitro-cortex MCP configuration', default: false }),
    'skip-agents': Flags.boolean({ description: 'Skip AI-assisted developer agent generation', default: false }),
    overwrite: Flags.boolean({ description: 'Overwrite existing files instead of merging', default: false }),
    yes: Flags.boolean({ char: 'y', description: 'Accept all defaults without prompting', default: false }),
    commit: Flags.boolean({ description: 'Stage and commit all scaffolded files after init', default: false }),
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(Init);
    const opts: InitFlags = flags;
    const cwd = process.cwd();

    logger.log('');
    logger.log('nitro-fueled init');
    logger.log('=================');
    logger.log('');

    // Step 1: Check prerequisites
    if (isClaudeAvailable()) {
      logger.log('Prerequisites: Claude CLI found');
    } else {
      logger.log('Prerequisites: Claude CLI not found (agent generation will be skipped)');
    }

    // Step 2: Handle existing .claude/ directory
    const claudeDir = resolve(cwd, '.claude');
    if (existsSync(claudeDir) && !opts.overwrite) {
      if (!opts.yes) {
        const answer = await prompt('.claude/ directory already exists. Merge new files? (y/n) [y]: ');
        if (answer.toLowerCase() === 'n') {
          logger.log('Aborting. Use --overwrite to replace existing files.');
          return;
        }
      }
      logger.log('Merging into existing .claude/ (existing files preserved)');
    }

    // Step 3: Resolve scaffold source
    let scaffoldRoot: string;
    try {
      scaffoldRoot = resolveScaffoldRoot();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`Error: ${msg}`);
      process.exitCode = 1;
      return;
    }

    // Step 4: Copy all scaffold files
    logger.log('');
    logger.log('Scaffolding project...');
    let scaffoldedFiles: string[];
    try {
      scaffoldedFiles = scaffoldFiles(cwd, scaffoldRoot, opts.overwrite);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`Error: Failed to scaffold project files: ${msg}`);
      process.exitCode = 1;
      return;
    }
    const allCreatedFiles: string[] = [...scaffoldedFiles];

    // Step 5: Ensure CLAUDE.md has nitro import line
    logger.log('');
    const claudeMdPath = resolve(cwd, 'CLAUDE.md');
    const claudeMdExisted = existsSync(claudeMdPath);
    ensureClaudeMdImport(cwd);
    if (!claudeMdExisted && existsSync(claudeMdPath)) {
      allCreatedFiles.push(claudeMdPath);
    }

    // Step 6: Ensure .nitro-fueled/ is gitignored
    const gitignorePath = resolve(cwd, '.gitignore');
    if (ensureGitignore(cwd)) {
      allCreatedFiles.push(gitignorePath);
    }

    // Step 7: Detect stack and generate stack-aware anti-patterns
    logger.log('');
    logger.log('Detecting project stack...');
    const apPath = resolve(cwd, '.claude', 'anti-patterns.md');
    const apExisted = existsSync(apPath);
    const detectedStacks = handleAntiPatterns(cwd, scaffoldRoot, opts.overwrite);
    if ((!apExisted || opts.overwrite) && existsSync(apPath)) {
      allCreatedFiles.push(apPath);
    }
    if (detectedStacks.length > 0) {
      const detectedLabel = detectedStacks.map((s) =>
        s.frameworks.length > 0 ? `${s.language} (${s.frameworks.join(', ')})` : s.language
      ).join(', ');
      logger.log(`  Detected: ${detectedLabel}`);
    }

    // Step 8: Generate developer agents for detected stack
    const agentPaths = await handleStackDetection(cwd, opts);
    allCreatedFiles.push(...agentPaths);

    // Step 9: Write manifest
    logger.log('');
    const stackLabel = buildStackLabel(detectedStacks);
    const generatedFileInfos: GeneratedFileInfo[] = [];

    // Anti-patterns is a template-generated file
    if (existsSync(apPath)) {
      generatedFileInfos.push({ path: apPath, stack: stackLabel, generator: 'template' });
    }

    // AI-generated developer agents
    for (const agentPath of agentPaths) {
      generatedFileInfos.push({ path: agentPath, stack: stackLabel, generator: 'ai' });
    }

    try {
      buildAndWriteManifest(cwd, scaffoldedFiles, generatedFileInfos);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`Error: Failed to write manifest: ${msg}`);
      process.exitCode = 1;
      return;
    }

    // Step 10: nitro-cortex MCP configuration (single MCP server)
    await handleNitroCortexConfig(cwd, opts);

    // Step 11: Commit scaffolded files if --commit flag is set
    if (opts.commit) {
      logger.log('');
      const committed = commitScaffold(cwd, allCreatedFiles);
      if (!committed) {
        process.exitCode = 1;
      }
    }

    // Step 12: Summary
    printSummary(opts['skip-cortex']);
  }
}
