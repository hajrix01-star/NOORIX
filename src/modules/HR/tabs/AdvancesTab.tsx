/**
 * AdvancesTab — السلفيات (احترافي كامل)
 */
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { invalidateOnFinancialMutation } from '../../../utils/queryInvalidation';
import { useApp } from '../../../context/AppContext';
import { useToast } from '../../../context/ToastContext';
import { useTranslation } from '../../../i18n/useTranslation';
import { getDeductions, getHrAdvances, updateInvoice, throwIfApiFailed } from '../../../services/api';
import { useApiListQuery } from '../../../hooks/useApiQuery';
import { useEmployees } from '../../../hooks/useEmployees';
import { formatSaudiDate } from '../../../utils/saudiDate';
import { hrFmt } from '../utils/hrFmt';
import { exportToExcel } from '../../../utils/exportUtils';
import { useTableFilter } from '../../../hooks/useTableFilter';
import { AdvanceQuickModal } from '../components/AdvanceQuickModal';
import { AdvanceEditModal } from '../components/AdvanceEditModal';
import { AdvanceSettlementModal } from '../components/AdvanceSettlementModal';
import { useAdvanceTableModel } from '../components/useAdvanceTableModel';
import { employeeDisplayName } from '../../../utils/employeeDisplayName';
import { Input, SmartTable } from '../../../ui';
import { buildAdvanceSettlementStatusMap } from '../../../constants/badgeMaps';
import { hrKeys } from '../../../services/queryKeys';
import { hrFlatSmartTableShellProps } from '../hrWorkspaceLayout';
import { HrFlatListTabShell } from '../components/HrFlatListTabShell';
import { HrTabToolbar } from '../components/HrTabToolbar';
import { countTruthyFilters } from '../utils/hrActiveFilterCount';
import { getAdvanceTotals, normalizeAdvances } from '../utils/advanceBalance';
import { buildAdvanceFinancialFooterRow } from '../utils/advanceTableFooter';
import { buildGroupedAdvanceRows } from '../utils/advanceGrouping';

type HrAny = ReturnType<typeof JSON.parse>;

const PAGE_SIZE = 50;

type AdvancesTabProps = { embedded?: boolean };

export default function AdvancesTab({ embedded }: AdvancesTabProps = {}) {
  const { t, lang } = useTranslation();
  const { activeCompanyId } = useApp();
  const companyId = activeCompanyId ?? '';
  const queryClient = useQueryClient();
  const [showAdvance, setShowAdvance] = useState(false);
  const [editingAdvance, setEditingAdvance] = useState<HrAny>(null);
  const [settlingAdvance, setSettlingAdvance] = useState<HrAny>(null);
  const { showToast } = useToast();
  const [employeeFilter, setEmployeeFilter] = useState('');
  const [monthFilter, setMonthFilter] = useState('');
  const [settlementFilter, setSettlementFilter] = useState('all');
  const [expandedEmployees, setExpandedEmployees] = useState<Set<string>>(() => new Set());
  const [groupPage, setGroupPage] = useState(1);

  const { createAdvance, employees: activeEmployees } = useEmployees(companyId, {
    includeTerminated: true,
    fetchEnabled: !!companyId,
  });

  const { data: rawAdvanceRows, isLoading, isError } = useApiListQuery<HrAny, HrAny[]>({
    queryKey: hrKeys.advancesForCompany(companyId),
    queryFn: () => getHrAdvances(companyId),
    fallbackMessage: 'فشل تحميل السلف',
    select: normalizeAdvances,
    enabled: !!companyId,
  });

  const { data: rawDeductionRows = [], isLoading: deductionsLoading, isError: deductionsError } = useApiListQuery<HrAny, HrAny[]>({
    queryKey: hrKeys.deductionsByCompany(companyId),
    queryFn: () => getDeductions(companyId),
    fallbackMessage: 'Failed to load employee deductions',
    enabled: !!companyId,
  });

  const employeesById = useMemo(() => new Map(
    activeEmployees.map((emp: HrAny) => [String(emp.id), emp]),
  ), [activeEmployees]);

  const items = useMemo(() => {
    const advanceItems = (rawAdvanceRows ?? []).map((row: HrAny) => {
    const emp = row.employee || { name: row.employeeName };
    return {
      ...row,
      recordType: 'advance',
      employeeName: employeeDisplayName(emp, lang, row.employeeId),
    };
    });
    const deductionItems = (rawDeductionRows ?? [])
      .filter((row: HrAny) => row.deductionType !== 'advance')
      .map((row: HrAny) => {
        const emp = row.employee || employeesById.get(String(row.employeeId)) || { name: row.employeeName };
        const amount = Number(row.amount ?? 0);
        return {
          ...row,
          recordType: 'deduction',
          employeeName: employeeDisplayName(emp, lang, row.employeeId),
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
      .map((emp: HrAny) => ({
        id: emp.id,
        name: employeeDisplayName(emp, lang, emp.id),
      }))
      .sort((a, b) => String(a.name).localeCompare(String(b.name), lang === 'ar' ? 'ar' : 'en')),
    [activeEmployees, lang],
  );
  const monthOptions = useMemo(
    () => [...new Set(items.map((r: HrAny) => String(r.transactionDate || '').slice(0, 7)).filter((m: HrAny) => /^\d{4}-\d{2}$/.test(m)))].sort().reverse(),
    [items],
  ) as string[];
  const preFilteredItems = useMemo(() => {
    return items.filter((row: HrAny) => {
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

  const advanceTotals = useMemo(() => getAdvanceTotals(allFilteredData), [allFilteredData]);

  const settlementMap = useMemo(() => buildAdvanceSettlementStatusMap(t), [t]);
  const toggleEmployeeExpanded = useCallback((employeeId: string) => {
    setExpandedEmployees((prev) => {
      const next = new Set(prev);
      if (next.has(employeeId)) next.delete(employeeId);
      else next.add(employeeId);
      return next;
    });
  }, []);

  const handleDeleteAdvance = useCallback((row: HrAny) => {
    if (!window.confirm(t('deleteAdvance'))) return;
    updateInvoice(row.id, { status: 'cancelled' }, companyId).then((res: HrAny) => {
      try {
        throwIfApiFailed(res, t('saveFailed'));
        invalidateOnFinancialMutation(queryClient);
        showToast(t('advanceDeleted'), 'success');
      } catch (e: HrAny) {
        showToast(e?.message || t('saveFailed'), 'error');
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
        {advanceTotals.outstandingCount > 0 ? ` — ${t('advanceOutstanding')}: ${advanceTotals.outstandingCount}` : ''}
        {advanceTotals.partialCount > 0 ? ` — ${t('advanceStatusPartial')}: ${advanceTotals.partialCount}` : ''}
      </>
    ),
  }), [advanceTotals, allFilteredData.length, t]);

  const exportData = allFilteredData.map((r: HrAny) => ({
    employeeName: r.employeeName || '—',
    amount: hrFmt(r.totalAmount),
    transactionDate: formatSaudiDate(r.transactionDate),
    installmentCount: r.installmentCount > 1 ? r.installmentCount : '—',
    installmentAmount: r.installmentCount > 1 ? hrFmt(r.installmentAmount ?? 0) : '—',
    settledAmount: hrFmt(r.settledAmountNum || 0),
    remainingAmount: hrFmt(r.remainingAmount || 0),
    settlementDate: r.settledAt ? formatSaudiDate(r.settledAt) : '—',
    status: r.settlementStatus === 'cancelled'
      ? t('cancelled')
      : r.settlementStatus === 'settled'
        ? t('advanceSettled')
        : r.settlementStatus === 'partial'
          ? t('advanceStatusPartial')
        : t('advanceOutstanding'),
  }));

  const { columns, renderAdvanceDetailRows, renderMobileCard, renderCompactRow } = useAdvanceTableModel({
    t,
    expandedEmployees,
    settlementMap,
    toggleEmployeeExpanded,
    handleDeleteAdvance,
    setEditingAdvance,
    setSettlingAdvance,
  });
  const advanceFilters = (
    <>
      <Input type="select" label={t('advancesFilterEmployee')} value={employeeFilter} onChange={(e: HrAny) => setEmployeeFilter(e.target.value)} size="sm">
        <option value="">{t('advancesFilterAll')}</option>
        {employeeFilterOptions.map((emp) => (
          <option key={emp.id} value={emp.id}>{emp.name}</option>
        ))}
      </Input>
      <Input type="select" label={t('advancesFilterMonth')} value={monthFilter} onChange={(e: HrAny) => setMonthFilter(e.target.value)} size="sm">
        <option value="">{t('advancesFilterAll')}</option>
        {monthOptions.map((month: string) => (
          <option key={month} value={month}>{month}</option>
        ))}
      </Input>
      <Input type="select" label={t('advancesFilterSettlement')} value={settlementFilter} onChange={(e: HrAny) => setSettlementFilter(e.target.value)} size="sm">
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
          isRowExpanded={(row: HrAny) => expandedEmployees.has(row.employeeId)}
          renderExpandedRow={(row: HrAny) => renderAdvanceDetailRows(row.advances)}
          stripeMobileCards
        />
      )}
    >
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
          onError={(msg: HrAny) => showToast(msg, 'error')}
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
          onError={(msg: HrAny) => showToast(msg, 'error')}
        />
      )}
    </HrFlatListTabShell>
  );
}
