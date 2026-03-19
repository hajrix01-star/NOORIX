/**
 * DashboardScreen — لوحة التحكم الرئيسية مع تبويبات (نظرة عامة، تقويم، مبيعات التطبيق)
 */
import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { useTranslation } from '../../i18n/useTranslation';
import DashboardOverviewTab from './components/DashboardOverviewTab';
import DashboardCalendarTab from './components/DashboardCalendarTab';
import DashboardSpecialDaysTab from './components/DashboardSpecialDaysTab';
import DashboardAppSalesTab from './components/DashboardAppSalesTab';

const DASHBOARD_TABS = [
  { id: 'overview', labelKey: 'dashboardOverview' },
  { id: 'calendar', labelKey: 'dashboardCalendar' },
  { id: 'specialDays', labelKey: 'dashboardSpecialDays' },
  { id: 'appSales', labelKey: 'dashboardAppSales' },
];

const MONTH_NAMES_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function getSaudiNow() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Riyadh', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const m = parts.reduce((a, p) => (p.type !== 'literal' ? { ...a, [p.type]: p.value } : a), {});
  return { year: parseInt(m.year, 10), month: parseInt(m.month, 10), day: parseInt(m.day, 10) };
}

export default function DashboardScreen() {
  const { t } = useTranslation();
  const { activeCompanyId } = useApp();
  const now = getSaudiNow();
  const [activeTab, setActiveTab] = useState('overview');
  const [year, setYear] = useState(now.year);
  const [selectedMonth, setSelectedMonth] = useState(String(now.month));
  const selectedMonthNumber = selectedMonth ? Number(selectedMonth) : null;

  const filter = useMemo(() => ({
    year,
    selectedMonth: selectedMonthNumber,
    label: selectedMonthNumber ? `${MONTH_NAMES_EN[selectedMonthNumber - 1]} ${year}` : `${year}`,
  }), [year, selectedMonthNumber]);

  return (
    <div style={{ display: 'grid', gap: 18, padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>{t('dashboard')}</h1>
          <p style={{ marginTop: 6, color: 'var(--noorix-text-muted)', maxWidth: 900 }}>{t('dashboardDesc')}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <label style={{ fontSize: 13, color: 'var(--noorix-text-muted)' }}>{t('reportYear')}</label>
          <select value={year} onChange={(e) => setYear(Number(e.target.value))} style={{ padding: '9px 12px', borderRadius: 10, border: '1px solid var(--noorix-border)', background: 'var(--noorix-bg-surface)', color: 'var(--noorix-text)' }}>
            {[now.year, now.year - 1, now.year - 2].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <label style={{ fontSize: 13, color: 'var(--noorix-text-muted)' }}>{t('reportMonth')}</label>
          <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} style={{ padding: '9px 12px', borderRadius: 10, border: '1px solid var(--noorix-border)', background: 'var(--noorix-bg-surface)', color: 'var(--noorix-text)', minWidth: 120 }}>
            <option value="">{t('allMonths')}</option>
            {MONTH_NAMES_EN.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
        </div>
      </div>

      <div className="noorix-surface-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--noorix-border)', flexWrap: 'wrap' }}>
          {DASHBOARD_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className="noorix-btn-nav"
              onClick={() => setActiveTab(tab.id)}
              style={{
                margin: 0,
                borderRadius: 0,
                border: 'none',
                borderBottom: activeTab === tab.id ? '2px solid var(--noorix-accent-blue)' : '2px solid transparent',
                background: activeTab === tab.id ? 'rgba(37,99,235,0.07)' : 'transparent',
                color: activeTab === tab.id ? 'var(--noorix-accent-blue)' : 'var(--noorix-text-muted)',
                fontWeight: activeTab === tab.id ? 700 : 500,
              }}
            >
              {t(tab.labelKey)}
            </button>
          ))}
        </div>
        <div style={{ padding: 24 }}>
          {activeTab === 'overview' && <DashboardOverviewTab companyId={activeCompanyId} year={year} selectedMonth={selectedMonthNumber} filter={filter} />}
          {activeTab === 'calendar' && <DashboardCalendarTab companyId={activeCompanyId} year={year} selectedMonth={selectedMonthNumber} filter={filter} />}
          {activeTab === 'specialDays' && <DashboardSpecialDaysTab companyId={activeCompanyId} year={year} selectedMonth={selectedMonthNumber} />}
          {activeTab === 'appSales' && <DashboardAppSalesTab companyId={activeCompanyId} year={year} filter={filter} />}
        </div>
      </div>
    </div>
  );
}
