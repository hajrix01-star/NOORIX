/**
 * HRSummaryCard — كرت ملخص شؤون الموظفين
 * يستخدم MetricCard الموحّد تماماً كلوحة التحكم وكروت الخزائن.
 */
import React from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { MetricCard } from '../../../ui';
import { fmt } from '../../../utils/format';

/* ألوان Design Tokens الموحّدة (var() للكروت — لا hex مباشر) */
const COLOR_ACTIVE    = 'var(--color-nx-profit)';   /* أخضر — موظفون نشطون */
const COLOR_PAYROLL   = 'var(--color-nx-sales)';    /* أزرق — رواتب */
const COLOR_RESIDENCY = 'var(--color-nx-purchases)';/* رمادي/بني — إقامات */
const COLOR_ADVANCES  = 'var(--color-nx-expenses)'; /* أحمر — سلف معلقة */
const COLOR_LEAVES    = 'var(--color-nx-app)';      /* بنفسجي — إجازات */

const CARD_CLASS = 'min-h-[110px]';

export default function HRSummaryCard({
  activeCount = 0,
  terminatedCount = 0,
  monthlyPayrollTotal = 0,
  expiringResidencyCount = 0,
  registeredLeavesCount = 0,
  outstandingAdvancesCount = 0,
  outstandingAdvancesAmount = 0,
  isLoading = false,
}) {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="noorix-surface-card min-h-[110px] animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">

      {/* 1 — الموظفون النشطون */}
      <MetricCard color={COLOR_ACTIVE} className={CARD_CLASS}>
        <MetricCard.Header label={t('hrStatsActive')} />
        <MetricCard.Value value={activeCount} color={COLOR_ACTIVE} />
        {terminatedCount > 0 && (
          <MetricCard.Footer className="pb-3 pt-2">
            <span className="text-[11px] text-noorix-muted truncate">
              {t('hrStatsTerminated')}: <strong className="text-noorix-text">{terminatedCount}</strong>
            </span>
          </MetricCard.Footer>
        )}
      </MetricCard>

      {/* 2 — إجمالي الرواتب الشهري */}
      <MetricCard color={COLOR_PAYROLL} className={CARD_CLASS}>
        <MetricCard.Header label={t('hrStatsMonthlyPayroll')} />
        <MetricCard.Value value={monthlyPayrollTotal} currency="SR" color={COLOR_PAYROLL} />
      </MetricCard>

      {/* 3 — إقامات قريبة الانتهاء */}
      <MetricCard
        color={expiringResidencyCount > 0 ? 'var(--color-nx-net-profit)' : COLOR_RESIDENCY}
        className={CARD_CLASS}
      >
        <MetricCard.Header label={t('hrStatsResidencyExpiring')} />
        <MetricCard.Value
          value={expiringResidencyCount}
          color={expiringResidencyCount > 0 ? 'var(--color-nx-net-profit)' : undefined}
        />
      </MetricCard>

      {/* 4 — السلف المعلقة */}
      <MetricCard
        color={outstandingAdvancesCount > 0 ? COLOR_ADVANCES : COLOR_RESIDENCY}
        className={CARD_CLASS}
      >
        <MetricCard.Header label={t('hrStatsAdvancesOutstanding')} />
        <MetricCard.Value
          value={outstandingAdvancesCount}
          color={outstandingAdvancesCount > 0 ? COLOR_ADVANCES : undefined}
        />
        {outstandingAdvancesAmount > 0 && (
          <MetricCard.Footer className="pb-3 pt-1">
            <span
              className="text-[12px] font-bold tabular-nums"
              style={{ color: COLOR_ADVANCES }}
            >
              {fmt(outstandingAdvancesAmount)} <span className="nx-sar">SR</span>
            </span>
          </MetricCard.Footer>
        )}
      </MetricCard>

      {/* 5 — إجازات مسجّلة (السنة الحالية) — بدون مسار اعتماد منفصل */}
      <MetricCard color={COLOR_LEAVES} className={CARD_CLASS}>
        <MetricCard.Header label={t('hrStatsLeavesYear')} />
        <MetricCard.Value value={registeredLeavesCount} color={COLOR_LEAVES} />
      </MetricCard>

    </div>
  );
}
