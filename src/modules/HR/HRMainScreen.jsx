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
  { id: 'employees', labelKey: 'hrTabEmployees' },
  { id: 'payroll', labelKey: 'hrTabPayroll' },
  { id: 'leave', labelKey: 'hrTabLeave' },
  { id: 'advances', labelKey: 'hrTabAdvances' },
  { id: 'residency', labelKey: 'hrTabResidency' },
  { id: 'salaryCalc', labelKey: 'hrTabSalaryCalc' },
  { id: 'eosCalc', labelKey: 'hrTabEOSCalc' },
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
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>{t('staffTitle')}</h1>
        <p style={{ marginTop: 4, fontSize: 13, color: 'var(--noorix-text-muted)' }}>
          {t('staffDesc')}
        </p>
      </div>

      {companyId && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <div className="noorix-stat-card noorix-stat-card--green">
            <div className="noorix-stat-card__stripe" />
            <div className="noorix-stat-card__body">
              <div className="noorix-stat-card__label">{t('hrStatsActive')}</div>
              <div className="noorix-stat-card__value">{activeCount}</div>
            </div>
          </div>
          {expiringCount > 0 && (
            <div className="noorix-stat-card noorix-stat-card--amber">
              <div className="noorix-stat-card__stripe" />
              <div className="noorix-stat-card__body">
                <div className="noorix-stat-card__label">{t('hrStatsResidencyExpiring')}</div>
                <div className="noorix-stat-card__value">{expiringCount}</div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="noorix-surface-card">
        <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--noorix-border)', overflowX: 'auto', flexShrink: 0 }}>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className="noorix-btn-nav"
              onClick={() => setActiveTab(tab.id)}
              style={{
                margin: 0, borderRadius: 0, border: 'none',
                borderBottom: activeTab === tab.id ? '2px solid var(--noorix-accent-green)' : '2px solid transparent',
                background: activeTab === tab.id ? 'rgba(22,163,74,0.07)' : 'transparent',
                color: activeTab === tab.id ? 'var(--noorix-accent-green)' : 'var(--noorix-text-muted)',
                fontWeight: activeTab === tab.id ? 700 : 500,
                whiteSpace: 'nowrap', flexShrink: 0,
              }}
            >
              {t(tab.labelKey)}
            </button>
          ))}
        </div>

        <div style={{ padding: 20 }}>
          {activeTab === 'employees' && <StaffListScreen embedded />}
          {activeTab === 'payroll' && <PayrollTab />}
          {activeTab === 'leave' && <LeaveTab />}
          {activeTab === 'advances' && <AdvancesTab />}
          {activeTab === 'residency' && <ResidencyTab />}
          {activeTab === 'salaryCalc' && <SalaryCalcTab />}
          {activeTab === 'eosCalc' && <EOSCalcTab />}
        </div>
      </div>
    </div>
  );
}
