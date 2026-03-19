/**
 * ResidencyTab — الإقامات (احترافي كامل)
 */
import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { invalidateOnFinancialMutation } from '../../../utils/queryInvalidation';
import { useApp } from '../../../context/AppContext';
import { useTranslation } from '../../../i18n/useTranslation';
import { getResidencies, deleteResidency } from '../../../services/api';
import { formatSaudiDate } from '../../../utils/saudiDate';
import { exportToExcel } from '../../../utils/exportUtils';
import { useTableFilter } from '../../../hooks/useTableFilter';
import SmartTable from '../../../components/common/SmartTable';
import { ResidencyFormModal } from '../components/ResidencyFormModal';
import { HRActionsCell } from '../components/HRActionsCell';
import Toast from '../../../components/Toast';

const PAGE_SIZE = 50;
const EXPIRY_DAYS = 90;

function isExpiringSoon(expiryDate) {
  if (!expiryDate) return false;
  const exp = new Date(expiryDate);
  const now = new Date();
  const diff = (exp - now) / (24 * 60 * 60 * 1000);
  return diff >= 0 && diff <= EXPIRY_DAYS;
}

export default function ResidencyTab() {
  const { t } = useTranslation();
  const { activeCompanyId } = useApp();
  const companyId = activeCompanyId ?? '';
  const [showAdd, setShowAdd] = useState(false);
  const [editingResidency, setEditingResidency] = useState(null);
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' });
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['residencies', companyId],
    queryFn: async () => {
      const res = await getResidencies(companyId);
      if (!res?.success) return [];
      const d = res.data;
      const arr = Array.isArray(d) ? d : (d?.items ?? []);
      return arr.map((r) => ({
        ...r,
        employeeName: r.employee?.name || r.employeeName || '—',
      }));
    },
    enabled: !!companyId,
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => deleteResidency(id, companyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['residencies', companyId] });
      setToast({ visible: true, message: t('residencyDeleted'), type: 'success' });
      setEditingResidency(null);
    },
    onError: (e) => setToast({ visible: true, message: e?.message || t('saveFailed'), type: 'error' }),
  });

  const items = data ?? [];
  const expiringCount = items.filter((r) => isExpiringSoon(r.expiryDate)).length;

  const { filteredData, allFilteredData, searchText, setSearch, page, setPage, sortKey, sortDir, toggleSort } =
    useTableFilter(items, {
      searchKeys: ['employeeName', 'iqamaNumber'],
      pageSize: PAGE_SIZE,
      defaultSortKey: 'expiryDate',
      defaultSortDir: 'asc',
      dateKeys: ['issueDate', 'expiryDate'],
    });

  const columns = useMemo(() => [
    { key: 'employeeName', label: t('employeeName'), sortable: true, minWidth: 170,
      render: (v) => <span style={{ fontWeight: 600, fontSize: 13 }}>{v || '—'}</span> },
    { key: 'iqamaNumber', label: t('iqamaNumber'), sortable: true, width: 150, minWidth: 140,
      render: (v) => <span style={{ fontFamily: 'var(--noorix-font-numbers)', fontSize: 13 }}>{v || '—'}</span> },
    { key: 'issueDate', label: t('startDate'), sortable: true, width: 120, minWidth: 115,
      render: (v) => <span style={{ fontSize: 12, color: 'var(--noorix-text-muted)', whiteSpace: 'nowrap' }}>{formatSaudiDate(v)}</span> },
    { key: 'expiryDate', label: t('expiryDate'), sortable: true, width: 140, minWidth: 130,
      render: (v, row) => {
        const soon = isExpiringSoon(v);
        return (
          <span style={{ fontSize: 12, color: soon ? '#f59e0b' : 'var(--noorix-text-muted)', fontWeight: soon ? 700 : undefined, whiteSpace: 'nowrap' }}>
            {formatSaudiDate(v)}
            {soon && (
              <span style={{ marginRight: 6, fontSize: 10, background: 'rgba(245,158,11,0.2)', padding: '2px 6px', borderRadius: 4 }}>
                {t('residencyExpiringSoon')}
              </span>
            )}
          </span>
        );
      } },
    { key: 'status', label: t('status'), width: 120, minWidth: 110,
      render: (v) => (
        <span style={{
          padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700,
          background: v === 'expired' ? 'rgba(239,68,68,0.1)' : v === 'renewed' ? 'rgba(22,163,74,0.1)' : 'rgba(37,99,235,0.1)',
          color: v === 'expired' ? '#ef4444' : v === 'renewed' ? '#16a34a' : '#2563eb',
        }}>
          {v === 'expired' ? t('statusExpired') : v === 'renewed' ? t('statusRenewed') : t('statusActive')}
        </span>
      ) },
    { key: 'actions', label: t('actions'), width: '5%', align: 'center',
      render: (_, row) => (
        <HRActionsCell
          row={row}
          type="residency"
          onEdit={() => setEditingResidency(row)}
          onDelete={() => {
            if (window.confirm(t('deleteResidencyConfirm'))) deleteMutation.mutate(row.id);
          }}
        />
      ) },
  ], [t, deleteMutation]);

  const exportData = allFilteredData.map((r) => ({
    employeeName: r.employee?.name || r.employeeName || '—',
    iqamaNumber: r.iqamaNumber || '—',
    issueDate: formatSaudiDate(r.issueDate),
    expiryDate: formatSaudiDate(r.expiryDate),
    status: r.status === 'expired' ? t('statusExpired') : r.status === 'renewed' ? t('statusRenewed') : t('statusActive'),
    expiringSoon: isExpiringSoon(r.expiryDate) ? t('residencyExpiringSoon') : '—',
  }));

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <Toast visible={toast.visible} message={toast.message} type={toast.type} onDismiss={() => setToast((p) => ({ ...p, visible: false }))} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        {expiringCount > 0 && (
          <span style={{
            padding: '6px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600,
            background: 'rgba(245,158,11,0.15)', color: '#f59e0b',
          }}>
            {t('residencyExpiringSoon')}: {expiringCount}
          </span>
        )}
        <div style={{ marginRight: 'auto', display: 'flex', gap: 8 }}>
          <button type="button" className="noorix-btn-nav" onClick={() => exportToExcel(exportData, 'residencies.xlsx')}>{t('exportExcel')}</button>
        </div>
        <button type="button" className="noorix-btn-nav noorix-btn-primary" onClick={() => setShowAdd(true)}>
          {t('addResidency')}
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
        title={t('hrTabResidency')}
        badge={
          <>
            {expiringCount > 0 && <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 999, background: 'rgba(245,158,11,0.2)', color: '#f59e0b', fontWeight: 700 }}>{expiringCount}</span>}
            <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 999, background: 'rgba(37,99,235,0.08)', color: '#2563eb', fontWeight: 700 }}>{allFilteredData.length}</span>
          </>
        }
        searchValue={searchText}
        onSearchChange={setSearch}
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={toggleSort}
        emptyMessage={t('noDataInPeriod')}
      />

      {showAdd && (
        <ResidencyFormModal
          companyId={companyId}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['residencies', companyId] });
            invalidateOnFinancialMutation(queryClient);
            setToast({ visible: true, message: t('residencyAdded'), type: 'success' });
          }}
          onClose={() => setShowAdd(false)}
        />
      )}

      {editingResidency && (
        <ResidencyFormModal
          residency={editingResidency}
          companyId={companyId}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['residencies', companyId] });
            setToast({ visible: true, message: t('residencyUpdated'), type: 'success' });
            setEditingResidency(null);
          }}
          onClose={() => setEditingResidency(null)}
        />
      )}
    </div>
  );
}
