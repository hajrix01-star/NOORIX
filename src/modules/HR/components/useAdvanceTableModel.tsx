import React, { useCallback, useMemo } from 'react';
import { Badge, Button, cn, FmtNum } from '../../../ui';
import { formatSaudiDate } from '../../../utils/saudiDate';
import { hrFmt } from '../utils/hrFmt';

type HrAny = ReturnType<typeof JSON.parse>;

const remainingClass = (amount: number) => amount > 0 ? 'text-noorix-amber' : 'text-noorix-green';
const isDeductionRow = (row: HrAny) => row.recordType === 'deduction';

export function useAdvanceTableModel({
  t,
  expandedEmployees,
  settlementMap,
  toggleEmployeeExpanded,
  handleDeleteAdvance,
  setEditingAdvance,
  setSettlingAdvance,
}: HrAny) {
  const columns = useMemo(() => [
    { key: 'employeeName', label: t('employeeName'), sortable: true, minWidth: 220,
      render: (v: HrAny, row: HrAny) => {
        const expanded = expandedEmployees.has(row.employeeId);
        return (
          <Button
            variant="raw"
            type="button"
            className="font-semibold text-[13px] text-start bg-transparent border-0 p-0 cursor-pointer text-noorix-blue hover:underline"
            onClick={() => toggleEmployeeExpanded(row.employeeId)}
            aria-expanded={expanded}
          >
            <span className="inline-block me-1.5" aria-hidden>{expanded ? 'v' : '>'}</span>
            {v || '-'}
          </Button>
        );
      } },
    { key: 'advanceCount', label: t('advancesList'), numeric: true, width: 110, minWidth: 100,
      render: (_: HrAny, row: HrAny) => (
        <span className="nx-cell-num">
          {row.advanceCount}
          {row.deductionCount ? <span className="ms-1 text-noorix-red">({row.deductionCount})</span> : null}
        </span>
      ) },
    { key: 'totalAmount', label: t('advanceAmount'), numeric: true, sortable: true, width: 140, minWidth: 130,
      render: (_: HrAny, row: HrAny) => (
        <span className="nx-cell-num">
          {hrFmt(row.totalAmount)}
          {row.manualDeductionAmount ? (
            <span className="block text-[11px] text-noorix-red">-{hrFmt(row.manualDeductionAmount)}</span>
          ) : null}
        </span>
      ) },
    { key: 'settledAmount', label: t('advanceSettledAmount'), numeric: true, sortable: true, width: 120, minWidth: 110,
      render: (_: HrAny, row: HrAny) => <span className="nx-cell-num text-noorix-green">{hrFmt(row.settledAmountNum || 0)}</span> },
    { key: 'remainingAmount', label: t('advanceRemainingAmount'), numeric: true, sortable: true, width: 120, minWidth: 110,
      render: (_: HrAny, row: HrAny) => (
        <span className={cn('nx-cell-num', remainingClass(row.remainingAmount || 0))}>
          {hrFmt(row.remainingAmount || 0)}
        </span>
      ) },
    { key: 'transactionDate', label: t('advanceLoanDate'), sortable: true, width: 125, minWidth: 120,
      render: (v: HrAny) => <span className="nx-cell-muted-sm whitespace-nowrap">{v ? formatSaudiDate(v) : '-'}</span> },
    { key: 'status', label: t('status'), width: 130, minWidth: 120,
      render: (_: HrAny, row: HrAny) => <Badge {...Badge.fromStatus(row.settlementStatus, settlementMap)} size="sm" className="shrink-0" /> },
  ], [expandedEmployees, settlementMap, t, toggleEmployeeExpanded]);

  const renderAdvanceDetailRows = useCallback((advances: HrAny[]) => (
    <div className="p-3 bg-noorix-bg-muted/40">
      <div className="overflow-x-auto rounded-lg border border-noorix-border bg-noorix-surface">
        <table className="w-full min-w-[760px] text-[12px]">
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
              const deduction = isDeductionRow(row);
              const settled = row.settlementStatus === 'settled';
              const canSettle = !deduction && row.settlementStatus !== 'settled' && row.settlementStatus !== 'cancelled';
              return (
                <tr key={row.id} className="border-b border-noorix-border last:border-b-0">
                  <td className={cn('px-3 py-2 whitespace-nowrap', settled && 'line-through text-noorix-muted')}>{formatSaudiDate(row.transactionDate)}</td>
                  <td className={cn('px-3 py-2 text-end nx-font-numbers', deduction && 'text-noorix-red', settled && !deduction && 'line-through text-noorix-muted')}>
                    {deduction ? '-' : ''}{hrFmt(row.totalAmountNum)}
                  </td>
                  <td className="px-3 py-2 text-end nx-font-numbers text-noorix-green">{hrFmt(row.settledAmountNum)}</td>
                  <td className={cn('px-3 py-2 text-end nx-font-numbers', remainingClass(row.remainingAmount || 0))}>{hrFmt(row.remainingAmount)}</td>
                  <td className="px-3 py-2 text-noorix-blue font-semibold ltr">
                    {deduction ? (row.notes || t('deductionsList')) : row.installmentCount > 1 ? `${row.installmentCount} x ${hrFmt(row.installmentAmount ?? 0)}` : '-'}
                  </td>
                  <td className="px-3 py-2 text-noorix-muted whitespace-nowrap">{row.settledAt ? formatSaudiDate(row.settledAt) : '-'}</td>
                  <td className="px-3 py-2 text-center">
                    {deduction ? (
                      <Badge color="red" label={t('deductionsList')} size="sm" className="shrink-0" />
                    ) : (
                      <Badge {...Badge.fromStatus(row.settlementStatus, settlementMap)} size="sm" className={cn('shrink-0', settled && 'line-through')} />
                    )}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {deduction ? (
                      <span className="text-noorix-muted">-</span>
                    ) : (
                      <div className="flex items-center justify-center gap-1.5">
                        <Button size="sm" className="h-6 px-2" variant="ghost" onClick={() => setEditingAdvance(row)}>{t('edit')}</Button>
                        {canSettle && (
                          <Button size="sm" className="h-6 px-2" variant="primary" onClick={() => setSettlingAdvance(row)}>{t('settleAdvance')}</Button>
                        )}
                        <Button size="sm" className="h-6 px-2" variant="danger" onClick={() => handleDeleteAdvance(row)}>{t('delete')}</Button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  ), [handleDeleteAdvance, settlementMap, setEditingAdvance, setSettlingAdvance, t]);

  const renderMobileCard = useCallback((row: HrAny) => {
    const expanded = expandedEmployees.has(row.employeeId);
    return (
      <div>
        <Button
          variant="raw"
          type="button"
          className="w-full flex items-center justify-between flex-wrap gap-2 mb-1 bg-transparent border-0 p-0 text-start cursor-pointer"
          onClick={() => toggleEmployeeExpanded(row.employeeId)}
          aria-expanded={expanded}
        >
          <span className="font-bold text-[15px] text-noorix-blue">
            <span className="inline-block me-1.5" aria-hidden>{expanded ? 'v' : '>'}</span>
            {row.employeeName}
          </span>
          <Badge {...Badge.fromStatus(row.settlementStatus, settlementMap)} size="sm" className="shrink-0" />
        </Button>
        <div className="text-[11px] text-noorix-muted mb-2 text-end">{row.advanceCount} - {formatSaudiDate(row.transactionDate)}</div>
        <div className="nx-mc__grid nx-mc__grid--3 mb-2.5">
          <div>
            <div className="nx-mc__stat-label">{t('advanceAmount')}</div>
            <div className="nx-mc__stat-value text-[14px] font-bold">{hrFmt(row.totalAmount)}</div>
            {row.manualDeductionAmount ? <div className="text-[11px] text-noorix-red">-{hrFmt(row.manualDeductionAmount)}</div> : null}
          </div>
          <div>
            <div className="nx-mc__stat-label">{t('advanceSettledAmount')}</div>
            <div className="nx-mc__stat-value text-[13px] text-noorix-green">{hrFmt(row.settledAmountNum)}</div>
          </div>
          <div>
            <div className="nx-mc__stat-label">{t('advanceRemainingAmount')}</div>
            <div className={cn('nx-mc__stat-value text-[13px]', remainingClass(row.remainingAmount || 0))}>
              {hrFmt(row.remainingAmount)}
            </div>
          </div>
        </div>
        {expanded && (
          <div className="mt-3 grid gap-2">
            {row.advances.map((advance: HrAny) => {
              const deduction = isDeductionRow(advance);
              const canSettle = !deduction && advance.settlementStatus !== 'settled' && advance.settlementStatus !== 'cancelled';
              return (
                <div key={advance.id} className="rounded-lg border border-noorix-border bg-noorix-bg-muted/40 p-2.5">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[12px] text-noorix-muted">{formatSaudiDate(advance.transactionDate)}</span>
                    {deduction ? <Badge color="red" label={t('deductionsList')} size="sm" /> : <Badge {...Badge.fromStatus(advance.settlementStatus, settlementMap)} size="sm" />}
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center mb-2">
                    <div>
                      <div className="nx-mc__stat-label">{t('advanceAmount')}</div>
                      <div className={cn('nx-mc__stat-value', deduction && 'text-noorix-red')}>{deduction ? '-' : ''}{hrFmt(advance.totalAmountNum)}</div>
                    </div>
                    <div>
                      <div className="nx-mc__stat-label">{t('advanceSettledAmount')}</div>
                      <div className="nx-mc__stat-value text-noorix-green">{hrFmt(advance.settledAmountNum)}</div>
                    </div>
                    <div>
                      <div className="nx-mc__stat-label">{t('advanceRemainingAmount')}</div>
                      <div className={cn('nx-mc__stat-value', remainingClass(advance.remainingAmount || 0))}>
                        {hrFmt(advance.remainingAmount)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-1.5">
                    {deduction ? (
                      <span className="text-[11px] text-noorix-muted">{advance.notes || t('deductionsList')}</span>
                    ) : (
                      <>
                        <Button size="sm" className="h-6 px-2" variant="ghost" onClick={() => setEditingAdvance(advance)}>{t('edit')}</Button>
                        {canSettle && (
                          <Button size="sm" className="h-6 px-2" variant="primary" onClick={() => setSettlingAdvance(advance)}>{t('settleAdvance')}</Button>
                        )}
                        <Button size="sm" className="h-6 px-2" variant="danger" onClick={() => handleDeleteAdvance(advance)}>{t('delete')}</Button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }, [expandedEmployees, handleDeleteAdvance, settlementMap, setEditingAdvance, setSettlingAdvance, t, toggleEmployeeExpanded]);

  const renderCompactRow = useCallback((row: HrAny) => {
    const expanded = expandedEmployees.has(row.employeeId);
    return (
      <div>
        <Button
          variant="raw"
          type="button"
          className="w-full bg-transparent border-0 p-0 text-start cursor-pointer"
          onClick={() => toggleEmployeeExpanded(row.employeeId)}
          aria-expanded={expanded}
        >
          <div className="nx-cr__line1">
            <span className="nx-cr__name text-noorix-blue">
              <span className="inline-block me-1.5" aria-hidden>{expanded ? 'v' : '>'}</span>
              {row.employeeName}
            </span>
            <Badge {...Badge.fromStatus(row.settlementStatus, settlementMap)} size="sm" />
          </div>
          <div className="nx-cr__line2">
            <div className="nx-cr__line2-start">
              <span className="nx-cr__meta">{row.advanceCount} - {formatSaudiDate(row.transactionDate)}</span>
            </div>
            <div className="nx-cr__line2-end">
              <span className={cn('nx-cr__amount', remainingClass(row.remainingAmount || 0))}>
                <FmtNum n={row.remainingAmount} /> <span className="nx-sar">SR</span>
              </span>
            </div>
          </div>
        </Button>
        {expanded && (
          <div className="mt-2 grid gap-2">
            {row.advances.map((advance: HrAny) => {
              const deduction = isDeductionRow(advance);
              const canSettle = !deduction && advance.settlementStatus !== 'settled' && advance.settlementStatus !== 'cancelled';
              return (
                <div key={advance.id} className="rounded-lg border border-noorix-border bg-noorix-bg-muted/50 px-2.5 py-2">
                  <div className="nx-cr__line1">
                    <span className="nx-cr__name text-[12px]">{formatSaudiDate(advance.transactionDate)}</span>
                    {deduction ? <Badge color="red" label={t('deductionsList')} size="sm" /> : <Badge {...Badge.fromStatus(advance.settlementStatus, settlementMap)} size="sm" />}
                  </div>
                  <div className="nx-cr__line2">
                    <div className="nx-cr__line2-start">
                      <span className={cn('nx-cr__meta', deduction && 'text-noorix-red')}>{deduction ? t('deductionsList') : t('advanceAmount')}: {deduction ? '-' : ''}{hrFmt(advance.totalAmountNum)}</span>
                    </div>
                    <div className="nx-cr__line2-end">
                      <span className={cn('nx-cr__amount', remainingClass(advance.remainingAmount || 0))}>
                        <FmtNum n={advance.remainingAmount} /> <span className="nx-sar">SR</span>
                      </span>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center justify-end gap-1.5">
                    {deduction ? (
                      <span className="text-[11px] text-noorix-muted">{advance.notes || t('deductionsList')}</span>
                    ) : (
                      <>
                        <Button size="sm" className="h-6 px-2" variant="ghost" onClick={() => setEditingAdvance(advance)}>{t('edit')}</Button>
                        {canSettle && (
                          <Button size="sm" className="h-6 px-2" variant="primary" onClick={() => setSettlingAdvance(advance)}>{t('settleAdvance')}</Button>
                        )}
                        <Button size="sm" className="h-6 px-2" variant="danger" onClick={() => handleDeleteAdvance(advance)}>{t('delete')}</Button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }, [expandedEmployees, handleDeleteAdvance, settlementMap, setEditingAdvance, setSettlingAdvance, t, toggleEmployeeExpanded]);

  return { columns, renderAdvanceDetailRows, renderMobileCard, renderCompactRow };
}
