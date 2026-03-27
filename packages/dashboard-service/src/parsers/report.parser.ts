import type { FileParser } from './parser.interface.js';
import type { CompletionReport } from '../events/event-types.js';
import { basename, dirname } from 'node:path';

export class ReportParser implements FileParser<CompletionReport> {
  public canParse(filePath: string): boolean {
    return /TASK_\d{4}_\d{3}\/completion-report\.md$/.test(filePath);
  }

  public parse(content: string, filePath: string): CompletionReport {
    const taskId = this.extractTaskId(filePath);
    if (!taskId || !taskId.startsWith('TASK_')) {
      console.warn(`[report-parser] skipping report in non-task folder: ${filePath}`);
      return {
        taskId: '',
        filesCreated: [],
        filesModified: [],
        reviewScores: [],
        findingsFixed: [],
        findingsAcknowledged: [],
        rootCause: '',
        fix: '',
      };
    }
    const lines = content.split('\n');

    return {
      taskId,
      filesCreated: this.extractListSection(lines, '## Files Created'),
      filesModified: this.extractListSection(lines, '## Files Modified'),
      reviewScores: this.extractReviewScores(lines),
      findingsFixed: this.extractListSection(lines, '## Findings Fixed'),
      findingsAcknowledged: this.extractListSection(lines, '## Findings Acknowledged'),
      rootCause: this.extractTextSection(lines, '## Root Cause'),
      fix: this.extractTextSection(lines, '## Fix'),
    };
  }

  private extractTaskId(filePath: string): string {
    const dir = basename(dirname(filePath));
    return dir.startsWith('TASK_') ? dir : '';
  }

  private extractListSection(lines: ReadonlyArray<string>, heading: string): ReadonlyArray<string> {
    const idx = lines.findIndex((l) => l.trim() === heading);
    if (idx === -1) return [];

    const items: string[] = [];
    for (let i = idx + 1; i < lines.length; i++) {
      if (lines[i].startsWith('## ')) break;
      const match = lines[i].match(/^- (.+)$/);
      if (match) items.push(match[1].trim());
    }
    return items;
  }

  private extractReviewScores(lines: ReadonlyArray<string>): CompletionReport['reviewScores'] {
    const idx = lines.findIndex((l) => l.trim() === '## Review Scores');
    if (idx === -1) return [];

    const scores: CompletionReport['reviewScores'][number][] = [];
    for (let i = idx + 1; i < lines.length; i++) {
      if (lines[i].startsWith('## ')) break;
      const cells = lines[i].split('|').map((c) => c.trim()).filter((c) => c.length > 0);
      if (cells.length >= 2 && cells[0] !== 'Review' && !cells[0].startsWith('---')) {
        scores.push({ review: cells[0], score: cells[1] });
      }
    }
    return scores;
  }

  private extractTextSection(lines: ReadonlyArray<string>, heading: string): string {
    const idx = lines.findIndex((l) => l.trim() === heading);
    if (idx === -1) return '';

    const result: string[] = [];
    for (let i = idx + 1; i < lines.length; i++) {
      if (lines[i].startsWith('## ')) break;
      result.push(lines[i]);
    }
    return result.join('\n').trim();
  }
}
