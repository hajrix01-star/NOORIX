/**
 * PayrollRunDetailModal — عرض تفاصيل مسيرة الراتب (جدول احترافي)
 */
import React from 'react';
import Decimal from 'decimal.js';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from '../../../i18n/useTranslation';
import { getPayrollRun } from '../../../services/api';
import { formatSaudiDate } from '../../../utils/saudiDate';
import { hrFmt } from '../utils/hrFmt';
import SmartTable from '../../../components/common/SmartTable';
import { employeeDisplayName } from '../../../utils/employeeDisplayName';
import { Badge, Button, AdaptiveSheet } from '../../../ui';
import { rejectIfApiFailed } from '../../../utils/apiResponse';

const STATUS_MAP = {
  draft: { labelKey: 'payrollDraft', badgeColor: 'gray' },
  completed: { labelKey: 'payrollPaid', badgeColor: 'green' },
};

export function PayrollRunDetailModal({ runId, companyId, companyName, companyLogo, onClose }) {
  const { t, lang } = useTranslation();

  const { data: run, isLoading } = useQuery({
    queryKey: ['payroll-run', runId, companyId],
    queryFn: async () => {
      const res = await getPayrollRun(runId, companyId);
      rejectIfApiFailed(res, t('loadingError'));
      return res.data;
    },
    enabled: !!runId && !!companyId,
  });

  if (isLoading || !run) {
    return (
      <AdaptiveSheet open={true} onClose={onClose} title={t('loading')} size="sm" side="start">
        <p className="m-0">{t('loading')}</p>
      </AdaptiveSheet>
    );
  }

  const items = run.items || [];
  const statusInfo = STATUS_MAP[run.status] || STATUS_MAP.draft;
  const totalNet = new Decimal(run.totalAmount ?? 0);
  const totalBeforeDeduction = items.reduce((s, row) => s.plus(row.grossSalary ?? 0).plus(row.allowancesAdd ?? 0), new Decimal(0));
  const totalDeductions      = items.reduce((s, row) => s.plus(row.deductions   ?? 0).plus(row.advancesDeduct ?? 0), new Decimal(0));

  const handlePrint = () => {
    const monthLabel = formatSaudiDate(run.payrollMonth);
    const rowsHtml = items.map((row, idx) => {
      const employeeName = employeeDisplayName(row.employee || { name: row.employeeName }, lang);
      const advanceDates = String(row.notes || '').replace('تواريخ السلف:', '').trim() || '—';
      const before = Number(row.grossSalary ?? 0) + Number(row.allowancesAdd ?? 0);
      const deductionsAll = Number(row.deductions ?? 0) + Number(row.advancesDeduct ?? 0);
      return `
        <tr>
          <td>${idx + 1}</td>
          <td>${employeeName}</td>
          <td>${advanceDates}</td>
          <td>${hrFmt(row.grossSalary ?? 0)}</td>
          <td>${hrFmt(before)}</td>
          <td>${hrFmt(deductionsAll)}</td>
          <td>${hrFmt(row.netSalary ?? 0)}</td>
          <td class="signature-cell">&nbsp;</td>
        </tr>
      `;
    }).join('');

    const logoHtml = companyLogo
      ? `<img src="${companyLogo}" alt="logo" style="height:52px; width:auto; object-fit:contain;" />`
      : '';

    const html = `
      <html lang="en" dir="rtl">
        <head>
          <meta charset="utf-8" />
          <title>${run.runNumber}</title>
          <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
          <style>
            @page{size:A4;margin:15mm 15mm 20mm;@bottom-center{content:"صفحة " counter(page) " من " counter(pages);font-family:'Cairo',Arial,sans-serif;font-size:10px;color:#555}}
            body { font-family: 'Cairo', Arial, sans-serif; color:#0f172a; padding:24px; line-height:1.6; }
            .header { display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; border-bottom:2px solid #0f172a; padding-bottom:12px; }
            .title { font-size:20px; font-weight:700; margin:0; }
            .meta { font-size:13px; color:#334155; margin:2px 0; }
            table { width:100%; border-collapse:collapse; margin-top:12px; font-size:12px; }
            th, td { border:1px solid #cbd5e1; padding:8px; text-align:right; }
            th { background:#f1f5f9; }
            .signature-cell { min-height:44px; min-width:110px; vertical-align:middle; }
            .summary { margin-top:16px; display:grid; grid-template-columns:repeat(3,1fr); gap:8px; }
            .card { border:1px solid #cbd5e1; border-radius:8px; padding:10px; }
            .label { font-size:12px; color:#475569; margin-bottom:4px; }
            .value { font-size:16px; font-weight:700; }
            .print-footer { margin-top:20px; padding-top:8px; border-top:1px solid #ddd; text-align:center; font-size:11px; color:#777; }
            @media print { body { padding:0; } }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1 class="title">${companyName || 'NOORIX'}</h1>
              <p class="meta">مسير الرواتب: ${run.runNumber}</p>
              <p class="meta">الشهر: ${monthLabel}</p>
            </div>
            <div>${logoHtml}</div>
          </div>

          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>${t('employeeName')}</th>
                <th>${t('payrollAdvanceDates')}</th>
                <th>${t('grossSalary')}</th>
                <th>${t('payrollTotalBeforeDeductions')}</th>
                <th>${t('payrollTotalDeductionsAll')}</th>
                <th>${t('payrollTotalAfterDeductions')}</th>
                <th>${t('payrollEmployeeSignature')}</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>

          <div class="summary">
            <div class="card">
              <div class="label">${t('payrollTotalBeforeDeductions')}</div>
              <div class="value">${hrFmt(totalBeforeDeduction)}</div>
            </div>
            <div class="card">
              <div class="label">${t('payrollTotalDeductionsAll')}</div>
              <div class="value">${hrFmt(totalDeductions)}</div>
            </div>
            <div class="card">
              <div class="label">${t('payrollTotalAfterDeductions')}</div>
              <div class="value">${hrFmt(totalNet)}</div>
            </div>
          </div>
          <div class="print-footer">طُبع بتاريخ: ${new Date().toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
          <script>window.onload = () => window.print();</script>
        </body>
      </html>
    `;

    const win = window.open('', '_blank', 'width=1280,height=900');
    if (!win) return;
    win.document.open();
    win.document.write(html);
    win.document.close();
  };

  const columns = [
    { key: 'employeeName', label: t('employeeName'), width: '18%', minWidth: 150, render: (_, row) => employeeDisplayName(row.employee || { name: row.employeeName }, lang) },
    { key: 'advanceDates', label: t('payrollAdvanceDates'), width: '16%', minWidth: 120, render: (_, row) => String(row.notes || '').replace('تواريخ السلف:', '').trim() || '—' },
    { key: 'grossSalary', label: t('grossSalary'), numeric: true, width: '9%', minWidth: 84, render: (v) => hrFmt(v) },
    { key: 'beforeDeduction', label: t('payrollTotalBeforeDeductions'), numeric: true, width: '11%', minWidth: 96, render: (_, row) => hrFmt(Number(row.grossSalary ?? 0) + Number(row.allowancesAdd ?? 0)) },
    { key: 'allowancesAdd', label: t('payrollAllowances'), numeric: true, width: '8%', minWidth: 76, render: (v) => hrFmt(v ?? 0) },
    { key: 'deductions', label: t('payrollDeductions'), numeric: true, width: '8%', minWidth: 76, render: (v) => hrFmt(v ?? 0) },
    { key: 'advancesDeduct', label: t('payrollAdvances'), numeric: true, width: '8%', minWidth: 76, render: (v) => hrFmt(v ?? 0) },
    { key: 'allDeductions', label: t('payrollTotalDeductionsAll'), numeric: true, width: '11%', minWidth: 96, render: (_, row) => hrFmt(Number(row.deductions ?? 0) + Number(row.advancesDeduct ?? 0)) },
    { key: 'netSalary', label: t('netSalary'), numeric: true, width: '11%', minWidth: 90, render: (v) => hrFmt(v) },
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
          <Button variant="ghost" onClick={onClose}>{t('close') || 'إغلاق'}</Button>
        </>
      }
    >
      <div className="mb-4">
        <p className="text-[13px] text-noorix-muted m-0 mb-2">
          {formatSaudiDate(run.payrollMonth)} — {items.length} {t('employeesList')}
        </p>
        <Badge color={statusInfo.badgeColor}>{t(statusInfo.labelKey)}</Badge>
      </div>

      <SmartTable
        compact
        showRowNumbers
        rowNumberWidth="1%"
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
    </AdaptiveSheet>
  );
}
