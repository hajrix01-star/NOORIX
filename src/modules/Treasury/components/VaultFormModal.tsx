import React, { useState } from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { VAULT_TYPES, PAYMENT_METHODS, TYPE_COLORS, TYPE_BG } from '../constants/treasuryConstants';
import { parseVaultType, VAULT_TYPE_SVGS } from './VaultCard';
import { Button, Input, AdaptiveSheet } from '../../../ui';

const ICON_CHARS = ['ن','ب','ح','خ','م','ص','ر','ك','ع','و','س','ت','ا','A','B','C','D','E','F','G','H','$','%','#','@','&'];

const EMPTY = {
  nameAr: '', nameEn: '', type: 'cash', isSalesChannel: false, showAsPaymentMethod: true, paymentMethod: '', notes: '',
};

function sanitizeCustomEmoji(ch: any) {
  if (ch == null || ch === '') return 'خ';
  const s = String(ch);
  if (/^\d$/u.test(s)) return 'خ';
  return s;
}

function initForm(initial: any) {
  if (!initial) return { ...EMPTY };
  const { isCustom, emoji } = parseVaultType(initial.type || 'cash');
  return {
    nameAr:         initial.nameAr         || '',
    nameEn:         initial.nameEn         || '',
    type:           isCustom ? 'custom' : (initial.type || 'cash'),
    customEmoji:    isCustom ? sanitizeCustomEmoji(emoji) : 'خ',
    isSalesChannel: initial.isSalesChannel ?? false,
    showAsPaymentMethod: initial.showAsPaymentMethod !== false,
    paymentMethod:  initial.paymentMethod  || '',
    notes:          initial.notes          || '',
  };
}

export default function VaultFormModal({ initial, onClose, onSave, isSaving, saveError }: any) {
  const { t } = useTranslation();
  const isEdit = !!initial?.id;
  const [form, setForm] = useState(() => initForm(initial));

  const set = (k: any, v: any) => setForm((p: any) => ({ ...p, [k]: v }));
  const setShowAsPaymentMethod = (enabled: any) => setForm((p: any) => ({
    ...p,
    showAsPaymentMethod: enabled,
    paymentMethod: enabled ? p.paymentMethod : '',
  }));

  const handleSave = (e: any) => {
    e.preventDefault();
    const saved = { ...form };
    if (saved.type === 'custom') {
      saved.type = `custom:${sanitizeCustomEmoji(saved.customEmoji)}`;
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
      <form onSubmit={handleSave} className="grid gap-3.5">

        {/* الأسماء */}
        <div className="vault-form-names-grid grid grid-cols-2 gap-3">
          <Input
            label={t('nameArLabel')}
            type="text"
            value={form.nameAr}
            onChange={(e: any) => set('nameAr', e.target.value)}
            required
            placeholder={t('vaultNamePlaceholder')}
          />
          <Input
            label={t('nameEnLabel')}
            type="text"
            value={form.nameEn}
            onChange={(e: any) => set('nameEn', e.target.value)}
            placeholder={t('vaultNameEnPlaceholder')}
          />
        </div>

        {/* النوع */}
        <div>
          <label className="text-[13px] font-semibold mb-1.5 block">{t('vaultType')}</label>
          <div className="grid grid-cols-4 gap-2">
            {VAULT_TYPES.map((vt: any) => (
              <Button
                key={vt.value}
                type="button"
                size="auto"
                className="flex flex-col items-center justify-center gap-1 py-2.5 px-1.5 rounded border-2 border-noorix-border text-[12px] font-semibold text-noorix-muted w-full hover:border-noorix-blue hover:text-noorix-blue transition-colors"
                onClick={() => set('type', vt.value)}
                style={form.type === vt.value ? {
                  border: `2px solid ${(TYPE_COLORS as Record<string, string>)[String(vt.value)]}`,
                  background: (TYPE_BG as Record<string, string>)[String(vt.value)],
                  color: (TYPE_COLORS as Record<string, string>)[String(vt.value)],
                } : undefined}
              >
                <span className="flex h-[22px] w-full items-center justify-center [&_svg]:shrink-0" aria-hidden>
                  {(VAULT_TYPE_SVGS as Record<string, (typeof VAULT_TYPE_SVGS)['bank']>)[String(vt.value)] ?? VAULT_TYPE_SVGS.bank}
                </span>
                <span className="text-center leading-tight">{(vt.labelKey ? t(vt.labelKey) : (vt as { label?: string }).label || '').split('(')[0].split('/')[0].trim()}</span>
              </Button>
            ))}

            {/* نوع مخصص */}
            <Button
              type="button"
              size="auto"
              className="flex flex-col items-center justify-center gap-1 py-2.5 px-1.5 rounded border-2 border-noorix-border text-[12px] font-semibold text-noorix-muted w-full hover:border-noorix-blue hover:text-noorix-blue transition-colors"
              onClick={() => set('type', 'custom')}
              style={isCustom ? { border: '2px solid #64748b', background: 'var(--noorix-bg-muted)', color: 'var(--noorix-text-muted)' } : undefined}
            >
              <span className="flex h-[22px] w-full items-center justify-center font-extrabold text-[18px] leading-none">{sanitizeCustomEmoji(form.customEmoji)}</span>
              <span className="text-center leading-tight">{t('vaultTypeCustom') || 'مخصص'}</span>
            </Button>
          </div>

          {/* منتقي رمز مخصص */}
          {isCustom && (
            <div className="bg-noorix-bg-muted rounded-xl mt-2.5 border border-noorix-border p-[14px]">
              <div className="text-[12px] font-bold mb-2 text-noorix-muted">
                اختر رمز الخزينة
              </div>
              <div className="flex flex flex-wrap gap-1">
                {ICON_CHARS.map((ch: any) => (
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
        <div className={`nx-toggle-panel${form.isSalesChannel ? ' nx-toggle-panel--green' : ''}`}>
          <label className={`flex items-center gap-10 cursor-pointer${form.isSalesChannel ? ' mb-3' : ''}`}>
            <div
              onClick={() => set('isSalesChannel', !form.isSalesChannel)}
              className={`nx-toggle-switch${form.isSalesChannel ? ' nx-toggle-switch--green' : ''}`}
            >
              <div className={`nx-toggle-knob${form.isSalesChannel ? ' nx-toggle-knob--on' : ''}`} />
            </div>
            <span className="font-bold text-[13px]">{t('enableAsSalesChannel')}</span>
            {form.isSalesChannel && <span className="text-[12px] font-semibold text-noorix-green">{t('enabled')}</span>}
          </label>
        </div>

        {/* إظهار كطريقة سداد في المبيعات والمشتريات */}
        <div className={`nx-toggle-panel${form.showAsPaymentMethod ? '' : ' nx-toggle-panel--amber'}`}>
          <label className="flex items-center gap-10 cursor-pointer">
            <div
              onClick={() => setShowAsPaymentMethod(!form.showAsPaymentMethod)}
              className={`nx-toggle-switch${form.showAsPaymentMethod ? ' nx-toggle-switch--blue' : ''}`}
            >
              <div className={`nx-toggle-knob${form.showAsPaymentMethod ? ' nx-toggle-knob--on' : ''}`} />
            </div>
            <span className="font-bold text-[13px]">{t('showAsPaymentMethodLabel')}</span>
            {!form.showAsPaymentMethod && (
              <span className="text-[12px] font-semibold text-noorix-amber">{t('hiddenFromSalesPurchasesShort')}</span>
            )}
          </label>
          <p className="text-[12px] text-noorix-muted mt-2 m-0 leading-[1.45]">
            {t('showAsPaymentMethodHint')}
          </p>
          <div className="mt-3">
            <Input
              type="select"
              label={t('paymentMethod')}
              value={form.paymentMethod}
              onChange={(e: any) => set('paymentMethod', e.target.value)}
              disabled={!form.showAsPaymentMethod}
            >
              <option value="">{t('selectPaymentMethod')}</option>
              {PAYMENT_METHODS.map((m: any) => (
                <option key={m.value} value={m.value}>{m.labelKey ? t(m.labelKey) : (m as { label?: string }).label}</option>
              ))}
            </Input>
          </div>
        </div>

        {/* ملاحظات */}
        <Input
          multiline
          label={t('notes')}
          value={form.notes}
          onChange={(e: any) => set('notes', e.target.value)}
          rows={2}
          placeholder={t('notesPlaceholderVault')}
        />

          {saveError && (
          <div className="rounded-lg text-[13px] py-2 px-3 text-noorix-red bg-noorix-red/10 border border-noorix-red/20">
            {saveError}
          </div>
        )}

        <div className="nx-toolbar mt-1">
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
