import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { SmartTableColumnSizingMode } from './types';

const COLUMN_WIDTH_STORAGE_VERSION_BY_MODE: Record<SmartTableColumnSizingMode, string> = {
  fixed: 'v2',
  adaptive: 'v3',
};

type PairResizeState = {
  mode: 'fixed';
  primaryKey: string;
  secondaryKey: string;
  startX: number;
  primaryStartW: number;
  secondaryStartW: number;
  primaryMinW: number;
  secondaryMinW: number;
};

type SingleResizeState = {
  mode: 'adaptive';
  primaryKey: string;
  startX: number;
  primaryStartW: number;
  primaryMinW: number;
  primaryMaxW: number;
};

type ResizeState = PairResizeState | SingleResizeState;

function columnWidthStorageKey(tableId: string, mode: SmartTableColumnSizingMode) {
  return `nx-col-widths:${COLUMN_WIDTH_STORAGE_VERSION_BY_MODE[mode]}:${tableId}`;
}

export function useSmartTableColumnResize({
  dir,
  tableId,
  mode,
}: {
  dir: 'rtl' | 'ltr' | string;
  tableId?: string;
  mode: SmartTableColumnSizingMode;
}) {
  const resizingRef = useRef<ResizeState | null>(null);
  const [colWidths, setColWidths] = useState<Record<string, number>>(() => {
    if (!tableId) return {};
    try {
      const saved = localStorage.getItem(columnWidthStorageKey(tableId, mode));
      return saved ? (JSON.parse(saved) as Record<string, number>) : {};
    } catch {
      return {};
    }
  });
  const hasCustomColumnWidths = Object.keys(colWidths).length > 0;

  useEffect(() => {
    if (!tableId) {
      setColWidths({});
      return;
    }
    try {
      const saved = localStorage.getItem(columnWidthStorageKey(tableId, mode));
      setColWidths(saved ? (JSON.parse(saved) as Record<string, number>) : {});
    } catch {
      setColWidths({});
    }
  }, [mode, tableId]);

  const handleResizeStart = useCallback((
    e: ReactPointerEvent,
    primaryKey: string,
    primaryStartW: number,
    secondaryKey?: string,
    secondaryStartW = 0,
    primaryMinW = 40,
    secondaryMinW = 40,
    primaryMaxW = 720,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const dirMult = dir === 'rtl' ? -1 : 1;
    resizingRef.current = mode === 'adaptive'
      ? {
        mode,
        primaryKey,
        startX: e.clientX,
        primaryStartW,
        primaryMinW,
        primaryMaxW: Math.max(primaryMaxW, primaryMinW),
      }
      : {
        mode,
        primaryKey,
        secondaryKey: secondaryKey ?? '',
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
      if (state.mode === 'adaptive') {
        const primaryWidth = Math.round(Math.min(Math.max(state.primaryStartW + delta, state.primaryMinW), state.primaryMaxW));
        setColWidths((prev) => ({
          ...prev,
          [state.primaryKey]: primaryWidth,
        }));
        return;
      }
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
          try { localStorage.setItem(columnWidthStorageKey(tableId, mode), JSON.stringify(prev)); } catch { /* noop */ }
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
  }, [dir, mode, tableId]);

  const resetColumnWidths = useCallback(() => {
    setColWidths({});
    if (tableId) {
      try { localStorage.removeItem(columnWidthStorageKey(tableId, mode)); } catch { /* noop */ }
    }
  }, [mode, tableId]);

  return {
    colWidths,
    hasCustomColumnWidths,
    handleResizeStart,
    resetColumnWidths,
  };
}
