import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { DetectedStack } from './stack-detect.js';

/**
 * Maps detected language/framework identifiers to anti-patterns tag names.
 *
 * 'typescript' includes 'nodejs' because detectStack() merges the two when both
 * are present — a TypeScript project is always also a Node.js project.
 */
const STACK_TO_TAGS: Record<string, string[]> = {
  nodejs: ['nodejs'],
  typescript: ['typescript', 'nodejs'],
  angular: ['angular'],
  react: ['react'],
  nextjs: ['nextjs', 'react'],
  vue: ['vue'],
  nuxt: ['vue'],
  svelte: ['svelte'],
  express: ['express', 'nodejs'],
  fastify: ['nodejs'],
  nestjs: ['nestjs', 'nodejs'],
  electron: ['electron', 'nodejs'],
  tauri: ['nodejs'],
  python: [],
  django: [],
  fastapi: [],
  flask: [],
  go: [],
  rust: [],
  ruby: [],
  rails: [],
  php: [],
  laravel: [],
  java: [],
  kotlin: [],
  swift: [],
  dart: [],
  flutter: [],
  csharp: [],
};

const DB_MANIFESTS = [
  'prisma/schema.prisma',
  'drizzle.config.ts',
  'knexfile.js',
  'knexfile.ts',
  'ormconfig.json',
  'ormconfig.ts',
  'mongod.conf',
  'firebase.json',
  'supabase/config.toml',
];

const DB_DEP_PATTERNS = [
  'prisma',
  'drizzle-orm',
  'knex',
  'typeorm',
  'mongoose',
  'sequelize',
  'pg',
  'mysql2',
  'better-sqlite3',
];

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

function isPackageJson(value: unknown): value is PackageJson {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  if ('dependencies' in obj && typeof obj['dependencies'] !== 'object') return false;
  if ('devDependencies' in obj && typeof obj['devDependencies'] !== 'object') return false;
  return true;
}

function readPackageJson(cwd: string): PackageJson | null {
  const pkgPath = resolve(cwd, 'package.json');
  if (!existsSync(pkgPath)) return null;
  try {
    const parsed: unknown = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    return isPackageJson(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Detects whether a project uses a database by looking for known ORM config files
 * or database driver dependencies in package.json.
 */
function detectDatabase(cwd: string): boolean {
  for (const manifest of DB_MANIFESTS) {
    if (existsSync(resolve(cwd, manifest))) return true;
  }
  const pkg = readPackageJson(cwd);
  if (pkg === null) return false;
  const allDeps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
  return DB_DEP_PATTERNS.some((dep) => dep in allDeps);
}

/**
 * Detects whether a project uses Tailwind CSS.
 */
function detectTailwind(cwd: string): boolean {
  const pkg = readPackageJson(cwd);
  if (pkg === null) return false;
  const allDeps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
  return 'tailwindcss' in allDeps;
}

/**
 * Collects the set of anti-pattern tags applicable for the detected stacks.
 */
function collectTags(stacks: DetectedStack[], cwd: string): Set<string> {
  const tags = new Set<string>(['universal']);

  for (const stack of stacks) {
    const langTags = STACK_TO_TAGS[stack.language] ?? [];
    for (const t of langTags) tags.add(t);

    for (const fw of stack.frameworks) {
      const fwTags = STACK_TO_TAGS[fw] ?? [];
      for (const t of fwTags) tags.add(t);
    }
  }

  if (detectDatabase(cwd)) tags.add('database');
  if (detectTailwind(cwd)) tags.add('tailwind');

  return tags;
}

/**
 * Parses the master anti-patterns file, extracts sections matching the given tags,
 * and returns the filtered content.
 *
 * A section is included if its `<!-- tags: ... -->` comment contains at least one
 * tag from the active tag set. Sections without a tag comment are skipped.
 */
function filterMasterByTags(masterContent: string, activeTags: Set<string>): string {
  const lines = masterContent.split('\n');
  const taggedSections: Array<{ tags: string[]; body: string[] }> = [];

  let currentTags: string[] | null = null;
  let currentBody: string[] = [];

  for (const line of lines) {
    const tagMatch = /^<!-- tags: (.+?) -->$/.exec(line.trim());
    if (tagMatch !== null) {
      if (currentTags !== null) {
        taggedSections.push({ tags: currentTags, body: currentBody });
      }
      currentTags = tagMatch[1].split(/\s+/).map((t) => t.trim());
      currentBody = [];
    } else if (currentTags !== null) {
      currentBody.push(line);
    }
    // Lines before the first tag comment are header/intro — ignored
  }
  if (currentTags !== null) {
    taggedSections.push({ tags: currentTags, body: currentBody });
  }

  const includedBodies: string[] = [];
  for (const section of taggedSections) {
    const matches = section.tags.some((t) => activeTags.has(t));
    if (matches) {
      const body = [...section.body];
      while (body.length > 0 && body[body.length - 1].trim() === '') {
        body.pop();
      }
      if (body.length > 0) {
        includedBodies.push(body.join('\n'));
      }
    }
  }

  return includedBodies.join('\n\n');
}

/**
 * Builds the stack label string used in the generated file header.
 * Exported so init.ts can reuse the same label in console output.
 */
export function buildStackLabel(stacks: DetectedStack[]): string {
  if (stacks.length === 0) return 'universal (no framework detected)';
  return stacks
    .map((s) =>
      s.frameworks.length > 0 ? `${s.language} + ${s.frameworks.join(', ')}` : s.language
    )
    .join(', ');
}

/**
 * Builds the header for the generated anti-patterns file.
 */
function buildHeader(stacks: DetectedStack[], activeTags: Set<string>): string {
  const stackLabel = buildStackLabel(stacks);
  const tagList = [...activeTags]
    .filter((t) => t !== 'universal')
    .sort()
    .join(', ');
  const tagSuffix = tagList.length > 0 ? ` | tags: ${tagList}` : '';

  return [
    `# Anti-Patterns — Project Rules`,
    ``,
    `Generated by \`nitro-fueled init\`. Stack: **${stackLabel}**${tagSuffix}.`,
    `See \`.claude/anti-patterns-master.md\` for the full tagged rule set.`,
    ``,
    `Check these BEFORE submitting work.`,
    ``,
  ].join('\n');
}

/**
 * Generates a project-specific anti-patterns.md file from the master template,
 * filtered to the detected tech stack.
 *
 * @param cwd - The project root directory.
 * @param stacks - Detected tech stacks (output of detectStack()).
 * @param scaffoldRoot - Path to the scaffold directory containing anti-patterns-master.md.
 * @returns true if the file was written; false if the master file was not found or write failed.
 */
export function generateAntiPatterns(
  cwd: string,
  stacks: DetectedStack[],
  scaffoldRoot: string
): boolean {
  const masterPath = resolve(scaffoldRoot, 'nitro', 'nitro-anti-patterns-master.md');

  let masterContent: string;
  try {
    masterContent = readFileSync(masterPath, 'utf-8');
  } catch {
    return false;
  }

  const activeTags = collectTags(stacks, cwd);
  const filtered = filterMasterByTags(masterContent, activeTags);
  const header = buildHeader(stacks, activeTags);
  const output = filtered.length > 0
    ? header + filtered + '\n'
    : header + '_No rules matched the detected stack. Check anti-patterns-master.md._\n';

  try {
    const claudeDir = resolve(cwd, '.claude');
    mkdirSync(claudeDir, { recursive: true });
    writeFileSync(resolve(claudeDir, 'anti-patterns.md'), output, 'utf-8');
  } catch {
    return false;
  }

  return true;
}
