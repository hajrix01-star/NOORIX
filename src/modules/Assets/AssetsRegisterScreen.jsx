/**
 * AssetsRegisterScreen — سجل أصول تشغيلي (ضمان، مدة، تقرير/جدول) بدون إهلاك.
 */
import React, { useMemo, useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from '../../i18n/useTranslation';
import { useToast } from '../../context/ToastContext';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useSuppliers } from '../../hooks/useSuppliers';
import {
  getCompanyAssets,
  createCompanyAsset,
  updateCompanyAsset,
  deleteCompanyAsset,
} from '../../services/api';
import { assertApiOk } from '../../utils/apiResponse';
import { fmt } from '../../utils/format';
import { hasPermission, resolveUserRole, PERMISSIONS } from '../../constants/permissions';
import { getSaudiToday } from '../../utils/saudiDate';
import {
  Button,
  ScreenShell,
  ScreenTitle,
  SmartTable,
  AdaptiveSheet,
  Input,
  Badge,
  KebabMenu,
} from '../../ui';
import { SupplierSelect } from '../../components/common/SupplierSelect';

function formatDate(iso) {
  if (!iso) return '—';
  const s = String(iso).slice(0, 10);
  return s || '—';
}

export default function AssetsRegisterScreen() {
  const { activeCompanyId } = useApp();
  const { t, lang } = useTranslation();
  const { showToast } = useToast();
  const { user } = useAuth();
  const companyId = activeCompanyId ?? '';
  const queryClient = useQueryClient();

  const role = resolveUserRole(user?.role);
  const canWrite = hasPermission(role, PERMISSIONS.EXPENSES_WRITE, user?.permissions);
  const canDelete = hasPermission(role, PERMISSIONS.EXPENSES_DELETE, user?.permissions);

  const [warrantyFilter, setWarrantyFilter] = useState('all');
  const [search, setSearch] = useState('');
  const debouncedQ = useDebouncedValue(search.trim(), 300);
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const { suppliers } = useSuppliers(companyId, { pageSize: 500 });

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['company-assets', companyId, warrantyFilter, debouncedQ, page, pageSize],
    queryFn: async () => {
      const res = await getCompanyAssets(companyId, {
        warrantyFilter: warrantyFilter === 'all' ? undefined : warrantyFilter,
        q: debouncedQ || undefined,
        page,
        pageSize,
      });
      assertApiOk(res, t('loadingError'));
      return res.data;
    },
    enabled: !!companyId,
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const sumAll = data?.sumAcquisitionCostAll ?? '0';

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  const openCreate = useCallback(() => {
    setEditing(null);
    setSheetOpen(true);
  }, []);

  const openEdit = useCallback((row) => {
    setEditing(row);
    setSheetOpen(true);
  }, []);

  const handleSaved = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['company-assets'] });
    setSheetOpen(false);
    setEditing(null);
    showToast(t('savedSuccessfully') || 'تم الحفظ');
  }, [queryClient, showToast, t]);

  const handleDelete = useCallback(
    async (row) => {
      if (!canDelete) return;
      if (!confirm(t('assetDeleteConfirm'))) return;
      try {
        const res = await deleteCompanyAsset(row.id, companyId);
        assertApiOk(res, t('delete'));
        queryClient.invalidateQueries({ queryKey: ['company-assets'] });
        showToast(t('savedSuccessfully') || 'تم الحذف');
      } catch (e) {
        showToast(e?.message || t('loadingError'), 'error');
      }
    },
    [canDelete, companyId, queryClient, showToast, t],
  );

  const warrantyBadgeMap = useMemo(
    () => ({
      none: { color: 'gray', label: t('assetWarrantyNone') },
      active: { color: 'green', label: t('assetWarrantyActive') },
      expiring: { color: 'amber', label: t('assetWarrantyExpiring') },
      expired: { color: 'red', label: t('assetWarrantyExpired') },
    }),
    [t],
  );

  const columns = useMemo(
    () => [
      {
        key: 'nameAr',
        header: t('assetName'),
        render: (row) => (
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="font-semibold text-noorix-text truncate">{row.nameAr}</span>
            {row.nameEn ? <span className="text-[12px] text-noorix-muted truncate">{row.nameEn}</span> : null}
          </div>
        ),
      },
      {
        key: 'serialNumber',
        header: t('assetSerial'),
        render: (row) => <span className="text-[13px] ltr inline-block">{row.serialNumber || '—'}</span>,
      },
      {
        key: 'purchaseDate',
        header: t('assetPurchaseDate'),
        render: (row) => <span className="text-[13px] ltr">{formatDate(row.purchaseDate)}</span>,
      },
      {
        key: 'acquisitionCost',
        header: t('assetAcquisitionCost'),
        numeric: true,
        render: (row) =>
          row.acquisitionCost != null ? (
            <span className="ltr">
              {fmt(Number(row.acquisitionCost))} <span className="nx-sar">SR</span>
            </span>
          ) : (
            '—'
          ),
      },
      {
        key: 'supplier',
        header: t('assetSupplier'),
        render: (row) => (
          <span className="text-[13px] truncate max-w-[140px] inline-block">
            {row.supplier
              ? lang === 'en'
                ? row.supplier.nameEn || row.supplier.nameAr
                : row.supplier.nameAr || row.supplier.nameEn
              : '—'}
          </span>
        ),
      },
      {
        key: 'warrantyEndDate',
        header: t('assetWarrantyEnd'),
        render: (row) => <span className="text-[13px] ltr">{formatDate(row.warrantyEndDate)}</span>,
      },
      {
        key: 'warrantyStatus',
        header: t('assetWarrantyFilter'),
        render: (row) => {
          const b = warrantyBadgeMap[row.warrantyStatus] || warrantyBadgeMap.none;
          return <Badge color={b.color} size="sm">{b.label}</Badge>;
        },
      },
      {
        key: 'daysToWarrantyEnd',
        header: t('assetDaysToEnd'),
        numeric: true,
        render: (row) =>
          row.daysToWarrantyEnd != null ? (
            <span className="ltr font-medium">{row.daysToWarrantyEnd}</span>
          ) : (
            '—'
          ),
      },
      ...(canWrite || canDelete
        ? [
            {
              key: 'actions',
              header: '',
              render: (row) => (
                <KebabMenu
                  ariaLabel={t('edit')}
                  items={[
                    ...(canWrite
                      ? [{ key: 'edit', label: t('edit'), onClick: () => openEdit(row) }]
                      : []),
                    ...(canDelete
                      ? [
                          {
                            key: 'del',
                            label: t('delete'),
                            onClick: () => handleDelete(row),
                            style: { color: 'var(--noorix-accent-red)' },
                          },
                        ]
                      : []),
                  ]}
                />
              ),
            },
          ]
        : []),
    ],
    [canDelete, canWrite, handleDelete, lang, openEdit, t, warrantyBadgeMap],
  );

  const footerRow = useMemo(
    () => [
      {
        keys: ['nameAr', 'serialNumber', 'purchaseDate'],
        content: (
          <span className="text-[12px] font-semibold text-noorix-muted">{t('assetTotalValue')}</span>
        ),
      },
      {
        keys: ['acquisitionCost'],
        content: (
          <span className="text-[13px] font-bold ltr">
            {fmt(Number(sumAll || 0))} <span className="nx-sar">SR</span>
          </span>
        ),
      },
    ],
    [sumAll, t],
  );

  const renderMobileCard = useCallback(
    (row) => (
      <div className="flex flex-col gap-2 nx-mc__root">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="font-bold text-noorix-text">{row.nameAr}</div>
            {row.serialNumber ? (
              <div className="text-[12px] text-noorix-muted ltr">{row.serialNumber}</div>
            ) : null}
          </div>
          <Badge
            {...Badge.fromStatus(row.warrantyStatus, {
              none: { color: 'gray', label: t('assetWarrantyNone') },
              active: { color: 'green', label: t('assetWarrantyActive') },
              expiring: { color: 'amber', label: t('assetWarrantyExpiring') },
              expired: { color: 'red', label: t('assetWarrantyExpired') },
            })}
            size="sm"
          />
        </div>
        <div className="grid grid-cols-2 gap-2 text-[12px]">
          <div>
            <div className="text-noorix-muted">{t('assetPurchaseDate')}</div>
            <div className="ltr font-medium">{formatDate(row.purchaseDate)}</div>
          </div>
          <div>
            <div className="text-noorix-muted">{t('assetWarrantyEnd')}</div>
            <div className="ltr font-medium">{formatDate(row.warrantyEndDate)}</div>
          </div>
          <div>
            <div className="text-noorix-muted">{t('assetAcquisitionCost')}</div>
            <div className="ltr font-bold text-noorix-green">
              {row.acquisitionCost != null ? fmt(Number(row.acquisitionCost)) : '—'}{' '}
              {row.acquisitionCost != null ? <span className="nx-sar">SR</span> : null}
            </div>
          </div>
          <div>
            <div className="text-noorix-muted">{t('assetDaysToEnd')}</div>
            <div className="ltr font-medium">{row.daysToWarrantyEnd ?? '—'}</div>
          </div>
        </div>
      </div>
    ),
    [t],
  );

  if (!companyId) {
    return (
      <ScreenShell>
        <p className="text-noorix-muted text-[13px]">{t('activeCompany')}</p>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <ScreenTitle>{t('assetsRegisterTitle')}</ScreenTitle>
          <p className="text-[13px] text-noorix-muted m-0 mt-1">{t('assetsRegisterDesc')}</p>
        </div>
        {canWrite ? (
          <Button size="sm" variant="primary" onClick={openCreate}>
            {t('assetAdd')}
          </Button>
        ) : null}
      </div>

      <div className="flex flex-col sm:flex-row flex-wrap gap-2 sm:items-center">
        <Input
          type="search"
          size="sm"
          className="max-w-md"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder={t('search')}
        />
        <Input
          type="select"
          size="sm"
          className="w-full sm:w-[220px]"
          value={warrantyFilter}
          onChange={(e) => {
            setWarrantyFilter(e.target.value);
            setPage(1);
          }}
        >
          <option value="all">{t('warrantyFilterAll')}</option>
          <option value="active">{t('warrantyFilterActive')}</option>
          <option value="expiring90">{t('warrantyFilterExpiring90')}</option>
          <option value="expired">{t('warrantyFilterExpired')}</option>
          <option value="none">{t('warrantyFilterNone')}</option>
        </Input>
        <Button size="sm" variant="ghost" onClick={() => refetch()}>
          {t('refresh')}
        </Button>
      </div>

      <SmartTable
        tableId="company-assets"
        title={t('assetsRegister')}
        columns={columns}
        data={items}
        total={total}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        isLoading={isLoading}
        isError={isError}
        errorMessage={error?.message || t('loadingError')}
        footerRow={footerRow}
        showSearchInHeader={false}
        emptyMessage={t('expenseLinesEmptyState')}
        renderMobileCard={renderMobileCard}
        tableMinWidth={960}
      />

      {sheetOpen ? (
        <AssetFormSheet
          companyId={companyId}
          suppliers={suppliers}
          initial={editing}
          onClose={() => {
            setSheetOpen(false);
            setEditing(null);
          }}
          onSaved={handleSaved}
          saving={saving}
          setSaving={setSaving}
          canWrite={canWrite}
          t={t}
        />
      ) : null}
    </ScreenShell>
  );
}

function AssetFormSheet({
  companyId,
  suppliers,
  initial,
  onClose,
  onSaved,
  saving,
  setSaving,
  canWrite,
  t,
}) {
  const isEdit = Boolean(initial?.id);
  const [err, setErr] = useState('');
  const [form, setForm] = useState(() => ({
    nameAr: initial?.nameAr ?? '',
    nameEn: initial?.nameEn ?? '',
    serialNumber: initial?.serialNumber ?? '',
    location: initial?.location ?? '',
    purchaseDate: initial?.purchaseDate ? String(initial.purchaseDate).slice(0, 10) : getSaudiToday(),
    acquisitionCost: initial?.acquisitionCost != null ? String(initial.acquisitionCost) : '',
    supplierId: initial?.supplier?.id ?? '',
    warrantyDescription: initial?.warrantyDescription ?? '',
    warrantyMonths: initial?.warrantyMonths != null ? String(initial.warrantyMonths) : '',
    warrantyStartDate: initial?.warrantyStartDate ? String(initial.warrantyStartDate).slice(0, 10) : '',
    warrantyEndDate: initial?.warrantyEndDate ? String(initial.warrantyEndDate).slice(0, 10) : '',
    notes: initial?.notes ?? '',
  }));

  const submit = async (e) => {
    e.preventDefault();
    if (!canWrite) return;
    setErr('');
    const nameAr = form.nameAr?.trim();
    if (!nameAr) {
      setErr(t('assetName'));
      return;
    }
    const body = {
      companyId,
      nameAr,
      nameEn: form.nameEn?.trim() || undefined,
      serialNumber: form.serialNumber?.trim() || undefined,
      location: form.location?.trim() || undefined,
      purchaseDate: form.purchaseDate?.trim() || undefined,
      acquisitionCost:
        form.acquisitionCost !== '' && form.acquisitionCost != null
          ? Number(form.acquisitionCost)
          : undefined,
      supplierId: form.supplierId || undefined,
      warrantyDescription: form.warrantyDescription?.trim() || undefined,
      warrantyMonths:
        form.warrantyMonths !== '' && form.warrantyMonths != null
          ? parseInt(form.warrantyMonths, 10)
          : undefined,
      warrantyStartDate: form.warrantyStartDate?.trim() || undefined,
      warrantyEndDate: form.warrantyEndDate?.trim() || undefined,
      notes: form.notes?.trim() || undefined,
    };
    if (body.acquisitionCost != null && (Number.isNaN(body.acquisitionCost) || body.acquisitionCost < 0)) {
      setErr(t('validationInvalidAmount'));
      return;
    }
    if (body.warrantyMonths != null && (Number.isNaN(body.warrantyMonths) || body.warrantyMonths < 0)) {
      setErr(t('validationInvalidAmount'));
      return;
    }
    setSaving(true);
    try {
      if (isEdit) {
        const res = await updateCompanyAsset(initial.id, companyId, body);
        assertApiOk(res, t('loadingError'));
      } else {
        const res = await createCompanyAsset(body);
        assertApiOk(res, t('loadingError'));
      }
      onSaved();
    } catch (e2) {
      setErr(e2?.message || t('loadingError'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdaptiveSheet
      open
      onClose={onClose}
      title={isEdit ? t('assetEdit') : t('assetAdd')}
      size="md"
      footer={
        <>
          <Button onClick={onClose}>{t('cancel')}</Button>
          {canWrite ? (
            <Button variant="primary" type="submit" form="asset-form" disabled={saving}>
              {saving ? t('loading') : t('save')}
            </Button>
          ) : null}
        </>
      }
    >
      <form id="asset-form" onSubmit={submit} className="flex flex-col gap-3">
        {err ? (
          <div className="p-3 rounded-lg text-[13px] bg-noorix-bg-muted border border-noorix-border text-noorix-red">
            {err}
          </div>
        ) : null}
        <Input
          label={t('assetName')}
          value={form.nameAr}
          onChange={(e) => setForm((p) => ({ ...p, nameAr: e.target.value }))}
          required
        />
        <Input
          label={t('assetNameEn')}
          value={form.nameEn}
          onChange={(e) => setForm((p) => ({ ...p, nameEn: e.target.value }))}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label={t('assetSerial')}
            value={form.serialNumber}
            onChange={(e) => setForm((p) => ({ ...p, serialNumber: e.target.value }))}
            className="ltr"
          />
          <Input
            label={t('assetLocation')}
            value={form.location}
            onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))}
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            type="date"
            label={t('assetPurchaseDate')}
            value={form.purchaseDate}
            onChange={(e) => setForm((p) => ({ ...p, purchaseDate: e.target.value }))}
          />
          <Input
            type="number"
            label={t('assetAcquisitionCost')}
            value={form.acquisitionCost}
            onChange={(e) => setForm((p) => ({ ...p, acquisitionCost: e.target.value }))}
            className="ltr"
          />
        </div>
        <div>
          <label className="block text-[12px] text-noorix-muted mb-1">{t('assetSupplier')}</label>
          <SupplierSelect
            suppliers={suppliers}
            value={form.supplierId}
            onChange={(id) => setForm((p) => ({ ...p, supplierId: id }))}
            placeholder="—"
          />
        </div>
        <Input
          label={t('assetWarrantyDescription')}
          value={form.warrantyDescription}
          onChange={(e) => setForm((p) => ({ ...p, warrantyDescription: e.target.value }))}
        />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Input
            type="number"
            label={t('assetWarrantyMonths')}
            value={form.warrantyMonths}
            onChange={(e) => setForm((p) => ({ ...p, warrantyMonths: e.target.value }))}
            className="ltr"
          />
          <Input
            type="date"
            label={t('assetWarrantyStart')}
            value={form.warrantyStartDate}
            onChange={(e) => setForm((p) => ({ ...p, warrantyStartDate: e.target.value }))}
          />
          <Input
            type="date"
            label={t('assetWarrantyEnd')}
            value={form.warrantyEndDate}
            onChange={(e) => setForm((p) => ({ ...p, warrantyEndDate: e.target.value }))}
          />
        </div>
        <p className="text-[11px] text-noorix-muted m-0">{t('assetWarrantyEndHint')}</p>
        <Input
          label={t('assetNotes')}
          value={form.notes}
          onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
        />
      </form>
    </AdaptiveSheet>
  );
}
