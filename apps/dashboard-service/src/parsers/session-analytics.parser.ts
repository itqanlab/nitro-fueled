import type { FileParser } from './parser.interface.js';
import type { SessionAnalytics } from '../events/event-types.js';

export class SessionAnalyticsParser implements FileParser<SessionAnalytics> {
  public canParse(filePath: string): boolean {
    return /TASK_\d{4}_\d{3}[\\/]session-analytics\.md$/.test(filePath);
  }

  public parse(content: string, filePath: string): SessionAnalytics {
    const taskIdMatch = filePath.match(/TASK_\d{4}_\d{3}/);
    const taskId = taskIdMatch ? taskIdMatch[0] : '';

    const fields = this.parseTable(content);

    const phasesRaw = fields['Phases Completed'] ?? '';
    const phasesCompleted = phasesRaw
      ? phasesRaw.split(',').map((p) => p.trim()).filter((p) => p.length > 0)
      : [];

    const filesRaw = fields['Files Modified'] ?? '';
    const filesModified = filesRaw === 'unknown' || filesRaw === ''
      ? null
      : parseInt(filesRaw, 10) || null;

    return {
      taskId: fields['Task'] ?? taskId,
      outcome: fields['Outcome'] ?? '',
      startTime: fields['Start Time'] ?? '',
      endTime: fields['End Time'] ?? '',
      duration: fields['Duration'] ?? '',
      phasesCompleted,
      filesModified,
    };
  }

  private parseTable(content: string): Record<string, string> {
    const result: Record<string, string> = {};
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('|')) continue;
      const cells = trimmed
        .split('|')
        .map((c) => c.trim())
        .filter((c) => c.length > 0);
      if (cells.length < 2) continue;
      if (cells[0] === 'Field' || cells[0].startsWith('---')) continue;
      result[cells[0]] = cells[1];
    }
    return result;
  }
}
