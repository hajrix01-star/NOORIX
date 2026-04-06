/**
 * DashboardScreen — لوحة التحكم الرئيسية مع تبويبات (نظرة عامة، تقويم، مبيعات التطبيق)
 */
import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { useTranslation } from '../../i18n/useTranslation';
import { Input, Button } from '../../ui';
import DashboardOverviewTab from './components/DashboardOverviewTab';
import DashboardCalendarTab from './components/DashboardCalendarTab';
import DashboardSpecialDaysTab from './components/DashboardSpecialDaysTab';
import DashboardAppSalesTab from './components/DashboardAppSalesTab';

const DASHBOARD_TABS = [
  { id: 'overview',     labelKey: 'dashboardOverview'     },
  { id: 'calendar',    labelKey: 'dashboardCalendar'     },
  { id: 'specialDays', labelKey: 'dashboardSpecialDays'  },
  { id: 'appSales',    labelKey: 'dashboardAppSales'     },
];

const MONTH_NAMES_EN = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

function getSaudiNow() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Riyadh', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const m = parts.reduce((a, p) => (p.type !== 'literal' ? { ...a, [p.type]: p.value } : a), {});
  return { year: parseInt(m.year, 10), month: parseInt(m.month, 10), day: parseInt(m.day, 10) };
}

export default function DashboardScreen() {
  const { t } = useTranslation();
  const { activeCompanyId } = useApp();
  const now = getSaudiNow();
  const [activeTab, setActiveTab]         = useState('overview');
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

  return (
    <div className="nx-screen">
      {/* هيدر: عنوان + فلتر السنة/الشهر */}
      <div className="nx-page-header">
        <div className="nx-page-header__titles">
          <h1 className="nx-page-title">{t('dashboard')}</h1>
          <p className="nx-page-desc">{t('dashboardDesc')}</p>
        </div>

        <div className="nx-filter-controls">
          <label className="nx-filter-label">{t('reportYear')}</label>
          <Input
            type="select"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          >
            {[now.year, now.year - 1, now.year - 2].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </Input>

          <label className="nx-filter-label">{t('reportMonth')}</label>
          <Input
            type="select"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
          >
            <option value="">{t('allMonths')}</option>
            {MONTH_NAMES_EN.map((m, i) => (
              <option key={i} value={i + 1}>{m}</option>
            ))}
          </Input>
        </div>
      </div>

      {/* بطاقة التبويبات */}
      <div className="noorix-surface-card nx-overflow-hidden" style={{ padding: 0 }}>
        <div className="nx-tab-bar">
          {DASHBOARD_TABS.map((tab) => (
            <Button
              key={tab.id}
              type="button"
              className={`nx-tab-btn${activeTab === tab.id ? ' nx-tab-btn--active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {t(tab.labelKey)}
            </Button>
          ))}
        </div>

        <div className="nx-tab-content">
          {activeTab === 'overview'    && <DashboardOverviewTab    companyId={activeCompanyId} year={year} selectedMonth={selectedMonthNumber} filter={filter} />}
          {activeTab === 'calendar'    && <DashboardCalendarTab    companyId={activeCompanyId} year={year} selectedMonth={selectedMonthNumber} filter={filter} />}
          {activeTab === 'specialDays' && <DashboardSpecialDaysTab companyId={activeCompanyId} year={year} selectedMonth={selectedMonthNumber} />}
          {activeTab === 'appSales'    && <DashboardAppSalesTab    companyId={activeCompanyId} year={year} filter={filter} />}
        </div>
      </div>
    </div>
  );
}
