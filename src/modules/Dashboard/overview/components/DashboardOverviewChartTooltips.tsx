import React from 'react';
import { formatNumber } from '../../../../utils/money';

/** Tooltip خط الأداء — تنسيق موحّد مع money.ts */
export function DashboardAreaTooltip({
  active,
  payload,
  label,
  lang,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ dataKey?: string | number; name?: string; value?: number; color?: string }>;
  label?: string | number;
  lang: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="min-w-[140px] rounded-md border border-noorix-border bg-noorix-surface py-2 px-3 text-[12px] shadow-[0_4px_16px_rgba(0,0,0,0.12)]"
    >
      <div className="mb-[5px] text-[11px] font-bold text-noorix-text">
        {label != null ? String(label) : ''}
      </div>
      {payload.map((p) => (
        <div
          key={String(p.dataKey)}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 12,
            color: p.color,
            fontWeight: 600,
            marginTop: 2,
          }}
        >
          <span>{p.name}</span>
          <span className="nx-font-numbers">
            {formatNumber(p.value, lang, { minFractionDigits: 0, maxFractionDigits: 0 })}{' '}
            <span className="nx-sar">SR</span>
          </span>
        </div>
      ))}
    </div>
  );
}

export function DashboardPieTooltip({
  active,
  payload,
  lang,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ name?: string; value?: number; payload?: { fill?: string; pct?: string } }>;
  lang: string;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  const fill = p.payload?.fill;
  return (
    <div
      className="rounded-md border border-noorix-border bg-noorix-surface py-[7px] px-[11px] text-[12px] shadow-[0_4px_16px_rgba(0,0,0,0.12)]"
    >
      <div style={{ fontWeight: 700, color: fill }}>{p.name}</div>
      <div className="ltr nx-font-numbers font-bold text-noorix-text">
        {formatNumber(p.value, lang)} <span className="nx-sar">SR</span>
      </div>
      <div className="text-[11px] text-noorix-muted">{p.payload?.pct}%</div>
    </div>
  );
}
