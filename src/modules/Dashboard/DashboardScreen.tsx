/**
 * DashboardScreen — لوحة التحكم الرئيسية
 */
import React, { useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { useTabSearchParam } from '../../hooks/useTabSearchParam';
import { useTranslation } from '../../i18n/useTranslation';
import { DateFilterBar, FilterToolbar, ScreenTabs, ScreenShell, useDateFilter } from '../../ui';
import DashboardOverviewTab from './overview/DashboardOverviewTab';
import DashboardCalendarTab from './components/DashboardCalendarTab';
import DashboardSpecialDaysTab from './components/DashboardSpecialDaysTab';
import DashboardAppSalesTab from './components/DashboardAppSalesTab';
import { getSaudiNow } from '../../utils/saudiDate';
import { buildDashboardPeriodFilter, deriveDashboardPeriodFromDateFilter } from './dashboardPeriodModel';

const DASHBOARD_TABS = [
  { id: 'overview', labelKey: 'dashboardOverview', shortLabelKey: 'dashboardOverviewShort' },
  { id: 'calendar', labelKey: 'dashboardCalendar' },
  { id: 'specialDays', labelKey: 'dashboardSpecialDays' },
  { id: 'appSales', labelKey: 'dashboardAppSales', shortLabelKey: 'dashboardAppSalesShort' },
];
const DASHBOARD_TAB_IDS = DASHBOARD_TABS.map((tab) => tab.id);

export default function DashboardScreen() {
  const { t } = useTranslation();
  const { activeCompanyId } = useApp();
  const now = getSaudiNow();
  const [activeTab, setActiveTab] = useTabSearchParam(DASHBOARD_TAB_IDS, 'overview');
  const dashboardDateFilter = useDateFilter();
  const dashboardPeriod = useMemo(
    () => deriveDashboardPeriodFromDateFilter(dashboardDateFilter.state, now),
    [dashboardDateFilter.state, now.year, now.month],
  );
  const year = dashboardPeriod.year;
  const selectedMonthNumber = dashboardPeriod.selectedMonth;

  const filter = useMemo(
    () => buildDashboardPeriodFilter(year, selectedMonthNumber, dashboardDateFilter.label),
    [dashboardDateFilter.label, year, selectedMonthNumber],
  );

  const dashboardTabItems = useMemo(
    () =>
      DASHBOARD_TABS.map((tab) => {
        const full = t(tab.labelKey);
        const short = tab.shortLabelKey ? t(tab.shortLabelKey) : full;
        const label =
          short === full ? (
            full
          ) : (
            <>
              <span className="hidden sm:inline">{full}</span>
              <span className="sm:hidden">{short}</span>
            </>
          );
        return { id: tab.id, label };
      }),
    [t],
  );

  return (
    <ScreenShell>
      {/* هيدر */}
      <div className="flex flex-wrap items-start justify-between gap-3 nx-page-header">
        <div>
          <h1 className="text-[20px] font-bold text-noorix-text m-0">{t('dashboard')}</h1>
          <p className="text-[13px] text-noorix-muted mt-1 m-0">{t('dashboardDesc')}</p>
        </div>
        <FilterToolbar className="max-w-full">
          <DateFilterBar filter={dashboardDateFilter} />
        </FilterToolbar>
      </div>

      <ScreenTabs
        items={dashboardTabItems}
        value={activeTab}
        onChange={setActiveTab}
        compactMobile
        contentClassName={
          activeTab === 'calendar'
            ? 'nx-tab-content px-1 py-2 sm:px-3 sm:py-3 md:p-4'
            : 'nx-tab-content px-1 py-2 sm:px-3 sm:py-3 md:p-4'
        }
      >
        {activeTab === 'overview'    && <DashboardOverviewTab    companyId={activeCompanyId} year={year} selectedMonth={selectedMonthNumber} filter={filter} />}
        {activeTab === 'calendar'    && <DashboardCalendarTab    companyId={activeCompanyId} year={year} selectedMonth={selectedMonthNumber} filter={filter} />}
        {activeTab === 'specialDays' && <DashboardSpecialDaysTab companyId={activeCompanyId} year={year} selectedMonth={selectedMonthNumber} />}
        {activeTab === 'appSales'    && <DashboardAppSalesTab    companyId={activeCompanyId} year={year} />}
      </ScreenTabs>
    </ScreenShell>
  );
}
