import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

const COLUMN_WIDTH_STORAGE_VERSION = 'v2';

type ResizeState = {
  primaryKey: string;
  secondaryKey: string;
  startX: number;
  primaryStartW: number;
  secondaryStartW: number;
  primaryMinW: number;
  secondaryMinW: number;
};

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
  const resizingRef = useRef<ResizeState | null>(null);
  const [colWidths, setColWidths] = useState<Record<string, number>>(() => {
    if (!tableId) return {};
    try {
      const saved = localStorage.getItem(columnWidthStorageKey(tableId));
      return saved ? (JSON.parse(saved) as Record<string, number>) : {};
    } catch {
      return {};
    }
  });

  const handleResizeStart = useCallback((
    e: ReactPointerEvent,
    primaryKey: string,
    primaryStartW: number,
    secondaryKey: string,
    secondaryStartW: number,
    primaryMinW = 40,
    secondaryMinW = 40,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const dirMult = dir === 'rtl' ? -1 : 1;
    resizingRef.current = {
      primaryKey,
      secondaryKey,
      startX: e.clientX,
      primaryStartW,
      secondaryStartW,
      primaryMinW,
      secondaryMinW,
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMove = (ev: PointerEvent) => {
      if (!resizingRef.current) return;
      const state = resizingRef.current;
      const delta = (ev.clientX - state.startX) * dirMult;
      const minDelta = state.primaryMinW - state.primaryStartW;
      const maxDelta = state.secondaryStartW - state.secondaryMinW;
      const clampedDelta = Math.min(Math.max(delta, minDelta), maxDelta);
      const primaryWidth = Math.round(state.primaryStartW + clampedDelta);
      const secondaryWidth = Math.round(state.secondaryStartW - clampedDelta);
      setColWidths((prev) => ({
        ...prev,
        [state.primaryKey]: primaryWidth,
        [state.secondaryKey]: secondaryWidth,
      }));
    };

    const onUp = () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      if (tableId) {
        setColWidths((prev) => {
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
