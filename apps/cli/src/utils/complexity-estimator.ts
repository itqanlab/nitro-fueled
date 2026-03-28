export type ComplexityTier = 'simple' | 'medium' | 'complex';
export type Confidence = 'high' | 'low';
export type PreferredTier = 'light' | 'balanced' | 'heavy';

export interface ComplexityEstimate {
  tier: ComplexityTier;
  confidence: Confidence;
  signals: string[];
  preferredTier: PreferredTier;
}

const COMPLEX_PATTERNS: RegExp[] = [
  /\bscaffold\b/i,
  /\bintegrate\b/i,
  /\bcross[- ]service\b/i,
  /\barchitect/i,
  /\bpipeline\b/i,
  /\bmigrate\s+database\b/i,
  /\bnew\s+subsystem\b/i,
  /\binfrastructure\b/i,
  /\bmulti[- ]service\b/i,
  /\bfull[- ]stack\b/i,
];

const SIMPLE_PATTERNS: RegExp[] = [
  /\bupdate\s+config\b/i,
  /\badd\s+field\b/i,
  /\brename\b/i,
  /\bsingle\s+file\b/i,
  /\bdocumentation\s+update\b/i,
  /\bconfig\s+change\b/i,
  /\btypo\b/i,
  /\bupdate\s+readme\b/i,
  /\badd\s+comment\b/i,
];

const MEDIUM_PATTERNS: RegExp[] = [
  /\badd\s+endpoint\b/i,
  /\bnew\s+endpoint\b/i,
  /\bcreate\s+component\b/i,
  /\bnew\s+component\b/i,
  /\bmigrate\s+command\b/i,
  /\brefactor\b/i,
  /\badd\s+feature\b/i,
  /\bimplement\b/i,
  /\bcreate\s+service\b/i,
];

const TIER_MAP: Record<ComplexityTier, PreferredTier> = {
  simple: 'light',
  medium: 'balanced',
  complex: 'heavy',
};

/**
 * Estimates the complexity tier of a task from its description.
 *
 * Signals are matched against keyword patterns for complex, medium, and simple tiers.
 * Low-confidence estimates default to `medium` / `balanced`.
 */
export function estimateComplexity(description: string): ComplexityEstimate {
  const input = description.slice(0, 4096);
  const signals: string[] = [];

  let complexScore = 0;
  for (const pattern of COMPLEX_PATTERNS) {
    const match = input.match(pattern);
    if (match !== null) {
      complexScore++;
      signals.push(match[0].toLowerCase());
    }
  }

  let simpleScore = 0;
  for (const pattern of SIMPLE_PATTERNS) {
    const match = input.match(pattern);
    if (match !== null) {
      simpleScore++;
      signals.push(match[0].toLowerCase());
    }
  }

  let mediumScore = 0;
  for (const pattern of MEDIUM_PATTERNS) {
    const match = input.match(pattern);
    if (match !== null) {
      mediumScore++;
      signals.push(match[0].toLowerCase());
    }
  }

  let tier: ComplexityTier;
  let confidence: Confidence;

  if (complexScore >= 1) {
    tier = 'complex';
    confidence = complexScore >= 2 ? 'high' : 'low';
  } else if (simpleScore >= 1 && mediumScore === 0) {
    tier = 'simple';
    confidence = simpleScore >= 2 ? 'high' : 'low';
  } else if (mediumScore >= 1) {
    tier = 'medium';
    confidence = mediumScore >= 2 ? 'high' : 'low';
  } else {
    // No signals — default to medium with low confidence
    tier = 'medium';
    confidence = 'low';
  }

  return {
    tier,
    confidence,
    signals,
    preferredTier: TIER_MAP[tier],
  };
}
