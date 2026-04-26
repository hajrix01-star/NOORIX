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
import { formatSaudiDate, getSaudiToday } from '../../../utils/saudiDate';
import { exportToExcel } from '../../../utils/exportUtils';
import { useTableFilter } from '../../../hooks/useTableFilter';
import { LeaveFormModal } from '../components/LeaveFormModal';
import { HRActionsCell } from '../components/HRActionsCell';
import { useToast } from '../../../context/ToastContext';
import { useApiMutation } from '../../../hooks/useApiMutation';
import { employeeDisplayName } from '../../../utils/employeeDisplayName';
import { Button, Input, ScreenShell, Modal, Spinner, SmartTable } from '../../../ui';
import { rejectIfApiFailed } from '../../../utils/apiResponse';

const PAGE_SIZE = 50;

const TYPE_MAP = {
  annual: 'leaveAnnual',
  sick: 'leaveSick',
  unpaid: 'leaveUnpaid',
  other: 'leaveOther',
};

function sliceYmd(iso) {
  return String(iso || '').slice(0, 10);
}

/** اليوم (سعودي) ضمن فترة إجازة معتمدة — لعرض زر العودة */
function canShowLeaveReturnRow(row) {
  if (row.status !== 'approved') return false;
  const t = getSaudiToday();
  const s = sliceYmd(row.startDate);
  const e = sliceYmd(row.endDate);
  return t >= s && t <= e;
}


function canShowSalarySettlement(row) {
  return row.status === 'approved' && row.leaveType === 'annual' && !row.salarySettlement;
}

export default function LeaveTab() {
  const { t, lang } = useTranslation();
  const { activeCompanyId } = useApp();
  const companyId = activeCompanyId ?? '';
  const [year, setYear] = useState(new Date().getFullYear());
  const [showAdd, setShowAdd] = useState(false);
  const [editLeave, setEditLeave] = useState(null);
  const [returnRow, setReturnRow] = useState(null);
  const [returnDate, setReturnDate] = useState('');
  const [settlementRow, setSettlementRow] = useState(null);
  const [settlementAmount, setSettlementAmount] = useState('');
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['leaves', companyId, year],
    queryFn: async () => {
      const res = await getLeaves(companyId, null, year);
      if (!res?.success) return [];
      const d = res.data;
      const arr = Array.isArray(d) ? d : (d?.items ?? []);
      return arr;
    },
    enabled: !!companyId,
  });

  const returnMutation = useApiMutation({
    mutationFn: async ({ id, actualReturnDate }) => {
      const res = await returnFromLeave(id, companyId, actualReturnDate);
      rejectIfApiFailed(res, t('saveFailed'));
      return res;
    },
    invalidateQueries: [
      ['leaves', companyId, year],
      ['leaves', companyId],
      ['leave-salary-settlements', companyId],
      ['movements', companyId],
      ['employees', companyId, false],
      ['employees', companyId],
    ],
    successToast: () => t('leaveReturnedOk'),
    errorToast: (e) => e?.message || t('saveFailed'),
  });

  useEffect(() => {
    if (!returnRow) return;
    const tday = getSaudiToday();
    const s = sliceYmd(returnRow.startDate);
    const e = sliceYmd(returnRow.endDate);
    const d = tday >= s && tday <= e ? tday : e;
    setReturnDate(d);
  }, [returnRow]);

  const {
    data: settlementPreview,
    isLoading: settlementPreviewLoading,
    isError: settlementPreviewError,
    error: settlementPreviewErr,
  } = useQuery({
    queryKey: ['leave-salary-settlement-preview', companyId, settlementRow?.id],
    queryFn: async () => {
      const res = await getLeaveSalarySettlementPreview(settlementRow.id, companyId);
      rejectIfApiFailed(res, t('saveFailed'));
      return res.data;
    },
    enabled: !!companyId && !!settlementRow?.id,
    retry: false,
  });

  useEffect(() => {
    if (settlementPreview?.suggestedAmount != null) {
      setSettlementAmount(String(settlementPreview.suggestedAmount));
    }
  }, [settlementPreview]);

  const deleteLeaveMutation = useApiMutation({
    mutationFn: async (payload) => {
      const id = typeof payload === 'string' ? payload : payload.id;
      const voidSettlement = typeof payload === 'object' && payload.voidSettlement;
      const res = await deleteLeave(id, companyId, voidSettlement);
      rejectIfApiFailed(res, t('saveFailed'));
      return res;
    },
    invalidateQueries: [
      ['leaves', companyId, year],
      ['leaves', companyId],
      ['leave-salary-settlements', companyId],
      ['movements', companyId],
      ['employees', companyId, false],
      ['employees', companyId],
      { queryKey: ['invoices', companyId] },
    ],
    successToast: () => t('leaveDeleted'),
    errorToast: (e) => e?.message || t('saveFailed'),
  });

  const issueSettlementMutation = useApiMutation({
    mutationFn: async ({ id, grossAmount }) => {
      const raw = String(grossAmount ?? '').replace(/,/g, '').trim();
      const n = parseFloat(raw);
      if (!Number.isFinite(n) || n < 0.01) {
        throw new Error(t('requiredFields'));
      }
      const res = await issueLeaveSalarySettlement(id, companyId, { grossAmount: n });
      rejectIfApiFailed(res, t('saveFailed'));
      return res;
    },
    invalidateQueries: [
      ['leaves', companyId, year],
      ['leaves', companyId],
      ['leave-salary-settlements', companyId],
      ['movements', companyId],
      ['employees', companyId, false],
      ['employees', companyId],
      { queryKey: ['invoices', companyId] },
    ],
    successToast: () => t('leaveSalarySettlementSaved'),
    errorToast: (e) => e?.message || t('saveFailed'),
  });

  const items = useMemo(() => (data ?? []).map((l) => ({
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
      render: (v) => <span className="font-semibold text-[13px]">{v || '—'}</span> },
    { key: 'leaveType', label: t('leaveType'), sortable: true, width: 130, minWidth: 120,
      render: (v) => <span className="text-[13px]">{t(TYPE_MAP[v] || 'leaveOther')}</span> },
    { key: 'startDate', label: t('startDate'), sortable: true, width: 120, minWidth: 115,
      render: (v) => <span className="nx-cell-muted-sm">{formatSaudiDate(v)}</span> },
    { key: 'endDate', label: t('endDate'), sortable: true, width: 120, minWidth: 115,
      render: (v) => <span className="nx-cell-muted-sm">{formatSaudiDate(v)}</span> },
    { key: 'daysCount', label: t('daysCount'), numeric: true, sortable: true, width: 90, minWidth: 85,
      render: (v) => <span className="nx-cell-num">{v ?? '—'}</span> },
    { key: 'salarySettlement', label: t('leaveSalarySettlement'), width: 120, minWidth: 100,
      render: (_, row) => (
        row.salarySettlement ? (
          <span className="text-[11px] font-semibold text-noorix-green whitespace-nowrap">
            {t('leaveSalarySettledBadge')}
          </span>
        ) : (
          <span className="text-noorix-muted text-[12px]">—</span>
        )
      ) },
    { key: 'actions', label: t('actions'), width: '5%', align: 'center',
      render: (_, row) => (
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

  const exportData = allFilteredData.map((r) => ({
    employeeName: r.employeeName || '—',
    leaveType: t(TYPE_MAP[r.leaveType] || 'leaveOther'),
    startDate: formatSaudiDate(r.startDate),
    endDate: formatSaudiDate(r.endDate),
    daysCount: r.daysCount ?? '—',
    salarySettlement: r.salarySettlement ? t('leaveSalarySettledBadge') : '—',
  }));

  const renderMobileCard = useCallback((row) => {
    return (
      <div>
        <div className="flex items-center justify-between flex flex-wrap mb-1">
          <span className="font-bold text-[14px]">{row.employeeName}</span>
        </div>
        <div className="text-[13px] text-noorix-muted mb-2 text-end">
          {t(TYPE_MAP[row.leaveType] || 'leaveOther')}
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
          <Button size="sm" onClick={() => exportToExcel(exportData, `leaves-${year}.xlsx`)}>{t('exportExcel')}</Button>
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
        <Button variant="primary" size="sm" className="shrink-0" onClick={() => setShowAdd(true)}>
          {t('addLeave')}
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
        title={t('hrTabLeave')}
        badge={<span className="nx-pill nx-pill--blue nx-pill--sm">{allFilteredData.length}</span>}
        searchValue={searchText}
        onSearchChange={setSearch}
        showSearchInHeader={false}
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={toggleSort}
        emptyMessage={t('noDataInPeriod')}
        renderMobileCard={renderMobileCard}
        stripeMobileCards
      />

      {(showAdd || editLeave) && (
        <LeaveFormModal
          key={editLeave?.id ?? 'new-leave'}
          companyId={companyId}
          employeeId={editLeave?.employeeId}
          editLeave={editLeave}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['leaves', companyId] });
            queryClient.invalidateQueries({ queryKey: ['leaves', companyId, year] });
            queryClient.invalidateQueries({ queryKey: ['leave-salary-settlements', companyId] });
            queryClient.invalidateQueries({ queryKey: ['employees', companyId, false] });
            queryClient.invalidateQueries({ queryKey: ['employees', companyId] });
            queryClient.invalidateQueries({ queryKey: ['invoices', companyId] });
            queryClient.invalidateQueries({ queryKey: ['movements', companyId] });
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
              }
              onClick={() => {
                if (!settlementRow) return;
                issueSettlementMutation.mutate(
                  { id: settlementRow.id, grossAmount: settlementAmount },
                  {
                    onSuccess: () => {
                      setSettlementRow(null);
                      setSettlementAmount('');
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
              onChange={(e) => setSettlementAmount(e.target.value)}
              className="ltr"
            />
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
            min={sliceYmd(returnRow.startDate)}
            max={sliceYmd(returnRow.endDate)}
            onChange={(e) => setReturnDate(e.target.value)}
          />
        )}
      </Modal>
    </ScreenShell>
  );
}
