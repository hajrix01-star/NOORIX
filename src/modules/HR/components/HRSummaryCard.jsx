/**
 * HRSummaryCard — كرت ملخص شؤون الموظفين الشامل
 */
import React from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { fmt } from '../../../utils/format';
import { cn } from '../../../ui';

function StatItem({ label, value, sub, color = 'text-noorix-text', bgColor, icon, srOnly = false }) {
  if (srOnly && !value) return null;
  return (
    <div
      className={cn(
        'flex flex-col gap-1 rounded-xl p-3 sm:p-4 min-w-0',
        bgColor ?? 'bg-noorix-bg-muted',
      )}
    >
      <div className="flex items-center gap-2 min-w-0">
        {icon && (
          <span className="text-[18px] shrink-0 leading-none opacity-80">{icon}</span>
        )}
        <span className="text-[12px] text-noorix-muted leading-tight truncate">{label}</span>
      </div>
      <div className={cn('text-[22px] sm:text-[26px] font-black tabular-nums leading-none', color)}>
        {value}
      </div>
      {sub && (
        <div className="text-[11px] text-noorix-muted leading-tight truncate mt-0.5">{sub}</div>
      )}
    </div>
  );
}

export default function HRSummaryCard({
  activeCount = 0,
  terminatedCount = 0,
  monthlyPayrollTotal = 0,
  expiringResidencyCount = 0,
  pendingLeavesCount = 0,
  outstandingAdvancesCount = 0,
  outstandingAdvancesAmount = 0,
  isLoading = false,
}) {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div className="noorix-surface-card p-4 sm:p-5 animate-pulse">
        <div className="h-4 w-40 bg-noorix-border rounded mb-4" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-20 bg-noorix-border/50 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="noorix-surface-card p-4 sm:p-5 flex flex-col gap-4">
      {/* عنوان الكرت */}
      <div className="flex items-center gap-2">
        <span className="text-[16px] font-bold text-noorix-text">{t('hrSummaryCardTitle')}</span>
      </div>

      {/* شبكة الإحصائيات */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">

        {/* الموظفون النشطون */}
        <StatItem
          label={t('hrStatsActive')}
          value={activeCount}
          icon="👥"
          color="text-noorix-green"
          bgColor="bg-noorix-green/8"
        />

        {/* إجمالي الرواتب الشهري */}
        <StatItem
          label={t('hrStatsMonthlyPayroll')}
          value={fmt(monthlyPayrollTotal)}
          sub={<><span className="nx-sar">SR</span></>}
          icon="💰"
          color="text-noorix-blue"
          bgColor="bg-noorix-blue/8"
        />

        {/* إقامات قريبة الانتهاء */}
        <StatItem
          label={t('hrStatsResidencyExpiring')}
          value={expiringResidencyCount}
          icon="🪪"
          color={expiringResidencyCount > 0 ? 'text-noorix-amber' : 'text-noorix-muted'}
          bgColor={expiringResidencyCount > 0 ? 'bg-noorix-amber/8' : 'bg-noorix-bg-muted'}
        />

        {/* السلف المعلقة */}
        <StatItem
          label={t('hrStatsAdvancesOutstanding')}
          value={outstandingAdvancesCount}
          sub={
            outstandingAdvancesAmount > 0
              ? `${fmt(outstandingAdvancesAmount)} SR`
              : undefined
          }
          icon="📋"
          color={outstandingAdvancesCount > 0 ? 'text-noorix-red' : 'text-noorix-muted'}
          bgColor={outstandingAdvancesCount > 0 ? 'bg-noorix-red/8' : 'bg-noorix-bg-muted'}
        />

        {/* طلبات الإجازة المعلقة */}
        <StatItem
          label={t('hrStatsPendingLeaves')}
          value={pendingLeavesCount}
          icon="🏖️"
          color={pendingLeavesCount > 0 ? 'text-noorix-violet' : 'text-noorix-muted'}
          bgColor={pendingLeavesCount > 0 ? 'bg-noorix-violet/8' : 'bg-noorix-bg-muted'}
        />
      </div>

      {/* شريط سفلي: موظفون منتهية خدمتهم (إذا وُجدوا) */}
      {terminatedCount > 0 && (
        <div className="border-t border-noorix-border pt-3 flex items-center gap-2 text-[12px] text-noorix-muted">
          <span className="shrink-0">{t('hrStatsTerminated')}:</span>
          <span className="font-bold tabular-nums text-noorix-text">{terminatedCount}</span>
        </div>
      )}
    </div>
  );
}
