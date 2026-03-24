import { existsSync, copyFileSync, mkdirSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline';
import type { Command } from 'commander';
import { detectMcpConfig } from '../utils/mcp-config.js';
import { configureMcp } from '../utils/mcp-configure.js';
import { resolveScaffoldRoot, scaffoldSubdir, listFiles } from '../utils/scaffold.js';
import { detectStack, proposeAgents } from '../utils/stack-detect.js';
import type { AgentProposal } from '../utils/stack-detect.js';
import { generateClaudeMd } from '../utils/claude-md.js';
import { isClaudeAvailable } from '../utils/preflight.js';

interface InitOptions {
  mcpPath: string | undefined;
  skipMcp: boolean;
  skipAgents: boolean;
  overwrite: boolean;
  yes: boolean;
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

function scaffoldFiles(cwd: string, scaffoldRoot: string, overwrite: boolean): void {
  // Core agents
  const agentResult = scaffoldSubdir(scaffoldRoot, cwd, '.claude/agents', overwrite);
  const agentNames = listFiles(resolve(scaffoldRoot, '.claude', 'agents'));
  console.log(`  Agents: ${agentResult.copied} copied, ${agentResult.skipped} existing (${agentNames.length} core agents)`);

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
  }
  console.log(`  Skills: ${skillsCopied} copied, ${skillsSkipped} existing (${skillDirs.length} skills)`);

  // Commands
  const cmdResult = scaffoldSubdir(scaffoldRoot, cwd, '.claude/commands', overwrite);
  console.log(`  Commands: ${cmdResult.copied} copied, ${cmdResult.skipped} existing`);

  // Anti-patterns (single file in .claude/)
  const apSrc = resolve(scaffoldRoot, '.claude', 'anti-patterns.md');
  const apDest = resolve(cwd, '.claude', 'anti-patterns.md');
  if (existsSync(apSrc) && (overwrite || !existsSync(apDest))) {
    mkdirSync(resolve(cwd, '.claude'), { recursive: true });
    copyFileSync(apSrc, apDest);
    console.log('  Anti-patterns: copied');
  } else if (existsSync(apDest)) {
    console.log('  Anti-patterns: already exists (skipped)');
  }

  // Review lessons (empty templates)
  const reviewResult = scaffoldSubdir(scaffoldRoot, cwd, '.claude/review-lessons', overwrite);
  console.log(`  Review lessons: ${reviewResult.copied} template files`);

  // Task tracking structure
  const taskResult = scaffoldSubdir(scaffoldRoot, cwd, 'task-tracking', overwrite);
  console.log(`  Task tracking: ${taskResult.copied} files`);
}

async function handleStackDetection(cwd: string, opts: InitOptions): Promise<void> {
  if (opts.skipAgents) return;

  if (!isClaudeAvailable()) {
    console.log('  Claude CLI not available; skipping developer agent generation.');
    console.log('  Use /create-agent to manually generate developer agents later.');
    return;
  }

  console.log('');
  console.log('Detecting project stack...');
  const stacks = detectStack(cwd);

  if (stacks.length === 0) {
    console.log('  No recognized tech stack detected.');
    console.log('  Use /create-agent to manually generate developer agents later.');
    return;
  }

  console.log(`  Detected: ${stacks.map((s) => {
    if (s.frameworks.length > 0) return `${s.language} (${s.frameworks.join(', ')})`;
    return s.language;
  }).join(', ')}`);

  const proposals = proposeAgents(stacks);
  if (proposals.length === 0) return;

  console.log('');
  console.log('Proposed developer agents:');
  for (const p of proposals) {
    console.log(`  - ${p.agentTitle} (${p.agentName}) [${p.stack}]`);
  }

  let shouldGenerate = opts.yes;
  if (!shouldGenerate) {
    const answer = await prompt('\nGenerate these developer agents? (y/n) [y]: ');
    shouldGenerate = answer.toLowerCase() !== 'n';
  }

  if (shouldGenerate) {
    console.log('');
    console.log('Generating developer agents (this may take a moment)...');
    let generated = 0;
    for (const p of proposals) {
      if (generateAgent(cwd, p)) generated++;
    }
    console.log(`  ${generated}/${proposals.length} developer agents generated`);
  } else {
    console.log('Skipping agent generation. Use /create-agent to generate later.');
  }
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
      try {
        scaffoldFiles(cwd, scaffoldRoot, opts.overwrite);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`Error: Failed to scaffold project files: ${msg}`);
        process.exitCode = 1;
        return;
      }

      // Step 5: Generate CLAUDE.md
      console.log('');
      generateClaudeMd(cwd, opts.overwrite);

      // Step 6: Stack detection and developer agent generation
      await handleStackDetection(cwd, opts);

      // Step 7: MCP configuration
      await handleMcpConfig(cwd, opts);

      // Step 8: Summary
      const mcpAfter = detectMcpConfig(cwd);
      printSummary(mcpAfter.found, opts.skipMcp);
    });
}
