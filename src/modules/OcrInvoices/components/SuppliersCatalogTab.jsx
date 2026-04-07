import React, { useState } from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { Button, Input, Drawer } from '../../../ui';
import {
  createOcrSupplier, updateOcrSupplier, deleteOcrSupplier, addSupplierAlias,
  bulkDeleteOcrSuppliers,
} from '../services/ocrApi';

function SupplierForm({ initial = {}, onSave, onCancel, loading }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({ nameAr: '', nameEn: '', taxNumber: '', phone: '', notes: '', ...initial });
  const f = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));
  return (
    <div className="nx-grid nx-gap-12">
      <Input placeholder={`${t('ocrSupplierNameAr')} *`} value={form.nameAr} onChange={f('nameAr')} />
      <Input placeholder={t('ocrSupplierNameEn')} value={form.nameEn} onChange={f('nameEn')} />
      <Input placeholder={t('ocrSupplierTax')} value={form.taxNumber} onChange={f('taxNumber')} />
      <Input placeholder={t('ocrSupplierPhone')} value={form.phone} onChange={f('phone')} />
      <div className="nx-flex nx-gap-8">
        <Button onClick={() => onSave(form)} disabled={loading || !form.nameAr} variant="primary" className="nx-flex-1">
          {loading ? '...' : t('ocrSave')}
        </Button>
        <Button onClick={onCancel} className="nx-flex-1">{t('ocrCancel')}</Button>
      </div>
    </div>
  );
}

export default function SuppliersCatalogTab({ suppliers = [], loading, onRefresh }) {
  const { t, language } = useTranslation();
  const [search, setSearch]     = useState('');
  const [adding, setAdding]     = useState(false);
  const [editing, setEditing]   = useState(null);
  const [saving, setSaving]     = useState(false);
  const [viewing, setViewing]   = useState(null);
  const [aliasInput, setAliasInput] = useState('');
  const [aliasLang, setAliasLang]   = useState('ar');
  const [selected, setSelected] = useState(new Set());
  const [deleting, setDeleting] = useState(false);
  const dir = language === 'ar' ? 'rtl' : 'ltr';

  const toggleSelect = (id) => setSelected((prev) => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next;
  });

  const handleBulkDelete = async () => {
    if (!selected.size || !window.confirm(`حذف ${selected.size} مورد؟`)) return;
    setDeleting(true);
    await bulkDeleteOcrSuppliers([...selected]);
    setSelected(new Set());
    setDeleting(false);
    onRefresh();
  };

  const filtered = suppliers.filter((s) => {
    const q = search.toLowerCase();
    return !q || s.nameAr?.toLowerCase().includes(q) || s.nameEn?.toLowerCase().includes(q) || s.taxNumber?.includes(q);
  });

  const handleCreate = async (data) => {
    setSaving(true);
    const res = await createOcrSupplier(data);
    setSaving(false);
    if (res.success) { setAdding(false); onRefresh(); }
  };

  const handleUpdate = async (data) => {
    setSaving(true);
    const res = await updateOcrSupplier(editing.id, data);
    setSaving(false);
    if (res.success) { setEditing(null); onRefresh(); }
  };

  const handleDelete = async (id) => {
    if (!confirm('هل تريد حذف هذا المورد؟')) return;
    await deleteOcrSupplier(id);
    onRefresh();
  };

  const handleAddAlias = async () => {
    if (!aliasInput || !viewing) return;
    await addSupplierAlias(viewing.id, aliasInput, aliasLang);
    setAliasInput('');
    onRefresh();
    const updated = suppliers.find((s) => s.id === viewing.id);
    if (updated) setViewing(updated);
  };

  const isAr = language === 'ar';
  const allChecked = filtered.length > 0 && filtered.every((s) => selected.has(s.id));

  if (loading) return (
    <div className="ocr-loading">
      <div className="ocr-spinner" />
      <span>{isAr ? 'جاري التحميل...' : 'Loading...'}</span>
    </div>
  );

  return (
    <div dir={dir}>
      {/* Toolbar */}
      <div className="inv-toolbar nx-mb-16">
        <label className="nx-checkbox inv-select-all-wrap">
          <input type="checkbox" checked={allChecked} onChange={allChecked ? () => setSelected(new Set()) : () => setSelected(new Set(filtered.map(s => s.id)))} className="inv-toolbar-checkbox" />
          <span className="inv-select-all-label">
            {selected.size > 0 ? (isAr ? `${selected.size} محدد` : `${selected.size} selected`) : (isAr ? 'تحديد الكل' : 'Select all')}
          </span>
        </label>

        <div className="inv-search-wrap">
          <span className="inv-search-icon">⌕</span>
          <Input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('ocrSearch')} className="inv-search-input" />
          {search && <Button className="inv-search-clear" onClick={() => setSearch('')}>✕</Button>}
        </div>

        <Button onClick={() => setAdding(true)} variant="primary" size="sm">+ {t('ocrAddSupplier')}</Button>

        {selected.size > 0 && (
          <Button className="inv-delete-btn" onClick={handleBulkDelete} disabled={deleting}>
            {isAr ? `حذف (${selected.size})` : `Delete (${selected.size})`}
          </Button>
        )}
      </div>

      {adding && (
        <div className="nx-rounded-lg nx-bg-surface nx-mb-16 nx-p-20 nx-border-all">
          <div className="nx-font-600 nx-mb-12 nx-text-md">{t('ocrAddSupplier')}</div>
          <SupplierForm onSave={handleCreate} onCancel={() => setAdding(false)} loading={saving} />
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="ocr-empty">
          <div className="ocr-empty-icon">—</div>
          <div className="ocr-empty-text">{t('ocrNoSuppliers')}</div>
        </div>
      ) : (
        <div className="ocr-catalog-list">
          {filtered.map((s) => (
            <div key={s.id}>
              {editing?.id === s.id ? (
                <div className="nx-bg-surface nx-p-16 nx-rounded nx-border-all">
                  <SupplierForm initial={s} onSave={handleUpdate} onCancel={() => setEditing(null)} loading={saving} />
                </div>
              ) : (
                <div className={`ocr-catalog-item${selected.has(s.id) ? ' ocr-catalog-item--selected' : ''}`}>
                  <label className="nx-checkbox">
                    <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggleSelect(s.id)} className="ocr-catalog-checkbox" onClick={e => e.stopPropagation()} />
                  </label>
                  <div className="ocr-catalog-avatar">{(s.nameAr || s.nameEn || '?')[0]}</div>
                  <div className="ocr-catalog-name nx-cursor-pointer" onClick={() => setViewing(s)}>
                    <div className="ocr-catalog-name-primary">{isAr ? s.nameAr : (s.nameEn || s.nameAr)}</div>
                    {s.nameEn && s.nameAr && <div className="ocr-catalog-name-secondary">{isAr ? s.nameEn : s.nameAr}</div>}
                  </div>
                  <span className="ocr-catalog-badge">{s._count?.invoices || 0} {isAr ? 'فاتورة' : 'inv.'}</span>
                  <div className="nx-flex nx-gap-4">
                    <Button onClick={() => setEditing(s)} size="sm">{t('ocrEdit')}</Button>
                    <Button onClick={() => handleDelete(s.id)} size="sm" variant="danger">{t('ocrDelete')}</Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Alias drawer */}
      <Drawer
        open={!!viewing}
        onClose={() => setViewing(null)}
        size="md"
        side="start"
        title={viewing?.nameAr || ''}
        className="ocr-supplier-aliases-drawer"
      >
        <div dir={dir}>
          <p className="nx-text-sm nx-text-muted nx-mt-0 nx-mb-12">{t('ocrAliases')}</p>
          <div className="modal-body">
            {(viewing?.aliases || []).length === 0 && (
              <div className="nx-text-muted nx-text-base">{isAr ? 'لا توجد أسماء بديلة بعد' : 'No aliases yet'}</div>
            )}
            <div className="nx-flex-col nx-gap-4">
              {(viewing?.aliases || []).map((a) => (
                <div key={a.id} className="nx-rounded nx-bg-muted nx-text-base nx-py-8 nx-px-12">
                  {a.alias} <span className="nx-text-muted nx-text-xs">({a.language})</span>
                </div>
              ))}
            </div>
            <div className="nx-flex nx-gap-8">
              <Input type="text" value={aliasInput} onChange={(e) => setAliasInput(e.target.value)} placeholder={t('ocrAddAlias')} className="nx-flex-1" />
              <Input type="select" value={aliasLang} onChange={(e) => setAliasLang(e.target.value)}>
                <option value="ar">AR</option>
                <option value="en">EN</option>
              </Input>
              <Button onClick={handleAddAlias} variant="primary">+</Button>
            </div>
          </div>
        </div>
      </Drawer>
    </div>
  );
}
