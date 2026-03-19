/**
 * AddSizeModal — نافذة إضافة حجم مخصص
 */
import React from 'react';
import { useTranslation } from '../../../i18n/useTranslation';

const inputStyle = {
  width: '100%', padding: '9px 12px', borderRadius: 8,
  border: '1px solid var(--noorix-border)', background: 'var(--noorix-bg-surface)',
  color: 'var(--noorix-text)', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box',
};

export function AddSizeModal({ visible, onClose, value, onChange, onAdd }) {
  const { t } = useTranslation();
  if (!visible) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={onClose}>
      <div style={{ background: 'var(--noorix-bg-surface)', borderRadius: 12, padding: 20, minWidth: 280, boxShadow: '0 8px 24px rgba(0,0,0,0.2)' }} onClick={(e) => e.stopPropagation()}>
        <h4 style={{ margin: '0 0 16px', fontSize: 15 }}>+ {t('ordersProductSizes')}</h4>
        <div style={{ display: 'grid', gap: 12, marginBottom: 16 }}>
          <div>
            <label style={{ fontSize: 12, color: 'var(--noorix-text-muted)' }}>{t('productNameAr')} *</label>
            <input type="text" value={value.ar} onChange={(e) => onChange((s) => ({ ...s, ar: e.target.value }))} placeholder="صغير" style={inputStyle} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--noorix-text-muted)' }}>{t('productNameEn')}</label>
            <input type="text" value={value.en} onChange={(e) => onChange((s) => ({ ...s, en: e.target.value }))} placeholder="Small" style={inputStyle} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" className="noorix-btn-nav" onClick={onClose}>{t('cancel')}</button>
          <button type="button" className="noorix-btn-nav noorix-btn-primary" onClick={onAdd}>{t('add')}</button>
        </div>
      </div>
    </div>
  );
}
