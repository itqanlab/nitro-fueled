import type { FileParser } from './parser.interface.js';
import type { LessonEntry } from '../events/event-types.js';
import { basename } from 'node:path';

export class LessonsParser implements FileParser<ReadonlyArray<LessonEntry>> {
  public canParse(filePath: string): boolean {
    return filePath.includes('review-lessons/') && filePath.endsWith('.md');
  }

  public parse(content: string, filePath: string): ReadonlyArray<LessonEntry> {
    const domain = basename(filePath, '.md');
    const lines = content.split('\n');
    const entries: LessonEntry[] = [];
    let currentCategory = '';
    let currentRules: string[] = [];

    for (const line of lines) {
      const h2Match = line.match(/^## (.+)$/);
      if (h2Match) {
        if (currentCategory && currentRules.length > 0) {
          entries.push({ domain, category: currentCategory, rules: [...currentRules] });
        }
        currentCategory = h2Match[1].trim();
        currentRules = [];
        continue;
      }

      if (line.startsWith('# ')) {
        if (currentCategory && currentRules.length > 0) {
          entries.push({ domain, category: currentCategory, rules: [...currentRules] });
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
      entries.push({ domain, category: currentCategory, rules: [...currentRules] });
    }

    return entries;
  }
}
