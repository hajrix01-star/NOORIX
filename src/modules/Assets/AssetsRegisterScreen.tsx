/**
 * AssetsRegisterScreen — سجل أصول تشغيلي (ضمان، مدة، تقرير/جدول) بدون إهلاك.
 * Container: صلاحيات، تبويب، تجميع hooks ومكوّنات السجل.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from '../../i18n/useTranslation';
import { useToast } from '../../context/ToastContext';
import { useTabSearchParam } from '../../hooks/useTabSearchParam';
import { useSuppliers } from '../../hooks/useSuppliers';
import { hasPermission, resolveUserRole, PERMISSIONS } from '../../constants/permissions';
import { ErrorState } from '../../components/states/ErrorState';
import LoadingFallback from '../../components/LoadingFallback';
import { Button, ScreenShell, ScreenTitle, ScreenTabs, Badge } from '../../ui';
import { useAssetsRegisterFilters } from './hooks/useAssetsRegisterFilters';
import { useAssetsRegisterData } from './hooks/useAssetsRegisterData';
import { useAssetsRegisterActions } from './hooks/useAssetsRegisterActions';
import { AssetsRegisterFilterBar } from './components/AssetsRegisterFilterBar';
import { AssetsRegisterTable } from './components/AssetsRegisterTable';
import { AssetsWarrantyQueueTable } from './components/AssetsWarrantyQueueTable';
import { AssetFormPanel } from './components/AssetFormPanel';
import { AssetWarrantyPanel } from './components/AssetWarrantyPanel';
import { AssetWarrantyDetailModal } from './components/AssetWarrantyDetailModal';
import { ASSET_SECTION_TAB_IDS } from './types';
import type { AssetRegisterListItem, PendingWarrantyInvoiceRow } from './types';

type AssetCompanyRef = {
  id?: string | null;
};

export default function AssetsRegisterScreen() {
  const { activeCompanyId, companies } = useApp();
  const { t, lang } = useTranslation();
  const { showToast } = useToast();
  const { user } = useAuth();
  const companyId = activeCompanyId ?? '';
  const companyRefs = (companies as AssetCompanyRef[] | undefined) ?? [];
  const activeCompany = companyRefs.find((company) => company.id === companyId);
  const isCompanySelectionPending = !companyId || (companyRefs.length > 0 && !activeCompany);
  const queryCompanyId = isCompanySelectionPending ? '' : companyId;
  const queryClient = useQueryClient();

  const role = resolveUserRole(user?.role);
  const canWrite =
    hasPermission(role, PERMISSIONS.ASSETS_WRITE, user?.permissions) ||
    hasPermission(role, PERMISSIONS.EXPENSES_WRITE, user?.permissions);
  const canDelete =
    hasPermission(role, PERMISSIONS.ASSETS_DELETE, user?.permissions) ||
    hasPermission(role, PERMISSIONS.EXPENSES_DELETE, user?.permissions);

  const filters = useAssetsRegisterFilters();
  const { warrantyFilter, setWarrantyFilter, search, setSearch, debouncedQ, page, setPage, pageSize } = filters;

  const {
    items,
    total,
    sumAll,
    isLoading,
    isError,
    error,
    refetch,
    pendingRows,
    pendingLoading,
  } = useAssetsRegisterData(queryCompanyId, warrantyFilter, debouncedQ, page, pageSize, t('loadingError'));

  const { handleDelete, invalidateAssets } = useAssetsRegisterActions({
    companyId: queryCompanyId,
    canDelete,
    queryClient,
    showToast,
    t,
  });

  const { suppliers } = useSuppliers(queryCompanyId, { pageSize: 500 });

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<AssetRegisterListItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [assetSectionTab, setAssetSectionTab] = useTabSearchParam(ASSET_SECTION_TAB_IDS, 'register');
  const [pendingInvoiceForComplete, setPendingInvoiceForComplete] = useState<PendingWarrantyInvoiceRow | null>(
    null,
  );
  const [warrantyDetailAsset, setWarrantyDetailAsset] = useState<AssetRegisterListItem | null>(null);
  const [completeSaving, setCompleteSaving] = useState(false);

  const registerBannerError = assetSectionTab === 'register' && isError;
  const registerTableInlineError = registerBannerError ? false : isError;

  const openCreate = useCallback(() => {
    setEditing(null);
    setSheetOpen(true);
  }, []);

  const openEdit = useCallback((row: AssetRegisterListItem) => {
    setEditing(row);
    setSheetOpen(true);
  }, []);

  const handleSaved = useCallback(() => {
    invalidateAssets();
    setSheetOpen(false);
    setEditing(null);
    showToast(t('savedSuccessfully') || 'تم الحفظ');
  }, [invalidateAssets, showToast, t]);

  const handleWarrantyCompleteSaved = useCallback(() => {
    invalidateAssets();
    setPendingInvoiceForComplete(null);
    showToast(t('savedSuccessfully') || 'تم الحفظ');
  }, [invalidateAssets, showToast, t]);

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

  const onWarrantyQueueComplete = useCallback((row: PendingWarrantyInvoiceRow) => {
    setPendingInvoiceForComplete(row);
  }, []);

  if (isCompanySelectionPending) {
    return (
      <ScreenShell>
        <LoadingFallback />
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
            {registerBannerError ? (
              <ErrorState>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>{error?.message || t('loadingError')}</span>
                  <Button size="sm" variant="ghost" onClick={() => void refetch()}>
                    {t('refresh')}
                  </Button>
                </div>
              </ErrorState>
            ) : null}
            <AssetsRegisterFilterBar
              search={search}
              onSearchChange={setSearch}
              onSearchApplied={() => setPage(1)}
              warrantyFilter={warrantyFilter}
              onWarrantyFilterChange={setWarrantyFilter}
              onRefresh={() => void refetch()}
              t={t}
            />
            <AssetsRegisterTable
              items={items}
              total={total}
              sumAll={sumAll}
              page={page}
              pageSize={pageSize}
              onPageChange={setPage}
              isLoading={isLoading}
              isError={registerTableInlineError}
              errorMessage={error?.message || t('loadingError')}
              t={t}
              lang={lang}
              onOpenWarranty={setWarrantyDetailAsset}
            />
          </>
        )}

        {assetSectionTab === 'queue' && (
          <AssetsWarrantyQueueTable
            pendingRows={pendingRows}
            pendingLoading={pendingLoading}
            canWrite={canWrite}
            lang={lang}
            t={t}
            onCompleteClick={onWarrantyQueueComplete}
          />
        )}
      </ScreenTabs>

      {sheetOpen ? (
        <AssetFormPanel
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
        <AssetWarrantyPanel
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

      {warrantyDetailAsset ? (
        <AssetWarrantyDetailModal
          asset={warrantyDetailAsset}
          companyId={companyId}
          onClose={() => setWarrantyDetailAsset(null)}
          onEdit={(asset) => {
            setWarrantyDetailAsset(null);
            openEdit(asset);
          }}
          onDelete={handleDelete}
          canWrite={canWrite}
          canDelete={canDelete}
          t={t}
          lang={lang}
        />
      ) : null}
    </ScreenShell>
  );
}
