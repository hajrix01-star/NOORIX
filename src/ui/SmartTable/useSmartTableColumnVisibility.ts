import { useCallback, useMemo, useState } from 'react';
import type { SmartTableColumn } from './types';

export function useSmartTableColumnVisibility<TRow = any>({
  columns,
  tableId,
}: {
  columns: SmartTableColumn<TRow>[];
  tableId?: string;
}) {
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(() => {
    if (!tableId) return new Set<string>();
    try {
      const saved = localStorage.getItem(`nx-col-vis:${tableId}`);
      return saved ? new Set(JSON.parse(saved) as string[]) : new Set<string>();
    } catch {
      return new Set<string>();
    }
  });

  const toggleColVis = useCallback((colKey: string) => {
    setHiddenCols((prev: Set<string>) => {
      const next = new Set<string>(prev);
      if (next.has(colKey)) next.delete(colKey); else next.add(colKey);
      if (tableId) {
        try { localStorage.setItem(`nx-col-vis:${tableId}`, JSON.stringify([...next])); } catch { /* noop */ }
      }
      return next;
    });
  }, [tableId]);

  const resetColVis = useCallback(() => {
    setHiddenCols(new Set<string>());
    if (tableId) {
      try { localStorage.removeItem(`nx-col-vis:${tableId}`); } catch { /* noop */ }
    }
  }, [tableId]);

  const visibleColumns = useMemo(
    () => columns.filter((col: any) => !hiddenCols.has(col.key)),
    [columns, hiddenCols],
  );

  const hideableCols = useMemo(
    () => columns.filter((col: any) => col.key !== 'actions'),
    [columns],
  );

  return {
    hiddenCols,
    visibleColumns,
    hideableCols,
    toggleColVis,
    resetColVis,
  };
}
