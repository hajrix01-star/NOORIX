/**
 * AdvancesTab — السلفيات (احترافي كامل)
 */
import React, { useState, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { invalidateOnFinancialMutation } from '../../../utils/queryInvalidation';
import { useApp } from '../../../context/AppContext';
import { useTranslation } from '../../../i18n/useTranslation';
import { createDeduction, getInvoices, updateInvoice } from '../../../services/api';
import { useEmployees } from '../../../hooks/useEmployees';
import { formatSaudiDate } from '../../../utils/saudiDate';
import { sumAmounts } from '../../../utils/format';
import { hrFmt } from '../utils/hrFmt';
import { exportToExcel } from '../../../utils/exportUtils';
import { useTableFilter } from '../../../hooks/useTableFilter';
import SmartTable from '../../../components/common/SmartTable';
import { AdvanceQuickModal } from '../components/AdvanceQuickModal';
import { HRActionsCell } from '../components/HRActionsCell';
import Toast from '../../../components/Toast';
import { employeeDisplayName } from '../../../utils/employeeDisplayName';
import { Button, Badge, AdaptiveSheet, Input, ScreenShell, cn } from '../../../ui';
import { buildAdvanceSettlementStatusMap } from '../../../constants/badgeMaps';

const PAGE_SIZE = 50;

export default function AdvancesTab() {
  const { t, lang } = useTranslation();
  const { activeCompanyId } = useApp();
  const companyId = activeCompanyId ?? '';
  const queryClient = useQueryClient();
  const [showAdvance, setShowAdvance] = useState(false);
  const [editingAdvance, setEditingAdvance] = useState(null);
  const [settlingAdvance, setSettlingAdvance] = useState(null);
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' });
  const [employeeFilter, setEmployeeFilter] = useState('');
  const [monthFilter, setMonthFilter] = useState('');
  const [settlementFilter, setSettlementFilter] = useState('all');

  const { createAdvance } = useEmployees(companyId, { includeTerminated: false });

  const { data: rawAdvanceRows, isLoading } = useQuery({
    queryKey: ['invoices', companyId, 'advance'],
    queryFn: async () => {
      const res = await getInvoices(companyId, null, null, 1, 500);
      if (!res?.success) return [];
      const items = res.data?.items ?? [];
      return items.filter((inv) => inv.kind === 'advance').map((i) => ({
        ...i,
        settledAmountNum: Number(i.settledAmount ?? 0),
        totalAmountNum: Number(i.totalAmount ?? 0),
        remainingAmount: Math.max(0, Number(i.totalAmount ?? 0) - Number(i.settledAmount ?? 0)),
        settlementStatus:
          i.status === 'cancelled'
            ? 'cancelled'
            : Number(i.settledAmount ?? 0) >= Number(i.totalAmount ?? 0)
              ? 'settled'
              : Number(i.settledAmount ?? 0) > 0
                ? 'partial'
                : 'outstanding',
      }));
    },
    enabled: !!companyId,
  });

  const items = useMemo(() => (rawAdvanceRows ?? []).map((row) => ({
    ...row,
    employeeName: employeeDisplayName(row.employee || { name: row.employeeName }, lang),
  })), [rawAdvanceRows, lang]);
  const employeeOptions = useMemo(
    () => [...new Set(items.map((r) => r.employeeName).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [items],
  );
  const monthOptions = useMemo(
    () => [...new Set(items.map((r) => String(r.transactionDate || '').slice(0, 7)).filter((m) => /^\d{4}-\d{2}$/.test(m)))].sort().reverse(),
    [items],
  );
  const preFilteredItems = useMemo(() => {
    return items.filter((row) => {
      const byEmployee = employeeFilter ? row.employeeName === employeeFilter : true;
      const byMonth = monthFilter ? String(row.transactionDate || '').slice(0, 7) === monthFilter : true;
      const bySettlement = settlementFilter === 'all'
        ? true
        : settlementFilter === 'settled'
          ? row.settlementStatus === 'settled'
          : row.settlementStatus === 'outstanding' || row.settlementStatus === 'partial';
      return byEmployee && byMonth && bySettlement;
    });
  }, [items, employeeFilter, monthFilter, settlementFilter]);

  const { filteredData, allFilteredData, searchText, setSearch, page, setPage, sortKey, sortDir, toggleSort } =
    useTableFilter(preFilteredItems, {
      searchKeys: ['employeeName', 'invoiceNumber'],
      pageSize: PAGE_SIZE,
      defaultSortKey: 'transactionDate',
      defaultSortDir: 'desc',
      dateKeys: ['transactionDate'],
    });

  const totalAmount = sumAmounts(allFilteredData.filter((r) => r.status !== 'cancelled'), 'totalAmount');
  const outstandingCount = allFilteredData.filter((r) => r.status !== 'cancelled' && r.settlementStatus !== 'settled').length;

  const settlementMap = useMemo(() => buildAdvanceSettlementStatusMap(t), [t]);

  const columns = useMemo(() => [
    { key: 'employeeName', label: t('employeeName'), sortable: true, minWidth: 180,
      render: (v, row) => (
        <span className="font-semibold text-[13px]" style={{
          color: row.settlementStatus === 'settled' ? 'var(--noorix-accent-red)' : 'inherit',
          textDecoration: row.settlementStatus === 'settled' ? 'line-through' : 'none',
        }}
        >
          {v || '—'}
        </span>
      ) },
    { key: 'totalAmount', label: t('advanceAmount'), numeric: true, sortable: true, width: 140, minWidth: 130,
      render: (v, row) => (
        <span className="nx-cell-num" style={{
          color: row.settlementStatus === 'settled' ? 'var(--noorix-accent-red)' : 'inherit',
          textDecoration: row.settlementStatus === 'settled' ? 'line-through' : 'none',
        }}
        >
          {hrFmt(row.totalAmount ?? v)}
        </span>
      ) },
    { key: 'transactionDate', label: t('advanceLoanDate'), sortable: true, width: 125, minWidth: 120,
      render: (v, row) => (
        <span className="text-[12px] whitespace-nowrap" style={{
          color: row.settlementStatus === 'settled' ? 'var(--noorix-accent-red)' : 'var(--noorix-text-muted)',
          textDecoration: row.settlementStatus === 'settled' ? 'line-through' : 'none',
        }}
        >
          {formatSaudiDate(v)}
        </span>
      ) },
    { key: 'settledAmount', label: t('advanceSettledAmount'), numeric: true, width: 120, minWidth: 110,
      render: (_, row) => (
        <span className="nx-cell-num" style={{ color: row.settlementStatus === 'settled' ? 'var(--noorix-accent-red)' : 'inherit' }}>
          {hrFmt(row.settledAmountNum || 0)}
        </span>
      ) },
    { key: 'remainingAmount', label: t('advanceRemainingAmount'), numeric: true, width: 120, minWidth: 110,
      render: (_, row) => (
        <span className="nx-cell-num" style={{ color: row.remainingAmount > 0 ? 'var(--color-noorix-amber)' : 'var(--noorix-accent-green)' }}>
          {hrFmt(row.remainingAmount || 0)}
        </span>
      ) },
    { key: 'settledAt', label: t('advanceSettlementDate'), width: 125, minWidth: 120,
      render: (v, row) => (
        <span className="nx-cell-muted-sm">
          {row.settledAt ? formatSaudiDate(row.settledAt) : '—'}
        </span>
      ) },
    { key: 'status', label: t('status'), width: 120, minWidth: 110,
      render: (_, row) => (
        <Badge
          {...Badge.fromStatus(row.settlementStatus, settlementMap)}
          size="sm"
          className={cn('shrink-0', row.settlementStatus === 'settled' && 'line-through')}
        />
      ) },
    { key: 'actions', label: t('actions'), width: '5%', align: 'center',
      render: (_, row) => (
        <HRActionsCell
          row={row}
          onEdit={() => setEditingAdvance(row)}
          onSettle={() => setSettlingAdvance(row)}
          onDelete={() => {
            if (!window.confirm(t('deleteAdvance'))) return;
            updateInvoice(row.id, { status: 'cancelled' }, companyId).then((res) => {
              if (!res?.success) throw new Error(res?.error || t('saveFailed'));
              invalidateOnFinancialMutation(queryClient);
              setToast({ visible: true, message: t('advanceDeleted'), type: 'success' });
            }).catch((e) => setToast({ visible: true, message: e?.message || t('saveFailed'), type: 'error' }));
          }}
        />
      ) },
  ], [t, settlementMap, queryClient]);

  const footerCells = (
    <>
      <td colSpan={2} className="text-[12px] text-noorix-muted font-semibold py-1.5 px-3">
        {t('advancesList')} ({allFilteredData.length}) — {t('advanceOutstanding')}: {outstandingCount}
      </td>
      <td className="text-[13px] text-end py-1.5 px-3 text-noorix-green font-black nx-font-numbers">
        {hrFmt(totalAmount.toNumber())}
      </td>
      <td colSpan={1} />
    </>
  );

  const exportData = allFilteredData.map((r) => ({
    employeeName: r.employeeName || '—',
    amount: hrFmt(r.totalAmount),
    transactionDate: formatSaudiDate(r.transactionDate),
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

  const renderMobileCard = useCallback((row) => {
    const settled = row.settlementStatus === 'settled';
    return (
      <div>
        <div className="flex items-center justify-between flex flex-wrap mb-1">
          <span className={cn('font-bold text-[15px]', settled && 'line-through text-noorix-red')}>
            {row.employeeName}
          </span>
          <Badge
            {...Badge.fromStatus(row.settlementStatus, settlementMap)}
            size="sm"
            className={cn('shrink-0', settled && 'line-through')}
          />
        </div>
        <div className="text-[11px] text-noorix-muted mb-2">{formatSaudiDate(row.transactionDate)}</div>
        <div className="grid grid-cols-3 rounded-lg gap-1.5 bg-noorix-bg-muted mb-2.5 py-2 px-[10px]">
          <div>
            <div className="text-noorix-muted mb-1 text-[10px]">{t('advanceAmount')}</div>
            <div className="text-[14px] font-bold nx-font-numbers">{hrFmt(row.totalAmountNum)}</div>
          </div>
          <div>
            <div className="text-noorix-muted mb-1 text-[10px]">{t('advanceSettledAmount')}</div>
            <div className="text-[13px] text-noorix-green nx-font-numbers">{hrFmt(row.settledAmountNum)}</div>
          </div>
          <div>
            <div className="text-noorix-muted mb-1 text-[10px]">{t('advanceRemainingAmount')}</div>
            <div className="text-[13px] nx-font-numbers" style={{ color: row.remainingAmount > 0 ? 'var(--color-noorix-amber)' : 'var(--noorix-accent-green)' }}>{hrFmt(row.remainingAmount)}</div>
          </div>
        </div>
        <div className="flex items-center justify-end">
          <HRActionsCell
            row={row}
            onEdit={() => setEditingAdvance(row)}
            onSettle={row.settlementStatus !== 'settled' && row.settlementStatus !== 'cancelled' ? () => setSettlingAdvance(row) : undefined}
          />
        </div>
      </div>
    );
  }, [t, settlementMap]);

  return (
    <ScreenShell>
      <Toast visible={toast.visible} message={toast.message} type={toast.type} onDismiss={() => setToast((p) => ({ ...p, visible: false }))} />

      <div className="mb-3 flex min-h-11 flex-col gap-3 border-b border-noorix-border pb-3 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between lg:gap-2">
        <div className="nx-toolbar min-w-0 flex-1">
          <Input type="select" value={employeeFilter} onChange={(e) => setEmployeeFilter(e.target.value)}>
            <option value="">{t('advancesFilterEmployee')} — {t('advancesFilterAll')}</option>
            {employeeOptions.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </Input>
          <Input type="select" value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)}>
            <option value="">{t('advancesFilterMonth')} — {t('advancesFilterAll')}</option>
            {monthOptions.map((month) => (
              <option key={month} value={month}>{month}</option>
            ))}
          </Input>
          <Input type="select" value={settlementFilter} onChange={(e) => setSettlementFilter(e.target.value)}>
            <option value="all">{t('advancesFilterSettlement')} — {t('advancesFilterAll')}</option>
            <option value="outstanding">{t('advancesFilterOutstandingOnly')}</option>
            <option value="settled">{t('advancesFilterSettledOnly')}</option>
          </Input>
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
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Button size="sm" onClick={() => exportToExcel(exportData, 'advances.xlsx')}>{t('exportExcel')}</Button>
          <Button variant="primary" size="sm" onClick={() => setShowAdvance(true)}>
            {t('payAdvance')}
          </Button>
        </div>
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
        title={t('hrTabAdvances')}
        badge={<span className="nx-pill nx-pill--blue nx-pill--sm">{allFilteredData.length}</span>}
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

      {showAdvance && (
        <AdvanceQuickModal
          employee={null}
          companyId={companyId}
          createAdvance={createAdvance}
          onSuccess={() => {
            invalidateOnFinancialMutation(queryClient);
            setToast({ visible: true, message: t('advancePaid'), type: 'success' });
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
            setToast({ visible: true, message: t('advanceUpdated'), type: 'success' });
            setEditingAdvance(null);
          }}
          onError={(msg) => setToast({ visible: true, message: msg, type: 'error' })}
        />
      )}
      {settlingAdvance && (
        <AdvanceSettlementModal
          advance={settlingAdvance}
          companyId={companyId}
          onClose={() => setSettlingAdvance(null)}
          onSaved={() => {
            invalidateOnFinancialMutation(queryClient);
            queryClient.invalidateQueries({ queryKey: ['deductions', companyId] });
            setToast({ visible: true, message: t('advanceSettledSuccess'), type: 'success' });
            setSettlingAdvance(null);
          }}
          onError={(msg) => setToast({ visible: true, message: msg, type: 'error' })}
        />
      )}
    </ScreenShell>
  );
}

function AdvanceEditModal({ advance, companyId, onClose, onSaved, onError }) {
  const { t } = useTranslation();
  const [amount, setAmount] = useState(String(Number(advance?.totalAmount ?? 0)));
  const [date, setDate] = useState(String(advance?.transactionDate || '').slice(0, 10));
  const [notes, setNotes] = useState(advance?.notes || '');
  const [saving, setSaving] = useState(false);

  async function submit() {
    const val = Number(amount || 0);
    if (val <= 0) return;
    setSaving(true);
    try {
      const res = await updateInvoice(advance.id, {
        totalAmount: val,
        netAmount: val,
        taxAmount: 0,
        transactionDate: date,
        notes,
      }, companyId);
      if (!res?.success) throw new Error(res?.error || t('saveFailed'));
      onSaved?.();
    } catch (e) {
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
        <Input type="number" label={t('advanceAmount')} min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <Input type="date" label={t('advanceLoanDate')} value={date} onChange={(e) => setDate(e.target.value)} />
        <Input multiline rows={3} label="ملاحظات" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
    </AdaptiveSheet>
  );
}

function AdvanceSettlementModal({ advance, companyId, onClose, onSaved, onError }) {
  const { t } = useTranslation();
  const total = Number(advance?.totalAmount ?? 0);
  const alreadySettled = Number(advance?.settledAmount ?? 0);
  const remaining = Math.max(0, total - alreadySettled);
  const [settlementType, setSettlementType] = useState('full');
  const [settleAmount, setSettleAmount] = useState(String(remaining));
  const [settleDate, setSettleDate] = useState(new Date().toISOString().slice(0, 10));
  const [deferMonth, setDeferMonth] = useState('');
  const [applyToSalary, setApplyToSalary] = useState(true);
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    try {
      if (settlementType === 'defer') {
        const deferNote = `${advance?.notes || ''}\n[ADV_DEFER] ${deferMonth || ''}`.trim();
        const res = await updateInvoice(advance.id, { notes: deferNote }, companyId);
        if (!res?.success) throw new Error(res?.error || t('saveFailed'));
        onSaved?.();
        return;
      }

      const amountToSettle = settlementType === 'full' ? remaining : Number(settleAmount || 0);
      if (amountToSettle <= 0 || amountToSettle > remaining) {
        throw new Error('قيمة التسديد غير صحيحة.');
      }

      const newSettledAmount = alreadySettled + amountToSettle;
      const fullySettled = newSettledAmount >= total;
      const notes = `${advance?.notes || ''}\n[ADV_SETTLE] ${amountToSettle} @ ${settleDate}`.trim();
      const invRes = await updateInvoice(advance.id, {
        settledAmount: newSettledAmount,
        settledAt: fullySettled ? settleDate : undefined,
        notes,
      }, companyId);
      if (!invRes?.success) throw new Error(invRes?.error || t('saveFailed'));

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
        if (!dRes?.success) throw new Error(dRes?.error || t('saveFailed'));
      }
      onSaved?.();
    } catch (e) {
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
        <Input type="select" label="نوع التسوية" value={settlementType} onChange={(e) => setSettlementType(e.target.value)}>
          <option value="full">{t('settlementFull')}</option>
          <option value="partial">{t('settlementPartial')}</option>
          <option value="defer">{t('settlementDefer')}</option>
        </Input>
        {settlementType === 'partial' && (
          <Input type="number" label={t('advanceSettledAmount')} min="0.01" step="0.01" value={settleAmount} onChange={(e) => setSettleAmount(e.target.value)} />
        )}
        {settlementType === 'defer' ? (
          <Input type="month" label="شهر التأجيل" value={deferMonth} onChange={(e) => setDeferMonth(e.target.value)} />
        ) : (
          <>
            <Input type="date" label={t('advanceSettlementDate')} value={settleDate} onChange={(e) => setSettleDate(e.target.value)} />
            <label className="nx-checkbox">
              <input type="checkbox" checked={applyToSalary} onChange={(e) => setApplyToSalary(e.target.checked)} />
              {t('applyToSalaryDeduction')}
            </label>
          </>
        )}
      </div>
    </AdaptiveSheet>
  );
}
