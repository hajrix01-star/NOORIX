/**
 * PayrollTab — مسيرات الرواتب (احترافي كامل)
 */
import React, { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { invalidateOnFinancialMutation } from '../../../utils/queryInvalidation';
import { useApp } from '../../../context/AppContext';
import { useTranslation } from '../../../i18n/useTranslation';
import { getPayrollRuns, updatePayrollRunStatus, issuePayrollPayment, deletePayrollRun } from '../../../services/api';
import { formatSaudiDate } from '../../../utils/saudiDate';
import { hrFmt } from '../utils/hrFmt';
import { exportToExcel } from '../../../utils/exportUtils';
import { useTableFilter } from '../../../hooks/useTableFilter';
import { getSaudiToday } from '../../../utils/saudiDate';
import SmartTable from '../../../components/common/SmartTable';
import { PayrollRunFormModal } from '../components/PayrollRunFormModal';
import { PayrollRunDetailModal } from '../components/PayrollRunDetailModal';
import { HRActionsCell } from '../components/HRActionsCell';
import Toast from '../../../components/Toast';
import { Button, Badge, Input } from '../../../ui';

const PAGE_SIZE = 50;

const STATUS_MAP = {
  draft: { bg: 'var(--noorix-muted-10)', color: 'var(--noorix-text-muted)', labelKey: 'payrollDraft' },
  completed: { bg: 'var(--noorix-green-10)', color: 'var(--noorix-accent-green)', labelKey: 'payrollPaid' },
};

const statusColorMap = { draft: 'gray', completed: 'green' };

export default function PayrollTab() {
  const { t } = useTranslation();
  const { activeCompanyId, companies } = useApp();
  const companyId = activeCompanyId ?? '';
  const activeCompany = companies?.find((c) => c.id === companyId);
  const companyName = activeCompany?.nameAr || activeCompany?.name || '';
  const companyLogo = activeCompany?.logoUrl || '';
  const [year, setYear] = useState(new Date().getFullYear());
  const [showCreate, setShowCreate] = useState(false);
  const [editingRunId, setEditingRunId] = useState(null);
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

  const deleteRunMutation = useMutation({
    mutationFn: ({ id }) => deletePayrollRun(id, companyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll-runs', companyId] });
      invalidateOnFinancialMutation(queryClient);
      setToast({ visible: true, message: t('payrollDeleted') || t('deletedSuccessfully'), type: 'success' });
    },
    onError: (e) => setToast({ visible: true, message: e?.message || t('saveFailed'), type: 'error' }),
  });

  const handleDeleteDraft = useCallback((id) => {
    if (!window.confirm(t('deletePayrollRunConfirm') || 'هل تريد حذف مسيرة الراتب هذه؟')) return;
    deleteRunMutation.mutate({ id });
  }, [deleteRunMutation, t]);

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
      render: (v) => <span className="nx-cell-num nx-cell-accent text-[13px] whitespace-nowrap">{v || '—'}</span> },
    { key: 'month', label: t('payrollMonth'), sortable: true, width: 130, minWidth: 120,
      render: (v) => <span className="text-[13px]">{v || '—'}</span> },
    { key: 'grossTotal', label: t('payrollGross'), numeric: true, sortable: true, width: 130, minWidth: 120,
      render: (v) => <span className="nx-cell-num text-[13px]">{hrFmt(v)}</span> },
    { key: 'netTotal', label: t('payrollNet'), numeric: true, sortable: true, width: 130, minWidth: 120,
      render: (v) => <span className="nx-cell-num font-bold text-[13px]">{hrFmt(v)}</span> },
    { key: 'status', label: t('payrollStatus'), width: 120, minWidth: 110,
      render: (v) => (
        <Badge color={statusColorMap[v] || 'gray'} size="sm">
          {statusStyles[v]?.label || v}
        </Badge>
      ) },
    { key: 'actions', label: t('actions'), width: '5%', align: 'center',
      render: (_, row) => (
        <HRActionsCell
          row={row}
          type="payroll"
          onView={() => setDetailRunId(row.id)}
          onEdit={row.status === 'draft' ? () => setEditingRunId(row.id) : undefined}
          onDelete={row.status === 'draft' ? () => handleDeleteDraft(row.id) : undefined}
          onApprove={row.status === 'draft' ? () => updateStatusMutation.mutate({ id: row.id, status: 'completed' }) : undefined}
          onPay={row.status === 'completed' ? () => issuePaymentMutation.mutate({ id: row.id }) : undefined}
        />
      ) },
  ], [t, statusStyles, updateStatusMutation, issuePaymentMutation, handleDeleteDraft]);

  const footerCells = (
    <>
      <td colSpan={2} className="text-[12px] text-noorix-muted font-semibold py-1.5 px-3">{t('payrollTotal')} ({allFilteredData.length})</td>
      <td className="text-[13px] text-end py-1.5 px-3" style={{ fontFamily: 'var(--noorix-font-numbers)' }}>{hrFmt(allFilteredData.reduce((s, r) => s + (r.grossTotal ?? 0), 0))}</td>
      <td className="text-[13px] text-end py-1.5 px-3 text-noorix-green" style={{ fontFamily: 'var(--noorix-font-numbers)', fontWeight: 900 }}>{hrFmt(totalNet)}</td>
      <td colSpan={2} />
    </>
  );

  const exportData = allFilteredData.map((r) => ({
    runNumber: r.runNumber,
    month: r.month,
    grossTotal: hrFmt(r.grossTotal),
    netTotal: hrFmt(r.netTotal),
    status: statusStyles[r.status]?.label || r.status,
  }));

  const renderMobileCard = useCallback((row) => {
    const ss = statusStyles[row.status] || { label: row.status };
    return (
      <div>
        <div className="flex items-center justify-between flex flex-wrap mb-1">
          <span className="nx-cell-num nx-cell-accent text-[14px]">{row.runNumber}</span>
          <Badge color={statusColorMap[row.status] || 'gray'} size="sm" style={{ flexShrink: 0 }}>{ss.label}</Badge>
        </div>
        {row.month && <div className="nx-cell-muted mb-2">{row.month}</div>}
          <div className="grid grid-cols-2 gap-1.5 rounded-lg bg-noorix-bg-muted mb-2.5" style={{ padding: '8px 10px' }}>
          <div>
            <div className="text-noorix-muted mb-1" style={{ fontSize: 10 }}>{t('payrollGross')}</div>
            <div className="text-[14px]" style={{ fontFamily: 'var(--noorix-font-numbers)' }}>{hrFmt(row.grossTotal)}</div>
          </div>
          <div>
            <div className="text-noorix-muted mb-1" style={{ fontSize: 10 }}>{t('payrollNet')}</div>
            <div className="text-[15px] font-extrabold text-noorix-green" style={{ fontFamily: 'var(--noorix-font-numbers)' }}>{hrFmt(row.netTotal)}</div>
          </div>
        </div>
        <div className="flex flex items-center justify-end">
          <HRActionsCell
            row={row}
            type="payroll"
            onView={() => setDetailRunId(row.id)}
            onEdit={row.status === 'draft' ? () => setEditingRunId(row.id) : undefined}
            onDelete={row.status === 'draft' ? () => handleDeleteDraft(row.id) : undefined}
            onApprove={row.status === 'draft' ? () => updateStatusMutation.mutate({ id: row.id, status: 'completed' }) : undefined}
            onPay={row.status === 'completed' ? () => issuePaymentMutation.mutate({ id: row.id }) : undefined}
          />
        </div>
      </div>
    );
  }, [statusStyles, t, updateStatusMutation, issuePaymentMutation, handleDeleteDraft]);

  function handleExportExcel() {
    exportToExcel(exportData, `payroll-runs-${year}.xlsx`);
  }

  function handlePrint() {
    const rows = allFilteredData.map((r) =>
      `<tr><td>${(r.runNumber || '').replace(/</g, '&lt;')}</td><td>${(r.month || '').replace(/</g, '&lt;')}</td><td>${hrFmt(r.grossTotal)}</td><td>${hrFmt(r.netTotal)}</td><td>${(statusStyles[r.status]?.label || r.status).replace(/</g, '&lt;')}</td></tr>`
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
    <div className="flex flex-col gap-4 p-4 lg:p-6">
      <Toast visible={toast.visible} message={toast.message} type={toast.type} onDismiss={() => setToast((p) => ({ ...p, visible: false }))} />

      <div className="nx-toolbar">
        <label className="text-[13px] font-semibold">{t('dateFilterYear')}</label>
        <Input type="select" value={year} onChange={(e) => setYear(parseInt(e.target.value, 10))}>
          {[new Date().getFullYear(), new Date().getFullYear() - 1].map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </Input>
        <div className="flex flex flex-wrap gap-2 flex-1 min-w-0">
          <Button onClick={handleExportExcel}>{t('exportExcel')}</Button>
          <Button onClick={handlePrint}>{t('printPayroll')}</Button>
        </div>
        <Button variant="primary" onClick={() => setShowCreate(true)}>
          {t('createPayrollRun')}
        </Button>
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
            <span className="nx-cell-muted">— {year}</span>
            <span className="nx-pill nx-pill--blue nx-pill--sm">{allFilteredData.length}</span>
          </>
        }
        searchValue={searchText}
        onSearchChange={setSearch}
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={toggleSort}
        footerCells={footerCells}
        emptyMessage={t('noDataInPeriod')}
        renderMobileCard={renderMobileCard}
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

      {editingRunId && (
        <PayrollRunFormModal
          companyId={companyId}
          runId={editingRunId}
          onCreate={() => {
            queryClient.invalidateQueries({ queryKey: ['payroll-runs', companyId] });
            queryClient.invalidateQueries({ queryKey: ['payroll-run', editingRunId, companyId] });
            invalidateOnFinancialMutation(queryClient);
            setToast({ visible: true, message: t('payrollUpdated') || t('savedSuccessfully'), type: 'success' });
          }}
          onClose={() => setEditingRunId(null)}
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
