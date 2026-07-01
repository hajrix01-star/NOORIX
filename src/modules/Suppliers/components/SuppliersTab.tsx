/**
 * Suppliers tab: list, add, edit, bulk delete, CSV import/export.
 */
import React, { useState, memo, useCallback } from 'react';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { useSuppliers }        from '../../../hooks/useSuppliers';
import { useCategories }       from '../../../hooks/useCategories';
import { useTranslation }      from '../../../i18n/useTranslation';
import { useToast } from '../../../context/ToastContext';
import { createSupplier, throwIfApiFailed }      from '../../../services/api';
import { SupplierForm }        from './SupplierForm';
import { SupplierTable }       from './SupplierTable';
import { SupplierEditModal }   from './SupplierEditModal';
import { SupplierProfileModal } from './SupplierProfileModal';
import SupplierImportExport    from './SupplierImportExport';
import { Button, Input, ScreenShell } from '../../../ui';

export type SuppliersTabProps = { companyId: any };

export const SuppliersTab = memo(function SuppliersTab({ companyId }: SuppliersTabProps) {
  const { t } = useTranslation();

  const [showForm,        setShowForm]        = useState(false);
  const [search,          setSearch]          = useState('');
  const debouncedQ = useDebouncedValue(search.trim(), 300);
  const [editingSupplier, setEditingSupplier] = useState<any>(null);
  const [profileSupplier, setProfileSupplier] = useState<any>(null);
  const [selectedIds,     setSelectedIds]     = useState(new Set());
  const { showToast } = useToast();

  const { suppliers, isLoading, isError, error, create, update, remove } = useSuppliers(companyId, { pageSize: 500, q: debouncedQ || undefined });
  const { flatCategories } = useCategories(companyId);

  const notify = useCallback((message: any, type: any = 'success') => {
    showToast(message, type);
  }, [showToast]);

  function handleSave(body: any) {
    if (!companyId) { notify(t('pleaseSelectCompanyFirst'), 'error'); return; }
    create.mutate(body, {
      onSuccess: () => { notify(t('supplierAdded')); setShowForm(false); },
      onError:   (e: any) => notify(e?.message || t('addFailed'), 'error'),
    });
  }

  function handleEditSave(body: any) {
    if (!editingSupplier?.id) return;
    update.mutate({ id: editingSupplier.id, body }, {
      onSuccess: () => { notify(t('supplierUpdated')); setEditingSupplier(null); },
      onError:   (e: any) => notify(e?.message || t('updateFailed'), 'error'),
    });
  }

  function handleDelete(supplier: any) {
    if (!confirm(t('deleteSupplierConfirm', supplier.nameAr))) return;
    remove.mutate(supplier.id, {
      onSuccess: () => {
        setSelectedIds((prev: any) => { const n = new Set(prev); n.delete(supplier.id); return n; });
        notify(t('supplierDeleted'));
      },
      onError: (e: any) => notify(e?.message || t('deleteFailed'), 'error'),
    });
  }

  async function handleBulkDelete() {
    if (!selectedIds.size) return;
    if (!confirm(t('suppliersBulkDeleteConfirm', String(selectedIds.size)))) return;

    let done = 0;
    const ids = [...selectedIds];
    for (const id of ids) {
      try {
        await new Promise((res: any, rej: any) =>
          remove.mutate(id, { onSuccess: res, onError: rej }),
        );
        done++;
      } catch (_: any) {}
    }
    setSelectedIds(new Set());
    notify(t('suppliersBulkDeletedPartial', String(done), String(ids.length)));
  }

  const handleSelectChange = useCallback((id: any, checked: any) => {
    setSelectedIds((prev: any) => {
      const n = new Set(prev);
      checked ? n.add(id) : n.delete(id);
      return n;
    });
  }, []);

  const handleSelectAll = useCallback((checked: any) => {
    setSelectedIds(checked ? new Set(suppliers.map((s: any) => s.id)) : new Set());
  }, [suppliers]);

  async function handleImportOne(body: any) {
    const res = await createSupplier(body);
    throwIfApiFailed(res, t('addFailed'));
    return res.data;
  }

  return (
    <ScreenShell>
      <div className="nx-page-header">
        <Input
          type="search"
          size="sm"
          className="suppliers-tab-search"
          value={search}
          onChange={(e: any) => setSearch(e.target.value)}
          placeholder={t('searchByNameOrTax')}
        />
        <Button
          variant={showForm ? 'default' : 'primary'}
          onClick={() => setShowForm((v: any) => !v)}
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
          flatCategories={flatCategories}
          onSave={handleSave}
          isSaving={create.isPending}
          onCancel={() => setShowForm(false)}
        />
      )}

      {isLoading
        ? <p className="text-noorix-muted text-[13px]">{t('loading')}</p>
        : isError
        ? (
          <div className="rounded-xl border border-noorix-red p-4 text-[13px] text-noorix-red" style={{ background: 'color-mix(in srgb, var(--noorix-accent-red) 8%, transparent)' }}>
            <strong>{t('suppliersLoadFailedTitle')}</strong>
            {error?.message && <p className="m-0 mt-1 text-[12px] opacity-80">{error.message}</p>}
            <p className="m-0 mt-1 text-[12px] opacity-70">{t('suppliersLoadFailedHint')}</p>
          </div>
        )
        : (
          <SupplierTable
            suppliers={suppliers}
            flatCategories={flatCategories}
            onEdit={(s: any) => setEditingSupplier(s)}
            onOpenProfile={(s: any) => setProfileSupplier(s)}
            onDelete={handleDelete}
            selectedIds={selectedIds}
            onSelectChange={handleSelectChange}
            onSelectAll={handleSelectAll}
            onBulkDelete={handleBulkDelete}
          />
        )
      }

      <SupplierEditModal
        supplier={editingSupplier}
        flatCategories={flatCategories}
        onSave={handleEditSave}
        onClose={() => setEditingSupplier(null)}
        isSaving={update.isPending}
      />
      <SupplierProfileModal
        open={!!profileSupplier}
        supplier={profileSupplier}
        companyId={companyId}
        flatCategories={flatCategories}
        onClose={() => setProfileSupplier(null)}
      />
    </ScreenShell>
  );
});
