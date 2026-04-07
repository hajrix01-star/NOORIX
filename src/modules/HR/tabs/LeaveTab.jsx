/**
 * LeaveTab — الإجازات (احترافي كامل)
 */
import React, { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApp } from '../../../context/AppContext';
import { useTranslation } from '../../../i18n/useTranslation';
import { getLeaves, updateLeaveStatus } from '../../../services/api';
import { formatSaudiDate } from '../../../utils/saudiDate';
import { exportToExcel } from '../../../utils/exportUtils';
import { useTableFilter } from '../../../hooks/useTableFilter';
import SmartTable from '../../../components/common/SmartTable';
import { LeaveFormModal } from '../components/LeaveFormModal';
import { HRActionsCell } from '../components/HRActionsCell';
import Toast from '../../../components/Toast';
import { employeeDisplayName } from '../../../utils/employeeDisplayName';
import { Button, Badge, Input } from '../../../ui';

const PAGE_SIZE = 50;

const TYPE_MAP = {
  annual: 'leaveAnnual',
  sick: 'leaveSick',
  unpaid: 'leaveUnpaid',
  other: 'leaveOther',
};

const STATUS_MAP = {
  pending: { bg: 'rgba(245,158,11,0.1)', color: 'var(--color-noorix-amber)', labelKey: 'statusPending' },
  approved: { bg: 'rgba(22,163,74,0.1)', color: 'var(--noorix-accent-green)', labelKey: 'statusApproved' },
  rejected: { bg: 'rgba(239,68,68,0.1)', color: 'var(--noorix-accent-red)', labelKey: 'statusRejected' },
};

const statusColorMap = { pending: 'amber', approved: 'green', rejected: 'red' };

export default function LeaveTab() {
  const { t, lang } = useTranslation();
  const { activeCompanyId } = useApp();
  const companyId = activeCompanyId ?? '';
  const [year, setYear] = useState(new Date().getFullYear());
  const [showAdd, setShowAdd] = useState(false);
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' });
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

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }) => updateLeaveStatus(id, companyId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leaves', companyId] });
      setToast({ visible: true, message: t('leaveAdded'), type: 'success' });
    },
    onError: (e) => setToast({ visible: true, message: e?.message || t('saveFailed'), type: 'error' }),
  });

  const items = useMemo(() => (data ?? []).map((l) => ({
    ...l,
    employeeName: employeeDisplayName(l.employee || { name: l.employeeName }, lang),
  })), [data, lang]);
  const statusStyles = useMemo(() => ({
    pending: { bg: STATUS_MAP.pending.bg, color: STATUS_MAP.pending.color, label: t(STATUS_MAP.pending.labelKey) },
    approved: { bg: STATUS_MAP.approved.bg, color: STATUS_MAP.approved.color, label: t(STATUS_MAP.approved.labelKey) },
    rejected: { bg: STATUS_MAP.rejected.bg, color: STATUS_MAP.rejected.color, label: t(STATUS_MAP.rejected.labelKey) },
  }), [t]);

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
      render: (v) => <span className="nx-font-600 nx-text-base">{v || '—'}</span> },
    { key: 'leaveType', label: t('leaveType'), sortable: true, width: 130, minWidth: 120,
      render: (v) => <span className="nx-text-base">{t(TYPE_MAP[v] || 'leaveOther')}</span> },
    { key: 'startDate', label: t('startDate'), sortable: true, width: 120, minWidth: 115,
      render: (v) => <span className="nx-cell-muted-sm">{formatSaudiDate(v)}</span> },
    { key: 'endDate', label: t('endDate'), sortable: true, width: 120, minWidth: 115,
      render: (v) => <span className="nx-cell-muted-sm">{formatSaudiDate(v)}</span> },
    { key: 'daysCount', label: t('daysCount'), numeric: true, sortable: true, width: 90, minWidth: 85,
      render: (v) => <span className="nx-cell-num">{v ?? '—'}</span> },
    { key: 'status', label: t('status'), width: 120, minWidth: 110,
      render: (v) => (
        <Badge color={statusColorMap[v] || 'gray'} size="sm">
          {statusStyles[v]?.label || v}
        </Badge>
      ) },
    { key: 'actions', label: t('actions'), width: '5%', align: 'center',
      render: (_, row) => (
        <HRActionsCell
          row={row}
          type="leave"
          onApprove={row.status === 'pending' ? () => updateStatusMutation.mutate({ id: row.id, status: 'approved' }) : undefined}
          onReject={row.status === 'pending' ? () => updateStatusMutation.mutate({ id: row.id, status: 'rejected' }) : undefined}
        />
      ) },
  ], [t, statusStyles, updateStatusMutation]);

  const exportData = allFilteredData.map((r) => ({
    employeeName: r.employeeName || '—',
    leaveType: t(TYPE_MAP[r.leaveType] || 'leaveOther'),
    startDate: formatSaudiDate(r.startDate),
    endDate: formatSaudiDate(r.endDate),
    daysCount: r.daysCount ?? '—',
    status: statusStyles[r.status]?.label || r.status,
  }));

  const renderMobileCard = useCallback((row) => {
    const ss = statusStyles[row.status] || { label: row.status };
    return (
      <div>
        <div className="nx-flex-between nx-flex-wrap nx-mb-4">
          <span className="nx-font-700 nx-text-md">{row.employeeName}</span>
          <Badge color={statusColorMap[row.status] || 'gray'} size="sm" style={{ flexShrink: 0 }}>{ss.label}</Badge>
        </div>
        <div className="nx-text-base nx-text-muted nx-mb-8">
          {t(TYPE_MAP[row.leaveType] || 'leaveOther')}
        </div>
        <div className="nx-grid-3 nx-gap-6 nx-rounded nx-bg-muted nx-mb-10" style={{ padding: '8px 10px' }}>
          <div>
            <div className="nx-text-muted nx-mb-4" style={{ fontSize: 10 }}>{t('startDate')}</div>
            <div className="nx-text-base" style={{ fontFamily: 'var(--noorix-font-numbers)' }}>{formatSaudiDate(row.startDate)}</div>
          </div>
          <div>
            <div className="nx-text-muted nx-mb-4" style={{ fontSize: 10 }}>{t('endDate')}</div>
            <div className="nx-text-base" style={{ fontFamily: 'var(--noorix-font-numbers)' }}>{formatSaudiDate(row.endDate)}</div>
          </div>
          <div>
            <div className="nx-text-muted nx-mb-4" style={{ fontSize: 10 }}>{t('daysCount')}</div>
            <div className="nx-text-md nx-font-700" style={{ fontFamily: 'var(--noorix-font-numbers)' }}>{row.daysCount ?? '—'}</div>
          </div>
        </div>
        {row.status === 'pending' && (
          <div className="nx-flex-end nx-gap-8">
            <Button variant="success" size="sm" onClick={() => updateStatusMutation.mutate({ id: row.id, status: 'approved' })}>{t('statusApproved')}</Button>
            <Button variant="danger" size="sm" onClick={() => updateStatusMutation.mutate({ id: row.id, status: 'rejected' })}>{t('statusRejected')}</Button>
          </div>
        )}
      </div>
    );
  }, [statusStyles, t, updateStatusMutation]);

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-6">
      <Toast visible={toast.visible} message={toast.message} type={toast.type} onDismiss={() => setToast((p) => ({ ...p, visible: false }))} />

      <div className="nx-toolbar">
        <label className="nx-text-base nx-font-600">{t('dateFilterYear')}</label>
        <Input type="select" value={year} onChange={(e) => setYear(parseInt(e.target.value, 10))}>
          {[new Date().getFullYear(), new Date().getFullYear() - 1].map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </Input>
        <div className="nx-flex nx-gap-8 nx-flex-1">
          <Button onClick={() => exportToExcel(exportData, `leaves-${year}.xlsx`)}>{t('exportExcel')}</Button>
        </div>
        <Button variant="primary" onClick={() => setShowAdd(true)}>
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
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={toggleSort}
        emptyMessage={t('noDataInPeriod')}
        renderMobileCard={renderMobileCard}
      />

      {showAdd && (
        <LeaveFormModal
          companyId={companyId}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['leaves', companyId] });
            setToast({ visible: true, message: t('leaveAdded'), type: 'success' });
          }}
          onClose={() => setShowAdd(false)}
        />
      )}
    </div>
  );
}
