import React from 'react';
import type { SmartTableColumn, SmartTableFooterSegment, SmartTableRow } from './types';
import { columnLabel } from './columnUtils';
import { buildFooterCellStyle, buildFooterRowNumberStyle } from './smartTableStyles';

type FooterCellCssVars = React.CSSProperties & Record<`--${string}`, string | number | undefined>;

export { columnLabel, getAlign } from './columnUtils';

/**
 * يحوّل footerRow إلى خلايا <td> مدركة لإخفاء الأعمدة — نفس المنطق السابق.
 */
export function buildFooterCells<TRow extends SmartTableRow = SmartTableRow>({
  footerRow,
  columns,
  hiddenCols,
  showRowNumbers,
}: {
  footerRow: SmartTableFooterSegment[];
  columns: SmartTableColumn<TRow>[];
  hiddenCols: Set<string>;
  showRowNumbers: boolean;
}): React.ReactNode[] {
  const cells: React.ReactNode[] = [];
  const rowNumberStyle: FooterCellCssVars = buildFooterRowNumberStyle();
  const footerCellStyle: FooterCellCssVars = buildFooterCellStyle();

  if (showRowNumbers) {
    cells.push(
      <td
        key="__num__"
        className="nx-row-number-td nx-smart-row-number-cell nx-smart-footer-cell-vars"
        style={rowNumberStyle}
      />,
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
          className={['nx-smart-footer-cell-vars', item.className].filter(Boolean).join(' ') || undefined}
          style={footerCellStyle}
        >
          {item.content}
        </td>,
      );
      pendingSpan = 0;
    }
  }

  if (pendingSpan > 0) {
    cells.push(
      <td
        key="__trail__"
        colSpan={pendingSpan > 1 ? pendingSpan : undefined}
        className="nx-smart-footer-cell-vars"
        style={footerCellStyle}
      />,
    );
  }

  return cells;
}
