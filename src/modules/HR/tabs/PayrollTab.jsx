/**
 * PayrollTab — مسيرات الرواتب (احترافي كامل)
 */
import React, { useState, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { invalidateOnFinancialMutation } from '../../../utils/queryInvalidation';
import { useApp } from '../../../context/AppContext';
import { useTranslation } from '../../../i18n/useTranslation';
import { getPayrollRuns, updatePayrollRunStatus, issuePayrollPayment, deletePayrollRun } from '../../../services/api';
import { useVaults } from '../../../hooks/useVaults';
import { formatSaudiDate } from '../../../utils/saudiDate';
import { hrFmt } from '../utils/hrFmt';
import { exportToExcel } from '../../../utils/exportUtils';
import { useTableFilter } from '../../../hooks/useTableFilter';
import { getSaudiToday } from '../../../utils/saudiDate';
import SmartTable from '../../../components/common/SmartTable';
import { PayrollRunFormModal } from '../components/PayrollRunFormModal';
import { PayrollRunDetailModal } from '../components/PayrollRunDetailModal';
import { HRActionsCell } from '../components/HRActionsCell';
import { useToast } from '../../../context/ToastContext';
import { useApiMutation } from '../../../hooks/useApiMutation';
import { Button, Badge, Input, ScreenShell, Modal } from '../../../ui';
import { buildPayrollRunStatusMap } from '../../../constants/badgeMaps';
import { canDeletePayrollRunRole, resolveUserRole } from '../../../constants/permissions';

const PAGE_SIZE = 50;

/** آخر يوم تقويمي من شهر المسيرة نفسه (YYYY-MM-DD) — مثال: مسيرة مارس → 31 مارس */
function lastDayOfPayrollMonth(monthRaw) {
  if (!monthRaw) return null;
  const s = String(monthRaw).slice(0, 10);
  const [y, m] = s.split('-').map((x) => parseInt(x, 10));
  if (!y || !m || m < 1 || m > 12) return null;
  const last = new Date(Date.UTC(y, m, 0));
  const dd = String(last.getUTCDate()).padStart(2, '0');
  const mm2 = String(last.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${mm2}-${dd}`;
}

export default function PayrollTab() {
  const { t } = useTranslation();
  const { activeCompanyId, companies, userRole, user } = useApp();
  const effectiveRole = resolveUserRole(user?.role ?? userRole);
  const canDeletePayroll = canDeletePayrollRunRole(effectiveRole);
  const companyId = activeCompanyId ?? '';
  const activeCompany = companies?.find((c) => c.id === companyId);
  const companyName = activeCompany?.nameAr || activeCompany?.name || '';
  const companyLogo = activeCompany?.logoUrl || '';
  const [year, setYear] = useState(new Date().getFullYear());
  const [showCreate, setShowCreate] = useState(false);
  const [editingRunId, setEditingRunId] = useState(null);
  const [detailRunId, setDetailRunId] = useState(null);
  const [payModalRun, setPayModalRun] = useState(null);
  const [payTransactionDate, setPayTransactionDate] = useState(() => getSaudiToday());
  const [payVaultId, setPayVaultId] = useState('');
  const [paySecondVaultId, setPaySecondVaultId] = useState('');
  const [paySecondAmount, setPaySecondAmount] = useState('');
  const [paySecondEnabled, setPaySecondEnabled] = useState(false);
  const [payVaultError, setPayVaultError] = useState('');
  const { showToast } = useToast();
  const { paymentVaults = [] } = useVaults({ companyId });
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

  const updateStatusMutation = useApiMutation({
    mutationFn: ({ id, status }) => updatePayrollRunStatus(id, companyId, status),
    invalidateQueries: [['payroll-runs', companyId]],
    successToast: () => t('payrollCreated'),
    errorToast: (e) => e?.message || t('saveFailed'),
    onSuccess: () => invalidateOnFinancialMutation(queryClient),
  });

  const issuePaymentMutation = useApiMutation({
    mutationFn: ({ id, transactionDate, vaultSplits }) =>
      issuePayrollPayment({
        payrollRunId: id,
        transactionDate: transactionDate || getSaudiToday(),
        vaultSplits: vaultSplits?.length ? vaultSplits : undefined,
      }),
    invalidateQueries: [['payroll-runs', companyId]],
    successToast: () => t('payrollPaidSuccess') || 'تم صرف المسيرة بنجاح',
    errorToast: (e) => e?.message || t('saveFailed'),
    onSuccess: () => {
      invalidateOnFinancialMutation(queryClient);
      setPayModalRun(null);
      setPayVaultId('');
      setPaySecondVaultId('');
      setPaySecondAmount('');
      setPaySecondEnabled(false);
      setPayVaultError('');
    },
  });

  const openPayModal = useCallback((row) => {
    setPayModalRun({
      id: row.id,
      runNumber: row.runNumber,
      month: row.month,
      netTotal: row.netTotal,
    });
    setPayTransactionDate(lastDayOfPayrollMonth(row.monthRaw) || getSaudiToday());
    setPayVaultId('');
    setPaySecondVaultId('');
    setPaySecondAmount('');
    setPaySecondEnabled(false);
    setPayVaultError('');
  }, []);

  const deleteRunMutation = useApiMutation({
    mutationFn: ({ id }) => deletePayrollRun(id, companyId),
    invalidateQueries: [['payroll-runs', companyId]],
    successToast: () => t('payrollDeleted') || t('deletedSuccessfully'),
    errorToast: (e) => e?.message || t('saveFailed'),
    onSuccess: () => invalidateOnFinancialMutation(queryClient),
  });

  const handleDeletePayrollRun = useCallback((row) => {
    const st = String(row?.status || '').toLowerCase();
    const msg =
      st === 'draft'
        ? (t('deletePayrollRunConfirm') || 'هل تريد حذف مسيرة الراتب هذه؟')
        : (t('deletePayrollRunConfirmCompleted') || t('deletePayrollRunConfirm'));
    if (!window.confirm(msg)) return;
    deleteRunMutation.mutate({ id: row.id });
  }, [deleteRunMutation, t]);

  const items = data ?? [];
  const payrollStatusMap = useMemo(() => buildPayrollRunStatusMap(t), [t]);

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
        <Badge {...Badge.fromStatus(v, payrollStatusMap)} size="sm" />
      ) },
    { key: 'actions', label: t('actions'), width: '5%', align: 'center',
      render: (_, row) => (
        <HRActionsCell
          row={row}
          type="payroll"
          onView={() => setDetailRunId(row.id)}
          onEdit={String(row.status || '').toLowerCase() === 'draft' ? () => setEditingRunId(row.id) : undefined}
          onDelete={canDeletePayroll ? () => handleDeletePayrollRun(row) : undefined}
          onApprove={String(row.status || '').toLowerCase() === 'draft' ? () => updateStatusMutation.mutate({ id: row.id, status: 'completed' }) : undefined}
          onPay={String(row.status || '').toLowerCase() === 'completed' ? () => openPayModal(row) : undefined}
        />
      ) },
  ], [t, payrollStatusMap, updateStatusMutation, handleDeletePayrollRun, openPayModal, canDeletePayroll]);

  const footerCells = (
    <>
      <td colSpan={2} className="text-[12px] text-noorix-muted font-semibold py-1.5 px-3">{t('payrollTotal')} ({allFilteredData.length})</td>
      <td className="text-[13px] text-end py-1.5 px-3 nx-font-numbers">{hrFmt(allFilteredData.reduce((s, r) => s + (r.grossTotal ?? 0), 0))}</td>
      <td className="text-[13px] text-end py-1.5 px-3 text-noorix-green font-black nx-font-numbers">{hrFmt(totalNet)}</td>
      <td colSpan={2} />
    </>
  );

  const exportData = allFilteredData.map((r) => ({
    runNumber: r.runNumber,
    month: r.month,
    grossTotal: hrFmt(r.grossTotal),
    netTotal: hrFmt(r.netTotal),
    status: payrollStatusMap[r.status]?.label || r.status,
  }));

  const renderMobileCard = useCallback((row) => {
    return (
      <div>
        <div className="flex items-center justify-between flex flex-wrap mb-1">
          <span className="nx-cell-num nx-cell-accent text-[14px]">{row.runNumber}</span>
          <Badge {...Badge.fromStatus(row.status, payrollStatusMap)} size="sm" className="shrink-0" />
        </div>
        {row.month && <div className="nx-cell-muted mb-2">{row.month}</div>}
          <div className="grid grid-cols-2 gap-1.5 rounded-lg bg-noorix-bg-muted mb-2.5 py-2 px-[10px]">
          <div>
            <div className="text-noorix-muted mb-1 text-[10px]">{t('payrollGross')}</div>
            <div className="text-[14px] nx-font-numbers">{hrFmt(row.grossTotal)}</div>
          </div>
          <div>
            <div className="text-noorix-muted mb-1 text-[10px]">{t('payrollNet')}</div>
            <div className="text-[15px] font-extrabold text-noorix-green nx-font-numbers">{hrFmt(row.netTotal)}</div>
          </div>
        </div>
        <div className="flex flex items-center justify-end">
          <HRActionsCell
            row={row}
            type="payroll"
            onView={() => setDetailRunId(row.id)}
            onEdit={String(row.status || '').toLowerCase() === 'draft' ? () => setEditingRunId(row.id) : undefined}
            onDelete={canDeletePayroll ? () => handleDeletePayrollRun(row) : undefined}
            onApprove={String(row.status || '').toLowerCase() === 'draft' ? () => updateStatusMutation.mutate({ id: row.id, status: 'completed' }) : undefined}
            onPay={String(row.status || '').toLowerCase() === 'completed' ? () => openPayModal(row) : undefined}
          />
        </div>
      </div>
    );
  }, [payrollStatusMap, t, updateStatusMutation, handleDeletePayrollRun, openPayModal, canDeletePayroll]);

  function handleExportExcel() {
    exportToExcel(exportData, `payroll-runs-${year}.xlsx`);
  }

  function handlePrint() {
    const rows = allFilteredData.map((r) =>
      `<tr><td>${(r.runNumber || '').replace(/</g, '&lt;')}</td><td>${(r.month || '').replace(/</g, '&lt;')}</td><td>${hrFmt(r.grossTotal)}</td><td>${hrFmt(r.netTotal)}</td><td>${(payrollStatusMap[r.status]?.label || r.status).replace(/</g, '&lt;')}</td></tr>`
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
    <ScreenShell>
      <div className="mb-3 flex min-h-11 flex-col gap-3 border-b border-noorix-border pb-3 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between lg:gap-2">
        <div className="nx-toolbar min-w-0 flex-1">
          <label className="text-[13px] font-semibold shrink-0">{t('dateFilterYear')}</label>
          <Input type="select" value={year} onChange={(e) => setYear(parseInt(e.target.value, 10))}>
            {[new Date().getFullYear(), new Date().getFullYear() - 1].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </Input>
          <Button size="sm" onClick={handleExportExcel}>{t('exportExcel')}</Button>
          <Button size="sm" onClick={handlePrint}>{t('printPayroll')}</Button>
        </div>
        <Input
          type="search"
          value={searchText}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('searchPlaceholder')}
          size="sm"
          className="w-full min-w-0 lg:max-w-xs lg:flex-1"
          aria-label={t('searchPlaceholder')}
        />
        <Button variant="primary" size="sm" className="shrink-0" onClick={() => setShowCreate(true)}>
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
        showSearchInHeader={false}
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
            showToast(t('payrollCreated'), 'success');
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
            showToast(t('payrollUpdated') || t('savedSuccessfully'), 'success');
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

      <Modal
        open={!!payModalRun}
        onClose={() => {
          if (issuePaymentMutation.isPending) return;
          setPayModalRun(null);
        }}
        title={t('payrollPayConfirmTitle')}
        size="md"
        footer={(
          <>
            <Button
              size="md"
              variant="ghost"
              disabled={issuePaymentMutation.isPending}
              onClick={() => setPayModalRun(null)}
            >
              {t('cancel')}
            </Button>
            <Button
              size="md"
              variant="primary"
              loading={issuePaymentMutation.isPending}
              onClick={() => {
                if (!payModalRun || !payTransactionDate) return;
                setPayVaultError('');
                const netTotal = payModalRun.netTotal ?? 0;
                let vaultSplits = [];
                if (paySecondEnabled) {
                  const v1 = payVaultId.trim();
                  const v2 = paySecondVaultId.trim();
                  const a2 = parseFloat(paySecondAmount);
                  if (!v1 || !v2) { setPayVaultError(t('payrollSplitVaultsIncomplete')); return; }
                  if (v1 === v2) { setPayVaultError(t('invoiceVaultsMustDiffer')); return; }
                  if (Number.isNaN(a2) || a2 <= 0 || a2 >= netTotal - 0.001) { setPayVaultError(t('payrollSplitVaultsIncomplete')); return; }
                  const a1 = Math.round((netTotal - a2) * 100) / 100;
                  vaultSplits = [{ vaultId: v1, amount: a1 }, { vaultId: v2, amount: a2 }];
                } else if (payVaultId.trim()) {
                  vaultSplits = [{ vaultId: payVaultId.trim(), amount: netTotal }];
                }
                issuePaymentMutation.mutate({
                  id: payModalRun.id,
                  transactionDate: payTransactionDate,
                  vaultSplits,
                });
              }}
            >
              {t('payrollPayConfirm')}
            </Button>
          </>
        )}
      >
        <div className="flex flex-col gap-3">
          {payModalRun && (
            <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-noorix-border">
              <span className="text-[13px] text-noorix-text">
                <span className="text-noorix-muted">{t('payrollRunNumber')}: </span>
                <span className="font-semibold">{payModalRun.runNumber}</span>
                {payModalRun.month && (
                  <>
                    <span className="text-noorix-muted"> — {t('payrollMonth')}: </span>
                    <span className="font-semibold">{payModalRun.month}</span>
                  </>
                )}
              </span>
              {payModalRun.netTotal != null && (
                <span className="text-[16px] font-extrabold text-noorix-green ltr nx-font-numbers">
                  {hrFmt(payModalRun.netTotal)}
                </span>
              )}
            </div>
          )}
          <div>
            <label className="mb-1.5 block text-[12px] font-semibold text-noorix-muted" htmlFor="payroll-issue-date">
              {t('transactionDate')}
            </label>
            <Input
              id="payroll-issue-date"
              type="date"
              value={payTransactionDate}
              onChange={(e) => setPayTransactionDate(e.target.value)}
            />
          </div>

          <div className="noorix-surface-card p-3 flex flex-col gap-2.5">
            <p className="m-0 text-[11px] font-semibold text-noorix-muted">{t('payrollRunPayVaultSection')}</p>
            <Input
              type="select"
              label={t('payrollPayVaultCol')}
              value={payVaultId}
              onChange={(e) => setPayVaultId(e.target.value)}
            >
              <option value="">{t('payrollPayVaultDefault')}</option>
              {paymentVaults.map((v) => (
                <option key={v.id} value={v.id}>{v.nameAr || v.nameEn || v.id}</option>
              ))}
            </Input>
            {!paySecondEnabled ? (
              <Button type="button" size="sm" variant="ghost" className="self-start" onClick={() => setPaySecondEnabled(true)}>
                {t('payrollAddSecondVaultShort')}
              </Button>
            ) : (
              <div className="flex flex-col gap-2">
                <Input
                  type="select"
                  label={t('secondVaultSelectLabel')}
                  value={paySecondVaultId}
                  onChange={(e) => setPaySecondVaultId(e.target.value)}
                >
                  <option value="">—</option>
                  {paymentVaults.map((v) => (
                    <option key={v.id} value={v.id} disabled={v.id === payVaultId}>
                      {v.nameAr || v.nameEn || v.id}
                    </option>
                  ))}
                </Input>
                <Input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0.01"
                  label={t('payrollSecondVaultAmountShort')}
                  value={paySecondAmount}
                  onChange={(e) => setPaySecondAmount(e.target.value)}
                />
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  {paySecondAmount && payVaultId && (
                    <span className="text-[11px] text-noorix-muted">{t('payrollPayVaultSplitHint')}</span>
                  )}
                  <Button type="button" size="sm" variant="ghost" onClick={() => { setPaySecondEnabled(false); setPaySecondVaultId(''); setPaySecondAmount(''); }}>
                    {t('payrollRemoveVaultSplit')}
                  </Button>
                </div>
              </div>
            )}
          </div>

          {payVaultError && (
            <p className="m-0 text-[12px] font-semibold text-noorix-red">{payVaultError}</p>
          )}
          <p className="m-0 text-[12px] text-noorix-muted leading-relaxed">{t('payrollPayDateHelp')}</p>
        </div>
      </Modal>
    </ScreenShell>
  );
}
