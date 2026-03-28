import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resolveGlmApiKey, isProcessAlive } from './spawn.js';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';

describe('resolveGlmApiKey', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `glm-key-test-${randomUUID()}`);
    mkdirSync(testDir, { recursive: true });
    // Ensure ZAI_API_KEY is not set for these tests
    delete process.env['ZAI_API_KEY'];
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
    delete process.env['ZAI_API_KEY'];
  });

  it('returns undefined when env var not set and no config file exists', () => {
    const result = resolveGlmApiKey(testDir);
    expect(result).toBeUndefined();
  });

  it('returns the ZAI_API_KEY env var when set', () => {
    process.env['ZAI_API_KEY'] = 'test-api-key-from-env';
    const result = resolveGlmApiKey(testDir);
    expect(result).toBe('test-api-key-from-env');
  });

  it('reads apiKey from .nitro-fueled/config.json when present', () => {
    const configDir = join(testDir, '.nitro-fueled');
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      join(configDir, 'config.json'),
      JSON.stringify({ providers: { glm: { apiKey: 'config-api-key' } } }),
    );
    const result = resolveGlmApiKey(testDir);
    expect(result).toBe('config-api-key');
  });

  it('resolves $ENV_VAR references in config apiKey', () => {
    process.env['MY_GLM_KEY'] = 'resolved-key';
    const configDir = join(testDir, '.nitro-fueled');
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      join(configDir, 'config.json'),
      JSON.stringify({ providers: { glm: { apiKey: '$MY_GLM_KEY' } } }),
    );
    const result = resolveGlmApiKey(testDir);
    expect(result).toBe('resolved-key');
    delete process.env['MY_GLM_KEY'];
  });

  it('returns undefined when config.json has empty apiKey', () => {
    const configDir = join(testDir, '.nitro-fueled');
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      join(configDir, 'config.json'),
      JSON.stringify({ providers: { glm: { apiKey: '' } } }),
    );
    const result = resolveGlmApiKey(testDir);
    expect(result).toBeUndefined();
  });

  it('returns undefined when config.json is malformed JSON', () => {
    const configDir = join(testDir, '.nitro-fueled');
    mkdirSync(configDir, { recursive: true });
    writeFileSync(join(configDir, 'config.json'), 'not valid json {{{');
    const result = resolveGlmApiKey(testDir);
    expect(result).toBeUndefined();
  });

  it('returns undefined when config.json has no providers.glm section', () => {
    const configDir = join(testDir, '.nitro-fueled');
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      join(configDir, 'config.json'),
      JSON.stringify({ providers: { claude: { apiKey: 'some-key' } } }),
    );
    const result = resolveGlmApiKey(testDir);
    expect(result).toBeUndefined();
  });
});

describe('isProcessAlive', () => {
  it('returns false for a non-existent PID', () => {
    // PID 999999999 is almost certainly not running
    const result = isProcessAlive(999999999);
    expect(result).toBe(false);
  });

  it('returns true for the current process PID', () => {
    const result = isProcessAlive(process.pid);
    expect(result).toBe(true);
  });
});
