import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, extname } from 'node:path';

export interface WorkspaceSignals {
  /** Directory tree (depth 3, filtered) */
  directoryTree: string[];
  /** File extension counts: { '.ts': 42, '.py': 15, ... } */
  extensionHistogram: Record<string, number>;
  /** Key config file contents (truncated to keep prompt manageable) */
  configFiles: Record<string, string>;
  /** Presence markers for special workspace patterns */
  presenceMarkers: string[];
}

const IGNORED_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '.next', '.nuxt',
  '__pycache__', '.venv', 'venv', '.tox', '.mypy_cache',
  'target', '.gradle', '.idea', '.vscode', '.DS_Store',
  'vendor', '.terraform', '.serverless', 'coverage',
  '.nitro-fueled', '.claude',
]);

const CONFIG_FILES = [
  'package.json',
  'tsconfig.json',
  'pyproject.toml',
  'requirements.txt',
  'Pipfile',
  'go.mod',
  'Cargo.toml',
  'Gemfile',
  'composer.json',
  'pubspec.yaml',
  'Package.swift',
  'pom.xml',
  'build.gradle',
  'build.gradle.kts',
  'docker-compose.yml',
  'docker-compose.yaml',
  'Dockerfile',
  '.dockerignore',
  'terraform.tf',
  'main.tf',
  'nx.json',
  'lerna.json',
  'turbo.json',
  'pnpm-workspace.yaml',
  'Makefile',
  'CMakeLists.txt',
];

/** Maximum bytes to read from any single config file */
const MAX_CONFIG_BYTES = 4096;

function readFileSafe(filePath: string, maxBytes: number = MAX_CONFIG_BYTES): string {
  try {
    const content = readFileSync(filePath, 'utf-8');
    return content.length > maxBytes ? content.slice(0, maxBytes) + '\n... (truncated)' : content;
  } catch {
    return '';
  }
}

/**
 * Walk directory tree up to maxDepth, collecting relative paths.
 * Skips ignored directories.
 */
function walkTree(cwd: string, currentPath: string, depth: number, maxDepth: number): string[] {
  if (depth > maxDepth) return [];

  const entries: string[] = [];
  let names: string[];
  try {
    names = readdirSync(resolve(cwd, currentPath));
  } catch {
    return [];
  }

  for (const name of names) {
    if (IGNORED_DIRS.has(name)) continue;

    const fullPath = resolve(cwd, currentPath, name);
    let isDir = false;
    try {
      isDir = statSync(fullPath).isDirectory();
    } catch {
      continue;
    }

    const relPath = currentPath === '' ? name : `${currentPath}/${name}`;

    if (isDir) {
      entries.push(`${relPath}/`);
      entries.push(...walkTree(cwd, relPath, depth + 1, maxDepth));
    } else {
      entries.push(relPath);
    }
  }

  return entries;
}

/**
 * Build extension histogram from directory tree entries (files only).
 */
function buildExtensionHistogram(treeEntries: string[]): Record<string, number> {
  const histogram: Record<string, number> = {};

  for (const entry of treeEntries) {
    if (entry.endsWith('/')) continue; // skip directories
    const ext = extname(entry).toLowerCase();
    if (ext === '') continue;
    histogram[ext] = (histogram[ext] ?? 0) + 1;
  }

  // Sort by count descending, keep top 30
  const sorted = Object.entries(histogram)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30);

  return Object.fromEntries(sorted);
}

/**
 * Detect presence markers for special workspace patterns.
 */
function detectPresenceMarkers(cwd: string, treeEntries: string[]): string[] {
  const markers: string[] = [];

  // Monorepo indicators
  if (existsSync(resolve(cwd, 'apps'))) markers.push('monorepo:apps-directory');
  if (existsSync(resolve(cwd, 'packages'))) markers.push('monorepo:packages-directory');
  if (existsSync(resolve(cwd, 'nx.json'))) markers.push('monorepo:nx');
  if (existsSync(resolve(cwd, 'lerna.json'))) markers.push('monorepo:lerna');
  if (existsSync(resolve(cwd, 'turbo.json'))) markers.push('monorepo:turbo');
  if (existsSync(resolve(cwd, 'pnpm-workspace.yaml'))) markers.push('monorepo:pnpm');

  // Design files
  const hasFigma = treeEntries.some((e) => e.endsWith('.fig'));
  const hasSketch = treeEntries.some((e) => e.endsWith('.sketch'));
  const hasXd = treeEntries.some((e) => e.endsWith('.xd'));
  if (hasFigma) markers.push('design:figma');
  if (hasSketch) markers.push('design:sketch');
  if (hasXd) markers.push('design:xd');
  if (treeEntries.some((e) => /\bdesign\b/i.test(e) && e.endsWith('/'))) {
    markers.push('design:design-directory');
  }

  // Notebooks / data science
  const hasNotebooks = treeEntries.some((e) => e.endsWith('.ipynb'));
  if (hasNotebooks) markers.push('data-science:jupyter-notebooks');
  if (treeEntries.some((e) => /\bnotebooks?\b/i.test(e) && e.endsWith('/'))) {
    markers.push('data-science:notebooks-directory');
  }

  // Infrastructure / DevOps
  const hasTerraform = treeEntries.some((e) => e.endsWith('.tf'));
  if (hasTerraform) markers.push('infrastructure:terraform');
  if (existsSync(resolve(cwd, 'k8s')) || existsSync(resolve(cwd, 'kubernetes'))) {
    markers.push('infrastructure:kubernetes');
  }
  if (existsSync(resolve(cwd, 'Dockerfile')) || existsSync(resolve(cwd, 'docker-compose.yml')) || existsSync(resolve(cwd, 'docker-compose.yaml'))) {
    markers.push('infrastructure:docker');
  }
  if (treeEntries.some((e) => e.endsWith('.github/workflows/') || e.includes('.github/workflows/'))) {
    markers.push('infrastructure:github-actions');
  }

  // Mobile
  if (existsSync(resolve(cwd, 'ios')) || existsSync(resolve(cwd, 'android'))) {
    markers.push('mobile:native-directories');
  }
  if (existsSync(resolve(cwd, 'pubspec.yaml'))) markers.push('mobile:flutter');

  // Documentation
  if (existsSync(resolve(cwd, 'docs')) || existsSync(resolve(cwd, 'documentation'))) {
    markers.push('docs:docs-directory');
  }

  return markers;
}

/**
 * Collect config file contents from the workspace root.
 */
function collectConfigFiles(cwd: string): Record<string, string> {
  const configs: Record<string, string> = {};

  for (const fileName of CONFIG_FILES) {
    const filePath = resolve(cwd, fileName);
    if (existsSync(filePath)) {
      try {
        const stat = statSync(filePath);
        if (stat.isFile()) {
          const content = readFileSafe(filePath);
          if (content !== '') {
            configs[fileName] = content;
          }
        }
      } catch {
        // skip unreadable files
      }
    }
  }

  // Also check for .tf files in root (collect first one found)
  try {
    const rootNames = readdirSync(cwd);
    for (const name of rootNames) {
      if (name.endsWith('.tf')) {
        const tfPath = resolve(cwd, name);
        try {
          if (statSync(tfPath).isFile()) {
            const content = readFileSafe(tfPath);
            if (content !== '') {
              configs[name] = content;
              break; // only first .tf file
            }
          }
        } catch {
          // skip unreadable
        }
      }
    }
  } catch {
    // ignore
  }

  return configs;
}

/**
 * Collect all workspace signals for AI analysis.
 * This is fast and synchronous — no AI calls.
 */
export function collectWorkspaceSignals(cwd: string): WorkspaceSignals {
  const directoryTree = walkTree(cwd, '', 0, 3);
  const extensionHistogram = buildExtensionHistogram(directoryTree);
  const configFiles = collectConfigFiles(cwd);
  const presenceMarkers = detectPresenceMarkers(cwd, directoryTree);

  return {
    directoryTree,
    extensionHistogram,
    configFiles,
    presenceMarkers,
  };
}

/**
 * Format workspace signals into a compact string for AI prompt consumption.
 * Keeps total size manageable for the AI context window.
 */
export function formatSignalsForPrompt(signals: WorkspaceSignals): string {
  const sections: string[] = [];

  // Extension histogram
  sections.push('## File Extension Counts');
  const extEntries = Object.entries(signals.extensionHistogram);
  if (extEntries.length > 0) {
    sections.push(extEntries.map(([ext, count]) => `  ${ext}: ${count}`).join('\n'));
  } else {
    sections.push('  (no files found)');
  }

  // Presence markers
  sections.push('\n## Presence Markers');
  if (signals.presenceMarkers.length > 0) {
    sections.push(signals.presenceMarkers.map((m) => `  - ${m}`).join('\n'));
  } else {
    sections.push('  (none detected)');
  }

  // Config files (truncated)
  sections.push('\n## Config Files');
  const configEntries = Object.entries(signals.configFiles);
  if (configEntries.length > 0) {
    for (const [name, content] of configEntries) {
      sections.push(`\n### ${name}\n\`\`\`\n${content}\n\`\`\``);
    }
  } else {
    sections.push('  (no config files found)');
  }

  // Directory tree (first 100 entries to keep prompt reasonable)
  sections.push('\n## Directory Tree (depth 3, filtered)');
  const treeSlice = signals.directoryTree.slice(0, 100);
  if (treeSlice.length > 0) {
    sections.push(treeSlice.join('\n'));
    if (signals.directoryTree.length > 100) {
      sections.push(`... and ${signals.directoryTree.length - 100} more entries`);
    }
  } else {
    sections.push('  (empty directory)');
  }

  return sections.join('\n');
}
