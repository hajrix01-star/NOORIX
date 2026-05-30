/**
 * HRMainScreen — الشاشة الرئيسية للموارد البشرية
 * 3 أقسام رئيسية + تبويبات فرعية (segmented): موظفون | رواتب | أدوات الراتب
 */
import React, { useMemo } from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import { useApp } from '../../context/AppContext';
import { useEmployees } from '../../hooks/useEmployees';
import { useCustomAllowances } from '../../hooks/useCustomAllowances';
import { useHrDashboardSummary } from '../../hooks/useHrDashboardSummary';
import { roundMoney2 } from '../../utils/moneyInput';
import { totalSalary } from './utils/employeeSalaryMath';
import HRSummaryCard from './components/HRSummaryCard';
import { HrSectionSubTabs } from './components/HrSectionSubTabs';
import { useHrScreenNavigation } from './hooks/useHrScreenNavigation';
import { HR_SECTION_IDS, type HrSectionId } from './hrScreenNavigation';
import { ScreenShell, ScreenTabs } from '../../ui';

const MAIN_SECTIONS = [
  { id: 'people', labelKey: 'hrSectionPeople', shortLabelKey: 'hrSectionPeopleShort' },
  { id: 'payroll', labelKey: 'hrSectionPayroll', shortLabelKey: 'hrSectionPayrollShort' },
  { id: 'tools', labelKey: 'hrSectionTools', shortLabelKey: 'hrSectionToolsShort' },
] as const;

export default function HRMainScreen() {
  const { t } = useTranslation();
  const { activeCompanyId } = useApp();
  const companyId = activeCompanyId ?? '';
  const { section, tab, setSection, setTab } = useHrScreenNavigation();

  const { employees, isLoading: empLoading } = useEmployees(companyId, {
    includeTerminated: true,
    fetchEnabled: !!companyId,
  });
  const { allowances: customAllowances = [] } = useCustomAllowances(companyId);
  const { data: hrSummary, isLoading: summaryLoading } = useHrDashboardSummary(companyId);

  const allowanceTotals = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of customAllowances) {
      const employeeId = row.employeeId;
      if (!employeeId) continue;
      const next = (map.get(employeeId) || 0) + (Number(row.amount) || 0);
      map.set(employeeId, roundMoney2(next));
    }
    return map;
  }, [customAllowances]);

  const activeEmployees = employees.filter((e: { status?: string }) => e.status === 'active');
  const terminatedCount = employees.filter((e: { status?: string }) => e.status === 'terminated').length;
  const activeCount = activeEmployees.length;

  const monthlyPayrollTotal = useMemo(
    () =>
      roundMoney2(
        activeEmployees.reduce(
          (sum, emp) => sum + totalSalary(emp, allowanceTotals.get(emp.id) || 0),
          0,
        ),
      ),
    [activeEmployees, allowanceTotals],
  );

  const mainTabItems = useMemo(
    () =>
      MAIN_SECTIONS.map((row) => {
        const full = t(row.labelKey);
        const short = t(row.shortLabelKey);
        const label =
          short === full ? (
            full
          ) : (
            <>
              <span className="hidden sm:inline">{full}</span>
              <span className="sm:hidden">{short}</span>
            </>
          );
        return { id: row.id, label };
      }),
    [t],
  );

  const activeSection = (HR_SECTION_IDS as readonly string[]).includes(section)
    ? section
    : 'people';

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
        items={mainTabItems}
        value={activeSection}
        onChange={(id) => setSection(id as HrSectionId)}
        contentClassName="nx-tab-content min-h-[200px]"
        animateContent={false}
      >
        <HrSectionSubTabs section={activeSection} tab={tab} onTabChange={setTab} />
      </ScreenTabs>
    </ScreenShell>
  );
}
