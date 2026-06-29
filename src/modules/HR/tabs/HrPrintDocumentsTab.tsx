/**
 * HR print tab: payroll slip, annual statement, salary letter, and full entitlements (EOS).
 * Toolbar + side panels; print HTML is composed in hrPrintDocumentsTabPrintHtml.
 */
import React, { useMemo, useState, useCallback } from 'react';
import { useApp } from '../../../context/AppContext';
import type { CompanyListItem } from '../../../context/appTypes';
import { useTranslation } from '../../../i18n/useTranslation';
import { useEmployees } from '../../../hooks/useEmployees';
import { useApiQuery } from '../../../hooks/useApiQuery';
import { openPrintWindow } from '../../../utils/printUtils';
import { getBrandLogo } from '../../../utils/appBranding';
import { getEmployeeCompensationSnapshot } from '../../../services/api';
import { hrKeys } from '../../../services/queryKeys';
import { toYmd } from '../../../utils/saudiDate';
import { n, defaultPeriodLabel } from './hrPrintDocumentsTabFormat';
import {
  HR_GEN_PRINT_CSS,
  DEFAULT_DECL_SALARY_AR,
  DEFAULT_DECL_SALARY_EN,
  DEFAULT_EOS_SETTLEMENT_AR,
  DEFAULT_EOS_SETTLEMENT_EN,
  HR_PRINT_ALERT_ANNUAL_EMPTY_AR,
  HR_PRINT_ALERT_ANNUAL_EMPTY_EN,
} from './hrPrintDocumentsTabConstants';
import { composeHrPrintDocument, buildHrPrintPreviewSrcDoc, wrapHrPrintBody } from './hrPrintDocumentsTabPrintHtml';
import {
  emptyPayrollDraft,
  emptyAnnual,
  emptyEosDraft,
  type HrAnnualDraftState,
  type HrEosDraftState,
  type HrPayrollCustomRow,
  type HrPayrollDraftState,
  type HrPrintDocKind,
} from './hrPrintDocumentsTabDrafts';
import { HrPrintPayrollPanel } from './HrPrintPayrollPanel';
import { HrPrintEosPanel } from './HrPrintEosPanel';
import { HrPrintPreviewPanel } from './HrPrintPreviewPanel';
import { HrPrintDocumentsTabToolbar } from './HrPrintDocumentsTabToolbar';
import { HR_TOOLS_ROOT_CLASS } from '../hrWorkspaceLayout';

type HrCustomAllowanceRow = {
  id: string;
  employeeId: string;
  nameAr?: string | null;
  nameEn?: string | null;
  amount?: number | string | null;
};

export default function HrPrintDocumentsTab() {
  const { t, lang } = useTranslation();
  const { activeCompanyId, companies } = useApp();
  const companyId = activeCompanyId ?? '';
  const company = companies?.find((c: CompanyListItem) => c.id === companyId);
  const companyNameArDefault = company?.nameAr || company?.name || '';
  const companyNameEnDefault = company?.nameEn || company?.nameAr || company?.name || '';
  const companyLogoUrl = String(company?.logoUrl || getBrandLogo() || '').trim();

  const [docKind, setDocKind] = useState<HrPrintDocKind>('payroll');
  const [employeeId, setEmployeeId] = useState('');
  const [payroll, setPayroll] = useState(emptyPayrollDraft);
  const [annual, setAnnual] = useState(emptyAnnual);
  const [eos, setEos] = useState(emptyEosDraft);
  /** Landscape toggles @page size in printUtils. */
  const [printLandscape, setPrintLandscape] = useState(false);

  const { employees } = useEmployees(companyId, { includeTerminated: true, fetchEnabled: !!companyId });

  const emp = useMemo(() => employees.find((e) => e.id === employeeId), [employees, employeeId]);
  const {
    data: compensationSnapshot,
    isLoading: compensationSnapshotLoading,
    error: compensationSnapshotError,
  } = useApiQuery<any>({
    queryKey: hrKeys.compensationSnapshot(companyId, employeeId),
    queryFn: () => getEmployeeCompensationSnapshot(companyId, employeeId),
    enabled: !!companyId && !!employeeId,
    fallbackMessage: t('loadingError'),
  });

  const payrollTotal = useMemo(() => {
    let sum = n(payroll.basic) + n(payroll.housing) + n(payroll.transport) + n(payroll.other) + n(payroll.overtime);
    (payroll.customRows || []).forEach((r: HrPayrollCustomRow) => {
      sum += n(r.amount);
    });
    return sum;
  }, [payroll]);

  const annualSum = useMemo(() => {
    let s = 0;
    annual.monthOn.forEach((on, i) => {
      if (on) s += n(annual.amounts[i]);
    });
    return s;
  }, [annual]);

  const eosWageTotal =
    n(eos.basic) + n(eos.housing) + n(eos.transport) + n(eos.other) +
    (eos.customRows || []).reduce((sum: number, row: any) => sum + n(row.amount), 0);

  const importPayroll = useCallback(() => {
    if (!emp || !compensationSnapshot?.salaryPackage) return;
    const salaryPackage = compensationSnapshot.salaryPackage;
    const customRows = (compensationSnapshot.customAllowances?.items || [])
      .map((a: HrCustomAllowanceRow) => ({ key: a.id, label: a.nameAr || a.nameEn || t('customAllowanceName'), amount: String(n(a.amount)) }));
    const totStr = String(n(salaryPackage.total));
    setPayroll({
      ...emptyPayrollDraft(),
      payrollFormat: payroll.payrollFormat,
      periodLabel: defaultPeriodLabel(lang),
      companyName: companyNameArDefault,
      companyNameEn: companyNameEnDefault,
      nameAr: String(emp.nameAr || emp.name || '').trim(),
      nameEn: String(emp.nameEn || '').trim(),
      employeeSerial: emp.employeeSerial || '',
      jobTitle: emp.jobTitle || '',
      iqama: emp.iqamaNumber || '',
      joinDate: toYmd(emp.joinDate),
      letterStartDate: toYmd(emp.joinDate),
      letterEndDate: '',
      declarationSalariesAr: DEFAULT_DECL_SALARY_AR,
      declarationSalariesEn: DEFAULT_DECL_SALARY_EN,
      basic: String(n(salaryPackage.basicSalary)),
      housing: String(n(salaryPackage.housingAllowance)),
      transport: String(n(salaryPackage.transportAllowance)),
      other: String(n(salaryPackage.otherAllowance)),
      overtime: String(n(salaryPackage.overtimePay)),
      customRows,
      showBreakdown: true,
    });
    setAnnual((a) => ({
      year: a.year,
      monthOn: Array.from({ length: 12 }, () => true),
      amounts: Array.from({ length: 12 }, () => totStr),
      perMonthGross: totStr,
    }));
  }, [emp, compensationSnapshot, companyNameArDefault, companyNameEnDefault, lang, t, payroll.payrollFormat]);

  const importEos = useCallback(() => {
    if (!emp || !compensationSnapshot?.salaryPackage) return;
    const salaryPackage = compensationSnapshot.salaryPackage;
    const customRows = (compensationSnapshot.customAllowances?.items || [])
      .map((a: HrCustomAllowanceRow) => ({ key: a.id, label: a.nameAr || a.nameEn || t('customAllowanceName'), amount: String(n(a.amount)) }));
    setEos({
      ...emptyEosDraft(),
      companyName: companyNameArDefault,
      companyNameEn: companyNameEnDefault,
      nameAr: String(emp.nameAr || emp.name || '').trim(),
      nameEn: String(emp.nameEn || '').trim(),
      employeeSerial: emp.employeeSerial || '',
      jobTitle: emp.jobTitle || '',
      iqama: emp.iqamaNumber || '',
      joinDate: toYmd(emp.joinDate),
      basic: String(n(salaryPackage.basicSalary)),
      housing: String(n(salaryPackage.housingAllowance)),
      transport: String(n(salaryPackage.transportAllowance)),
      other: String(n(salaryPackage.otherAllowance)),
      customRows,
      settlementNotesAr: DEFAULT_EOS_SETTLEMENT_AR,
      settlementNotesEn: DEFAULT_EOS_SETTLEMENT_EN,
    });
  }, [emp, compensationSnapshot, companyNameArDefault, companyNameEnDefault, t]);

  const fillAnnualWithMonthlyTotal = () => {
    const s = String(Math.round(payrollTotal * 100) / 100);
    setAnnual((a: HrAnnualDraftState) => ({
      ...a,
      perMonthGross: s,
      amounts: a.amounts.map((_, i) => (a.monthOn[i] ? s : '')),
    }));
  };

  const hrPrintComposed = useMemo(
    () =>
      composeHrPrintDocument({
        docKind,
        payrollFormat: payroll.payrollFormat,
        logoUrl: companyLogoUrl,
        lang,
        payroll,
        annual,
        eos,
        companyNameArDefault,
        companyNameEnDefault,
        payrollTotal,
        annualSum,
        eosWageTotal,
        t,
      }),
    [
      docKind,
      payroll,
      annual,
      eos,
      lang,
      companyLogoUrl,
      companyNameArDefault,
      companyNameEnDefault,
      payrollTotal,
      annualSum,
      eosWageTotal,
      t,
    ],
  );

  const hrPrintPreviewSrcDoc = useMemo(() => {
    if (!hrPrintComposed.inner) return '';
    return buildHrPrintPreviewSrcDoc(hrPrintComposed.inner, printLandscape);
  }, [hrPrintComposed, printLandscape]);

  const runHrPrint = () => {
    if (hrPrintComposed.err === 'annual_empty') {
      window.alert(lang === 'ar' ? HR_PRINT_ALERT_ANNUAL_EMPTY_AR : HR_PRINT_ALERT_ANNUAL_EMPTY_EN);
      return;
    }
    if (!hrPrintComposed.inner) return;
    openPrintWindow({
      title: hrPrintComposed.title,
      companyName: '',
      subtitle: '',
      landscape: printLandscape,
      extraCss: HR_GEN_PRINT_CSS,
      showPageCounter: false,
      // Tight margins for A4 with embedded HR print CSS
      pageMarginMm: printLandscape ? 5 : 4,
      body: wrapHrPrintBody(hrPrintComposed.inner, printLandscape),
    });
  };

  const updatePayroll = (patch: Partial<HrPayrollDraftState>) => setPayroll((p) => ({ ...p, ...patch }));
  const updateEos = (patch: Partial<HrEosDraftState>) => setEos((p) => ({ ...p, ...patch }));

  const addCustomRowPayroll = () => {
    setPayroll((p) => ({
      ...p,
      customRows: [...(p.customRows || []), { key: `n-${Date.now()}`, label: '', amount: '' }],
    }));
  };
  const addCustomRowEos = () => {
    setEos((p) => ({
      ...p,
      customRows: [...(p.customRows || []), { key: `n-${Date.now()}`, label: '', amount: '' }],
    }));
  };

  if (!companyId) {
    return (
      <div className={HR_TOOLS_ROOT_CLASS}>
        <div className="noorix-surface-card w-full min-w-0 p-5 text-center text-noorix-muted">
          {t('pleaseSelectCompany')}
        </div>
      </div>
    );
  }

  return (
    <div className={HR_TOOLS_ROOT_CLASS}>
    <div className="noorix-surface-card w-full min-w-0 p-4 sm:p-5">
      <div className="mb-4">
        <h3 className="m-0 text-[17px] font-bold text-noorix-text">{t('hrTabPrintDocs')}</h3>
        <p className="mt-1.5 mb-0 text-[13px] text-noorix-muted">{t('hrTabPrintDocsDesc')}</p>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,36%)_minmax(0,64%)] xl:items-start 2xl:gap-6">
        <div className="min-w-0 space-y-4">
          <HrPrintDocumentsTabToolbar
            t={t}
            lang={lang}
            docKind={docKind}
            onDocKind={setDocKind}
            printLandscape={printLandscape}
            onPrintLandscape={setPrintLandscape}
            employeeId={employeeId}
            onEmployeeId={setEmployeeId}
            employees={employees}
            hasEmployee={!!emp && !!compensationSnapshot?.salaryPackage && !compensationSnapshotLoading && !compensationSnapshotError}
            onImportFromHr={() => (docKind === 'payroll' ? importPayroll() : importEos())}
          />
          {employeeId && compensationSnapshotLoading && (
            <div className="text-[11px] text-noorix-muted">{t('loading')}</div>
          )}
          {employeeId && compensationSnapshotError && (
            <div className="text-[11px] text-noorix-red">
              {compensationSnapshotError instanceof Error ? compensationSnapshotError.message : t('loadingError')}
            </div>
          )}

          {docKind === 'payroll' && (
            <HrPrintPayrollPanel
              t={t}
              lang={lang}
              payroll={payroll}
              annual={annual}
              updatePayroll={updatePayroll}
              setAnnual={setAnnual}
              payrollTotal={payrollTotal}
              annualSum={annualSum}
              fillAnnualWithMonthlyTotal={fillAnnualWithMonthlyTotal}
              addCustomRowPayroll={addCustomRowPayroll}
            />
          )}

          {docKind === 'eos' && (
            <HrPrintEosPanel
              t={t}
              lang={lang}
              eos={eos}
              updateEos={updateEos}
              addCustomRowEos={addCustomRowEos}
              eosWageTotal={eosWageTotal}
            />
          )}
        </div>

        <HrPrintPreviewPanel
          t={t}
          composed={hrPrintComposed}
          previewSrcDoc={hrPrintPreviewSrcDoc}
          onPrint={runHrPrint}
          hasEmployee={!!emp}
        />
      </div>
    </div>
    </div>
  );
}
