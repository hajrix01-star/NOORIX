/**
 * LeaveTab — الإجازات (تصفية سنة)
 */
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
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
import { useToast } from '../../../context/ToastContext';
import { useApiMutation } from '../../../hooks/useApiMutation';
import { useApiListQuery, useApiQuery } from '../../../hooks/useApiQuery';
import { invalidateOnFinancialMutation } from '../../../utils/queryInvalidation';
import { employeeDisplayName } from '../../../utils/employeeDisplayName';
import { Button, Badge, DateField, DialogActions, Input, Modal, Spinner, SmartTable, YearDateFilter } from '../../../ui';
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

type HrLeaveRow = {
  id: string;
  employeeId?: string;
  employee?: unknown;
  employeeName?: string;
  leaveType?: keyof typeof TYPE_MAP | string;
  startDate?: string;
  endDate?: string;
  daysCount?: number | string | null;
  status?: string;
  salarySettlement?: unknown;
};

type LeaveReturnMutationPayload = {
  id: string;
  actualReturnDate: string;
};

type DeleteLeavePayload = string | {
  id: string;
  voidSettlement?: boolean;
};

type LeaveSettlementPreview = {
  suggestedAmount?: number;
  calendarDaysPaid?: number;
  daysInMonth?: number;
};

type IssueSettlementPayload = {
  id: string;
  grossAmount: string;
  manualOverrideReason?: string;
};

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

/** العودة من الإجازة تظهر داخل فترة الإجازة فقط */
function canShowLeaveReturnRow(row: HrLeaveRow) {
  if (row.status !== 'approved') return false;
  const today = getSaudiToday();
  const s = toDateInputYmd(row.startDate);
  const e = toDateInputYmd(row.endDate);
  return today >= s && today <= e;
}


function canShowSalarySettlement(row: HrLeaveRow) {
  return row.status === 'approved' && row.leaveType === 'annual' && !row.salarySettlement;
}

/** تحديث البيانات بعد نجاح نموذج الإجازة: الإجازات/التسويات/الموظفين + الأثر المالي */
function invalidateAfterLeaveFormModalSuccess(queryClient: QueryClient, companyId: string, year: number) {
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
  const [editLeave, setEditLeave] = useState<HrLeaveRow | null>(null);
  const [returnRow, setReturnRow] = useState<HrLeaveRow | null>(null);
  const [returnDate, setReturnDate] = useState('');
  const [settlementRow, setSettlementRow] = useState<HrLeaveRow | null>(null);
  const [settlementAmount, setSettlementAmount] = useState('');
  const [settlementOverrideReason, setSettlementOverrideReason] = useState('');
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useApiListQuery<HrLeaveRow>({
    queryKey: hrKeys.leavesForYear(companyId, year),
    queryFn: () => getLeaves(companyId, undefined, year),
    fallbackMessage: 'فشل تحميل الإجازات',
    enabled: !!companyId,
  });

  const returnMutation = useApiMutation({
    mutationFn: async ({ id, actualReturnDate }: LeaveReturnMutationPayload) => {
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
    errorToast: (e: unknown) => getErrorMessage(e, t('saveFailed')),
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
  } = useApiQuery<LeaveSettlementPreview>({
    queryKey: hrKeys.leaveSettlementPreview(companyId, settlementRow?.id),
    queryFn: () => {
      if (!settlementRow?.id) throw new Error('Leave id is required.');
      return getLeaveSalarySettlementPreview(settlementRow.id, companyId);
    },
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
    mutationFn: async (payload: DeleteLeavePayload) => {
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
    errorToast: (e: unknown) => getErrorMessage(e, t('saveFailed')),
  });

  const issueSettlementMutation = useApiMutation({
    mutationFn: async ({ id, grossAmount, manualOverrideReason }: IssueSettlementPayload) => {
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
    errorToast: (e: unknown) => getErrorMessage(e, t('saveFailed')),
  });

  const items = useMemo(() => (data ?? []).map((l) => ({
    ...l,
    employeeName: employeeDisplayName(l.employee || { name: l.employeeName }, lang),
  })), [data, lang]);

  const handleDeleteLeave = useCallback((row: HrLeaveRow) => {
    if (!window.confirm(t('deleteLeaveConfirm'))) return;
    if (row.salarySettlement && !window.confirm(t('deleteLeaveVoidSettlementConfirm'))) return;
    deleteLeaveMutation.mutate({ id: row.id, voidSettlement: !!row.salarySettlement });
  }, [deleteLeaveMutation, t]);

  const { filteredData, allFilteredData, searchText, setSearch, page, setPage, sortKey, sortDir, toggleSort } =
    useTableFilter(items, {
      searchKeys: ['employeeName', 'leaveType'],
      pageSize: PAGE_SIZE,
      defaultSortKey: 'startDate',
      defaultSortDir: 'desc',
      dateKeys: ['startDate', 'endDate'],
    });

  const columns = useMemo(() => [
    {
      key: 'employeeName',
      label: t('employeeName'),
      sortable: true,
      minWidth: 180,
      render: (v: unknown, row: HrLeaveRow) => (
        <Button variant="raw" size="auto" className="font-semibold text-[13px] text-noorix-blue hover:underline" onClick={() => setEditLeave(row)}>
          {String(v || '-')}
        </Button>
      ),
    },
    { key: 'leaveType', label: t('leaveType'), sortable: true, width: 130, minWidth: 120,
      render: (v: unknown) => (
        <span className="text-[13px]">{t(TYPE_MAP[v as keyof typeof TYPE_MAP] || 'leaveOther')}</span>
      ),
    },
    { key: 'startDate', label: t('startDate'), sortable: true, width: 120, minWidth: 115,
      render: (v: unknown) => <span className="nx-cell-muted-sm">{formatSaudiDate(String(v || ''))}</span> },
    { key: 'endDate', label: t('endDate'), sortable: true, width: 120, minWidth: 115,
      render: (v: unknown) => <span className="nx-cell-muted-sm">{formatSaudiDate(String(v || ''))}</span> },
    { key: 'daysCount', label: t('daysCount'), numeric: true, sortable: true, width: 90, minWidth: 85,
      render: (v: unknown) => <span className="nx-cell-num">{String(v ?? '—')}</span> },
    { key: 'salarySettlement', label: t('leaveSalarySettlement'), width: 120, minWidth: 100,
      render: (_: unknown, row: HrLeaveRow) => (
        row.salarySettlement ? (
          <span className="text-[11px] font-semibold text-noorix-green whitespace-nowrap">
            {t('leaveSalarySettledBadge')}
          </span>
        ) : (
          <span className="text-noorix-muted text-[12px]">—</span>
        )
      ) },
  ], [t]);

  const exportData = allFilteredData.map((r: HrLeaveRow & { employeeName?: string }) => ({
    employeeName: r.employeeName || '—',
    leaveType: t(TYPE_MAP[r.leaveType as keyof typeof TYPE_MAP] || 'leaveOther'),
    startDate: formatSaudiDate(r.startDate),
    endDate: formatSaudiDate(r.endDate),
    daysCount: r.daysCount ?? '—',
    salarySettlement: r.salarySettlement ? t('leaveSalarySettledBadge') : '—',
  }));

  const renderMobileCard = useCallback((row: HrLeaveRow & { employeeName?: string }) => {
    return (
      <div
        className="cursor-pointer"
        role="button"
        tabIndex={0}
        onClick={() => setEditLeave(row)}
        onKeyDown={(event) => { if (event.key === 'Enter') setEditLeave(row); }}
      >
        <div className="flex items-center justify-between flex flex-wrap mb-1">
          <span className="font-bold text-[14px]">{String(row.employeeName || '—')}</span>
        </div>
        <div className="text-[13px] text-noorix-muted mb-2 text-end">
          {t(TYPE_MAP[row.leaveType as keyof typeof TYPE_MAP] || 'leaveOther')}
        </div>
        {Boolean(row.salarySettlement) && (
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
      </div>
    );
  }, [t, setEditLeave]);

  const renderCompactRow = useCallback((row: HrLeaveRow & { employeeName?: string }) => (
    <div
      className="cursor-pointer"
      role="button"
      tabIndex={0}
      onClick={() => setEditLeave(row)}
      onKeyDown={(event) => { if (event.key === 'Enter') setEditLeave(row); }}
    >
      <div className="nx-cr__line1">
        <span className="nx-cr__name">{String(row.employeeName || '—')}</span>
        <span className="nx-cr__sub">{t(TYPE_MAP[row.leaveType as keyof typeof TYPE_MAP] || 'leaveOther')}</span>
        {Boolean(row.salarySettlement) && <Badge color="green" size="sm">{t('leaveSalarySettledBadge')}</Badge>}
      </div>
      <div className="nx-cr__line2">
        <div className="nx-cr__line2-start">
          <span className="nx-cr__meta ltr">{formatSaudiDate(row.startDate)} ? {formatSaudiDate(row.endDate)}</span>
        </div>
        <div className="nx-cr__line2-end">
          <span className="nx-cr__amount">{row.daysCount ?? '—'} {t('daysCount')}</span>
        </div>
      </div>
    </div>
  ), [t, setEditLeave]);

  const yearLeading = <YearDateFilter year={year} onYearChange={setYear} />;

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
          onReturnFromLeave={editLeave && canShowLeaveReturnRow(editLeave) ? () => setReturnRow(editLeave) : undefined}
          onSalarySettlement={editLeave && canShowSalarySettlement(editLeave) ? () => setSettlementRow(editLeave) : undefined}
          onDelete={editLeave ? () => handleDeleteLeave(editLeave) : undefined}
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
          <DialogActions
            actions={[
              {
                key: 'cancel',
                label: t('cancel'),
                role: 'cancel',
                onClick: () => {
                  setSettlementRow(null);
                  setSettlementAmount('');
                  setSettlementOverrideReason('');
                },
              },
              {
                key: 'save',
                label: issueSettlementMutation.isPending ? t('saving') : t('save'),
                role: 'save',
                disabled:
                  issueSettlementMutation.isPending
                  || settlementPreviewLoading
                  || !settlementPreview
                  || !settlementAmount
                  || (
                    Math.abs(Number(settlementAmount || 0) - Number(settlementPreview?.suggestedAmount ?? (settlementAmount || 0))) > 0.005
                    && !settlementOverrideReason.trim()
                  ),
                onClick: () => {
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
                },
              },
            ]}
          />
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
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSettlementAmount(e.target.value)}
              className="ltr"
            />
            {Math.abs(Number(settlementAmount || 0) - Number(settlementPreview.suggestedAmount ?? (settlementAmount || 0))) > 0.005 && (
              <Input
                multiline
                rows={3}
                label={t('leaveSalarySettlementOverrideReasonLabel')}
                value={settlementOverrideReason}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setSettlementOverrideReason(e.target.value)}
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
          <DialogActions
            actions={[
              { key: 'cancel', label: t('cancel'), role: 'cancel', onClick: () => setReturnRow(null) },
              {
                key: 'save',
                label: returnMutation.isPending ? t('saving') : t('save'),
                role: 'save',
                disabled: returnMutation.isPending || !returnDate,
                onClick: () => {
                  if (!returnRow) return;
                  returnMutation.mutate(
                    { id: returnRow.id, actualReturnDate: returnDate },
                    {
                      onSuccess: () => setReturnRow(null),
                    },
                  );
                },
              },
            ]}
          />
        }
      >
        <p className="text-[13px] text-noorix-muted mb-3">{t('leaveReturnEarlyHint')}</p>
        {returnRow && (
          <DateField
            label={t('leaveActualReturnDate')}
            value={returnDate}
            min={toDateInputYmd(returnRow.startDate)}
            max={toDateInputYmd(returnRow.endDate)}
            onValueChange={setReturnDate}
            lang="en"
          />
        )}
      </Modal>
    </HrFlatListTabShell>
  );
}
