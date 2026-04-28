/**
 * نموذج إضافة/تعديل أصل — AdaptiveSheet (لوحة جانبية).
 */
import React, { useState } from 'react';
import { Button, AdaptiveSheet, Input } from '../../../ui';
import { SupplierSelect } from '../../../components/common/SupplierSelect';
import { assertApiOk } from '../../../utils/apiResponse';
import { getSaudiToday, toYmd } from '../../../utils/saudiDate';
import { createCompanyAsset, updateCompanyAsset } from '../../../services/api';
import type { AssetRegisterListItem, SupplierOption } from '../types';

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
  const [form, setForm] = useState(() => ({
    nameAr: initial?.nameAr ?? '',
    nameEn: initial?.nameEn ?? '',
    serialNumber: initial?.serialNumber ?? '',
    location: initial?.location ?? '',
    purchaseDate: initial?.purchaseDate ? toYmd(initial.purchaseDate) : getSaudiToday(),
    acquisitionCost: initial?.acquisitionCost != null ? String(initial.acquisitionCost) : '',
    supplierId: initial?.supplier?.id ?? '',
    warrantyDescription: initial?.warrantyDescription ?? '',
    warrantyMonths: initial?.warrantyMonths != null ? String(initial.warrantyMonths) : '',
    warrantyStartDate: initial?.warrantyStartDate ? toYmd(initial.warrantyStartDate) : '',
    warrantyEndDate: initial?.warrantyEndDate ? toYmd(initial.warrantyEndDate) : '',
    notes: initial?.notes ?? '',
  }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canWrite) return;
    setErr('');
    const nameAr = form.nameAr?.trim();
    if (!nameAr) {
      setErr(t('assetName'));
      return;
    }
    const body = {
      companyId,
      nameAr,
      nameEn: form.nameEn?.trim() || undefined,
      serialNumber: form.serialNumber?.trim() || undefined,
      location: form.location?.trim() || undefined,
      purchaseDate: form.purchaseDate?.trim() || undefined,
      acquisitionCost:
        form.acquisitionCost !== '' && form.acquisitionCost != null
          ? Number(form.acquisitionCost)
          : undefined,
      supplierId: form.supplierId || undefined,
      warrantyDescription: form.warrantyDescription?.trim() || undefined,
      warrantyMonths:
        form.warrantyMonths !== '' && form.warrantyMonths != null
          ? parseInt(form.warrantyMonths, 10)
          : undefined,
      warrantyStartDate: form.warrantyStartDate?.trim() || undefined,
      warrantyEndDate: form.warrantyEndDate?.trim() || undefined,
      notes: form.notes?.trim() || undefined,
    };
    if (body.acquisitionCost != null && (Number.isNaN(body.acquisitionCost) || body.acquisitionCost < 0)) {
      setErr(t('validationInvalidAmount'));
      return;
    }
    if (body.warrantyMonths != null && (Number.isNaN(body.warrantyMonths) || body.warrantyMonths < 0)) {
      setErr(t('validationInvalidAmount'));
      return;
    }
    setSaving(true);
    try {
      if (isEdit && initial?.id) {
        const res = await updateCompanyAsset(initial.id, companyId, body);
        assertApiOk(res, t('loadingError'));
      } else {
        const res = await createCompanyAsset(body);
        assertApiOk(res, t('loadingError'));
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
        <>
          <Button onClick={onClose}>{t('cancel')}</Button>
          {canWrite ? (
            <Button variant="primary" type="submit" form="asset-form" disabled={saving}>
              {saving ? t('loading') : t('save')}
            </Button>
          ) : null}
        </>
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
          <Input
            type="date"
            label={t('assetPurchaseDate')}
            value={form.purchaseDate}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setForm((p) => ({ ...p, purchaseDate: e.target.value }))
            }
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
          <Input
            type="date"
            label={t('assetWarrantyStart')}
            value={form.warrantyStartDate}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setForm((p) => ({ ...p, warrantyStartDate: e.target.value }))
            }
          />
          <Input
            type="date"
            label={t('assetWarrantyEnd')}
            value={form.warrantyEndDate}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setForm((p) => ({ ...p, warrantyEndDate: e.target.value }))
            }
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
