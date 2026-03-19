/**
 * PayrollTab — مسيرات الرواتب (احترافي كامل)
 */
import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { invalidateOnFinancialMutation } from '../../../utils/queryInvalidation';
import { useApp } from '../../../context/AppContext';
import { useTranslation } from '../../../i18n/useTranslation';
import { getPayrollRuns, updatePayrollRunStatus, issuePayrollPayment } from '../../../services/api';
import { formatSaudiDate } from '../../../utils/saudiDate';
import { fmt } from '../../../utils/format';
import { exportToExcel } from '../../../utils/exportUtils';
import { useTableFilter } from '../../../hooks/useTableFilter';
import { getSaudiToday } from '../../../utils/saudiDate';
import SmartTable from '../../../components/common/SmartTable';
import { PayrollRunFormModal } from '../components/PayrollRunFormModal';
import { PayrollRunDetailModal } from '../components/PayrollRunDetailModal';
import { HRActionsCell } from '../components/HRActionsCell';
import Toast from '../../../components/Toast';

const PAGE_SIZE = 50;

const STATUS_MAP = {
  draft: { bg: 'rgba(100,116,139,0.1)', color: '#64748b', labelKey: 'payrollDraft' },
  completed: { bg: 'rgba(22,163,74,0.1)', color: '#16a34a', labelKey: 'payrollPaid' },
};

export default function PayrollTab() {
  const { t } = useTranslation();
  const { activeCompanyId, companies } = useApp();
  const companyId = activeCompanyId ?? '';
  const activeCompany = companies?.find((c) => c.id === companyId);
  const companyName = activeCompany?.nameAr || activeCompany?.name || '';
  const companyLogo = activeCompany?.logoUrl || '';
  const [year, setYear] = useState(new Date().getFullYear());
  const [showCreate, setShowCreate] = useState(false);
  const [detailRunId, setDetailRunId] = useState(null);
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' });
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['payroll-runs', companyId, year],
    queryFn: async () => {
      const res = await getPayrollRuns(companyId, year);
      if (!res?.success) return [];
      const raw = Array.isArray(res.data) ? res.data : (res.data?.items ?? []);
      return raw.map((run) => {
        const grossTotal = Array.isArray(run.items)
          ? run.items.reduce((s, i) => s + Number(i?.grossSalary ?? 0), 0)
          : Number(run.totalAmount ?? 0);
        return {
          id: run.id,
          runNumber: run.runNumber,
          month: run.payrollMonth ? formatSaudiDate(run.payrollMonth) : null,
          monthRaw: run.payrollMonth,
          grossTotal,
          netTotal: Number(run.totalAmount ?? 0),
          status: run.status,
          itemsCount: run.items?.length ?? 0,
        };
      });
    },
    enabled: !!companyId,
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }) => updatePayrollRunStatus(id, companyId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll-runs', companyId] });
      invalidateOnFinancialMutation(queryClient);
      setToast({ visible: true, message: t('payrollCreated'), type: 'success' });
    },
    onError: (e) => setToast({ visible: true, message: e?.message || t('saveFailed'), type: 'error' }),
  });

  const issuePaymentMutation = useMutation({
    mutationFn: ({ id }) => issuePayrollPayment({ payrollRunId: id, transactionDate: getSaudiToday() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll-runs', companyId] });
      invalidateOnFinancialMutation(queryClient);
      setToast({ visible: true, message: t('payrollPaidSuccess') || 'تم صرف المسيرة بنجاح', type: 'success' });
    },
    onError: (e) => setToast({ visible: true, message: e?.message || t('saveFailed'), type: 'error' }),
  });

  const items = data ?? [];
  const statusStyles = useMemo(() => ({
    draft: { bg: STATUS_MAP.draft.bg, color: STATUS_MAP.draft.color, label: t(STATUS_MAP.draft.labelKey) },
    completed: { bg: STATUS_MAP.completed.bg, color: STATUS_MAP.completed.color, label: t(STATUS_MAP.completed.labelKey) },
  }), [t]);

  const { filteredData, allFilteredData, searchText, setSearch, page, setPage, sortKey, sortDir, toggleSort } =
    useTableFilter(items, {
      searchKeys: ['runNumber', 'month'],
      pageSize: PAGE_SIZE,
      defaultSortKey: 'monthRaw',
      defaultSortDir: 'desc',
      dateKeys: ['monthRaw'],
    });

  const totalNet = allFilteredData.reduce((s, r) => s + (r.netTotal ?? 0), 0);

  const columns = useMemo(() => [
    { key: 'runNumber', label: t('payrollRunNumber'), sortable: true, width: 150, minWidth: 140,
      render: (v) => <span style={{ fontWeight: 700, color: 'var(--noorix-accent-blue)', fontFamily: 'var(--noorix-font-numbers)', whiteSpace: 'nowrap', fontSize: 13 }}>{v || '—'}</span> },
    { key: 'month', label: t('payrollMonth'), sortable: true, width: 130, minWidth: 120,
      render: (v) => <span style={{ fontSize: 13 }}>{v || '—'}</span> },
    { key: 'grossTotal', label: t('payrollGross'), numeric: true, sortable: true, width: 130, minWidth: 120,
      render: (v) => <span style={{ fontFamily: 'var(--noorix-font-numbers)', fontSize: 13 }}>{fmt(v)}</span> },
    { key: 'netTotal', label: t('payrollNet'), numeric: true, sortable: true, width: 130, minWidth: 120,
      render: (v) => <span style={{ fontWeight: 700, fontFamily: 'var(--noorix-font-numbers)', fontSize: 13 }}>{fmt(v)}</span> },
    { key: 'status', label: t('payrollStatus'), width: 120, minWidth: 110,
      render: (v) => (
        <span style={{
          padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700,
          background: statusStyles[v]?.bg || 'rgba(100,116,139,0.1)',
          color: statusStyles[v]?.color || '#64748b',
        }}>
          {statusStyles[v]?.label || v}
        </span>
      ) },
    { key: 'actions', label: t('actions'), width: '5%', align: 'center',
      render: (_, row) => (
        <HRActionsCell
          row={row}
          type="payroll"
          onView={() => setDetailRunId(row.id)}
          onApprove={row.status === 'draft' ? () => updateStatusMutation.mutate({ id: row.id, status: 'completed' }) : undefined}
          onPay={row.status === 'completed' ? () => issuePaymentMutation.mutate({ id: row.id }) : undefined}
        />
      ) },
  ], [t, statusStyles, updateStatusMutation, issuePaymentMutation]);

  const footerCells = (
    <>
      <td colSpan={2} style={{ padding: '6px 10px', fontSize: 12, color: 'var(--noorix-text-muted)', fontWeight: 600 }}>{t('payrollTotal')} ({allFilteredData.length})</td>
      <td style={{ padding: '6px 10px', fontFamily: 'var(--noorix-font-numbers)', fontSize: 13, textAlign: 'right' }}>{fmt(allFilteredData.reduce((s, r) => s + (r.grossTotal ?? 0), 0))}</td>
      <td style={{ padding: '6px 10px', fontFamily: 'var(--noorix-font-numbers)', fontSize: 13, fontWeight: 900, color: '#16a34a', textAlign: 'right' }}>{fmt(totalNet)}</td>
      <td colSpan={2} />
    </>
  );

  const exportData = allFilteredData.map((r) => ({
    runNumber: r.runNumber,
    month: r.month,
    grossTotal: fmt(r.grossTotal),
    netTotal: fmt(r.netTotal),
    status: statusStyles[r.status]?.label || r.status,
  }));

  function handleExportExcel() {
    exportToExcel(exportData, `payroll-runs-${year}.xlsx`);
  }

  function handlePrint() {
    const rows = allFilteredData.map((r) =>
      `<tr><td>${(r.runNumber || '').replace(/</g, '&lt;')}</td><td>${(r.month || '').replace(/</g, '&lt;')}</td><td>${fmt(r.grossTotal)}</td><td>${fmt(r.netTotal)}</td><td>${(statusStyles[r.status]?.label || r.status).replace(/</g, '&lt;')}</td></tr>`
    ).join('');
    const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>${(t('hrTabPayroll') || '').replace(/</g, '&lt;')}</title>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&display=swap" rel="stylesheet"><style>@page{size:A4;margin:15mm}*{box-sizing:border-box}body{font-family:'Cairo',Arial,sans-serif;margin:0;padding:24px;font-size:14px;color:#1a1a1a;line-height:1.6}.header{text-align:center;border-bottom:2px solid #333;padding-bottom:16px;margin-bottom:24px}.header h1{margin:8px 0 4px;font-size:20px}table{width:100%;border-collapse:collapse;font-size:14px}td,th{padding:8px 12px;border:1px solid #ddd}th{background:#2563eb;color:#fff;font-weight:700}@media print{body{padding:0}}</style></head><body>
<div class="header"><h1>${(companyName || 'الشركة').replace(/</g, '&lt;')}</h1><div>${(t('hrTabPayroll') || '').replace(/</g, '&lt;')} — ${year}</div></div>
<table><thead><tr><th>${t('payrollRunNumber')}</th><th>${t('payrollMonth')}</th><th>${t('payrollGross')}</th><th>${t('payrollNet')}</th><th>${t('payrollStatus')}</th></tr></thead><tbody>${rows || '<tr><td colspan="5">' + t('noDataInPeriod') + '</td></tr>'}</tbody></table>
</body></html>`;
    const w = window.open('', '_blank');
    if (w) {
      w.document.write(html);
      w.document.close();
      w.onafterprint = () => { try { w.close(); } catch (_) {} };
      w.onload = () => setTimeout(() => w.print(), 300);
    }
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <Toast visible={toast.visible} message={toast.message} type={toast.type} onDismiss={() => setToast((p) => ({ ...p, visible: false }))} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <label style={{ fontSize: 13, fontWeight: 600 }}>{t('dateFilterYear')}</label>
        <select
          value={year}
          onChange={(e) => setYear(parseInt(e.target.value, 10))}
          style={{
            padding: '8px 12px', borderRadius: 8, border: '1px solid var(--noorix-border)',
            background: 'var(--noorix-bg-surface)', fontSize: 14,
          }}
        >
          {[new Date().getFullYear(), new Date().getFullYear() - 1].map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <div style={{ marginRight: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="noorix-btn-nav" onClick={handleExportExcel}>{t('exportExcel')}</button>
          <button type="button" className="noorix-btn-nav" onClick={handlePrint}>{t('printPayroll')}</button>
        </div>
        <button
          type="button"
          className="noorix-btn-nav noorix-btn-primary"
          onClick={() => setShowCreate(true)}
        >
          {t('createPayrollRun')}
        </button>
      </div>

      <SmartTable
        compact
        showRowNumbers
        rowNumberWidth="1%"
        innerPadding={8}
        columns={columns}
        data={filteredData}
        total={allFilteredData.length}
        page={page}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
        isLoading={isLoading}
        title={t('hrTabPayroll')}
        badge={
          <>
            <span style={{ fontSize: 12, color: 'var(--noorix-text-muted)' }}>— {year}</span>
            <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 999, background: 'rgba(37,99,235,0.08)', color: '#2563eb', fontWeight: 700 }}>{allFilteredData.length}</span>
          </>
        }
        searchValue={searchText}
        onSearchChange={setSearch}
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={toggleSort}
        footerCells={footerCells}
        emptyMessage={t('noDataInPeriod')}
      />

      {showCreate && (
        <PayrollRunFormModal
          companyId={companyId}
          onCreate={() => {
            queryClient.invalidateQueries({ queryKey: ['payroll-runs', companyId] });
            invalidateOnFinancialMutation(queryClient);
            setToast({ visible: true, message: t('payrollCreated'), type: 'success' });
          }}
          onClose={() => setShowCreate(false)}
        />
      )}

      {detailRunId && (
        <PayrollRunDetailModal
          runId={detailRunId}
          companyId={companyId}
          companyName={companyName}
          companyLogo={companyLogo}
          onClose={() => setDetailRunId(null)}
        />
      )}
    </div>
  );
}
