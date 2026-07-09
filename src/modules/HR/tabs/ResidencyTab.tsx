/**
 * ResidencyTab — ???????? ?????? ?????? (???????? ?????? ?????? …)
 */
import React, { useState, useMemo, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useApiListQuery } from '../../../hooks/useApiQuery';
import { invalidateOnFinancialMutation } from '../../../utils/queryInvalidation';
import { useApp } from '../../../context/AppContext';
import { useTranslation } from '../../../i18n/useTranslation';
import { getResidencies, deleteResidency } from '../../../services/api';
import { formatSaudiDate } from '../../../utils/saudiDate';
import { fmt } from '../../../utils/format';
import { exportToExcel } from '../../../utils/exportUtils';
import { useTableFilter } from '../../../hooks/useTableFilter';
import { ResidencyFormModal } from '../components/ResidencyFormModal';
import { IssueResidencyInvoiceModal } from '../components/IssueResidencyInvoiceModal';
import { HrServiceQuickAddBar } from '../components/HrServiceQuickAddBar';
import { HRActionsCell } from '../components/HRActionsCell';
import { useToast } from '../../../context/ToastContext';
import { useApiMutation } from '../../../hooks/useApiMutation';
import { employeeDisplayName } from '../../../utils/employeeDisplayName';
import { Button, Badge, Input, SmartTable, KebabMenu, cn } from '../../../ui';
import { buildResidencyRecordStatusMap } from '../../../constants/badgeMaps';
import { hrKeys } from '../../../services/queryKeys';
import { hrFlatSmartTableShellProps } from '../hrWorkspaceLayout';
import { HrFlatListTabShell } from '../components/HrFlatListTabShell';
import { HrTabToolbar } from '../components/HrTabToolbar';
import { countTruthyFilters } from '../utils/hrActiveFilterCount';
import {
  HR_SERVICE_CATEGORIES,
  HR_SERVICE_CATEGORY_LABEL_KEYS,
  formatHrServiceDetail,
  formatHrServiceSecondaryDate,
  requiresExpiryDate,
} from '../constants/employeeHrServiceCategories';
import type { HrEmployee } from '../../../types/api';

const PAGE_SIZE = 50;
const EXPIRY_DAYS = 90;

type ResidencyInvoiceRef = {
  id?: string | null;
  invoiceNumber?: string | null;
  totalAmount?: number | string | null;
};

type HrResidencyRow = Record<string, unknown> & {
  id?: string | null;
  employee?: HrEmployee | null;
  employeeName?: string | null;
  serviceCategory?: string | null;
  serviceLabel?: string | null;
  iqamaNumber?: string | null;
  referenceLabel?: string | null;
  serviceDetail?: string | null;
  issueDate?: string | null;
  expiryDate?: string | null;
  transactionDate?: string | null;
  invoiceId?: string | null;
  invoiceNumber?: string | null;
  invoice?: ResidencyInvoiceRef | null;
  residencyInvoiceAmount?: number | string | null;
  invoiceAmount?: number | string | null;
  status?: string | null;
};
type ResidencyDeleteTarget = {
  id?: string | null;
  invoiceId?: string | null;
};

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function isExpiringSoon(expiryDate: unknown) {
  if (!expiryDate) return false;
  if (typeof expiryDate !== 'string' && typeof expiryDate !== 'number' && !(expiryDate instanceof Date)) return false;
  const exp = new Date(expiryDate);
  const now = new Date();
  const diff = (exp.getTime() - now.getTime()) / (24 * 60 * 60 * 1000);
  return diff >= 0 && diff <= EXPIRY_DAYS;
}

function residencyStatusKey(v: unknown) {
  return v === 'expired' || v === 'renewed' ? v : 'active';
}

type ResidencyTabProps = { embedded?: boolean };

export default function ResidencyTab({ embedded }: ResidencyTabProps = {}) {
  const { t, lang } = useTranslation();
  const { activeCompanyId } = useApp();
  const companyId = activeCompanyId ?? '';
  const [showAdd, setShowAdd] = useState(false);
  const [addDefaultCategory, setAddDefaultCategory] = useState('iqama_renewal');
  const [editingResidency, setEditingResidency] = useState<HrResidencyRow | null>(null);
  const [issueInvoiceRow, setIssueInvoiceRow] = useState<HrResidencyRow | null>(null);
  const [categoryFilter, setCategoryFilter] = useState('');
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useApiListQuery<HrResidencyRow>({
    queryKey: hrKeys.residencies(companyId),
    queryFn: () => getResidencies(companyId),
    enabled: !!companyId,
    fallbackMessage: t('saveFailed'),
  });

  const deleteMutation = useApiMutation({
    mutationFn: ({ id, voidInvoice }: { id: string; voidInvoice?: boolean }) =>
      deleteResidency(id, companyId, !!voidInvoice),
    invalidateQueries: [hrKeys.residencies(companyId)],
    successToast: () => t('hrServiceDeleted'),
    errorToast: (e: unknown) => getErrorMessage(e, t('saveFailed')),
    onSuccess: () => {
      setEditingResidency(null);
      invalidateOnFinancialMutation(queryClient);
    },
  });

  const openServiceRow = useCallback((row: HrResidencyRow) => {
    setEditingResidency(row);
  }, []);

  const handleDelete = useCallback((row: ResidencyDeleteTarget) => {
    if (!row.id) {
      showToast(t('saveFailed'), 'error');
      return;
    }
    const msg = row.invoiceId
      ? t('deleteHrServiceWithInvoice')
      : t('deleteHrServiceConfirm');
    if (!window.confirm(msg)) return;
    deleteMutation.mutate({ id: row.id, voidInvoice: !!row.invoiceId });
  }, [t, deleteMutation]);

  const serviceKebabItems = useCallback((row: HrResidencyRow) => [
    {
      key: 'view',
      label: t('view'),
      onClick: () => openServiceRow(row),
    },
    {
      key: 'edit',
      label: t('edit'),
      style: { color: 'var(--noorix-accent-green)' },
      onClick: () => openServiceRow(row),
    },
    ...(row.invoiceId ? [] : [{
      key: 'issue',
      label: t('hrServiceIssueInvoice'),
      style: { color: 'var(--noorix-accent-blue)' },
      onClick: () => setIssueInvoiceRow(row),
    }]),
    {
      key: 'delete',
      label: t('delete'),
      style: { color: 'var(--noorix-accent-red)' },
      onClick: () => handleDelete(row),
    },
  ], [t, openServiceRow, handleDelete]);

  const items = useMemo<HrResidencyRow[]>(() => (data ?? []).map((r) => ({
    ...r,
    serviceCategory: r.serviceCategory || 'iqama_renewal',
    employeeName: employeeDisplayName(r.employee || { name: r.employeeName }, lang),
    serviceLabel: t(HR_SERVICE_CATEGORY_LABEL_KEYS[r.serviceCategory || 'iqama_renewal'] || 'hrServiceIqamaRenewal'),
    invoiceNumber: r.invoice?.invoiceNumber || null,
    invoiceAmount: r.residencyInvoiceAmount ?? r.invoice?.totalAmount,
  })), [data, lang, t]);

  const filteredByCategory = useMemo(() => {
    if (!categoryFilter) return items;
    return items.filter((r) => r.serviceCategory === categoryFilter);
  }, [items, categoryFilter]);

  const expiringCount = filteredByCategory.filter(
    (r) => requiresExpiryDate(String(r.serviceCategory || '')) && isExpiringSoon(r.expiryDate),
  ).length;
  const residencyStatusMap = useMemo(() => buildResidencyRecordStatusMap(t), [t]);

  const { filteredData, allFilteredData, searchText, setSearch, page, setPage, sortKey, sortDir, toggleSort } =
    useTableFilter(filteredByCategory, {
      searchKeys: ['employeeName', 'iqamaNumber', 'referenceLabel', 'serviceLabel', 'invoiceNumber'],
      pageSize: PAGE_SIZE,
      defaultSortKey: 'expiryDate',
      defaultSortDir: 'asc',
      dateKeys: ['issueDate', 'expiryDate', 'transactionDate'],
    });

  const openAdd = (category = 'iqama_renewal') => {
    setAddDefaultCategory(category);
    setShowAdd(true);
  };

  const columns = useMemo(() => [
    { key: 'employeeName', label: t('employeeName'), sortable: true, minWidth: 150,
      render: (v: unknown, row: HrResidencyRow) => (
        <Button
          type="button"
          variant="raw"
          size="auto"
          className="font-semibold text-[13px] text-start text-noorix-blue hover:underline cursor-pointer bg-transparent border-0 p-0"
          onClick={() => openServiceRow(row)}
        >
          {String(v || '—')}
        </Button>
      ) },
    { key: 'serviceLabel', label: t('hrServiceCategory'), sortable: true, width: 140, minWidth: 130,
      render: (v: unknown) => <Badge color="blue" label={String(v || '—')} size="sm" /> },
    { key: 'serviceDetail', label: t('hrServiceDetailColumn'), sortable: false, width: 140, minWidth: 120,
      render: (_v: unknown, row: HrResidencyRow) => (
        <span className="text-[12px] text-noorix-text">{formatHrServiceDetail(row, t)}</span>
      ) },
    { key: 'expiryDate', label: t('hrServiceSecondaryColumn'), sortable: true, width: 130, minWidth: 120,
      render: (_v: unknown, row: HrResidencyRow) => {
        const soon = requiresExpiryDate(String(row.serviceCategory || '')) && isExpiringSoon(row.expiryDate);
        const display = formatHrServiceSecondaryDate(row, t, formatSaudiDate);
        return (
          <span
            className={cn('text-[12px] whitespace-nowrap', soon ? 'text-noorix-amber font-bold' : 'text-noorix-muted')}
          >
            {display}
            {soon && (
              <span className="me-1.5 text-[10px] py-px px-1.5 rounded bg-noorix-amber/20">
                {t('residencyExpiringSoon')}
              </span>
            )}
          </span>
        );
      } },
    { key: 'invoiceNumber', label: t('invoiceNumber'), sortable: true, width: 120, minWidth: 110,
      render: (v: unknown, row: HrResidencyRow) => (
        v ? (
          <Button
            type="button"
            variant="raw"
            size="auto"
            className="nx-cell-num text-noorix-blue font-semibold hover:underline cursor-pointer bg-transparent border-0 p-0"
            onClick={() => openServiceRow(row)}
          >
            {String(v)}
          </Button>
        ) : (
          <span className="text-[12px] text-noorix-muted">{t('hrServiceNoInvoice')}</span>
        )
      ) },
    { key: 'invoiceAmount', label: t('amount'), width: 100, minWidth: 90, numeric: true,
      render: (v: unknown) => (
        v != null && Number(v) > 0 ? (
          <span className="nx-cell-num">{fmt(Number(v))} <span className="nx-sar">SR</span></span>
        ) : (
          <span className="text-noorix-muted">—</span>
        )
      ) },
    { key: 'status', label: t('status'), width: 100, minWidth: 90,
      render: (v: unknown) => (
        <Badge {...Badge.fromStatus(residencyStatusKey(v), residencyStatusMap)} size="sm" />
      ) },
    { key: 'actions', label: t('actions'), kind: 'actions' as const, align: 'center',
      render: (_: unknown, row: HrResidencyRow) => (
        <HRActionsCell
          row={row}
          type="residency"
          onView={() => openServiceRow(row)}
          onEdit={() => openServiceRow(row)}
          onIssueInvoice={!row.invoiceId ? () => setIssueInvoiceRow(row) : undefined}
          onDelete={() => handleDelete(row)}
        />
      ) },
  ], [t, residencyStatusMap, handleDelete, openServiceRow]);

  const exportData = allFilteredData.map((r: HrResidencyRow) => ({
    employeeName: r.employeeName || '—',
    service: r.serviceLabel,
    iqamaOrRef: r.iqamaNumber || r.referenceLabel || '—',
    expiryDate: r.expiryDate ? formatSaudiDate(r.expiryDate) : formatSaudiDate(r.transactionDate),
    invoiceNumber: r.invoiceNumber || '—',
    amount: r.invoiceAmount != null ? fmt(Number(r.invoiceAmount)) : '—',
    status: (residencyStatusMap as Record<string, { label?: string }>)[String(residencyStatusKey(r.status))]?.label || r.status,
  }));

  const renderMobileCard = useCallback((row: HrResidencyRow) => {
    const soon = isExpiringSoon(row.expiryDate);
    return (
      <div
        className="cursor-pointer"
        onClick={() => openServiceRow(row)}
        onKeyDown={(e) => { if (e.key === 'Enter') openServiceRow(row); }}
        role="button"
        tabIndex={0}
      >
        <div className="flex items-center justify-between flex-wrap mb-1 gap-2">
          <span className="font-bold text-[14px]">{row.employeeName}</span>
          <Badge color="blue" label={row.serviceLabel} size="sm" />
        </div>
        <div className="text-[12px] text-noorix-muted mb-2 nx-font-numbers text-end">
          {row.iqamaNumber || row.referenceLabel || '—'}
        </div>
        <div className="nx-mc__grid nx-mc__grid--2 mb-2.5">
          <div>
            <div className="nx-mc__stat-label">{t('expiryDate')}</div>
            <div
              className={cn('nx-mc__stat-value text-[13px]', soon && 'text-noorix-amber font-bold')}
            >
              {row.expiryDate ? formatSaudiDate(row.expiryDate) : '—'}
            </div>
          </div>
          <div>
            <div className="nx-mc__stat-label">{t('invoiceNumber')}</div>
            <div className="nx-mc__stat-value text-[13px] ltr text-noorix-blue">{row.invoiceNumber || '—'}</div>
          </div>
        </div>
        <div className="flex items-center justify-end" onClick={(e) => e.stopPropagation()}>
          <KebabMenu ariaLabel={t('actions')} items={serviceKebabItems(row)} />
        </div>
      </div>
    );
  }, [t, openServiceRow, serviceKebabItems]);

  const renderCompactRow = useCallback((row: HrResidencyRow) => {
    const soon = isExpiringSoon(row.expiryDate);
    return (
      <div
        className="cursor-pointer"
        onClick={() => openServiceRow(row)}
        onKeyDown={(e) => { if (e.key === 'Enter') openServiceRow(row); }}
        role="button"
        tabIndex={0}
      >
        <div className="nx-cr__line1">
          <span className="nx-cr__name text-noorix-blue">{row.employeeName}</span>
          <Badge color="blue" label={row.serviceLabel} size="sm" />
        </div>
        <div className="nx-cr__line2">
          <div className="nx-cr__line2-start">
            <span className="nx-cr__meta ltr">{row.iqamaNumber || row.referenceLabel || '—'}</span>
            <span className={cn('nx-cr__meta ltr', soon && 'text-noorix-amber')}>
              {row.expiryDate ? formatSaudiDate(row.expiryDate) : ''}
            </span>
          </div>
          <div className="nx-cr__line2-end flex items-center gap-2">
            <span className="text-[12px] ltr text-noorix-blue">{row.invoiceNumber || ''}</span>
            <div className="nx-cr__kebab" onClick={(e) => e.stopPropagation()}>
              <KebabMenu ariaLabel={t('actions')} items={serviceKebabItems(row)} />
            </div>
          </div>
        </div>
      </div>
    );
  }, [t, openServiceRow, serviceKebabItems]);

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: hrKeys.residencies(companyId) });
    invalidateOnFinancialMutation(queryClient);
  };

  const residencyFilters = (
    <Input
      type="select"
      label={t('hrServiceCategory')}
      value={categoryFilter}
      onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setCategoryFilter(e.target.value)}
      size="sm"
      aria-label={t('hrServiceCategory')}
    >
      <option value="">{t('hrServiceFilterAll')}</option>
      {HR_SERVICE_CATEGORIES.map((cat) => (
        <option key={cat} value={cat}>{t(HR_SERVICE_CATEGORY_LABEL_KEYS[cat])}</option>
      ))}
    </Input>
  );

  const residencyLeading = expiringCount > 0 ? (
    <span className="rounded-lg text-[12px] font-semibold px-2.5 py-1 bg-noorix-amber/15 text-noorix-amber shrink-0">
      {t('residencyExpiringSoon')}: {expiringCount}
    </span>
  ) : null;

  return (
    <HrFlatListTabShell
      embedded={embedded}
      controls={(
        <HrTabToolbar
          leading={residencyLeading}
          filters={residencyFilters}
          activeFilterCount={countTruthyFilters([!!categoryFilter])}
          onResetFilters={() => setCategoryFilter('')}
          desktopActions={(
            <Button size="sm" className="hidden lg:inline-flex" onClick={() => exportToExcel(exportData, 'hr-employee-services.xlsx')}>
              {t('exportExcel')}
            </Button>
          )}
          menuItems={[
            {
              key: 'export',
              label: t('exportExcel'),
              onClick: () => exportToExcel(exportData, 'hr-employee-services.xlsx'),
            },
          ]}
          primaryAction={{
            label: t('addHrService'),
            onClick: () => openAdd(),
          }}
        />
      )}
      beforeList={(
        <HrServiceQuickAddBar
          className="mb-3"
          onSelectCategory={(cat) => openAdd(cat)}
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
          title={embedded ? undefined : t('hrTabResidency')}
          badge={embedded ? undefined : (
            <>
              {expiringCount > 0 && <span className="nx-pill nx-pill--amber nx-pill--sm">{expiringCount}</span>}
              <span className="nx-pill nx-pill--blue nx-pill--sm">{allFilteredData.length}</span>
            </>
          )}
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
      {showAdd && (
        <ResidencyFormModal
          companyId={companyId}
          defaultCategory={addDefaultCategory}
          onSuccess={() => {
            invalidateAll();
            showToast(t('hrServiceAdded'), 'success');
          }}
          onClose={() => setShowAdd(false)}
        />
      )}

      {editingResidency && (
        <ResidencyFormModal
          residency={editingResidency}
          companyId={companyId}
          onSuccess={() => {
            invalidateAll();
            showToast(t('hrServiceUpdated'), 'success');
            setEditingResidency(null);
          }}
          onClose={() => setEditingResidency(null)}
          onDelete={handleDelete}
        />
      )}

      {issueInvoiceRow?.id && (
        <IssueResidencyInvoiceModal
          row={{ ...issueInvoiceRow, id: issueInvoiceRow.id }}
          companyId={companyId}
          onSuccess={() => {
            invalidateAll();
            showToast(t('hrServiceInvoiceIssued'), 'success');
            setIssueInvoiceRow(null);
          }}
          onClose={() => setIssueInvoiceRow(null)}
        />
      )}
    </HrFlatListTabShell>
  );
}
