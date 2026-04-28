/**
 * إكمال أصل من فاتورة — لوحة/درج (AdaptiveSheet) لقائمة انتظار الضمان.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Button, AdaptiveSheet, Input } from '../../../ui';
import { assertApiOk } from '../../../utils/apiResponse';
import { getSaudiToday, formatSaudiDate, toYmd } from '../../../utils/saudiDate';
import { completeCompanyAssetFromInvoice } from '../../../services/api';
import type { PendingWarrantyInvoiceRow } from '../types';

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
  const [form, setForm] = useState({
    nameAr: '',
    nameEn: '',
    serialNumber: '',
    location: '',
    purchaseDate: getSaudiToday(),
    acquisitionCost: '',
    warrantyDescription: '',
    warrantyMonths: '',
    warrantyStartDate: '',
    warrantyEndDate: '',
    notes: '',
  });
  const [lines, setLines] = useState([{ key: '0', nameAr: '', nameEn: '', quantity: '', notes: '' }]);

  useEffect(() => {
    if (!invoice?.id) return;
    const tx = toYmd(invoice.transactionDate);
    const sup = invoice.supplier;
    const supName = sup
      ? lang === 'en'
        ? sup.nameEn || sup.nameAr
        : sup.nameAr || sup.nameEn
      : '';
    const ref = invoice.supplierInvoiceNumber || invoice.invoiceNumber || '';
    setForm({
      nameAr: supName && ref ? `${supName} — ${ref}` : supName || ref || '',
      nameEn: '',
      serialNumber: '',
      location: '',
      purchaseDate: tx || getSaudiToday(),
      acquisitionCost: invoice.totalAmount != null ? String(invoice.totalAmount) : '',
      warrantyDescription: '',
      warrantyMonths: '',
      warrantyStartDate: '',
      warrantyEndDate: '',
      notes: invoice.notes?.trim() || '',
    });
    setLines([{ key: `${invoice.id}-0`, nameAr: '', nameEn: '', quantity: '', notes: '' }]);
    setErr('');
  }, [invoice, lang]);

  const supplierLabel = useMemo(() => {
    if (!invoice?.supplier) return '—';
    const sup = invoice.supplier;
    return lang === 'en' ? sup.nameEn || sup.nameAr : sup.nameAr || sup.nameEn;
  }, [invoice, lang]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canWrite || !invoice?.id) return;
    setErr('');
    const nameAr = form.nameAr?.trim();
    if (!nameAr) {
      setErr(t('assetName'));
      return;
    }
    const warrantyLines = lines
      .filter((l) => l.nameAr?.trim())
      .map((l) => ({
        nameAr: l.nameAr.trim(),
        nameEn: l.nameEn?.trim() || undefined,
        quantity:
          l.quantity !== '' && l.quantity != null && !Number.isNaN(Number(l.quantity))
            ? Number(l.quantity)
            : undefined,
        notes: l.notes?.trim() || undefined,
      }));
    const body = {
      companyId,
      invoiceId: invoice.id,
      nameAr,
      nameEn: form.nameEn?.trim() || undefined,
      serialNumber: form.serialNumber?.trim() || undefined,
      location: form.location?.trim() || undefined,
      purchaseDate: form.purchaseDate?.trim() || undefined,
      acquisitionCost:
        form.acquisitionCost !== '' && form.acquisitionCost != null
          ? Number(form.acquisitionCost)
          : undefined,
      warrantyDescription: form.warrantyDescription?.trim() || undefined,
      warrantyMonths:
        form.warrantyMonths !== '' && form.warrantyMonths != null
          ? parseInt(form.warrantyMonths, 10)
          : undefined,
      warrantyStartDate: form.warrantyStartDate?.trim() || undefined,
      warrantyEndDate: form.warrantyEndDate?.trim() || undefined,
      notes: form.notes?.trim() || undefined,
      warrantyLines: warrantyLines.length ? warrantyLines : undefined,
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
      const res = await completeCompanyAssetFromInvoice(body);
      assertApiOk(res, t('loadingError'));
      onSaved();
    } catch (e2: unknown) {
      setErr(e2 instanceof Error ? e2.message : t('loadingError'));
    } finally {
      setSaving(false);
    }
  };

  const addLine = () =>
    setLines((p) => [
      ...p,
      { key: `${Date.now()}-${p.length}`, nameAr: '', nameEn: '', quantity: '', notes: '' },
    ]);
  const removeLine = (i: number) =>
    setLines((p) => (p.length <= 1 ? p : p.filter((_, idx) => idx !== i)));

  return (
    <AdaptiveSheet
      open
      onClose={onClose}
      title={t('warrantyCompleteSheetTitle')}
      size="lg"
      footer={
        <>
          <Button onClick={onClose}>{t('cancel')}</Button>
          {canWrite ? (
            <Button variant="primary" type="submit" form="warranty-complete-form" disabled={saving}>
              {saving ? t('loading') : t('save')}
            </Button>
          ) : null}
        </>
      }
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
        <Input
          label={t('assetName')}
          value={form.nameAr}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setForm((p) => ({ ...p, nameAr: e.target.value }))
          }
          required
        />
        <Input
          label={t('assetNameEn')}
          value={form.nameEn}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setForm((p) => ({ ...p, nameEn: e.target.value }))
          }
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

        <div className="border-t border-noorix-border pt-3 mt-1">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <span className="text-[13px] font-semibold text-noorix-text">{t('warrantyLinesOptionalTitle')}</span>
            <Button type="button" size="sm" variant="ghost" onClick={addLine}>
              + {t('warrantyAddLine')}
            </Button>
          </div>
          <div className="flex flex-col gap-3">
            {lines.map((line, idx) => (
              <div
                key={line.key}
                className="rounded-lg border border-noorix-border bg-noorix-surface p-3 grid grid-cols-1 sm:grid-cols-12 gap-2 items-end"
              >
                <div className="sm:col-span-5">
                  <Input
                    label={t('warrantyLineName')}
                    value={line.nameAr}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setLines((prev) =>
                        prev.map((x, i) => (i === idx ? { ...x, nameAr: e.target.value } : x)),
                      )
                    }
                  />
                </div>
                <div className="sm:col-span-3">
                  <Input
                    label={t('assetNameEn')}
                    value={line.nameEn}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setLines((prev) =>
                        prev.map((x, i) => (i === idx ? { ...x, nameEn: e.target.value } : x)),
                      )
                    }
                  />
                </div>
                <div className="sm:col-span-2">
                  <Input
                    type="number"
                    label={t('warrantyLineQty')}
                    value={line.quantity}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setLines((prev) =>
                        prev.map((x, i) => (i === idx ? { ...x, quantity: e.target.value } : x)),
                      )
                    }
                    className="ltr"
                    min="0"
                    step="0.1"
                  />
                </div>
                <div className="sm:col-span-2 flex justify-end">
                  <Button
                    type="button"
                    size="sm"
                    variant="danger"
                    onClick={() => removeLine(idx)}
                    disabled={lines.length <= 1}
                    title={t('delete')}
                  >
                    ×
                  </Button>
                </div>
                <div className="sm:col-span-12">
                  <Input
                    label={t('notes')}
                    value={line.notes}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setLines((prev) =>
                        prev.map((x, i) => (i === idx ? { ...x, notes: e.target.value } : x)),
                      )
                    }
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </form>
    </AdaptiveSheet>
  );
}
