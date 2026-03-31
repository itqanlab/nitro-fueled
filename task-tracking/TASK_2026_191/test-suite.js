#!/usr/bin/env node

/**
 * Test Suite for TASK_2026_191
 * Validates scaffold synchronization from source .claude/ directory
 */

const fs = require('fs');
const path = require('path');

const SOURCE_DIR = '/Volumes/SanDiskSSD/mine/nitro-fueled/.claude';
const SCAFFOLD_DIR = '/Volumes/SanDiskSSD/mine/nitro-fueled/apps/cli/scaffold/.claude';

const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

function assertEquals(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}\nExpected: ${expected}\nActual: ${actual}`);
  }
}

function assertTrue(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertFileExists(filePath) {
  assertTrue(fs.existsSync(filePath), `File should exist: ${filePath}`);
}

function assertFileNotExists(filePath) {
  assertTrue(!fs.existsSync(filePath), `File should not exist: ${filePath}`);
}

function assertFilesMatch(sourcePath, scaffoldPath) {
  const sourceContent = fs.readFileSync(sourcePath, 'utf8');
  const scaffoldContent = fs.readFileSync(scaffoldPath, 'utf8');
  assertEquals(sourceContent, scaffoldContent, `Files should match: ${sourcePath} vs ${scaffoldPath}`);
}

// Test 1: New reference files exist in scaffold
test('New auto-pilot reference files exist in scaffold', () => {
  const newReferenceFiles = [
    'cortex-integration.md',
    'evaluation-mode.md',
    'log-templates.md',
    'pause-continue.md',
    'sequential-mode.md',
    'session-lifecycle.md'
  ];

  newReferenceFiles.forEach(file => {
    const scaffoldPath = path.join(SCAFFOLD_DIR, 'skills/auto-pilot/references', file);
    assertFileExists(scaffoldPath);
  });
});

// Test 2: All auto-pilot reference files are synced
test('All auto-pilot reference files are synced', () => {
  const sourceRefsDir = path.join(SOURCE_DIR, 'skills/auto-pilot/references');
  const scaffoldRefsDir = path.join(SCAFFOLD_DIR, 'skills/auto-pilot/references');

  const sourceFiles = fs.readdirSync(sourceRefsDir).filter(f => f.endsWith('.md'));
  const scaffoldFiles = fs.readdirSync(scaffoldRefsDir).filter(f => f.endsWith('.md'));

  assertEquals(sourceFiles.length, scaffoldFiles.length, 
    `Should have same number of reference files (${sourceFiles.length} vs ${scaffoldFiles.length})`);

  sourceFiles.forEach(file => {
    const sourcePath = path.join(sourceRefsDir, file);
    const scaffoldPath = path.join(scaffoldRefsDir, file);
    assertFileExists(scaffoldPath);
    assertFilesMatch(sourcePath, scaffoldPath);
  });
});

// Test 3: nitro-retrospective.md is properly synced
test('nitro-retrospective.md is properly synced', () => {
  const sourcePath = path.join(SOURCE_DIR, 'commands/nitro-retrospective.md');
  const scaffoldPath = path.join(SCAFFOLD_DIR, 'commands/nitro-retrospective.md');

  assertFileExists(sourcePath);
  assertFileExists(scaffoldPath);
  assertFilesMatch(sourcePath, scaffoldPath);
});

// Test 4: Test files are excluded from scaffold
test('Test-only files are excluded from scaffold', () => {
  const testFiles = [
    'vitest.config.ts',
    'artifact-renaming-validation.spec.ts'
  ];

  testFiles.forEach(file => {
    const scaffoldPath = path.join(SCAFFOLD_DIR, file);
    assertFileNotExists(scaffoldPath);
  });
});

// Test 5: Backup files are excluded from scaffold
test('Backup files are excluded from scaffold', () => {
  const scaffoldDir = path.join(SCAFFOLD_DIR, 'skills/auto-pilot/references');
  if (fs.existsSync(scaffoldDir)) {
    const files = fs.readdirSync(scaffoldDir);
    const backupFiles = files.filter(f => f.endsWith('.bak'));
    assertEquals(backupFiles.length, 0, `Should have no backup files, found: ${backupFiles.join(', ')}`);
  }
});

// Test 6: Scaffold directory structure is correct
test('Scaffold directory structure is correct', () => {
  const expectedDirs = [
    'skills/auto-pilot/references',
    'commands',
    'skills'
  ];

  expectedDirs.forEach(dir => {
    const dirPath = path.join(SCAFFOLD_DIR, dir);
    assertTrue(fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory(), 
      `Directory should exist: ${dirPath}`);
  });
});

// Test 7: settings.json is preserved with allow list
test('settings.json contains allow permissions list', () => {
  const settingsPath = path.join(SCAFFOLD_DIR, 'settings.json');
  assertFileExists(settingsPath);

  const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  assertTrue(settings.permissions && settings.permissions.allow, 
    'settings.json should have permissions.allow for distribution');
});

// Test 8: New reference files have proper content
test('New reference files have non-zero content', () => {
  const newReferenceFiles = [
    'cortex-integration.md',
    'evaluation-mode.md',
    'log-templates.md',
    'pause-continue.md',
    'sequential-mode.md',
    'session-lifecycle.md'
  ];

  newReferenceFiles.forEach(file => {
    const scaffoldPath = path.join(SCAFFOLD_DIR, 'skills/auto-pilot/references', file);
    const content = fs.readFileSync(scaffoldPath, 'utf8');
    assertTrue(content.length > 0, `File should have content: ${file}`);
    assertTrue(content.includes('#') || content.includes('##'), 
      `File should be markdown with headers: ${file}`);
  });
});

// Test 9: No stale session-orchestrator MCP tool references exist
test('No stale session-orchestrator MCP tool references in scaffold', () => {
  const commandsDir = path.join(SCAFFOLD_DIR, 'commands');
  if (fs.existsSync(commandsDir)) {
    const files = fs.readdirSync(commandsDir).filter(f => f.endsWith('.md'));
    files.forEach(file => {
      const filePath = path.join(commandsDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      
      // Check for old MCP tool references that should have been removed
      const stalePatterns = [
        /mcp-session-orchestrator/,
        /session-orchestrator MCP/
      ];

      stalePatterns.forEach(pattern => {
        assertTrue(!pattern.test(content), 
          `File ${file} should not contain stale pattern: ${pattern}`);
      });
    });
  }
});

// Test 10: Design document references are preserved in commands
test('Design document references are preserved in nitro-auto-pilot.md', () => {
  const autoPilotPath = path.join(SOURCE_DIR, 'commands/nitro-auto-pilot.md');
  assertFileExists(autoPilotPath);

  const content = fs.readFileSync(autoPilotPath, 'utf8');
  
  // Check that proper design references exist
  assertTrue(content.includes('docs/mcp-nitro-cortex-design.md'), 
    'Should preserve reference to mcp-nitro-cortex-design.md');
  assertTrue(content.includes('docs/task-template-guide.md'), 
    'Should preserve reference to task-template-guide.md');
});

// Run all tests
function runTests() {
  console.log('Running TASK_2026_191 Test Suite...\n');
  
  let passed = 0;
  let failed = 0;

  tests.forEach((test, index) => {
    try {
      test.fn();
      console.log(`✓ Test ${index + 1}: ${test.name}`);
      passed++;
    } catch (error) {
      console.log(`✗ Test ${index + 1}: ${test.name}`);
      console.log(`  Error: ${error.message}\n`);
      failed++;
    }
  });

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Total: ${tests.length} tests, ${passed} passed, ${failed} failed`);
  console.log(`${'='.repeat(60)}\n`);

  return { total: tests.length, passed, failed };
}

const results = runTests();
process.exit(results.failed > 0 ? 1 : 0);