/**
 * DashboardScreen — لوحة التحكم الرئيسية
 */
import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { useTabSearchParam } from '../../hooks/useTabSearchParam';
import { useTranslation } from '../../i18n/useTranslation';
import { Input, ScreenTabs, ScreenShell } from '../../ui';
import DashboardOverviewTab from './components/DashboardOverviewTab';
import DashboardCalendarTab from './components/DashboardCalendarTab';
import DashboardSpecialDaysTab from './components/DashboardSpecialDaysTab';
import DashboardAppSalesTab from './components/DashboardAppSalesTab';
import { getSaudiNow } from '../../utils/saudiDate';

const DASHBOARD_TABS = [
  { id: 'overview',     labelKey: 'dashboardOverview'     },
  { id: 'calendar',    labelKey: 'dashboardCalendar'     },
  { id: 'specialDays', labelKey: 'dashboardSpecialDays'  },
  { id: 'appSales',    labelKey: 'dashboardAppSales'     },
];
const DASHBOARD_TAB_IDS = DASHBOARD_TABS.map((tab) => tab.id);

const MONTH_NAMES_EN = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

export default function DashboardScreen() {
  const { t } = useTranslation();
  const { activeCompanyId } = useApp();
  const now = getSaudiNow();
  const [activeTab, setActiveTab] = useTabSearchParam(DASHBOARD_TAB_IDS, 'overview');
  const [year, setYear]                   = useState(now.year);
  const [selectedMonth, setSelectedMonth] = useState(String(now.month));
  const selectedMonthNumber = selectedMonth ? Number(selectedMonth) : null;

  const filter = useMemo(() => ({
    year,
    selectedMonth: selectedMonthNumber,
    label: selectedMonthNumber
      ? `${MONTH_NAMES_EN[selectedMonthNumber - 1]} ${year}`
      : `${year}`,
  }), [year, selectedMonthNumber]);

  const dashboardTabItems = useMemo(
    () => DASHBOARD_TABS.map((tab) => ({ id: tab.id, label: t(tab.labelKey) })),
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
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[12px] text-noorix-muted">{t('reportYear')}</span>
          <Input type="select" size="sm" value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {[now.year, now.year - 1, now.year - 2].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </Input>
          <span className="text-[12px] text-noorix-muted">{t('reportMonth')}</span>
          <Input type="select" size="sm" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}>
            <option value="">{t('allMonths')}</option>
            {MONTH_NAMES_EN.map((m, i) => (
              <option key={i} value={i + 1}>{m}</option>
            ))}
          </Input>
        </div>
      </div>

      <ScreenTabs
        items={dashboardTabItems}
        value={activeTab}
        onChange={setActiveTab}
        contentClassName="p-4 nx-tab-content"
      >
        {activeTab === 'overview'    && <DashboardOverviewTab    companyId={activeCompanyId} year={year} selectedMonth={selectedMonthNumber} filter={filter} />}
        {activeTab === 'calendar'    && <DashboardCalendarTab    companyId={activeCompanyId} year={year} selectedMonth={selectedMonthNumber} filter={filter} />}
        {activeTab === 'specialDays' && <DashboardSpecialDaysTab companyId={activeCompanyId} year={year} selectedMonth={selectedMonthNumber} />}
        {activeTab === 'appSales'    && <DashboardAppSalesTab    companyId={activeCompanyId} year={year} filter={filter} />}
      </ScreenTabs>
    </ScreenShell>
  );
}
