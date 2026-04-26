/**
 * ResidencyTab — الإقامات (احترافي كامل)
 */
import React, { useState, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { invalidateOnFinancialMutation } from '../../../utils/queryInvalidation';
import { useApp } from '../../../context/AppContext';
import { useTranslation } from '../../../i18n/useTranslation';
import { getResidencies, deleteResidency } from '../../../services/api';
import { formatSaudiDate } from '../../../utils/saudiDate';
import { exportToExcel } from '../../../utils/exportUtils';
import { useTableFilter } from '../../../hooks/useTableFilter';
import { ResidencyFormModal } from '../components/ResidencyFormModal';
import { HRActionsCell } from '../components/HRActionsCell';
import { useToast } from '../../../context/ToastContext';
import { useApiMutation } from '../../../hooks/useApiMutation';
import { employeeDisplayName } from '../../../utils/employeeDisplayName';
import { Button, Badge, Input, ScreenShell, SmartTable } from '../../../ui';
import { buildResidencyRecordStatusMap } from '../../../constants/badgeMaps';

const PAGE_SIZE = 50;
const EXPIRY_DAYS = 90;

function isExpiringSoon(expiryDate) {
  if (!expiryDate) return false;
  const exp = new Date(expiryDate);
  const now = new Date();
  const diff = (exp.getTime() - now.getTime()) / (24 * 60 * 60 * 1000);
  return diff >= 0 && diff <= EXPIRY_DAYS;
}

function residencyStatusKey(v) {
  return v === 'expired' || v === 'renewed' ? v : 'active';
}

export default function ResidencyTab() {
  const { t, lang } = useTranslation();
  const { activeCompanyId } = useApp();
  const companyId = activeCompanyId ?? '';
  const [showAdd, setShowAdd] = useState(false);
  const [editingResidency, setEditingResidency] = useState(null);
  const { showToast } = useToast();
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

  const deleteMutation = useApiMutation({
    mutationFn: (id) => deleteResidency(id, companyId),
    invalidateQueries: [['residencies', companyId]],
    successToast: () => t('residencyDeleted'),
    errorToast: (e) => e?.message || t('saveFailed'),
    onSuccess: () => {
      setEditingResidency(null);
    },
  });

  const items = useMemo(() => (data ?? []).map((r) => ({
    ...r,
    employeeName: employeeDisplayName(r.employee || { name: r.employeeName }, lang),
  })), [data, lang]);
  const expiringCount = items.filter((r) => isExpiringSoon(r.expiryDate)).length;
  const residencyStatusMap = useMemo(() => buildResidencyRecordStatusMap(t), [t]);

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
      render: (v) => <span className="font-semibold text-[13px]">{v || '—'}</span> },
    { key: 'iqamaNumber', label: t('iqamaNumber'), sortable: true, width: 150, minWidth: 140,
      render: (v) => <span className="nx-cell-num">{v || '—'}</span> },
    { key: 'issueDate', label: t('startDate'), sortable: true, width: 120, minWidth: 115,
      render: (v) => <span className="nx-cell-muted-sm">{formatSaudiDate(v)}</span> },
    { key: 'expiryDate', label: t('expiryDate'), sortable: true, width: 140, minWidth: 130,
      render: (v, row) => {
        const soon = isExpiringSoon(v);
        return (
          <span className="text-[12px] whitespace-nowrap" style={{ color: soon ? 'var(--color-noorix-amber)' : 'var(--noorix-text-muted)', fontWeight: soon ? 700 : undefined }}>
            {formatSaudiDate(v)}
            {soon && (
              <span className="me-1.5 text-[10px] py-px px-1.5 rounded bg-noorix-amber/20">
                {t('residencyExpiringSoon')}
              </span>
            )}
          </span>
        );
      } },
    { key: 'status', label: t('status'), width: 120, minWidth: 110,
      render: (v) => (
        <Badge {...Badge.fromStatus(residencyStatusKey(v), residencyStatusMap)} size="sm" />
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
  ], [t, deleteMutation, residencyStatusMap]);

  const exportData = allFilteredData.map((r) => ({
    employeeName: r.employeeName || '—',
    iqamaNumber: r.iqamaNumber || '—',
    issueDate: formatSaudiDate(r.issueDate),
    expiryDate: formatSaudiDate(r.expiryDate),
    status: residencyStatusMap[residencyStatusKey(r.status)]?.label || r.status,
    expiringSoon: isExpiringSoon(r.expiryDate) ? t('residencyExpiringSoon') : '—',
  }));

  const renderMobileCard = useCallback((row) => {
    const soon = isExpiringSoon(row.expiryDate);
    return (
      <div>
        <div className="flex items-center justify-between flex flex-wrap mb-1">
          <span className="font-bold text-[14px]">{row.employeeName}</span>
          <Badge {...Badge.fromStatus(residencyStatusKey(row.status), residencyStatusMap)} size="sm" className="shrink-0" />
        </div>
        {row.iqamaNumber && (
          <div className="text-[12px] text-noorix-muted mb-2 nx-font-numbers text-end">{row.iqamaNumber}</div>
        )}
        <div className="nx-mc__grid nx-mc__grid--2 mb-2.5">
          <div>
            <div className="nx-mc__stat-label">{t('startDate')}</div>
            <div className="nx-mc__stat-value text-[13px]">{formatSaudiDate(row.issueDate)}</div>
          </div>
          <div>
            <div className="nx-mc__stat-label">{t('expiryDate')}</div>
            <div
              className="nx-mc__stat-value text-[13px]"
              style={{ color: soon ? 'var(--color-noorix-amber)' : undefined, fontWeight: soon ? 700 : undefined }}
            >
              {formatSaudiDate(row.expiryDate)}
              {soon && <span className="me-1 text-[10px] px-1 py-px rounded bg-noorix-amber/20">⚠</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end">
          <HRActionsCell row={row} type="residency" onEdit={() => setEditingResidency(row)} onDelete={() => { if (window.confirm(t('deleteResidencyConfirm'))) deleteMutation.mutate(row.id); }} />
        </div>
      </div>
    );
  }, [t, deleteMutation, residencyStatusMap]);

  return (
    <ScreenShell>
      <div className="mb-3 flex min-h-11 flex-col gap-3 border-b border-noorix-border pb-3 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between lg:gap-2">
        <div className="nx-toolbar min-w-0 flex-1">
          {expiringCount > 0 && (
            <span className="rounded-lg text-[13px] font-semibold px-3 py-1.5 bg-noorix-amber/15 text-noorix-amber shrink-0">
              {t('residencyExpiringSoon')}: {expiringCount}
            </span>
          )}
          <Button size="sm" onClick={() => exportToExcel(exportData, 'residencies.xlsx')}>{t('exportExcel')}</Button>
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
        showSearchInHeader={false}
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={toggleSort}
        emptyMessage={t('noDataInPeriod')}
        renderMobileCard={renderMobileCard}
        stripeMobileCards
      />

      {showAdd && (
        <ResidencyFormModal
          companyId={companyId}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['residencies', companyId] });
            invalidateOnFinancialMutation(queryClient);
            showToast(t('residencyAdded'), 'success');
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
            showToast(t('residencyUpdated'), 'success');
            setEditingResidency(null);
          }}
          onClose={() => setEditingResidency(null)}
        />
      )}
    </ScreenShell>
  );
}
