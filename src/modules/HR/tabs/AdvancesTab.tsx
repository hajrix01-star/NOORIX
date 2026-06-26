/**
 * AdvancesTab — السلفيات (احترافي كامل)
 */
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { invalidateOnFinancialMutation } from '../../../utils/queryInvalidation';
import { useApp } from '../../../context/AppContext';
import { useToast } from '../../../context/ToastContext';
import { useTranslation } from '../../../i18n/useTranslation';
import { createDeduction, getHrAdvances, updateInvoice, throwIfApiFailed } from '../../../services/api';
import { useEmployees } from '../../../hooks/useEmployees';
import { formatSaudiDate, getSaudiToday, toYmd } from '../../../utils/saudiDate';
import { hrFmt } from '../utils/hrFmt';
import { exportToExcel } from '../../../utils/exportUtils';
import { useTableFilter } from '../../../hooks/useTableFilter';
import { AdvanceQuickModal } from '../components/AdvanceQuickModal';
import { HRActionsCell } from '../components/HRActionsCell';
import { employeeDisplayName } from '../../../utils/employeeDisplayName';
import { Button, Badge, AdaptiveSheet, Input, cn, FmtNum, KebabMenu, SmartTable } from '../../../ui';
import { buildAdvanceSettlementStatusMap } from '../../../constants/badgeMaps';
import { rejectIfApiFailed } from '../../../utils/apiResponse';
import { hrKeys } from '../../../services/queryKeys';
import { hrFlatSmartTableShellProps } from '../hrWorkspaceLayout';
import { HrFlatListTabShell } from '../components/HrFlatListTabShell';
import { HrTabToolbar } from '../components/HrTabToolbar';
import { countTruthyFilters } from '../utils/hrActiveFilterCount';
import { getAdvanceTotals, normalizeAdvances } from '../utils/advanceBalance';
import { buildAdvanceFinancialFooterRow } from '../utils/advanceTableFooter';

const PAGE_SIZE = 50;

type AdvancesTabProps = { embedded?: boolean };

export default function AdvancesTab({ embedded }: AdvancesTabProps = {}) {
  const { t, lang } = useTranslation();
  const { activeCompanyId } = useApp();
  const companyId = activeCompanyId ?? '';
  const queryClient = useQueryClient();
  const [showAdvance, setShowAdvance] = useState(false);
  const [editingAdvance, setEditingAdvance] = useState<any>(null);
  const [settlingAdvance, setSettlingAdvance] = useState<any>(null);
  const { showToast } = useToast();
  const [employeeFilter, setEmployeeFilter] = useState('');
  const [monthFilter, setMonthFilter] = useState('');
  const [settlementFilter, setSettlementFilter] = useState('all');
  const [expandedEmployees, setExpandedEmployees] = useState<Set<string>>(() => new Set());
  const [groupPage, setGroupPage] = useState(1);

  const { createAdvance, employees: activeEmployees } = useEmployees(companyId, {
    includeTerminated: false,
    fetchEnabled: !!companyId,
  });

  const { data: rawAdvanceRows, isLoading, isError } = useQuery({
    queryKey: hrKeys.advancesForCompany(companyId),
    queryFn: async () => {
      const res = await getHrAdvances(companyId);
      throwIfApiFailed(res, 'فشل تحميل السلف');
      const items = Array.isArray(res.data) ? res.data : (res.data?.items ?? []);
      return normalizeAdvances(items);
    },
    enabled: !!companyId,
  });

  const items = useMemo(() => (rawAdvanceRows ?? []).map((row: any) => {
    const emp = row.employee || { name: row.employeeName };
    return {
      ...row,
      employeeName: employeeDisplayName(emp, lang, row.employeeId),
    };
  }), [rawAdvanceRows, lang]);
  const employeeFilterOptions = useMemo(
    () => [...activeEmployees]
      .map((emp: any) => ({
        id: emp.id,
        name: employeeDisplayName(emp, lang, emp.id),
      }))
      .sort((a, b) => String(a.name).localeCompare(String(b.name), lang === 'ar' ? 'ar' : 'en')),
    [activeEmployees, lang],
  );
  const monthOptions = useMemo(
    () => [...new Set(items.map((r: any) => String(r.transactionDate || '').slice(0, 7)).filter((m: any) => /^\d{4}-\d{2}$/.test(m)))].sort().reverse(),
    [items],
  ) as string[];
  const preFilteredItems = useMemo(() => {
    return items.filter((row: any) => {
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

  const handleDeleteAdvance = useCallback((row: any) => {
    if (!window.confirm(t('deleteAdvance'))) return;
    updateInvoice(row.id, { status: 'cancelled' }, companyId).then((res: any) => {
      try {
        rejectIfApiFailed(res, t('saveFailed'));
        invalidateOnFinancialMutation(queryClient);
        showToast(t('advanceDeleted'), 'success');
      } catch (e: any) {
        showToast(e?.message || t('saveFailed'), 'error');
      }
    });
  }, [companyId, queryClient, showToast, t]);

  const groupedRows = useMemo(() => {
    const groups = new Map<string, any>();
    for (const row of allFilteredData) {
      const employeeId = String(row.employeeId || row.employeeName || 'unknown');
      const existing = groups.get(employeeId) || {
        id: employeeId,
        employeeId,
        employeeName: row.employeeName || '—',
        advances: [],
        totalAmount: 0,
        totalAmountNum: 0,
        settledAmountNum: 0,
        remainingAmount: 0,
        transactionDate: '',
        advanceCount: 0,
        outstandingCount: 0,
        partialCount: 0,
        settledCount: 0,
      };
      existing.advances.push(row);
      existing.totalAmount += Number(row.totalAmountNum ?? row.totalAmount ?? 0);
      existing.totalAmountNum = existing.totalAmount;
      existing.settledAmountNum += Number(row.settledAmountNum || 0);
      existing.remainingAmount += Number(row.remainingAmount || 0);
      existing.advanceCount += 1;
      if (!existing.transactionDate || String(row.transactionDate || '') > existing.transactionDate) {
        existing.transactionDate = String(row.transactionDate || '');
      }
      if (row.settlementStatus === 'outstanding') existing.outstandingCount += 1;
      if (row.settlementStatus === 'partial') existing.partialCount += 1;
      if (row.settlementStatus === 'settled') existing.settledCount += 1;
      groups.set(employeeId, existing);
    }

    const rows = [...groups.values()].map((group) => ({
      ...group,
      settlementStatus: group.remainingAmount <= 0
        ? 'settled'
        : group.settledAmountNum > 0
          ? 'partial'
          : 'outstanding',
    }));

    return rows.sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'employeeName') cmp = String(a.employeeName || '').localeCompare(String(b.employeeName || ''), lang === 'ar' ? 'ar' : 'en');
      else if (sortKey === 'totalAmount') cmp = Number(a.totalAmount || 0) - Number(b.totalAmount || 0);
      else if (sortKey === 'settledAmount') cmp = Number(a.settledAmountNum || 0) - Number(b.settledAmountNum || 0);
      else if (sortKey === 'remainingAmount') cmp = Number(a.remainingAmount || 0) - Number(b.remainingAmount || 0);
      else cmp = new Date(a.transactionDate || 0).getTime() - new Date(b.transactionDate || 0).getTime();
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [allFilteredData, lang, sortDir, sortKey]);

  useEffect(() => {
    setGroupPage(1);
  }, [employeeFilter, monthFilter, settlementFilter, searchText, sortKey, sortDir, allFilteredData.length]);

  const groupedPageRows = useMemo(
    () => groupedRows.slice((groupPage - 1) * PAGE_SIZE, groupPage * PAGE_SIZE),
    [groupPage, groupedRows],
  );

  const columns = useMemo(() => [
    { key: 'employeeName', label: t('employeeName'), sortable: true, minWidth: 220,
      render: (v: any, row: any) => {
        const expanded = expandedEmployees.has(row.employeeId);
        return (
          <button
            type="button"
            className="font-semibold text-[13px] text-start bg-transparent border-0 p-0 cursor-pointer text-noorix-blue hover:underline"
            onClick={() => toggleEmployeeExpanded(row.employeeId)}
            aria-expanded={expanded}
          >
            <span className="inline-block me-1.5" aria-hidden>{expanded ? '▾' : '▸'}</span>
            {v || '—'}
          </button>
        );
      } },
    { key: 'advanceCount', label: t('advancesList'), numeric: true, width: 110, minWidth: 100,
      render: (_: any, row: any) => <span className="nx-cell-num">{row.advanceCount}</span> },
    { key: 'totalAmount', label: t('advanceAmount'), numeric: true, sortable: true, width: 140, minWidth: 130,
      render: (_: any, row: any) => <span className="nx-cell-num">{hrFmt(row.totalAmount)}</span> },
    { key: 'settledAmount', label: t('advanceSettledAmount'), numeric: true, sortable: true, width: 120, minWidth: 110,
      render: (_: any, row: any) => <span className="nx-cell-num text-noorix-green">{hrFmt(row.settledAmountNum || 0)}</span> },
    { key: 'remainingAmount', label: t('advanceRemainingAmount'), numeric: true, sortable: true, width: 120, minWidth: 110,
      render: (_: any, row: any) => (
        <span className="nx-cell-num" style={{ color: row.remainingAmount > 0 ? 'var(--color-noorix-amber)' : 'var(--noorix-accent-green)' }}>
          {hrFmt(row.remainingAmount || 0)}
        </span>
      ) },
    { key: 'transactionDate', label: t('advanceLoanDate'), sortable: true, width: 125, minWidth: 120,
      render: (v: any) => <span className="nx-cell-muted-sm whitespace-nowrap">{v ? formatSaudiDate(v) : '—'}</span> },
    { key: 'status', label: t('status'), width: 130, minWidth: 120,
      render: (_: any, row: any) => <Badge {...Badge.fromStatus(row.settlementStatus, settlementMap)} size="sm" className="shrink-0" /> },
  ], [expandedEmployees, settlementMap, t, toggleEmployeeExpanded]);

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

  const exportData = allFilteredData.map((r: any) => ({
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

  const renderAdvanceDetailRows = useCallback((advances: any[]) => (
    <div className="p-3 bg-noorix-bg-muted/40">
      <div className="overflow-x-auto rounded-lg border border-noorix-border bg-noorix-surface">
        <table className="w-full text-[12px]" style={{ minWidth: 760 }}>
          <thead>
            <tr className="border-b border-noorix-border text-noorix-muted">
              <th className="text-start px-3 py-2">{t('advanceLoanDate')}</th>
              <th className="text-end px-3 py-2">{t('advanceAmount')}</th>
              <th className="text-end px-3 py-2">{t('advanceSettledAmount')}</th>
              <th className="text-end px-3 py-2">{t('advanceRemainingAmount')}</th>
              <th className="text-start px-3 py-2">{t('installmentInfo')}</th>
              <th className="text-start px-3 py-2">{t('advanceSettlementDate')}</th>
              <th className="text-center px-3 py-2">{t('status')}</th>
              <th className="text-center px-3 py-2">{t('actions')}</th>
            </tr>
          </thead>
          <tbody>
            {advances.map((row) => {
              const settled = row.settlementStatus === 'settled';
              const canSettle = row.settlementStatus !== 'settled' && row.settlementStatus !== 'cancelled';
              return (
                <tr key={row.id} className="border-b border-noorix-border last:border-b-0">
                  <td className={cn('px-3 py-2 whitespace-nowrap', settled && 'line-through text-noorix-muted')}>{formatSaudiDate(row.transactionDate)}</td>
                  <td className={cn('px-3 py-2 text-end nx-font-numbers', settled && 'line-through text-noorix-muted')}>{hrFmt(row.totalAmountNum)}</td>
                  <td className="px-3 py-2 text-end nx-font-numbers text-noorix-green">{hrFmt(row.settledAmountNum)}</td>
                  <td className="px-3 py-2 text-end nx-font-numbers" style={{ color: row.remainingAmount > 0 ? 'var(--color-noorix-amber)' : 'var(--noorix-accent-green)' }}>{hrFmt(row.remainingAmount)}</td>
                  <td className="px-3 py-2 text-noorix-blue font-semibold ltr">
                    {row.installmentCount > 1 ? `${row.installmentCount} × ${hrFmt(row.installmentAmount ?? 0)}` : '—'}
                  </td>
                  <td className="px-3 py-2 text-noorix-muted whitespace-nowrap">{row.settledAt ? formatSaudiDate(row.settledAt) : '—'}</td>
                  <td className="px-3 py-2 text-center">
                    <Badge {...Badge.fromStatus(row.settlementStatus, settlementMap)} size="sm" className={cn('shrink-0', settled && 'line-through')} />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <HRActionsCell
                      row={row}
                      onEdit={() => setEditingAdvance(row)}
                      onSettle={canSettle ? () => setSettlingAdvance(row) : undefined}
                      onDelete={() => handleDeleteAdvance(row)}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  ), [handleDeleteAdvance, settlementMap, t]);

  const renderMobileCard = useCallback((row: any) => {
    const expanded = expandedEmployees.has(row.employeeId);
    return (
      <div>
        <button
          type="button"
          className="w-full flex items-center justify-between flex-wrap gap-2 mb-1 bg-transparent border-0 p-0 text-start cursor-pointer"
          onClick={() => toggleEmployeeExpanded(row.employeeId)}
          aria-expanded={expanded}
        >
          <span className="font-bold text-[15px] text-noorix-blue">
            <span className="inline-block me-1.5" aria-hidden>{expanded ? '▾' : '▸'}</span>
            {row.employeeName}
          </span>
          <Badge
            {...Badge.fromStatus(row.settlementStatus, settlementMap)}
            size="sm"
            className="shrink-0"
          />
        </button>
        <div className="text-[11px] text-noorix-muted mb-2 text-end">{row.advanceCount} · {formatSaudiDate(row.transactionDate)}</div>
        <div className="nx-mc__grid nx-mc__grid--3 mb-2.5">
          <div>
            <div className="nx-mc__stat-label">{t('advanceAmount')}</div>
            <div className="nx-mc__stat-value text-[14px] font-bold">{hrFmt(row.totalAmount)}</div>
          </div>
          <div>
            <div className="nx-mc__stat-label">{t('advanceSettledAmount')}</div>
            <div className="nx-mc__stat-value text-[13px] text-noorix-green">{hrFmt(row.settledAmountNum)}</div>
          </div>
          <div>
            <div className="nx-mc__stat-label">{t('advanceRemainingAmount')}</div>
            <div
              className="nx-mc__stat-value text-[13px]"
              style={{ color: row.remainingAmount > 0 ? 'var(--color-noorix-amber)' : 'var(--noorix-accent-green)' }}
            >
              {hrFmt(row.remainingAmount)}
            </div>
          </div>
        </div>
        {expanded && (
          <div className="mt-3 grid gap-2">
            {row.advances.map((advance: any) => {
              const canSettle = advance.settlementStatus !== 'settled' && advance.settlementStatus !== 'cancelled';
              return (
                <div key={advance.id} className="rounded-lg border border-noorix-border bg-noorix-bg-muted/40 p-2.5">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[12px] text-noorix-muted">{formatSaudiDate(advance.transactionDate)}</span>
                    <Badge {...Badge.fromStatus(advance.settlementStatus, settlementMap)} size="sm" />
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center mb-2">
                    <div>
                      <div className="nx-mc__stat-label">{t('advanceAmount')}</div>
                      <div className="nx-mc__stat-value">{hrFmt(advance.totalAmountNum)}</div>
                    </div>
                    <div>
                      <div className="nx-mc__stat-label">{t('advanceSettledAmount')}</div>
                      <div className="nx-mc__stat-value text-noorix-green">{hrFmt(advance.settledAmountNum)}</div>
                    </div>
                    <div>
                      <div className="nx-mc__stat-label">{t('advanceRemainingAmount')}</div>
                      <div className="nx-mc__stat-value" style={{ color: advance.remainingAmount > 0 ? 'var(--color-noorix-amber)' : 'var(--noorix-accent-green)' }}>
                        {hrFmt(advance.remainingAmount)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-end">
                    <HRActionsCell
                      row={advance}
                      onEdit={() => setEditingAdvance(advance)}
                      onSettle={canSettle ? () => setSettlingAdvance(advance) : undefined}
                      onDelete={() => handleDeleteAdvance(advance)}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }, [expandedEmployees, handleDeleteAdvance, settlementMap, t, toggleEmployeeExpanded]);

  const renderCompactRow = useCallback((row: any) => {
    const expanded = expandedEmployees.has(row.employeeId);
    return (
      <div>
        <button
          type="button"
          className="w-full bg-transparent border-0 p-0 text-start cursor-pointer"
          onClick={() => toggleEmployeeExpanded(row.employeeId)}
          aria-expanded={expanded}
        >
          <div className="nx-cr__line1">
            <span className="nx-cr__name text-noorix-blue">
              <span className="inline-block me-1.5" aria-hidden>{expanded ? '▾' : '▸'}</span>
              {row.employeeName}
            </span>
            <Badge {...Badge.fromStatus(row.settlementStatus, settlementMap)} size="sm" />
          </div>
          <div className="nx-cr__line2">
            <div className="nx-cr__line2-start">
              <span className="nx-cr__meta">{row.advanceCount} · {formatSaudiDate(row.transactionDate)}</span>
            </div>
            <div className="nx-cr__line2-end">
              <span className="nx-cr__amount" style={{ color: row.remainingAmount > 0 ? 'var(--color-noorix-amber)' : 'var(--noorix-accent-green)' }}>
                <FmtNum n={row.remainingAmount} /> <span className="nx-sar">SR</span>
              </span>
            </div>
          </div>
        </button>
        {expanded && (
          <div className="mt-2 grid gap-2">
            {row.advances.map((advance: any) => {
              const canSettle = advance.settlementStatus !== 'settled' && advance.settlementStatus !== 'cancelled';
              return (
                <div key={advance.id} className="rounded-lg border border-noorix-border bg-noorix-bg-muted/50 px-2.5 py-2">
                  <div className="nx-cr__line1">
                    <span className="nx-cr__name text-[12px]">{formatSaudiDate(advance.transactionDate)}</span>
                    <Badge {...Badge.fromStatus(advance.settlementStatus, settlementMap)} size="sm" />
                  </div>
                  <div className="nx-cr__line2">
                    <div className="nx-cr__line2-start">
                      <span className="nx-cr__meta">{t('advanceAmount')}: {hrFmt(advance.totalAmountNum)}</span>
                    </div>
                    <div className="nx-cr__line2-end">
                      <span className="nx-cr__amount" style={{ color: advance.remainingAmount > 0 ? 'var(--color-noorix-amber)' : 'var(--noorix-accent-green)' }}>
                        <FmtNum n={advance.remainingAmount} /> <span className="nx-sar">SR</span>
                      </span>
                      <div className="nx-cr__kebab" onClick={(e) => e.stopPropagation()}>
                        <KebabMenu
                          ariaLabel={t('actions')}
                          items={[
                            { key: 'edit', label: t('edit'), style: { color: 'var(--noorix-accent-green)' }, onClick: () => setEditingAdvance(advance) },
                            ...(canSettle ? [{ key: 'settle', label: t('settleAdvance'), style: { color: 'var(--noorix-accent-blue)' }, onClick: () => setSettlingAdvance(advance) }] : []),
                            { key: 'delete', label: t('delete'), style: { color: 'var(--noorix-accent-red)' }, onClick: () => handleDeleteAdvance(advance) },
                          ]}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }, [expandedEmployees, handleDeleteAdvance, settlementMap, t, toggleEmployeeExpanded]);

  const advanceFilters = (
    <>
      <Input type="select" label={t('advancesFilterEmployee')} value={employeeFilter} onChange={(e: any) => setEmployeeFilter(e.target.value)} size="sm">
        <option value="">{t('advancesFilterAll')}</option>
        {employeeFilterOptions.map((emp) => (
          <option key={emp.id} value={emp.id}>{emp.name}</option>
        ))}
      </Input>
      <Input type="select" label={t('advancesFilterMonth')} value={monthFilter} onChange={(e: any) => setMonthFilter(e.target.value)} size="sm">
        <option value="">{t('advancesFilterAll')}</option>
        {monthOptions.map((month: string) => (
          <option key={month} value={month}>{month}</option>
        ))}
      </Input>
      <Input type="select" label={t('advancesFilterSettlement')} value={settlementFilter} onChange={(e: any) => setSettlementFilter(e.target.value)} size="sm">
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
          rowNumberWidth="1%"
          {...hrFlatSmartTableShellProps(embedded)}
          columns={columns}
          data={groupedPageRows}
          total={groupedRows.length}
          page={groupPage}
          pageSize={PAGE_SIZE}
          onPageChange={setGroupPage}
          isLoading={isLoading}
          isError={isError}
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
          isRowExpanded={(row: any) => expandedEmployees.has(row.employeeId)}
          renderExpandedRow={(row: any) => renderAdvanceDetailRows(row.advances)}
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
          onError={(msg: any) => showToast(msg, 'error')}
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
          onError={(msg: any) => showToast(msg, 'error')}
        />
      )}
    </HrFlatListTabShell>
  );
}

function AdvanceEditModal({ advance, companyId, onClose, onSaved, onError }: any) {
  const { t } = useTranslation();
  const [amount, setAmount] = useState(String(Number(advance?.totalAmount ?? 0)));
  const [date, setDate] = useState(toYmd(advance?.transactionDate));
  const [notes, setNotes] = useState(advance?.notes || '');
  const [installmentCount, setInstallmentCount] = useState(
    advance?.installmentCount > 1 ? String(advance.installmentCount) : '',
  );
  const [saving, setSaving] = useState(false);

  const parsedCount = parseInt(installmentCount, 10) || 1;
  const installmentAmt = parsedCount > 1
    ? Math.ceil((Number(amount || 0) / parsedCount) * 100) / 100
    : null;

  async function submit() {
    const val = Number(amount || 0);
    if (val <= 0) return;
    setSaving(true);
    try {
      const payload: Record<string, any> = {
        totalAmount: val,
        netAmount: val,
        taxAmount: 0,
        transactionDate: date,
        notes,
      };
      if (parsedCount > 1) {
        payload.installmentCount = parsedCount;
        payload.installmentAmount = installmentAmt;
      } else {
        payload.installmentCount = 1;
        payload.installmentAmount = val;
      }
      const res = await updateInvoice(advance.id, payload, companyId);
      rejectIfApiFailed(res, t('saveFailed'));
      onSaved?.();
    } catch (e: any) {
      onError?.(e?.message || t('saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdaptiveSheet
      open={true}
      onClose={onClose}
      title={t('editAdvance')}
      size="md"
      side="start"
      className="hr-advance-edit-drawer"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>{t('cancel')}</Button>
          <Button variant="primary" disabled={saving} onClick={submit}>{saving ? t('saving') : t('saveChanges')}</Button>
        </>
      }
    >
      <div className="grid gap-2.5">
        <Input type="number" label={t('advanceAmount')} min="0.01" step="0.01" value={amount} onChange={(e: any) => setAmount(e.target.value)} />
        <Input type="date" label={t('advanceLoanDate')} value={date} onChange={(e: any) => setDate(e.target.value)} />
        <Input
          type="number"
          min="1"
          max="120"
          step="1"
          label={t('installmentCount')}
          value={installmentCount}
          onChange={(e: any) => setInstallmentCount(e.target.value)}
          placeholder="1"
        />
        {parsedCount > 1 && installmentAmt && (
          <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-noorix-bg-muted border border-noorix-border">
            <span className="text-[13px] text-noorix-muted">{t('installmentAmount')}</span>
            <span dir="ltr" className="text-[15px] font-bold text-noorix-blue">
              <FmtNum n={installmentAmt} /> <span className="nx-sar">SR</span>
            </span>
          </div>
        )}
        <Input multiline rows={3} label={t('notes')} value={notes} onChange={(e: any) => setNotes(e.target.value)} />
      </div>
    </AdaptiveSheet>
  );
}

function AdvanceSettlementModal({ advance, companyId, onClose, onSaved, onError }: any) {
  const { t } = useTranslation();
  const total = Number(advance?.totalAmount ?? 0);
  const alreadySettled = Number(advance?.settledAmount ?? 0);
  const remaining = Math.max(0, total - alreadySettled);
  const [settlementType, setSettlementType] = useState('full');
  const [settleAmount, setSettleAmount] = useState(String(remaining));
  const [settleDate, setSettleDate] = useState(getSaudiToday());
  const [deferMonth, setDeferMonth] = useState('');
  const [applyToSalary, setApplyToSalary] = useState(true);
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    try {
      if (settlementType === 'defer') {
        const deferNote = `${advance?.notes || ''}\n[ADV_DEFER] ${deferMonth || ''}`.trim();
        const res = await updateInvoice(advance.id, { notes: deferNote }, companyId);
        rejectIfApiFailed(res, t('saveFailed'));
        onSaved?.();
        return;
      }

      const amountToSettle = settlementType === 'full' ? remaining : Number(settleAmount || 0);
      if (amountToSettle <= 0 || amountToSettle > remaining) {
        throw new Error('قيمة التسديد غير صحيحة.');
      }

      const newSettledAmount = alreadySettled + amountToSettle;
      const notes = `${advance?.notes || ''}\n[ADV_SETTLE] ${amountToSettle} @ ${settleDate}`.trim();
      const invRes = await updateInvoice(advance.id, {
        settledAmount: newSettledAmount,
        settledAt: settleDate,
        notes,
      }, companyId);
      rejectIfApiFailed(invRes, t('saveFailed'));

      if (applyToSalary) {
        const dRes = await createDeduction({
          companyId,
          employeeId: advance.employeeId,
          deductionType: 'advance',
          amount: amountToSettle,
          transactionDate: settleDate,
          referenceId: advance.id,
          notes: `خصم سلفة (${advance.invoiceNumber || advance.id})`,
        });
        rejectIfApiFailed(dRes, t('saveFailed'));
      }
      onSaved?.();
    } catch (e: any) {
      onError?.(e?.message || t('saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdaptiveSheet
      open={true}
      onClose={onClose}
      title={t('settleAdvance')}
      size="md"
      side="start"
      className="hr-advance-settle-drawer"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>{t('cancel')}</Button>
          <Button variant="primary" disabled={saving} onClick={submit}>{saving ? t('saving') : t('saveChanges')}</Button>
        </>
      }
    >
      <div className="text-[13px] mb-2">{t('advanceRemainingAmount')}: <strong>{hrFmt(remaining)}</strong></div>
      <div className="grid gap-2.5">
        <Input type="select" label="نوع التسوية" value={settlementType} onChange={(e: any) => setSettlementType(e.target.value)}>
          <option value="full">{t('settlementFull')}</option>
          <option value="partial">{t('settlementPartial')}</option>
          <option value="defer">{t('settlementDefer')}</option>
        </Input>
        {settlementType === 'partial' && (
          <Input type="number" label={t('advanceSettledAmount')} min="0.01" step="0.01" value={settleAmount} onChange={(e: any) => setSettleAmount(e.target.value)} />
        )}
        {settlementType === 'defer' ? (
          <Input type="month" label="شهر التأجيل" value={deferMonth} onChange={(e: any) => setDeferMonth(e.target.value)} />
        ) : (
          <>
            <Input type="date" label={t('advanceSettlementDate')} value={settleDate} onChange={(e: any) => setSettleDate(e.target.value)} />
            <label className="nx-checkbox">
              <input type="checkbox" checked={applyToSalary} onChange={(e: any) => setApplyToSalary(e.target.checked)} />
              {t('applyToSalaryDeduction')}
            </label>
          </>
        )}
      </div>
    </AdaptiveSheet>
  );
}
