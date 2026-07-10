/**
 * نموذج إضافة/تعديل أصل — AdaptiveSheet (لوحة جانبية).
 */
import React, { useState } from 'react';
import { Button, AdaptiveSheet, DateField, DialogActions, TransactionDatePicker, Input } from '../../../ui';
import { SupplierSelect } from '../../../components/common/SupplierSelect';
import { createCompanyAsset, throwIfApiFailed, updateCompanyAsset } from '../../../services/api';
import type { AssetRegisterListItem, SupplierOption } from '../types';
import {
  buildAssetCreatePayload,
  buildAssetUpdatePayload,
  initAssetForm,
  validateAssetForm,
  type AssetFormState,
} from '../assetsRegisterModel';

export type AssetFormPanelProps = {
  companyId: string;
  suppliers: SupplierOption[];
  initial: AssetRegisterListItem | null;
  onClose: () => void;
  onSaved: () => void;
  saving: boolean;
  setSaving: (v: boolean) => void;
  canWrite: boolean;
  t: (k: string) => string;
};

export function AssetFormPanel({
  companyId,
  suppliers,
  initial,
  onClose,
  onSaved,
  saving,
  setSaving,
  canWrite,
  t,
}: AssetFormPanelProps) {
  const isEdit = Boolean(initial?.id);
  const [err, setErr] = useState('');
  const [form, setForm] = useState<AssetFormState>(() => initAssetForm(initial));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canWrite) return;
    setErr('');
    const validationKey = validateAssetForm(form);
    if (validationKey) {
      setErr(t(validationKey));
      return;
    }
    setSaving(true);
    try {
      if (isEdit && initial?.id) {
        const body = buildAssetUpdatePayload(form);
        const res = await updateCompanyAsset(initial.id, companyId, body);
        throwIfApiFailed(res, t('loadingError'));
      } else {
        const body = buildAssetCreatePayload(form, companyId);
        const res = await createCompanyAsset(body);
        throwIfApiFailed(res, t('loadingError'));
      }
      onSaved();
    } catch (e2: unknown) {
      setErr(e2 instanceof Error ? e2.message : t('loadingError'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdaptiveSheet
      open
      onClose={onClose}
      title={isEdit ? t('assetEdit') : t('assetAdd')}
      size="md"
      footer={
        <DialogActions
          actions={[
            { key: 'cancel', label: t('cancel'), role: 'cancel', onClick: onClose },
            ...(canWrite
              ? [{
                  key: 'save',
                  label: saving ? t('loading') : t('save'),
                  role: 'save' as const,
                  type: 'submit' as const,
                  form: 'asset-form',
                  disabled: saving,
                }]
              : []),
          ]}
        />
      }
    >
      <form id="asset-form" onSubmit={submit} className="flex flex-col gap-3">
        {err ? (
          <div className="p-3 rounded-lg text-[13px] bg-noorix-bg-muted border border-noorix-border text-noorix-red">
            {err}
          </div>
        ) : null}
        <Input
          label={t('assetName')}
          value={form.nameAr}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm((p) => ({ ...p, nameAr: e.target.value }))}
          required
        />
        <Input
          label={t('assetNameEn')}
          value={form.nameEn}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm((p) => ({ ...p, nameEn: e.target.value }))}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label={t('assetSerial')}
            value={form.serialNumber}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setForm((p) => ({ ...p, serialNumber: e.target.value }))
            }
            className="ltr"
          />
          <Input
            label={t('assetLocation')}
            value={form.location}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setForm((p) => ({ ...p, location: e.target.value }))
            }
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <TransactionDatePicker
            label={t('assetPurchaseDate')}
            value={form.purchaseDate}
            onValueChange={(value) => setForm((p) => ({ ...p, purchaseDate: value }))}
          />
          <Input
            type="number"
            label={t('assetAcquisitionCost')}
            value={form.acquisitionCost}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setForm((p) => ({ ...p, acquisitionCost: e.target.value }))
            }
            className="ltr"
          />
        </div>
        <div>
          <label className="block text-[12px] text-noorix-muted mb-1">{t('assetSupplier')}</label>
          <SupplierSelect
            suppliers={suppliers}
            value={form.supplierId}
            onChange={(id: string) => setForm((p) => ({ ...p, supplierId: id }))}
            placeholder="—"
          />
        </div>
        <Input
          label={t('assetWarrantyDescription')}
          value={form.warrantyDescription}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setForm((p) => ({ ...p, warrantyDescription: e.target.value }))
          }
        />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Input
            type="number"
            label={t('assetWarrantyMonths')}
            value={form.warrantyMonths}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setForm((p) => ({ ...p, warrantyMonths: e.target.value }))
            }
            className="ltr"
          />
          <DateField
            label={t('assetWarrantyStart')}
            value={form.warrantyStartDate}
            onValueChange={(value) => setForm((p) => ({ ...p, warrantyStartDate: value }))}
          />
          <DateField
            label={t('assetWarrantyEnd')}
            value={form.warrantyEndDate}
            onValueChange={(value) => setForm((p) => ({ ...p, warrantyEndDate: value }))}
          />
        </div>
        <p className="text-[11px] text-noorix-muted m-0">{t('assetWarrantyEndHint')}</p>
        <Input
          label={t('assetNotes')}
          value={form.notes}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setForm((p) => ({ ...p, notes: e.target.value }))
          }
        />
      </form>
    </AdaptiveSheet>
  );
}
