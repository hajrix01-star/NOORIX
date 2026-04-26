/**
 * تطبيع تعريفات الأعمدة لـ Excel / PDF
 * @returns {{ labels: string[], keys: string[] }}
 */
export function normalizeColumnDefs(columns: any) {
  if (!columns || !columns.length) return { labels: [], keys: [] };
  if (typeof columns[0] === 'string') {
    return { labels: columns, keys: columns };
  }
  return {
    labels: columns.map((c: any) => String(c.label ?? c.key ?? '')),
    keys: columns.map((c: any) => String(c.key ?? c.label ?? '')),
  };
}
