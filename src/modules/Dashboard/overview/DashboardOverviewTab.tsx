/**
 * DashboardOverviewTab — نظرة عامة مختصرة مع فحص مطابقة محاسبي للمالك فقط.
 */
import React from 'react';
import { useApp } from '../../../context/AppContext';
import { useAuth } from '../../../context/AuthContext';
import { hasPermission, PERMISSIONS } from '../../../constants/permissions';
import { useTranslation } from '../../../i18n/useTranslation';
import { ErrorState } from '../../../components/states';
import { Button, usePrintPreview } from '../../../ui';
import type { DashboardOverviewTabProps } from './types';
import { useDashboardOverviewModel } from './hooks/useDashboardOverviewModel';
import { DashboardOverviewKpiSkeleton } from './components/DashboardOverviewKpiSkeleton';
import { DashboardVaultActivitySection } from './components/DashboardVaultActivitySection';
import { DashboardOperationalOverviewSection } from './components/DashboardOperationalOverviewSection';
import { DashboardOverviewKpis } from './components/DashboardOverviewKpis';
import { DashboardLedgerReconciliationModal } from './components/DashboardLedgerReconciliationModal';
import { buildDashboardOverviewPrintDocument } from './dashboardOverviewPrintModel';

export default function DashboardOverviewTab({ companyId, year, selectedMonth, filter }: DashboardOverviewTabProps) {
  const { t } = useTranslation();
  const { companies } = useApp();
  const { user } = useAuth();
  const [reconciliationOpen, setReconciliationOpen] = React.useState(false);
  const m = useDashboardOverviewModel(companyId, year, selectedMonth, filter);
  const { openPrintDocumentPreview, printPreviewModal } = usePrintPreview({
    title: t('dashboardOverview'),
    closeLabel: t('close'),
    printLabel: `${t('print')} / PDF`,
  });

  if (!companyId) {
    return <div className="p-8 text-center text-noorix-muted">{t('pleaseSelectCompany')}</div>;
  }

  if (m.isLoading) return <DashboardOverviewKpiSkeleton />;

  if (m.error) {
    return <ErrorState className="m-4">{m.error instanceof Error ? m.error.message : String(m.error)}</ErrorState>;
  }

  const company = companies.find((row) => row.id === companyId);
  const companyName = (m.lang === 'ar' ? company?.nameAr || company?.nameEn : company?.nameEn || company?.nameAr) || t('dashboard');
  const canRunReconciliation = hasPermission(user?.role, PERMISSIONS.VIEW_OWNER, user?.permissions);
  const periodStart = filter?.periodStart ?? `${year}-01-01`;
  const periodEnd = filter?.periodEnd ?? `${year}-12-31`;
  const handlePrint = () => openPrintDocumentPreview(buildDashboardOverviewPrintDocument({
    companyName,
    companyLogoUrl: company?.logoUrl,
    year,
    filter,
    lang: m.lang,
    t: m.t,
    kpiCardsByKey: m.kpiCardsByKey,
    vaultActivity: m.vaultActivity,
    operationalOverview: m.operationalOverview,
  }));

  return (
    <div className="flex w-full min-w-0 flex-col gap-4">
      {printPreviewModal}
      <DashboardLedgerReconciliationModal
        open={reconciliationOpen}
        onClose={() => setReconciliationOpen(false)}
        companyId={companyId}
        startDate={periodStart}
        endDate={periodEnd}
      />
      <div className="flex flex-wrap justify-end gap-2">
        {canRunReconciliation && <Button size="sm" variant="secondary" onClick={() => setReconciliationOpen(true)}>فحص المطابقة</Button>}
        <Button size="sm" variant="secondary" onClick={handlePrint}>{t('print')} / A4</Button>
      </div>
      <DashboardOverviewKpis
        kpiCardsByKey={m.kpiCardsByKey}
        filter={m.filter}
        year={m.year}
        salesShiftPeriodTotals={m.salesShiftPeriodTotals}
        revenueDailyAvgCalendar={m.revenueDailyAvgCalendar}
        revenueDailyAvgPrevMonthCalendar={m.revenueDailyAvgPrevMonthCalendar}
        customerDailyAvgCalendar={m.customerDailyAvgCalendar}
        customerDailyAvgPrevMonthCalendar={m.customerDailyAvgPrevMonthCalendar}
        basketAvgCalendar={m.basketAvgCalendar}
        basketAvgPrevMonthCalendar={m.basketAvgPrevMonthCalendar}
        basketAvgDeltaPct={m.basketAvgDeltaPct}
      />
      <DashboardVaultActivitySection
        activity={m.vaultActivity}
        operatingCost={m.operationalOverview.operatingCosts.amount}
        lang={m.lang}
        t={m.t}
      />
      <DashboardOperationalOverviewSection overview={m.operationalOverview} lang={m.lang} t={m.t} />
    </div>
  );
}

export type { DashboardOverviewTabProps } from './types';