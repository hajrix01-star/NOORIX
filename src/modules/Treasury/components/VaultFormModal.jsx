import React, { useState } from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { VAULT_TYPES, PAYMENT_METHODS, TYPE_COLORS, TYPE_BG } from '../constants/treasuryConstants';

const EMPTY = { nameAr: '', nameEn: '', type: 'cash', isSalesChannel: false, paymentMethod: '', notes: '' };

const IST = {
  width: '100%', padding: '9px 12px', borderRadius: 8,
  border: '1px solid var(--noorix-border)', fontSize: 13,
  background: 'var(--noorix-bg-surface)', color: 'var(--noorix-text)',
  fontFamily: 'inherit', boxSizing: 'border-box',
};
const LST = { display: 'block', marginBottom: 5, fontSize: 13, fontWeight: 600 };

export default function VaultFormModal({ initial, onClose, onSave, isSaving, saveError }) {
  const { t } = useTranslation();
  const isEdit = !!initial?.id;
  const [form, setForm] = useState(initial ? {
    nameAr:         initial.nameAr         || '',
    nameEn:         initial.nameEn         || '',
    type:           initial.type           || 'cash',
    isSalesChannel: initial.isSalesChannel ?? false,
    paymentMethod:  initial.paymentMethod  || '',
    notes:          initial.notes          || '',
  } : { ...EMPTY });

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <div role="dialog" aria-modal="true"
      style={{ position: 'fixed', inset: 0, background: 'rgba(10,31,68,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000, padding: 16 }}
      onClick={() => !isSaving && onClose()}>
      <div className="noorix-surface-card"
        style={{ width: '100%', maxWidth: 480, maxHeight: '95vh', overflowY: 'auto', borderRadius: 16, padding: 24 }}
        onClick={(e) => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 20px', fontSize: 17, fontWeight: 800 }}>
          {isEdit ? t('editVault', initial.nameAr) : t('addNewVault')}
        </h3>
        <form onSubmit={(e) => { e.preventDefault(); onSave(form); }} style={{ display: 'grid', gap: 14 }}>
          {/* اسم */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><label style={LST}>{t('nameArLabel')}</label><input type="text" value={form.nameAr} onChange={(e) => set('nameAr', e.target.value)} required placeholder={t('vaultNamePlaceholder')} style={IST} /></div>
            <div><label style={LST}>{t('nameEnLabel')}</label><input type="text" value={form.nameEn} onChange={(e) => set('nameEn', e.target.value)} placeholder={t('vaultNameEnPlaceholder')} style={IST} /></div>
          </div>

          {/* النوع */}
          <div>
            <label style={LST}>{t('vaultType')}</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {VAULT_TYPES.map((vt) => (
                <button key={vt.value} type="button" onClick={() => set('type', vt.value)} style={{
                  flex: 1, padding: '8px 6px', borderRadius: 10, cursor: 'pointer', fontSize: 12, fontWeight: 600,
                  border: `2px solid ${form.type === vt.value ? TYPE_COLORS[vt.value] : 'var(--noorix-border)'}`,
                  background: form.type === vt.value ? TYPE_BG[vt.value] : 'transparent',
                  color: form.type === vt.value ? TYPE_COLORS[vt.value] : 'var(--noorix-text-muted)',
                  transition: 'all 150ms',
                }}>
                  <div style={{ fontSize: 18, marginBottom: 2 }}>{vt.icon}</div>
                  <div>{(vt.labelKey ? t(vt.labelKey) : vt.label || '').split('(')[0].trim()}</div>
                </button>
              ))}
            </div>
          </div>

          {/* قناة البيع */}
          <div style={{ padding: 14, borderRadius: 10, border: `1px solid ${form.isSalesChannel ? '#16a34a44' : 'var(--noorix-border)'}`, background: form.isSalesChannel ? 'rgba(22,163,74,0.05)' : 'transparent', transition: 'all 150ms' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: form.isSalesChannel ? 12 : 0 }}>
              <div onClick={() => set('isSalesChannel', !form.isSalesChannel)} style={{ width: 40, height: 22, borderRadius: 999, position: 'relative', cursor: 'pointer', flexShrink: 0, background: form.isSalesChannel ? '#16a34a' : 'var(--noorix-border)', transition: 'background 200ms' }}>
                <div style={{ position: 'absolute', top: 2, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'right 200ms, left 200ms', ...(form.isSalesChannel ? { right: 2, left: 'auto' } : { left: 2, right: 'auto' }), boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
              </div>
              <span style={{ fontWeight: 700, fontSize: 13 }}>{t('enableAsSalesChannel')}</span>
              {form.isSalesChannel && <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 600 }}>{t('enabled')}</span>}
            </label>
            {form.isSalesChannel && (
              <div>
                <label style={{ ...LST, marginBottom: 6 }}>{t('paymentMethod')}</label>
                <select value={form.paymentMethod} onChange={(e) => set('paymentMethod', e.target.value)} style={IST}>
                  <option value="">{t('selectPaymentMethod')}</option>
                  {PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.labelKey ? t(m.labelKey) : m.label}</option>)}
                </select>
              </div>
            )}
          </div>

          {/* ملاحظات */}
          <div>
            <label style={LST}>{t('notes')}</label>
            <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={2} placeholder={t('notesPlaceholderVault')} style={{ ...IST, resize: 'vertical' }} />
          </div>

          {saveError && (
            <div style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)', color: '#dc2626', fontSize: 13 }}>{saveError}</div>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button type="submit" disabled={isSaving || !form.nameAr.trim()} className="noorix-btn-nav noorix-btn-success" style={{ flex: 1 }}>
              {isSaving ? t('saving') : isEdit ? t('saveChanges') : t('addVaultBtn')}
            </button>
            <button type="button" onClick={onClose} className="noorix-btn-nav" disabled={isSaving}>{t('cancel')}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
