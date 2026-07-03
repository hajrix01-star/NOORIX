import React from 'react';
import { FmtNum } from '../../../../../ui';

type DailyTooltipProps = {
  active?: boolean;
  payload?: ReadonlyArray<{ dataKey?: string | number; value?: unknown; color?: string }>;
  label?: unknown;
};

/** Tooltip مخصص للـ AreaChart — نفس المحتوى السابق */
export function BankAnalysisDailyTooltip({ active, payload, label }: DailyTooltipProps) {
  if (!active || !payload?.length) return null;
  const deposits = payload.find((p) => p.dataKey === 'deposits')?.value ?? 0;
  const withdrawals = payload.find((p) => p.dataKey === 'withdrawals')?.value ?? 0;
  const dep = typeof deposits === 'number' ? deposits : Number(deposits);
  const wit = typeof withdrawals === 'number' ? withdrawals : Number(withdrawals);
  return (
    <div className="text-[12px] nx-rtl nx-recharts-tooltip-shell">
      <div className="font-bold text-noorix-text mb-1.5">{label != null ? String(label) : ''}</div>
      <div className="text-noorix-green mb-1">
        إيداعات: <FmtNum n={dep} className="nx-num-bold" />
      </div>
      <div className="text-noorix-red mb-1">
        سحوبات: <FmtNum n={wit} className="nx-num-bold" />
      </div>
      <div
        className={`font-bold nx-recharts-tooltip-footer ${dep - wit >= 0 ? 'text-noorix-green' : 'text-[var(--noorix-accent-rose)]'}`}
      >
        الصافي: <FmtNum n={dep - wit} className="inline-block ltr" />
      </div>
    </div>
  );
}
