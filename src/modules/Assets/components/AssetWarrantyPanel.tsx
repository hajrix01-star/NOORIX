import React, { useEffect, useMemo, useState } from 'react';
import { Button, AdaptiveSheet, DateField, Input, TransactionDatePicker } from '../../../ui';
import { formatSaudiDate } from '../../../utils/saudiDate';
import { completeCompanyAssetFromInvoice, throwIfApiFailed } from '../../../services/api';
import type { PendingWarrantyInvoiceRow } from '../types';
import {
  assetSupplierDisplayName,
  buildAssetCompletePayload,
  createWarrantyLineRow,
  initAssetFormFromInvoice,
  nextWarrantyLineKey,
  validateAssetForm,
  type AssetFormState,
  type AssetWarrantyLineFormRow,
} from '../assetsRegisterModel';

export type AssetWarrantyPanelProps = {
  companyId: string;
  invoice: PendingWarrantyInvoiceRow;
  onClose: () => void;
  onSaved: () => void;
  saving: boolean;
  setSaving: (v: boolean) => void;
  canWrite: boolean;
  t: (k: string) => string;
  lang: string;
};

export function AssetWarrantyPanel({
  companyId,
  invoice,
  onClose,
  onSaved,
  saving,
  setSaving,
  canWrite,
  t,
  lang,
}: AssetWarrantyPanelProps) {
  const [err, setErr] = useState('');
  const [form, setForm] = useState<AssetFormState>(() => initAssetFormFromInvoice(invoice, lang));
  const [lines, setLines] = useState<AssetWarrantyLineFormRow[]>(() => [
    createWarrantyLineRow(`${invoice.id}-0`),
  ]);

  useEffect(() => {
    if (!invoice.id) return;
    setForm(initAssetFormFromInvoice(invoice, lang));
    setLines([createWarrantyLineRow(`${invoice.id}-0`)]);
    setErr('');
  }, [invoice, lang]);

  const supplierLabel = useMemo(
    () => assetSupplierDisplayName(invoice.supplier, lang),
    [invoice.supplier, lang],
  );

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canWrite || !invoice.id) return;
    setErr('');
    const validationKey = validateAssetForm(form);
    if (validationKey) {
      setErr(t(validationKey));
      return;
    }
    setSaving(true);
    try {
      const body = buildAssetCompletePayload(form, companyId, invoice.id, lines);
      const res = await completeCompanyAssetFromInvoice(body);
      throwIfApiFailed(res, t('loadingError'));
      onSaved();
    } catch (error: unknown) {
      setErr(error instanceof Error ? error.message : t('loadingError'));
    } finally {
      setSaving(false);
    }
  };

  const addLine = () => {
    setLines((prev) => [...prev, createWarrantyLineRow(nextWarrantyLineKey(invoice.id, prev))]);
  };

  const removeLine = (index: number) => {
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((_, rowIndex) => rowIndex !== index)));
  };

  const updateLine = <K extends keyof AssetWarrantyLineFormRow>(
    index: number,
    key: K,
    value: AssetWarrantyLineFormRow[K],
  ) => {
    setLines((prev) => prev.map((row, rowIndex) => (rowIndex === index ? { ...row, [key]: value } : row)));
  };

  const set = <K extends keyof AssetFormState>(key: K, value: AssetFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <AdaptiveSheet
      open
      onClose={onClose}
      title={t('warrantyCompleteSheetTitle')}
      size="lg"
      footer={(
        <>
          <Button onClick={onClose}>{t('cancel')}</Button>
          {canWrite ? (
            <Button variant="primary" type="submit" form="warranty-complete-form" disabled={saving}>
              {saving ? t('loading') : t('save')}
            </Button>
          ) : null}
        </>
      )}
    >
      <form id="warranty-complete-form" onSubmit={submit} className="flex flex-col gap-3">
        <div className="rounded-lg border border-noorix-border bg-noorix-bg-muted px-3 py-2 text-[12px] text-noorix-muted">
          <div className="flex flex-wrap gap-x-4 gap-y-1 justify-between">
            <span>
              {t('warrantyInvoiceRef')}:{' '}
              <span className="font-bold text-noorix-text ltr nx-font-numbers">{String(invoice.invoiceNumber)}</span>
            </span>
            <span className="ltr">{formatSaudiDate(invoice.transactionDate)}</span>
          </div>
          <div className="mt-1 text-[13px] text-noorix-text">{supplierLabel}</div>
        </div>

        {err ? (
          <div className="p-3 rounded-lg text-[13px] bg-noorix-bg-muted border border-noorix-border text-noorix-red">
            {err}
          </div>
        ) : null}

        <Input label={t('assetName')} value={form.nameAr} onChange={(event: React.ChangeEvent<HTMLInputElement>) => set('nameAr', event.target.value)} required />
        <Input label={t('assetNameEn')} value={form.nameEn} onChange={(event: React.ChangeEvent<HTMLInputElement>) => set('nameEn', event.target.value)} />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input label={t('assetSerial')} value={form.serialNumber} onChange={(event: React.ChangeEvent<HTMLInputElement>) => set('serialNumber', event.target.value)} className="ltr" />
          <Input label={t('assetLocation')} value={form.location} onChange={(event: React.ChangeEvent<HTMLInputElement>) => set('location', event.target.value)} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <TransactionDatePicker
            label={t('assetPurchaseDate')}
            value={form.purchaseDate}
            onValueChange={(value) => set('purchaseDate', value)}
          />
          <Input type="number" label={t('assetAcquisitionCost')} value={form.acquisitionCost} onChange={(event: React.ChangeEvent<HTMLInputElement>) => set('acquisitionCost', event.target.value)} className="ltr" />
        </div>

        <Input label={t('assetWarrantyDescription')} value={form.warrantyDescription} onChange={(event: React.ChangeEvent<HTMLInputElement>) => set('warrantyDescription', event.target.value)} />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Input type="number" label={t('assetWarrantyMonths')} value={form.warrantyMonths} onChange={(event: React.ChangeEvent<HTMLInputElement>) => set('warrantyMonths', event.target.value)} className="ltr" />
          <DateField label={t('assetWarrantyStart')} value={form.warrantyStartDate} onValueChange={(value) => set('warrantyStartDate', value)} />
          <DateField label={t('assetWarrantyEnd')} value={form.warrantyEndDate} onValueChange={(value) => set('warrantyEndDate', value)} />
        </div>

        <p className="text-[11px] text-noorix-muted m-0">{t('assetWarrantyEndHint')}</p>
        <Input label={t('assetNotes')} value={form.notes} onChange={(event: React.ChangeEvent<HTMLInputElement>) => set('notes', event.target.value)} />

        <div className="border-t border-noorix-border pt-3 mt-1">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <span className="text-[13px] font-semibold text-noorix-text">{t('warrantyLinesOptionalTitle')}</span>
            <Button type="button" size="sm" variant="ghost" onClick={addLine}>
              + {t('warrantyAddLine')}
            </Button>
          </div>
          <div className="flex flex-col gap-3">
            {lines.map((line, index) => (
              <div key={line.key} className="rounded-lg border border-noorix-border bg-noorix-surface p-3 grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
                <div className="sm:col-span-5">
                  <Input label={t('warrantyLineName')} value={line.nameAr} onChange={(event: React.ChangeEvent<HTMLInputElement>) => updateLine(index, 'nameAr', event.target.value)} />
                </div>
                <div className="sm:col-span-3">
                  <Input label={t('assetNameEn')} value={line.nameEn} onChange={(event: React.ChangeEvent<HTMLInputElement>) => updateLine(index, 'nameEn', event.target.value)} />
                </div>
                <div className="sm:col-span-2">
                  <Input type="number" label={t('warrantyLineQty')} value={line.quantity} onChange={(event: React.ChangeEvent<HTMLInputElement>) => updateLine(index, 'quantity', event.target.value)} className="ltr" min="0" step="0.1" />
                </div>
                <div className="sm:col-span-2 flex justify-end">
                  <Button type="button" size="sm" variant="danger" onClick={() => removeLine(index)} disabled={lines.length <= 1} title={t('delete')}>
                    x
                  </Button>
                </div>
                <div className="sm:col-span-12">
                  <Input label={t('notes')} value={line.notes} onChange={(event: React.ChangeEvent<HTMLInputElement>) => updateLine(index, 'notes', event.target.value)} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </form>
    </AdaptiveSheet>
  );
}
