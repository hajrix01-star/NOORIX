import React, { useState } from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { VAULT_TYPES, PAYMENT_METHODS, TYPE_COLORS, TYPE_BG } from '../constants/treasuryConstants';
import { parseVaultType } from './VaultCard';
import { Button, Input, AdaptiveSheet } from '../../../ui';

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
    <AdaptiveSheet
      open
      onClose={() => !isSaving && onClose()}
      title={isEdit ? t('editVault', initial.nameAr) : t('addNewVault')}
      size="md"
      side="start"
      className="vault-form-drawer"
      closeOnBackdrop={!isSaving}
    >
      <form onSubmit={handleSave} className="nx-grid nx-gap-14">

        {/* الأسماء */}
        <div className="vault-form-names-grid nx-grid-2 nx-gap-12">
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
          <label className="nx-text-base nx-font-600 nx-mb-6" style={{ display: 'block' }}>{t('vaultType')}</label>
          <div className="vault-type-grid nx-grid nx-gap-8" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
            {VAULT_TYPES.map((vt) => (
              <Button
                key={vt.value}
                className="nx-vault-type-btn"
                onClick={() => set('type', vt.value)}
                style={form.type === vt.value ? {
                  border: `2px solid ${TYPE_COLORS[vt.value]}`,
                  background: TYPE_BG[vt.value],
                  color: TYPE_COLORS[vt.value],
                } : undefined}
              >
                <span className="nx-text-xl nx-font-800">{vt.icon}</span>
                <span>{(vt.labelKey ? t(vt.labelKey) : vt.label || '').split('(')[0].trim()}</span>
              </Button>
            ))}

            {/* نوع مخصص */}
            <Button
              className="nx-vault-type-btn"
              onClick={() => set('type', 'custom')}
              style={isCustom ? { border: '2px solid #64748b', background: 'rgba(100,116,139,0.1)', color: 'var(--noorix-text-muted)' } : undefined}
            >
              <span className="nx-font-800" style={{ fontSize: 18 }}>{form.customEmoji || 'خ'}</span>
              <span>{t('vaultTypeCustom') || 'مخصص'}</span>
            </Button>
          </div>

          {/* منتقي رمز مخصص */}
          {isCustom && (
            <div className="nx-bg-muted nx-rounded-lg nx-mt-10 nx-border-all" style={{ padding: 14 }}>
              <div className="nx-text-sm nx-font-700 nx-mb-8 nx-text-muted">
                اختر رمز الخزينة
              </div>
              <div className="nx-flex nx-flex-wrap nx-gap-4">
                {ICON_CHARS.map((ch) => (
                  <Button
                    key={ch}
                    className={`nx-vault-icon-btn${form.customEmoji === ch ? ' nx-vault-icon-btn--active' : ''}`}
                    onClick={() => set('customEmoji', ch)}
                  >
                    {ch}
                  </Button>
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
          <label className="flex items-center gap-10 nx-cursor-pointer" style={{ marginBottom: form.isSalesChannel ? 12 : 0 }}>
            <div
              onClick={() => set('isSalesChannel', !form.isSalesChannel)}
              style={{
                width: 40, height: 22, borderRadius: 999, position: 'relative', cursor: 'pointer', flexShrink: 0,
                background: form.isSalesChannel ? 'var(--noorix-accent-green)' : 'var(--noorix-border)', transition: 'background 200ms',
              }}
            >
              <div style={{
                position: 'absolute', top: 2, width: 18, height: 18, borderRadius: '50%', background: '#fff',
                transition: 'right 200ms, left 200ms',
                ...(form.isSalesChannel ? { right: 2, left: 'auto' } : { left: 2, right: 'auto' }),
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              }} />
            </div>
            <span className="nx-font-700 nx-text-base">{t('enableAsSalesChannel')}</span>
            {form.isSalesChannel && <span className="nx-text-sm nx-font-600 nx-text-income">{t('enabled')}</span>}
          </label>
        </div>

        {/* إظهار كطريقة سداد في المبيعات والمشتريات */}
        <div style={{
          padding: 14, borderRadius: 10,
          border: `1px solid ${form.showAsPaymentMethod ? 'var(--noorix-border)' : '#f59e0b44'}`,
          background: form.showAsPaymentMethod ? 'transparent' : 'rgba(245,158,11,0.06)',
          transition: 'all 150ms',
        }}>
          <label className="flex items-center gap-10 nx-cursor-pointer">
            <div
              onClick={() => setShowAsPaymentMethod(!form.showAsPaymentMethod)}
              style={{
                width: 40, height: 22, borderRadius: 999, position: 'relative', cursor: 'pointer', flexShrink: 0,
                background: form.showAsPaymentMethod ? 'var(--noorix-accent-blue)' : 'var(--noorix-border)', transition: 'background 200ms',
              }}
            >
              <div style={{
                position: 'absolute', top: 2, width: 18, height: 18, borderRadius: '50%', background: '#fff',
                transition: 'right 200ms, left 200ms',
                ...(form.showAsPaymentMethod ? { right: 2, left: 'auto' } : { left: 2, right: 'auto' }),
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              }} />
            </div>
            <span className="nx-font-700 nx-text-base">{t('showAsPaymentMethodLabel')}</span>
            {!form.showAsPaymentMethod && (
              <span className="nx-text-sm nx-font-600" style={{ color: 'var(--noorix-accent-amber)' }}>{t('hiddenFromSalesPurchasesShort')}</span>
            )}
          </label>
          <p className="nx-text-sm nx-text-muted nx-mt-8" style={{ margin: 0, lineHeight: 1.45 }}>
            {t('showAsPaymentMethodHint')}
          </p>
          <div className="nx-mt-12">
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
          <div className="nx-rounded nx-text-base nx-py-8 nx-px-12 nx-text-expense" style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)' }}>
            {saveError}
          </div>
        )}

        <div className="nx-toolbar nx-mt-4">
          <Button type="submit" variant="primary" disabled={isSaving || !form.nameAr.trim()} fullWidth>
            {isSaving ? t('saving') : isEdit ? t('saveChanges') : t('addVaultBtn')}
          </Button>
          <Button type="button" onClick={onClose} disabled={isSaving}>
            {t('cancel')}
          </Button>
        </div>
      </form>
    </AdaptiveSheet>
  );
}
