/**
 * PayrollRunDetailModal — عرض تفاصيل مسيرة الراتب (جدول احترافي)
 */
import React from 'react';
import Decimal from 'decimal.js';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from '../../../i18n/useTranslation';
import { getPayrollRun } from '../../../services/api';
import { formatSaudiDate } from '../../../utils/saudiDate';
import { fmt } from '../../../utils/format';
import SmartTable from '../../../components/common/SmartTable';

const STATUS_MAP = {
  draft: { bg: 'rgba(100,116,139,0.1)', color: '#64748b', labelKey: 'payrollDraft' },
  completed: { bg: 'rgba(22,163,74,0.1)', color: '#16a34a', labelKey: 'payrollPaid' },
};

export function PayrollRunDetailModal({ runId, companyId, companyName, companyLogo, onClose }) {
  const { t } = useTranslation();

  const { data: run, isLoading } = useQuery({
    queryKey: ['payroll-run', runId, companyId],
    queryFn: async () => {
      const res = await getPayrollRun(runId, companyId);
      if (!res?.success) throw new Error(res?.error || 'فشل تحميل المسيرة');
      return res.data;
    },
    enabled: !!runId && !!companyId,
  });

  if (isLoading || !run) {
    return (
      <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }} onClick={onClose}>
        <div className="noorix-surface-card" style={{ padding: 24, maxWidth: 600 }} onClick={(e) => e.stopPropagation()}>
          <p>{t('loading')}</p>
        </div>
      </div>
    );
  }

  const items = run.items || [];
  const statusStyle = STATUS_MAP[run.status] || STATUS_MAP.draft;
  const totalNet = new Decimal(run.totalAmount ?? 0);
  const totalBeforeDeduction = items.reduce((s, row) => s.plus(row.grossSalary ?? 0).plus(row.allowancesAdd ?? 0), new Decimal(0));
  const totalDeductions      = items.reduce((s, row) => s.plus(row.deductions   ?? 0).plus(row.advancesDeduct ?? 0), new Decimal(0));

  const handlePrint = () => {
    const monthLabel = formatSaudiDate(run.payrollMonth);
    const rowsHtml = items.map((row, idx) => {
      const employeeName = row.employee?.name || row.employee?.nameAr || '—';
      const advanceDates = String(row.notes || '').replace('تواريخ السلف:', '').trim() || '—';
      const before = Number(row.grossSalary ?? 0) + Number(row.allowancesAdd ?? 0);
      const deductionsAll = Number(row.deductions ?? 0) + Number(row.advancesDeduct ?? 0);
      return `
        <tr>
          <td>${idx + 1}</td>
          <td>${employeeName}</td>
          <td>${advanceDates}</td>
          <td>${fmt(row.grossSalary ?? 0)}</td>
          <td>${fmt(before)}</td>
          <td>${fmt(deductionsAll)}</td>
          <td>${fmt(row.netSalary ?? 0)}</td>
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
            body { font-family: 'Cairo', Arial, sans-serif; color:#0f172a; padding:24px; line-height:1.6; }
            .header { display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; border-bottom:2px solid #0f172a; padding-bottom:12px; }
            .title { font-size:20px; font-weight:700; margin:0; }
            .meta { font-size:13px; color:#334155; margin:2px 0; }
            table { width:100%; border-collapse:collapse; margin-top:12px; font-size:12px; }
            th, td { border:1px solid #cbd5e1; padding:8px; text-align:right; }
            th { background:#f1f5f9; }
            .summary { margin-top:16px; display:grid; grid-template-columns:repeat(3,1fr); gap:8px; }
            .card { border:1px solid #cbd5e1; border-radius:8px; padding:10px; }
            .label { font-size:12px; color:#475569; margin-bottom:4px; }
            .value { font-size:16px; font-weight:700; }
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
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>

          <div class="summary">
            <div class="card">
              <div class="label">${t('payrollTotalBeforeDeductions')}</div>
              <div class="value">${fmt(totalBeforeDeduction)}</div>
            </div>
            <div class="card">
              <div class="label">${t('payrollTotalDeductionsAll')}</div>
              <div class="value">${fmt(totalDeductions)}</div>
            </div>
            <div class="card">
              <div class="label">${t('payrollTotalAfterDeductions')}</div>
              <div class="value">${fmt(totalNet)}</div>
            </div>
          </div>
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
    { key: 'employeeName', label: t('employeeName'), minWidth: 180, render: (_, row) => row.employee?.name || row.employee?.nameAr || '—' },
    { key: 'advanceDates', label: t('payrollAdvanceDates'), minWidth: 170, render: (_, row) => String(row.notes || '').replace('تواريخ السلف:', '').trim() || '—' },
    { key: 'grossSalary', label: t('grossSalary'), numeric: true, width: 130, minWidth: 120, render: (v) => fmt(v) },
    { key: 'beforeDeduction', label: t('payrollTotalBeforeDeductions'), numeric: true, width: 130, minWidth: 120, render: (_, row) => fmt(Number(row.grossSalary ?? 0) + Number(row.allowancesAdd ?? 0)) },
    { key: 'allowancesAdd', label: t('payrollAllowances'), numeric: true, width: 130, minWidth: 120, render: (v) => fmt(v ?? 0) },
    { key: 'deductions', label: t('payrollDeductions'), numeric: true, width: 130, minWidth: 120, render: (v) => fmt(v ?? 0) },
    { key: 'advancesDeduct', label: t('payrollAdvances'), numeric: true, width: 130, minWidth: 120, render: (v) => fmt(v ?? 0) },
    { key: 'allDeductions', label: t('payrollTotalDeductionsAll'), numeric: true, width: 130, minWidth: 120, render: (_, row) => fmt(Number(row.deductions ?? 0) + Number(row.advancesDeduct ?? 0)) },
    { key: 'netSalary', label: t('netSalary'), numeric: true, width: 130, minWidth: 120, render: (v) => fmt(v) },
  ];

  const footerCells = (
    <>
      <td colSpan={8} style={{ padding: '8px 12px', fontSize: 13, fontWeight: 700, color: 'var(--noorix-text-muted)' }}>{t('payrollTotalAfterDeductions')}</td>
      <td style={{ padding: '8px 12px', fontFamily: 'var(--noorix-font-numbers)', fontSize: 14, fontWeight: 900, color: '#16a34a', textAlign: 'right' }}>{fmt(totalNet)}</td>
    </>
  );

  return (
    <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }} onClick={onClose}>
      <div className="noorix-surface-card" style={{ padding: 24, maxWidth: 720, width: '95%', maxHeight: '90vh', overflow: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <h3 style={{ margin: '0 0 4px', fontSize: 18 }}>{run.runNumber || '—'}</h3>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--noorix-text-muted)' }}>
              {formatSaudiDate(run.payrollMonth)} — {items.length} {t('employeesList')}
            </p>
          </div>
          <span style={{
            padding: '4px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700,
            background: statusStyle.bg, color: statusStyle.color,
          }}>
            {t(statusStyle.labelKey)}
          </span>
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
          <p style={{ marginTop: 16, marginBottom: 0, fontSize: 13, color: 'var(--noorix-text-muted)' }}>{run.notes}</p>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button type="button" className="noorix-btn-nav" onClick={handlePrint}>{t('printPayroll')}</button>
          <button type="button" className="noorix-btn-nav" onClick={onClose}>{t('close') || 'إغلاق'}</button>
        </div>
      </div>
    </div>
  );
}
