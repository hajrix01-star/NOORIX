import React from 'react';

export function ImportExportProgressBar({ pct }: { pct: number }) {
  return (
    <div className="h-[10px] rounded-full overflow-hidden bg-noorix-border">
      <div className="nx-progress-fill" style={{ width: `${pct}%`, background: 'var(--noorix-accent-blue)' }} />
    </div>
  );
}

export function ImportExportStatBadge({
  count,
  label,
  color,
}: {
  count: number;
  label: string;
  color: string;
}) {
  return (
    <div
      className="text-center"
      style={{
        padding: '10px 20px',
        borderRadius: 10,
        background: color + '14',
        border: `1px solid ${color}30`,
        minWidth: 90,
      }}
    >
      <div className="text-[26px] font-black" style={{ color, fontFamily: 'var(--noorix-font-numbers)' }}>
        {count}
      </div>
      <div className="text-[12px] text-noorix-muted mt-0.5">{label}</div>
    </div>
  );
}
