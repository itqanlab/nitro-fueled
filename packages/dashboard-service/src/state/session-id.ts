export function extractSessionId(filePath: string): string | null {
  return filePath.match(/SESSION_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}/)?.[0] ?? null;
}
