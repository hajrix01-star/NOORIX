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

  const segByFirstKey = new Map<string, SmartTableFooterSegment>();
  footerRow.forEach((seg) => {
    if (seg.keys?.length) segByFirstKey.set(seg.keys[0], seg);
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
      const allHidden = seg.keys.every((k) => hiddenCols.has(k));
      items.push({
        key: col.key,
        span: seg.keys.length,
        hidden: allHidden,
        content: seg.content,
        className: seg.className,
      });
      i += seg.keys.length;
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
