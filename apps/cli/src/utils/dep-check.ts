import { spawnSync } from 'node:child_process';

export interface DependencyResult {
  name: string;
  found: boolean;
  version?: string;
  required: boolean;
  installHint?: string;
}

export const DEP_NAMES = {
  claudeCli: 'claude CLI',
  claudeLogin: 'Claude Code login',
  opencodeCli: 'opencode CLI',
  node: 'node',
} as const;

export function checkClaudeBinary(): DependencyResult {
  const result = spawnSync('claude', ['--version'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 10_000,
  });

  if (result.status === 0) {
    const output = (result.stdout ?? '').trim();
    const version = output.match(/[\d.]+/)?.[0];
    return { name: DEP_NAMES.claudeCli, found: true, version, required: true };
  }

  return {
    name: DEP_NAMES.claudeCli,
    found: false,
    required: true,
    installHint: 'Install Claude Code CLI: https://docs.anthropic.com/en/docs/claude-code',
  };
}

export function checkClaudeLogin(): DependencyResult {
  // Try 'claude auth status'; fall back to 'claude status' if the subcommand is unknown.
  for (const args of [['auth', 'status'], ['status']]) {
    const result = spawnSync('claude', args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 10_000,
    });

    if (result.error !== undefined) break; // binary not found — stop trying

    if (result.status === 0) {
      const output = (result.stdout ?? '').trim();
      const sub = output.match(/subscription[:\s]+(\S+)/i)?.[1] ?? 'active';
      return { name: DEP_NAMES.claudeLogin, found: true, version: sub, required: true };
    }

    // Non-zero exit on 'auth status' may mean the subcommand doesn't exist — try fallback.
    const stderr = (result.stderr ?? '').toLowerCase();
    const unknownCommand = stderr.includes('unknown command') || stderr.includes('unknown subcommand');
    if (!unknownCommand) {
      // Definitive failure — not logged in.
      return {
        name: DEP_NAMES.claudeLogin,
        found: false,
        required: true,
        installHint: 'Run: claude auth login',
      };
    }
  }

  return {
    name: DEP_NAMES.claudeLogin,
    found: false,
    required: true,
    installHint: 'Run: claude auth login',
  };
}

export function checkOpencodeBinary(): DependencyResult {
  const result = spawnSync('opencode', ['--version'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 10_000,
  });

  if (result.status === 0) {
    const output = (result.stdout ?? '').trim();
    const version = output.match(/[\d.]+/)?.[0];
    return { name: DEP_NAMES.opencodeCli, found: true, version, required: false };
  }

  return {
    name: DEP_NAMES.opencodeCli,
    found: false,
    required: false,
    installHint: 'npm i -g opencode',
  };
}

export function checkNodeVersion(): DependencyResult {
  const version = process.version.slice(1);
  const major = parseInt(version.split('.')[0] ?? '0', 10);
  if (major >= 18) {
    return { name: DEP_NAMES.node, found: true, version, required: true };
  }
  return {
    name: DEP_NAMES.node,
    found: false,
    version,
    required: true,
    installHint: 'Upgrade to Node.js v18+: https://nodejs.org',
  };
}

export function runDependencyChecks(): DependencyResult[] {
  return [
    checkClaudeBinary(),
    checkClaudeLogin(),
    checkOpencodeBinary(),
    checkNodeVersion(),
  ];
}
