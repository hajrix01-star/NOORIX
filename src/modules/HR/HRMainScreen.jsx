/**
 * HRMainScreen — الشاشة الرئيسية للموارد البشرية
 */
import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from '../../i18n/useTranslation';
import { useApp } from '../../context/AppContext';
import { ScreenTabs, ScreenShell } from '../../ui';
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

      {/* ── ترويسة الصفحة — على الجوال: العنوان ثم الكروت بعرض تلقائي ── */}
      <div className="nx-page-header flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-[20px] font-bold text-noorix-text m-0">{t('staffTitle')}</h1>
        </div>
        {companyId && (
          <div className="flex flex-wrap gap-2 w-full sm:w-auto sm:justify-end">
            <div className="noorix-stat-card noorix-stat-card--green px-4 py-2 w-auto min-w-[140px] shrink-0">
              <div className="noorix-stat-card__stripe" />
              <div className="noorix-stat-card__body">
                <div className="noorix-stat-card__label">{t('hrStatsActive')}</div>
                <div className="noorix-stat-card__value text-[22px]">{activeCount}</div>
              </div>
            </div>
            {expiringCount > 0 && (
              <div className="noorix-stat-card noorix-stat-card--amber px-4 py-2 w-auto min-w-[140px] shrink-0">
                <div className="noorix-stat-card__stripe" />
                <div className="noorix-stat-card__body">
                  <div className="noorix-stat-card__label">{t('hrStatsResidencyExpiring')}</div>
                  <div className="noorix-stat-card__value text-[22px]">{expiringCount}</div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── تبويبات + محتوى داخل كرت واحد (مثل المصاريف): underline + تمرير أفقي على الجوال ── */}
      <div className="noorix-surface-card overflow-hidden p-0">
        <ScreenTabs
          variant="underline"
          items={hrTabItems}
          value={activeTab}
          onChange={setActiveTab}
        />
        <div className="nx-tab-content min-h-[200px]">
          {activeTab === 'employees' && <StaffListScreen embedded />}
          {activeTab === 'payroll'   && <PayrollTab />}
          {activeTab === 'leave'     && <LeaveTab />}
          {activeTab === 'advances'  && <AdvancesTab />}
          {activeTab === 'residency' && <ResidencyTab />}
          {activeTab === 'salaryCalc' && <SalaryCalcTab />}
          {activeTab === 'eosCalc'   && <EOSCalcTab />}
        </div>
      </div>

    </ScreenShell>
  );
}
