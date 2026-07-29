import React, { useCallback, useMemo } from 'react';
import { Badge, Button, cn, FmtNum } from '../../../ui';
import type { BadgeStatusMap } from '../../../ui/Badge';
import { formatSaudiDate } from '../../../utils/saudiDate';
import { hrFmt } from '../utils/hrFmt';
import type { SmartTableColumn } from '../../../ui';
import type { AdvanceGroupRow } from '../utils/advanceGrouping';

type TranslationFn = (key: string, ...args: unknown[]) => string;

const remainingClass = (amount: number) => amount > 0 ? 'text-noorix-amber' : 'text-noorix-green';
const displayText = (value: unknown, fallback = '-') => {
  if (value == null || value === '') return fallback;
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  return fallback;
};

type AdvanceTableModelOptions = {
  t: TranslationFn;
  settlementMap: BadgeStatusMap;
  onOpenEmployee: (row: AdvanceGroupRow) => void;
};

export function useAdvanceTableModel({
  t,
  settlementMap,
  onOpenEmployee,
}: AdvanceTableModelOptions) {
  const columns = useMemo<SmartTableColumn<AdvanceGroupRow>[]>(() => [
    { key: 'employeeName', label: t('employeeName'), sortable: true, minWidth: 220,
      render: (v: unknown, row: AdvanceGroupRow) => {
        return (
          <Button
            variant="raw"
            type="button"
            className="font-semibold text-[13px] text-start bg-transparent border-0 p-0 cursor-pointer text-noorix-green hover:underline"
            onClick={() => onOpenEmployee(row)}
          >
            {displayText(v)}
          </Button>
        );
      } },
    { key: 'advanceCount', label: t('advancesList'), numeric: true, width: 110, minWidth: 100,
      render: (_: unknown, row: AdvanceGroupRow) => (
        <span className="nx-cell-num">
          {row.advanceCount}
          {row.deductionCount ? <span className="ms-1 text-noorix-red">({row.deductionCount})</span> : null}
        </span>
      ) },
    { key: 'totalAmount', label: t('advanceAmount'), numeric: true, sortable: true, width: 140, minWidth: 130,
      render: (_: unknown, row: AdvanceGroupRow) => (
        <span className="nx-cell-num">
          {hrFmt(row.totalAmount)}
          {row.manualDeductionAmount ? (
            <span className="block text-[11px] text-noorix-red">-{hrFmt(row.manualDeductionAmount)}</span>
          ) : null}
        </span>
      ) },
    { key: 'settledAmount', label: t('advanceSettledAmount'), numeric: true, sortable: true, width: 120, minWidth: 110,
      render: (_: unknown, row: AdvanceGroupRow) => <span className="nx-cell-num text-noorix-green">{hrFmt(row.settledAmountNum || 0)}</span> },
    { key: 'remainingAmount', label: t('advanceRemainingAmount'), numeric: true, sortable: true, width: 120, minWidth: 110,
      render: (_: unknown, row: AdvanceGroupRow) => (
        <span className={cn('nx-cell-num', remainingClass(row.remainingAmount || 0))}>
          {hrFmt(row.remainingAmount || 0)}
        </span>
      ) },
    { key: 'transactionDate', label: t('advanceLoanDate'), sortable: true, width: 125, minWidth: 120,
      render: (v: unknown) => <span className="nx-cell-muted-sm whitespace-nowrap">{v ? formatSaudiDate(String(v)) : '-'}</span> },
    { key: 'status', label: t('status'), width: 140, minWidth: 120,
      render: (_: unknown, row: AdvanceGroupRow) => (
        <div className="flex items-center justify-center gap-1.5">
          {row.advanceCount > 0 ? (
            <Badge {...Badge.fromStatus(row.settlementStatus, settlementMap)} size="sm" className="shrink-0" />
          ) : null}
          {row.deductionCount > 0 ? (
            <Badge color="red" label={row.advanceCount > 0 ? `${t('deductionsList')} ${row.deductionCount}` : t('deductionsList')} size="sm" />
          ) : null}
        </div>
      ) },
    { key: 'actions', label: t('actions'), width: 110, minWidth: 100, align: 'center',
      render: (_: unknown, row: AdvanceGroupRow) => (
        <Button size="sm" variant="default" onClick={() => onOpenEmployee(row)}>
          {t('view')}
        </Button>
      ) },
  ], [onOpenEmployee, settlementMap, t]);

  const renderMobileCard = useCallback((row: AdvanceGroupRow) => {
    return (
      <div>
        <Button
          variant="raw"
          type="button"
          className="w-full flex items-center justify-between flex-wrap gap-2 mb-1 bg-transparent border-0 p-0 text-start cursor-pointer"
          onClick={() => onOpenEmployee(row)}
        >
          <span className="font-bold text-[15px] text-noorix-green">
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
      </div>
    );
  }, [onOpenEmployee, settlementMap, t]);

  const renderCompactRow = useCallback((row: AdvanceGroupRow) => {
    return (
      <div>
        <Button
          variant="raw"
          type="button"
          className="w-full bg-transparent border-0 p-0 text-start cursor-pointer"
          onClick={() => onOpenEmployee(row)}
        >
          <div className="nx-cr__line1">
            <span className="nx-cr__name text-noorix-green">
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
      </div>
    );
  }, [onOpenEmployee, settlementMap, t]);

  return { columns, renderMobileCard, renderCompactRow };
}
