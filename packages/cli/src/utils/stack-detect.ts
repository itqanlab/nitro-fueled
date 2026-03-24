import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { AGENT_MAP } from './agent-map.js';

export interface DetectedStack {
  language: string;
  frameworks: string[];
}

export interface AgentProposal {
  agentName: string;
  agentTitle: string;
  stack: string;
}

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

function readFileSafe(filePath: string): string {
  try {
    return readFileSync(filePath, 'utf-8');
  } catch {
    return '';
  }
}

function detectLanguages(cwd: string): string[] {
  const languages: string[] = [];

  const langManifests: Array<[string, string]> = [
    ['package.json', 'nodejs'],
    ['requirements.txt', 'python'],
    ['pyproject.toml', 'python'],
    ['Pipfile', 'python'],
    ['pom.xml', 'java'],
    ['build.gradle', 'java'],
    ['build.gradle.kts', 'java'],
    ['go.mod', 'go'],
    ['Cargo.toml', 'rust'],
    ['Gemfile', 'ruby'],
    ['composer.json', 'php'],
    ['pubspec.yaml', 'dart'],
    ['Package.swift', 'swift'],
  ];

  for (const [manifest, lang] of langManifests) {
    if (existsSync(resolve(cwd, manifest)) && !languages.includes(lang)) {
      languages.push(lang);
    }
  }

  if (existsSync(resolve(cwd, 'tsconfig.json')) && languages.includes('nodejs')) {
    if (!languages.includes('typescript')) {
      languages.push('typescript');
    }
  }

  try {
    const entries = readdirSync(cwd, { withFileTypes: true });
    const hasCsproj = entries.some((e) => e.isFile() && e.name.endsWith('.csproj'));
    if (hasCsproj && !languages.includes('csharp')) {
      languages.push('csharp');
    }
  } catch {
    // ignore
  }

  return languages;
}

function detectNodeFrameworks(cwd: string): string[] {
  const pkgPath = resolve(cwd, 'package.json');
  if (!existsSync(pkgPath)) return [];

  const content = readFileSafe(pkgPath);
  if (content === '') return [];

  let pkg: PackageJson;
  try {
    pkg = JSON.parse(content) as PackageJson;
  } catch {
    return [];
  }

  const allDeps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
  const frameworks: string[] = [];

  const depMap: Array<[string, string]> = [
    ['next', 'nextjs'],
    ['nuxt', 'nuxt'],
    ['@angular/core', 'angular'],
    ['vue', 'vue'],
    ['svelte', 'svelte'],
    ['react', 'react'],
    ['@nestjs/core', 'nestjs'],
    ['fastify', 'fastify'],
    ['express', 'express'],
    ['electron', 'electron'],
    ['@tauri-apps/api', 'tauri'],
  ];

  for (const [dep, framework] of depMap) {
    if (dep in allDeps) {
      frameworks.push(framework);
    }
  }

  // Conflict resolution: meta-frameworks take priority
  if (frameworks.includes('nextjs') && frameworks.includes('react')) {
    frameworks.splice(frameworks.indexOf('react'), 1);
  }
  if (frameworks.includes('nuxt') && frameworks.includes('vue')) {
    frameworks.splice(frameworks.indexOf('vue'), 1);
  }

  return frameworks;
}

function detectPythonFrameworks(cwd: string): string[] {
  const frameworks: string[] = [];
  const files = ['requirements.txt', 'pyproject.toml', 'Pipfile'];

  for (const file of files) {
    const content = readFileSafe(resolve(cwd, file));
    if (content === '') continue;

    const lower = content.toLowerCase();
    if (lower.includes('django') && !frameworks.includes('django')) frameworks.push('django');
    if (lower.includes('fastapi') && !frameworks.includes('fastapi')) frameworks.push('fastapi');
    if (lower.includes('flask') && !frameworks.includes('flask')) frameworks.push('flask');
    if ((lower.includes('torch') || lower.includes('pytorch')) && !frameworks.includes('pytorch')) frameworks.push('pytorch');
    if (lower.includes('tensorflow') && !frameworks.includes('tensorflow')) frameworks.push('tensorflow');
  }

  return frameworks;
}

function detectGoFrameworks(cwd: string): string[] {
  const content = readFileSafe(resolve(cwd, 'go.mod'));
  if (content === '') return [];

  const frameworks: string[] = [];
  if (content.includes('gin-gonic/gin')) frameworks.push('gin');
  if (content.includes('gofiber/fiber')) frameworks.push('fiber');
  return frameworks;
}

function detectRustFrameworks(cwd: string): string[] {
  const content = readFileSafe(resolve(cwd, 'Cargo.toml'));
  if (content === '') return [];

  const frameworks: string[] = [];
  if (content.includes('actix-web')) frameworks.push('actix');
  if (content.includes('rocket')) frameworks.push('rocket');
  if (content.includes('tauri')) frameworks.push('tauri-rust');
  return frameworks;
}

function detectRubyFrameworks(cwd: string): string[] {
  const content = readFileSafe(resolve(cwd, 'Gemfile'));
  if (content === '') return [];

  const frameworks: string[] = [];
  if (/gem\s+['"]rails['"]/.test(content)) frameworks.push('rails');
  if (/gem\s+['"]sinatra['"]/.test(content)) frameworks.push('sinatra');
  return frameworks;
}

function detectPhpFrameworks(cwd: string): string[] {
  const content = readFileSafe(resolve(cwd, 'composer.json'));
  if (content === '') return [];

  const frameworks: string[] = [];
  if (content.includes('laravel/framework')) frameworks.push('laravel');
  if (content.includes('symfony/framework-bundle')) frameworks.push('symfony');
  return frameworks;
}

function detectDartFrameworks(cwd: string): string[] {
  const content = readFileSafe(resolve(cwd, 'pubspec.yaml'));
  if (content === '') return [];

  return content.includes('flutter') ? ['flutter'] : [];
}

/**
 * Detects the tech stack of a project by scanning manifest files.
 */
export function detectStack(cwd: string): DetectedStack[] {
  const languages = detectLanguages(cwd);
  const stacks: DetectedStack[] = [];

  for (const lang of languages) {
    let frameworks: string[] = [];

    switch (lang) {
      case 'nodejs':
      case 'typescript':
        frameworks = detectNodeFrameworks(cwd);
        break;
      case 'python':
        frameworks = detectPythonFrameworks(cwd);
        break;
      case 'go':
        frameworks = detectGoFrameworks(cwd);
        break;
      case 'rust':
        frameworks = detectRustFrameworks(cwd);
        break;
      case 'ruby':
        frameworks = detectRubyFrameworks(cwd);
        break;
      case 'php':
        frameworks = detectPhpFrameworks(cwd);
        break;
      case 'dart':
        frameworks = detectDartFrameworks(cwd);
        break;
      default:
        break;
    }

    stacks.push({ language: lang, frameworks });
  }

  // Deduplicate: if nodejs and typescript both detected, merge frameworks
  const tsIndex = stacks.findIndex((s) => s.language === 'typescript');
  const nodeIndex = stacks.findIndex((s) => s.language === 'nodejs');
  if (tsIndex !== -1 && nodeIndex !== -1) {
    stacks.splice(tsIndex, 1);
  }

  return stacks;
}

/**
 * Maps detected stacks to agent proposals.
 */
export function proposeAgents(stacks: DetectedStack[]): AgentProposal[] {
  const proposals: AgentProposal[] = [];
  const seen = new Set<string>();

  for (const stack of stacks) {
    if (stack.frameworks.length > 0) {
      for (const fw of stack.frameworks) {
        const match = AGENT_MAP.find(
          (m) => m.language === stack.language && m.framework === fw
        );
        if (match !== undefined && !seen.has(match.agentName)) {
          seen.add(match.agentName);
          proposals.push({
            agentName: match.agentName,
            agentTitle: match.agentTitle,
            stack: `${stack.language} + ${fw}`,
          });
        }
      }
    } else {
      const match = AGENT_MAP.find(
        (m) => m.language === stack.language && m.framework === null
      );
      if (match !== undefined && !seen.has(match.agentName)) {
        seen.add(match.agentName);
        proposals.push({
          agentName: match.agentName,
          agentTitle: match.agentTitle,
          stack: stack.language,
        });
      }
    }
  }

  return proposals;
}
