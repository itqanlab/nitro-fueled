import { execSync, spawnSync } from 'node:child_process';

export interface DependencyResult {
  name: string;
  found: boolean;
  version?: string;
  required: boolean;
  installHint?: string;
}

export function checkClaudeBinary(): DependencyResult {
  try {
    const output = execSync('claude --version 2>/dev/null', { encoding: 'utf8' }).trim();
    const version = output.match(/[\d.]+/)?.[0];
    return { name: 'claude CLI', found: true, version, required: true };
  } catch {
    return {
      name: 'claude CLI',
      found: false,
      required: true,
      installHint: 'Install Claude Code CLI: https://docs.anthropic.com/en/docs/claude-code',
    };
  }
}

export function checkClaudeLogin(): DependencyResult {
  const result = spawnSync('claude', ['auth', 'status'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 10_000,
  });

  if (result.error !== undefined || result.status === null) {
    // Command not found or timed out — skip login check
    return {
      name: 'Claude Code login',
      found: false,
      required: true,
      installHint: 'Run: claude auth login',
    };
  }

  if (result.status === 0) {
    const output = ((result.stdout ?? '') as string).trim();
    const sub = output.match(/subscription[:\s]+(\S+)/i)?.[1] ?? 'active';
    return { name: 'Claude Code login', found: true, version: sub, required: true };
  }

  return {
    name: 'Claude Code login',
    found: false,
    required: true,
    installHint: 'Run: claude auth login',
  };
}

export function checkOpencodeBinary(): DependencyResult {
  try {
    const output = execSync('opencode --version 2>/dev/null', { encoding: 'utf8' }).trim();
    const version = output.match(/[\d.]+/)?.[0];
    return { name: 'opencode CLI', found: true, version, required: false };
  } catch {
    return {
      name: 'opencode CLI',
      found: false,
      required: false,
      installHint: 'npm i -g opencode',
    };
  }
}

export function checkNodeVersion(): DependencyResult {
  const version = process.version.slice(1);
  const major = parseInt(version.split('.')[0] ?? '0', 10);
  if (major >= 18) {
    return { name: 'node', found: true, version, required: true };
  }
  return {
    name: 'node',
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
