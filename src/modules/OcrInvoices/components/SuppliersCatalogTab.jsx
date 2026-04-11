import React, { useState } from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { Button, Input, AdaptiveSheet } from '../../../ui';
import {
  createOcrSupplier, updateOcrSupplier, deleteOcrSupplier, addSupplierAlias,
  bulkDeleteOcrSuppliers,
} from '../services/ocrApi';
import { assertApiOk } from '../../../utils/apiResponse';

function SupplierForm({ initial = {}, onSave, onCancel, loading }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({ nameAr: '', nameEn: '', taxNumber: '', phone: '', notes: '', ...initial });
  const f = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));
  return (
    <div className="grid gap-3">
      <Input placeholder={`${t('ocrSupplierNameAr')} *`} value={form.nameAr} onChange={f('nameAr')} />
      <Input placeholder={t('ocrSupplierNameEn')} value={form.nameEn} onChange={f('nameEn')} />
      <Input placeholder={t('ocrSupplierTax')} value={form.taxNumber} onChange={f('taxNumber')} />
      <Input placeholder={t('ocrSupplierPhone')} value={form.phone} onChange={f('phone')} />
      <div className="flex gap-2">
        <Button onClick={() => onSave(form)} disabled={loading || !form.nameAr} variant="primary" className="flex-1 min-w-0">
          {loading ? '...' : t('ocrSave')}
        </Button>
        <Button onClick={onCancel} className="flex-1 min-w-0">{t('ocrCancel')}</Button>
      </div>
    </div>
  );
}

export default function SuppliersCatalogTab({ suppliers = [], loading, onRefresh }) {
  const { t, lang: language } = useTranslation();
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
    try {
      const res = await createOcrSupplier(data);
      assertApiOk(res, t('saveFailed'));
      setAdding(false);
      onRefresh();
    } catch (e) {
      alert(e?.message || t('saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (data) => {
    setSaving(true);
    try {
      const res = await updateOcrSupplier(editing.id, data);
      assertApiOk(res, t('saveFailed'));
      setEditing(null);
      onRefresh();
    } catch (e) {
      alert(e?.message || t('saveFailed'));
    } finally {
      setSaving(false);
    }
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
      <div className="inv-toolbar mb-4">
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
        <div className="noorix-surface-card mb-4 p-5">
          <div className="font-semibold mb-3 text-[14px]">{t('ocrAddSupplier')}</div>
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
                <div className="noorix-surface-card p-4">
                  <SupplierForm initial={s} onSave={handleUpdate} onCancel={() => setEditing(null)} loading={saving} />
                </div>
              ) : (
                <div className={`ocr-catalog-item${selected.has(s.id) ? ' ocr-catalog-item--selected' : ''}`}>
                  <label className="nx-checkbox">
                    <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggleSelect(s.id)} className="ocr-catalog-checkbox" onClick={e => e.stopPropagation()} />
                  </label>
                  <div className="ocr-catalog-avatar">{(s.nameAr || s.nameEn || '?')[0]}</div>
                  <div className="ocr-catalog-name cursor-pointer" onClick={() => setViewing(s)}>
                    <div className="ocr-catalog-name-primary">{isAr ? s.nameAr : (s.nameEn || s.nameAr)}</div>
                    {s.nameEn && s.nameAr && <div className="ocr-catalog-name-secondary">{isAr ? s.nameEn : s.nameAr}</div>}
                  </div>
                  <span className="ocr-catalog-badge">{s._count?.invoices || 0} {isAr ? 'فاتورة' : 'inv.'}</span>
                  <div className="flex gap-1">
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
      <AdaptiveSheet
        open={!!viewing}
        onClose={() => setViewing(null)}
        size="md"
        side="start"
        title={viewing?.nameAr || ''}
        className="ocr-supplier-aliases-drawer"
      >
        <div dir={dir}>
          <p className="text-[12px] text-noorix-muted mt-0 mb-3">{t('ocrAliases')}</p>
          <div className="modal-body">
            {(viewing?.aliases || []).length === 0 && (
              <div className="text-noorix-muted text-[13px]">{isAr ? 'لا توجد أسماء بديلة بعد' : 'No aliases yet'}</div>
            )}
            <div className="flex flex-col gap-1">
              {(viewing?.aliases || []).map((a) => (
                <div key={a.id} className="rounded-lg bg-noorix-bg-muted text-[13px] py-2 px-3">
                  {a.alias} <span className="text-noorix-muted text-[11px]">({a.language})</span>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Input type="text" value={aliasInput} onChange={(e) => setAliasInput(e.target.value)} placeholder={t('ocrAddAlias')} className="flex-1 min-w-0" />
              <Input type="select" value={aliasLang} onChange={(e) => setAliasLang(e.target.value)}>
                <option value="ar">AR</option>
                <option value="en">EN</option>
              </Input>
              <Button onClick={handleAddAlias} variant="primary">+</Button>
            </div>
          </div>
        </div>
      </AdaptiveSheet>
    </div>
  );
}
