/**
 * HRMainScreen — الشاشة الرئيسية للموارد البشرية
 */
import React, { useMemo } from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import { useApp } from '../../context/AppContext';
import { useTabSearchParam } from '../../hooks/useTabSearchParam';
import { ScreenShell, ScreenTabs } from '../../ui';
import { useEmployees } from '../../hooks/useEmployees';
import { useCustomAllowances } from '../../hooks/useCustomAllowances';
import { useHrDashboardSummary } from '../../hooks/useHrDashboardSummary';
import { roundMoney2 } from '../../utils/moneyInput';
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

const HR_TAB_IDS = TABS.map((tab: any) => tab.id);

export default function HRMainScreen() {
  const { t } = useTranslation();
  const { activeCompanyId } = useApp();
  const companyId = activeCompanyId ?? '';
  const [activeTab, setActiveTab] = useTabSearchParam(HR_TAB_IDS, 'employees');

  // ─── بيانات الموظفين (مطلوبة للتبويبات + حساب الرواتب) ───────────
  const { employees, isLoading: empLoading } = useEmployees(companyId, { includeTerminated: true, fetchEnabled: !!companyId });
  const { allowances: customAllowances = [] } = useCustomAllowances(companyId);

  // ─── ملخص HR الموحّد: إجازات + إقامات + سلف في طلب واحد ──────────
  const { data: hrSummary, isLoading: summaryLoading } = useHrDashboardSummary(companyId);

  const allowanceTotals = useMemo(() => {
    const map = new Map();
    for (const row of customAllowances) {
      const employeeId = row.employeeId;
      if (!employeeId) continue;
      const next = (map.get(employeeId) || 0) + (Number(row.amount) || 0);
      map.set(employeeId, roundMoney2(next));
    }
    return map;
  }, [customAllowances]);

  const activeEmployees = employees.filter((e: any) => e.status === 'active');
  const terminatedCount = employees.filter((e: any) => e.status === 'terminated').length;
  const activeCount = activeEmployees.length;

  const monthlyPayrollTotal = useMemo(
    () => roundMoney2(
      activeEmployees.reduce(
        (sum: any, emp: any) => sum + totalSalary(emp, allowanceTotals.get(emp.id) || 0),
        0,
      ),
    ),
    [activeEmployees, allowanceTotals],
  );

  const hrTabItems = useMemo(
    () => TABS.map((tab: any) => ({ id: tab.id, label: t(tab.labelKey) })),
    [t],
  );

  // skeleton يُعرض حتى تكتمل بيانات الموظفين والملخص معاً
  const cardLoading = empLoading || summaryLoading;

  return (
    <ScreenShell>

      <h1 className="text-[20px] font-bold text-noorix-text m-0">{t('staffTitle')}</h1>

      {companyId && (
        <HRSummaryCard
          isLoading={cardLoading}
          activeCount={activeCount}
          terminatedCount={terminatedCount}
          monthlyPayrollTotal={monthlyPayrollTotal}
          expiringResidencyCount={hrSummary.expiringResidenciesCount}
          registeredLeavesCount={hrSummary.leavesCount}
          outstandingAdvancesCount={hrSummary.outstandingAdvancesCount}
          outstandingAdvancesAmount={hrSummary.outstandingAdvancesAmount}
        />
      )}

      <ScreenTabs
        items={hrTabItems}
        value={activeTab}
        onChange={setActiveTab}
        contentClassName="nx-tab-content min-h-[200px]"
      >
        {activeTab === 'employees'  && <StaffListScreen embedded />}
        {activeTab === 'payroll'    && <PayrollTab />}
        {activeTab === 'leave'      && <LeaveTab />}
        {activeTab === 'advances'   && <AdvancesTab />}
        {activeTab === 'residency'  && <ResidencyTab />}
        {activeTab === 'salaryCalc' && <SalaryCalcTab />}
        {activeTab === 'eosCalc'    && <EOSCalcTab />}
        {activeTab === 'printDocs'  && <HrPrintDocumentsTab />}
      </ScreenTabs>

    </ScreenShell>
  );
}
