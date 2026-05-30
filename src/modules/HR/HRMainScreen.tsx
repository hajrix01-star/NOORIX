/**
 * HRMainScreen — الشاشة الرئيسية للموارد البشرية
 * 3 أقسام رئيسية + تبويبات فرعية (segmented): موظفون | رواتب | أدوات الراتب
 */
import React, { useCallback, useMemo } from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import { useApp } from '../../context/AppContext';
import { useHrDashboardSummary } from '../../hooks/useHrDashboardSummary';
import HRSummaryCard from './components/HRSummaryCard';
import { HrSectionSubTabs } from './components/HrSectionSubTabs';
import { useHrScreenNavigation } from './hooks/useHrScreenNavigation';
import { HR_SECTION_IDS, type HrScreenLocation, type HrSectionId } from './hrScreenNavigation';
import { HR_WORKSPACE_CONTENT_CLASS } from './hrWorkspaceLayout';
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
  const { section, tab, setSection, setSubTab, navigateHrScreen } = useHrScreenNavigation();

  const handleKpiNavigate = useCallback(
    (loc: HrScreenLocation) => {
      navigateHrScreen(loc);
    },
    [navigateHrScreen],
  );

  const { data: hrSummary, isLoading: summaryLoading } = useHrDashboardSummary(companyId);

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

  return (
    <ScreenShell>
      <h1 className="text-[20px] font-bold text-noorix-text m-0">{t('staffTitle')}</h1>

      {companyId && (
        <HRSummaryCard
          isLoading={summaryLoading}
          activeCount={hrSummary.activeCount}
          terminatedCount={hrSummary.terminatedCount}
          monthlyPayrollTotal={hrSummary.monthlyPayrollTotal}
          expiringResidencyCount={hrSummary.expiringResidenciesCount}
          registeredLeavesCount={hrSummary.leavesCount}
          outstandingAdvancesCount={hrSummary.outstandingAdvancesCount}
          outstandingAdvancesAmount={hrSummary.outstandingAdvancesAmount}
          onNavigate={handleKpiNavigate}
        />
      )}

      <ScreenTabs
        items={mainTabItems}
        value={activeSection}
        onChange={(id) => setSection(id as HrSectionId)}
        contentClassName={HR_WORKSPACE_CONTENT_CLASS}
        animateContent={false}
      >
        <HrSectionSubTabs
          section={activeSection}
          tab={tab}
          onTabChange={(id) => setSubTab(id, activeSection)}
        />
      </ScreenTabs>
    </ScreenShell>
  );
}
