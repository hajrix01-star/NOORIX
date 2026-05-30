/**
 * Segmented sub-tabs inside an HR main section (people / payroll / tools).
 */
import React, { useMemo } from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import {
  HR_PAYROLL_TAB_IDS,
  HR_PEOPLE_TAB_IDS,
  HR_TOOLS_TAB_IDS,
  type HrSectionId,
  type HrSubTabId,
} from '../hrScreenNavigation';
import { HR_WORKSPACE_BODY_CLASS } from '../hrWorkspaceLayout';
import StaffListScreen from '../StaffListScreen';
import PayrollTab from '../tabs/PayrollTab';
import LeaveTab from '../tabs/LeaveTab';
import AdvancesTab from '../tabs/AdvancesTab';
import ResidencyTab from '../tabs/ResidencyTab';
import SalaryCalcTab from '../tabs/SalaryCalcTab';
import EOSCalcTab from '../tabs/EOSCalcTab';
import HrPrintDocumentsTab from '../tabs/HrPrintDocumentsTab';
import { HrSegmentedControl } from './HrSegmentedControl';

const PEOPLE_CONFIG = [
  { id: 'list', labelKey: 'hrSubTabEmployees', shortLabelKey: 'hrSubTabEmployeesShort' },
  { id: 'leave', labelKey: 'hrTabLeave', shortLabelKey: 'hrSubTabLeaveShort' },
  { id: 'residency', labelKey: 'hrTabResidency', shortLabelKey: 'hrSubTabResidencyShort' },
] as const;

const PAYROLL_CONFIG = [
  { id: 'runs', labelKey: 'hrTabPayroll', shortLabelKey: 'hrSubTabPayrollRunsShort' },
  { id: 'advances', labelKey: 'hrTabAdvances', shortLabelKey: 'hrSubTabAdvancesShort' },
] as const;

const TOOLS_CONFIG = [
  { id: 'salary-calc', labelKey: 'hrTabSalaryCalc', shortLabelKey: 'hrSubTabSalaryCalcShort' },
  { id: 'eos-calc', labelKey: 'hrTabEOSCalc', shortLabelKey: 'hrSubTabEosShort' },
  { id: 'print', labelKey: 'hrTabPrintDocs', shortLabelKey: 'hrSubTabPrintShort' },
] as const;

const CONFIG_BY_SECTION: Record<
  HrSectionId,
  readonly { id: string; labelKey: string; shortLabelKey: string }[]
> = {
  people: PEOPLE_CONFIG,
  payroll: PAYROLL_CONFIG,
  tools: TOOLS_CONFIG,
};

const TAB_IDS_BY_SECTION: Record<HrSectionId, readonly string[]> = {
  people: HR_PEOPLE_TAB_IDS,
  payroll: HR_PAYROLL_TAB_IDS,
  tools: HR_TOOLS_TAB_IDS,
};

type HrSectionSubTabsProps = {
  section: HrSectionId;
  tab: HrSubTabId;
  onTabChange: (id: HrSubTabId) => void;
};

function buildTabItems(
  config: readonly { id: string; labelKey: string; shortLabelKey: string }[],
  t: (key: string) => string,
) {
  return config.map((row) => {
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
  });
}

export function HrSectionSubTabs({ section, tab, onTabChange }: HrSectionSubTabsProps) {
  const { t } = useTranslation();
  const config = CONFIG_BY_SECTION[section];

  const items = useMemo(() => buildTabItems(config, t), [config, t]);

  const activeTab = (TAB_IDS_BY_SECTION[section] as readonly string[]).includes(tab)
    ? tab
    : TAB_IDS_BY_SECTION[section][0];

  return (
    <HrSegmentedControl
      items={items}
      value={activeTab}
      onChange={(id) => onTabChange(id as HrSubTabId)}
      contentClassName={HR_WORKSPACE_BODY_CLASS}
    >
      {section === 'people' && activeTab === 'list' && <StaffListScreen embedded />}
      {section === 'people' && activeTab === 'leave' && <LeaveTab embedded />}
      {section === 'people' && activeTab === 'residency' && <ResidencyTab embedded />}
      {section === 'payroll' && activeTab === 'runs' && <PayrollTab embedded />}
      {section === 'payroll' && activeTab === 'advances' && <AdvancesTab embedded />}
      {section === 'tools' && activeTab === 'salary-calc' && <SalaryCalcTab />}
      {section === 'tools' && activeTab === 'eos-calc' && <EOSCalcTab />}
      {section === 'tools' && activeTab === 'print' && <HrPrintDocumentsTab />}
    </HrSegmentedControl>
  );
}
