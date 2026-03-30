function escapeCsv(value: string | number): string {
  const stringValue = String(value);
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
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
  URL.revokeObjectURL(url);
}
