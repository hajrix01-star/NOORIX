/**
 * AssetsRegisterScreen — سجل أصول تشغيلي (ضمان، مدة، تقرير/جدول) بدون إهلاك.
 */
import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from '../../i18n/useTranslation';
import { useToast } from '../../context/ToastContext';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useTabSearchParam } from '../../hooks/useTabSearchParam';
import { useSuppliers } from '../../hooks/useSuppliers';
import {
  getCompanyAssets,
  createCompanyAsset,
  updateCompanyAsset,
  deleteCompanyAsset,
  getPendingWarrantyInvoices,
  completeCompanyAssetFromInvoice,
} from '../../services/api';
import { assertApiOk } from '../../utils/apiResponse';
import { fmt } from '../../utils/format';
import { hasPermission, resolveUserRole, PERMISSIONS } from '../../constants/permissions';
import { getSaudiToday, formatSaudiDate } from '../../utils/saudiDate';
import {
  Button,
  ScreenShell,
  ScreenTitle,
  ScreenTabs,
  SmartTable,
  AdaptiveSheet,
  Input,
  Badge,
  KebabMenu,
} from '../../ui';
import { SupplierSelect } from '../../components/common/SupplierSelect';

const ASSET_SECTION_TAB_IDS = ['register', 'queue'];

function formatDate(iso: any) {
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
  const [editing, setEditing] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [assetSectionTab, setAssetSectionTab] = useTabSearchParam(ASSET_SECTION_TAB_IDS, 'register');
  const [pendingInvoiceForComplete, setPendingInvoiceForComplete] = useState<any>(null);
  const [completeSaving, setCompleteSaving] = useState(false);

  const { data: pendingRows = [], isLoading: pendingLoading } = useQuery({
    queryKey: ['company-assets', companyId, 'pending-warranty'],
    queryFn: async () => {
      const res = await getPendingWarrantyInvoices(companyId);
      assertApiOk(res, t('loadingError'));
      return Array.isArray(res.data) ? res.data : [];
    },
    enabled: !!companyId,
  });

  const openCreate = useCallback(() => {
    setEditing(null);
    setSheetOpen(true);
  }, []);

  const openEdit = useCallback((row: any) => {
    setEditing(row);
    setSheetOpen(true);
  }, []);

  const handleSaved = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['company-assets'] });
    setSheetOpen(false);
    setEditing(null);
    showToast(t('savedSuccessfully') || 'تم الحفظ');
  }, [queryClient, showToast, t]);

  const handleWarrantyCompleteSaved = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['company-assets'] });
    setPendingInvoiceForComplete(null);
    showToast(t('savedSuccessfully') || 'تم الحفظ');
  }, [queryClient, showToast, t]);

  const handleDelete = useCallback(
    async (row: any) => {
      if (!canDelete) return;
      if (!confirm(t('assetDeleteConfirm'))) return;
      try {
        const res = await deleteCompanyAsset(row.id, companyId);
        assertApiOk(res, t('delete'));
        queryClient.invalidateQueries({ queryKey: ['company-assets'] });
        showToast(t('savedSuccessfully') || 'تم الحذف');
      } catch (e: any) {
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
        render: (_: any, row: any) => (
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="font-semibold text-noorix-text truncate">{row.nameAr}</span>
            {row.nameEn ? <span className="text-[12px] text-noorix-muted truncate">{row.nameEn}</span> : null}
          </div>
        ),
      },
      {
        key: 'serialNumber',
        header: t('assetSerial'),
        render: (_: any, row: any) => <span className="text-[13px] ltr inline-block">{row.serialNumber || '—'}</span>,
      },
      {
        key: 'purchaseDate',
        header: t('assetPurchaseDate'),
        render: (_: any, row: any) => <span className="text-[13px] ltr">{formatDate(row.purchaseDate)}</span>,
      },
      {
        key: 'acquisitionCost',
        header: t('assetAcquisitionCost'),
        numeric: true,
        render: (_: any, row: any) =>
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
        render: (_: any, row: any) => (
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
        render: (_: any, row: any) => <span className="text-[13px] ltr">{formatDate(row.warrantyEndDate)}</span>,
      },
      {
        key: 'warrantyStatus',
        header: t('assetWarrantyFilter'),
        render: (_: any, row: any) => {
          const b = (warrantyBadgeMap as Record<string, (typeof warrantyBadgeMap)['none']>)[String(row.warrantyStatus)] || warrantyBadgeMap.none;
          return <Badge color={b.color} size="sm">{b.label}</Badge>;
        },
      },
      {
        key: 'daysToWarrantyEnd',
        header: t('assetDaysToEnd'),
        numeric: true,
        render: (_: any, row: any) =>
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
              render: (_: any, row: any) => (
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
    (row: any) => (
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

  const assetTabItems = useMemo(
    () => [
      { id: 'register', label: t('assetsTabRegister') },
      {
        id: 'queue',
        label: (
          <span className="inline-flex items-center gap-2">
            {t('assetsTabWarrantyQueue')}
            {pendingRows.length > 0 ? (
              <Badge color="amber" size="sm">
                {pendingRows.length}
              </Badge>
            ) : null}
          </span>
        ),
      },
    ],
    [t, pendingRows.length],
  );

  const pendingColumns = useMemo(
    () => [
      {
        key: 'invoiceNumber',
        header: t('invoiceNumber'),
        render: (_: any, row: any) => (
          <span className="font-bold text-noorix-blue ltr nx-font-numbers">{row.invoiceNumber}</span>
        ),
      },
      {
        key: 'kind',
        header: t('type'),
        render: (_: any, row: any) => {
          const kindLabel =
            row.kind === 'purchase'
              ? t('purchaseType')
              : row.kind === 'fixed_expense'
                ? t('fixedExpenseType')
                : row.kind === 'expense'
                  ? t('expenseType')
                  : row.kind;
          return <span className="text-[12px] font-medium text-noorix-muted whitespace-nowrap">{kindLabel}</span>;
        },
      },
      {
        key: 'supplierInvoiceNumber',
        header: t('supplierInvoiceNumber'),
        render: (_: any, row: any) => (
          <span className="text-[13px] ltr nx-font-numbers">{row.supplierInvoiceNumber || '—'}</span>
        ),
      },
      {
        key: 'supplier',
        header: t('assetSupplier'),
        render: (_: any, row: any) => (
          <div className="flex flex-col gap-0.5 min-w-0 max-w-[200px]">
            <span className="text-[13px] truncate">
              {row.supplier
                ? lang === 'en'
                  ? row.supplier.nameEn || row.supplier.nameAr
                  : row.supplier.nameAr || row.supplier.nameEn
                : '—'}
            </span>
            {row.expenseLine ? (
              <span className="text-[11px] text-noorix-muted truncate" title={row.expenseLine.nameAr}>
                {lang === 'en'
                  ? row.expenseLine.nameEn || row.expenseLine.nameAr
                  : row.expenseLine.nameAr || row.expenseLine.nameEn}
              </span>
            ) : null}
          </div>
        ),
      },
      {
        key: 'transactionDate',
        header: t('transactionDate'),
        render: (_: any, row: any) => (
          <span className="text-[13px] text-noorix-muted ltr">{formatSaudiDate(row.transactionDate)}</span>
        ),
      },
      {
        key: 'totalAmount',
        header: t('total'),
        numeric: true,
        render: (_: any, row: any) => (
          <span className="ltr font-semibold">
            {fmt(Number(row.totalAmount))} <span className="nx-sar">SR</span>
          </span>
        ),
      },
      ...(canWrite
        ? [
            {
              key: 'actions',
              header: '',
              render: (_: any, row: any) => (
                <Button size="sm" variant="primary" onClick={() => setPendingInvoiceForComplete(row)}>
                  {t('warrantyQueueComplete')}
                </Button>
              ),
            },
          ]
        : []),
    ],
    [canWrite, lang, t],
  );

  const renderPendingMobileCard = useCallback(
    (row: any) => (
      <div className="flex flex-col gap-2 nx-mc__root">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="font-bold text-noorix-blue ltr nx-font-numbers">{row.invoiceNumber}</div>
            <div className="text-[12px] text-noorix-muted ltr">{row.supplierInvoiceNumber || '—'}</div>
            <div className="text-[11px] text-noorix-muted mt-0.5">
              {row.kind === 'purchase'
                ? t('purchaseType')
                : row.kind === 'fixed_expense'
                  ? t('fixedExpenseType')
                  : row.kind === 'expense'
                    ? t('expenseType')
                    : row.kind}
            </div>
          </div>
          {canWrite ? (
            <Button size="sm" variant="primary" onClick={() => setPendingInvoiceForComplete(row)}>
              {t('warrantyQueueComplete')}
            </Button>
          ) : null}
        </div>
        <div className="text-[13px] text-end break-words">
          {row.supplier
            ? lang === 'en'
              ? row.supplier.nameEn || row.supplier.nameAr
              : row.supplier.nameAr || row.supplier.nameEn
            : '—'}
          {row.expenseLine ? (
            <div className="text-[12px] text-noorix-muted mt-1">
              {lang === 'en'
                ? row.expenseLine.nameEn || row.expenseLine.nameAr
                : row.expenseLine.nameAr || row.expenseLine.nameEn}
            </div>
          ) : null}
        </div>
        <div className="grid grid-cols-2 gap-2 text-[12px]">
          <div>
            <div className="text-noorix-muted">{t('transactionDate')}</div>
            <div className="ltr font-medium">{formatSaudiDate(row.transactionDate)}</div>
          </div>
          <div>
            <div className="text-noorix-muted">{t('total')}</div>
            <div className="ltr font-bold text-noorix-green">
              {fmt(Number(row.totalAmount))} <span className="nx-sar">SR</span>
            </div>
          </div>
        </div>
      </div>
    ),
    [canWrite, lang, t],
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

      <ScreenTabs
        items={assetTabItems}
        value={assetSectionTab}
        onChange={setAssetSectionTab}
        contentClassName="flex flex-col gap-4"
      >
        {assetSectionTab === 'register' && (
          <>
            <div className="flex flex-col sm:flex-row flex-wrap gap-2 sm:items-center">
              <Input
                type="search"
                size="sm"
                className="max-w-md"
                value={search}
                onChange={(e: any) => {
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
                onChange={(e: any) => {
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
          </>
        )}

        {assetSectionTab === 'queue' && (
          <SmartTable
            tableId="company-assets-pending-warranty"
            title={t('assetsTabWarrantyQueue')}
            columns={pendingColumns}
            data={pendingRows}
            total={pendingRows.length}
            page={1}
            pageSize={Math.max(pendingRows.length, 1)}
            onPageChange={() => {}}
            isLoading={pendingLoading}
            isError={false}
            errorMessage=""
            showSearchInHeader={false}
            emptyMessage={t('warrantyQueueEmpty')}
            renderMobileCard={renderPendingMobileCard}
            tableMinWidth={980}
          />
        )}
      </ScreenTabs>

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

      {pendingInvoiceForComplete ? (
        <WarrantyCompleteFromInvoiceSheet
          companyId={companyId}
          invoice={pendingInvoiceForComplete}
          onClose={() => setPendingInvoiceForComplete(null)}
          onSaved={handleWarrantyCompleteSaved}
          saving={completeSaving}
          setSaving={setCompleteSaving}
          canWrite={canWrite}
          t={t}
          lang={lang}
        />
      ) : null}
    </ScreenShell>
  );
}

function WarrantyCompleteFromInvoiceSheet({
  companyId,
  invoice,
  onClose,
  onSaved,
  saving,
  setSaving,
  canWrite,
  t,
  lang,
}: any) {
  const [err, setErr] = useState('');
  const [form, setForm] = useState({
    nameAr: '',
    nameEn: '',
    serialNumber: '',
    location: '',
    purchaseDate: getSaudiToday(),
    acquisitionCost: '',
    warrantyDescription: '',
    warrantyMonths: '',
    warrantyStartDate: '',
    warrantyEndDate: '',
    notes: '',
  });
  const [lines, setLines] = useState([
    { key: '0', nameAr: '', nameEn: '', quantity: '', notes: '' },
  ]);

  useEffect(() => {
    if (!invoice?.id) return;
    const tx = String(invoice.transactionDate || '').slice(0, 10);
    const supName = invoice.supplier
      ? lang === 'en'
        ? invoice.supplier.nameEn || invoice.supplier.nameAr
        : invoice.supplier.nameAr || invoice.supplier.nameEn
      : '';
    const ref = invoice.supplierInvoiceNumber || invoice.invoiceNumber || '';
    setForm({
      nameAr: supName && ref ? `${supName} — ${ref}` : supName || ref || '',
      nameEn: '',
      serialNumber: '',
      location: '',
      purchaseDate: tx || getSaudiToday(),
      acquisitionCost: invoice.totalAmount != null ? String(invoice.totalAmount) : '',
      warrantyDescription: '',
      warrantyMonths: '',
      warrantyStartDate: '',
      warrantyEndDate: '',
      notes: invoice.notes?.trim() || '',
    });
    setLines([{ key: `${invoice.id}-0`, nameAr: '', nameEn: '', quantity: '', notes: '' }]);
    setErr('');
  }, [invoice, lang]);

  const supplierLabel = useMemo(() => {
    if (!invoice?.supplier) return '—';
    return lang === 'en'
      ? invoice.supplier.nameEn || invoice.supplier.nameAr
      : invoice.supplier.nameAr || invoice.supplier.nameEn;
  }, [invoice, lang]);

  const submit = async (e: any) => {
    e.preventDefault();
    if (!canWrite) return;
    setErr('');
    const nameAr = form.nameAr?.trim();
    if (!nameAr) {
      setErr(t('assetName'));
      return;
    }
    const warrantyLines = lines
      .filter((l: any) => l.nameAr?.trim())
      .map((l: any) => ({
        nameAr: l.nameAr.trim(),
        nameEn: l.nameEn?.trim() || undefined,
        quantity:
          l.quantity !== '' && l.quantity != null && !Number.isNaN(Number(l.quantity))
            ? Number(l.quantity)
            : undefined,
        notes: l.notes?.trim() || undefined,
      }));
    const body = {
      companyId,
      invoiceId: invoice.id,
      nameAr,
      nameEn: form.nameEn?.trim() || undefined,
      serialNumber: form.serialNumber?.trim() || undefined,
      location: form.location?.trim() || undefined,
      purchaseDate: form.purchaseDate?.trim() || undefined,
      acquisitionCost:
        form.acquisitionCost !== '' && form.acquisitionCost != null
          ? Number(form.acquisitionCost)
          : undefined,
      warrantyDescription: form.warrantyDescription?.trim() || undefined,
      warrantyMonths:
        form.warrantyMonths !== '' && form.warrantyMonths != null
          ? parseInt(form.warrantyMonths, 10)
          : undefined,
      warrantyStartDate: form.warrantyStartDate?.trim() || undefined,
      warrantyEndDate: form.warrantyEndDate?.trim() || undefined,
      notes: form.notes?.trim() || undefined,
      warrantyLines: warrantyLines.length ? warrantyLines : undefined,
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
      const res = await completeCompanyAssetFromInvoice(body);
      assertApiOk(res, t('loadingError'));
      onSaved();
    } catch (e2: any) {
      setErr(e2?.message || t('loadingError'));
    } finally {
      setSaving(false);
    }
  };

  const addLine = () =>
    setLines((p: any) => [
      ...p,
      { key: `${Date.now()}-${p.length}`, nameAr: '', nameEn: '', quantity: '', notes: '' },
    ]);
  const removeLine = (i: any) => setLines((p: any) => (p.length <= 1 ? p : p.filter((_: any, idx: any) => idx !== i)));

  return (
    <AdaptiveSheet
      open
      onClose={onClose}
      title={t('warrantyCompleteSheetTitle')}
      size="lg"
      footer={
        <>
          <Button onClick={onClose}>{t('cancel')}</Button>
          {canWrite ? (
            <Button variant="primary" type="submit" form="warranty-complete-form" disabled={saving}>
              {saving ? t('loading') : t('save')}
            </Button>
          ) : null}
        </>
      }
    >
      <form id="warranty-complete-form" onSubmit={submit} className="flex flex-col gap-3">
        <div className="rounded-lg border border-noorix-border bg-noorix-bg-muted px-3 py-2 text-[12px] text-noorix-muted">
          <div className="flex flex-wrap gap-x-4 gap-y-1 justify-between">
            <span>
              {t('warrantyInvoiceRef')}:{' '}
              <span className="font-bold text-noorix-text ltr nx-font-numbers">{invoice.invoiceNumber}</span>
            </span>
            <span className="ltr">{formatSaudiDate(invoice.transactionDate)}</span>
          </div>
          <div className="mt-1 text-[13px] text-noorix-text">{supplierLabel}</div>
        </div>
        {err ? (
          <div className="p-3 rounded-lg text-[13px] bg-noorix-bg-muted border border-noorix-border text-noorix-red">
            {err}
          </div>
        ) : null}
        <Input
          label={t('assetName')}
          value={form.nameAr}
          onChange={(e: any) => setForm((p: any) => ({ ...p, nameAr: e.target.value }))}
          required
        />
        <Input
          label={t('assetNameEn')}
          value={form.nameEn}
          onChange={(e: any) => setForm((p: any) => ({ ...p, nameEn: e.target.value }))}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label={t('assetSerial')}
            value={form.serialNumber}
            onChange={(e: any) => setForm((p: any) => ({ ...p, serialNumber: e.target.value }))}
            className="ltr"
          />
          <Input
            label={t('assetLocation')}
            value={form.location}
            onChange={(e: any) => setForm((p: any) => ({ ...p, location: e.target.value }))}
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            type="date"
            label={t('assetPurchaseDate')}
            value={form.purchaseDate}
            onChange={(e: any) => setForm((p: any) => ({ ...p, purchaseDate: e.target.value }))}
          />
          <Input
            type="number"
            label={t('assetAcquisitionCost')}
            value={form.acquisitionCost}
            onChange={(e: any) => setForm((p: any) => ({ ...p, acquisitionCost: e.target.value }))}
            className="ltr"
          />
        </div>
        <Input
          label={t('assetWarrantyDescription')}
          value={form.warrantyDescription}
          onChange={(e: any) => setForm((p: any) => ({ ...p, warrantyDescription: e.target.value }))}
        />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Input
            type="number"
            label={t('assetWarrantyMonths')}
            value={form.warrantyMonths}
            onChange={(e: any) => setForm((p: any) => ({ ...p, warrantyMonths: e.target.value }))}
            className="ltr"
          />
          <Input
            type="date"
            label={t('assetWarrantyStart')}
            value={form.warrantyStartDate}
            onChange={(e: any) => setForm((p: any) => ({ ...p, warrantyStartDate: e.target.value }))}
          />
          <Input
            type="date"
            label={t('assetWarrantyEnd')}
            value={form.warrantyEndDate}
            onChange={(e: any) => setForm((p: any) => ({ ...p, warrantyEndDate: e.target.value }))}
          />
        </div>
        <p className="text-[11px] text-noorix-muted m-0">{t('assetWarrantyEndHint')}</p>
        <Input
          label={t('assetNotes')}
          value={form.notes}
          onChange={(e: any) => setForm((p: any) => ({ ...p, notes: e.target.value }))}
        />

        <div className="border-t border-noorix-border pt-3 mt-1">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <span className="text-[13px] font-semibold text-noorix-text">{t('warrantyLinesOptionalTitle')}</span>
            <Button type="button" size="sm" variant="ghost" onClick={addLine}>
              + {t('warrantyAddLine')}
            </Button>
          </div>
          <div className="flex flex-col gap-3">
            {lines.map((line: any, idx: any) => (
              <div
                key={line.key}
                className="rounded-lg border border-noorix-border bg-noorix-surface p-3 grid grid-cols-1 sm:grid-cols-12 gap-2 items-end"
              >
                <div className="sm:col-span-5">
                  <Input
                    label={t('warrantyLineName')}
                    value={line.nameAr}
                    onChange={(e: any) =>
                      setLines((prev: any) =>
                        prev.map((x: any, i: any) => (i === idx ? { ...x, nameAr: e.target.value } : x)),
                      )
                    }
                  />
                </div>
                <div className="sm:col-span-3">
                  <Input
                    label={t('assetNameEn')}
                    value={line.nameEn}
                    onChange={(e: any) =>
                      setLines((prev: any) =>
                        prev.map((x: any, i: any) => (i === idx ? { ...x, nameEn: e.target.value } : x)),
                      )
                    }
                  />
                </div>
                <div className="sm:col-span-2">
                  <Input
                    type="number"
                    label={t('warrantyLineQty')}
                    value={line.quantity}
                    onChange={(e: any) =>
                      setLines((prev: any) =>
                        prev.map((x: any, i: any) => (i === idx ? { ...x, quantity: e.target.value } : x)),
                      )
                    }
                    className="ltr"
                    min="0"
                    step="0.1"
                  />
                </div>
                <div className="sm:col-span-2 flex justify-end">
                  <Button
                    type="button"
                    size="sm"
                    variant="danger"
                    onClick={() => removeLine(idx)}
                    disabled={lines.length <= 1}
                    title={t('delete')}
                  >
                    ×
                  </Button>
                </div>
                <div className="sm:col-span-12">
                  <Input
                    label={t('notes')}
                    value={line.notes}
                    onChange={(e: any) =>
                      setLines((prev: any) =>
                        prev.map((x: any, i: any) => (i === idx ? { ...x, notes: e.target.value } : x)),
                      )
                    }
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </form>
    </AdaptiveSheet>
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
}: any) {
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

  const submit = async (e: any) => {
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
    } catch (e2: any) {
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
          onChange={(e: any) => setForm((p: any) => ({ ...p, nameAr: e.target.value }))}
          required
        />
        <Input
          label={t('assetNameEn')}
          value={form.nameEn}
          onChange={(e: any) => setForm((p: any) => ({ ...p, nameEn: e.target.value }))}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label={t('assetSerial')}
            value={form.serialNumber}
            onChange={(e: any) => setForm((p: any) => ({ ...p, serialNumber: e.target.value }))}
            className="ltr"
          />
          <Input
            label={t('assetLocation')}
            value={form.location}
            onChange={(e: any) => setForm((p: any) => ({ ...p, location: e.target.value }))}
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            type="date"
            label={t('assetPurchaseDate')}
            value={form.purchaseDate}
            onChange={(e: any) => setForm((p: any) => ({ ...p, purchaseDate: e.target.value }))}
          />
          <Input
            type="number"
            label={t('assetAcquisitionCost')}
            value={form.acquisitionCost}
            onChange={(e: any) => setForm((p: any) => ({ ...p, acquisitionCost: e.target.value }))}
            className="ltr"
          />
        </div>
        <div>
          <label className="block text-[12px] text-noorix-muted mb-1">{t('assetSupplier')}</label>
          <SupplierSelect
            suppliers={suppliers}
            value={form.supplierId}
            onChange={(id: any) => setForm((p: any) => ({ ...p, supplierId: id }))}
            placeholder="—"
          />
        </div>
        <Input
          label={t('assetWarrantyDescription')}
          value={form.warrantyDescription}
          onChange={(e: any) => setForm((p: any) => ({ ...p, warrantyDescription: e.target.value }))}
        />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Input
            type="number"
            label={t('assetWarrantyMonths')}
            value={form.warrantyMonths}
            onChange={(e: any) => setForm((p: any) => ({ ...p, warrantyMonths: e.target.value }))}
            className="ltr"
          />
          <Input
            type="date"
            label={t('assetWarrantyStart')}
            value={form.warrantyStartDate}
            onChange={(e: any) => setForm((p: any) => ({ ...p, warrantyStartDate: e.target.value }))}
          />
          <Input
            type="date"
            label={t('assetWarrantyEnd')}
            value={form.warrantyEndDate}
            onChange={(e: any) => setForm((p: any) => ({ ...p, warrantyEndDate: e.target.value }))}
          />
        </div>
        <p className="text-[11px] text-noorix-muted m-0">{t('assetWarrantyEndHint')}</p>
        <Input
          label={t('assetNotes')}
          value={form.notes}
          onChange={(e: any) => setForm((p: any) => ({ ...p, notes: e.target.value }))}
        />
      </form>
    </AdaptiveSheet>
  );
}
