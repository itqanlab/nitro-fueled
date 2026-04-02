import { existsSync, copyFileSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, relative, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline';
import { Flags } from '@oclif/core';
import { BaseCommand } from '../base-command.js';
import { logger } from '../utils/logger.js';
import { configureMcp } from '../utils/mcp-configure.js';
import { resolveScaffoldRoot, scaffoldSubdir, listFiles } from '../utils/scaffold.js';
import { detectStack, analyzeWorkspace } from '../utils/stack-detect.js';
import type { AgentProposal, DetectedStack, ProjectProfile } from '../utils/stack-detect.js';
import { generateAntiPatterns, generateAntiPatternsFromProfile, buildStackLabel } from '../utils/anti-patterns.js';
import { ensureClaudeMdImport, generateClaudeNitroMd } from '../utils/claude-md.js';
import { generateArtifactsFromProfile, writeAgentFiles } from '../utils/artifact-generator.js';
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

function generateAgentFallback(cwd: string, proposal: AgentProposal): boolean {
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

/** Result from the combined workspace analysis and artifact generation phase */
interface WorkspaceArtifactsResult {
  detectedStacks: DetectedStack[];
  antiPatternsWritten: boolean;
  claudeNitroMdWritten: boolean;
  agentPaths: string[];
}

/**
 * Run workspace analysis and generate all project-specific artifacts in a single pass.
 *
 * When Claude CLI is available:
 * - AI call 1 (runAIAnalysis in analyzeWorkspace): builds ProjectProfile
 * - AI call 2 (generateArtifactsFromProfile): generates CLAUDE.nitro.md + anti-patterns + agents
 *   Total: 2 AI calls regardless of the number of agents
 *
 * When Claude CLI is unavailable or AI calls fail:
 * - Heuristic stack detection for anti-patterns (tag-filter fallback)
 * - Static CLAUDE.nitro.md template (no profile customization)
 * - No agent generation (user prompted to use /create-agent)
 */
async function handleWorkspaceArtifacts(
  cwd: string,
  scaffoldRoot: string,
  opts: InitFlags,
): Promise<WorkspaceArtifactsResult> {
  const stacks = detectStack(cwd);
  const result: WorkspaceArtifactsResult = {
    detectedStacks: stacks,
    antiPatternsWritten: false,
    claudeNitroMdWritten: false,
    agentPaths: [],
  };

  const claudeAvailable = isClaudeAvailable();
  if (!claudeAvailable) {
    logger.log('  Claude CLI not available — using heuristic stack detection.');
    logger.log('  Re-run init after installing Claude CLI for full workspace analysis.');
  }

  // Step A: Workspace analysis (AI call 1 if Claude available)
  logger.log('');
  logger.log('Analyzing workspace...');
  const analysis = analyzeWorkspace(cwd, claudeAvailable);
  const profile: ProjectProfile | null = analysis.aiAnalysis;

  if (analysis.method === 'ai' && profile !== null) {
    logger.log(`  Analysis method: AI-assisted`);
    logger.log(`  Summary: ${profile.summary}`);
    if (profile.domains.length > 0) {
      logger.log(`  Domains: ${profile.domains.join(', ')}`);
    }
  } else {
    logger.log('  Analysis method: heuristic (basic stack detection)');
  }

  // Step B: Read CLAUDE.nitro.md base template for use in profile-based generation
  const baseTemplatePath = resolve(scaffoldRoot, 'nitro-root', 'CLAUDE.nitro.md');
  let baseTemplate = '';
  try {
    baseTemplate = readFileSync(baseTemplatePath, 'utf-8');
  } catch {
    // Template unavailable — profile-based generation will produce minimal output
  }

  // Step C: Single-pass artifact generation (AI call 2 if profile available)
  if (profile !== null && claudeAvailable) {
    logger.log('');
    logger.log('Generating project artifacts (single-pass AI generation)...');

    const artifactResult = generateArtifactsFromProfile(profile, baseTemplate);

    if (artifactResult !== null) {
      // CLAUDE.nitro.md — write AI-generated version
      if (artifactResult.claudeNitroMd !== null) {
        const dest = resolve(cwd, '.nitro', 'CLAUDE.nitro.md');
        if (opts.overwrite || !existsSync(dest)) {
          try {
            mkdirSync(resolve(cwd, '.nitro'), { recursive: true });
            writeFileSync(dest, artifactResult.claudeNitroMd, 'utf-8');
            result.claudeNitroMdWritten = true;
            logger.log('  CLAUDE.nitro.md: generated from profile (AI)');
          } catch {
            logger.log('  CLAUDE.nitro.md: write failed — falling back to static template');
          }
        } else {
          logger.log('  CLAUDE.nitro.md: already exists (skipped)');
        }
      }

      // anti-patterns.md — write AI-generated version
      if (artifactResult.antiPatterns !== null) {
        const dest = resolve(cwd, '.claude', 'anti-patterns.md');
        if (opts.overwrite || !existsSync(dest)) {
          try {
            mkdirSync(resolve(cwd, '.claude'), { recursive: true });
            writeFileSync(dest, artifactResult.antiPatterns, 'utf-8');
            result.antiPatternsWritten = true;
            logger.log(`  Anti-patterns: generated from profile (AI) [${buildStackLabel(stacks)}]`);
          } catch {
            logger.log('  Anti-patterns: write failed — falling back to tag-filter');
          }
        } else {
          logger.log('  Anti-patterns: already exists (skipped)');
          result.antiPatternsWritten = true; // exists = no fallback needed
        }
      }

      // Developer agents — write batch-generated files
      if (!opts['skip-agents'] && artifactResult.agents.length > 0) {
        const agentPaths = writeAgentFiles(cwd, artifactResult.agents);
        result.agentPaths = agentPaths;
        logger.log(`  Developer agents: ${agentPaths.length}/${artifactResult.agents.length} generated (AI batch)`);
        if (artifactResult.agents.length > agentPaths.length) {
          logger.log(`  (${artifactResult.agents.length - agentPaths.length} already existed, skipped)`);
        }
      }
    } else {
      logger.log('  Single-pass generation failed — falling back to profile-based generators');
    }
  }

  // Step D: Profile-based fallbacks (no extra AI calls — derive from existing profile data)
  if (!result.claudeNitroMdWritten && profile !== null) {
    const written = generateClaudeNitroMd(cwd, profile, baseTemplate, opts.overwrite);
    result.claudeNitroMdWritten = written;
    if (written) logger.log('  CLAUDE.nitro.md: generated from profile (deterministic)');
  }

  if (!result.antiPatternsWritten && profile !== null) {
    const written = generateAntiPatternsFromProfile(cwd, profile, opts.overwrite);
    result.antiPatternsWritten = written;
    if (written) logger.log(`  Anti-patterns: generated from profile [${buildStackLabel(stacks)}]`);
  }

  // Step E: Tag-filter fallback (used when no profile is available)
  if (!result.antiPatternsWritten) {
    const apDest = resolve(cwd, '.claude', 'anti-patterns.md');
    if (!opts.overwrite && existsSync(apDest)) {
      logger.log('  Anti-patterns: already exists (skipped — run with --overwrite to regenerate)');
      result.antiPatternsWritten = true;
    } else {
      const generated = generateAntiPatterns(cwd, stacks, scaffoldRoot);
      result.antiPatternsWritten = generated;
      if (generated) {
        logger.log(`  Anti-patterns: generated from master (tag-filter) [${buildStackLabel(stacks)}]`);
      } else {
        logger.log('  Anti-patterns: master file not found; skipped');
      }
    }
  }

  // Step F: Heuristic agent generation fallback (one-by-one, only if batch generation did not run)
  if (!opts['skip-agents'] && result.agentPaths.length === 0 && claudeAvailable) {
    if (analysis.proposals.length > 0) {
      logger.log('');
      logger.log('Proposed developer agents:');
      for (const p of analysis.proposals) {
        const confidence = p.confidence !== undefined ? ` [${p.confidence}]` : '';
        logger.log(`  - ${p.agentTitle} (${p.agentName}) [${p.stack}]${confidence}`);
        if (p.reason !== undefined) logger.log(`    Reason: ${p.reason}`);
      }

      let shouldGenerate = opts.yes;
      if (!shouldGenerate) {
        const answer = await prompt('\nGenerate these developer agents? (y/n) [y]: ');
        shouldGenerate = answer.toLowerCase() !== 'n';
      }

      if (shouldGenerate) {
        logger.log('');
        logger.log('Generating developer agents (fallback: one-by-one)...');
        let generated = 0;
        for (const p of analysis.proposals) {
          const agentPath = resolve(cwd, '.claude', 'agents', `${p.agentName}.md`);
          const preExisted = existsSync(agentPath);
          if (generateAgentFallback(cwd, p)) {
            generated++;
            if (!preExisted && existsSync(agentPath)) {
              result.agentPaths.push(agentPath);
            }
          }
        }
        logger.log(`  ${generated}/${analysis.proposals.length} developer agents generated`);
      } else {
        logger.log('Skipping agent generation. Use /create-agent to generate later.');
      }
    } else {
      logger.log('  No agent proposals generated.');
      logger.log('  Use /create-agent to manually generate developer agents later.');
    }
  }

  return result;
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
  logger.log('  .cursorrules, .clinerules  AI tool context (Cursor, Cline, Copilot)');
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

interface MultiToolContextResult {
  generated: string[];
  skipped: string[];
}

function generateMultiToolContextFiles(
  cwd: string,
  nitroMdPath: string,
  overwrite: boolean,
): MultiToolContextResult {
  const result: MultiToolContextResult = { generated: [], skipped: [] };

  // Read source content
  let sourceContent = '';
  try {
    sourceContent = readFileSync(nitroMdPath, 'utf-8');
  } catch {
    // CLAUDE.nitro.md not available — skip generation
    return result;
  }

  const tools: Array<{ relPath: string; header: string }> = [
    {
      relPath: '.cursorrules',
      header: '# Cursor Rules\n\nProject conventions for Cursor AI assistant.\n\n',
    },
    {
      relPath: '.github/copilot-instructions.md',
      header: '# GitHub Copilot Instructions\n\nProject conventions for GitHub Copilot.\n\n',
    },
    {
      relPath: '.clinerules',
      header: '# Cline Rules\n\nProject conventions for Cline AI assistant.\n\n',
    },
  ];

  for (const tool of tools) {
    const dest = resolve(cwd, tool.relPath);

    if (!overwrite && existsSync(dest)) {
      result.skipped.push(dest);
      continue;
    }

    try {
      mkdirSync(dirname(dest), { recursive: true });
      writeFileSync(dest, tool.header + sourceContent, 'utf-8');
      result.generated.push(dest);
    } catch {
      // Best-effort — log but don't fail init
      logger.log(`  Warning: could not write ${tool.relPath}`);
    }
  }

  return result;
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

    // Steps 7–8: Single-pass workspace analysis + artifact generation
    // Runs workspace analysis (AI call 1), then generates CLAUDE.nitro.md, anti-patterns.md,
    // and all developer agent files in one AI call (AI call 2) — not N calls for N agents.
    logger.log('');
    logger.log('Detecting project stack...');
    const apPath = resolve(cwd, '.claude', 'anti-patterns.md');
    const nitroMdPath = resolve(cwd, '.nitro', 'CLAUDE.nitro.md');
    const apExisted = existsSync(apPath);
    const nitroMdExisted = existsSync(nitroMdPath);

    const workspaceResult = await handleWorkspaceArtifacts(cwd, scaffoldRoot, opts);
    const detectedStacks = workspaceResult.detectedStacks;
    const agentPaths = workspaceResult.agentPaths;

    if ((!apExisted || opts.overwrite) && existsSync(apPath)) {
      allCreatedFiles.push(apPath);
    }
    if ((!nitroMdExisted || opts.overwrite) && existsSync(nitroMdPath)) {
      allCreatedFiles.push(nitroMdPath);
    }
    allCreatedFiles.push(...agentPaths);

    // Step 8b: Generate multi-tool context files (.cursorrules, copilot-instructions, .clinerules)
    const multiToolResult = generateMultiToolContextFiles(cwd, nitroMdPath, opts.overwrite);
    allCreatedFiles.push(...multiToolResult.generated);
    if (multiToolResult.generated.length > 0) {
      logger.log(`  Multi-tool context: generated ${multiToolResult.generated.length} files (.cursorrules, copilot-instructions.md, .clinerules)`);
    }
    if (multiToolResult.skipped.length > 0) {
      logger.log(`  Multi-tool context: ${multiToolResult.skipped.length} already exist (use --overwrite to regenerate)`);
    }

    if (detectedStacks.length > 0) {
      const detectedLabel = detectedStacks.map((s) =>
        s.frameworks.length > 0 ? `${s.language} (${s.frameworks.join(', ')})` : s.language
      ).join(', ');
      logger.log(`  Detected: ${detectedLabel}`);
    }

    // Step 9: Write manifest
    logger.log('');
    const stackLabel = buildStackLabel(detectedStacks);
    const generatedFileInfos: GeneratedFileInfo[] = [];

    // Anti-patterns is a generated file
    if (existsSync(apPath)) {
      generatedFileInfos.push({ path: apPath, stack: stackLabel, generator: 'ai' });
    }

    // CLAUDE.nitro.md is a generated file
    if (existsSync(nitroMdPath)) {
      generatedFileInfos.push({ path: nitroMdPath, stack: stackLabel, generator: 'ai' });
    }

    // Developer agents
    for (const agentPath of agentPaths) {
      generatedFileInfos.push({ path: agentPath, stack: stackLabel, generator: 'ai' });
    }

    // Multi-tool context files
    for (const filePath of multiToolResult.generated) {
      generatedFileInfos.push({ path: filePath, stack: stackLabel, generator: 'ai' });
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
