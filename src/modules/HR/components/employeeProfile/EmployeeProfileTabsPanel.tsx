import type { ComponentProps } from 'react';
import type { HrEmployee } from '../../../../types/api';
import { EmployeeProfileBasicInfoCard, EmployeeProfileSalaryCard } from './EmployeeProfileBasicAndSalaryCards';
import { EmployeeProfileCareerSection } from './EmployeeProfileCareerSection';
import { EmployeeProfileFinancialSection } from './EmployeeProfileFinancialSection';
import { EmployeeProfilePayrollSection } from './EmployeeProfilePayrollSection';
import { EmployeeProfileLeaveSection } from './EmployeeProfileLeaveSection';
import { EmployeeProfileAdvancesSection } from './EmployeeProfileAdvancesSection';
import { EmployeeProfileResidencySection } from './EmployeeProfileResidencySection';
import { EmployeeProfileDocumentsSection } from './EmployeeProfileDocumentsSection';
import type { CareerTableRow, FinancialRecordRow, ProfileRecord, SalaryRow } from './employeeProfileModel';

type TranslationFn = (key: string, ...args: unknown[]) => string;

export const EMPLOYEE_PROFILE_TAB_IDS = ['overview', 'financial', 'payroll', 'leave', 'services', 'documents', 'career'] as const;
export type EmployeeProfileTabId = (typeof EMPLOYEE_PROFILE_TAB_IDS)[number];

export function getEmployeeProfileTabLabel(tabId: EmployeeProfileTabId, lang: string, t: TranslationFn) {
  const isArabic = lang === 'ar';
  const labels: Record<EmployeeProfileTabId, { ar: string; en: string }> = {
    overview: { ar: 'نظرة عامة', en: 'Overview' },
    financial: { ar: 'السجل المالي', en: 'Financial record' },
    payroll: { ar: 'مسيرات الرواتب', en: 'Payroll runs' },
    leave: { ar: 'الإجازات', en: 'Leave' },
    services: { ar: 'خدمات الموظف', en: 'Employee services' },
    documents: { ar: 'ملفات الموظف', en: 'Documents' },
    career: { ar: 'سجل الترقيات والزيادات', en: 'Career changes' },
  };
  if (tabId === 'financial') {
    const translated = t('financialRecord');
    if (translated && translated !== 'financialRecord') return translated;
  }
  return isArabic ? labels[tabId].ar : labels[tabId].en;
}

type LeaveRow = ComponentProps<typeof EmployeeProfileLeaveSection>['leaves'][number];
type ResidencyRow = ComponentProps<typeof EmployeeProfileResidencySection>['residencies'][number];
type PayrollItems = ComponentProps<typeof EmployeeProfilePayrollSection>['payrollItems'];
type Documents = ComponentProps<typeof EmployeeProfileDocumentsSection>['documents'];
type Advances = ComponentProps<typeof EmployeeProfileAdvancesSection>['advances'];

type EmployeeProfileTabsPanelProps = {
  t: TranslationFn;
  lang: string;
  activeProfileTab: EmployeeProfileTabId;
  onTabChange: (tabId: EmployeeProfileTabId) => void;
  employee: HrEmployee;
  empStatusMap: Record<string, unknown>;
  salaryRows: SalaryRow[];
  total: number;
  financialRecords: FinancialRecordRow[];
  canEditHrLeave: boolean;
  onOpenResidency: (rowOrId: string | ProfileRecord) => void;
  advances: Advances;
  advanceStatusMap: Record<string, unknown>;
  payrollItems: PayrollItems;
  payrollRunStatusMap: Record<string, unknown>;
  leaves: LeaveRow[];
  leaveProfileStatusMap: Record<string, unknown>;
  onEditLeave: (row: LeaveRow) => void;
  residencies: ResidencyRow[];
  residencyProfileStatusMap: Record<string, unknown>;
  onQuickAddService: (category: string) => void;
  onDeleteService: (row: ResidencyRow) => void;
  documents: Documents;
  uploading: boolean;
  fileInputRef: ComponentProps<typeof EmployeeProfileDocumentsSection>['fileInputRef'];
  onUploadDocument: ComponentProps<typeof EmployeeProfileDocumentsSection>['onFileChange'];
  onPickDocument: () => void;
  onDownloadDocument: ComponentProps<typeof EmployeeProfileDocumentsSection>['onDownload'];
  careerTableRows: CareerTableRow[];
  canShowCareerActions: boolean;
  canRecordCareer: boolean;
  onOpenPromotion: () => void;
  onOpenRaise: () => void;
  onEditRaise: (row: CareerTableRow) => void;
  onDeleteRaise: (row: CareerTableRow) => void;
};

export function EmployeeProfileTabsPanel({
  t,
  lang,
  activeProfileTab,
  onTabChange,
  employee,
  empStatusMap,
  salaryRows,
  total,
  financialRecords,
  canEditHrLeave,
  onOpenResidency,
  advances,
  advanceStatusMap,
  payrollItems,
  payrollRunStatusMap,
  leaves,
  leaveProfileStatusMap,
  onEditLeave,
  residencies,
  residencyProfileStatusMap,
  onQuickAddService,
  onDeleteService,
  documents,
  uploading,
  fileInputRef,
  onUploadDocument,
  onPickDocument,
  onDownloadDocument,
  careerTableRows,
  canShowCareerActions,
  canRecordCareer,
  onOpenPromotion,
  onOpenRaise,
  onEditRaise,
  onDeleteRaise,
}: EmployeeProfileTabsPanelProps) {
  const profileTabs = EMPLOYEE_PROFILE_TAB_IDS.map((tabId) => ({
    id: tabId,
    label: getEmployeeProfileTabLabel(tabId, lang, t),
  }));

  return (
    <>
      <div
        className="employee-profile-tabs"
        role="tablist"
        aria-label={lang === 'ar' ? 'تبويبات ملف الموظف' : 'Employee profile tabs'}
      >
        {profileTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeProfileTab === tab.id}
            className={
              activeProfileTab === tab.id
                ? 'employee-profile-tabs__btn employee-profile-tabs__btn--active'
                : 'employee-profile-tabs__btn'
            }
            onClick={() => onTabChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="employee-profile-tab-panel" role="tabpanel">
        {activeProfileTab === 'overview' ? (
          <div className="employee-profile-layout">
            <EmployeeProfileBasicInfoCard employee={employee} lang={lang} empStatusMap={empStatusMap} t={t} />
            <EmployeeProfileSalaryCard t={t} salaryRows={salaryRows} total={total} />
          </div>
        ) : null}
        {activeProfileTab === 'financial' ? (
          <div className="employee-profile-section-stack">
            <EmployeeProfileFinancialSection
              t={t}
              financialRecords={financialRecords}
              onOpenResidency={canEditHrLeave ? onOpenResidency : undefined}
            />
            <EmployeeProfileAdvancesSection t={t} advances={advances} advanceStatusMap={advanceStatusMap} />
          </div>
        ) : null}
        {activeProfileTab === 'payroll' ? (
          <EmployeeProfilePayrollSection t={t} payrollItems={payrollItems} payrollRunStatusMap={payrollRunStatusMap} />
        ) : null}
        {activeProfileTab === 'leave' ? (
          <EmployeeProfileLeaveSection
            t={t}
            leaves={leaves}
            leaveProfileStatusMap={leaveProfileStatusMap}
            canEditHrLeave={canEditHrLeave}
            onEditLeave={onEditLeave}
          />
        ) : null}
        {activeProfileTab === 'services' ? (
          <EmployeeProfileResidencySection
            t={t}
            residencies={residencies}
            residencyProfileStatusMap={residencyProfileStatusMap}
            canAddService={canEditHrLeave}
            canEditService={canEditHrLeave}
            onQuickAdd={onQuickAddService}
            onOpenService={canEditHrLeave ? onOpenResidency : undefined}
            onDeleteService={canEditHrLeave ? onDeleteService : undefined}
          />
        ) : null}
        {activeProfileTab === 'documents' ? (
          <EmployeeProfileDocumentsSection
            t={t}
            documents={documents}
            uploading={uploading}
            fileInputRef={fileInputRef}
            onFileChange={onUploadDocument}
            onPickFile={onPickDocument}
            onDownload={onDownloadDocument}
          />
        ) : null}
        {activeProfileTab === 'career' ? (
          <EmployeeProfileCareerSection
            t={t}
            careerTableRows={careerTableRows}
            canShowCareerActions={canShowCareerActions}
            canEditRaise={canRecordCareer}
            onOpenPromotion={onOpenPromotion}
            onOpenRaise={onOpenRaise}
            onEditRaise={onEditRaise}
            onDeleteRaise={onDeleteRaise}
          />
        ) : null}
      </div>
    </>
  );
}
