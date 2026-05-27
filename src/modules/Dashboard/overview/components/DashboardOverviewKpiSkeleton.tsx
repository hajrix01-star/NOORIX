import React from 'react';

/** هيكل تحميل كروت KPI — نفس الشكل السابق */
export function DashboardOverviewKpiSkeleton() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="nx-kpi-container">
        <div className="nx-kpi-grid">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="noorix-surface-card relative min-h-[132px] overflow-hidden p-4 bg-[linear-gradient(110deg,var(--noorix-bg-muted)_0%,var(--noorix-bg-surface)_45%,var(--noorix-bg-muted)_90%)] bg-[length:200%_100%] animate-[shimmer_1.4s_ease_infinite]"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
