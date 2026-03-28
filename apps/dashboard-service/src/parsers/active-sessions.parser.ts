import type { FileParser } from './parser.interface.js';
import type { ActiveSessionRecord } from '../events/event-types.js';

export class ActiveSessionsParser implements FileParser<ReadonlyArray<ActiveSessionRecord>> {
  public canParse(filePath: string): boolean {
    return filePath.endsWith('active-sessions.md');
  }

  public parse(content: string, _filePath: string): ReadonlyArray<ActiveSessionRecord> {
    const records: ActiveSessionRecord[] = [];
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('|')) continue;

      const cells = trimmed
        .split('|')
        .map((c) => c.trim())
        .filter((c) => c.length > 0);

      if (cells.length < 5) continue;
      if (cells[0] === 'Session' || cells[0].startsWith('---')) continue;
      if (!cells[0].startsWith('SESSION_')) continue;

      records.push({
        sessionId: cells[0],
        source: cells[1],
        started: cells[2],
        tasks: cells[3],
        path: cells[4],
      });
    }

    return records;
  }
}
