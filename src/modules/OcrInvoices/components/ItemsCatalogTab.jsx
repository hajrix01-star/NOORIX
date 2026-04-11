import React, { useState } from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { Button, Input, AdaptiveSheet } from '../../../ui';
import {
  createOcrItem, updateOcrItem, deleteOcrItem, getItemPriceHistory, addItemAlias,
  findDuplicateItems, mergeOcrItems, bulkDeleteOcrItems,
} from '../services/ocrApi';
import { formatSaudiDate } from '../../../utils/saudiDate';
import { assertApiOk } from '../../../utils/apiResponse';

function ItemForm({ initial = {}, onSave, onCancel, loading }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({ nameAr: '', nameEn: '', category: '', unitType: '', notes: '', ...initial });
  const f = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));
  return (
    <div className="grid gap-3">
      <Input placeholder={`${t('ocrItemNameAr')} *`} value={form.nameAr} onChange={f('nameAr')} />
      <Input placeholder={t('ocrItemNameEn')} value={form.nameEn} onChange={f('nameEn')} />
      <Input placeholder={t('ocrItemCategory')} value={form.category} onChange={f('category')} />
      <Input placeholder={t('ocrItemUnit')} value={form.unitType} onChange={f('unitType')} />
      <div className="flex gap-2">
        <Button onClick={() => onSave(form)} disabled={loading || !form.nameAr} variant="primary" className="flex-1 min-w-0">
          {loading ? '...' : t('ocrSave')}
        </Button>
        <Button onClick={onCancel} className="flex-1 min-w-0">{t('ocrCancel')}</Button>
      </div>
    </div>
  );
}

export default function ItemsCatalogTab({ items = [], loading, onRefresh }) {
  const { t, lang: language } = useTranslation();
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [viewing, setViewing] = useState(null);
  const [priceHistory, setPriceHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [aliasInput, setAliasInput] = useState('');
  const [aliasLang, setAliasLang] = useState('ar');

  // Deduplication state
  const [dupGroups, setDupGroups] = useState(null);
  const [dupLoading, setDupLoading] = useState(false);
  const [merging, setMerging] = useState(null);

  // Bulk select
  const [selected, setSelected] = useState(new Set());
  const [deleting, setDeleting] = useState(false);

  const toggleSelect = (id) => setSelected((prev) => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next;
  });

  const handleBulkDelete = async () => {
    if (!selected.size || !window.confirm(`حذف ${selected.size} صنف؟`)) return;
    setDeleting(true);
    await bulkDeleteOcrItems([...selected]);
    setSelected(new Set());
    setDeleting(false);
    onRefresh();
  };

  const dir = language === 'ar' ? 'rtl' : 'ltr';

  const filtered = items.filter((item) => {
    const q = search.toLowerCase();
    return !q || item.nameAr?.toLowerCase().includes(q) || item.nameEn?.toLowerCase().includes(q) || item.category?.toLowerCase().includes(q);
  });

  const handleViewItem = async (item) => {
    setViewing(item);
    setHistoryLoading(true);
    const res = await getItemPriceHistory(item.id);
    setPriceHistory(res.success ? (res.data || []) : []);
    setHistoryLoading(false);
  };

  const handleCreate = async (data) => {
    setSaving(true);
    try {
      const res = await createOcrItem(data);
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
      const res = await updateOcrItem(editing.id, data);
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
    if (!confirm('هل تريد حذف هذا الصنف؟')) return;
    await deleteOcrItem(id);
    onRefresh();
  };

  const handleAddAlias = async () => {
    if (!aliasInput || !viewing) return;
    await addItemAlias(viewing.id, aliasInput, aliasLang);
    setAliasInput('');
    onRefresh();
  };

  const handleFindDuplicates = async () => {
    setDupLoading(true);
    const res = await findDuplicateItems();
    setDupGroups(res.success ? (res.data || []) : []);
    setDupLoading(false);
  };

  const handleMerge = async (keepId, mergeId) => {
    if (!window.confirm('هل تريد دمج هذين الصنفين؟ سيتم الاحتفاظ بالصنف الأول وحذف الثاني.')) return;
    setMerging(`${keepId}-${mergeId}`);
    try {
      const res = await mergeOcrItems(keepId, mergeId);
      assertApiOk(res, t('saveFailed'));
      onRefresh();
      handleFindDuplicates();
    } catch (e) {
      alert(e?.message || t('saveFailed'));
    } finally {
      setMerging(null);
    }
  };

  const lowestPrice = priceHistory.length > 0 ? Math.min(...priceHistory.map((h) => Number(h.price))) : null;

  const isAr = language === 'ar';
  const allChecked = filtered.length > 0 && filtered.every((i) => selected.has(i.id));

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
          <input type="checkbox" checked={allChecked} onChange={allChecked ? () => setSelected(new Set()) : () => setSelected(new Set(filtered.map(i => i.id)))} className="inv-toolbar-checkbox" />
          <span className="inv-select-all-label">
            {selected.size > 0 ? (isAr ? `${selected.size} محدد` : `${selected.size} selected`) : (isAr ? 'تحديد الكل' : 'Select all')}
          </span>
        </label>

        <div className="inv-search-wrap">
          <span className="inv-search-icon">⌕</span>
          <Input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('ocrSearch')} className="inv-search-input" />
          {search && <Button className="inv-search-clear" onClick={() => setSearch('')}>✕</Button>}
        </div>

        <Button onClick={() => setAdding(true)} variant="primary" size="sm">+ {t('ocrAddItem')}</Button>
        <Button onClick={handleFindDuplicates} disabled={dupLoading} size="sm">
          {isAr ? 'كشف التكرار' : 'Find Duplicates'}
        </Button>

        {selected.size > 0 && (
          <Button className="inv-delete-btn" onClick={handleBulkDelete} disabled={deleting}>
            {isAr ? `حذف (${selected.size})` : `Delete (${selected.size})`}
          </Button>
        )}
      </div>

      {/* Duplicate groups */}
      {dupGroups !== null && (
        <div className="noorix-surface-card mb-4 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="font-semibold text-[14px] text-noorix-text">
              {dupGroups.length === 0
                ? (isAr ? 'لا توجد أصناف مكررة — الكتالوج نظيف' : 'No duplicates found')
                : (isAr ? `${dupGroups.length} مجموعة مكررة محتملة` : `${dupGroups.length} potential duplicate groups`)}
            </div>
            <Button className="modal-close-btn w-7 h-7" onClick={() => setDupGroups(null)}>✕</Button>
          </div>
          {dupGroups.map((group, gi) => (
            <div key={gi} className="mb-2.5 rounded-lg border border-noorix-border overflow-hidden">
              <div className="bg-noorix-bg-muted text-[12px] text-noorix-muted font-semibold py-2 px-[14px]">
                {isAr ? `تشابه ${Math.round(group.score * 100)}%` : `${Math.round(group.score * 100)}% match`}
              </div>
              <div className="flex flex flex-wrap">
                {group.items.map((item, ii) => (
                  <div key={item.id} className="py-3 px-[14px] flex-[1_1_200px]" style={{
                    borderInlineEnd: ii < group.items.length - 1 ? '1px solid var(--noorix-border)' : 'none',
                  }}>
                    <div className="font-semibold text-[13px] mb-1">{item.nameAr}</div>
                    {item.nameEn && <div className="text-[12px] text-noorix-muted mb-1">{item.nameEn}</div>}
                    <div className="text-[11px] text-noorix-muted mb-2">
                      {item._count?.priceHistory || 0} {isAr ? 'سعر' : 'prices'} · {item._count?.lines || 0} {isAr ? 'سطر' : 'lines'}
                    </div>
                    {group.items.filter((o) => o.id !== item.id).map((other) => (
                      <Button key={other.id} onClick={() => handleMerge(item.id, other.id)} disabled={!!merging}
                        variant="primary" size="sm">
                        {merging === `${item.id}-${other.id}` ? '...' : (isAr ? 'احتفظ بهذا — ادمج الآخر' : 'Keep this — merge other')}
                      </Button>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {adding && (
        <div className="noorix-surface-card mb-4 p-5">
          <div className="font-semibold mb-3 text-[14px]">{t('ocrAddItem')}</div>
          <ItemForm onSave={handleCreate} onCancel={() => setAdding(false)} loading={saving} />
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="ocr-empty">
          <div className="ocr-empty-icon">—</div>
          <div className="ocr-empty-text">{t('ocrNoItems')}</div>
        </div>
      ) : (
        <div className="ocr-catalog-list">
          {filtered.map((item) => (
            <div key={item.id}>
              {editing?.id === item.id ? (
                <div className="noorix-surface-card p-4">
                  <ItemForm initial={item} onSave={handleUpdate} onCancel={() => setEditing(null)} loading={saving} />
                </div>
              ) : (
                <div className={`ocr-catalog-item${selected.has(item.id) ? ' ocr-catalog-item--selected' : ''}`} onClick={() => handleViewItem(item)}>
                  <label className="nx-checkbox">
                    <input type="checkbox" checked={selected.has(item.id)}
                      onClick={(e) => { e.stopPropagation(); toggleSelect(item.id); }}
                      onChange={() => {}} className="ocr-catalog-checkbox" />
                  </label>
                  <div className="ocr-catalog-avatar">{(item.nameAr || item.nameEn || '?')[0]}</div>
                  <div className="ocr-catalog-name flex-1 min-w-0">
                    <div className="ocr-catalog-name-primary">{isAr ? item.nameAr : (item.nameEn || item.nameAr)}</div>
                    {item.nameEn && item.nameAr && <div className="ocr-catalog-name-secondary">{isAr ? item.nameEn : item.nameAr}</div>}
                  </div>
                  <div className="flex items-center gap-6 shrink-0">
                    {item.category && <span className="ocr-catalog-badge">{item.category}</span>}
                    <span className="ocr-catalog-badge">{item._count?.priceHistory || 0} {isAr ? 'سعر' : 'prices'}</span>
                  </div>
                  <div className="flex gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <Button onClick={() => setEditing(item)} size="sm">{t('ocrEdit')}</Button>
                    <Button onClick={() => handleDelete(item.id)} size="sm" variant="danger">{t('ocrDelete')}</Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Item detail drawer */}
      <AdaptiveSheet
        open={!!viewing}
        onClose={() => setViewing(null)}
        size="lg"
        side="start"
        title={viewing?.nameAr || ''}
        className="ocr-item-detail-drawer"
      >
        <div dir={dir}>
          {lowestPrice != null && (
            <p className="text-[12px] font-semibold mt-0 mb-3" style={{ color: 'var(--noorix-accent-green)' }}>
              {t('ocrLowestPrice')}: {lowestPrice.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 1 })} <span className="nx-sar">SR</span>
            </p>
          )}

          <div className="modal-body">
            {/* Aliases */}
            <div className="font-semibold text-[13px] mb-1.5">{t('ocrAliases')}</div>
            {(viewing?.aliases || []).length === 0 && (
              <div className="text-noorix-muted text-[13px]">{isAr ? 'لا توجد مرادفات بعد' : 'No aliases yet'}</div>
            )}
            <div className="flex flex flex-wrap gap-1 mb-4">
              {(viewing?.aliases || []).map((a) => (
                <span key={a.id} className="rounded-lg bg-noorix-bg-muted text-[12px] py-[3px] px-[10px]">
                  {a.alias} <span className="text-noorix-muted text-[10px]">({a.language})</span>
                </span>
              ))}
            </div>
            <div className="flex gap-2 mb-4">
              <Input type="text" value={aliasInput} onChange={(e) => setAliasInput(e.target.value)} placeholder={t('ocrAddAlias')} className="flex-1 min-w-0" />
              <Input type="select" value={aliasLang} onChange={(e) => setAliasLang(e.target.value)}>
                <option value="ar">AR</option>
                <option value="en">EN</option>
              </Input>
              <Button onClick={handleAddAlias} variant="primary">+</Button>
            </div>

            {/* Price history */}
            <div className="font-semibold text-[13px] mb-2">{t('ocrPriceHistory')}</div>
            {historyLoading ? (
              <div className="ocr-loading p-[30px]">
                <div className="ocr-spinner" />
              </div>
            ) : priceHistory.length === 0 ? (
              <div className="text-noorix-muted text-[13px]">{isAr ? 'لا يوجد تاريخ أسعار بعد' : 'No price history yet'}</div>
            ) : (
              <div className="flex flex-col gap-1">
                {priceHistory.map((h) => {
                  const isLowest = Number(h.price) === lowestPrice;
                  return (
                    <div key={h.id} className="flex items-center justify-between rounded-lg py-[10px] px-[14px]" style={{ background: isLowest ? 'var(--noorix-green-6)' : 'var(--noorix-bg-muted)' }}>
                      <div>
                        <div className="font-semibold text-[13px]">{h.supplier?.nameAr || '—'}</div>
                        <div className="text-[12px] text-noorix-muted">
                          {formatSaudiDate(h.invoiceDate)}
                        </div>
                      </div>
                      <div className="font-bold text-[15px]" style={{ color: isLowest ? 'var(--noorix-accent-green)' : 'var(--noorix-text)' }}>
                        {Number(h.price).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 1 })} <span className="nx-sar">SR</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </AdaptiveSheet>
    </div>
  );
}
