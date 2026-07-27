import React, { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../cn';
import type { SmartTableColumn, SmartTableRow } from './types';
import { columnLabel } from './columnUtils';

const COL_VIS_PANEL_MARGIN = 12;
const COL_VIS_PANEL_GAP = 6;
const COL_VIS_PANEL_FALLBACK_W = 220;
const COL_VIS_PANEL_FALLBACK_H = 320;

type SmartTableColumnVisibilityCssVars = React.CSSProperties & Record<`--${string}`, string | number | undefined>;

export type SmartTableColumnVisibilityProps<TRow extends SmartTableRow = SmartTableRow> = {
  columns: SmartTableColumn<TRow>[];
  hiddenCols: Set<string>;
  hasCustomColumnWidths: boolean;
  onToggleColumn: (key: string) => void;
  onResetColumns: () => void;
  onResetColumnWidths: () => void;
};

function cssLength(value: number | string | undefined): string | undefined {
  if (value == null || value === '') return undefined;
  return typeof value === 'number' ? `${value}px` : value;
}

export function placeColVisPanel(btn: HTMLElement, panel: HTMLElement): { top: number; left: number } {
  const rect = btn.getBoundingClientRect();
  const w = panel.offsetWidth || COL_VIS_PANEL_FALLBACK_W;
  const h = panel.offsetHeight || COL_VIS_PANEL_FALLBACK_H;
  const maxLeft = window.innerWidth - COL_VIS_PANEL_MARGIN - w;
  const isRtl = typeof document !== 'undefined'
    && (document.documentElement.dir === 'rtl'
      || getComputedStyle(document.documentElement).direction === 'rtl');
  let left = isRtl ? rect.left : rect.right - w;
  left = Math.max(COL_VIS_PANEL_MARGIN, Math.min(left, maxLeft));
  let top = rect.bottom + COL_VIS_PANEL_GAP;
  if (top + h > window.innerHeight - COL_VIS_PANEL_MARGIN) {
    top = Math.max(COL_VIS_PANEL_MARGIN, rect.top - h - COL_VIS_PANEL_GAP);
  }
  return { top, left };
}

function SmartTableColumnVisibilityInner<TRow extends SmartTableRow = SmartTableRow>({
  columns,
  hiddenCols,
  hasCustomColumnWidths,
  onToggleColumn,
  onResetColumns,
  onResetColumnWidths,
}: SmartTableColumnVisibilityProps<TRow>) {
  const [showPanel, setShowPanel] = useState(false);
  const [panelPos, setPanelPos] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const syncPanelPosition = useCallback(() => {
    const btn = buttonRef.current;
    const panel = panelRef.current;
    if (!btn || !panel) return;
    setPanelPos(placeColVisPanel(btn, panel));
  }, []);

  useLayoutEffect(() => {
    if (!showPanel) {
      setPanelPos(null);
      return undefined;
    }

    syncPanelPosition();
    const onReflow = () => syncPanelPosition();
    window.addEventListener('resize', onReflow);
    window.addEventListener('scroll', onReflow, true);
    return () => {
      window.removeEventListener('resize', onReflow);
      window.removeEventListener('scroll', onReflow, true);
    };
  }, [hiddenCols.size, hasCustomColumnWidths, showPanel, syncPanelPosition]);

  useEffect(() => {
    if (!showPanel) return;

    const handler = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (!panelRef.current?.contains(target) && !buttonRef.current?.contains(target)) {
        setShowPanel(false);
      }
    };

    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showPanel]);

  const panelStyle: SmartTableColumnVisibilityCssVars | undefined = panelPos
    ? {
        top: cssLength(panelPos.top),
        left: cssLength(panelPos.left),
      }
    : undefined;

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        className={`nx-col-vis-btn${hiddenCols.size > 0 ? ' nx-col-vis-btn--active' : ''}`}
        title="إظهار / إخفاء الأعمدة"
        aria-label="إظهار / إخفاء الأعمدة"
        onClick={() => setShowPanel((v) => !v)}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <line x1="9" y1="3" x2="9" y2="21" />
          <line x1="15" y1="3" x2="15" y2="21" />
        </svg>
        {hiddenCols.size > 0 && (
          <span className="nx-col-vis-badge">{hiddenCols.size}</span>
        )}
      </button>
      {showPanel && typeof document !== 'undefined' && createPortal(
        <div
          ref={panelRef}
          className={cn('nx-col-vis-panel', 'nx-col-vis-panel--viewport', !panelPos && 'nx-col-vis-panel--measuring')}
          style={panelStyle}
          role="dialog"
          aria-label="إظهار / إخفاء الأعمدة"
        >
          <div className="nx-col-vis-panel__header">
            <span>الأعمدة</span>
            {(hiddenCols.size > 0 || hasCustomColumnWidths) && (
              <div className="flex items-center justify-end gap-2 flex-wrap">
                {hasCustomColumnWidths && (
                  <button type="button" className="nx-col-vis-reset nx-col-vis-reset-widths" onClick={onResetColumnWidths}>إعادة ضبط العرض</button>
                )}
                {hiddenCols.size > 0 && (
                  <button type="button" className="nx-col-vis-reset" onClick={onResetColumns}>إعادة تعيين الأعمدة</button>
                )}
              </div>
            )}
          </div>
          {columns.map((col) => (
            <label key={col.key} className="nx-col-vis-item">
              <input
                type="checkbox"
                checked={!hiddenCols.has(col.key)}
                onChange={() => onToggleColumn(col.key)}
              />
              <span>{columnLabel(col)}</span>
            </label>
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
}

const SmartTableColumnVisibility = memo(SmartTableColumnVisibilityInner) as typeof SmartTableColumnVisibilityInner;

export default SmartTableColumnVisibility;
