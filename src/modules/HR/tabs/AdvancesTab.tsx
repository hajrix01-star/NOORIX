/**
 * AdvancesTab — السلفيات (احترافي كامل)
 */
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { invalidateOnFinancialMutation } from '../../../utils/queryInvalidation';
import { useApp } from '../../../context/AppContext';
import { useToast } from '../../../context/ToastContext';
import { useTranslation } from '../../../i18n/useTranslation';
import { deleteDeduction, getDeductions, getHrAdvances, updateInvoice, throwIfApiFailed } from '../../../services/api';
import { useApiListQuery } from '../../../hooks/useApiQuery';
import { useEmployees } from '../../../hooks/useEmployees';
import { formatSaudiDate } from '../../../utils/saudiDate';
import { hrFmt } from '../utils/hrFmt';
import { exportToExcel } from '../../../utils/exportUtils';
import { useTableFilter } from '../../../hooks/useTableFilter';
import { AdvanceQuickModal } from '../components/AdvanceQuickModal';
import { AdvanceEditModal } from '../components/AdvanceEditModal';
import { AdvanceSettlementModal } from '../components/AdvanceSettlementModal';
import { AdvanceDetailsModal } from '../components/AdvanceDetailsModal';
import { HrQuickEntrySheet } from '../components/HrQuickEntrySheet';
import { useAdvanceTableModel } from '../components/useAdvanceTableModel';
import { employeeDisplayName } from '../../../utils/employeeDisplayName';
import { Input, SmartTable } from '../../../ui';
import { buildAdvanceSettlementStatusMap } from '../../../constants/badgeMaps';
import { hrKeys } from '../../../services/queryKeys';
import type { HrEmployee } from '../../../types/api';
import { hrFlatSmartTableShellProps } from '../hrWorkspaceLayout';
import { HrFlatListTabShell } from '../components/HrFlatListTabShell';
import { HrTabToolbar } from '../components/HrTabToolbar';
import { countTruthyFilters } from '../utils/hrActiveFilterCount';
import { getAdvanceTotals, normalizeAdvances } from '../utils/advanceBalance';
import { buildAdvanceFinancialFooterRow } from '../utils/advanceTableFooter';
import { buildGroupedAdvanceRows, type AdvanceGroupRow, type AdvanceRow } from '../utils/advanceGrouping';

type AdvanceEditableRow = AdvanceRow & { id: string };
type AdvanceApiRow = AdvanceRow & {
  employee?: HrEmployee | null;
  employeeId?: string | null;
  employeeName?: string | null;
};
type DeductionApiRow = AdvanceApiRow & {
  amount?: number | string | null;
  createdAt?: string | null;
  deductionType?: string | null;
  notes?: string | null;
};
type SelectChange = React.ChangeEvent<HTMLInputElement | HTMLSelectElement>;

const PAGE_SIZE = 50;

type AdvancesTabProps = { embedded?: boolean };

function isEditableAdvance(row: AdvanceRow): row is AdvanceEditableRow {
  return typeof row.id === 'string' && row.id.length > 0;
}

export default function AdvancesTab({ embedded }: AdvancesTabProps = {}) {
  const { t, lang } = useTranslation();
  const { activeCompanyId } = useApp();
  const companyId = activeCompanyId ?? '';
  const queryClient = useQueryClient();
  const [showAdvance, setShowAdvance] = useState(false);
  const [editingAdvance, setEditingAdvance] = useState<AdvanceEditableRow | null>(null);
  const [settlingAdvance, setSettlingAdvance] = useState<AdvanceEditableRow | null>(null);
  const [selectedAdvanceGroup, setSelectedAdvanceGroup] = useState<AdvanceGroupRow | null>(null);
  const [deductionEmployeeId, setDeductionEmployeeId] = useState<string | null>(null);
  const { showToast } = useToast();
  const [employeeFilter, setEmployeeFilter] = useState('');
  const [monthFilter, setMonthFilter] = useState('');
  const [settlementFilter, setSettlementFilter] = useState('all');
  const [groupPage, setGroupPage] = useState(1);

  const { createAdvance, employees: activeEmployees } = useEmployees(companyId, {
    includeTerminated: true,
    fetchEnabled: !!companyId,
  });

  const { data: rawAdvanceRows, isLoading, isError } = useApiListQuery<AdvanceApiRow, AdvanceRow[]>({
    queryKey: hrKeys.advancesForCompany(companyId),
    queryFn: () => getHrAdvances(companyId),
    fallbackMessage: 'فشل تحميل السلف',
    select: normalizeAdvances,
    enabled: !!companyId,
  });

  const { data: rawDeductionRows = [], isLoading: deductionsLoading, isError: deductionsError } = useApiListQuery<DeductionApiRow>({
    queryKey: hrKeys.deductionsByCompany(companyId),
    queryFn: () => getDeductions(companyId),
    fallbackMessage: 'Failed to load employee deductions',
    enabled: !!companyId,
  });

  const employeesById = useMemo(() => new Map(
    activeEmployees.map((emp: HrEmployee) => [String(emp.id), emp]),
  ), [activeEmployees]);

  const items = useMemo(() => {
    const advanceItems = (rawAdvanceRows ?? []).map((row: AdvanceApiRow): AdvanceRow => {
      const emp = row.employee || { name: row.employeeName };
      return {
        ...row,
        recordType: 'advance',
        employeeName: employeeDisplayName(emp, lang, row.employeeId ?? undefined),
      };
    });
    const deductionItems = (rawDeductionRows ?? [])
      .filter((row: DeductionApiRow) => row.deductionType !== 'advance')
      .map((row: DeductionApiRow): AdvanceRow => {
        const emp = row.employee || employeesById.get(String(row.employeeId)) || { name: row.employeeName };
        const amount = Number(row.amount ?? 0);
        return {
          ...row,
          recordType: 'deduction',
          employeeName: employeeDisplayName(emp, lang, row.employeeId ?? undefined),
          transactionDate: row.transactionDate || row.createdAt,
          totalAmount: amount,
          totalAmountNum: amount,
          settledAmountNum: amount,
          remainingAmount: 0,
          settlementStatus: 'settled',
          installmentCount: 0,
          settledAt: row.transactionDate || row.createdAt,
        };
      });
    return [...advanceItems, ...deductionItems];
  }, [employeesById, rawAdvanceRows, rawDeductionRows, lang]);
  const employeeFilterOptions = useMemo(
    () => [...activeEmployees]
      .map((emp: HrEmployee) => ({
        id: emp.id,
        name: employeeDisplayName(emp, lang, emp.id),
      }))
      .sort((a, b) => String(a.name).localeCompare(String(b.name), lang === 'ar' ? 'ar' : 'en')),
    [activeEmployees, lang],
  );
  const monthOptions = useMemo(
    () => [...new Set(items.map((r: AdvanceRow) => String(r.transactionDate || '').slice(0, 7)).filter((m: string) => /^\d{4}-\d{2}$/.test(m)))].sort().reverse(),
    [items],
  ) as string[];
  const preFilteredItems = useMemo(() => {
    return items.filter((row: AdvanceRow) => {
      const byEmployee = employeeFilter ? row.employeeId === employeeFilter : true;
      const byMonth = monthFilter ? String(row.transactionDate || '').slice(0, 7) === monthFilter : true;
      const bySettlement = settlementFilter === 'all'
        ? true
        : settlementFilter === 'settled'
          ? row.settlementStatus === 'settled'
          : row.settlementStatus === 'outstanding' || row.settlementStatus === 'partial';
      return byEmployee && byMonth && bySettlement;
    });
  }, [items, employeeFilter, monthFilter, settlementFilter]);

  const { allFilteredData, searchText, setSearch, sortKey, sortDir, toggleSort } =
    useTableFilter(preFilteredItems, {
      searchKeys: ['employeeName', 'invoiceNumber'],
      pageSize: PAGE_SIZE,
      defaultSortKey: 'transactionDate',
      defaultSortDir: 'desc',
      dateKeys: ['transactionDate'],
    });

  const advanceOnlyRows = useMemo(
    () => allFilteredData.filter((row: AdvanceRow) => row.recordType !== 'deduction'),
    [allFilteredData],
  );
  const manualDeductionTotal = useMemo(
    () => allFilteredData
      .filter((row: AdvanceRow) => row.recordType === 'deduction')
      .reduce((sum: number, row: AdvanceRow) => sum + Number(row.totalAmountNum ?? row.totalAmount ?? 0), 0),
    [allFilteredData],
  );
  const advanceTotals = useMemo(() => getAdvanceTotals(advanceOnlyRows), [advanceOnlyRows]);

  const settlementMap = useMemo(() => buildAdvanceSettlementStatusMap(t), [t]);

  const handleDeleteAdvance = useCallback((row: AdvanceRow) => {
    if (!isEditableAdvance(row)) return;
    if (!window.confirm(t('deleteAdvance'))) return;
    updateInvoice(row.id, { status: 'cancelled' }, companyId).then((res: unknown) => {
      try {
        throwIfApiFailed(res, t('saveFailed'));
        invalidateOnFinancialMutation(queryClient);
        showToast(t('advanceDeleted'), 'success');
      } catch (e: unknown) {
        showToast(e instanceof Error ? e.message : t('saveFailed'), 'error');
      }
    });
  }, [companyId, queryClient, showToast, t]);

  const openEditAdvance = useCallback((row: AdvanceRow) => {
    if (isEditableAdvance(row)) setEditingAdvance(row);
  }, []);

  const openSettleAdvance = useCallback((row: AdvanceRow) => {
    if (isEditableAdvance(row)) setSettlingAdvance(row);
  }, []);

  const openDeductionEntry = useCallback((group: AdvanceGroupRow) => {
    setSelectedAdvanceGroup(null);
    setDeductionEmployeeId(group.employeeId || null);
  }, []);

  const handleDeleteDeduction = useCallback((row: AdvanceRow) => {
    const id = typeof row.id === 'string' ? row.id : '';
    if (!id) return;
    if (!window.confirm(t('deletePayrollCutConfirm'))) return;
    deleteDeduction(id, companyId).then((res: unknown) => {
      try {
        throwIfApiFailed(res, t('saveFailed'));
        invalidateOnFinancialMutation(queryClient);
        queryClient.invalidateQueries({ queryKey: hrKeys.deductionsRoot() });
        queryClient.invalidateQueries({ queryKey: hrKeys.payrollRunsRoot() });
        showToast(t('payrollCutDeleted'), 'success');
        setSelectedAdvanceGroup((current) => {
          if (!current) return current;
          const nextRows = current.advances.filter((item) => item.id !== id);
          if (nextRows.length === current.advances.length) return current;
          const deletedAmount = Number(row.totalAmountNum ?? row.totalAmount ?? 0);
          return {
            ...current,
            advances: nextRows,
            deductionCount: Math.max(0, current.deductionCount - 1),
            manualDeductionAmount: Math.max(0, current.manualDeductionAmount - deletedAmount),
          };
        });
      } catch (e: unknown) {
        showToast(e instanceof Error ? e.message : t('saveFailed'), 'error');
      }
    });
  }, [companyId, queryClient, showToast, t]);

  const groupedRows = useMemo(
    () => buildGroupedAdvanceRows(allFilteredData, sortKey, sortDir, lang === 'ar' ? 'ar' : 'en'),
    [allFilteredData, lang, sortDir, sortKey],
  );

  useEffect(() => {
    setGroupPage(1);
  }, [employeeFilter, monthFilter, settlementFilter, searchText, sortKey, sortDir, allFilteredData.length]);

  const groupedPageRows = useMemo(
    () => groupedRows.slice((groupPage - 1) * PAGE_SIZE, groupPage * PAGE_SIZE),
    [groupPage, groupedRows],
  );

  const footerRow = useMemo(() => buildAdvanceFinancialFooterRow({
    totals: advanceTotals,
    summary: (
      <>
        {t('advancesList')} ({allFilteredData.length})
        {manualDeductionTotal > 0 ? ` - ${t('deductionsList')}: ${hrFmt(manualDeductionTotal)}` : ''}
        {advanceTotals.outstandingCount > 0 ? ` — ${t('advanceOutstanding')}: ${advanceTotals.outstandingCount}` : ''}
        {advanceTotals.partialCount > 0 ? ` — ${t('advanceStatusPartial')}: ${advanceTotals.partialCount}` : ''}
      </>
    ),
  }), [advanceTotals, allFilteredData.length, manualDeductionTotal, t]);

  const exportData = allFilteredData.map((r: AdvanceRow) => {
    const installmentCount = Number(r.installmentCount ?? 0);
    return {
      employeeName: r.employeeName || '—',
      amount: r.recordType === 'deduction' ? `-${hrFmt(r.totalAmount)}` : hrFmt(r.totalAmount),
      transactionDate: formatSaudiDate(r.transactionDate),
      installmentCount: installmentCount > 1 ? installmentCount : '—',
      installmentAmount: installmentCount > 1 ? hrFmt(r.installmentAmount ?? 0) : '—',
      settledAmount: hrFmt(r.settledAmountNum || 0),
      remainingAmount: hrFmt(r.remainingAmount || 0),
      settlementDate: r.settledAt ? formatSaudiDate(r.settledAt) : '—',
      status: r.recordType === 'deduction'
        ? t('deductionsList')
        : r.settlementStatus === 'cancelled'
        ? t('cancelled')
        : r.settlementStatus === 'settled'
          ? t('advanceSettled')
          : r.settlementStatus === 'partial'
            ? t('advanceStatusPartial')
          : t('advanceOutstanding'),
    };
  });

  const { columns, renderMobileCard, renderCompactRow } = useAdvanceTableModel({
    t,
    settlementMap,
    onOpenEmployee: setSelectedAdvanceGroup,
  });
  const advanceFilters = (
    <>
      <Input type="select" label={t('advancesFilterEmployee')} value={employeeFilter} onChange={(e: SelectChange) => setEmployeeFilter(e.target.value)} size="sm">
        <option value="">{t('advancesFilterAll')}</option>
        {employeeFilterOptions.map((emp) => (
          <option key={emp.id} value={emp.id}>{emp.name}</option>
        ))}
      </Input>
      <Input type="select" label={t('advancesFilterMonth')} value={monthFilter} onChange={(e: SelectChange) => setMonthFilter(e.target.value)} size="sm">
        <option value="">{t('advancesFilterAll')}</option>
        {monthOptions.map((month: string) => (
          <option key={month} value={month}>{month}</option>
        ))}
      </Input>
      <Input type="select" label={t('advancesFilterSettlement')} value={settlementFilter} onChange={(e: SelectChange) => setSettlementFilter(e.target.value)} size="sm">
        <option value="all">{t('advancesFilterAll')}</option>
        <option value="outstanding">{t('advancesFilterOutstandingOnly')}</option>
        <option value="settled">{t('advancesFilterSettledOnly')}</option>
      </Input>
    </>
  );

  const activeFilterCount = countTruthyFilters([
    !!employeeFilter,
    !!monthFilter,
    settlementFilter !== 'all',
  ]);

  const resetAdvanceFilters = () => {
    setEmployeeFilter('');
    setMonthFilter('');
    setSettlementFilter('all');
  };

  return (
    <HrFlatListTabShell
      embedded={embedded}
      controls={(
        <HrTabToolbar
          filters={advanceFilters}
          activeFilterCount={activeFilterCount}
          onResetFilters={resetAdvanceFilters}
          menuItems={[
            {
              key: 'export',
              label: t('exportExcel'),
              onClick: () => exportToExcel(exportData, 'advances.xlsx'),
            },
          ]}
          primaryAction={{
            label: t('payAdvance'),
            onClick: () => setShowAdvance(true),
          }}
        />
      )}
      list={(
        <SmartTable
          compact
          showRowNumbers
          {...hrFlatSmartTableShellProps(embedded)}
          columns={columns}
          data={groupedPageRows}
          total={groupedRows.length}
          page={groupPage}
          pageSize={PAGE_SIZE}
          onPageChange={setGroupPage}
          isLoading={isLoading || deductionsLoading}
          isError={isError || deductionsError}
          title={embedded ? undefined : t('hrTabAdvances')}
          badge={embedded ? undefined : <span className="nx-pill nx-pill--blue nx-pill--sm">{groupedRows.length}</span>}
          searchValue={searchText}
          onSearchChange={(value: string) => {
            setSearch(value);
            setGroupPage(1);
          }}
          showSearchInHeader={!embedded}
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={(key: string) => {
            toggleSort(key);
            setGroupPage(1);
          }}
          footerRow={footerRow}
          emptyMessage={t('noDataInPeriod')}
          renderCompactRow={renderCompactRow}
          renderMobileCard={renderMobileCard}
          stripeMobileCards
        />
      )}
    >
      <AdvanceDetailsModal
        group={selectedAdvanceGroup}
        onClose={() => setSelectedAdvanceGroup(null)}
        t={t}
        settlementMap={settlementMap}
        onAddDeduction={openDeductionEntry}
        onEditAdvance={openEditAdvance}
        onSettleAdvance={openSettleAdvance}
        onDeleteAdvance={handleDeleteAdvance}
        onDeleteDeduction={handleDeleteDeduction}
      />
      {deductionEmployeeId && (
        <HrQuickEntrySheet
          mode="deduction"
          companyId={companyId}
          initialEmployeeId={deductionEmployeeId}
          onClose={() => setDeductionEmployeeId(null)}
          onRecorded={() => {
            invalidateOnFinancialMutation(queryClient);
            queryClient.invalidateQueries({ queryKey: hrKeys.deductionsRoot() });
            setDeductionEmployeeId(null);
          }}
        />
      )}
      {showAdvance && (
        <AdvanceQuickModal
          employee={null}
          companyId={companyId}
          createAdvance={createAdvance}
          onSuccess={() => {
            invalidateOnFinancialMutation(queryClient);
            showToast(t('advancePaid'), 'success');
          }}
          onClose={() => setShowAdvance(false)}
        />
      )}
      {editingAdvance && (
        <AdvanceEditModal
          advance={editingAdvance}
          companyId={companyId}
          onClose={() => setEditingAdvance(null)}
          onSaved={() => {
            invalidateOnFinancialMutation(queryClient);
            showToast(t('advanceUpdated'), 'success');
            setEditingAdvance(null);
          }}
          onError={(msg: string) => showToast(msg, 'error')}
        />
      )}
      {settlingAdvance && (
        <AdvanceSettlementModal
          advance={settlingAdvance}
          companyId={companyId}
          onClose={() => setSettlingAdvance(null)}
          onSaved={() => {
            invalidateOnFinancialMutation(queryClient);
            queryClient.invalidateQueries({ queryKey: hrKeys.deductionsByCompany(companyId) });
            showToast(t('advanceSettledSuccess'), 'success');
            setSettlingAdvance(null);
          }}
          onError={(msg: string) => showToast(msg, 'error')}
        />
      )}
    </HrFlatListTabShell>
  );
}
