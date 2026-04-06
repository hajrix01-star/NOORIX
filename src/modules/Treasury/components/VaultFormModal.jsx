import React, { useState } from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { VAULT_TYPES, PAYMENT_METHODS, TYPE_COLORS, TYPE_BG } from '../constants/treasuryConstants';
import { parseVaultType } from './VaultCard';
import { Button, Input, Modal } from '../../../ui';

const ICON_CHARS = ['ن','ب','ح','خ','م','ص','ر','ك','ع','و','س','ت','ا','A','B','C','D','E','F','G','H','$','%','#','@','&'];

const EMPTY = {
  nameAr: '', nameEn: '', type: 'cash', isSalesChannel: false, showAsPaymentMethod: true, paymentMethod: '', notes: '',
};

function initForm(initial) {
  if (!initial) return { ...EMPTY };
  const { isCustom, emoji } = parseVaultType(initial.type || 'cash');
  return {
    nameAr:         initial.nameAr         || '',
    nameEn:         initial.nameEn         || '',
    type:           isCustom ? 'custom' : (initial.type || 'cash'),
    customEmoji:    isCustom ? emoji : 'خ',
    isSalesChannel: initial.isSalesChannel ?? false,
    showAsPaymentMethod: initial.showAsPaymentMethod !== false,
    paymentMethod:  initial.paymentMethod  || '',
    notes:          initial.notes          || '',
  };
}

export default function VaultFormModal({ initial, onClose, onSave, isSaving, saveError }) {
  const { t } = useTranslation();
  const isEdit = !!initial?.id;
  const [form, setForm] = useState(() => initForm(initial));

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const setShowAsPaymentMethod = (enabled) => setForm((p) => ({
    ...p,
    showAsPaymentMethod: enabled,
    paymentMethod: enabled ? p.paymentMethod : '',
  }));

  const handleSave = (e) => {
    e.preventDefault();
    const saved = { ...form };
    if (saved.type === 'custom') {
      saved.type = `custom:${saved.customEmoji || 'خ'}`;
    }
    delete saved.customEmoji;
    onSave(saved);
  };

  const isCustom = form.type === 'custom';

  return (
    <Modal
      open
      onClose={() => !isSaving && onClose()}
      title={isEdit ? t('editVault', initial.nameAr) : t('addNewVault')}
      size="md"
      closeOnBackdrop={!isSaving}
    >
      <form onSubmit={handleSave} style={{ display: 'grid', gap: 14 }}>

        {/* الأسماء */}
        <div className="vault-form-names-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Input
            label={t('nameArLabel')}
            type="text"
            value={form.nameAr}
            onChange={(e) => set('nameAr', e.target.value)}
            required
            placeholder={t('vaultNamePlaceholder')}
          />
          <Input
            label={t('nameEnLabel')}
            type="text"
            value={form.nameEn}
            onChange={(e) => set('nameEn', e.target.value)}
            placeholder={t('vaultNameEnPlaceholder')}
          />
        </div>

        {/* النوع */}
        <div>
          <label style={{ display: 'block', marginBottom: 5, fontSize: 13, fontWeight: 600 }}>{t('vaultType')}</label>
          <div className="vault-type-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            {VAULT_TYPES.map((vt) => (
              <button key={vt.value} type="button" onClick={() => set('type', vt.value)} style={{
                padding: '10px 6px', borderRadius: 10, cursor: 'pointer', fontSize: 12, fontWeight: 600,
                border: `2px solid ${form.type === vt.value ? TYPE_COLORS[vt.value] : 'var(--noorix-border)'}`,
                background: form.type === vt.value ? TYPE_BG[vt.value] : 'transparent',
                color: form.type === vt.value ? TYPE_COLORS[vt.value] : 'var(--noorix-text-muted)',
                transition: 'all 150ms',
              }}>
                <div style={{ fontSize: 16, marginBottom: 4, fontWeight: 800 }}>{vt.icon}</div>
                <div>{(vt.labelKey ? t(vt.labelKey) : vt.label || '').split('(')[0].trim()}</div>
              </button>
            ))}

            {/* نوع مخصص */}
            <button type="button" onClick={() => set('type', 'custom')} style={{
              padding: '10px 6px', borderRadius: 10, cursor: 'pointer', fontSize: 12, fontWeight: 600,
              border: `2px solid ${isCustom ? '#64748b' : 'var(--noorix-border)'}`,
              background: isCustom ? 'rgba(100,116,139,0.1)' : 'transparent',
              color: isCustom ? '#475569' : 'var(--noorix-text-muted)',
              transition: 'all 150ms',
            }}>
              <div style={{ fontSize: 18, marginBottom: 4, fontWeight: 800 }}>{form.customEmoji || 'خ'}</div>
              <div>{t('vaultTypeCustom') || 'مخصص'}</div>
            </button>
          </div>

          {/* منتقي رمز مخصص */}
          {isCustom && (
            <div style={{ marginTop: 10, padding: 14, borderRadius: 12, border: '1px solid var(--noorix-border)', background: 'var(--noorix-bg-muted)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: 'var(--noorix-text-muted)' }}>
                اختر رمز الخزينة
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {ICON_CHARS.map((ch) => (
                  <button
                    key={ch} type="button"
                    onClick={() => set('customEmoji', ch)}
                    style={{
                      width: 38, height: 38, borderRadius: 8, border: 'none', cursor: 'pointer',
                      fontSize: 15, fontWeight: 800,
                      background: form.customEmoji === ch ? '#2563eb18' : 'transparent',
                      outline: form.customEmoji === ch ? '2px solid #2563eb' : '1px solid var(--noorix-border)',
                      color: form.customEmoji === ch ? '#2563eb' : 'var(--noorix-text)',
                      transition: 'all 100ms', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    {ch}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* قناة البيع */}
        <div style={{
          padding: 14, borderRadius: 10,
          border: `1px solid ${form.isSalesChannel ? '#16a34a44' : 'var(--noorix-border)'}`,
          background: form.isSalesChannel ? 'rgba(22,163,74,0.05)' : 'transparent',
          transition: 'all 150ms',
        }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: form.isSalesChannel ? 12 : 0 }}>
            <div
              onClick={() => set('isSalesChannel', !form.isSalesChannel)}
              style={{
                width: 40, height: 22, borderRadius: 999, position: 'relative', cursor: 'pointer', flexShrink: 0,
                background: form.isSalesChannel ? '#16a34a' : 'var(--noorix-border)', transition: 'background 200ms',
              }}
            >
              <div style={{
                position: 'absolute', top: 2, width: 18, height: 18, borderRadius: '50%', background: '#fff',
                transition: 'right 200ms, left 200ms',
                ...(form.isSalesChannel ? { right: 2, left: 'auto' } : { left: 2, right: 'auto' }),
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              }} />
            </div>
            <span style={{ fontWeight: 700, fontSize: 13 }}>{t('enableAsSalesChannel')}</span>
            {form.isSalesChannel && <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 600 }}>{t('enabled')}</span>}
          </label>
        </div>

        {/* إظهار كطريقة سداد في المبيعات والمشتريات */}
        <div style={{
          padding: 14, borderRadius: 10,
          border: `1px solid ${form.showAsPaymentMethod ? 'var(--noorix-border)' : '#f59e0b44'}`,
          background: form.showAsPaymentMethod ? 'transparent' : 'rgba(245,158,11,0.06)',
          transition: 'all 150ms',
        }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: 0 }}>
            <div
              onClick={() => setShowAsPaymentMethod(!form.showAsPaymentMethod)}
              style={{
                width: 40, height: 22, borderRadius: 999, position: 'relative', cursor: 'pointer', flexShrink: 0,
                background: form.showAsPaymentMethod ? '#2563eb' : 'var(--noorix-border)', transition: 'background 200ms',
              }}
            >
              <div style={{
                position: 'absolute', top: 2, width: 18, height: 18, borderRadius: '50%', background: '#fff',
                transition: 'right 200ms, left 200ms',
                ...(form.showAsPaymentMethod ? { right: 2, left: 'auto' } : { left: 2, right: 'auto' }),
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              }} />
            </div>
            <span style={{ fontWeight: 700, fontSize: 13 }}>{t('showAsPaymentMethodLabel')}</span>
            {!form.showAsPaymentMethod && (
              <span style={{ fontSize: 12, color: '#d97706', fontWeight: 600 }}>{t('hiddenFromSalesPurchasesShort')}</span>
            )}
          </label>
          <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--noorix-text-muted)', lineHeight: 1.45 }}>
            {t('showAsPaymentMethodHint')}
          </p>
          <div style={{ marginTop: 12 }}>
            <Input
              type="select"
              label={t('paymentMethod')}
              value={form.paymentMethod}
              onChange={(e) => set('paymentMethod', e.target.value)}
              disabled={!form.showAsPaymentMethod}
            >
              <option value="">{t('selectPaymentMethod')}</option>
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>{m.labelKey ? t(m.labelKey) : m.label}</option>
              ))}
            </Input>
          </div>
        </div>

        {/* ملاحظات */}
        <Input
          multiline
          label={t('notes')}
          value={form.notes}
          onChange={(e) => set('notes', e.target.value)}
          rows={2}
          placeholder={t('notesPlaceholderVault')}
        />

        {saveError && (
          <div style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)', color: '#dc2626', fontSize: 13 }}>
            {saveError}
          </div>
        )}

        <div className="nx-toolbar" style={{ marginTop: 4 }}>
          <Button type="submit" variant="success" disabled={isSaving || !form.nameAr.trim()} fullWidth>
            {isSaving ? t('saving') : isEdit ? t('saveChanges') : t('addVaultBtn')}
          </Button>
          <Button type="button" onClick={onClose} disabled={isSaving}>
            {t('cancel')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
