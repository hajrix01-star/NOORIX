export function csvToFilterValues(value: string | null | undefined): string[] {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function filterValuesToCsv(values: string[]): string {
  return [...new Set(values)].join(',');
}
