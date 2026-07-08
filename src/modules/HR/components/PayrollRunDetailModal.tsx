/**
 * PayrollRunDetailModal — ??? ?????? ????? ?????? (???? ???????)
 */
import React, { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useApiQuery } from '../../../hooks/useApiQuery';
import { useTranslation } from '../../../i18n/useTranslation';
import { getText } from '../../../i18n/translations';
import { getPayrollRun } from '../../../services/api';
import { formatSaudiDate } from '../../../utils/saudiDate';
import { hrFmt } from '../utils/hrFmt';
import { employeeDisplayName } from '../../../utils/employeeDisplayName';
import { Badge, Button, AdaptiveSheet, Checkbox, SmartTable, Modal } from '../../../ui';
import { openPrintWindow } from '../../../utils/printUtils';
import { openPayrollRunEmployeeSlipsPrint } from '../utils/payrollRunSignatureSlipsPrint';
import { payrollSalaryInvoiceListHref } from '../utils/payrollSalaryInvoiceHref';
import { hrKeys } from '../../../services/queryKeys';
import { computePayrollLineSummary, computePayrollRunTotals } from '../utils/hrCalculations/payroll';

const STATUS_MAP = {
  draft: { labelKey: 'payrollDraft', badgeColor: 'gray' },
};

type PayrollRunLine = Record<string, unknown> & {
  id?: string | null;
  employee?: Record<string, unknown> | null;
  employeeName?: string | null;
  notes?: string | null;
  grossSalary?: number | string | null;
  allowancesAdd?: number | string | null;
  deductions?: number | string | null;
  advancesDeduct?: number | string | null;
  netSalary?: number | string | null;
};
type PayrollRunDetail = Record<string, unknown> & {
  id: string;
  runNumber?: string | null;
  status?: string | null;
  payrollMonth?: string | null;
  totalAmount?: number | string | null;
  issuedSalaryInvoiceNumber?: string | number | null;
  notes?: string | null;
  items?: PayrollRunLine[];
};
type PayrollRunDetailModalProps = {
  runId: string;
  companyId: string;
  companyName?: string;
  companyNameEn?: string;
  companyLogo?: string;
  onClose: () => void;
};

export function PayrollRunDetailModal({ runId, companyId, companyName, companyNameEn, companyLogo, onClose }: PayrollRunDetailModalProps) {
  const { t, lang } = useTranslation();
  const [slipModalOpen, setSlipModalOpen] = useState(false);
  const [slipNetOnly, setSlipNetOnly] = useState(false);

  const { data: run, isLoading } = useApiQuery<PayrollRunDetail>({
    queryKey: hrKeys.payrollRun(runId, companyId),
    queryFn: () => getPayrollRun(runId, companyId),
    enabled: !!runId && !!companyId,
    fallbackMessage: t('loadingError'),
  });

  /** ??? ?? ???? ??? ?? return ???? — ????? ??? Hooks */
  const buildSlipLabels = useCallback(
    (runForPrint: PayrollRunDetail) => ({
      windowTitle: `${t('payrollSlipBatchPrint')} — ${runForPrint.runNumber || ''}`,
      legalRefAr: getText('payrollSlipLegalRefAr', 'ar'),
      legalRefEn: getText('payrollSlipLegalRefEn', 'en'),
      docTitleAr: getText('payrollSlipDocTitle', 'ar'),
      docTitleEn: getText('payrollSlipDocTitle', 'en'),
      runLabel: t('payrollSlipRunLabel'),
      lblPayrollMonth: t('payrollSlipLblPayrollMonth'),
      sectionEmpAr: getText('payrollSlipSectionEmpAr', 'ar'),
      sectionEmpEn: getText('payrollSlipSectionEmpEn', 'en'),
      lblName: t('payrollSlipLblName'),
      lblIqama: t('payrollSlipLblIqama'),
      lblJob: t('payrollSlipLblJob'),
      lblSerial: t('payrollSlipLblSerial'),
      lblJoin: t('payrollSlipLblJoin'),
      sectionBreakdownAr: getText('payrollSlipSectionBreakdownAr', 'ar'),
      sectionBreakdownEn: getText('payrollSlipSectionBreakdownEn', 'en'),
      colItem: t('payrollSlipColItem'),
      colAmount: t('payrollSlipColAmount'),
      rowGross: t('payrollSlipRowGross'),
      rowAllowances: t('payrollSlipRowAllowances'),
      rowBeforeDed: t('payrollTotalBeforeDeductions'),
      rowDeductions: t('deductions'),
      rowAdvances: t('advancesDeduct'),
      rowNet: t('netSalary'),
      netPayableTitle: t('payrollSlipNetPayableTitle'),
      netOnlyNoteAr: getText('payrollSlipNetOnlyNoteAr', 'ar'),
      netOnlyNoteEn: getText('payrollSlipNetOnlyNoteEn', 'en'),
      declarationAr: getText('payrollSlipAckAr', 'ar'),
      declarationEn: getText('payrollSlipAckEn', 'en'),
      sectionSigAr: getText('payrollSlipSectionSigAr', 'ar'),
      sectionSigEn: getText('payrollSlipSectionSigEn', 'en'),
      sigEmployeeAr: getText('payrollSlipSigEmployeeAr', 'ar'),
      sigEmployeeEn: getText('payrollSlipSigEmployeeEn', 'en'),
      sigEmployerAr: getText('payrollSlipSigEmployerAr', 'ar'),
      sigEmployerEn: getText('payrollSlipSigEmployerEn', 'en'),
      sigDateLine: t('payrollSlipSigDateLine'),
      footerLeft: t('payrollSlipFooterIssued'),
      issueLabel: t('payrollSlipIssueDate'),
    }),
    [t],
  );

  if (isLoading || !run) {
    return (
      <AdaptiveSheet open={true} onClose={onClose} title={t('loading')} size="sm" side="start">
        <p className="m-0">{t('loading')}</p>
      </AdaptiveSheet>
    );
  }

  const items = run.items || [];
  const st = String(run.status || '').toLowerCase();
  const statusInfo =
    st === 'completed' && run.issuedSalaryInvoiceNumber
      ? { labelKey: 'payrollPaid', badgeColor: 'green' }
      : st === 'completed'
        ? { labelKey: 'payrollApproved', badgeColor: 'blue' }
        : (STATUS_MAP as Record<string, (typeof STATUS_MAP)['draft']>)[st] || STATUS_MAP.draft;
  const payrollTotals = computePayrollRunTotals(items);
  const totalNet = Number(run.totalAmount ?? payrollTotals.netSalary);

  const handlePrint = () => {
    const monthLabel = formatSaudiDate(run.payrollMonth);
    const rowsHtml = items.map((row, idx) => {
      const employeeName = employeeDisplayName(row.employee || { name: row.employeeName }, lang);
      const advanceDates = String(row.notes || '').replace('?????? ?????:', '').trim() || '—';
      const summary = computePayrollLineSummary(row);
      return `<tr>
        <td>${idx + 1}</td><td>${employeeName}</td><td>${advanceDates}</td>
        <td>${hrFmt(summary.grossSalary)}</td><td>${hrFmt(summary.beforeDeductions)}</td>
        <td>${hrFmt(summary.totalDeductions)}</td><td>${hrFmt(summary.netSalary)}</td>
        <td class="sig-cell">&nbsp;</td>
      </tr>`;
    }).join('');

    const logoHtml = companyLogo
      ? `<img src="${companyLogo}" alt="logo" style="height:52px;width:auto;object-fit:contain" />`
      : '';

    openPrintWindow({
      title: run.runNumber || undefined,
      extraCss: `
        .run-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; border-bottom:2px solid #0f172a; padding-bottom:12px; }
        .run-title { font-size:20px; font-weight:700; margin:0; }
        .run-meta { font-size:13px; color:#334155; margin:2px 0; }
        table th { background:#f1f5f9; color:#0f172a; }
        .sig-cell { min-height:44px; min-width:110px; vertical-align:middle; }
        .summary-grid { margin-top:16px; display:grid; grid-template-columns:repeat(3,1fr); gap:8px; }
        .s-card { border:1px solid #cbd5e1; border-radius:8px; padding:10px; }
        .s-label { font-size:12px; color:#475569; margin-bottom:4px; }
        .s-value { font-size:16px; font-weight:700; }
      `,
      body: `
        <div class="run-header">
          <div>
            <h1 class="run-title">${companyName || 'NOORIX'}</h1>
            <p class="run-meta">???? ???????: ${run.runNumber}</p>
            <p class="run-meta">?????: ${monthLabel}</p>
          </div>
          <div>${logoHtml}</div>
        </div>
        <table>
          <thead><tr>
            <th>#</th><th>${t('employeeName')}</th><th>${t('payrollAdvanceDates')}</th>
            <th>${t('grossSalary')}</th><th>${t('payrollTotalBeforeDeductions')}</th>
            <th>${t('payrollTotalDeductionsAll')}</th><th>${t('payrollTotalAfterDeductions')}</th>
            <th>${t('payrollEmployeeSignature')}</th>
          </tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>
        <div class="summary-grid">
          <div class="s-card"><div class="s-label">${t('payrollTotalBeforeDeductions')}</div><div class="s-value">${hrFmt(payrollTotals.beforeDeductions)}</div></div>
          <div class="s-card"><div class="s-label">${t('payrollTotalDeductionsAll')}</div><div class="s-value">${hrFmt(payrollTotals.totalDeductions)}</div></div>
          <div class="s-card"><div class="s-label">${t('payrollTotalAfterDeductions')}</div><div class="s-value">${hrFmt(totalNet)}</div></div>
        </div>
      `,
    });
  };

  const handlePrintEmployeeSlips = () => {
    setSlipNetOnly(false);
    setSlipModalOpen(true);
  };

  const confirmPrintEmployeeSlips = () => {
    setSlipModalOpen(false);
    openPayrollRunEmployeeSlipsPrint({
      run,
      companyName,
      companyNameEn,
      companyLogo,
      lang,
      labels: buildSlipLabels(run),
      netOnly: slipNetOnly,
    });
  };

  const columns = [
    { key: 'employeeName', label: t('employeeName'), width: '18%', minWidth: 150, render: (_: unknown, row: PayrollRunLine) => employeeDisplayName(row.employee || { name: row.employeeName }, lang) },
    { key: 'advanceDates', label: t('payrollAdvanceDates'), width: '16%', minWidth: 120, render: (_: unknown, row: PayrollRunLine) => String(row.notes || '').replace('?????? ?????:', '').trim() || '—' },
    { key: 'grossSalary', label: t('grossSalary'), numeric: true, width: '9%', minWidth: 84, render: (v: unknown) => hrFmt(v) },
    { key: 'beforeDeduction', label: t('payrollTotalBeforeDeductions'), numeric: true, width: '11%', minWidth: 96, render: (_: unknown, row: PayrollRunLine) => hrFmt(computePayrollLineSummary(row).beforeDeductions) },
    { key: 'allowancesAdd', label: t('payrollAllowances'), numeric: true, width: '8%', minWidth: 76, render: (v: unknown) => hrFmt(v ?? 0) },
    { key: 'deductions', label: t('payrollDeductions'), numeric: true, width: '8%', minWidth: 76, render: (v: unknown) => hrFmt(v ?? 0) },
    { key: 'advancesDeduct', label: t('payrollAdvances'), numeric: true, width: '8%', minWidth: 76, render: (v: unknown) => hrFmt(v ?? 0) },
    { key: 'allDeductions', label: t('payrollTotalDeductionsAll'), numeric: true, width: '11%', minWidth: 96, render: (_: unknown, row: PayrollRunLine) => hrFmt(computePayrollLineSummary(row).totalDeductions) },
    { key: 'netSalary', label: t('netSalary'), numeric: true, width: '11%', minWidth: 90, render: (_: unknown, row: PayrollRunLine) => hrFmt(computePayrollLineSummary(row).netSalary) },
    {
      key: 'employeeSignature',
      label: t('payrollEmployeeSignature'),
      width: '12%',
      minWidth: 110,
      render: () => (
        <span
          className="inline-block min-w-[100px] min-h-[36px] border-b border-dashed border-noorix-border align-bottom"
          aria-hidden
        />
      ),
    },
  ];

  const footerCells = (
    <>
      <td className="py-2 px-2" aria-hidden />
      <td colSpan={8} className="text-[13px] font-bold text-noorix-muted py-2 px-3">{t('payrollTotalAfterDeductions')}</td>
      <td className="text-[14px] py-2 px-3 font-black text-right nx-font-numbers text-noorix-green">{hrFmt(totalNet)}</td>
      <td className="py-2 px-2" aria-hidden />
    </>
  );

  return (
    <AdaptiveSheet
      open={true}
      onClose={onClose}
      title={run.runNumber || '—'}
      size="xl"
      side="start"
      className="payroll-run-detail-drawer"
      footer={
        <>
          <Button onClick={handlePrint}>{t('printPayroll')}</Button>
          <Button variant="default" onClick={handlePrintEmployeeSlips}>{t('payrollSlipBatchPrint')}</Button>
          <Button variant="ghost" onClick={onClose}>{t('close') || '?????'}</Button>
        </>
      }
    >
      <div className="mb-4">
        <p className="text-[13px] text-noorix-muted m-0 mb-2">
          {formatSaudiDate(run.payrollMonth)} — {items.length} {t('employeesList')}
        </p>
        <Badge color={statusInfo.badgeColor}>{t(statusInfo.labelKey)}</Badge>
        {run.issuedSalaryInvoiceNumber ? (
          <p className="m-0 mt-2 text-[12px] text-noorix-muted nx-font-numbers" dir="ltr">
            {t('payrollIssuedInvoiceNumber')}:{' '}
            <Link
              to={payrollSalaryInvoiceListHref(run.id, run.payrollMonth)}
              className="font-semibold text-noorix-blue hover:underline"
              title={t('payrollOpenIssuedInvoice')}
            >
              {run.issuedSalaryInvoiceNumber}
            </Link>
          </p>
        ) : null}
      </div>

      <SmartTable
        compact
        showRowNumbers
        innerPadding={8}
        columns={columns}
        data={items}
        total={items.length}
        page={1}
        pageSize={50}
        footerCells={footerCells}
        emptyMessage={t('noDataInPeriod')}
      />

      {run.notes && (
        <p className="mt-4 mb-0 text-[13px] text-noorix-muted">{run.notes}</p>
      )}

      <Modal
        open={slipModalOpen}
        onClose={() => setSlipModalOpen(false)}
        title={t('payrollSlipBatchModalTitle')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setSlipModalOpen(false)}>{t('close')}</Button>
            <Button onClick={confirmPrintEmployeeSlips}>{t('payrollSlipConfirmPrint')}</Button>
          </>
        }
      >
        <label className="flex cursor-pointer items-start gap-3 text-[13px] leading-snug text-noorix-text">
          <Checkbox
            className="mt-1 h-4 w-4 shrink-0 rounded border-noorix-border"
            checked={slipNetOnly}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSlipNetOnly(e.target.checked)}
          />
          <span>
            <span className="font-semibold block">{t('payrollSlipNetOnlyOption')}</span>
            <span className="mt-1 block text-[12px] text-noorix-muted">{t('payrollSlipNetOnlyHelp')}</span>
          </span>
        </label>
      </Modal>
    </AdaptiveSheet>
  );
}
