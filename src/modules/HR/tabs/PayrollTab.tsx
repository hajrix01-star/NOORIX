/**
 * PayrollTab — مسيرات الرواتب (احترافي كامل)
 */
import React, { useState, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { invalidateOnFinancialMutation } from '../../../utils/queryInvalidation';
import { useApp } from '../../../context/AppContext';
import { useTranslation } from '../../../i18n/useTranslation';
import { getPayrollRuns, updatePayrollRunStatus, issuePayrollPayment, deletePayrollRun, throwIfApiFailed } from '../../../services/api';
import { useVaults } from '../../../hooks/useVaults';
import { vaultDisplayName } from '../../../utils/vaultDisplay';
import { formatSaudiDate, getSaudiToday, toYmd } from '../../../utils/saudiDate';
import { hrFmt } from '../utils/hrFmt';
import { exportToExcel } from '../../../utils/exportUtils';
import { openPrintWindow } from '../../../utils/printUtils';
import { useTableFilter } from '../../../hooks/useTableFilter';
import { PayrollRunFormModal } from '../components/PayrollRunFormModal';
import { PayrollRunDetailModal } from '../components/PayrollRunDetailModal';
import { HRActionsCell } from '../components/HRActionsCell';
import { useToast } from '../../../context/ToastContext';
import { useApiMutation } from '../../../hooks/useApiMutation';
import { Button, Badge, Input, ScreenShell, Modal, FmtNum, KebabMenu, SmartTable } from '../../../ui';
import { buildPayrollRunStatusMap } from '../../../constants/badgeMaps';
import { canDeletePayrollRunRole, resolveUserRole } from '../../../constants/permissions';
import { payrollSalaryInvoiceListHref } from '../utils/payrollSalaryInvoiceHref';
import { hrKeys } from '../../../services/queryKeys';
import { HR_EMBEDDED_SHELL_CLASS } from '../hrWorkspaceLayout';
import { HrTabToolbar } from '../components/HrTabToolbar';

const PAGE_SIZE = 50;

/** آخر يوم تقويمي من شهر المسيرة نفسه (YYYY-MM-DD) — مثال: مسيرة مارس → 31 مارس */
function lastDayOfPayrollMonth(monthRaw: any) {
  if (!monthRaw) return null;
  const s = toYmd(monthRaw);
  const [y, m] = s.split('-').map((x: any) => parseInt(x, 10));
  if (!y || !m || m < 1 || m > 12) return null;
  const last = new Date(Date.UTC(y, m, 0));
  const dd = String(last.getUTCDate()).padStart(2, '0');
  const mm2 = String(last.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${mm2}-${dd}`;
}

type PayrollTabProps = { embedded?: boolean };

export default function PayrollTab({ embedded }: PayrollTabProps = {}) {
  const { t, lang } = useTranslation();
  const { activeCompanyId, companies, userRole, user } = useApp();
  const effectiveRole = resolveUserRole(user?.role ?? userRole);
  const canDeletePayroll = canDeletePayrollRunRole(effectiveRole);
  const companyId = activeCompanyId ?? '';
  const activeCompany = companies?.find((c: any) => c.id === companyId);
  const companyName = activeCompany?.nameAr || activeCompany?.name || '';
  const companyLogo = activeCompany?.logoUrl || '';
  const [year, setYear] = useState(new Date().getFullYear());
  const [showCreate, setShowCreate] = useState(false);
  const [editingRunId, setEditingRunId] = useState<any>(null);
  const [detailRunId, setDetailRunId] = useState<any>(null);
  const [payModalRun, setPayModalRun] = useState<any>(null);
  const [payTransactionDate, setPayTransactionDate] = useState(() => getSaudiToday());
  const [payVaultId, setPayVaultId] = useState('');
  const [paySecondVaultId, setPaySecondVaultId] = useState('');
  const [paySecondAmount, setPaySecondAmount] = useState('');
  const [paySecondEnabled, setPaySecondEnabled] = useState(false);
  const [payVaultError, setPayVaultError] = useState('');
  const { showToast } = useToast();
  const { paymentVaults = [] } = useVaults({ companyId });
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: hrKeys.payrollRuns(companyId, year),
    queryFn: async () => {
      const res = await getPayrollRuns(companyId, year);
      throwIfApiFailed(res, 'فشل تحميل مسيرات الرواتب');
      const raw = Array.isArray(res.data) ? res.data : (res.data?.items ?? []);
      return raw.map((run: any) => {
        const grossTotal = Array.isArray(run.items)
          ? run.items.reduce((s: any, i: any) => s + Number(i?.grossSalary ?? 0), 0)
          : Number(run.totalAmount ?? 0);
        return {
          id: run.id,
          runNumber: run.runNumber,
          month: run.payrollMonth ? formatSaudiDate(run.payrollMonth) : null,
          monthRaw: run.payrollMonth,
          grossTotal,
          netTotal: Number(run.totalAmount ?? 0),
          status: run.status,
          issuedInvoiceNumber: run.issuedSalaryInvoiceNumber ?? null,
          itemsCount: run.items?.length ?? 0,
        };
      });
    },
    enabled: !!companyId,
  });

  const updateStatusMutation = useApiMutation({
    mutationFn: ({ id, status }: any) => updatePayrollRunStatus(id, companyId, status),
    successToast: () => t('payrollCreated'),
    errorToast: (e: any) => e?.message || t('saveFailed'),
    onSuccess: () => invalidateOnFinancialMutation(queryClient),
  });

  const issuePaymentMutation = useApiMutation({
    mutationFn: ({ id, transactionDate, vaultSplits }: any) =>
      issuePayrollPayment({
        payrollRunId: id,
        transactionDate: transactionDate || getSaudiToday(),
        vaultSplits: vaultSplits?.length ? vaultSplits : undefined,
      }),
    successToast: () => t('payrollPaidSuccess') || 'تم صرف المسيرة بنجاح',
    errorToast: (e: any) => e?.message || t('saveFailed'),
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

  const openPayModal = useCallback((row: any) => {
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
    mutationFn: ({ id }: any) => deletePayrollRun(id, companyId),
    successToast: () => t('payrollDeleted') || t('deletedSuccessfully'),
    errorToast: (e: any) => e?.message || t('saveFailed'),
    onSuccess: () => invalidateOnFinancialMutation(queryClient),
  });

  const handleDeletePayrollRun = useCallback((row: any) => {
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

  const payrollRunBadgeProps = useCallback(
    (row: any) => {
      const st = String(row?.status || '').toLowerCase();
      if (st === 'completed' && row?.issuedInvoiceNumber) {
        return { color: 'green', children: t('payrollPaid') };
      }
      return Badge.fromStatus(row?.status, payrollStatusMap);
    },
    [t, payrollStatusMap],
  );

  const payrollRunExportStatusLabel = useCallback(
    (row: any) => {
      const st = String(row?.status || '').toLowerCase();
      if (st === 'completed' && row?.issuedInvoiceNumber) return t('payrollPaid');
      if (st === 'completed') return t('payrollApproved');
      return (payrollStatusMap as Record<string, { label?: string }>)[row.status]?.label ?? row.status ?? '';
    },
    [t, payrollStatusMap],
  );

  const { filteredData, allFilteredData, searchText, setSearch, page, setPage, sortKey, sortDir, toggleSort } =
    useTableFilter(items, {
      searchKeys: ['runNumber', 'month', 'issuedInvoiceNumber'],
      pageSize: PAGE_SIZE,
      defaultSortKey: 'monthRaw',
      defaultSortDir: 'desc',
      dateKeys: ['monthRaw'],
    });

  const totalNet = allFilteredData.reduce((s: any, r: any) => s + (r.netTotal ?? 0), 0);

  const columns = useMemo(() => [
    { key: 'runNumber', label: t('payrollRunNumber'), sortable: true, width: 150, minWidth: 140,
      render: (v: any) => <span className="nx-cell-num nx-cell-accent text-[13px] whitespace-nowrap">{v || '—'}</span> },
    { key: 'month', label: t('payrollMonth'), sortable: true, width: 130, minWidth: 120,
      render: (v: any) => <span className="text-[13px]">{v || '—'}</span> },
    { key: 'grossTotal', label: t('payrollGross'), numeric: true, sortable: true, width: 130, minWidth: 120,
      render: (v: any) => <FmtNum n={v} className="nx-cell-num text-[13px]" /> },
    { key: 'netTotal', label: t('payrollNet'), numeric: true, sortable: true, width: 130, minWidth: 120,
      render: (v: any) => <FmtNum n={v} className="nx-cell-num font-bold text-[13px]" /> },
    { key: 'status', label: t('payrollStatus'), width: 120, minWidth: 110,
      render: (_: any, row: any) => (
        <Badge {...payrollRunBadgeProps(row)} size="sm" />
      ) },
    {
      key: 'issuedInvoiceNumber',
      label: t('payrollIssuedInvoiceNumber'),
      width: 140,
      minWidth: 120,
      shrink: true,
      render: (v: any, row: any) => (
        v ? (
          <Link
            to={payrollSalaryInvoiceListHref(row.id, row.monthRaw)}
            className="nx-cell-num text-[12px] font-semibold text-noorix-blue hover:underline whitespace-nowrap"
            dir="ltr"
            title={t('payrollOpenIssuedInvoice')}
          >
            {v}
          </Link>
        ) : (
          <span className="nx-cell-num text-[12px] whitespace-nowrap" dir="ltr">—</span>
        )
      ),
    },
    { key: 'actions', label: t('actions'), width: '5%', align: 'center',
      render: (_: any, row: any) => {
        const st = String(row.status || '').toLowerCase();
        const canPay = st === 'completed' && !row.issuedInvoiceNumber;
        return (
        <HRActionsCell
          row={row}
          type="payroll"
          onView={() => setDetailRunId(row.id)}
          onEdit={st === 'draft' ? () => setEditingRunId(row.id) : undefined}
          onDelete={canDeletePayroll ? () => handleDeletePayrollRun(row) : undefined}
          onApprove={st === 'draft' ? () => updateStatusMutation.mutate({ id: row.id, status: 'completed' }) : undefined}
          onPay={canPay ? () => openPayModal(row) : undefined}
        />
        );
      } },
  ], [t, payrollStatusMap, payrollRunBadgeProps, updateStatusMutation, handleDeletePayrollRun, openPayModal, canDeletePayroll]);

  const footerCells = (
    <>
      <td colSpan={2} className="text-[12px] text-noorix-muted font-semibold py-1.5 px-3">{t('payrollTotal')} ({allFilteredData.length})</td>
      <td className="text-[13px] text-end py-1.5 px-3 nx-font-numbers">{hrFmt(allFilteredData.reduce((s: any, r: any) => s + (r.grossTotal ?? 0), 0))}</td>
      <td className="text-[13px] text-end py-1.5 px-3 text-noorix-green font-black nx-font-numbers">{hrFmt(totalNet)}</td>
      <td colSpan={3} />
    </>
  );

  const exportData = allFilteredData.map((r: any) => ({
    runNumber: r.runNumber,
    month: r.month,
    grossTotal: hrFmt(r.grossTotal),
    netTotal: hrFmt(r.netTotal),
    status: payrollRunExportStatusLabel(r),
    issuedInvoiceNumber: r.issuedInvoiceNumber || '—',
  }));

  const renderMobileCard = useCallback((row: any) => {
    return (
      <div>
        <div className="flex items-center justify-between flex flex-wrap mb-1">
          <span className="nx-cell-num nx-cell-accent text-[14px]">{row.runNumber}</span>
          <Badge {...payrollRunBadgeProps(row)} size="sm" className="shrink-0" />
        </div>
        {row.month && <div className="nx-cell-muted mb-2 text-end">{row.month}</div>}
        <div className="nx-mc__grid nx-mc__grid--2 mb-2.5">
          <div>
            <div className="nx-mc__stat-label">{t('payrollGross')}</div>
            <div className="nx-mc__stat-value text-[14px]">{hrFmt(row.grossTotal)}</div>
          </div>
          <div>
            <div className="nx-mc__stat-label">{t('payrollNet')}</div>
            <div className="nx-mc__stat-value text-[15px] font-extrabold text-noorix-green">{hrFmt(row.netTotal)}</div>
          </div>
        </div>
        {row.issuedInvoiceNumber && (
          <div className="nx-cell-muted mb-2 text-end text-[12px]" dir="ltr">
            {t('payrollIssuedInvoiceNumber')}:{' '}
            <Link
              to={payrollSalaryInvoiceListHref(row.id, row.monthRaw)}
              className="font-semibold text-noorix-blue hover:underline"
              title={t('payrollOpenIssuedInvoice')}
            >
              {row.issuedInvoiceNumber}
            </Link>
          </div>
        )}
        <div className="flex flex items-center justify-end">
          <HRActionsCell
            row={row}
            type="payroll"
            onView={() => setDetailRunId(row.id)}
            onEdit={String(row.status || '').toLowerCase() === 'draft' ? () => setEditingRunId(row.id) : undefined}
            onDelete={canDeletePayroll ? () => handleDeletePayrollRun(row) : undefined}
            onApprove={String(row.status || '').toLowerCase() === 'draft' ? () => updateStatusMutation.mutate({ id: row.id, status: 'completed' }) : undefined}
            onPay={String(row.status || '').toLowerCase() === 'completed' && !row.issuedInvoiceNumber ? () => openPayModal(row) : undefined}
          />
        </div>
      </div>
    );
  }, [payrollStatusMap, payrollRunBadgeProps, t, updateStatusMutation, handleDeletePayrollRun, openPayModal, canDeletePayroll]);

  const renderCompactRow = useCallback((row: any) => {
    const isDraft = String(row.status || '').toLowerCase() === 'draft';
    const isCompleted = String(row.status || '').toLowerCase() === 'completed';
    const canPay = isCompleted && !row.issuedInvoiceNumber;
    return (
      <div>
        <div className="nx-cr__line1">
          <span className="nx-cr__id">{row.runNumber}</span>
          <span className="nx-cr__sub">{row.month}</span>
          <Badge {...payrollRunBadgeProps(row)} size="sm" />
        </div>
        <div className="nx-cr__line2">
          <div className="nx-cr__line2-start">
            <span className="nx-cr__meta">{t('payrollGross')}: <span className="text-noorix-text">{hrFmt(row.grossTotal)}</span></span>
          </div>
          <div className="nx-cr__line2-end">
            <span className="nx-cr__amount text-noorix-green">{hrFmt(row.netTotal)} <span className="nx-sar">SR</span></span>
            <div className="nx-cr__kebab" onClick={(e) => e.stopPropagation()}>
              <KebabMenu
                ariaLabel={t('actions')}
                items={[
                  { key: 'view', label: t('view'), onClick: () => setDetailRunId(row.id) },
                  ...(isDraft ? [{ key: 'edit', label: t('edit'), style: { color: 'var(--noorix-accent-green)' }, onClick: () => setEditingRunId(row.id) }] : []),
                  ...(isDraft ? [{ key: 'approve', label: t('payrollApprove'), style: { color: 'var(--noorix-accent-blue)' }, onClick: () => updateStatusMutation.mutate({ id: row.id, status: 'completed' }) }] : []),
                  ...(canPay ? [{ key: 'pay', label: t('payrollPay'), style: { color: 'var(--noorix-accent-green)' }, onClick: () => openPayModal(row) }] : []),
                  ...(canDeletePayroll ? [{ key: 'delete', label: t('delete'), style: { color: 'var(--noorix-accent-red)' }, onClick: () => handleDeletePayrollRun(row) }] : []),
                ]}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }, [t, payrollRunBadgeProps, updateStatusMutation, handleDeletePayrollRun, openPayModal, canDeletePayroll, setDetailRunId, setEditingRunId]);

  function handleExportExcel() {
    exportToExcel(exportData, `payroll-runs-${year}.xlsx`);
  }

  function handlePrint() {
    const rows = allFilteredData.map((r: any) =>
      `<tr><td>${(r.runNumber || '').replace(/</g, '&lt;')}</td><td>${(r.month || '').replace(/</g, '&lt;')}</td><td>${hrFmt(r.grossTotal)}</td><td>${hrFmt(r.netTotal)}</td><td>${String(payrollRunExportStatusLabel(r)).replace(/</g, '&lt;')}</td><td>${String(r.issuedInvoiceNumber || '—').replace(/</g, '&lt;')}</td></tr>`
    ).join('');
    openPrintWindow({
      title: t('hrTabPayroll'),
      companyName: companyName || 'الشركة',
      subtitle: `${t('hrTabPayroll')} — ${year}`,
      body: `<table><thead><tr><th>${t('payrollRunNumber')}</th><th>${t('payrollMonth')}</th><th>${t('payrollGross')}</th><th>${t('payrollNet')}</th><th>${t('payrollStatus')}</th><th>${t('payrollIssuedInvoiceNumber')}</th></tr></thead><tbody>${rows || '<tr><td colspan="6">' + t('noDataInPeriod') + '</td></tr>'}</tbody></table>`,
    });
  }

  const yearLeading = (
    <>
      <label className="text-[13px] font-semibold shrink-0 text-noorix-muted">{t('dateFilterYear')}</label>
      <Input type="select" value={year} onChange={(e: any) => setYear(parseInt(e.target.value, 10))} size="sm" aria-label={t('dateFilterYear')}>
        {[new Date().getFullYear(), new Date().getFullYear() - 1].map((y: number) => (
          <option key={y} value={y}>{y}</option>
        ))}
      </Input>
    </>
  );

  return (
    <ScreenShell embedded={!!embedded} className={embedded ? HR_EMBEDDED_SHELL_CLASS : undefined}>
      <HrTabToolbar
        leading={yearLeading}
        desktopActions={(
          <>
            <Button size="sm" className="hidden lg:inline-flex" onClick={handleExportExcel}>{t('exportExcel')}</Button>
            <Button size="sm" className="hidden lg:inline-flex" onClick={handlePrint}>{t('printPayroll')}</Button>
          </>
        )}
        menuItems={[
          { key: 'export', label: t('exportExcel'), onClick: handleExportExcel },
          { key: 'print', label: t('printPayroll'), onClick: handlePrint },
        ]}
        primaryAction={{
          label: t('createPayrollRun'),
          onClick: () => setShowCreate(true),
        }}
      />

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
        isError={isError}
        title={t('hrTabPayroll')}
        badge={
          <>
            <span className="nx-cell-muted">— {year}</span>
            <span className="nx-pill nx-pill--blue nx-pill--sm">{allFilteredData.length}</span>
          </>
        }
        searchValue={searchText}
        onSearchChange={setSearch}
        showSearchInHeader
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={toggleSort}
        footerCells={footerCells}
        emptyMessage={t('noDataInPeriod')}
        renderCompactRow={renderCompactRow}
        renderMobileCard={renderMobileCard}
        stripeMobileCards
      />

      {showCreate && (
        <PayrollRunFormModal
          companyId={companyId}
          onCreate={() => {
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
          companyNameEn={activeCompany?.nameEn || activeCompany?.nameAr || ''}
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
                let vaultSplits: { vaultId: string; amount: number }[] = [];
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
              onChange={(e: any) => setPayTransactionDate(e.target.value)}
            />
          </div>

          <div className="noorix-surface-card p-3 flex flex-col gap-2.5">
            <p className="m-0 text-[11px] font-semibold text-noorix-muted">{t('payrollRunPayVaultSection')}</p>
            <Input
              type="select"
              label={t('payrollPayVaultCol')}
              value={payVaultId}
              onChange={(e: any) => setPayVaultId(e.target.value)}
            >
              <option value="">{t('payrollPayVaultDefault')}</option>
              {paymentVaults.map((v: any) => (
                <option key={v.id} value={v.id}>{vaultDisplayName(v, lang)}</option>
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
                  onChange={(e: any) => setPaySecondVaultId(e.target.value)}
                >
                  <option value="">—</option>
                  {paymentVaults.map((v: any) => (
                    <option key={v.id} value={v.id} disabled={v.id === payVaultId}>
                      {vaultDisplayName(v, lang)}
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
                  onChange={(e: any) => setPaySecondAmount(e.target.value)}
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
