/**
 * LeaveTab — الإجازات (احترافي كامل)
 */
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useApp } from '../../../context/AppContext';
import { useTranslation } from '../../../i18n/useTranslation';
import { getLeaves, updateLeaveStatus, returnFromLeave } from '../../../services/api';
import { formatSaudiDate } from '../../../utils/saudiDate';
import { exportToExcel } from '../../../utils/exportUtils';
import { useTableFilter } from '../../../hooks/useTableFilter';
import SmartTable from '../../../components/common/SmartTable';
import { LeaveFormModal } from '../components/LeaveFormModal';
import { HRActionsCell } from '../components/HRActionsCell';
import { useToast } from '../../../context/ToastContext';
import { useApiMutation } from '../../../hooks/useApiMutation';
import { employeeDisplayName } from '../../../utils/employeeDisplayName';
import { Button, Badge, Input, ScreenShell, Modal } from '../../../ui';
import { rejectIfApiFailed } from '../../../utils/apiResponse';
import { buildLeaveRequestStatusMap } from '../../../constants/badgeMaps';

const PAGE_SIZE = 50;

const TYPE_MAP = {
  annual: 'leaveAnnual',
  sick: 'leaveSick',
  unpaid: 'leaveUnpaid',
  other: 'leaveOther',
};

function saudiTodayYmd() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Riyadh' });
}

function sliceYmd(iso) {
  return String(iso || '').slice(0, 10);
}

/** اليوم (سعودي) ضمن فترة إجازة معتمدة — لعرض زر العودة */
function canShowLeaveReturnRow(row) {
  if (row.status !== 'approved') return false;
  const t = saudiTodayYmd();
  const s = sliceYmd(row.startDate);
  const e = sliceYmd(row.endDate);
  return t >= s && t <= e;
}

export default function LeaveTab() {
  const { t, lang } = useTranslation();
  const { activeCompanyId } = useApp();
  const companyId = activeCompanyId ?? '';
  const [year, setYear] = useState(new Date().getFullYear());
  const [showAdd, setShowAdd] = useState(false);
  const [returnRow, setReturnRow] = useState(null);
  const [returnDate, setReturnDate] = useState('');
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

  const updateStatusMutation = useApiMutation({
    mutationFn: ({ id, status, vaultId }) => updateLeaveStatus(id, companyId, status, vaultId),
    invalidateQueries: [
      ['leaves', companyId, year],
      ['leaves', companyId],
      ['leave-salary-settlements', companyId],
      ['movements', companyId],
      ['employees', companyId, false],
      ['employees', companyId],
    ],
    successToast: () => t('leaveStatusUpdated'),
    errorToast: (e) => e?.message || t('saveFailed'),
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
    const tday = saudiTodayYmd();
    const s = sliceYmd(returnRow.startDate);
    const e = sliceYmd(returnRow.endDate);
    const d = tday >= s && tday <= e ? tday : e;
    setReturnDate(d);
  }, [returnRow]);

  const items = useMemo(() => (data ?? []).map((l) => ({
    ...l,
    employeeName: employeeDisplayName(l.employee || { name: l.employeeName }, lang),
  })), [data, lang]);
  const leaveStatusMap = useMemo(() => buildLeaveRequestStatusMap(t), [t]);

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
    { key: 'status', label: t('status'), width: 140, minWidth: 130,
      render: (v, row) => (
        <div className="flex flex-wrap items-center gap-1 justify-center">
          <Badge {...Badge.fromStatus(v, leaveStatusMap)} size="sm" />
          {row.salarySettlement && (
            <span className="text-[10px] font-semibold text-noorix-green whitespace-nowrap">
              {t('leaveSalarySettledBadge')}
            </span>
          )}
        </div>
      ) },
    { key: 'actions', label: t('actions'), width: '5%', align: 'center',
      render: (_, row) => (
        <HRActionsCell
          row={row}
          type="leave"
          onApprove={row.status === 'pending' ? () => updateStatusMutation.mutate({ id: row.id, status: 'approved' }) : undefined}
          onReject={row.status === 'pending' ? () => updateStatusMutation.mutate({ id: row.id, status: 'rejected' }) : undefined}
          onReturnFromLeave={canShowLeaveReturnRow(row) ? () => setReturnRow(row) : undefined}
        />
      ) },
  ], [t, leaveStatusMap, updateStatusMutation]);

  const exportData = allFilteredData.map((r) => ({
    employeeName: r.employeeName || '—',
    leaveType: t(TYPE_MAP[r.leaveType] || 'leaveOther'),
    startDate: formatSaudiDate(r.startDate),
    endDate: formatSaudiDate(r.endDate),
    daysCount: r.daysCount ?? '—',
    status: leaveStatusMap[r.status]?.label || r.status,
  }));

  const renderMobileCard = useCallback((row) => {
    return (
      <div>
        <div className="flex items-center justify-between flex flex-wrap mb-1">
          <span className="font-bold text-[14px]">{row.employeeName}</span>
          <Badge {...Badge.fromStatus(row.status, leaveStatusMap)} size="sm" className="shrink-0" />
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
        {row.status === 'pending' && (
          <div className="flex items-center justify-end gap-2">
            <Button variant="success" size="sm" onClick={() => updateStatusMutation.mutate({ id: row.id, status: 'approved' })}>{t('statusApproved')}</Button>
            <Button variant="danger" size="sm" onClick={() => updateStatusMutation.mutate({ id: row.id, status: 'rejected' })}>{t('statusRejected')}</Button>
          </div>
        )}
        {canShowLeaveReturnRow(row) && (
          <Button variant="primary" size="sm" className="w-full mt-2 min-h-[44px]" onClick={() => setReturnRow(row)}>
            {t('leaveReturnFromLeave')}
          </Button>
        )}
      </div>
    );
  }, [leaveStatusMap, t, updateStatusMutation]);

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

      {showAdd && (
        <LeaveFormModal
          companyId={companyId}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['leaves', companyId] });
            showToast(t('leaveAdded'), 'success');
          }}
          onClose={() => setShowAdd(false)}
        />
      )}

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
