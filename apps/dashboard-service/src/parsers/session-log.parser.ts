import type { FileParser } from './parser.interface.js';

type LogEntry = { readonly timestamp: string; readonly source: string; readonly event: string };

export class SessionLogParser implements FileParser<ReadonlyArray<LogEntry>> {
  public canParse(filePath: string): boolean {
    return /sessions[\\/]SESSION_[^/\\]+[\\/]log\.md$/.test(filePath);
  }

  public parse(content: string, _filePath: string): ReadonlyArray<LogEntry> {
    const entries: LogEntry[] = [];
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('|')) continue;

      const cells = trimmed
        .split('|')
        .map((c) => c.trim())
        .filter((c) => c.length > 0);

      if (cells.length < 3) continue;
      if (cells[0] === 'Timestamp' || cells[0].startsWith('---')) continue;

      entries.push({
        timestamp: cells[0],
        source: cells[1],
        event: cells[2],
      });
    }

    return entries;
  }
}
