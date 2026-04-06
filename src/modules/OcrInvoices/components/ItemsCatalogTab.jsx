import React, { useState } from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { Button, Input, Modal } from '../../../ui';
import {
  createOcrItem, updateOcrItem, deleteOcrItem, getItemPriceHistory, addItemAlias,
  findDuplicateItems, mergeOcrItems, bulkDeleteOcrItems,
} from '../services/ocrApi';

function ItemForm({ initial = {}, onSave, onCancel, loading }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({ nameAr: '', nameEn: '', category: '', unitType: '', notes: '', ...initial });
  const f = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));
  const inputStyle = {
    width: '100%', padding: '10px 12px', borderRadius: 10, boxSizing: 'border-box',
    border: '1px solid var(--noorix-border)', background: 'var(--noorix-bg-surface)',
    color: 'var(--noorix-text)', fontSize: 14,
  };
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <Input placeholder={`${t('ocrItemNameAr')} *`} value={form.nameAr} onChange={f('nameAr')} />
      <Input placeholder={t('ocrItemNameEn')} value={form.nameEn} onChange={f('nameEn')} />
      <Input placeholder={t('ocrItemCategory')} value={form.category} onChange={f('category')} />
      <Input placeholder={t('ocrItemUnit')} value={form.unitType} onChange={f('unitType')} />
      <div style={{ display: 'flex', gap: 8 }}>
        <Button onClick={() => onSave(form)} disabled={loading || !form.nameAr} variant="primary" style={{ flex: 1 }}>
          {loading ? '...' : t('ocrSave')}
        </Button>
        <Button onClick={onCancel} style={{ flex: 1 }}>{t('ocrCancel')}</Button>
      </div>
    </div>
  );
}

export default function ItemsCatalogTab({ items = [], loading, onRefresh }) {
  const { t, language } = useTranslation();
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
    const res = await createOcrItem(data);
    setSaving(false);
    if (res.success) { setAdding(false); onRefresh(); }
  };

  const handleUpdate = async (data) => {
    setSaving(true);
    const res = await updateOcrItem(editing.id, data);
    setSaving(false);
    if (res.success) { setEditing(null); onRefresh(); }
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
    const res = await mergeOcrItems(keepId, mergeId);
    setMerging(null);
    if (res.success) {
      onRefresh();
      // تحديث مجموعات التكرار
      handleFindDuplicates();
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
      <div className="inv-toolbar" style={{ marginBottom: 16 }}>
        <label className="inv-select-all-wrap">
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
        <div style={{ padding: 16, marginBottom: 16, borderRadius: 12, border: '1px solid var(--noorix-border)', background: 'var(--noorix-bg-surface)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--noorix-text)' }}>
              {dupGroups.length === 0
                ? (isAr ? 'لا توجد أصناف مكررة — الكتالوج نظيف' : 'No duplicates found')
                : (isAr ? `${dupGroups.length} مجموعة مكررة محتملة` : `${dupGroups.length} potential duplicate groups`)}
            </div>
            <Button className="modal-close-btn" onClick={() => setDupGroups(null)} style={{ width: 28, height: 28 }}>✕</Button>
          </div>
          {dupGroups.map((group, gi) => (
            <div key={gi} style={{ marginBottom: 10, borderRadius: 10, border: '1px solid var(--noorix-border)', overflow: 'hidden' }}>
              <div style={{ background: 'var(--noorix-bg-muted)', padding: '8px 14px', fontSize: 12, color: 'var(--noorix-text-muted)', fontWeight: 600 }}>
                {isAr ? `تشابه ${Math.round(group.score * 100)}%` : `${Math.round(group.score * 100)}% match`}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                {group.items.map((item, ii) => (
                  <div key={item.id} style={{
                    flex: '1 1 200px', padding: '12px 14px',
                    borderInlineEnd: ii < group.items.length - 1 ? '1px solid var(--noorix-border)' : 'none',
                  }}>
                    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>{item.nameAr}</div>
                    {item.nameEn && <div style={{ fontSize: 12, color: 'var(--noorix-text-muted)', marginBottom: 4 }}>{item.nameEn}</div>}
                    <div style={{ fontSize: 11, color: 'var(--noorix-text-muted)', marginBottom: 8 }}>
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
        <div style={{ padding: 20, marginBottom: 16, borderRadius: 12, border: '1px solid var(--noorix-border)', background: 'var(--noorix-bg-surface)' }}>
          <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 14 }}>{t('ocrAddItem')}</div>
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
                <div style={{ padding: 16, borderRadius: 10, border: '1px solid var(--noorix-border)', background: 'var(--noorix-bg-surface)' }}>
                  <ItemForm initial={item} onSave={handleUpdate} onCancel={() => setEditing(null)} loading={saving} />
                </div>
              ) : (
                <div className={`ocr-catalog-item${selected.has(item.id) ? ' ocr-catalog-item--selected' : ''}`} onClick={() => handleViewItem(item)}>
                  <input type="checkbox" checked={selected.has(item.id)}
                    onClick={(e) => { e.stopPropagation(); toggleSelect(item.id); }}
                    onChange={() => {}} className="ocr-catalog-checkbox" />
                  <div className="ocr-catalog-avatar">{(item.nameAr || item.nameEn || '?')[0]}</div>
                  <div className="ocr-catalog-name" style={{ flex: 1 }}>
                    <div className="ocr-catalog-name-primary">{isAr ? item.nameAr : (item.nameEn || item.nameAr)}</div>
                    {item.nameEn && item.nameAr && <div className="ocr-catalog-name-secondary">{isAr ? item.nameEn : item.nameAr}</div>}
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                    {item.category && <span className="ocr-catalog-badge">{item.category}</span>}
                    <span className="ocr-catalog-badge">{item._count?.priceHistory || 0} {isAr ? 'سعر' : 'prices'}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                    <Button onClick={() => setEditing(item)} size="sm">{t('ocrEdit')}</Button>
                    <Button onClick={() => handleDelete(item.id)} size="sm" variant="danger">{t('ocrDelete')}</Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Item detail modal */}
      <Modal open={!!viewing} onClose={() => setViewing(null)} size="md" hideClose>
        <div dir={dir}>
          <div className="modal-head">
            <div>
              <div className="modal-title">{viewing?.nameAr}</div>
              {lowestPrice != null && (
                <div className="modal-sub" style={{ color: '#15803d', fontWeight: 600 }}>
                  {t('ocrLowestPrice')}: {lowestPrice.toLocaleString('en-US')} {isAr ? 'ريال' : 'SAR'}
                </div>
              )}
            </div>
            <Button className="modal-close-btn" onClick={() => setViewing(null)}>✕</Button>
          </div>

          <div className="modal-body">
            {/* Aliases */}
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>{t('ocrAliases')}</div>
            {(viewing?.aliases || []).length === 0 && (
              <div style={{ color: 'var(--noorix-text-muted)', fontSize: 13 }}>{isAr ? 'لا توجد مرادفات بعد' : 'No aliases yet'}</div>
            )}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
              {(viewing?.aliases || []).map((a) => (
                <span key={a.id} style={{ padding: '3px 10px', borderRadius: 6, background: 'var(--noorix-bg-muted)', fontSize: 12 }}>
                  {a.alias} <span style={{ color: 'var(--noorix-text-muted)', fontSize: 10 }}>({a.language})</span>
                </span>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <Input type="text" value={aliasInput} onChange={(e) => setAliasInput(e.target.value)} placeholder={t('ocrAddAlias')} style={{ flex: 1 }} />
              <Input type="select" value={aliasLang} onChange={(e) => setAliasLang(e.target.value)}>
                <option value="ar">AR</option>
                <option value="en">EN</option>
              </Input>
              <Button onClick={handleAddAlias} variant="primary">+</Button>
            </div>

            {/* Price history */}
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>{t('ocrPriceHistory')}</div>
            {historyLoading ? (
              <div className="ocr-loading" style={{ padding: 30 }}>
                <div className="ocr-spinner" />
              </div>
            ) : priceHistory.length === 0 ? (
              <div style={{ color: 'var(--noorix-text-muted)', fontSize: 13 }}>{isAr ? 'لا يوجد تاريخ أسعار بعد' : 'No price history yet'}</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {priceHistory.map((h) => {
                  const isLowest = Number(h.price) === lowestPrice;
                  return (
                    <div key={h.id} style={{
                      padding: '10px 14px', borderRadius: 8,
                      background: isLowest ? 'rgba(22,163,74,0.06)' : 'var(--noorix-bg-muted)',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{h.supplier?.nameAr || '—'}</div>
                        <div style={{ fontSize: 12, color: 'var(--noorix-text-muted)' }}>
                          {new Date(h.invoiceDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                        </div>
                      </div>
                      <div style={{ fontWeight: 700, fontSize: 15, color: isLowest ? '#15803d' : 'var(--noorix-text)' }}>
                        {Number(h.price).toLocaleString('en-US')} {isAr ? 'ريال' : 'SAR'}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
