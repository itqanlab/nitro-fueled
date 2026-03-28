import { describe, it, expect } from 'vitest';
import {
  estimateComplexity,
  type ComplexityTier,
  type Confidence,
  type PreferredTier,
} from './complexity-estimator.js';

describe('estimateComplexity', () => {
  // ========================================
  // Task 1.3: Complex Tier Tests
  // ========================================
  describe('complex tier', () => {
    it('returns complex for scaffold keyword', () => {
      const result = estimateComplexity('scaffold new authentication system');
      expect(result.tier).toBe('complex');
      expect(result.preferredTier).toBe('heavy');
    });

    it('returns complex for integrate keyword', () => {
      const result = estimateComplexity('integrate payment gateway');
      expect(result.tier).toBe('complex');
    });

    it('returns complex for cross-service keyword', () => {
      const result = estimateComplexity('implement cross-service communication');
      expect(result.tier).toBe('complex');
    });

    it('returns complex for architecture keyword', () => {
      const result = estimateComplexity('design architecture for new module');
      expect(result.tier).toBe('complex');
    });

    it('returns complex for pipeline keyword', () => {
      const result = estimateComplexity('build deployment pipeline');
      expect(result.tier).toBe('complex');
    });

    it('returns high confidence when 2+ complex signals match', () => {
      const result = estimateComplexity(
        'scaffold cross-service architecture pipeline'
      );
      expect(result.tier).toBe('complex');
      expect(result.confidence).toBe('high');
      expect(result.preferredTier).toBe('heavy');
    });

    it('returns high confidence for scaffold + integrate', () => {
      const result = estimateComplexity(
        'scaffold and integrate new payment system'
      );
      expect(result.tier).toBe('complex');
      expect(result.confidence).toBe('high');
    });

    it('single complex signal stays complex with low confidence', () => {
      const result = estimateComplexity('scaffold');
      expect(result.tier).toBe('complex');
      expect(result.confidence).toBe('low');
    });

    it('single integrate signal stays complex with low confidence', () => {
      const result = estimateComplexity('integrate');
      expect(result.tier).toBe('complex');
      expect(result.confidence).toBe('low');
    });
  });

  // ========================================
  // Task 1.4: Simple Tier Tests
  // ========================================
  describe('simple tier', () => {
    it('returns simple for fix typo keyword', () => {
      const result = estimateComplexity('fix typo in README');
      expect(result.tier).toBe('simple');
      expect(result.preferredTier).toBe('light');
    });

    it('returns simple for update config keyword', () => {
      const result = estimateComplexity('update config file');
      expect(result.tier).toBe('simple');
    });

    it('returns simple for add field keyword', () => {
      const result = estimateComplexity('add field to database schema');
      expect(result.tier).toBe('simple');
    });

    it('returns simple for rename keyword', () => {
      const result = estimateComplexity('rename variable in module');
      expect(result.tier).toBe('simple');
    });

    it('returns simple for single file keyword', () => {
      const result = estimateComplexity('update single file component');
      expect(result.tier).toBe('simple');
    });

    it('returns simple for documentation update keyword', () => {
      const result = estimateComplexity('documentation update for API');
      expect(result.tier).toBe('simple');
    });

    it('returns simple for typo keyword alone', () => {
      const result = estimateComplexity('fix a typo in the code');
      expect(result.tier).toBe('simple');
    });

    it('returns high confidence when 2+ simple signals and no medium/complex', () => {
      const result = estimateComplexity('fix typo and update config');
      expect(result.tier).toBe('simple');
      expect(result.confidence).toBe('high');
    });

    it('simple does NOT apply when medium pattern present', () => {
      // 'add endpoint' is a medium pattern
      const result = estimateComplexity('fix typo and add endpoint');
      expect(result.tier).toBe('medium');
      expect(result.tier).not.toBe('simple');
    });

    it('simple does NOT apply when complex pattern present', () => {
      // 'scaffold' is a complex pattern
      const result = estimateComplexity('fix typo in scaffold documentation');
      expect(result.tier).toBe('complex');
      expect(result.tier).not.toBe('simple');
    });
  });

  // ========================================
  // Task 2.1: Medium Tier Tests
  // ========================================
  describe('medium tier', () => {
    it('returns medium for add endpoint keyword', () => {
      const result = estimateComplexity('add endpoint for users');
      expect(result.tier).toBe('medium');
      expect(result.preferredTier).toBe('balanced');
    });

    it('returns medium for refactor keyword', () => {
      const result = estimateComplexity('refactor authentication module');
      expect(result.tier).toBe('medium');
    });

    it('returns medium for implement keyword', () => {
      const result = estimateComplexity('implement new service');
      expect(result.tier).toBe('medium');
    });

    it('returns medium when only medium patterns match', () => {
      const result = estimateComplexity('create service for users');
      expect(result.tier).toBe('medium');
      expect(result.preferredTier).toBe('balanced');
    });

    it('returns high confidence when 2+ medium signals match', () => {
      const result = estimateComplexity('add endpoint and refactor module');
      expect(result.tier).toBe('medium');
      expect(result.confidence).toBe('high');
    });
  });

  // ========================================
  // Task 2.2: Priority Override Tests
  // ========================================
  describe('priority overrides', () => {
    it('complex overrides medium', () => {
      const result = estimateComplexity('integrate and refactor the module');
      expect(result.tier).toBe('complex');
    });

    it('complex overrides simple', () => {
      const result = estimateComplexity('scaffold new system - fix typo in docs');
      expect(result.tier).toBe('complex');
    });

    it('medium overrides simple', () => {
      const result = estimateComplexity('fix typo and add endpoint');
      expect(result.tier).toBe('medium');
    });

    it('signals array captures all matched patterns', () => {
      const result = estimateComplexity('scaffold and integrate new pipeline');
      expect(result.signals).toContain('scaffold');
      expect(result.signals).toContain('integrate');
      expect(result.signals).toContain('pipeline');
    });
  });

  // ========================================
  // Edge Cases and Default Behavior
  // ========================================
  describe('edge cases', () => {
    it('defaults to medium with low confidence when no patterns match', () => {
      const result = estimateComplexity('do something unusual');
      expect(result.tier).toBe('medium');
      expect(result.confidence).toBe('low');
    });

    it('returns empty signals array when no patterns match', () => {
      const result = estimateComplexity('xyz abc def');
      expect(result.signals).toEqual([]);
    });

    it('collects all matched signals in signals array', () => {
      const result = estimateComplexity(
        'scaffold and integrate new pipeline'
      );
      expect(result.signals).toContain('scaffold');
      expect(result.signals).toContain('integrate');
      expect(result.signals).toContain('pipeline');
    });

    it('signals are lowercase', () => {
      const result = estimateComplexity('Scaffold and INTEGRATE');
      expect(result.signals).toContain('scaffold');
      expect(result.signals).toContain('integrate');
    });

    it('returns correct result type structure', () => {
      const result = estimateComplexity('fix typo');
      expect(result).toHaveProperty('tier');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('signals');
      expect(result).toHaveProperty('preferredTier');
    });

    it('handles empty string', () => {
      const result = estimateComplexity('');
      expect(result.tier).toBe('medium');
      expect(result.confidence).toBe('low');
      expect(result.signals).toEqual([]);
    });
  });

  // ========================================
  // Tier Mapping Verification
  // ========================================
  describe('tier mapping', () => {
    it('maps simple to light', () => {
      const result = estimateComplexity('fix typo');
      expect(result.preferredTier).toBe('light');
    });

    it('maps medium to balanced', () => {
      const result = estimateComplexity('add endpoint for users');
      expect(result.preferredTier).toBe('balanced');
    });

    it('maps complex with high confidence to heavy', () => {
      const result = estimateComplexity('scaffold infrastructure');
      expect(result.preferredTier).toBe('heavy');
    });
  });
});
