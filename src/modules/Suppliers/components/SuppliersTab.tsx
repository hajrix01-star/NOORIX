import React, { memo, useCallback, useState, type ChangeEvent } from 'react';
import { useDebouncedValue } from '../../../ui';
import { useSuppliers } from '../../../hooks/useSuppliers';
import { useCategories } from '../../../hooks/useCategories';
import { useTranslation } from '../../../i18n/useTranslation';
import { useToast } from '../../../context/ToastContext';
import { SupplierForm } from './SupplierForm';
import { SupplierTable } from './SupplierTable';
import { SupplierEditModal } from './SupplierEditModal';
import { SupplierProfileModal } from './SupplierProfileModal';
import SupplierImportExport from './SupplierImportExport';
import { Button, Input, ScreenShell } from '../../../ui';
import type {
  SupplierCategoryRecord,
  SupplierCreatePayload,
  SupplierRecord,
  SupplierUpdatePayload,
} from '../supplierTypes';

export type SuppliersTabProps = { companyId: string };

type ToastType = 'success' | 'error' | 'info' | 'warning';

function apiErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function toSupplierCategories(categories: unknown[]) {
  return categories.filter((category): category is SupplierCategoryRecord =>
    Boolean(category && typeof category === 'object'),
  );
}

export const SuppliersTab = memo(function SuppliersTab({ companyId }: SuppliersTabProps) {
  const { t } = useTranslation();
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const debouncedQ = useDebouncedValue(search.trim(), 300);
  const [editingSupplier, setEditingSupplier] = useState<SupplierRecord | null>(null);
  const [profileSupplier, setProfileSupplier] = useState<SupplierRecord | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const { showToast } = useToast();

  const { suppliers, isLoading, isError, error, create, update, remove } = useSuppliers(companyId, {
    pageSize: 500,
    q: debouncedQ || undefined,
  });
  const { flatCategories } = useCategories(companyId);
  const supplierCategories = toSupplierCategories(flatCategories);

  const notify = useCallback((message: string, type: ToastType = 'success') => {
    showToast(message, type);
  }, [showToast]);

  function handleSave(body: SupplierCreatePayload) {
    if (!companyId) {
      notify(t('pleaseSelectCompanyFirst'), 'error');
      return;
    }
    create.mutate(body, {
      onSuccess: () => {
        notify(t('supplierAdded'));
        setShowForm(false);
      },
      onError: (mutationError) => notify(apiErrorMessage(mutationError, t('addFailed')), 'error'),
    });
  }

  function handleEditSave(body: SupplierUpdatePayload) {
    if (!editingSupplier?.id) return;
    update.mutate({ id: editingSupplier.id, body }, {
      onSuccess: () => {
        notify(t('supplierUpdated'));
        setEditingSupplier(null);
      },
      onError: (mutationError) => notify(apiErrorMessage(mutationError, t('updateFailed')), 'error'),
    });
  }

  function handleDelete(supplier: SupplierRecord) {
    if (!confirm(t('deleteSupplierConfirm', supplier.nameAr))) return;
    remove.mutate(supplier.id, {
      onSuccess: () => {
        setSelectedIds((previous) => {
          const next = new Set(previous);
          next.delete(supplier.id);
          return next;
        });
        notify(t('supplierDeleted'));
      },
      onError: (mutationError) => notify(apiErrorMessage(mutationError, t('deleteFailed')), 'error'),
    });
  }

  async function removeSupplierById(id: string) {
    await new Promise<void>((resolve, reject) => {
      remove.mutate(id, {
        onSuccess: () => resolve(),
        onError: (mutationError) => reject(mutationError),
      });
    });
  }

  async function handleBulkDelete() {
    if (!selectedIds.size) return;
    if (!confirm(t('suppliersBulkDeleteConfirm', String(selectedIds.size)))) return;

    let done = 0;
    const ids = [...selectedIds];
    for (const id of ids) {
      try {
        await removeSupplierById(id);
        done += 1;
      } catch {
        continue;
      }
    }
    setSelectedIds(new Set());
    notify(t('suppliersBulkDeletedPartial', String(done), String(ids.length)));
  }

  const handleSelectChange = useCallback((id: string, checked: boolean) => {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const handleSelectAll = useCallback((checked: boolean) => {
    setSelectedIds(checked ? new Set(suppliers.map((supplier) => supplier.id)) : new Set());
  }, [suppliers]);

  async function handleImportOne(body: SupplierCreatePayload) {
    return create.mutateAsync(body);
  }

  return (
    <ScreenShell>
      <div className="nx-page-header">
        <Input
          type="search"
          size="sm"
          className="suppliers-tab-search"
          value={search}
          onChange={(event: ChangeEvent<HTMLInputElement>) => setSearch(event.target.value)}
          placeholder={t('searchByNameOrTax')}
        />
        <Button
          variant={showForm ? 'default' : 'primary'}
          onClick={() => setShowForm((visible) => !visible)}
        >
          {showForm ? t('cancel') : t('addSupplier')}
        </Button>
      </div>

      <SupplierImportExport
        companyId={companyId}
        suppliers={suppliers}
        onImport={handleImportOne}
      />

      {showForm && (
        <SupplierForm
          companyId={companyId}
          flatCategories={supplierCategories}
          onSave={handleSave}
          isSaving={create.isPending}
          onCancel={() => setShowForm(false)}
        />
      )}

      {isLoading
        ? <p className="text-noorix-muted text-[13px]">{t('loading')}</p>
        : isError
          ? (
            <div className="rounded-xl border border-noorix-red p-4 text-[13px] text-noorix-red bg-noorix-red/10">
              <strong>{t('suppliersLoadFailedTitle')}</strong>
              {error?.message && <p className="m-0 mt-1 text-[12px] opacity-80">{error.message}</p>}
              <p className="m-0 mt-1 text-[12px] opacity-70">{t('suppliersLoadFailedHint')}</p>
            </div>
          )
          : (
            <SupplierTable
              suppliers={suppliers}
              flatCategories={supplierCategories}
              onOpenProfile={setProfileSupplier}
              selectedIds={selectedIds}
              onSelectChange={handleSelectChange}
              onSelectAll={handleSelectAll}
              onBulkDelete={handleBulkDelete}
            />
          )}

      <SupplierEditModal
        supplier={editingSupplier}
        flatCategories={supplierCategories}
        onSave={handleEditSave}
        onClose={() => setEditingSupplier(null)}
        isSaving={update.isPending}
      />
      {profileSupplier && (
        <SupplierProfileModal
          open
          supplier={profileSupplier}
          companyId={companyId}
          flatCategories={supplierCategories}
          onClose={() => setProfileSupplier(null)}
          onEdit={setEditingSupplier}
          onDelete={handleDelete}
        />
      )}
    </ScreenShell>
  );
});
