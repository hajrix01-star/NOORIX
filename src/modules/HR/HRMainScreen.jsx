/**
 * HRMainScreen — الشاشة الرئيسية للموارد البشرية
 */
import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from '../../i18n/useTranslation';
import { useApp } from '../../context/AppContext';
import { useTabSearchParam } from '../../hooks/useTabSearchParam';
import { ScreenShell, ScreenTabs } from '../../ui';
import { useEmployees } from '../../hooks/useEmployees';
import { useCustomAllowances } from '../../hooks/useCustomAllowances';
import { getResidencies, getLeaves, getInvoices } from '../../services/api';
import { totalSalary } from './utils/employeeSalaryMath';
import HRSummaryCard from './components/HRSummaryCard';
import StaffListScreen from './StaffListScreen';
import PayrollTab from './tabs/PayrollTab';
import LeaveTab from './tabs/LeaveTab';
import AdvancesTab from './tabs/AdvancesTab';
import ResidencyTab from './tabs/ResidencyTab';
import SalaryCalcTab from './tabs/SalaryCalcTab';
import EOSCalcTab from './tabs/EOSCalcTab';
import HrPrintDocumentsTab from './tabs/HrPrintDocumentsTab';

const TABS = [
  { id: 'employees',  labelKey: 'hrTabEmployees'  },
  { id: 'payroll',    labelKey: 'hrTabPayroll'     },
  { id: 'leave',      labelKey: 'hrTabLeave'       },
  { id: 'advances',   labelKey: 'hrTabAdvances'    },
  { id: 'residency',  labelKey: 'hrTabResidency'   },
  { id: 'salaryCalc', labelKey: 'hrTabSalaryCalc'  },
  { id: 'eosCalc',    labelKey: 'hrTabEOSCalc'     },
  { id: 'printDocs',  labelKey: 'hrTabPrintDocs'   },
];

const EXPIRY_DAYS = 90;
const CURRENT_YEAR = new Date().getFullYear();
const HR_TAB_IDS = TABS.map((tab) => tab.id);

export default function HRMainScreen() {
  const { t } = useTranslation();
  const { activeCompanyId } = useApp();
  const companyId = activeCompanyId ?? '';
  const [activeTab, setActiveTab] = useTabSearchParam(HR_TAB_IDS, 'employees');

  const { employees, isLoading: empLoading } = useEmployees(companyId, { includeTerminated: true, fetchEnabled: !!companyId });
  const { allowances: customAllowances = [] } = useCustomAllowances(companyId);

  const allowanceTotals = useMemo(() => {
    const map = new Map();
    for (const row of customAllowances) {
      const employeeId = row.employeeId;
      if (!employeeId) continue;
      map.set(employeeId, (map.get(employeeId) || 0) + (Number(row.amount) || 0));
    }
    return map;
  }, [customAllowances]);

  const { data: residencies = [] } = useQuery({
    queryKey: ['residencies', companyId],
    queryFn: async () => {
      const res = await getResidencies(companyId);
      if (!res?.success) return [];
      return Array.isArray(res.data) ? res.data : (res.data?.items ?? []);
    },
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000,
  });

  const { data: leavesData = [] } = useQuery({
    queryKey: ['leaves', companyId, CURRENT_YEAR],
    queryFn: async () => {
      const res = await getLeaves(companyId, null, CURRENT_YEAR);
      if (!res?.success) return [];
      const d = res.data;
      return Array.isArray(d) ? d : (d?.items ?? []);
    },
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000,
  });

  const { data: advancesData = [] } = useQuery({
    queryKey: ['invoices', companyId, 'advance'],
    queryFn: async () => {
      const res = await getInvoices(companyId, null, null, 1, 500);
      if (!res?.success) return [];
      const items = res.data?.items ?? [];
      return items.filter((inv) => inv.kind === 'advance').map((i) => ({
        ...i,
        settlementStatus:
          i.status === 'cancelled'
            ? 'cancelled'
            : Number(i.settledAmount ?? 0) >= Number(i.totalAmount ?? 0)
              ? 'settled'
              : 'outstanding',
        remainingAmount: Math.max(0, Number(i.totalAmount ?? 0) - Number(i.settledAmount ?? 0)),
      }));
    },
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000,
  });

  const activeEmployees = employees.filter((e) => e.status === 'active');
  const terminatedCount = employees.filter((e) => e.status === 'terminated').length;
  const activeCount = activeEmployees.length;

  /** مطابق لعمود «إجمالي الراتب» في قائمة الموظفين: أساسي + بدلات + مخصصة + تقدير الأوفر تايم */
  const monthlyPayrollTotal = useMemo(
    () => activeEmployees.reduce(
      (sum, emp) => sum + totalSalary(emp, allowanceTotals.get(emp.id) || 0),
      0,
    ),
    [activeEmployees, allowanceTotals],
  );

  const expiringCount = residencies.filter((r) => {
    const exp = new Date(r.expiryDate);
    const now = new Date();
    const diff = (exp - now) / (24 * 60 * 60 * 1000);
    return diff >= 0 && diff <= EXPIRY_DAYS;
  }).length;

  const registeredLeavesCount = leavesData.length;

  const outstandingAdvances = advancesData.filter(
    (a) => a.status !== 'cancelled' && a.settlementStatus !== 'settled',
  );
  const outstandingAdvancesCount = outstandingAdvances.length;
  const outstandingAdvancesAmount = outstandingAdvances.reduce((s, a) => s + a.remainingAmount, 0);

  const hrTabItems = useMemo(
    () => TABS.map((tab) => ({ id: tab.id, label: t(tab.labelKey) })),
    [t],
  );

  return (
    <ScreenShell>

      {/* ── ترويسة ── */}
      <h1 className="text-[20px] font-bold text-noorix-text m-0">{t('staffTitle')}</h1>

      {/* ── كرت الملخص الشامل ── */}
      {companyId && (
        <HRSummaryCard
          isLoading={empLoading}
          activeCount={activeCount}
          terminatedCount={terminatedCount}
          monthlyPayrollTotal={monthlyPayrollTotal}
          expiringResidencyCount={expiringCount}
          registeredLeavesCount={registeredLeavesCount}
          outstandingAdvancesCount={outstandingAdvancesCount}
          outstandingAdvancesAmount={outstandingAdvancesAmount}
        />
      )}

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
        {activeTab === 'printDocs' && <HrPrintDocumentsTab />}
      </ScreenTabs>

    </ScreenShell>
  );
}
