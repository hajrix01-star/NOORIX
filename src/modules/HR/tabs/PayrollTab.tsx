/**
 * PayrollTab — مسيرات الرواتب (احترافي كامل)
 */
import React, { useState, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { invalidateOnFinancialMutation } from '../../../utils/queryInvalidation';
import { useApp } from '../../../context/AppContext';
import { useTranslation } from '../../../i18n/useTranslation';
import { getPayrollRuns, updatePayrollRunStatus, issuePayrollPayment, issueIndividualSalaryPayment, deletePayrollRun } from '../../../services/api';
import { useApiListQuery } from '../../../hooks/useApiQuery';
import { useVaults } from '../../../hooks/useVaults';
import { formatSaudiDate, getSaudiToday } from '../../../utils/saudiDate';
import { hrFmt } from '../utils/hrFmt';
import { exportToExcel } from '../../../utils/exportUtils';
import { useTableFilter } from '../../../hooks/useTableFilter';
import { PayrollRunFormModal } from '../components/PayrollRunFormModal';
import { PayrollRunDetailModal } from '../components/PayrollRunDetailModal';
import { useToast } from '../../../context/ToastContext';
import { useApiMutation } from '../../../hooks/useApiMutation';
import { Button, Badge, FmtNum, SmartTable, YearDateFilter, usePrintPreview, type SmartTableColumn } from '../../../ui';
import { buildPayrollRunStatusMap } from '../../../constants/badgeMaps';
import { canDeletePayrollRunRole, resolveUserRole } from '../../../constants/permissions';
import { payrollSalaryInvoiceListHref } from '../utils/payrollSalaryInvoiceHref';
import { hrKeys } from '../../../services/queryKeys';
import { hrFlatSmartTableShellProps } from '../hrWorkspaceLayout';
import { HrFlatListTabShell } from '../components/HrFlatListTabShell';
import { HrTabToolbar } from '../components/HrTabToolbar';
import { PayrollPayModal } from './PayrollPayModal';
import { PayrollRunCompactRow, PayrollRunMobileCard } from './PayrollRunResponsiveRows';
import { IndividualSalaryPaymentModal } from './IndividualSalaryPaymentModal';
import {
  buildPayrollRunExportRows,
  buildPayrollRunPrintTable,
  lastDayOfPayrollMonth,
  toPayrollRunRow,
  type PayrollIssuePaymentMutation,
  type PayrollPayModalRun,
  type PayrollRunRow,
  type PayrollRunSource,
  type PayrollStatusMutation,
} from './payrollTabModel';

const PAGE_SIZE = 50;

type PayrollTabProps = { embedded?: boolean };

export default function PayrollTab({ embedded }: PayrollTabProps = {}) {
  const { t, lang } = useTranslation();
  const { activeCompanyId, companies, userRole, user } = useApp();
  const effectiveRole = resolveUserRole(user?.role ?? userRole);
  const canDeletePayroll = canDeletePayrollRunRole(effectiveRole);
  const companyId = activeCompanyId ?? '';
  const activeCompany = companies?.find((company) => company.id === companyId);
  const companyName = activeCompany?.nameAr || activeCompany?.name || '';
  const companyLogo = activeCompany?.logoUrl || '';
  const { openPrintDocumentPreview, printPreviewModal } = usePrintPreview({
    title: t('payrollRuns'),
    closeLabel: t('close') || 'Close',
    printLabel: `${t('print')} / PDF`,
  });
  const [year, setYear] = useState(new Date().getFullYear());
  const [showCreate, setShowCreate] = useState(false);
  const [editingRunId, setEditingRunId] = useState<string | null>(null);
  const [detailRunId, setDetailRunId] = useState<string | null>(null);
  const [payModalRun, setPayModalRun] = useState<PayrollPayModalRun | null>(null);
  const [payTransactionDate, setPayTransactionDate] = useState(() => getSaudiToday());
  const [showIndividualSalaryPayment, setShowIndividualSalaryPayment] = useState(false);
  const { showToast } = useToast();
  const { paymentVaults = [] } = useVaults({ companyId });
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useApiListQuery<PayrollRunSource, PayrollRunRow[]>({
    queryKey: hrKeys.payrollRuns(companyId, year),
    queryFn: () => getPayrollRuns(companyId, year),
    fallbackMessage: 'فشل تحميل مسيرات الرواتب',
    select: (runs) => runs.map(toPayrollRunRow),
    enabled: !!companyId,
  });

  const updateStatusMutation = useApiMutation<unknown, PayrollStatusMutation>({
    mutationFn: ({ id, status }) => updatePayrollRunStatus(id, companyId, status),
    successToast: () => t('payrollCreated'),
    errorToast: (error) => error.message || t('saveFailed'),
    onSuccess: () => invalidateOnFinancialMutation(queryClient),
  });

  const issuePaymentMutation = useApiMutation<unknown, PayrollIssuePaymentMutation>({
    mutationFn: ({ id, transactionDate, vaultSplits }) =>
      issuePayrollPayment({
        payrollRunId: id,
        transactionDate: transactionDate || getSaudiToday(),
        vaultSplits: vaultSplits?.length ? vaultSplits : undefined,
      }),
    successToast: () => t('payrollPaidSuccess') || 'تم صرف المسيرة بنجاح',
    errorToast: (error) => error.message || t('saveFailed'),
    onSuccess: () => {
      invalidateOnFinancialMutation(queryClient);
      setPayModalRun(null);
    },
  });

  const individualSalaryMutation = useApiMutation<unknown, Record<string, unknown>>({
    mutationFn: issueIndividualSalaryPayment,
    successToast: () => 'تم إنشاء المسير الإضافي وإصدار فاتورة الراتب.',
    errorToast: (error) => error.message || t('saveFailed'),
    onSuccess: () => {
      invalidateOnFinancialMutation(queryClient);
      setShowIndividualSalaryPayment(false);
    },
  });

  const openPayModal = useCallback((row: Pick<PayrollRunRow, 'id' | 'runNumber' | 'month' | 'monthRaw' | 'netTotal'>) => {
    setPayModalRun({
      id: row.id,
      runNumber: row.runNumber,
      month: row.month,
      netTotal: row.netTotal,
    });
    setPayTransactionDate(lastDayOfPayrollMonth(row.monthRaw) || getSaudiToday());
  }, []);

  const deleteRunMutation = useApiMutation<unknown, { id: string }>({
    mutationFn: ({ id }) => deletePayrollRun(id, companyId),
    successToast: () => t('payrollDeleted') || t('deletedSuccessfully'),
    errorToast: (error) => error.message || t('saveFailed'),
    onSuccess: () => invalidateOnFinancialMutation(queryClient),
  });

  const handleDeletePayrollRun = useCallback((row: Pick<PayrollRunRow, 'id' | 'status'>) => {
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
    (row: PayrollRunRow) => {
      const st = String(row?.status || '').toLowerCase();
      if (st === 'completed' && row?.issuedInvoiceNumber) {
        return { color: 'green', children: t('payrollPaid') };
      }
      return Badge.fromStatus(row?.status, payrollStatusMap);
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

  const totalNet = allFilteredData.reduce((sum, row) => sum + (row.netTotal ?? 0), 0);

  const columns = useMemo<SmartTableColumn<PayrollRunRow>[]>(() => [
    { key: 'runNumber', label: t('payrollRunNumber'), sortable: true, width: 150, minWidth: 140,
      render: (_value: unknown, row: PayrollRunRow) => (
        <div className="flex items-center justify-center gap-1.5">
          <Button
            variant="raw"
            size="auto"
            className="nx-cell-num nx-cell-accent text-[13px] whitespace-nowrap hover:underline"
            onClick={() => setDetailRunId(row.id)}
          >
            {row.runNumber || '—'}
          </Button>
          {row.kind === 'supplementary' ? (
            <span className="rounded-full bg-violet-50 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700">إضافي</span>
          ) : null}
        </div>
      ) },
    { key: 'month', label: t('payrollMonth'), sortable: true, width: 130, minWidth: 120,
      render: (_value: unknown, row: PayrollRunRow) => <span className="text-[13px]">{row.month || '—'}</span> },
    { key: 'grossTotal', label: t('payrollGross'), numeric: true, sortable: true, width: 130, minWidth: 120,
      render: (_value: unknown, row: PayrollRunRow) => <FmtNum n={row.grossTotal} className="nx-cell-num text-[13px]" /> },
    { key: 'netTotal', label: t('payrollNet'), numeric: true, sortable: true, width: 130, minWidth: 120,
      render: (_value: unknown, row: PayrollRunRow) => <FmtNum n={row.netTotal} className="nx-cell-num font-bold text-[13px]" /> },
    { key: 'status', label: t('payrollStatus'), width: 120, minWidth: 110,
      render: (_value: unknown, row: PayrollRunRow) => (
        <Badge {...payrollRunBadgeProps(row)} size="sm" />
      ) },
    {
      key: 'issuedInvoiceNumber',
      label: t('payrollIssuedInvoiceNumber'),
      width: 140,
      minWidth: 120,
      shrink: true,
      render: (_value: unknown, row: PayrollRunRow) => (
        row.issuedInvoiceNumber ? (
          <Link
            to={payrollSalaryInvoiceListHref(row.id, row.monthRaw)}
            className="nx-cell-num text-[12px] font-semibold text-noorix-blue hover:underline whitespace-nowrap"
            dir="ltr"
            title={t('payrollOpenIssuedInvoice')}
          >
            {row.issuedInvoiceNumber}
          </Link>
        ) : (
          <span className="nx-cell-num text-[12px] whitespace-nowrap" dir="ltr">—</span>
        )
      ),
    },
  ], [t, payrollRunBadgeProps, setDetailRunId]);

  const footerCells = (
    <>
      <td colSpan={2} className="text-[12px] text-noorix-muted font-semibold py-1.5 px-3">{t('payrollTotal')} ({allFilteredData.length})</td>
      <td className="text-[13px] text-end py-1.5 px-3 nx-font-numbers">{hrFmt(allFilteredData.reduce((sum, row) => sum + (row.grossTotal ?? 0), 0))}</td>
      <td className="text-[13px] text-end py-1.5 px-3 text-noorix-green font-black nx-font-numbers">{hrFmt(totalNet)}</td>
      <td colSpan={2} />
    </>
  );

  const exportData = buildPayrollRunExportRows(allFilteredData, payrollStatusMap, t);

  const renderMobileCard = useCallback((row: PayrollRunRow) => (
    <PayrollRunMobileCard row={row} t={t} badgeProps={payrollRunBadgeProps(row)} onOpen={setDetailRunId} />
  ), [payrollRunBadgeProps, t, setDetailRunId]);

  const renderCompactRow = useCallback((row: PayrollRunRow) => (
    <PayrollRunCompactRow row={row} t={t} badgeProps={payrollRunBadgeProps(row)} onOpen={setDetailRunId} />
  ), [t, payrollRunBadgeProps, setDetailRunId]);

  function handleExportExcel() {
    exportToExcel(exportData, `payroll-runs-${year}.xlsx`);
  }

  function handlePrint() {
    openPrintDocumentPreview({
      title: t('payrollRuns'),
      companyName: companyName || t('payrollRuns'),
      logoUrl: companyLogo || '',
      subtitle: `${t('hrTabPayroll')} - ${year}`,
      body: buildPayrollRunPrintTable(allFilteredData, payrollStatusMap, t),
    });
  }

  const yearLeading = <YearDateFilter year={year} onYearChange={setYear} />;

  return (
    <HrFlatListTabShell
      embedded={embedded}
      controls={(
        <HrTabToolbar
          leading={yearLeading}
          desktopActions={(
            <>
              <Button size="sm" variant="success" className="hidden lg:inline-flex" onClick={() => setShowIndividualSalaryPayment(true)}>مسير إضافي</Button>
              <Button size="sm" className="hidden lg:inline-flex" onClick={handleExportExcel}>{t('exportExcel')}</Button>
              <Button size="sm" className="hidden lg:inline-flex" onClick={handlePrint}>{t('printPayroll')}</Button>
            </>
          )}
          menuItems={[
            { key: 'individual-salary', label: 'مسير إضافي', onClick: () => setShowIndividualSalaryPayment(true) },
            { key: 'export', label: t('exportExcel'), onClick: handleExportExcel },
            { key: 'print', label: t('printPayroll'), onClick: handlePrint },
          ]}
          primaryAction={{
            label: t('createPayrollRun'),
            onClick: () => setShowCreate(true),
          }}
        />
      )}
      list={(
        <SmartTable
          compact
          showRowNumbers
          {...hrFlatSmartTableShellProps(embedded)}
          columns={columns}
          data={filteredData}
          total={allFilteredData.length}
          page={page}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
          isLoading={isLoading}
          isError={isError}
          title={embedded ? undefined : t('hrTabPayroll')}
          badge={embedded ? undefined : (
            <>
              <span className="nx-cell-muted">— {year}</span>
              <span className="nx-pill nx-pill--blue nx-pill--sm">{allFilteredData.length}</span>
            </>
          )}
          searchValue={searchText}
          onSearchChange={setSearch}
          showSearchInHeader={!embedded}
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={toggleSort}
          footerCells={footerCells}
          emptyMessage={t('noDataInPeriod')}
          renderCompactRow={renderCompactRow}
          renderMobileCard={renderMobileCard}
          stripeMobileCards
        />
      )}
    >
      {printPreviewModal}

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

      {showIndividualSalaryPayment && (
        <IndividualSalaryPaymentModal
          companyId={companyId}
          lang={lang}
          pending={individualSalaryMutation.isPending}
          onClose={() => { if (!individualSalaryMutation.isPending) setShowIndividualSalaryPayment(false); }}
          onSubmit={(payload) => individualSalaryMutation.mutate(payload)}
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
          onEdit={(run) => {
            if (!run.id) return;
            setDetailRunId(null);
            setEditingRunId(run.id);
          }}
          onApprove={(run) => {
            if (!run.id) return;
            updateStatusMutation.mutate({ id: run.id, status: 'completed' });
          }}
          onPay={(run) => {
            if (!run.id) return;
            openPayModal({
              id: run.id,
              runNumber: String(run.runNumber ?? ''),
              month: run.payrollMonth ? formatSaudiDate(run.payrollMonth) : null,
              monthRaw: run.payrollMonth ?? null,
              netTotal: Number(run.payableAmount ?? run.totalAmount ?? 0),
            });
          }}
          onDelete={canDeletePayroll ? (run) => {
            if (!run.id) return;
            handleDeletePayrollRun({
              id: run.id,
              status: String(run.status ?? ''),
            });
          } : undefined}
          onClose={() => setDetailRunId(null)}
        />
      )}

      <PayrollPayModal
        run={payModalRun}
        transactionDate={payTransactionDate}
        paymentVaults={paymentVaults}
        lang={lang}
        isPending={issuePaymentMutation.isPending}
        t={t}
        onTransactionDateChange={setPayTransactionDate}
        onClose={() => {
          if (issuePaymentMutation.isPending) return;
          setPayModalRun(null);
        }}
        onSubmit={(payload) => issuePaymentMutation.mutate(payload)}
      />
    </HrFlatListTabShell>
  );
}
