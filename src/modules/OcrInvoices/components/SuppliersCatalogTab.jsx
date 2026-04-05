import React, { useState } from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import {
  createOcrSupplier, updateOcrSupplier, deleteOcrSupplier, addSupplierAlias,
} from '../services/ocrApi';

function SupplierForm({ initial = {}, onSave, onCancel, loading }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({ nameAr: '', nameEn: '', taxNumber: '', phone: '', notes: '', ...initial });
  const f = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));
  const inputStyle = {
    width: '100%', padding: '10px 12px', borderRadius: 10, boxSizing: 'border-box',
    border: '1px solid var(--noorix-border)', background: 'var(--noorix-bg-surface)',
    color: 'var(--noorix-text)', fontSize: 14,
  };
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <input placeholder={`${t('ocrSupplierNameAr')} *`} value={form.nameAr} onChange={f('nameAr')} style={inputStyle} />
      <input placeholder={t('ocrSupplierNameEn')} value={form.nameEn} onChange={f('nameEn')} style={inputStyle} />
      <input placeholder={t('ocrSupplierTax')} value={form.taxNumber} onChange={f('taxNumber')} style={inputStyle} />
      <input placeholder={t('ocrSupplierPhone')} value={form.phone} onChange={f('phone')} style={inputStyle} />
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => onSave(form)} disabled={loading || !form.nameAr} className="noorix-btn noorix-btn--primary" style={{ flex: 1 }}>
          {loading ? '⏳' : t('ocrSave')}
        </button>
        <button onClick={onCancel} className="noorix-btn" style={{ flex: 1 }}>{t('ocrCancel')}</button>
      </div>
    </div>
  );
}

export default function SuppliersCatalogTab({ suppliers = [], loading, onRefresh }) {
  const { t, language } = useTranslation();
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [viewing, setViewing] = useState(null);
  const [aliasInput, setAliasInput] = useState('');
  const [aliasLang, setAliasLang] = useState('ar');
  const dir = language === 'ar' ? 'rtl' : 'ltr';

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

  return (
    <div dir={dir}>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <input
          value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder={t('ocrSearch')}
          style={{ flex: 1, minWidth: 180, padding: '10px 14px', borderRadius: 10, border: '1px solid var(--noorix-border)', background: 'var(--noorix-bg-surface)', color: 'var(--noorix-text)', fontSize: 14 }}
        />
        <button onClick={() => setAdding(true)} className="noorix-btn noorix-btn--primary">+ {t('ocrAddSupplier')}</button>
      </div>

      {adding && (
        <div className="noorix-surface-card" style={{ padding: 20, marginBottom: 16 }}>
          <div style={{ fontWeight: 700, marginBottom: 12 }}>{t('ocrAddSupplier')}</div>
          <SupplierForm onSave={handleCreate} onCancel={() => setAdding(false)} loading={saving} />
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--noorix-text-muted)' }}>⏳ جاري التحميل...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--noorix-text-muted)' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🏭</div>
          <div>{t('ocrNoSuppliers')}</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {filtered.map((s) => (
            <div key={s.id}>
              {editing?.id === s.id ? (
                <div className="noorix-surface-card" style={{ padding: 20 }}>
                  <SupplierForm initial={s} onSave={handleUpdate} onCancel={() => setEditing(null)} loading={saving} />
                </div>
              ) : (
                <div className="noorix-surface-card" style={{ padding: '14px 18px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                    <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => setViewing(s)}>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>{s.nameAr}</div>
                      {s.nameEn && <div style={{ fontSize: 12, color: 'var(--noorix-text-muted)' }}>{s.nameEn}</div>}
                      <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--noorix-text-muted)', marginTop: 4, flexWrap: 'wrap' }}>
                        {s.taxNumber && <span>🔢 {s.taxNumber}</span>}
                        {s.phone && <span>📞 {s.phone}</span>}
                        <span>📄 {s._count?.invoices || 0} {t('ocrInvoiceCount')}</span>
                        {s.aliases?.length > 0 && <span>🔗 {s.aliases.length} {t('ocrAliases')}</span>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => setEditing(s)} className="noorix-btn" style={{ padding: '6px 12px', fontSize: 12 }}>{t('ocrEdit')}</button>
                      <button onClick={() => handleDelete(s.id)} className="noorix-btn" style={{ padding: '6px 12px', fontSize: 12, color: '#dc2626' }}>{t('ocrDelete')}</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* نافذة الأسماء البديلة */}
      {viewing && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          role="dialog" aria-modal="true"
          onClick={(e) => e.target === e.currentTarget && setViewing(null)}
        >
          <div className="noorix-surface-card" style={{ maxWidth: 480, width: '100%', padding: 24 }} dir={dir}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0 }}>{viewing.nameAr}</h3>
              <button onClick={() => setViewing(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20 }}>✕</button>
            </div>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>{t('ocrAliases')}</div>
            {(viewing.aliases || []).length === 0 && (
              <div style={{ color: 'var(--noorix-text-muted)', fontSize: 13, marginBottom: 12 }}>لا توجد أسماء بديلة بعد.</div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
              {(viewing.aliases || []).map((a) => (
                <div key={a.id} style={{ padding: '6px 12px', borderRadius: 8, background: 'var(--noorix-bg-surface)', border: '1px solid var(--noorix-border)', fontSize: 13 }}>
                  {a.alias} <span style={{ color: 'var(--noorix-text-muted)', fontSize: 11 }}>({a.language})</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
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
          </div>
        </div>
      )}
    </div>
  );
}
