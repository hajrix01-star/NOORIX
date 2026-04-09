import React from 'react';
import { fmt } from '../utils/format';

/**
 * FmtNum — يعرض الجزء الصحيح بالخط العادي
 * والكسر العشري بلون رمادي خافت وحجم أصغر.
 *
 * @example
 * <FmtNum n={1234.5} />          → "1,234" + ".5" (خافت صغير)
 * <FmtNum n={5000} />            → "5,000" (بدون كسر)
 * <FmtNum n={v} className="nx-cell-num" />
 */
export function FmtNum({ n, maxDecimals = 1, className }) {
  const str = fmt(n, maxDecimals);
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
