import React from 'react';
import type { SmartTableColumn, SmartTableFooterSegment } from './types';
import { columnLabel } from './columnUtils';

export { columnLabel, getAlign } from './columnUtils';

/**
 * يحوّل footerRow إلى خلايا <td> مدركة لإخفاء الأعمدة — نفس المنطق السابق.
 */
export function buildFooterCells({
  footerRow,
  columns,
  hiddenCols,
  showRowNumbers,
  rowNumberWidth,
  cellPad,
}: {
  footerRow: SmartTableFooterSegment[];
  columns: SmartTableColumn[];
  hiddenCols: Set<string>;
  showRowNumbers: boolean;
  rowNumberWidth?: number | string;
  cellPad: { th: string; td: string };
}): React.ReactNode[] {
  const cells: React.ReactNode[] = [];

  if (showRowNumbers) {
    cells.push(
      <td key="__num__" style={{ width: rowNumberWidth || 36, padding: cellPad.td }} />,
    );
  }

  const visibleColumnKeys = new Set(columns.filter((col) => !hiddenCols.has(col.key)).map((col) => col.key));
  const segByFirstKey = new Map<string, SmartTableFooterSegment & { visibleSpan: number }>();
  footerRow.forEach((seg) => {
    if (!seg.keys?.length) return;
    const firstVisibleKey = seg.keys.find((key) => visibleColumnKeys.has(key));
    if (!firstVisibleKey) return;
    const visibleSpan = seg.keys.filter((key) => visibleColumnKeys.has(key)).length;
    segByFirstKey.set(firstVisibleKey, { ...seg, visibleSpan });
  });

  const items: Array<{
    key: string;
    span: number;
    hidden: boolean;
    content?: React.ReactNode;
    className?: string;
  }> = [];
  let i = 0;
  while (i < columns.length) {
    const col = columns[i];
    const seg = segByFirstKey.get(col.key);
    if (seg) {
      items.push({
        key: col.key,
        span: Math.max(1, seg.visibleSpan),
        hidden: seg.visibleSpan === 0,
        content: seg.content,
        className: seg.className,
      });
      i += Math.max(1, seg.visibleSpan);
    } else {
      items.push({ key: col.key, span: 1, hidden: hiddenCols.has(col.key), content: null, className: '' });
      i++;
    }
  }

  let pendingSpan = 0;
  for (const item of items) {
    if (item.hidden) {
      pendingSpan += item.span;
    } else {
      const totalSpan = pendingSpan + item.span;
      cells.push(
        <td
          key={item.key}
          colSpan={totalSpan > 1 ? totalSpan : undefined}
          className={item.className || undefined}
        >
          {item.content}
        </td>,
      );
      pendingSpan = 0;
    }
  }

  if (pendingSpan > 0) {
    cells.push(<td key="__trail__" colSpan={pendingSpan > 1 ? pendingSpan : undefined} />);
  }

  return cells;
}
