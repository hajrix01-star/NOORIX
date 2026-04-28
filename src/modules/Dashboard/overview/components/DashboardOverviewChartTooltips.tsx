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
      style={{
        background: 'var(--noorix-bg-surface)',
        border: '1px solid var(--noorix-border)',
        borderRadius: 6,
        padding: '8px 12px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
        fontSize: 12,
        minWidth: 140,
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 5, color: 'var(--noorix-text)', fontSize: 11 }}>
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
          <span style={{ fontFamily: 'var(--noorix-font-numbers)' }}>
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
      style={{
        background: 'var(--noorix-bg-surface)',
        border: '1px solid var(--noorix-border)',
        borderRadius: 6,
        padding: '7px 11px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
        fontSize: 12,
      }}
    >
      <div style={{ fontWeight: 700, color: fill }}>{p.name}</div>
      <div style={{ fontFamily: 'var(--noorix-font-numbers)', fontWeight: 700, color: 'var(--noorix-text)' }} className="ltr">
        {formatNumber(p.value, lang)} <span className="nx-sar">SR</span>
      </div>
      <div style={{ color: 'var(--noorix-text-muted)', fontSize: 11 }}>{p.payload?.pct}%</div>
    </div>
  );
}
