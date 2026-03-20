/**
 * HRMainScreen — الشاشة الرئيسية للموارد البشرية
 */
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from '../../i18n/useTranslation';
import { useApp } from '../../context/AppContext';
import { getEmployees, getResidencies } from '../../services/api';
import StaffListScreen from './StaffListScreen';
import PayrollTab from './tabs/PayrollTab';
import LeaveTab from './tabs/LeaveTab';
import AdvancesTab from './tabs/AdvancesTab';
import ResidencyTab from './tabs/ResidencyTab';
import SalaryCalcTab from './tabs/SalaryCalcTab';
import EOSCalcTab from './tabs/EOSCalcTab';

const TABS = [
  { id: 'employees',  labelKey: 'hrTabEmployees',   icon: '👤' },
  { id: 'payroll',    labelKey: 'hrTabPayroll',      icon: '💰' },
  { id: 'leave',      labelKey: 'hrTabLeave',        icon: '🏖' },
  { id: 'advances',   labelKey: 'hrTabAdvances',     icon: '💳' },
  { id: 'residency',  labelKey: 'hrTabResidency',    icon: '🪪' },
  { id: 'salaryCalc', labelKey: 'hrTabSalaryCalc',   icon: '🧮' },
  { id: 'eosCalc',    labelKey: 'hrTabEOSCalc',      icon: '📋' },
];

const EXPIRY_DAYS = 90;

export default function HRMainScreen() {
  const { t } = useTranslation();
  const { activeCompanyId } = useApp();
  const companyId = activeCompanyId ?? '';
  const [activeTab, setActiveTab] = useState('employees');

  const { data: employees = [] } = useQuery({
    queryKey: ['employees', companyId, false],
    queryFn: async () => {
      const res = await getEmployees(companyId, false);
      if (!res?.success) return [];
      return Array.isArray(res.data) ? res.data : [];
    },
    enabled: !!companyId,
  });

  const { data: residencies = [] } = useQuery({
    queryKey: ['residencies', companyId],
    queryFn: async () => {
      const res = await getResidencies(companyId);
      if (!res?.success) return [];
      return Array.isArray(res.data) ? res.data : (res.data?.items ?? []);
    },
    enabled: !!companyId,
  });

  const activeCount = employees.filter((e) => e.status === 'active').length;
  const expiringCount = residencies.filter((r) => {
    const exp = new Date(r.expiryDate);
    const now = new Date();
    const diff = (exp - now) / (24 * 60 * 60 * 1000);
    return diff >= 0 && diff <= EXPIRY_DAYS;
  }).length;

  return (
    <div style={{ display: 'grid', gap: 16 }}>

      {/* ── ترويسة الصفحة ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>{t('staffTitle')}</h1>
          <p style={{ marginTop: 4, fontSize: 13, color: 'var(--noorix-text-muted)', margin: '4px 0 0' }}>
            {t('staffDesc')}
          </p>
        </div>
        {companyId && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <div className="noorix-stat-card noorix-stat-card--green" style={{ padding: '10px 16px', minWidth: 110 }}>
              <div className="noorix-stat-card__stripe" />
              <div className="noorix-stat-card__body">
                <div className="noorix-stat-card__label">{t('hrStatsActive')}</div>
                <div className="noorix-stat-card__value" style={{ fontSize: 22 }}>{activeCount}</div>
              </div>
            </div>
            {expiringCount > 0 && (
              <div className="noorix-stat-card noorix-stat-card--amber" style={{ padding: '10px 16px', minWidth: 130 }}>
                <div className="noorix-stat-card__stripe" />
                <div className="noorix-stat-card__body">
                  <div className="noorix-stat-card__label">{t('hrStatsResidencyExpiring')}</div>
                  <div className="noorix-stat-card__value" style={{ fontSize: 22 }}>{expiringCount}</div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── شريط التبويبات — مستقل خارج البطاقة لضمان التمرير الأفقي ── */}
      <div style={{
        background: 'var(--noorix-bg-surface)',
        border: '1px solid var(--noorix-border)',
        borderRadius: 12,
        padding: '4px',
        overflowX: 'auto',
        overflowY: 'visible',
        WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
      }}>
        <div style={{ display: 'flex', gap: 2, width: 'max-content', minWidth: '100%' }}>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '9px 16px',
                borderRadius: 9,
                border: 'none',
                background: activeTab === tab.id ? 'var(--noorix-accent-green)' : 'transparent',
                color: activeTab === tab.id ? '#fff' : 'var(--noorix-text-muted)',
                fontWeight: activeTab === tab.id ? 700 : 500,
                fontSize: 13,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                transition: 'background 150ms, color 150ms',
                fontFamily: 'var(--noorix-font-primary)',
              }}
            >
              {t(tab.labelKey)}
            </button>
          ))}
        </div>
      </div>

      {/* ── محتوى التبويب ── */}
      <div className="noorix-surface-card" style={{ padding: 20, minHeight: 200 }}>
        {activeTab === 'employees' && <StaffListScreen embedded />}
        {activeTab === 'payroll'   && <PayrollTab />}
        {activeTab === 'leave'     && <LeaveTab />}
        {activeTab === 'advances'  && <AdvancesTab />}
        {activeTab === 'residency' && <ResidencyTab />}
        {activeTab === 'salaryCalc' && <SalaryCalcTab />}
        {activeTab === 'eosCalc'   && <EOSCalcTab />}
      </div>

    </div>
  );
}
