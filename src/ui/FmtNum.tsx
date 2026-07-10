import React from 'react';
import { fmt, fmtTax } from '../utils/format';

type NumericDisplayValue = number | string | null | undefined | { toNumber: () => number };

/**
 * FmtNum — يعرض الجزء الصحيح بالخط العادي
 * والكسر العشري بلون رمادي خافت وحجم أصغر.
 *
 * @example
 * <FmtNum n={1234.5} />          → "1,234" + ".5" (خافت صغير)
 * <FmtNum n={5000} />            → "5,000" (بدون كسر)
 * <FmtNum n={v} className="nx-cell-num" />
 * <FmtNum n={v} tax />  — الضريبة: خانة عشرية كحد أقصى (`fmtTax`)
 */
export function FmtNum({
  n,
  maxDecimals = 1,
  tax = false,
  className = '',
}: {
  n: NumericDisplayValue;
  maxDecimals?: number;
  tax?: boolean;
  className?: string;
}) {
  const numeric = typeof n === 'object' && n && 'toNumber' in n ? n.toNumber() : Number(n ?? 0);
  const safeNumber = Number.isFinite(numeric) ? numeric : 0;
  const str = tax ? fmtTax(safeNumber) : fmt(safeNumber, maxDecimals);
  const dotIdx = str.indexOf('.');

  if (dotIdx === -1) {
    return <span className={className}>{str}</span>;
  }

  return (
    <span className={className}>
      {str.slice(0, dotIdx)}
      <span className="nx-decimal">{str.slice(dotIdx)}</span>
    </span>
  );
}
