import { existsSync, copyFileSync, mkdirSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, relative } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline';
import type { Command } from 'commander';
import { detectMcpConfig } from '../utils/mcp-config.js';
import { configureMcp } from '../utils/mcp-configure.js';
import { resolveScaffoldRoot, scaffoldSubdir, listFiles } from '../utils/scaffold.js';
import { detectStack, analyzeWorkspace } from '../utils/stack-detect.js';
import type { AgentProposal, DetectedStack } from '../utils/stack-detect.js';
import { generateAntiPatterns, buildStackLabel } from '../utils/anti-patterns.js';
import { generateClaudeMd } from '../utils/claude-md.js';
import { isClaudeAvailable } from '../utils/preflight.js';
import { ensureGitignore } from '../utils/gitignore.js';
import { isInsideGitRepo, commitFiles } from '../utils/git.js';
import { readManifest, writeManifest, buildCoreFileEntry } from '../utils/manifest.js';
import type { Manifest, GeneratedFileEntry } from '../utils/manifest.js';

const initRequire = createRequire(import.meta.url);

function hasVersion(obj: object): obj is { version: unknown } {
  return 'version' in obj;
}

function getPackageVersion(): string {
  try {
    const pkg: unknown = initRequire('../../package.json');
    if (typeof pkg === 'object' && pkg !== null && hasVersion(pkg)) {
      const v = pkg.version;
      if (typeof v === 'string') return v;
    }
  } catch (err: unknown) {
    console.error(`Warning: could not read package.json version: ${err instanceof Error ? err.message : String(err)}`);
  }
  return '0.0.0';
}

interface InitOptions {
  mcpPath: string | undefined;
  skipMcp: boolean;
  skipAgents: boolean;
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
    console.log(`  ${proposal.agentName}: already exists (skipped)`);
    return true;
  }

  console.log(`  Generating ${proposal.agentTitle} (${proposal.stack})...`);

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
    console.error(`  Warning: Failed to generate ${proposal.agentName}${stderr !== '' ? ': ' + stderr : ''}`);
    return false;
  }

  if (existsSync(agentPath)) {
    console.log(`  ${proposal.agentTitle} generated`);
    return true;
  }

  console.error(`  Warning: ${proposal.agentName} generation completed but file not found`);
  return false;
}

function scaffoldFiles(cwd: string, scaffoldRoot: string, overwrite: boolean): string[] {
  const createdFiles: string[] = [];

  // Core agents
  const agentResult = scaffoldSubdir(scaffoldRoot, cwd, '.claude/agents', overwrite);
  const agentNames = listFiles(resolve(scaffoldRoot, '.claude', 'agents'));
  console.log(`  Agents: ${agentResult.copied} copied, ${agentResult.skipped} existing (${agentNames.length} core agents)`);
  createdFiles.push(...agentResult.files);

  // Skills (each skill is a subdirectory, discovered dynamically)
  const skillsSrc = resolve(scaffoldRoot, '.claude', 'skills');
  const skillDirs = existsSync(skillsSrc)
    ? readdirSync(skillsSrc, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name)
    : [];
  let skillsCopied = 0;
  let skillsSkipped = 0;
  for (const skill of skillDirs) {
    const r = scaffoldSubdir(scaffoldRoot, cwd, `.claude/skills/${skill}`, overwrite);
    skillsCopied += r.copied;
    skillsSkipped += r.skipped;
    createdFiles.push(...r.files);
  }
  console.log(`  Skills: ${skillsCopied} copied, ${skillsSkipped} existing (${skillDirs.length} skills)`);

  // Commands
  const cmdResult = scaffoldSubdir(scaffoldRoot, cwd, '.claude/commands', overwrite);
  console.log(`  Commands: ${cmdResult.copied} copied, ${cmdResult.skipped} existing`);
  createdFiles.push(...cmdResult.files);

  // Anti-patterns master (tag catalog — always copy so planner can regenerate)
  const apMasterSrc = resolve(scaffoldRoot, '.claude', 'anti-patterns-master.md');
  const apMasterDest = resolve(cwd, '.claude', 'anti-patterns-master.md');
  if (existsSync(apMasterSrc) && (overwrite || !existsSync(apMasterDest))) {
    mkdirSync(resolve(cwd, '.claude'), { recursive: true });
    copyFileSync(apMasterSrc, apMasterDest);
    createdFiles.push(apMasterDest);
  }
  // anti-patterns.md is generated after stack detection (see handleAntiPatterns)

  // Review lessons (empty templates)
  const reviewResult = scaffoldSubdir(scaffoldRoot, cwd, '.claude/review-lessons', overwrite);
  console.log(`  Review lessons: ${reviewResult.copied} template files`);
  createdFiles.push(...reviewResult.files);

  // Task tracking structure
  const taskResult = scaffoldSubdir(scaffoldRoot, cwd, 'task-tracking', overwrite);
  console.log(`  Task tracking: ${taskResult.copied} files`);
  createdFiles.push(...taskResult.files);

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
    console.log('  Anti-patterns: already exists (skipped — run with --overwrite to regenerate)');
    return stacks;
  }

  const generated = generateAntiPatterns(cwd, stacks, scaffoldRoot);
  if (generated) {
    console.log(`  Anti-patterns: generated for stack [${buildStackLabel(stacks)}]`);
  } else {
    console.log('  Anti-patterns: master file not found; skipped');
  }

  return stacks;
}

async function handleStackDetection(
  cwd: string,
  opts: InitOptions
): Promise<string[]> {
  if (opts.skipAgents) return [];

  const claudeAvailable = isClaudeAvailable();

  if (!claudeAvailable) {
    console.log('  Claude CLI not available — using basic stack detection.');
    console.log('  Re-run init after installing Claude CLI for full workspace analysis.');
  }

  // Run full workspace analysis (AI-assisted if Claude available, heuristic fallback otherwise)
  console.log('');
  console.log('Analyzing workspace...');
  const analysis = analyzeWorkspace(cwd, claudeAvailable);

  if (analysis.method === 'ai' && analysis.aiAnalysis !== null) {
    console.log(`  Analysis method: AI-assisted`);
    console.log(`  Summary: ${analysis.aiAnalysis.summary}`);
    if (analysis.aiAnalysis.domains.length > 0) {
      console.log(`  Domains: ${analysis.aiAnalysis.domains.join(', ')}`);
    }
  } else {
    console.log('  Analysis method: heuristic (basic stack detection)');
  }

  if (analysis.proposals.length === 0) {
    console.log('  No agent proposals generated.');
    console.log('  Use /create-agent to manually generate developer agents later.');
    return [];
  }

  // Display proposals with reasoning when available
  console.log('');
  console.log('Proposed developer agents:');
  for (const p of analysis.proposals) {
    const confidence = p.confidence !== undefined ? ` [${p.confidence}]` : '';
    console.log(`  - ${p.agentTitle} (${p.agentName}) [${p.stack}]${confidence}`);
    if (p.reason !== undefined) {
      console.log(`    Reason: ${p.reason}`);
    }
  }

  let shouldGenerate = opts.yes;
  if (!shouldGenerate) {
    const answer = await prompt('\nGenerate these developer agents? (y/n) [y]: ');
    shouldGenerate = answer.toLowerCase() !== 'n';
  }

  if (!shouldGenerate) {
    console.log('Skipping agent generation. Use /create-agent to generate later.');
    return [];
  }

  if (!claudeAvailable) {
    console.log('  Claude CLI not available; cannot generate agent files.');
    console.log('  Use /create-agent to manually generate developer agents later.');
    return [];
  }

  console.log('');
  console.log('Generating developer agents (this may take a moment)...');
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
  console.log(`  ${generated}/${analysis.proposals.length} developer agents generated`);
  return createdPaths;
}

async function handleMcpConfig(cwd: string, opts: InitOptions): Promise<void> {
  console.log('');
  const mcpConfig = detectMcpConfig(cwd);
  if (mcpConfig.found) {
    console.log(`MCP session-orchestrator: already configured (${mcpConfig.location})`);
    return;
  }

  if (opts.skipMcp) {
    console.log('MCP configuration: skipped (--skip-mcp)');
    return;
  }

  console.log('MCP session-orchestrator is not configured.');
  console.log('The Supervisor requires this to spawn and manage worker sessions.');
  console.log('');

  let serverPath = opts.mcpPath;
  if (serverPath === undefined) {
    serverPath = await prompt('Path to session-orchestrator directory (or press Enter to skip): ');
    if (serverPath === '') {
      console.log('Skipping MCP configuration. Run init again or configure manually.');
      return;
    }
  }

  const locationAnswer = opts.yes
    ? 'project'
    : await prompt('Configure globally or per-project? (global/project) [project]: ');
  const location: 'project' | 'global' = locationAnswer === 'global' ? 'global' : 'project';

  const success = await configureMcp(cwd, serverPath, location);
  if (!success) {
    console.error('MCP configuration failed. You can configure it manually later.');
  }
}

function commitScaffold(cwd: string, files: string[]): boolean {
  if (files.length === 0) {
    console.log('Commit: no new files to commit (all files already existed)');
    return true;
  }

  if (!isInsideGitRepo(cwd)) {
    console.error('Commit: not inside a git repository. Run `git init` first.');
    return false;
  }

  const success = commitFiles(cwd, files, 'chore: initialize nitro-fueled orchestration');
  if (success) {
    console.log('Committed: chore: initialize nitro-fueled orchestration');
    console.log(`  ${files.length} files staged and committed`);
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
  console.log('  Manifest: written (.nitro-fueled/manifest.json)');
}

function printSummary(mcpConfigured: boolean, skipMcp: boolean): void {
  console.log('');
  console.log('=================');
  console.log('Init complete!');
  console.log('');
  console.log('What was installed:');
  console.log('  .claude/agents/        Core agent definitions');
  console.log('  .claude/skills/        Orchestration and content skills');
  console.log('  .claude/commands/      Slash commands (/orchestrate, /plan, etc.)');
  console.log('  .claude/review-lessons/ Empty review templates (grow over time)');
  console.log('  task-tracking/         Task registry and template');
  console.log('  CLAUDE.md              Project conventions');
  console.log('');
  console.log('Next steps:');
  console.log('  1. npx nitro-fueled create     Create your first task');
  console.log('  2. npx nitro-fueled run         Run the orchestration pipeline');
  console.log('  3. npx nitro-fueled status      Check project status');
  if (!mcpConfigured && skipMcp) {
    console.log('  4. npx nitro-fueled init --mcp-path <path>   Configure MCP server');
  }
  console.log('');
}

export function registerInitCommand(program: Command): void {
  program
    .command('init')
    .description('Scaffold .claude/ and task-tracking/ into the current project')
    .option('--mcp-path <path>', 'Path to session-orchestrator server')
    .option('--skip-mcp', 'Skip MCP server configuration', false)
    .option('--skip-agents', 'Skip AI-assisted developer agent generation', false)
    .option('--overwrite', 'Overwrite existing files instead of merging', false)
    .option('-y, --yes', 'Accept all defaults without prompting', false)
    .option('--commit', 'Stage and commit all scaffolded files after init', false)
    .action(async (opts: InitOptions) => {
      const cwd = process.cwd();

      console.log('');
      console.log('nitro-fueled init');
      console.log('=================');
      console.log('');

      // Step 1: Check prerequisites
      if (isClaudeAvailable()) {
        console.log('Prerequisites: Claude CLI found');
      } else {
        console.log('Prerequisites: Claude CLI not found (agent generation will be skipped)');
      }

      // Step 2: Handle existing .claude/ directory
      const claudeDir = resolve(cwd, '.claude');
      if (existsSync(claudeDir) && !opts.overwrite) {
        if (!opts.yes) {
          const answer = await prompt('.claude/ directory already exists. Merge new files? (y/n) [y]: ');
          if (answer.toLowerCase() === 'n') {
            console.log('Aborting. Use --overwrite to replace existing files.');
            return;
          }
        }
        console.log('Merging into existing .claude/ (existing files preserved)');
      }

      // Step 3: Resolve scaffold source
      let scaffoldRoot: string;
      try {
        scaffoldRoot = resolveScaffoldRoot();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`Error: ${msg}`);
        process.exitCode = 1;
        return;
      }

      // Step 4: Copy all scaffold files
      console.log('');
      console.log('Scaffolding project...');
      let scaffoldedFiles: string[];
      try {
        scaffoldedFiles = scaffoldFiles(cwd, scaffoldRoot, opts.overwrite);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`Error: Failed to scaffold project files: ${msg}`);
        process.exitCode = 1;
        return;
      }
      const allCreatedFiles: string[] = [...scaffoldedFiles];

      // Step 5: Generate CLAUDE.md
      console.log('');
      const claudeMdPath = resolve(cwd, 'CLAUDE.md');
      const claudeMdExisted = existsSync(claudeMdPath);
      generateClaudeMd(cwd, opts.overwrite);
      if ((!claudeMdExisted || opts.overwrite) && existsSync(claudeMdPath)) {
        allCreatedFiles.push(claudeMdPath);
      }

      // Step 6: Ensure .nitro-fueled/ is gitignored
      const gitignorePath = resolve(cwd, '.gitignore');
      if (ensureGitignore(cwd)) {
        allCreatedFiles.push(gitignorePath);
      }

      // Step 7: Detect stack and generate stack-aware anti-patterns
      console.log('');
      console.log('Detecting project stack...');
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
        console.log(`  Detected: ${detectedLabel}`);
      }

      // Step 8: Generate developer agents for detected stack
      const agentPaths = await handleStackDetection(cwd, opts);
      allCreatedFiles.push(...agentPaths);

      // Step 9: Write manifest
      console.log('');
      const stackLabel = buildStackLabel(detectedStacks);
      const generatedFileInfos: GeneratedFileInfo[] = [];

      // CLAUDE.md is a template-generated file
      if (existsSync(claudeMdPath)) {
        generatedFileInfos.push({ path: claudeMdPath, stack: stackLabel, generator: 'template' });
      }

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
        console.error(`Error: Failed to write manifest: ${msg}`);
        process.exitCode = 1;
        return;
      }

      // Step 10: MCP configuration
      await handleMcpConfig(cwd, opts);

      // Step 11: Commit scaffolded files if --commit flag is set
      if (opts.commit) {
        console.log('');
        const committed = commitScaffold(cwd, allCreatedFiles);
        if (!committed) {
          process.exitCode = 1;
        }
      }

      // Step 12: Summary
      const mcpAfter = detectMcpConfig(cwd);
      printSummary(mcpAfter.found, opts.skipMcp);
    });
}
