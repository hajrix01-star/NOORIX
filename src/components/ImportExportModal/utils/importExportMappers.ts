import type { ImportProgressRow, ImportValidationResult } from '../types';

export function pickApiList(res: unknown): unknown[] {
  if (Array.isArray(res)) return res;
  if (res && typeof res === 'object') {
    const o = res as Record<string, unknown>;
    if (Array.isArray(o.data)) return o.data;
    const inner = o.data;
    if (inner && typeof inner === 'object' && Array.isArray((inner as Record<string, unknown>).items)) {
      return (inner as { items: unknown[] }).items;
    }
    if (Array.isArray(o.items)) return o.items;
  }
  return [];
}

export function appendEmployeesBatchErrors(
  batchErrors: unknown,
  slice: ImportValidationResult[],
  errors: ImportProgressRow[],
  unknownMessage?: string,
) {
  if (!Array.isArray(batchErrors)) return;
  const fallback = unknownMessage ?? 'Unknown error';
  for (const err of batchErrors) {
    if (err && typeof err === 'object' && typeof (err as { index?: unknown }).index === 'number') {
      const e = err as { index: number; message?: string };
      const rowEntry = slice[e.index];
      errors.push({
        rowNum: rowEntry?.rowNum ?? e.index + 2,
        message: e.message || fallback,
      });
    } else if (typeof err === 'string') {
      const m = err.match(/^([^:]+):\s*(.+)$/s);
      const empName = m ? m[1].trim() : '';
      const msg = m ? m[2].trim() : err;
      const rowEntry = slice.find(
        (x) => String((x.payload as { name?: string } | undefined)?.name ?? '').trim() === empName,
      );
      errors.push({ rowNum: rowEntry?.rowNum ?? '?', message: msg });
    }
  }
}

export function appendEmployeesBatchWarnings(
  batchWarnings: unknown,
  slice: ImportValidationResult[],
  warnings: ImportProgressRow[],
) {
  if (!Array.isArray(batchWarnings)) return;
  for (const w of batchWarnings) {
    if (w && typeof w === 'object' && typeof (w as { index?: unknown }).index === 'number') {
      const o = w as { index: number; message?: string };
      const rowEntry = slice[o.index];
      warnings.push({
        rowNum: rowEntry?.rowNum ?? o.index + 2,
        message: o.message || '',
      });
    }
  }
}
