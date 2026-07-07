import React, { useState } from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { VAULT_TYPES, PAYMENT_METHODS, TYPE_COLORS, TYPE_BG } from '../constants/treasuryConstants';
import { VAULT_TYPE_SVGS } from './VaultCard';
import { Button, Input, AdaptiveSheet } from '../../../ui';
import type { VaultCreatePayload, VaultRecord, VaultType } from '../../../types/api';
import { buildVaultSavePayload, initVaultForm, type VaultFormState } from '../treasuryModels';

type VaultFormModalProps = {
  initial: VaultRecord | null;
  onClose: () => void;
  onSave: (form: VaultCreatePayload) => void;
  isSaving: boolean;
  saveError: string;
};

export default function VaultFormModal({
  initial,
  onClose,
  onSave,
  isSaving,
  saveError,
}: VaultFormModalProps) {
  const { t } = useTranslation();
  const isEdit = !!initial?.id;
  const [form, setForm] = useState<VaultFormState>(() => initVaultForm(initial));

  const set = <K extends keyof VaultFormState>(key: K, value: VaultFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const setShowAsPaymentMethod = (enabled: boolean) => {
    setForm((prev) => ({
      ...prev,
      showAsPaymentMethod: enabled,
      paymentMethod: enabled ? prev.paymentMethod : '',
    }));
  };

  const handleSave = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSave(buildVaultSavePayload(form));
  };

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
        <div className="vault-form-names-grid grid grid-cols-2 gap-3">
          <Input
            label={t('nameArLabel')}
            type="text"
            value={form.nameAr}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => set('nameAr', event.target.value)}
            required
            placeholder={t('vaultNamePlaceholder')}
          />
          <Input
            label={t('nameEnLabel')}
            type="text"
            value={form.nameEn}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => set('nameEn', event.target.value)}
            placeholder={t('vaultNameEnPlaceholder')}
          />
        </div>

        <div>
          <label className="text-[13px] font-semibold mb-1.5 block">{t('vaultType')}</label>
          <div className="grid grid-cols-3 gap-2">
            {VAULT_TYPES.map((vt) => (
              <Button
                key={vt.value}
                type="button"
                size="auto"
                className="flex flex-col items-center justify-center gap-1 py-2.5 px-1.5 rounded border-2 border-noorix-border text-[12px] font-semibold text-noorix-muted w-full hover:border-noorix-blue hover:text-noorix-blue transition-colors"
                onClick={() => set('type', vt.value)}
                style={
                  form.type === vt.value
                    ? {
                        border: `2px solid ${(TYPE_COLORS as Record<VaultType, string>)[vt.value]}`,
                        background: (TYPE_BG as Record<VaultType, string>)[vt.value],
                        color: (TYPE_COLORS as Record<VaultType, string>)[vt.value],
                      }
                    : undefined
                }
              >
                <span className="flex h-[22px] w-full items-center justify-center [&_svg]:shrink-0" aria-hidden>
                  {VAULT_TYPE_SVGS[vt.value] ?? VAULT_TYPE_SVGS.bank}
                </span>
                <span className="text-center leading-tight">{t(vt.labelKey).split('(')[0].split('/')[0].trim()}</span>
              </Button>
            ))}
          </div>
        </div>

        <div className={`nx-toggle-panel${form.isSalesChannel ? ' nx-toggle-panel--green' : ''}`}>
          <label className={`flex items-center gap-10 cursor-pointer${form.isSalesChannel ? ' mb-3' : ''}`}>
            <div
              onClick={() => set('isSalesChannel', !form.isSalesChannel)}
              className={`nx-toggle-switch${form.isSalesChannel ? ' nx-toggle-switch--green' : ''}`}
            >
              <div className={`nx-toggle-knob${form.isSalesChannel ? ' nx-toggle-knob--on' : ''}`} />
            </div>
            <span className="font-bold text-[13px]">{t('enableAsSalesChannel')}</span>
            {form.isSalesChannel ? <span className="text-[12px] font-semibold text-noorix-green">{t('enabled')}</span> : null}
          </label>
        </div>

        <div className={`nx-toggle-panel${form.showAsPaymentMethod ? '' : ' nx-toggle-panel--amber'}`}>
          <label className="flex items-center gap-10 cursor-pointer">
            <div
              onClick={() => setShowAsPaymentMethod(!form.showAsPaymentMethod)}
              className={`nx-toggle-switch${form.showAsPaymentMethod ? ' nx-toggle-switch--blue' : ''}`}
            >
              <div className={`nx-toggle-knob${form.showAsPaymentMethod ? ' nx-toggle-knob--on' : ''}`} />
            </div>
            <span className="font-bold text-[13px]">{t('showAsPaymentMethodLabel')}</span>
            {!form.showAsPaymentMethod ? (
              <span className="text-[12px] font-semibold text-noorix-amber">{t('hiddenFromSalesPurchasesShort')}</span>
            ) : null}
          </label>
          <p className="text-[12px] text-noorix-muted mt-2 m-0 leading-[1.45]">
            {t('showAsPaymentMethodHint')}
          </p>
          <div className="mt-3">
            <Input
              type="select"
              label={t('paymentMethod')}
              value={form.paymentMethod}
              onChange={(event: React.ChangeEvent<HTMLSelectElement>) => set('paymentMethod', event.target.value)}
              disabled={!form.showAsPaymentMethod}
            >
              <option value="">{t('selectPaymentMethod')}</option>
              {PAYMENT_METHODS.map((method) => (
                <option key={method.value} value={method.value}>
                  {t(method.labelKey)}
                </option>
              ))}
            </Input>
          </div>
        </div>

        <Input
          multiline
          label={t('notes')}
          value={form.notes}
          onChange={(event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set('notes', event.target.value)}
          rows={2}
          placeholder={t('notesPlaceholderVault')}
        />

        {saveError ? (
          <div className="rounded-lg text-[13px] py-2 px-3 text-noorix-red bg-noorix-red/10 border border-noorix-red/20">
            {saveError}
          </div>
        ) : null}

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
