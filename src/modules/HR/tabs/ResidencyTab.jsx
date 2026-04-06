/**
 * ResidencyTab — الإقامات (احترافي كامل)
 */
import React, { useState, useMemo, useCallback } from 'react';
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
import { employeeDisplayName } from '../../../utils/employeeDisplayName';
import { Button, Badge } from '../../../ui';

const PAGE_SIZE = 50;
const EXPIRY_DAYS = 90;

function isExpiringSoon(expiryDate) {
  if (!expiryDate) return false;
  const exp = new Date(expiryDate);
  const now = new Date();
  const diff = (exp - now) / (24 * 60 * 60 * 1000);
  return diff >= 0 && diff <= EXPIRY_DAYS;
}

const statusColorMap = { expired: 'red', renewed: 'green' };

export default function ResidencyTab() {
  const { t, lang } = useTranslation();
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
      return arr;
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

  const items = useMemo(() => (data ?? []).map((r) => ({
    ...r,
    employeeName: employeeDisplayName(r.employee || { name: r.employeeName }, lang),
  })), [data, lang]);
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
      render: (v) => <span className="nx-font-600 nx-text-base">{v || '—'}</span> },
    { key: 'iqamaNumber', label: t('iqamaNumber'), sortable: true, width: 150, minWidth: 140,
      render: (v) => <span className="nx-cell-num">{v || '—'}</span> },
    { key: 'issueDate', label: t('startDate'), sortable: true, width: 120, minWidth: 115,
      render: (v) => <span className="nx-cell-muted-sm">{formatSaudiDate(v)}</span> },
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
        <Badge color={statusColorMap[v] || 'blue'} size="sm">
          {v === 'expired' ? t('statusExpired') : v === 'renewed' ? t('statusRenewed') : t('statusActive')}
        </Badge>
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
    employeeName: r.employeeName || '—',
    iqamaNumber: r.iqamaNumber || '—',
    issueDate: formatSaudiDate(r.issueDate),
    expiryDate: formatSaudiDate(r.expiryDate),
    status: r.status === 'expired' ? t('statusExpired') : r.status === 'renewed' ? t('statusRenewed') : t('statusActive'),
    expiringSoon: isExpiringSoon(r.expiryDate) ? t('residencyExpiringSoon') : '—',
  }));

  const renderMobileCard = useCallback((row) => {
    const soon = isExpiringSoon(row.expiryDate);
    const statusLabel = row.status === 'expired'
      ? t('statusExpired')
      : row.status === 'renewed'
        ? t('statusRenewed')
        : t('statusActive');
    return (
      <div>
        <div className="nx-flex nx-mb-4" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <span className="nx-font-700 nx-text-md">{row.employeeName}</span>
          <Badge color={statusColorMap[row.status] || 'blue'} size="sm" style={{ flexShrink: 0 }}>{statusLabel}</Badge>
        </div>
        {row.iqamaNumber && (
          <div className="nx-text-sm nx-text-muted nx-mb-8" style={{ fontFamily: 'var(--noorix-font-numbers)' }}>{row.iqamaNumber}</div>
        )}
        <div className="nx-grid-2 nx-gap-6 nx-rounded" style={{ background: 'var(--noorix-bg-page)', padding: '8px 10px', marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 10, color: 'var(--noorix-text-muted)', marginBottom: 2 }}>{t('startDate')}</div>
            <div className="nx-text-base" style={{ fontFamily: 'var(--noorix-font-numbers)' }}>{formatSaudiDate(row.issueDate)}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: 'var(--noorix-text-muted)', marginBottom: 2 }}>{t('expiryDate')}</div>
            <div className="nx-text-base" style={{ fontFamily: 'var(--noorix-font-numbers)', color: soon ? '#f59e0b' : undefined, fontWeight: soon ? 700 : undefined }}>
              {formatSaudiDate(row.expiryDate)}
              {soon && <span style={{ marginRight: 4, fontSize: 10, background: 'rgba(245,158,11,0.2)', padding: '1px 5px', borderRadius: 4 }}>⚠</span>}
            </div>
          </div>
        </div>
        <div className="nx-flex-end">
          <HRActionsCell row={row} type="residency" onEdit={() => setEditingResidency(row)} onDelete={() => { if (window.confirm(t('deleteResidencyConfirm'))) deleteMutation.mutate(row.id); }} />
        </div>
      </div>
    );
  }, [t, deleteMutation]);

  return (
    <div className="nx-screen">
      <Toast visible={toast.visible} message={toast.message} type={toast.type} onDismiss={() => setToast((p) => ({ ...p, visible: false }))} />

      <div className="nx-toolbar">
        {expiringCount > 0 && (
          <span className="nx-rounded nx-text-base nx-font-600" style={{ padding: '6px 12px', background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>
            {t('residencyExpiringSoon')}: {expiringCount}
          </span>
        )}
        <div className="nx-flex nx-gap-8" style={{ marginRight: 'auto' }}>
          <Button onClick={() => exportToExcel(exportData, 'residencies.xlsx')}>{t('exportExcel')}</Button>
        </div>
        <Button variant="primary" onClick={() => setShowAdd(true)}>
          {t('addResidency')}
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
        title={t('hrTabResidency')}
        badge={
          <>
            {expiringCount > 0 && <span className="nx-pill nx-pill--amber nx-pill--sm">{expiringCount}</span>}
            <span className="nx-pill nx-pill--blue nx-pill--sm">{allFilteredData.length}</span>
          </>
        }
        searchValue={searchText}
        onSearchChange={setSearch}
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={toggleSort}
        emptyMessage={t('noDataInPeriod')}
        renderMobileCard={renderMobileCard}
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
