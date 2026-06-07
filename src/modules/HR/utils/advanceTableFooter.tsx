import type { ReactNode } from 'react';
import type { SmartTableFooterSegment } from '../../../ui';
import { hrFmt } from './hrFmt';
import type { AdvanceTotals } from './advanceBalance';

export function buildAdvanceFinancialFooterRow({
  totals,
  summary,
}: {
  totals: AdvanceTotals;
  summary?: ReactNode;
}): SmartTableFooterSegment[] {
  return [
    {
      keys: ['employeeName'],
      className: 'text-[12px] text-noorix-muted font-semibold py-1.5 px-3',
      content: summary ?? null,
    },
    {
      keys: ['totalAmount'],
      className: 'text-[13px] text-end py-1.5 px-3 text-noorix-blue font-black nx-font-numbers',
      content: hrFmt(totals.totalAmount.toNumber()),
    },
    {
      keys: ['transactionDate'],
      className: 'text-[12px] text-noorix-muted py-1.5 px-3',
      content: null,
    },
    {
      keys: ['settledAmount'],
      className: 'text-[13px] text-end py-1.5 px-3 text-noorix-green font-black nx-font-numbers',
      content: hrFmt(totals.settledAmount.toNumber()),
    },
    {
      keys: ['remainingAmount'],
      className: 'text-[13px] text-end py-1.5 px-3 text-noorix-amber font-black nx-font-numbers',
      content: hrFmt(totals.remainingAmount.toNumber()),
    },
  ];
}
