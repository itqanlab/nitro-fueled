import type { FileParser } from './parser.interface.js';
import type { AntiPatternRule } from '../events/event-types.js';

export class PatternsParser implements FileParser<ReadonlyArray<AntiPatternRule>> {
  public canParse(filePath: string): boolean {
    return filePath.endsWith('anti-patterns.md');
  }

  public parse(content: string, _filePath: string): ReadonlyArray<AntiPatternRule> {
    const lines = content.split('\n');
    const rules: AntiPatternRule[] = [];
    let currentCategory = '';
    let currentRules: string[] = [];

    for (const line of lines) {
      const h2Match = line.match(/^##\s+(?:\d+\.\s*)?(.+)$/);
      if (h2Match) {
        if (currentCategory && currentRules.length > 0) {
          rules.push({ category: currentCategory, rules: [...currentRules] });
        }
        currentCategory = h2Match[1].trim();
        currentRules = [];
        continue;
      }

      if (line.startsWith('# ') && currentCategory) {
        if (currentRules.length > 0) {
          rules.push({ category: currentCategory, rules: [...currentRules] });
        }
        currentCategory = '';
        currentRules = [];
        continue;
      }

      const ruleMatch = line.match(/^- (.+)$/);
      if (ruleMatch && currentCategory) {
        currentRules.push(ruleMatch[1].trim());
      }
    }

    if (currentCategory && currentRules.length > 0) {
      rules.push({ category: currentCategory, rules: [...currentRules] });
    }

    return rules;
  }
}
