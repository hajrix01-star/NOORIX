import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from '../../../i18n/useTranslation';
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
      <input placeholder={`${t('ocrItemNameAr')} *`} value={form.nameAr} onChange={f('nameAr')} style={inputStyle} />
      <input placeholder={t('ocrItemNameEn')} value={form.nameEn} onChange={f('nameEn')} style={inputStyle} />
      <input placeholder={t('ocrItemCategory')} value={form.category} onChange={f('category')} style={inputStyle} />
      <input placeholder={t('ocrItemUnit')} value={form.unitType} onChange={f('unitType')} style={inputStyle} />
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => onSave(form)} disabled={loading || !form.nameAr} className="noorix-btn noorix-btn--primary" style={{ flex: 1 }}>
          {loading ? '...' : t('ocrSave')}
        </button>
        <button onClick={onCancel} className="noorix-btn" style={{ flex: 1 }}>{t('ocrCancel')}</button>
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
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('ocrSearch')} className="inv-search-input" />
          {search && <button className="inv-search-clear" onClick={() => setSearch('')}>✕</button>}
        </div>

        <button onClick={() => setAdding(true)} className="noorix-btn noorix-btn--primary" style={{ fontSize: 13 }}>+ {t('ocrAddItem')}</button>
        <button onClick={handleFindDuplicates} disabled={dupLoading} className="noorix-btn" style={{ fontSize: 13 }}>
          {isAr ? 'كشف التكرار' : 'Find Duplicates'}
        </button>

        {selected.size > 0 && (
          <button className="inv-delete-btn" onClick={handleBulkDelete} disabled={deleting}>
            {isAr ? `حذف (${selected.size})` : `Delete (${selected.size})`}
          </button>
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
            <button className="modal-close-btn" onClick={() => setDupGroups(null)} style={{ width: 28, height: 28 }}>✕</button>
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
                      <button key={other.id} onClick={() => handleMerge(item.id, other.id)} disabled={!!merging}
                        className="noorix-btn noorix-btn--primary" style={{ fontSize: 11, padding: '4px 10px' }}>
                        {merging === `${item.id}-${other.id}` ? '...' : (isAr ? 'احتفظ بهذا — ادمج الآخر' : 'Keep this — merge other')}
                      </button>
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
                    <button onClick={() => setEditing(item)} className="noorix-btn" style={{ padding: '4px 10px', fontSize: 11 }}>{t('ocrEdit')}</button>
                    <button onClick={() => handleDelete(item.id)} className="noorix-btn" style={{ padding: '4px 10px', fontSize: 11, color: '#b91c1c' }}>{t('ocrDelete')}</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Item detail modal */}
      {viewing && (
        <div role="dialog" aria-modal="true" className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setViewing(null)}>
          <div className="modal-box" dir={dir} style={{ maxWidth: 520 }}>
            <div className="modal-head">
              <div>
                <div className="modal-title">{viewing.nameAr}</div>
                {lowestPrice != null && (
                  <div className="modal-sub" style={{ color: '#15803d', fontWeight: 600 }}>
                    {t('ocrLowestPrice')}: {lowestPrice.toLocaleString('en-US')} {isAr ? 'ريال' : 'SAR'}
                  </div>
                )}
              </div>
              <button className="modal-close-btn" onClick={() => setViewing(null)}>✕</button>
            </div>

            <div className="modal-body">
              {/* Aliases */}
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>{t('ocrAliases')}</div>
              {(viewing.aliases || []).length === 0 && (
                <div style={{ color: 'var(--noorix-text-muted)', fontSize: 13 }}>{isAr ? 'لا توجد مرادفات بعد' : 'No aliases yet'}</div>
              )}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
                {(viewing.aliases || []).map((a) => (
                  <span key={a.id} style={{ padding: '3px 10px', borderRadius: 6, background: 'var(--noorix-bg-muted)', fontSize: 12 }}>
                    {a.alias} <span style={{ color: 'var(--noorix-text-muted)', fontSize: 10 }}>({a.language})</span>
                  </span>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                <input value={aliasInput} onChange={(e) => setAliasInput(e.target.value)} placeholder={t('ocrAddAlias')} className="inv-search-input" style={{ flex: 1 }} />
                <select value={aliasLang} onChange={(e) => setAliasLang(e.target.value)} className="inv-sort-select">
                  <option value="ar">AR</option>
                  <option value="en">EN</option>
                </select>
                <button onClick={handleAddAlias} className="noorix-btn noorix-btn--primary">+</button>
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
        </div>
      )}
    </div>
  );
}
