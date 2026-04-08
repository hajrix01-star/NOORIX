/**
 * HRMainScreen — الشاشة الرئيسية للموارد البشرية
 */
import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from '../../i18n/useTranslation';
import { useApp } from '../../context/AppContext';
import { ScreenShell, ScreenTabs } from '../../ui';
import { useEmployees } from '../../hooks/useEmployees';
import { getResidencies } from '../../services/api';
import StaffListScreen from './StaffListScreen';
import PayrollTab from './tabs/PayrollTab';
import LeaveTab from './tabs/LeaveTab';
import AdvancesTab from './tabs/AdvancesTab';
import ResidencyTab from './tabs/ResidencyTab';
import SalaryCalcTab from './tabs/SalaryCalcTab';
import EOSCalcTab from './tabs/EOSCalcTab';

const TABS = [
  { id: 'employees',  labelKey: 'hrTabEmployees'  },
  { id: 'payroll',    labelKey: 'hrTabPayroll'     },
  { id: 'leave',      labelKey: 'hrTabLeave'       },
  { id: 'advances',   labelKey: 'hrTabAdvances'    },
  { id: 'residency',  labelKey: 'hrTabResidency'   },
  { id: 'salaryCalc', labelKey: 'hrTabSalaryCalc'  },
  { id: 'eosCalc',    labelKey: 'hrTabEOSCalc'     },
];

const EXPIRY_DAYS = 90;

export default function HRMainScreen() {
  const { t } = useTranslation();
  const { activeCompanyId } = useApp();
  const companyId = activeCompanyId ?? '';
  const [activeTab, setActiveTab] = useState('employees');

  const { employees } = useEmployees(companyId, { includeTerminated: false, fetchEnabled: !!companyId });

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

  const hrTabItems = useMemo(
    () => TABS.map((tab) => ({ id: tab.id, label: t(tab.labelKey) })),
    [t],
  );

  return (
    <ScreenShell>

      {/* ── ترويسة — شارات مدمجة بارتفاع السطر لتجنب تشتيت بصري عن شريط أدوات التبويبات ── */}
      <div className="nx-page-header flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <h1 className="text-[20px] font-bold text-noorix-text m-0 min-w-0">{t('staffTitle')}</h1>
        {companyId && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-lg border border-noorix-border bg-noorix-bg-muted px-3 py-1.5 text-[13px]">
              <span className="text-noorix-muted shrink-0">{t('hrStatsActive')}</span>
              <span className="font-bold tabular-nums text-noorix-green">{activeCount}</span>
            </span>
            {expiringCount > 0 && (
              <span className="inline-flex items-center gap-2 rounded-lg border border-noorix-amber/40 bg-noorix-amber/10 px-3 py-1.5 text-[13px] text-noorix-amber">
                <span className="shrink-0">{t('hrStatsResidencyExpiring')}</span>
                <span className="font-bold tabular-nums">{expiringCount}</span>
              </span>
            )}
          </div>
        )}
      </div>

      <ScreenTabs
        items={hrTabItems}
        value={activeTab}
        onChange={setActiveTab}
        contentClassName="nx-tab-content min-h-[200px]"
      >
        {activeTab === 'employees' && <StaffListScreen embedded />}
        {activeTab === 'payroll'   && <PayrollTab />}
        {activeTab === 'leave'     && <LeaveTab />}
        {activeTab === 'advances'  && <AdvancesTab />}
        {activeTab === 'residency' && <ResidencyTab />}
        {activeTab === 'salaryCalc' && <SalaryCalcTab />}
        {activeTab === 'eosCalc'   && <EOSCalcTab />}
      </ScreenTabs>

    </ScreenShell>
  );
}
