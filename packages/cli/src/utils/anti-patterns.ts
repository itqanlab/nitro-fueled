import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import type { DetectedStack } from './stack-detect.js';

/**
 * Maps detected language/framework identifiers to anti-patterns tag names.
 * A stack ID maps to one or more tags from anti-patterns-master.md.
 */
const STACK_TO_TAGS: Record<string, string[]> = {
  nodejs: ['nodejs'],
  typescript: ['typescript'],
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

/**
 * Detects whether a project uses a database by looking for known ORM config files
 * or database driver dependencies in package.json.
 */
function detectDatabase(cwd: string): boolean {
  for (const manifest of DB_MANIFESTS) {
    if (existsSync(resolve(cwd, manifest))) return true;
  }

  const pkgPath = resolve(cwd, 'package.json');
  if (!existsSync(pkgPath)) return false;

  try {
    const content = readFileSync(pkgPath, 'utf-8');
    const pkg = JSON.parse(content) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const allDeps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
    return DB_DEP_PATTERNS.some((dep) => dep in allDeps);
  } catch {
    return false;
  }
}

/**
 * Detects whether a project uses Tailwind CSS.
 */
function detectTailwind(cwd: string): boolean {
  const pkgPath = resolve(cwd, 'package.json');
  if (!existsSync(pkgPath)) return false;

  try {
    const content = readFileSync(pkgPath, 'utf-8');
    return content.includes('"tailwindcss"');
  } catch {
    return false;
  }
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
      // We're inside a tagged section; collect body lines
      // Lines before the first tag comment are ignored (header/intro)
      currentBody.push(line);
    }
  }
  if (currentTags !== null) {
    taggedSections.push({ tags: currentTags, body: currentBody });
  }

  // Filter and assemble
  const includedBodies: string[] = [];
  for (const section of taggedSections) {
    const matches = section.tags.some((t) => activeTags.has(t));
    if (matches) {
      // Strip trailing blank lines from the section body
      const body = [...section.body];
      while (body.length > 0 && body[body.length - 1].trim() === '') {
        body.pop();
      }
      includedBodies.push(body.join('\n'));
    }
  }

  return includedBodies.join('\n\n');
}

/**
 * Builds the header for the generated anti-patterns file.
 */
function buildHeader(stacks: DetectedStack[], activeTags: Set<string>): string {
  const stackLabel =
    stacks.length === 0
      ? 'universal (no framework detected)'
      : stacks
          .map((s) =>
            s.frameworks.length > 0 ? `${s.language} + ${s.frameworks.join(', ')}` : s.language
          )
          .join(', ');

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
 * @returns true if the file was written; false if the master file was not found.
 */
export function generateAntiPatterns(
  cwd: string,
  stacks: DetectedStack[],
  scaffoldRoot: string
): boolean {
  const masterPath = resolve(scaffoldRoot, '.claude', 'anti-patterns-master.md');
  if (!existsSync(masterPath)) {
    return false;
  }

  const masterContent = readFileSync(masterPath, 'utf-8');
  const activeTags = collectTags(stacks, cwd);
  const filtered = filterMasterByTags(masterContent, activeTags);
  const header = buildHeader(stacks, activeTags);
  const output = header + filtered + '\n';

  const claudeDir = resolve(cwd, '.claude');
  mkdirSync(claudeDir, { recursive: true });
  const destPath = resolve(claudeDir, 'anti-patterns.md');
  writeFileSync(destPath, output, 'utf-8');

  return true;
}
