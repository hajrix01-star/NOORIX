/**
 * SuppliersTab ظ¤ ╪ز╪ذ┘ê┘è╪ذ╪ر ╪د┘┘à┘ê╪▒╪»┘è┘
 * ┘è╪»╪╣┘à: ╪ح╪╢╪د┘╪ر╪î ╪ز╪╣╪»┘è┘╪î ╪ص╪░┘╪î ╪ز╪ص╪»┘è╪» ┘à╪ز╪╣╪»╪»╪î ╪ص╪░┘ ╪ش┘à╪د╪╣┘è╪î
 *        ╪د╪│╪ز┘è╪▒╪د╪» CSV╪î ╪ز╪╡╪»┘è╪▒ CSV╪î ╪ز┘╪▓┘è┘ ┘┘à┘ê╪░╪ش.
 */
import React, { useState, memo, useCallback } from 'react';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { useSuppliers }        from '../../../hooks/useSuppliers';
import { useCategories }       from '../../../hooks/useCategories';
import { useTranslation }      from '../../../i18n/useTranslation';
import { useToast } from '../../../context/ToastContext';
import { createSupplier }      from '../../../services/api';
import { rejectIfApiFailed } from '../../../utils/apiResponse';
import { SupplierForm }        from './SupplierForm';
import { SupplierTable }       from './SupplierTable';
import { SupplierEditModal }   from './SupplierEditModal';
import SupplierImportExport    from './SupplierImportExport';
import { Button, Input, ScreenShell } from '../../../ui';

export type SuppliersTabProps = { companyId: any };

export const SuppliersTab = memo(function SuppliersTab({ companyId }: SuppliersTabProps) {
  const { t } = useTranslation();

  /* ظ¤ظ¤ ╪ص╪د┘╪ر ظ¤ظ¤ */
  const [showForm,        setShowForm]        = useState(false);
  const [search,          setSearch]          = useState('');
  const debouncedQ = useDebouncedValue(search.trim(), 300);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [selectedIds,     setSelectedIds]     = useState(new Set());
  const { showToast } = useToast();

  /* ظ¤ظ¤ ╪ذ┘è╪د┘╪د╪ز ظ¤ظ¤ */
  const { suppliers, isLoading, isError, error, create, update, remove } = useSuppliers(companyId, { pageSize: 500, q: debouncedQ || undefined });
  const { flatCategories } = useCategories(companyId);

  /* ظ¤ظ¤ ┘à╪│╪د╪╣╪» toast ظ¤ظ¤ */
  const notify = useCallback((message, type = 'success') => {
    showToast(message, type);
  }, [showToast]);

  /* ظ¤ظ¤ ╪ح╪╢╪د┘╪ر ┘à┘ê╪▒╪» ظ¤ظ¤ */
  function handleSave(body) {
    if (!companyId) { notify(t('pleaseSelectCompanyFirst'), 'error'); return; }
    create.mutate(body, {
      onSuccess: () => { notify(t('supplierAdded')); setShowForm(false); },
      onError:   (e) => notify(e?.message || t('addFailed'), 'error'),
    });
  }

  /* ظ¤ظ¤ ╪ز╪╣╪»┘è┘ ظ¤ظ¤ */
  function handleEditSave(body) {
    if (!editingSupplier?.id) return;
    update.mutate({ id: editingSupplier.id, body }, {
      onSuccess: () => { notify(t('supplierUpdated')); setEditingSupplier(null); },
      onError:   (e) => notify(e?.message || t('updateFailed'), 'error'),
    });
  }

  /* ظ¤ظ¤ ╪ص╪░┘ ┘╪▒╪»┘è ظ¤ظ¤ */
  function handleDelete(supplier) {
    if (!confirm(t('deleteSupplierConfirm', supplier.nameAr))) return;
    remove.mutate(supplier.id, {
      onSuccess: () => {
        setSelectedIds((prev) => { const n = new Set(prev); n.delete(supplier.id); return n; });
        notify(t('supplierDeleted'));
      },
      onError: (e) => notify(e?.message || t('deleteFailed'), 'error'),
    });
  }

  /* ظ¤ظ¤ ╪ص╪░┘ ╪ش┘à╪د╪╣┘è ظ¤ظ¤ */
  async function handleBulkDelete() {
    if (!selectedIds.size) return;
    if (!confirm(`╪ص╪░┘ ${selectedIds.size} ┘à┘ê╪▒╪»/┘à┘ê╪▒╪»┘è┘╪ا ┘╪د ┘è┘à┘â┘ ╪د┘╪ز╪▒╪د╪ش╪╣.`)) return;

    let done = 0;
    const ids = [...selectedIds];
    for (const id of ids) {
      try {
        await new Promise((res, rej) =>
          remove.mutate(id, { onSuccess: res, onError: rej }),
        );
        done++;
      } catch (_) {}
    }
    setSelectedIds(new Set());
    notify(`╪ز┘à ╪ص╪░┘ ${done} ┘à┘ ╪ث╪╡┘ ${ids.length} ┘à┘ê╪▒╪»`);
  }

  /* ظ¤ظ¤ ╪ز╪ص╪»┘è╪» / ╪ح┘╪║╪د╪ة ╪ز╪ص╪»┘è╪» ظ¤ظ¤ */
  const handleSelectChange = useCallback((id, checked) => {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      checked ? n.add(id) : n.delete(id);
      return n;
    });
  }, []);

  const handleSelectAll = useCallback((checked) => {
    setSelectedIds(checked ? new Set(suppliers.map((s) => s.id)) : new Set());
  }, [suppliers]);

  /* ظ¤ظ¤ ╪د╪│╪ز┘è╪▒╪د╪» ┘à┘ê╪▒╪» ┘ê╪د╪ص╪» (┘è┘╪│╪ز╪»╪╣┘ë ┘à┘ ImportExport) ظ¤ظ¤ */
  async function handleImportOne(body) {
    const res = await createSupplier(body);
    rejectIfApiFailed(res, t('addFailed'));
    return res.data;
  }

  return (
    <ScreenShell>
      {/* ظ¤ظ¤ ╪┤╪▒┘è╪╖ ╪د┘╪ذ╪ص╪س + ╪ح╪╢╪د┘╪ر ظ¤ظ¤ */}
      <div className="nx-page-header">
        <Input
          type="search"
          size="sm"
          className="suppliers-tab-search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('searchByNameOrTax')}
        />
        <Button
          variant={showForm ? 'default' : 'primary'}
          onClick={() => setShowForm((v) => !v)}
        >
          {showForm ? t('cancel') : t('addSupplier')}
        </Button>
      </div>

      {/* ظ¤ظ¤ ╪د╪│╪ز┘è╪▒╪د╪» / ╪ز╪╡╪»┘è╪▒ ظ¤ظ¤ */}
      <SupplierImportExport
        companyId={companyId}
        suppliers={suppliers}
        onImport={handleImportOne}
      />

      {/* ظ¤ظ¤ ┘┘à┘ê╪░╪ش ╪د┘╪ح╪╢╪د┘╪ر ظ¤ظ¤ */}
      {showForm && (
        <SupplierForm
          companyId={companyId}
          flatCategories={flatCategories}
          onSave={handleSave}
          isSaving={create.isPending}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* ظ¤ظ¤ ╪د┘╪ش╪»┘ê┘ ظ¤ظ¤ */}
      {isLoading
        ? <p className="text-noorix-muted text-[13px]">{t('loading')}</p>
        : isError
        ? (
          <div className="rounded-xl border border-noorix-red p-4 text-[13px] text-noorix-red" style={{ background: 'color-mix(in srgb, var(--noorix-accent-red) 8%, transparent)' }}>
            <strong>╪ز╪╣╪░┘ّ╪▒ ╪ز╪ص┘à┘è┘ ╪د┘┘à┘ê╪▒╪»┘è┘</strong>
            {error?.message && <p className="m-0 mt-1 text-[12px] opacity-80">{error.message}</p>}
            <p className="m-0 mt-1 text-[12px] opacity-70">╪ز╪ث┘â╪» ┘à┘ ╪د╪ز╪╡╪د┘┘â ╪ذ╪د┘╪ح┘╪ز╪▒┘╪ز ┘ê╪ز╪ص╪»┘è╪س ╪د┘╪╡┘╪ص╪ر.</p>
          </div>
        )
        : (
          <SupplierTable
            suppliers={suppliers}
            flatCategories={flatCategories}
            onEdit={(s) => setEditingSupplier(s)}
            onDelete={handleDelete}
            selectedIds={selectedIds}
            onSelectChange={handleSelectChange}
            onSelectAll={handleSelectAll}
            onBulkDelete={handleBulkDelete}
          />
        )
      }

      {/* ظ¤ظ¤ ┘à┘ê╪»╪د┘ ╪د┘╪ز╪╣╪»┘è┘ ظ¤ظ¤ */}
      <SupplierEditModal
        supplier={editingSupplier}
        flatCategories={flatCategories}
        onSave={handleEditSave}
        onClose={() => setEditingSupplier(null)}
        isSaving={update.isPending}
      />
    </ScreenShell>
  );
});

export default SuppliersTab;
