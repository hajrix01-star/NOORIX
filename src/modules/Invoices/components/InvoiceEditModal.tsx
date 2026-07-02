/**
 * InvoiceEditModal — نافذة تعديل الفاتورة
 */
import React, { useState, useEffect, useMemo } from 'react';
import { useToast } from '../../../context/ToastContext';
import { useTranslation } from '../../../i18n/useTranslation';
import { useApiMutation } from '../../../hooks/useApiMutation';
import { SupplierSelect } from '../../../components/common/SupplierSelect';
import { splitTaxFromTotalAsNumbers } from '@noorix/finance-core';
import { vatRateDecimalFromCompany } from '../../../utils/vatRate';
import { useApp } from '../../../context/AppContext';
import {
  updateInvoice,
  uploadInvoiceAttachment,
  deleteInvoiceAttachment,
  downloadInvoiceAttachment,
  throwIfApiFailed,
} from '../../../services/api';
import { vaultDisplayName } from '../../../utils/vaultDisplay';
import { Button, Checkbox, FileTrigger, Input, AdaptiveSheet } from '../../../ui';
import { SearchableOptionsPicker } from '../../../components/common/SearchableOptionsPicker';
import { toDateInputYmd } from '../../../utils/saudiDate';

// بلا مورد نهائياً (رواتب وسلف — فواتير نظام داخلية)
const NO_SUPPLIER_KINDS = new Set(['salary', 'advance']);
// مورد اختياري (مصاريف ثابتة وHR)
const OPTIONAL_SUPPLIER_KINDS = new Set(['fixed_expense', 'hr_expense']);

export function InvoiceEditModal({ invoice, suppliers, companyId, vaultsList = [], onSaved, onClose }: any) {
  const { t, lang } = useTranslation();
  const { showToast } = useToast();
  const { companies } = useApp();
  const vatRateDecimal = useMemo(
    () => vatRateDecimalFromCompany(companies.find((c: any) => c.id === companyId)),
    [companies, companyId],
  );
  const [form, setForm] = useState({
    supplierId: '',
    supplierInvoiceNumber: '',
    kind: 'purchase',
    totalAmount: '',
    isTaxable: true,
    netAmount: '',
    taxAmount: '',
    transactionDate: '',
    notes: '',
    vaultId: '',
  });
  const [error, setError] = useState('');
  const [attachmentBusy, setAttachmentBusy] = useState(false);
  const [attachMeta, setAttachMeta] = useState({ has: false, name: null });

  const kind = invoice?.kind;
  const hasSupplier = !NO_SUPPLIER_KINDS.has(kind);           // purchase, expense, fixed_expense, hr_expense
  const supplierRequired = !NO_SUPPLIER_KINDS.has(kind) && !OPTIONAL_SUPPLIER_KINDS.has(kind); // purchase, expense فقط

  const initialVaultKey = useMemo(() => {
    if (!invoice) return '';
    const allocs = invoice.vaultAllocations;
    if (allocs?.length >= 1) return allocs[0].vaultId || '';
    return invoice.vaultId || '';
  }, [invoice]);

  const isMultiVault = (invoice?.vaultAllocations?.length || 0) > 1;

  const purchaseKindOptions = useMemo(
    () => [
      { value: 'purchase', label: t('purchaseType') },
      { value: 'expense', label: t('expenseType') },
    ],
    [t],
  );

  const vaultPickerOptions = useMemo(
    () =>
      vaultsList.map((v: any) => ({
        value: v.id,
        label: vaultDisplayName(v, lang) || v.id,
      })),
    [vaultsList, lang],
  );

  const saveMutation = useApiMutation({
    mutationFn: ({ id, body }: any) => updateInvoice(id, body, companyId),
    showErrorToast: false,
    onSuccess: () => {
      onSaved?.();
      onClose?.();
    },
    onError: (e: any) => setError(e?.message || t('saveFailed')),
  });

  useEffect(() => {
    if (!invoice) return;
    const taxable =
      invoice.isTaxable !== undefined
        ? invoice.isTaxable !== false
        : Number(invoice.taxAmount || 0) > 0;
    const total = Number(invoice.totalAmount || 0);
    const { net, tax } = splitTaxFromTotalAsNumbers(total, taxable, vatRateDecimal);
    const resolvedVaultId =
      invoice.vaultAllocations?.length >= 1
        ? invoice.vaultAllocations[0].vaultId
        : invoice.vaultId || '';
    setForm({
      supplierId: invoice.supplierId || '',
      supplierInvoiceNumber: invoice.supplierInvoiceNumber || invoice.invoiceNumber || '',
      kind: invoice.kind || 'purchase',
      totalAmount: total > 0 ? String(total) : '',
      isTaxable: taxable,
      netAmount: net > 0 ? net.toFixed(2) : '',
      taxAmount: tax > 0 ? tax.toFixed(2) : '',
      transactionDate: toDateInputYmd(invoice.transactionDate),
      notes: invoice.notes || '',
      vaultId: resolvedVaultId || '',
    });
  }, [invoice]);

  useEffect(() => {
    if (!invoice) return;
    setAttachMeta({
      has: !!invoice.hasInvoiceAttachment,
      name: invoice.attachmentOriginalName || null,
    });
  }, [invoice]);

  async function handleAttachmentFileChange(e: any) {
    const file = e.target.files?.[0];
    if (!file || !invoice?.id || !companyId) return;
    setAttachmentBusy(true);
    try {
      const res = await uploadInvoiceAttachment(invoice.id, companyId, file);
      throwIfApiFailed(res, t('saveFailed'));
      const inv = res?.data;
      setAttachMeta({
        has: !!inv?.hasInvoiceAttachment,
        name: inv?.attachmentOriginalName || file.name,
      });
      showToast(t('documentUploaded'), 'success');
      onSaved?.();
    } catch (err: any) {
      showToast(err?.message || t('saveFailed'), 'error');
    } finally {
      setAttachmentBusy(false);
      e.target.value = '';
    }
  }

  async function handleRemoveAttachment() {
    if (!invoice?.id || !companyId) return;
    setAttachmentBusy(true);
    try {
      const res = await deleteInvoiceAttachment(invoice.id, companyId);
      throwIfApiFailed(res, t('saveFailed'));
      setAttachMeta({ has: false, name: null });
      showToast(t('invoiceReceiptRemoved'), 'success');
      onSaved?.();
    } catch (err: any) {
      showToast(err?.message || t('saveFailed'), 'error');
    } finally {
      setAttachmentBusy(false);
    }
  }

  async function handleDownloadAttachment() {
    if (!invoice?.id || !companyId) return;
    try {
      await downloadInvoiceAttachment(invoice.id, companyId);
    } catch (err: any) {
      showToast(err?.message || t('saveFailed'), 'error');
    }
  }

  function updateField(field: any, value: any) {
    setForm((p: any) => {
      const next = { ...p, [field]: value };
      if (field === 'totalAmount' || field === 'isTaxable') {
        const v = parseFloat(String(next.totalAmount || ''));
        if (!isNaN(v) && v > 0) {
          const { net, tax } = splitTaxFromTotalAsNumbers(v, next.isTaxable !== false, vatRateDecimal);
          next.netAmount = net.toFixed(2);
          next.taxAmount = tax.toFixed(2);
        } else {
          next.netAmount = '';
          next.taxAmount = '';
        }
      }
      return next;
    });
  }
  async function handleSave() {
    setError('');
    const total = parseFloat(form.totalAmount);
    if (supplierRequired && !form.supplierInvoiceNumber?.trim()) {
      setError(t('invoiceNumberRequired'));
      return;
    }
    if (isNaN(total) || total <= 0) {
      setError(t('totalMustBePositiveShort'));
      return;
    }
    if (vaultsList.length > 0 && !String(form.vaultId || '').trim()) {
      setError(t('selectVault'));
      return;
    }
    const body: Record<string, any> = {
      totalAmount: total,
      transactionDate: form.transactionDate || undefined,
      notes: form.notes?.trim() || undefined,
    };
    if (hasSupplier) {
      body.supplierId = form.supplierId || undefined;
      if (form.supplierInvoiceNumber?.trim()) body.supplierInvoiceNumber = form.supplierInvoiceNumber.trim();
      body.isTaxable = form.isTaxable !== false;
      // النوع قابل للتعديل لـ purchase/expense فقط
      if (supplierRequired) body.kind = form.kind;
    } else {
      body.isTaxable = false;
    }
    if (form.vaultId) {
      if (isMultiVault || form.vaultId !== initialVaultKey) {
        body.vaultId = form.vaultId;
      }
    }
    saveMutation.mutate({ id: invoice.id, body });
  }

  if (!invoice) return null;

  return (
    <AdaptiveSheet
      open={true}
      onClose={onClose}
      title={t('editInvoice')}
      size="md"
      side="start"
      className="invoice-edit-drawer"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button variant="primary" disabled={saveMutation.isPending} onClick={handleSave}>
            {saveMutation.isPending ? t('saving') : t('saveChanges')}
          </Button>
        </>
      }
    >
      <div className="invoice-edit-modal-body flex flex flex-col gap-3.5">
        <p className="text-[12px] text-noorix-muted m-0 mb-1">
          {invoice.supplierInvoiceNumber || invoice.invoiceNumber}
        </p>

        {error && (
          <div className="p-2.5 rounded-lg text-[13px] bg-noorix-bg-muted text-noorix-red">
            {error}
          </div>
        )}

        <div className="rounded-xl border border-noorix-border bg-noorix-surface px-3 py-2.5 flex flex-col gap-2">
          <div className="text-[12px] font-semibold text-noorix-text">{t('invoiceReceiptAttachment')}</div>
          <p className="text-[11px] text-noorix-muted m-0">{t('invoiceReceiptAttachmentHint')}</p>
          {attachMeta.has && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[12px] text-noorix-text truncate max-w-[200px]" title={attachMeta.name || ''}>
                {attachMeta.name || '—'}
              </span>
              <Button type="button" size="sm" variant="ghost" disabled={attachmentBusy} onClick={handleDownloadAttachment}>
                {t('invoiceReceiptDownload')}
              </Button>
              <Button type="button" size="sm" variant="danger" disabled={attachmentBusy} onClick={handleRemoveAttachment}>
                {t('invoiceReceiptRemove')}
              </Button>
            </div>
          )}
          <div>
            <div className="text-[11px] font-semibold text-noorix-muted mb-1">{t('invoiceReceiptChooseFile')}</div>
            <FileTrigger
              disabled={attachmentBusy}
              accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,.pdf,.jpg,.jpeg,.png,.webp"
              onChange={handleAttachmentFileChange}
              label={t('invoiceReceiptChooseFile')}
              buttonProps={{ variant: 'secondary', size: 'sm', disabled: attachmentBusy, className: 'max-w-full' }}
            />
          </div>
          {attachmentBusy && <span className="text-[11px] text-noorix-muted">{t('invoiceReceiptUploading')}</span>}
        </div>

        {hasSupplier && (
          <>
            <div>
              <label className="text-[12px] font-semibold mb-1 block">{t('supplier')}</label>
              <SupplierSelect
                suppliers={suppliers}
                value={form.supplierId}
                onChange={(v: any) => updateField('supplierId', v)}
                bookmarkedIds={[]}
                placeholder={t('selectSupplier')}
              />
            </div>

            <Input
              label={supplierRequired ? `${t('supplierInvoiceNumber')} *` : t('supplierInvoiceNumber')}
              value={form.supplierInvoiceNumber}
              onChange={(e: any) => updateField('supplierInvoiceNumber', e.target.value)}
              placeholder={t('invoiceNumberPlaceholder')}
            />

            {supplierRequired && (
              <SearchableOptionsPicker
                label={t('kind')}
                value={form.kind}
                onChange={(v) => updateField('kind', v)}
                options={purchaseKindOptions}
                aria-label={t('kind')}
              />
            )}
          </>
        )}

        <div>
          <Input
            type="number"
            min="0.01"
            step="0.01"
            label={t('totalAmountInclTax') || 'الإجمالي (شامل الضريبة) *'}
            value={form.totalAmount}
            onChange={(e: any) => updateField('totalAmount', e.target.value)}
            style={{ fontFamily: 'var(--noorix-font-numbers)' }}
          />
          {hasSupplier && form.totalAmount && parseFloat(form.totalAmount) > 0 && (
            <div className="mt-2 grid gap-1.5">
              <label className="nx-checkbox text-[12px] text-noorix-text">
                <Checkbox
                  checked={form.isTaxable !== false}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateField('isTaxable', e.target.checked)}
                />
                {lang === 'en' ? 'Taxable invoice' : 'فاتورة خاضعة للضريبة'}
              </label>
              <div className="text-[12px] text-noorix-muted">
                {t('netShort')}: {form.netAmount} | {t('tax')}: {form.taxAmount}
              </div>
            </div>
          )}
        </div>

        <Input
          type="date"
          label={t('transactionDateLabel')}
          value={form.transactionDate}
          onChange={(e: any) => updateField('transactionDate', e.target.value)}
        />

        {vaultsList.length > 0 && (
          <div>
            <SearchableOptionsPicker
              label={t('invoiceVaultColumn')}
              allowEmpty
              emptyValue=""
              emptyLabel={t('selectVault')}
              value={form.vaultId}
              onChange={(v) => updateField('vaultId', v)}
              options={vaultPickerOptions}
              aria-label={t('invoiceVaultColumn')}
            />
            {isMultiVault && (
              <p className="text-[11px] text-noorix-muted m-0 mt-1">
                {t('invoiceEditVaultMultiHint')}
              </p>
            )}
          </div>
        )}

        <Input
          label={t('notesLabel')}
          value={form.notes}
          onChange={(e: any) => updateField('notes', e.target.value)}
          placeholder={t('invoiceNotesPlaceholder')}
        />
      </div>
    </AdaptiveSheet>
  );
}
