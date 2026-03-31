function escapeCsv(value: string | number): string {
  const stringValue = String(value);
  const sanitized = /^[=+\-@]/.test(stringValue) ? `'${stringValue}` : stringValue;
  if (sanitized.includes(',') || sanitized.includes('"') || sanitized.includes('\n')) {
    return `"${sanitized.replace(/"/g, '""')}"`;
  }
  return sanitized;
}

export function downloadCsv(
  fileName: string,
  headers: ReadonlyArray<string>,
  rows: ReadonlyArray<ReadonlyArray<string | number>>,
): void {
  const csv = [headers, ...rows]
    .map((row) => row.map((value) => escapeCsv(value)).join(','))
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 100);
}
