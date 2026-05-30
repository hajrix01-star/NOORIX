/**
 * ResidencyTab — الإقامات وخدمات الموظف (تأشيرات، تذاكر، تأمين، …)
 */
import React, { useState, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
import { HRActionsCell } from '../components/HRActionsCell';
import { useToast } from '../../../context/ToastContext';
import { useApiMutation } from '../../../hooks/useApiMutation';
import { employeeDisplayName } from '../../../utils/employeeDisplayName';
import { Button, Badge, Input, ScreenShell, SmartTable } from '../../../ui';
import { throwIfApiFailed } from '../../../services/api';
import { buildResidencyRecordStatusMap } from '../../../constants/badgeMaps';
import { hrKeys } from '../../../services/queryKeys';
import {
  HR_SERVICE_CATEGORIES,
  HR_SERVICE_CATEGORY_LABEL_KEYS,
} from '../constants/employeeHrServiceCategories';

const PAGE_SIZE = 50;
const EXPIRY_DAYS = 90;

function isExpiringSoon(expiryDate: any) {
  if (!expiryDate) return false;
  const exp = new Date(expiryDate);
  const now = new Date();
  const diff = (exp.getTime() - now.getTime()) / (24 * 60 * 60 * 1000);
  return diff >= 0 && diff <= EXPIRY_DAYS;
}

function residencyStatusKey(v: any) {
  return v === 'expired' || v === 'renewed' ? v : 'active';
}

export default function ResidencyTab() {
  const { t, lang } = useTranslation();
  const { activeCompanyId } = useApp();
  const companyId = activeCompanyId ?? '';
  const [showAdd, setShowAdd] = useState(false);
  const [addDefaultCategory, setAddDefaultCategory] = useState('iqama_renewal');
  const [editingResidency, setEditingResidency] = useState<any>(null);
  const [issueInvoiceRow, setIssueInvoiceRow] = useState<any>(null);
  const [categoryFilter, setCategoryFilter] = useState('');
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: hrKeys.residencies(companyId),
    queryFn: async () => {
      const res = await getResidencies(companyId);
      throwIfApiFailed(res, t('saveFailed'));
      const d = res.data;
      return Array.isArray(d) ? d : (d?.items ?? []);
    },
    enabled: !!companyId,
  });

  const deleteMutation = useApiMutation({
    mutationFn: (id: any) => deleteResidency(id, companyId),
    invalidateQueries: [hrKeys.residencies(companyId)],
    successToast: () => t('hrServiceDeleted'),
    errorToast: (e: any) => e?.message || t('saveFailed'),
    onSuccess: () => {
      setEditingResidency(null);
    },
  });

  const items = useMemo(() => (data ?? []).map((r: any) => ({
    ...r,
    serviceCategory: r.serviceCategory || 'iqama_renewal',
    employeeName: employeeDisplayName(r.employee || { name: r.employeeName }, lang),
    serviceLabel: t(HR_SERVICE_CATEGORY_LABEL_KEYS[r.serviceCategory || 'iqama_renewal'] || 'hrServiceIqamaRenewal'),
    invoiceNumber: r.invoice?.invoiceNumber || null,
    invoiceAmount: r.residencyInvoiceAmount ?? r.invoice?.totalAmount,
  })), [data, lang, t]);

  const filteredByCategory = useMemo(() => {
    if (!categoryFilter) return items;
    return items.filter((r: any) => r.serviceCategory === categoryFilter);
  }, [items, categoryFilter]);

  const expiringCount = filteredByCategory.filter((r: any) => isExpiringSoon(r.expiryDate)).length;
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

  const handleDelete = useCallback((row: any) => {
    const msg = row.invoiceId
      ? t('deleteHrServiceWithInvoice')
      : t('deleteHrServiceConfirm');
    if (window.confirm(msg)) deleteMutation.mutate(row.id);
  }, [t, deleteMutation]);

  const columns = useMemo(() => [
    { key: 'employeeName', label: t('employeeName'), sortable: true, minWidth: 150,
      render: (v: any) => <span className="font-semibold text-[13px]">{v || '—'}</span> },
    { key: 'serviceLabel', label: t('hrServiceCategory'), sortable: true, width: 140, minWidth: 130,
      render: (v: any) => <Badge color="blue" label={v} size="sm" /> },
    { key: 'iqamaNumber', label: t('iqamaNumber'), sortable: true, width: 130, minWidth: 120,
      render: (v: any, row: any) => (
        <span className="nx-cell-num">{v || row.referenceLabel || '—'}</span>
      ) },
    { key: 'expiryDate', label: t('expiryDate'), sortable: true, width: 130, minWidth: 120,
      render: (v: any, row: any) => {
        const display = v || row.transactionDate;
        const soon = isExpiringSoon(v);
        return (
          <span
            className="text-[12px] whitespace-nowrap"
            style={{ color: soon ? 'var(--color-noorix-amber)' : 'var(--noorix-text-muted)', fontWeight: soon ? 700 : undefined }}
          >
            {display ? formatSaudiDate(display) : '—'}
            {soon && (
              <span className="me-1.5 text-[10px] py-px px-1.5 rounded bg-noorix-amber/20">
                {t('residencyExpiringSoon')}
              </span>
            )}
          </span>
        );
      } },
    { key: 'invoiceNumber', label: t('invoiceNumber'), sortable: true, width: 120, minWidth: 110,
      render: (v: any, row: any) => (
        v ? (
          <span className="nx-cell-num text-noorix-blue font-semibold">{v}</span>
        ) : (
          <span className="text-[12px] text-noorix-muted">{t('hrServiceNoInvoice')}</span>
        )
      ) },
    { key: 'invoiceAmount', label: t('amount'), width: 100, minWidth: 90, numeric: true,
      render: (v: any) => (
        v != null && Number(v) > 0 ? (
          <span className="nx-cell-num">{fmt(Number(v))} <span className="nx-sar">SR</span></span>
        ) : (
          <span className="text-noorix-muted">—</span>
        )
      ) },
    { key: 'status', label: t('status'), width: 100, minWidth: 90,
      render: (v: any) => (
        <Badge {...Badge.fromStatus(residencyStatusKey(v), residencyStatusMap)} size="sm" />
      ) },
    { key: 'actions', label: t('actions'), width: '5%', align: 'center',
      render: (_: any, row: any) => (
        <HRActionsCell
          row={row}
          type="residency"
          onEdit={() => setEditingResidency(row)}
          onIssueInvoice={!row.invoiceId ? () => setIssueInvoiceRow(row) : undefined}
          onDelete={() => handleDelete(row)}
        />
      ) },
  ], [t, residencyStatusMap, handleDelete]);

  const exportData = allFilteredData.map((r: any) => ({
    employeeName: r.employeeName || '—',
    service: r.serviceLabel,
    iqamaOrRef: r.iqamaNumber || r.referenceLabel || '—',
    expiryDate: r.expiryDate ? formatSaudiDate(r.expiryDate) : formatSaudiDate(r.transactionDate),
    invoiceNumber: r.invoiceNumber || '—',
    amount: r.invoiceAmount != null ? fmt(Number(r.invoiceAmount)) : '—',
    status: (residencyStatusMap as Record<string, { label?: string }>)[String(residencyStatusKey(r.status))]?.label || r.status,
  }));

  const renderMobileCard = useCallback((row: any) => {
    const soon = isExpiringSoon(row.expiryDate);
    return (
      <div>
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
              className="nx-mc__stat-value text-[13px]"
              style={{ color: soon ? 'var(--color-noorix-amber)' : undefined, fontWeight: soon ? 700 : undefined }}
            >
              {row.expiryDate ? formatSaudiDate(row.expiryDate) : '—'}
            </div>
          </div>
          <div>
            <div className="nx-mc__stat-label">{t('invoiceNumber')}</div>
            <div className="nx-mc__stat-value text-[13px] ltr">{row.invoiceNumber || '—'}</div>
          </div>
        </div>
        <div className="flex items-center justify-end">
          <HRActionsCell
            row={row}
            type="residency"
            onEdit={() => setEditingResidency(row)}
            onIssueInvoice={!row.invoiceId ? () => setIssueInvoiceRow(row) : undefined}
            onDelete={() => handleDelete(row)}
          />
        </div>
      </div>
    );
  }, [t, handleDelete]);

  const renderCompactRow = useCallback((row: any) => {
    const soon = isExpiringSoon(row.expiryDate);
    return (
      <div>
        <div className="nx-cr__line1">
          <span className="nx-cr__name">{row.employeeName}</span>
          <Badge color="blue" label={row.serviceLabel} size="sm" />
        </div>
        <div className="nx-cr__line2">
          <div className="nx-cr__line2-start">
            <span className="nx-cr__meta ltr">{row.iqamaNumber || row.referenceLabel || '—'}</span>
            <span className="nx-cr__meta ltr" style={{ color: soon ? 'var(--color-noorix-amber)' : undefined }}>
              {row.expiryDate ? formatSaudiDate(row.expiryDate) : ''}
            </span>
          </div>
          <div className="nx-cr__line2-end text-[12px] ltr text-noorix-blue">
            {row.invoiceNumber || ''}
          </div>
        </div>
      </div>
    );
  }, []);

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: hrKeys.residencies(companyId) });
    invalidateOnFinancialMutation(queryClient);
  };

  return (
    <ScreenShell>
      <div className="mb-3 flex min-h-11 flex-col gap-3 border-b border-noorix-border pb-3 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between lg:gap-2">
        <div className="nx-toolbar min-w-0 flex-1 flex-wrap">
          {expiringCount > 0 && (
            <span className="rounded-lg text-[13px] font-semibold px-3 py-1.5 bg-noorix-amber/15 text-noorix-amber shrink-0">
              {t('residencyExpiringSoon')}: {expiringCount}
            </span>
          )}
          <Button size="sm" onClick={() => exportToExcel(exportData, 'hr-employee-services.xlsx')}>
            {t('exportExcel')}
          </Button>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto lg:flex-1 lg:max-w-2xl">
          <Input
            type="select"
            value={categoryFilter}
            onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setCategoryFilter(e.target.value)}
            size="sm"
            className="w-full sm:min-w-[160px]"
            aria-label={t('hrServiceCategory')}
          >
            <option value="">{t('hrServiceFilterAll')}</option>
            {HR_SERVICE_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>{t(HR_SERVICE_CATEGORY_LABEL_KEYS[cat])}</option>
            ))}
          </Input>
          <Input
            type="search"
            value={searchText}
            onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setSearch(e.target.value)}
            placeholder={t('searchPlaceholder')}
            size="sm"
            className="w-full min-w-0 flex-1"
            aria-label={t('searchPlaceholder')}
          />
        </div>
        <Button variant="primary" size="sm" className="shrink-0" onClick={() => openAdd()}>
          {t('addHrService')}
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
        isError={isError}
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
        renderCompactRow={renderCompactRow}
        renderMobileCard={renderMobileCard}
        stripeMobileCards
      />

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
        />
      )}

      {issueInvoiceRow && (
        <IssueResidencyInvoiceModal
          row={issueInvoiceRow}
          companyId={companyId}
          onSuccess={() => {
            invalidateAll();
            showToast(t('hrServiceInvoiceIssued'), 'success');
            setIssueInvoiceRow(null);
          }}
          onClose={() => setIssueInvoiceRow(null)}
        />
      )}
    </ScreenShell>
  );
}
