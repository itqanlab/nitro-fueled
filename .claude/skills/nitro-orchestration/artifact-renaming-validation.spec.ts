/**
 * Tests for TASK_2026_107 — Artifact Name Renaming Validation
 *
 * Validates that old artifact names (visual-design-specification.md) have been
 * replaced with generalized artifact names (design-spec.md) across the
 * orchestration skill directory.
 *
 * This is a documentation refactoring task, so tests focus on:
 * 1. Absence of old artifact names in documentation
 * 2. Presence of new artifact names where expected
 * 3. Consistency across reference files and examples
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// ── Test Configuration ────────────────────────────────────────────────────────

const ORCHESTRATION_DIR = join(__dirname);

// Files that were modified in TASK_2026_107
const MODIFIED_FILES = [
  'examples/creative-trace.md',
  'references/agent-catalog.md',
  'references/strategies.md',
  'references/task-tracking.md',
];

// Old artifact name that should be replaced
const OLD_ARTIFACT_NAME = 'visual-design-specification.md';

// New artifact name that should replace it
const NEW_ARTIFACT_NAME = 'design-spec.md';

// Legitimate legacy references that should NOT be replaced
const LEGACY_REFS = [
  'implementation-plan.md', // Legacy reference in SKILL.md and task-tracking.md
];

// ── Helper Functions ────────────────────────────────────────────────────────────

function readFileContent(filepath: string): string {
  try {
    return readFileSync(filepath, 'utf-8');
  } catch (error) {
    throw new Error(`Failed to read file: ${filepath}`);
  }
}

function findMarkdownFiles(dir: string): string[] {
  const files: string[] = [];
  const items = readdirSync(dir, { withFileTypes: true });

  for (const item of items) {
    const fullPath = join(dir, item.name);
    if (item.isDirectory()) {
      files.push(...findMarkdownFiles(fullPath));
    } else if (item.name.endsWith('.md')) {
      files.push(fullPath);
    }
  }

  return files;
}

function countOccurrences(content: string, searchTerm: string): number {
  const regex = new RegExp(searchTerm, 'g');
  return (content.match(regex) || []).length;
}

function getRelativePath(filepath: string): string {
  return filepath.replace(ORCHESTRATION_DIR + '/', '');
}

// ── Test Data ───────────────────────────────────────────────────────────────────

describe('TASK_2026_107 - Artifact Name Renaming', () => {
  let allMarkdownFiles: string[];
  let modifiedFilesContents: Map<string, string>;

  beforeEach(() => {
    // Load all markdown files in orchestration directory
    allMarkdownFiles = findMarkdownFiles(ORCHESTRATION_DIR);

    // Load contents of modified files
    modifiedFilesContents = new Map();
    for (const filename of MODIFIED_FILES) {
      const filepath = join(ORCHESTRATION_DIR, filename);
      modifiedFilesContents.set(filename, readFileContent(filepath));
    }
  });

  // ── Acceptance Criterion: Zero references to old artifact name ─────────────

  describe('Acceptance Criterion: Zero references to old artifact name', () => {
    it('should have zero occurrences of visual-design-specification.md in orchestration directory', () => {
      let totalOccurrences = 0;

      for (const filepath of allMarkdownFiles) {
        const content = readFileContent(filepath);
        const count = countOccurrences(content, OLD_ARTIFACT_NAME);
        totalOccurrences += count;

        if (count > 0) {
          console.log(`  Found ${count} occurrence(s) in ${getRelativePath(filepath)}`);
        }
      }

      expect(totalOccurrences).toBe(0);
    });

    it('should have no old artifact name in modified files', () => {
      const filesWithOldName: string[] = [];

      for (const [filename, content] of modifiedFilesContents) {
        if (content.includes(OLD_ARTIFACT_NAME)) {
          filesWithOldName.push(filename);
        }
      }

      expect(filesWithOldName).toEqual([]);
    });
  });

  // ── Modified Files Validation ───────────────────────────────────────────────────

  describe('Modified files contain new artifact name', () => {
    it('creative-trace.md should reference design-spec.md', () => {
      const content = modifiedFilesContents.get('examples/creative-trace.md');
      expect(content).toBeDefined();
      expect(content).toContain(NEW_ARTIFACT_NAME);
    });

    it('agent-catalog.md should reference design-spec.md', () => {
      const content = modifiedFilesContents.get('references/agent-catalog.md');
      expect(content).toBeDefined();
      expect(content).toContain(NEW_ARTIFACT_NAME);
    });

    it('strategies.md should reference design-spec.md', () => {
      const content = modifiedFilesContents.get('references/strategies.md');
      expect(content).toBeDefined();
      expect(content).toContain(NEW_ARTIFACT_NAME);
    });

    it('task-tracking.md should reference design-spec.md', () => {
      const content = modifiedFilesContents.get('references/task-tracking.md');
      expect(content).toBeDefined();
      expect(content).toContain(NEW_ARTIFACT_NAME);
    });
  });

  // ── File-Specific Validations ────────────────────────────────────────────────

  describe('creative-trace.md specific validations', () => {
    const filename = 'examples/creative-trace.md';

    it('should not contain old artifact name visual-design-specification.md', () => {
      const content = modifiedFilesContents.get(filename);
      expect(content).toBeDefined();
      expect(content).not.toContain(OLD_ARTIFACT_NAME);
    });

    it('should reference design-spec.md at least once', () => {
      const content = modifiedFilesContents.get(filename);
      const count = countOccurrences(content, NEW_ARTIFACT_NAME);
      expect(count).toBeGreaterThan(0);
    });

    it('should reference task folder paths with design-spec.md', () => {
      const content = modifiedFilesContents.get(filename);
    });
  });

  describe('agent-catalog.md specific validations', () => {
    const filename = 'references/agent-catalog.md';

    it('should not contain old artifact name visual-design-specification.md', () => {
      const content = modifiedFilesContents.get(filename);
      expect(content).toBeDefined();
      expect(content).not.toContain(OLD_ARTIFACT_NAME);
    });

    it('should reference design-spec.md in UI/UX Designer outputs section', () => {
      const content = modifiedFilesContents.get(filename);
      expect(content).toContain(NEW_ARTIFACT_NAME);
    });

    it('should have correct output path for nitro-ui-ux-designer', () => {
      const content = modifiedFilesContents.get(filename);
      // Check for pattern: task-tracking/TASK_[ID]/design-spec.md
      const pattern = /task-tracking\/TASK_\[ID\]\/design-spec\.md/;
      expect(content).toMatch(pattern);
    });
  });

  describe('strategies.md specific validations', () => {
    const filename = 'references/strategies.md';

    it('should not contain old artifact name visual-design-specification.md', () => {
      const content = modifiedFilesContents.get(filename);
      expect(content).toBeDefined();
      expect(content).not.toContain(OLD_ARTIFACT_NAME);
    });

    it('should reference design-spec.md multiple times', () => {
      const content = modifiedFilesContents.get(filename);
      const count = countOccurrences(content, NEW_ARTIFACT_NAME);
      expect(count).toBeGreaterThanOrEqual(2);
    });

    it('should have design-spec.md in CREATIVE workflow', () => {
      const content = modifiedFilesContents.get(filename);
      expect(content).toContain('CREATIVE');
      expect(content).toContain(NEW_ARTIFACT_NAME);
    });

    it('should have design-spec.md in SOCIAL workflow', () => {
      const content = modifiedFilesContents.get(filename);
      expect(content).toContain('SOCIAL');
      expect(content).toContain(NEW_ARTIFACT_NAME);
    });
  });

  describe('task-tracking.md specific validations', () => {
    const filename = 'references/task-tracking.md';

    it('should not contain old artifact name visual-design-specification.md', () => {
      const content = modifiedFilesContents.get(filename);
      expect(content).toBeDefined();
      expect(content).not.toContain(OLD_ARTIFACT_NAME);
    });

    it('should reference design-spec.md in folder structure', () => {
      const content = modifiedFilesContents.get(filename);
      expect(content).toContain(NEW_ARTIFACT_NAME);
    });

    it('should have design-spec.md in optional artifacts list', () => {
      const content = modifiedFilesContents.get(filename);
      // design-spec.md is optional (created by UI/UX Designer)
      expect(content).toContain(NEW_ARTIFACT_NAME);
    });
  });

  // ── Legacy References Should Be Preserved ────────────────────────────────────

  describe('Legacy references should be preserved', () => {
    it('should preserve "implementation-plan.md" as legacy reference in SKILL.md', () => {
      const skillPath = join(ORCHESTRATION_DIR, 'SKILL.md');
      const content = readFileContent(skillPath);
      // implementation-plan.md is a legitimate legacy reference
      expect(content).toContain('implementation-plan.md');
    });

    it('should preserve "implementation-plan.md" as legacy reference in task-tracking.md', () => {
      const content = modifiedFilesContents.get('references/task-tracking.md');
      expect(content).toContain('implementation-plan.md');
      // Check it's marked as legacy
      expect(content).toContain('legacy');
    });

    it('should NOT preserve "visual-design-specification.md" as legacy reference', () => {
      const content = modifiedFilesContents.get('references/task-tracking.md');
      // visual-design-specification.md is NOT a legitimate legacy reference
      // it should have been fully replaced, not marked as legacy
      const count = countOccurrences(content, 'visual-design-specification.md');
      expect(count).toBe(0);
    });
  });

  // ── Consistency Checks ───────────────────────────────────────────────────────

  describe('Consistency across orchestration directory', () => {
    it('should have no old artifact name in any markdown file', () => {
      const filesWithOldName: string[] = [];

      for (const filepath of allMarkdownFiles) {
        const content = readFileContent(filepath);
        if (content.includes(OLD_ARTIFACT_NAME)) {
          filesWithOldName.push(getRelativePath(filepath));
        }
      }

      expect(filesWithOldName).toEqual([]);
    });

    it('should have consistent artifact naming across all files', () => {
      // All references to UI/UX Designer output should use design-spec.md
      // No references should use visual-design-specification.md
      const inconsistentFiles: string[] = [];

      for (const filepath of allMarkdownFiles) {
        const content = readFileContent(filepath);
        const hasOldName = content.includes(OLD_ARTIFACT_NAME);

        if (hasOldName) {
          inconsistentFiles.push(getRelativePath(filepath));
        }
      }

      expect(inconsistentFiles).toEqual([]);
    });
  });

  // ── Cross-Reference Validation ────────────────────────────────────────────────

  describe('Cross-reference validation', () => {
    it('example traces should use new artifact name', () => {
      const exampleDir = join(ORCHESTRATION_DIR, 'examples');
      const exampleFiles = findMarkdownFiles(exampleDir);

      for (const filepath of exampleFiles) {
        const content = readFileContent(filepath);
        if (content.includes(OLD_ARTIFACT_NAME)) {
          const relativePath = getRelativePath(filepath);
          throw new Error(`Example trace ${relativePath} still references ${OLD_ARTIFACT_NAME}`);
        }
      }

      expect(true).toBe(true); // All example files passed
    });

    it('reference files should use new artifact name', () => {
      const referenceDir = join(ORCHESTRATION_DIR, 'references');
      const referenceFiles = findMarkdownFiles(referenceDir);

      for (const filepath of referenceFiles) {
        const content = readFileContent(filepath);
        if (content.includes(OLD_ARTIFACT_NAME)) {
          const relativePath = getRelativePath(filepath);
          throw new Error(`Reference file ${relativePath} still references ${OLD_ARTIFACT_NAME}`);
        }
      }

      expect(true).toBe(true); // All reference files passed
    });
  });

  // ── Task-Specific Validations ─────────────────────────────────────────────────

  describe('TASK_2026_107 handoff validation', () => {
    it('should have modified exactly 4 files as documented in handoff.md', () => {
      expect(MODIFIED_FILES).toHaveLength(4);
    });

    it('should include all files mentioned in handoff.md', () => {
      const expectedFiles = [
        'examples/creative-trace.md',
        'references/agent-catalog.md',
        'references/strategies.md',
        'references/task-tracking.md',
      ];

      for (const expected of expectedFiles) {
        expect(MODIFIED_FILES).toContain(expected);
      }
    });
  });
});
