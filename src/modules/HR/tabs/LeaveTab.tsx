/**
 * LeaveTab — الإجازات (احترافي كامل)
 */
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useApp } from '../../../context/AppContext';
import { useTranslation } from '../../../i18n/useTranslation';
import {
  getLeaves,
  returnFromLeave,
  getLeaveSalarySettlementPreview,
  issueLeaveSalarySettlement,
  deleteLeave,
} from '../../../services/api';
import { formatSaudiDate, getSaudiToday, toDateInputYmd } from '../../../utils/saudiDate';
import { exportToExcel } from '../../../utils/exportUtils';
import { useTableFilter } from '../../../hooks/useTableFilter';
import { LeaveFormModal } from '../components/LeaveFormModal';
import { HRActionsCell } from '../components/HRActionsCell';
import { useToast } from '../../../context/ToastContext';
import { useApiMutation } from '../../../hooks/useApiMutation';
import { useApiListQuery, useApiQuery } from '../../../hooks/useApiQuery';
import { invalidateOnFinancialMutation } from '../../../utils/queryInvalidation';
import { employeeDisplayName } from '../../../utils/employeeDisplayName';
import { Button, Badge, Input, Modal, Spinner, KebabMenu, SmartTable } from '../../../ui';
import { throwIfApiFailed } from '../../../services/api';
import { employeeKeys, hrKeys } from '../../../services/queryKeys';
import { hrFlatSmartTableShellProps } from '../hrWorkspaceLayout';
import { HrFlatListTabShell } from '../components/HrFlatListTabShell';
import { HrTabToolbar } from '../components/HrTabToolbar';

const PAGE_SIZE = 50;

const TYPE_MAP = {
  annual: 'leaveAnnual',
  sick: 'leaveSick',
  unpaid: 'leaveUnpaid',
  other: 'leaveOther',
};

/** اليوم (سعودي) ضمن فترة إجازة معتمدة — لعرض زر العودة */
function canShowLeaveReturnRow(row: any) {
  if (row.status !== 'approved') return false;
  const today = getSaudiToday();
  const s = toDateInputYmd(row.startDate);
  const e = toDateInputYmd(row.endDate);
  return today >= s && today <= e;
}


function canShowSalarySettlement(row: any) {
  return row.status === 'approved' && row.leaveType === 'annual' && !row.salarySettlement;
}

/** بعد حفظ إجازة من الـ modal: قوائم الإجازات/التسويات/الموظفين + إبطال الطبقة المالية */
function invalidateAfterLeaveFormModalSuccess(queryClient: any, companyId: any, year: any) {
  if (!queryClient || !companyId) return;
  queryClient.invalidateQueries({ queryKey: hrKeys.leaves(companyId) });
  queryClient.invalidateQueries({ queryKey: hrKeys.leavesForYear(companyId, year) });
  queryClient.invalidateQueries({ queryKey: hrKeys.leaveSalarySettlements(companyId) });
  queryClient.invalidateQueries({ queryKey: employeeKeys.list(companyId, false) });
  queryClient.invalidateQueries({ queryKey: employeeKeys.byCompany(companyId) });
  invalidateOnFinancialMutation(queryClient);
}

type LeaveTabProps = { embedded?: boolean };

export default function LeaveTab({ embedded }: LeaveTabProps = {}) {
  const { t, lang } = useTranslation();
  const { activeCompanyId } = useApp();
  const companyId = activeCompanyId ?? '';
  const [year, setYear] = useState(new Date().getFullYear());
  const [showAdd, setShowAdd] = useState(false);
  const [editLeave, setEditLeave] = useState<any>(null);
  const [returnRow, setReturnRow] = useState<any>(null);
  const [returnDate, setReturnDate] = useState('');
  const [settlementRow, setSettlementRow] = useState<any>(null);
  const [settlementAmount, setSettlementAmount] = useState('');
  const [settlementOverrideReason, setSettlementOverrideReason] = useState('');
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useApiListQuery<any>({
    queryKey: hrKeys.leavesForYear(companyId, year),
    queryFn: () => getLeaves(companyId, undefined, year),
    fallbackMessage: 'فشل تحميل الإجازات',
    enabled: !!companyId,
  });

  const returnMutation = useApiMutation({
    mutationFn: async ({ id, actualReturnDate }: any) => {
      const res = await returnFromLeave(id, companyId, actualReturnDate);
      throwIfApiFailed(res, t('saveFailed'));
      return res;
    },
    invalidateQueries: [
      hrKeys.leavesForYear(companyId, year),
      hrKeys.leaves(companyId),
      hrKeys.leaveSalarySettlements(companyId),
      hrKeys.movementsCompany(companyId),
      employeeKeys.list(companyId, false),
      employeeKeys.byCompany(companyId),
    ],
    successToast: () => t('leaveReturnedOk'),
    errorToast: (e: any) => e?.message || t('saveFailed'),
  });

  useEffect(() => {
    if (!returnRow) return;
    const tday = getSaudiToday();
    const s = toDateInputYmd(returnRow.startDate);
    const e = toDateInputYmd(returnRow.endDate);
    const d = tday >= s && tday <= e ? tday : e;
    setReturnDate(d);
  }, [returnRow]);

  const {
    data: settlementPreview,
    isLoading: settlementPreviewLoading,
    isError: settlementPreviewError,
    error: settlementPreviewErr,
  } = useApiQuery<any>({
    queryKey: hrKeys.leaveSettlementPreview(companyId, settlementRow?.id),
    queryFn: () => getLeaveSalarySettlementPreview(settlementRow.id, companyId),
    fallbackMessage: t('saveFailed'),
    enabled: !!companyId && !!settlementRow?.id,
    retry: false,
  });

  useEffect(() => {
    if (settlementPreview?.suggestedAmount != null) {
      setSettlementAmount(String(settlementPreview.suggestedAmount));
      setSettlementOverrideReason('');
    }
  }, [settlementPreview]);

  const deleteLeaveMutation = useApiMutation({
    mutationFn: async (payload: any) => {
      const id = typeof payload === 'string' ? payload : payload.id;
      const voidSettlement = typeof payload === 'object' && payload.voidSettlement;
      const res = await deleteLeave(id, companyId, voidSettlement);
      throwIfApiFailed(res, t('saveFailed'));
      return res;
    },
    invalidateQueries: [
      ['leaves', companyId, year],
      ['leaves', companyId],
      ['leave-salary-settlements', companyId],
      ['employees', companyId, false],
      ['employees', companyId],
    ],
    onSuccess: () => invalidateOnFinancialMutation(queryClient),
    successToast: () => t('leaveDeleted'),
    errorToast: (e: any) => e?.message || t('saveFailed'),
  });

  const issueSettlementMutation = useApiMutation({
    mutationFn: async ({ id, grossAmount, manualOverrideReason }: any) => {
      const raw = String(grossAmount ?? '').replace(/,/g, '').trim();
      const n = parseFloat(raw);
      if (!Number.isFinite(n) || n < 0.01) {
        throw new Error(t('requiredFields'));
      }
      const suggested = Number(settlementPreview?.suggestedAmount ?? n);
      const isOverride = Math.abs(n - suggested) > 0.005;
      const reason = String(manualOverrideReason ?? '').trim();
      if (isOverride && !reason) {
        throw new Error(t('leaveSalarySettlementOverrideReasonRequired'));
      }
      const res = await issueLeaveSalarySettlement(id, companyId, isOverride
        ? { grossAmount: n, manualOverrideReason: reason }
        : {});
      throwIfApiFailed(res, t('saveFailed'));
      return res;
    },
    invalidateQueries: [
      ['leaves', companyId, year],
      ['leaves', companyId],
      ['leave-salary-settlements', companyId],
      ['employees', companyId, false],
      ['employees', companyId],
    ],
    onSuccess: () => invalidateOnFinancialMutation(queryClient),
    successToast: () => t('leaveSalarySettlementSaved'),
    errorToast: (e: any) => e?.message || t('saveFailed'),
  });

  const items = useMemo(() => (data ?? []).map((l: any) => ({
    ...l,
    employeeName: employeeDisplayName(l.employee || { name: l.employeeName }, lang),
  })), [data, lang]);
  const { filteredData, allFilteredData, searchText, setSearch, page, setPage, sortKey, sortDir, toggleSort } =
    useTableFilter(items, {
      searchKeys: ['employeeName', 'leaveType'],
      pageSize: PAGE_SIZE,
      defaultSortKey: 'startDate',
      defaultSortDir: 'desc',
      dateKeys: ['startDate', 'endDate'],
    });

  const columns = useMemo(() => [
    { key: 'employeeName', label: t('employeeName'), sortable: true, minWidth: 180,
      render: (v: any) => <span className="font-semibold text-[13px]">{v || '—'}</span> },
    { key: 'leaveType', label: t('leaveType'), sortable: true, width: 130, minWidth: 120,
      render: (v: any) => (
        <span className="text-[13px]">{t(TYPE_MAP[v as keyof typeof TYPE_MAP] || 'leaveOther')}</span>
      ),
    },
    { key: 'startDate', label: t('startDate'), sortable: true, width: 120, minWidth: 115,
      render: (v: any) => <span className="nx-cell-muted-sm">{formatSaudiDate(v)}</span> },
    { key: 'endDate', label: t('endDate'), sortable: true, width: 120, minWidth: 115,
      render: (v: any) => <span className="nx-cell-muted-sm">{formatSaudiDate(v)}</span> },
    { key: 'daysCount', label: t('daysCount'), numeric: true, sortable: true, width: 90, minWidth: 85,
      render: (v: any) => <span className="nx-cell-num">{v ?? '—'}</span> },
    { key: 'salarySettlement', label: t('leaveSalarySettlement'), width: 120, minWidth: 100,
      render: (_: any, row: any) => (
        row.salarySettlement ? (
          <span className="text-[11px] font-semibold text-noorix-green whitespace-nowrap">
            {t('leaveSalarySettledBadge')}
          </span>
        ) : (
          <span className="text-noorix-muted text-[12px]">—</span>
        )
      ) },
    { key: 'actions', label: t('actions'), width: '5%', align: 'center',
      render: (_: any, row: any) => (
        <HRActionsCell
          row={row}
          type="leave"
          onEdit={() => setEditLeave(row)}
          onReturnFromLeave={canShowLeaveReturnRow(row) ? () => setReturnRow(row) : undefined}
          onLeaveSalarySettlement={canShowSalarySettlement(row) ? () => setSettlementRow(row) : undefined}
          onDelete={() => {
            if (!window.confirm(t('deleteLeaveConfirm'))) return;
            if (row.salarySettlement && !window.confirm(t('deleteLeaveVoidSettlementConfirm'))) return;
            deleteLeaveMutation.mutate({ id: row.id, voidSettlement: !!row.salarySettlement });
          }}
        />
      ) },
  ], [t, deleteLeaveMutation]);

  const exportData = allFilteredData.map((r: any) => ({
    employeeName: r.employeeName || '—',
    leaveType: t(TYPE_MAP[r.leaveType as keyof typeof TYPE_MAP] || 'leaveOther'),
    startDate: formatSaudiDate(r.startDate),
    endDate: formatSaudiDate(r.endDate),
    daysCount: r.daysCount ?? '—',
    salarySettlement: r.salarySettlement ? t('leaveSalarySettledBadge') : '—',
  }));

  const renderMobileCard = useCallback((row: any) => {
    return (
      <div>
        <div className="flex items-center justify-between flex flex-wrap mb-1">
          <span className="font-bold text-[14px]">{row.employeeName}</span>
        </div>
        <div className="text-[13px] text-noorix-muted mb-2 text-end">
          {t(TYPE_MAP[row.leaveType as keyof typeof TYPE_MAP] || 'leaveOther')}
        </div>
        {row.salarySettlement && (
          <div className="text-[11px] font-semibold text-noorix-green text-end mb-1">{t('leaveSalarySettledBadge')}</div>
        )}
        <div className="nx-mc__grid nx-mc__grid--3 mb-2.5">
          <div>
            <div className="nx-mc__stat-label">{t('startDate')}</div>
            <div className="nx-mc__stat-value text-[13px]">{formatSaudiDate(row.startDate)}</div>
          </div>
          <div>
            <div className="nx-mc__stat-label">{t('endDate')}</div>
            <div className="nx-mc__stat-value text-[13px]">{formatSaudiDate(row.endDate)}</div>
          </div>
          <div>
            <div className="nx-mc__stat-label">{t('daysCount')}</div>
            <div className="nx-mc__stat-value text-[14px] font-bold">{row.daysCount ?? '—'}</div>
          </div>
        </div>
        {canShowLeaveReturnRow(row) && (
          <Button variant="primary" size="sm" className="w-full mt-2 min-h-[44px]" onClick={() => setReturnRow(row)}>
            {t('leaveReturnFromLeave')}
          </Button>
        )}
        {canShowSalarySettlement(row) && (
          <Button variant="success" size="sm" className="w-full mt-2 min-h-[44px]" onClick={() => setSettlementRow(row)}>
            {t('leaveSalarySettlement')}
          </Button>
        )}
        <Button variant="ghost" size="sm" className="w-full mt-2 min-h-[44px]" onClick={() => setEditLeave(row)}>
          {t('edit')}
        </Button>
        <Button
          variant="danger"
          size="sm"
          className="w-full mt-2 min-h-[44px]"
          onClick={() => {
            if (!window.confirm(t('deleteLeaveConfirm'))) return;
            if (row.salarySettlement && !window.confirm(t('deleteLeaveVoidSettlementConfirm'))) return;
            deleteLeaveMutation.mutate({ id: row.id, voidSettlement: !!row.salarySettlement });
          }}
        >
          {t('delete')}
        </Button>
      </div>
    );
  }, [t, deleteLeaveMutation]);

  const renderCompactRow = useCallback((row: any) => (
    <div>
      <div className="nx-cr__line1">
        <span className="nx-cr__name">{row.employeeName}</span>
        <span className="nx-cr__sub">{t(TYPE_MAP[row.leaveType as keyof typeof TYPE_MAP] || 'leaveOther')}</span>
        {row.salarySettlement && <Badge color="green" size="sm">{t('leaveSalarySettledBadge')}</Badge>}
      </div>
      <div className="nx-cr__line2">
        <div className="nx-cr__line2-start">
          <span className="nx-cr__meta ltr">{formatSaudiDate(row.startDate)} → {formatSaudiDate(row.endDate)}</span>
        </div>
        <div className="nx-cr__line2-end">
          <span className="nx-cr__amount">{row.daysCount ?? '—'} {t('daysCount')}</span>
          <div className="nx-cr__kebab" onClick={(e) => e.stopPropagation()}>
            <KebabMenu
              ariaLabel={t('actions')}
              items={[
                ...(canShowLeaveReturnRow(row) ? [{ key: 'return', label: t('leaveReturnFromLeave'), style: { color: 'var(--noorix-accent-blue)' }, onClick: () => setReturnRow(row) }] : []),
                ...(canShowSalarySettlement(row) ? [{ key: 'settle', label: t('leaveSalarySettlement'), style: { color: 'var(--noorix-accent-green)' }, onClick: () => setSettlementRow(row) }] : []),
                { key: 'edit', label: t('edit'), style: { color: 'var(--noorix-accent-green)' }, onClick: () => setEditLeave(row) },
                { key: 'delete', label: t('delete'), style: { color: 'var(--noorix-accent-red)' }, onClick: () => {
                  if (!window.confirm(t('deleteLeaveConfirm'))) return;
                  if (row.salarySettlement && !window.confirm(t('deleteLeaveVoidSettlementConfirm'))) return;
                  deleteLeaveMutation.mutate({ id: row.id, voidSettlement: !!row.salarySettlement });
                }},
              ]}
            />
          </div>
        </div>
      </div>
    </div>
  ), [t, deleteLeaveMutation, setReturnRow, setSettlementRow, setEditLeave, canShowLeaveReturnRow, canShowSalarySettlement]);

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
    <HrFlatListTabShell
      embedded={embedded}
      controls={(
        <HrTabToolbar
          leading={yearLeading}
          desktopActions={(
            <Button size="sm" className="hidden lg:inline-flex" onClick={() => exportToExcel(exportData, `leaves-${year}.xlsx`)}>
              {t('exportExcel')}
            </Button>
          )}
          menuItems={[
            {
              key: 'export',
              label: t('exportExcel'),
              onClick: () => exportToExcel(exportData, `leaves-${year}.xlsx`),
            },
          ]}
          primaryAction={{
            label: t('addLeave'),
            onClick: () => setShowAdd(true),
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
          data={filteredData}
          total={allFilteredData.length}
          page={page}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
          isLoading={isLoading}
          isError={isError}
          title={embedded ? undefined : t('hrTabLeave')}
          badge={embedded ? undefined : <span className="nx-pill nx-pill--blue nx-pill--sm">{allFilteredData.length}</span>}
          searchValue={searchText}
          onSearchChange={setSearch}
          showSearchInHeader={!embedded}
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={toggleSort}
          emptyMessage={t('noDataInPeriod')}
          renderCompactRow={renderCompactRow}
          renderMobileCard={renderMobileCard}
          stripeMobileCards
        />
      )}
    >
      {(showAdd || editLeave) && (
        <LeaveFormModal
          key={editLeave?.id ?? 'new-leave'}
          companyId={companyId}
          employeeId={editLeave?.employeeId}
          editLeave={editLeave}
          onSuccess={() => {
            invalidateAfterLeaveFormModalSuccess(queryClient, companyId, year);
            showToast(editLeave ? t('leaveUpdated') : t('leaveAdded'), 'success');
          }}
          onClose={() => {
            setShowAdd(false);
            setEditLeave(null);
          }}
        />
      )}

      <Modal
        open={!!settlementRow}
        onClose={() => {
          setSettlementRow(null);
          setSettlementAmount('');
          setSettlementOverrideReason('');
        }}
        title={t('leaveSalarySettlementTitle')}
        size="sm"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setSettlementRow(null);
                setSettlementAmount('');
                setSettlementOverrideReason('');
              }}
            >
              {t('cancel')}
            </Button>
            <Button
              variant="primary"
              disabled={
                issueSettlementMutation.isPending
                || settlementPreviewLoading
                || !settlementPreview
                || !settlementAmount
                || (
                  Math.abs(Number(settlementAmount || 0) - Number(settlementPreview?.suggestedAmount ?? (settlementAmount || 0))) > 0.005
                  && !settlementOverrideReason.trim()
                )
              }
              onClick={() => {
                if (!settlementRow) return;
                issueSettlementMutation.mutate(
                  {
                    id: settlementRow.id,
                    grossAmount: settlementAmount,
                    manualOverrideReason: settlementOverrideReason,
                  },
                  {
                    onSuccess: () => {
                      setSettlementRow(null);
                      setSettlementAmount('');
                      setSettlementOverrideReason('');
                    },
                  },
                );
              }}
            >
              {issueSettlementMutation.isPending ? t('saving') : t('save')}
            </Button>
          </>
        }
      >
        {settlementPreviewLoading && (
          <div className="flex justify-center py-6">
            <Spinner />
          </div>
        )}
        {!settlementPreviewLoading && settlementPreviewError && (
          <p className="text-[13px] text-noorix-red">
            {settlementPreviewErr?.message || t('saveFailed')}
          </p>
        )}
        {!settlementPreviewLoading && settlementPreview && (
          <>
            <p className="text-[12px] text-noorix-muted mb-2">
              {t(
                'leaveSalarySettlementCalendarHint',
                String(settlementPreview.calendarDaysPaid),
                String(settlementPreview.daysInMonth),
              )}
            </p>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              label={t('leaveSalarySettlementAmountLabel')}
              value={settlementAmount}
              onChange={(e: any) => setSettlementAmount(e.target.value)}
              className="ltr"
            />
            {Math.abs(Number(settlementAmount || 0) - Number(settlementPreview.suggestedAmount ?? (settlementAmount || 0))) > 0.005 && (
              <Input
                multiline
                rows={3}
                label={t('leaveSalarySettlementOverrideReasonLabel')}
                value={settlementOverrideReason}
                onChange={(e: any) => setSettlementOverrideReason(e.target.value)}
                placeholder={t('leaveSalarySettlementOverrideReasonPlaceholder')}
              />
            )}
          </>
        )}
      </Modal>

      <Modal
        open={!!returnRow}
        onClose={() => setReturnRow(null)}
        title={t('leaveReturnFromLeave')}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setReturnRow(null)}>{t('cancel')}</Button>
            <Button
              variant="primary"
              disabled={returnMutation.isPending || !returnDate}
              onClick={() => {
                if (!returnRow) return;
                returnMutation.mutate(
                  { id: returnRow.id, actualReturnDate: returnDate },
                  {
                    onSuccess: () => setReturnRow(null),
                  },
                );
              }}
            >
              {returnMutation.isPending ? t('saving') : t('save')}
            </Button>
          </>
        }
      >
        <p className="text-[13px] text-noorix-muted mb-3">{t('leaveReturnEarlyHint')}</p>
        {returnRow && (
          <Input
            type="date"
            label={t('leaveActualReturnDate')}
            value={returnDate}
            min={toDateInputYmd(returnRow.startDate)}
            max={toDateInputYmd(returnRow.endDate)}
            onChange={(e: any) => setReturnDate(e.target.value)}
            lang="en"
          />
        )}
      </Modal>
    </HrFlatListTabShell>
  );
}
