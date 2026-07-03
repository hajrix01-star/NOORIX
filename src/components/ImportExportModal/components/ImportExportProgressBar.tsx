import React from 'react';

export function ImportExportProgressBar({ pct }: { pct: number }) {
  const progressStyle = { '--import-progress-pct': `${pct}%` } as React.CSSProperties;
  return (
    <div className="h-[10px] rounded-full overflow-hidden bg-noorix-border">
      <div className="nx-progress-fill nx-import-progress-fill bg-noorix-blue" style={progressStyle} />
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
  const badgeStyle = {
    '--import-stat-color': color,
    '--import-stat-bg': `${color}14`,
    '--import-stat-border': `${color}30`,
  } as React.CSSProperties;
  return (
    <div
      className="nx-import-stat-badge text-center"
      style={badgeStyle}
    >
      <div className="nx-import-stat-badge__count text-[26px] font-black nx-font-numbers">
        {count}
      </div>
      <div className="text-[12px] text-noorix-muted mt-0.5">{label}</div>
    </div>
  );
}
