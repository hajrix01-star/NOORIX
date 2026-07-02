import React from 'react';

export function ImportExportProgressBar({ pct }: { pct: number }) {
  return (
    <div className="h-[10px] rounded-full overflow-hidden bg-noorix-border">
      <div className="nx-progress-fill bg-noorix-blue" style={{ width: `${pct}%` }} />
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
      <div className="text-[26px] font-black nx-font-numbers" style={{ color }}>
        {count}
      </div>
      <div className="text-[12px] text-noorix-muted mt-0.5">{label}</div>
    </div>
  );
}
