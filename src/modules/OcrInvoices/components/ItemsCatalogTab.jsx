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
          {loading ? '⏳' : t('ocrSave')}
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

  return (
    <div dir={dir}>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <input
          value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder={t('ocrSearch')}
          style={{ flex: 1, minWidth: 180, padding: '10px 14px', borderRadius: 10, border: '1px solid var(--noorix-border)', background: 'var(--noorix-bg-surface)', color: 'var(--noorix-text)', fontSize: 14 }}
        />
        <button onClick={() => setAdding(true)} className="noorix-btn noorix-btn--primary">+ {t('ocrAddItem')}</button>
        <button
          onClick={handleFindDuplicates}
          disabled={dupLoading}
          className="noorix-btn"
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(245,158,11,0.1)', borderColor: 'rgba(245,158,11,0.4)', color: '#d97706' }}
        >
          {dupLoading ? '⏳' : '🔍'} كشف التكرار
        </button>
        {selected.size > 0 && (
          <button onClick={handleBulkDelete} disabled={deleting}
            style={{ padding: '10px 18px', borderRadius: 10, background: '#dc2626', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13, fontFamily: 'inherit' }}>
            {deleting ? '⏳' : '🗑️'} حذف ({selected.size})
          </button>
        )}
      </div>

      {/* نتائج الأصناف المكررة */}
      {dupGroups !== null && (
        <div className="noorix-surface-card" style={{ padding: 16, marginBottom: 16, border: '1px solid rgba(245,158,11,0.3)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>
              {dupGroups.length === 0
                ? '✅ لا توجد أصناف مكررة — الكتالوج نظيف'
                : `⚠️ ${dupGroups.length} مجموعة أصناف مكررة محتملة`}
            </div>
            <button onClick={() => setDupGroups(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--noorix-text-muted)' }}>✕</button>
          </div>
          {dupGroups.map((group, gi) => (
            <div key={gi} style={{ marginBottom: 14, borderRadius: 10, border: '1px solid rgba(245,158,11,0.25)', overflow: 'hidden' }}>
              <div style={{ background: 'rgba(245,158,11,0.08)', padding: '8px 14px', fontSize: 12, color: '#d97706', fontWeight: 700 }}>
                تشابه {Math.round(group.score * 100)}% — اختر الصنف الأساسي الذي تريد الاحتفاظ به
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 0 }}>
                {group.items.map((item, ii) => (
                  <div key={item.id} style={{
                    flex: '1 1 200px', padding: '12px 14px',
                    borderBottom: '1px solid var(--noorix-border)',
                    borderInlineEnd: ii < group.items.length - 1 ? '1px solid var(--noorix-border)' : 'none',
                    background: 'var(--noorix-bg-surface)',
                  }}>
                    <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{item.nameAr}</div>
                    {item.nameEn && <div style={{ fontSize: 12, color: 'var(--noorix-text-muted)', marginBottom: 4 }}>{item.nameEn}</div>}
                    <div style={{ fontSize: 11, color: 'var(--noorix-text-muted)', marginBottom: 8 }}>
                      {item._count?.priceHistory || 0} سعر • {item._count?.lines || 0} سطر
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {group.items.filter((o) => o.id !== item.id).map((other) => (
                        <button
                          key={other.id}
                          onClick={() => handleMerge(item.id, other.id)}
                          disabled={!!merging}
                          style={{
                            fontSize: 11, padding: '4px 10px', borderRadius: 6, cursor: 'pointer',
                            background: '#16a34a', color: '#fff', border: 'none', fontFamily: 'inherit',
                          }}
                        >
                          {merging === `${item.id}-${other.id}` ? '⏳' : '✅ احتفظ بهذا — ادمج الآخر'}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {adding && (
        <div className="noorix-surface-card" style={{ padding: 20, marginBottom: 16 }}>
          <div style={{ fontWeight: 700, marginBottom: 12 }}>{t('ocrAddItem')}</div>
          <ItemForm onSave={handleCreate} onCancel={() => setAdding(false)} loading={saving} />
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--noorix-text-muted)' }}>⏳ جاري التحميل...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--noorix-text-muted)' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📦</div>
          <div>{t('ocrNoItems')}</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(280px, 100%), 1fr))', gap: 12 }}>
          {filtered.map((item) => (
            <div key={item.id}>
              {editing?.id === item.id ? (
                <div className="noorix-surface-card" style={{ padding: 20 }}>
                  <ItemForm initial={item} onSave={handleUpdate} onCancel={() => setEditing(null)} loading={saving} />
                </div>
              ) : (
                <div
                  className="noorix-surface-card"
                  style={{ padding: 16, cursor: 'pointer', border: selected.has(item.id) ? '1px solid #3b82f6' : undefined, background: selected.has(item.id) ? 'rgba(59,130,246,0.05)' : undefined }}
                  onClick={() => handleViewItem(item)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <input type="checkbox" checked={selected.has(item.id)}
                      onClick={(e) => { e.stopPropagation(); toggleSelect(item.id); }}
                      onChange={() => {}}
                      style={{ width: 15, height: 15, flexShrink: 0, accentColor: '#3b82f6', cursor: 'pointer', marginInlineEnd: 8, marginTop: 2 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>{item.nameAr}</div>
                      {item.nameEn && <div style={{ fontSize: 12, color: 'var(--noorix-text-muted)' }}>{item.nameEn}</div>}
                      <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                        {item.category && (
                          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: 'rgba(59,130,246,0.1)', color: '#3b82f6', fontWeight: 600 }}>
                            {item.category}
                          </span>
                        )}
                        {item.unitType && (
                          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: 'var(--noorix-bg-surface)', border: '1px solid var(--noorix-border)', color: 'var(--noorix-text-muted)' }}>
                            {item.unitType}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--noorix-text-muted)', marginTop: 4, display: 'flex', gap: 8 }}>
                        <span>📊 {item._count?.priceHistory || 0} سعر</span>
                        {item.aliases?.length > 0 && <span>🔗 {item.aliases.length} مرادف</span>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }} onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => setEditing(item)} className="noorix-btn" style={{ padding: '4px 10px', fontSize: 11 }}>{t('ocrEdit')}</button>
                      <button onClick={() => handleDelete(item.id)} className="noorix-btn" style={{ padding: '4px 10px', fontSize: 11, color: '#dc2626' }}>{t('ocrDelete')}</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* نافذة تاريخ الأسعار */}
      {viewing && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          role="dialog" aria-modal="true"
          onClick={(e) => e.target === e.currentTarget && setViewing(null)}
        >
          <div className="noorix-surface-card" style={{ maxWidth: 560, width: '100%', maxHeight: '85vh', overflowY: 'auto', padding: 24 }} dir={dir}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0 }}>{viewing.nameAr}</h3>
                {lowestPrice && (
                  <div style={{ fontSize: 13, color: '#16a34a', fontWeight: 700, marginTop: 4 }}>
                    ✅ {t('ocrLowestPrice')}: {lowestPrice.toLocaleString('en-US')} ريال
                  </div>
                )}
              </div>
              <button onClick={() => setViewing(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20 }}>✕</button>
            </div>

            {/* الأسماء البديلة */}
            <div style={{ fontWeight: 700, marginBottom: 8 }}>{t('ocrAliases')}</div>
            {(viewing.aliases || []).length === 0 && (
              <div style={{ color: 'var(--noorix-text-muted)', fontSize: 13, marginBottom: 8 }}>لا توجد مرادفات بعد.</div>
            )}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
              {(viewing.aliases || []).map((a) => (
                <span key={a.id} style={{ padding: '3px 10px', borderRadius: 8, background: 'var(--noorix-bg-surface)', border: '1px solid var(--noorix-border)', fontSize: 12 }}>
                  {a.alias} <span style={{ color: 'var(--noorix-text-muted)', fontSize: 10 }}>({a.language})</span>
                </span>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              <input
                value={aliasInput} onChange={(e) => setAliasInput(e.target.value)}
                placeholder={t('ocrAddAlias')}
                style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--noorix-border)', background: 'var(--noorix-bg-surface)', color: 'var(--noorix-text)', fontSize: 13 }}
              />
              <select value={aliasLang} onChange={(e) => setAliasLang(e.target.value)} style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--noorix-border)', background: 'var(--noorix-bg-surface)', color: 'var(--noorix-text)' }}>
                <option value="ar">AR</option>
                <option value="en">EN</option>
              </select>
              <button onClick={handleAddAlias} className="noorix-btn noorix-btn--primary">+</button>
            </div>

            {/* تاريخ الأسعار */}
            <div style={{ fontWeight: 700, marginBottom: 10 }}>📈 {t('ocrPriceHistory')}</div>
            {historyLoading ? (
              <div style={{ color: 'var(--noorix-text-muted)', fontSize: 13 }}>⏳ جاري التحميل...</div>
            ) : priceHistory.length === 0 ? (
              <div style={{ color: 'var(--noorix-text-muted)', fontSize: 13 }}>لا يوجد تاريخ أسعار بعد.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {priceHistory.map((h, i) => (
                  <div key={h.id} style={{
                    padding: '10px 14px', borderRadius: 10,
                    background: Number(h.price) === lowestPrice ? 'rgba(22,163,74,0.1)' : 'var(--noorix-bg-surface)',
                    border: `1px solid ${Number(h.price) === lowestPrice ? '#16a34a' : 'var(--noorix-border)'}`,
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{h.supplier?.nameAr || '—'}</div>
                      <div style={{ fontSize: 12, color: 'var(--noorix-text-muted)' }}>
                        {new Date(h.invoiceDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                      </div>
                    </div>
                    <div style={{ fontWeight: 800, fontSize: 16, color: Number(h.price) === lowestPrice ? '#16a34a' : 'var(--noorix-text)' }}>
                      {Number(h.price).toLocaleString('en-US')} ريال
                      {Number(h.price) === lowestPrice && <span style={{ fontSize: 10, marginRight: 4 }}>✅</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
