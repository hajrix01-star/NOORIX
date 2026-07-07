/**
 * تطبيع تعريفات الأعمدة لـ Excel / PDF
 * @returns {{ labels: string[], keys: string[] }}
 */
type ExportColumnDef = string | { key?: string | number; label?: string | number };

export function normalizeColumnDefs(columns: readonly ExportColumnDef[] | null | undefined) {
  if (!columns || !columns.length) return { labels: [], keys: [] };
  if (typeof columns[0] === 'string') {
    return { labels: [...columns] as string[], keys: [...columns] as string[] };
  }
  return {
    labels: columns.map((c) => (typeof c === 'string' ? c : String(c.label ?? c.key ?? ''))),
    keys: columns.map((c) => (typeof c === 'string' ? c : String(c.key ?? c.label ?? ''))),
  };
}
