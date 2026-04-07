/**
 * SuppliersTab — تبويبة الموردين
 * يدعم: إضافة، تعديل، حذف، تحديد متعدد، حذف جماعي،
 *        استيراد CSV، تصدير CSV، تنزيل نموذج.
 */
import React, { useState, memo, useEffect, useCallback } from 'react';
import { useSuppliers }        from '../../../hooks/useSuppliers';
import { useCategories }       from '../../../hooks/useCategories';
import { useTranslation }      from '../../../i18n/useTranslation';
import { createSupplier }      from '../../../services/api';
import Toast                   from '../../../components/Toast';
import { SupplierForm }        from './SupplierForm';
import { SupplierTable }       from './SupplierTable';
import { SupplierEditModal }   from './SupplierEditModal';
import SupplierImportExport    from './SupplierImportExport';
import { Button, Input }       from '../../../ui';

export const SuppliersTab = memo(function SuppliersTab({ companyId }) {
  const { t } = useTranslation();

  /* ── حالة ── */
  const [showForm,        setShowForm]        = useState(false);
  const [search,          setSearch]          = useState('');
  const [debouncedQ,      setDebouncedQ]      = useState('');
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [selectedIds,     setSelectedIds]     = useState(new Set());
  const [toast,           setToast]           = useState({ visible: false, message: '', type: 'success' });

  /* debounce البحث */
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQ(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  /* ── بيانات ── */
  const { suppliers, isLoading, create, update, remove } = useSuppliers(companyId, { pageSize: 500, q: debouncedQ || undefined });
  const { flatCategories } = useCategories(companyId);

  /* ── مساعد toast ── */
  const notify = useCallback((message, type = 'success') => {
    setToast({ visible: true, message, type });
  }, []);

  /* ── إضافة مورد ── */
  function handleSave(body) {
    if (!companyId) { notify(t('pleaseSelectCompanyFirst'), 'error'); return; }
    create.mutate(body, {
      onSuccess: () => { notify(t('supplierAdded')); setShowForm(false); },
      onError:   (e) => notify(e?.message || t('addFailed'), 'error'),
    });
  }

  /* ── تعديل ── */
  function handleEditSave(body) {
    if (!editingSupplier?.id) return;
    update.mutate({ id: editingSupplier.id, body }, {
      onSuccess: () => { notify(t('supplierUpdated')); setEditingSupplier(null); },
      onError:   (e) => notify(e?.message || t('updateFailed'), 'error'),
    });
  }

  /* ── حذف فردي ── */
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

  /* ── حذف جماعي ── */
  async function handleBulkDelete() {
    if (!selectedIds.size) return;
    if (!confirm(`حذف ${selectedIds.size} مورد/موردين؟ لا يمكن التراجع.`)) return;

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
    notify(`تم حذف ${done} من أصل ${ids.length} مورد`);
  }

  /* ── تحديد / إلغاء تحديد ── */
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

  /* ── استيراد مورد واحد (يُستدعى من ImportExport) ── */
  async function handleImportOne(body) {
    const res = await createSupplier(body);
    if (!res?.success) throw new Error(res?.error || 'فشل الاستيراد');
    return res.data;
  }

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-6">
      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onDismiss={() => setToast((p) => ({ ...p, visible: false }))}
      />

      {/* ── شريط البحث + إضافة ── */}
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

      {/* ── استيراد / تصدير ── */}
      <SupplierImportExport
        companyId={companyId}
        suppliers={suppliers}
        onImport={handleImportOne}
      />

      {/* ── نموذج الإضافة ── */}
      {showForm && (
        <SupplierForm
          companyId={companyId}
          flatCategories={flatCategories}
          onSave={handleSave}
          isSaving={create.isPending}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* ── الجدول ── */}
      {isLoading
        ? <p className="text-noorix-muted text-[13px]">{t('loading')}</p>
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

      {/* ── مودال التعديل ── */}
      <SupplierEditModal
        supplier={editingSupplier}
        flatCategories={flatCategories}
        onSave={handleEditSave}
        onClose={() => setEditingSupplier(null)}
        isSaving={update.isPending}
      />
    </div>
  );
});

export default SuppliersTab;
