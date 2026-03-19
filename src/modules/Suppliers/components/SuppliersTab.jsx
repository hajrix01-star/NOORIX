/**
 * SuppliersTab — تبويبة الموردين
 */
import React, { useState, useMemo, memo } from 'react';
import { useSuppliers } from '../../../hooks/useSuppliers';
import { useCategories } from '../../../hooks/useCategories';
import { useTranslation } from '../../../i18n/useTranslation';
import Toast from '../../../components/Toast';
import { SupplierForm } from './SupplierForm';
import { SupplierTable } from './SupplierTable';
import { SupplierEditModal } from './SupplierEditModal';

const IS = {
  width: '100%', padding: '9px 12px', borderRadius: 8,
  border: '1px solid var(--noorix-border)', background: 'var(--noorix-bg-surface)',
  color: 'var(--noorix-text)', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box',
};

export const SuppliersTab = memo(function SuppliersTab({ companyId }) {
  const { t } = useTranslation();
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch]     = useState('');
  const [toast, setToast]       = useState({ visible: false, message: '', type: 'success' });
  const [editingSupplier, setEditingSupplier] = useState(null);

  const { suppliers, isLoading, create, update, remove } = useSuppliers(companyId);
  const { flatCategories }                               = useCategories(companyId);

  const filtered = useMemo(() => {
    if (!search.trim()) return suppliers;
    const q = search.toLowerCase();
    return suppliers.filter((s) =>
      (s.nameAr || '').toLowerCase().includes(q) ||
      (s.nameEn || '').toLowerCase().includes(q) ||
      (s.taxNumber || '').toLowerCase().includes(q),
    );
  }, [suppliers, search]);

  function handleSave(body) {
    if (!companyId) { setToast({ visible: true, message: t('pleaseSelectCompanyFirst'), type: 'error' }); return; }
    create.mutate(body, {
      onSuccess: () => {
        setToast({ visible: true, message: t('supplierAdded'), type: 'success' });
        setShowForm(false);
      },
      onError: (e) => setToast({ visible: true, message: e?.message || t('addFailed'), type: 'error' }),
    });
  }

  function handleEditSave(body) {
    if (!editingSupplier?.id) return;
    update.mutate(
      { id: editingSupplier.id, body },
      {
        onSuccess: () => {
          setToast({ visible: true, message: t('supplierUpdated'), type: 'success' });
          setEditingSupplier(null);
        },
        onError: (e) => setToast({ visible: true, message: e?.message || t('updateFailed'), type: 'error' }),
      },
    );
  }

  function handleDelete(supplier) {
    if (!confirm(t('deleteSupplierConfirm', supplier.nameAr))) return;
    remove.mutate(supplier.id, {
      onSuccess: () => setToast({ visible: true, message: t('supplierDeleted'), type: 'success' }),
      onError: (e) => setToast({ visible: true, message: e?.message || t('deleteFailed'), type: 'error' }),
    });
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <Toast visible={toast.visible} message={toast.message} type={toast.type} onDismiss={() => setToast((p) => ({ ...p, visible: false }))} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <input
          type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder={t('searchByNameOrTax')}
          style={{ ...IS, maxWidth: 320 }}
        />
        <button
          type="button"
          className={`noorix-btn-nav${showForm ? '' : ' noorix-btn-primary'}`}
          onClick={() => setShowForm((v) => !v)}
        >
          {showForm ? t('cancel') : t('addSupplier')}
        </button>
      </div>

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
        ? <p style={{ color: 'var(--noorix-text-muted)', fontSize: 13 }}>{t('loading')}</p>
        : <SupplierTable
            suppliers={filtered}
            flatCategories={flatCategories}
            onEdit={(s) => setEditingSupplier(s)}
            onDelete={handleDelete}
          />
      }

      {editingSupplier && (
        <SupplierEditModal
          supplier={editingSupplier}
          flatCategories={flatCategories}
          onSave={handleEditSave}
          onClose={() => setEditingSupplier(null)}
          isSaving={update.isPending}
        />
      )}
    </div>
  );
});

export default SuppliersTab;
