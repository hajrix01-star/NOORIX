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

const PAGE_SIZE = 50;

const TYPE_MAP = {
  annual: 'leaveAnnual',
  sick: 'leaveSick',
  unpaid: 'leaveUnpaid',
  other: 'leaveOther',
};

const STATUS_MAP = {
  pending: { bg: 'rgba(245,158,11,0.1)', color: '#f59e0b', labelKey: 'statusPending' },
  approved: { bg: 'rgba(22,163,74,0.1)', color: '#16a34a', labelKey: 'statusApproved' },
  rejected: { bg: 'rgba(239,68,68,0.1)', color: '#ef4444', labelKey: 'statusRejected' },
};

export default function LeaveTab() {
  const { t } = useTranslation();
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
      return arr.map((l) => ({
        ...l,
        employeeName: l.employee?.name || l.employeeName || '—',
      }));
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

  const items = data ?? [];
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
      render: (v) => <span style={{ fontWeight: 600, fontSize: 13 }}>{v || '—'}</span> },
    { key: 'leaveType', label: t('leaveType'), sortable: true, width: 130, minWidth: 120,
      render: (v) => <span style={{ fontSize: 13 }}>{t(TYPE_MAP[v] || 'leaveOther')}</span> },
    { key: 'startDate', label: t('startDate'), sortable: true, width: 120, minWidth: 115,
      render: (v) => <span style={{ fontSize: 12, color: 'var(--noorix-text-muted)', whiteSpace: 'nowrap' }}>{formatSaudiDate(v)}</span> },
    { key: 'endDate', label: t('endDate'), sortable: true, width: 120, minWidth: 115,
      render: (v) => <span style={{ fontSize: 12, color: 'var(--noorix-text-muted)', whiteSpace: 'nowrap' }}>{formatSaudiDate(v)}</span> },
    { key: 'daysCount', label: t('daysCount'), numeric: true, sortable: true, width: 90, minWidth: 85,
      render: (v) => <span style={{ fontFamily: 'var(--noorix-font-numbers)', fontSize: 13 }}>{v ?? '—'}</span> },
    { key: 'status', label: t('status'), width: 120, minWidth: 110,
      render: (v) => (
        <span style={{
          padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700,
          background: statusStyles[v]?.bg || 'rgba(100,116,139,0.1)',
          color: statusStyles[v]?.color || '#64748b',
        }}>
          {statusStyles[v]?.label || v}
        </span>
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
    employeeName: r.employee?.name || r.employeeName || '—',
    leaveType: t(TYPE_MAP[r.leaveType] || 'leaveOther'),
    startDate: formatSaudiDate(r.startDate),
    endDate: formatSaudiDate(r.endDate),
    daysCount: r.daysCount ?? '—',
    status: statusStyles[r.status]?.label || r.status,
  }));

  const renderMobileCard = useCallback((row) => {
    const ss = statusStyles[row.status] || { bg: 'rgba(100,116,139,0.1)', color: '#64748b', label: row.status };
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
          <span style={{ fontWeight: 700, fontSize: 14 }}>{row.employeeName}</span>
          <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: ss.bg, color: ss.color, flexShrink: 0 }}>{ss.label}</span>
        </div>
        <div style={{ fontSize: 13, color: 'var(--noorix-text-muted)', marginBottom: 8 }}>
          {t(TYPE_MAP[row.leaveType] || 'leaveOther')}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, background: 'var(--noorix-bg-page)', borderRadius: 8, padding: '8px 10px', marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 10, color: 'var(--noorix-text-muted)', marginBottom: 2 }}>{t('startDate')}</div>
            <div style={{ fontSize: 13, fontFamily: 'var(--noorix-font-numbers)' }}>{formatSaudiDate(row.startDate)}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: 'var(--noorix-text-muted)', marginBottom: 2 }}>{t('endDate')}</div>
            <div style={{ fontSize: 13, fontFamily: 'var(--noorix-font-numbers)' }}>{formatSaudiDate(row.endDate)}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: 'var(--noorix-text-muted)', marginBottom: 2 }}>{t('daysCount')}</div>
            <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--noorix-font-numbers)' }}>{row.daysCount ?? '—'}</div>
          </div>
        </div>
        {row.status === 'pending' && (
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" className="noorix-btn-nav" style={{ fontSize: 13, padding: '6px 14px', minHeight: 36, color: '#16a34a' }} onClick={() => updateStatusMutation.mutate({ id: row.id, status: 'approved' })}>{t('statusApproved')}</button>
            <button type="button" className="noorix-btn-nav" style={{ fontSize: 13, padding: '6px 14px', minHeight: 36, color: '#ef4444' }} onClick={() => updateStatusMutation.mutate({ id: row.id, status: 'rejected' })}>{t('statusRejected')}</button>
          </div>
        )}
      </div>
    );
  }, [statusStyles, t, updateStatusMutation]);

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <Toast visible={toast.visible} message={toast.message} type={toast.type} onDismiss={() => setToast((p) => ({ ...p, visible: false }))} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <label style={{ fontSize: 13, fontWeight: 600 }}>{t('dateFilterYear')}</label>
        <select
          value={year}
          onChange={(e) => setYear(parseInt(e.target.value, 10))}
          style={{
            padding: '8px 12px', borderRadius: 8, border: '1px solid var(--noorix-border)',
            background: 'var(--noorix-bg-surface)', fontSize: 14,
          }}
        >
          {[new Date().getFullYear(), new Date().getFullYear() - 1].map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <div style={{ marginRight: 'auto', display: 'flex', gap: 8 }}>
          <button type="button" className="noorix-btn-nav" onClick={() => exportToExcel(exportData, `leaves-${year}.xlsx`)}>{t('exportExcel')}</button>
        </div>
        <button type="button" className="noorix-btn-nav noorix-btn-primary" onClick={() => setShowAdd(true)}>
          {t('addLeave')}
        </button>
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
        badge={<span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 999, background: 'rgba(37,99,235,0.08)', color: '#2563eb', fontWeight: 700 }}>{allFilteredData.length}</span>}
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
