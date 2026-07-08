import { useCallback, useRef, useState } from 'react';

const COLUMN_WIDTH_STORAGE_VERSION = 'v2';

function columnWidthStorageKey(tableId: string) {
  return `nx-col-widths:${COLUMN_WIDTH_STORAGE_VERSION}:${tableId}`;
}

export function useSmartTableColumnResize({
  dir,
  tableId,
}: {
  dir: 'rtl' | 'ltr' | string;
  tableId?: string;
}) {
  const resizingRef = useRef<any>(null);
  const [colWidths, setColWidths] = useState<Record<string, number>>(() => {
    if (!tableId) return {};
    try {
      const saved = localStorage.getItem(columnWidthStorageKey(tableId));
      return saved ? (JSON.parse(saved) as Record<string, number>) : {};
    } catch {
      return {};
    }
  });

  const handleResizeStart = useCallback((e: any, colKey: any, startW: any) => {
    e.preventDefault();
    e.stopPropagation();
    const dirMult = dir === 'rtl' ? -1 : 1;
    resizingRef.current = { colKey, startX: e.clientX, startW };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMove = (ev: PointerEvent) => {
      if (!resizingRef.current) return;
      const delta = (ev.clientX - resizingRef.current.startX) * dirMult;
      const newW = Math.max(40, resizingRef.current.startW + delta);
      setColWidths((prev: any) => ({ ...prev, [colKey]: Math.round(newW) }));
    };

    const onUp = () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      if (tableId) {
        setColWidths((prev: any) => {
          try { localStorage.setItem(columnWidthStorageKey(tableId), JSON.stringify(prev)); } catch { /* noop */ }
          return prev;
        });
      }
      resizingRef.current = null;
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onUp);
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onUp);
  }, [dir, tableId]);

  return {
    colWidths,
    handleResizeStart,
  };
}
