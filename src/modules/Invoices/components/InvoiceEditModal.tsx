import React, { useState, useEffect, useMemo, type ChangeEvent } from 'react';
import { useToast } from '../../../context/ToastContext';
import { useTranslation } from '../../../i18n/useTranslation';
import { useApiMutation } from '../../../hooks/useApiMutation';
import { SupplierSelect, type SupplierOptionRow } from '../../../components/common/SupplierSelect';
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
import { Button, Checkbox, DateField, FileTrigger, Input, AdaptiveSheet, SearchableOptionsPicker } from '../../../ui';

import {
  EMPTY_INVOICE_EDIT_FORM,
  buildInvoiceEditInitialForm,
  buildInvoiceEditUpdateBody,
  getInvoiceEditSupplierPolicy,
  hasPositiveInvoiceEditTotal,
  resolveInvoiceEditInitialVaultId,
  type InvoiceEditForm,
  type InvoiceEditSource,
  type InvoiceEditUpdateBody,
  updateInvoiceEditFormField,
  validateInvoiceEditForm,
} from '../invoiceEditModel';
import { getInvoiceListErrorMessage } from '../invoicesListScreenModel';
import type { InvoiceVaultFilterEntity } from '../invoicesListFilterModel';
import {
  getInvoiceAttachmentMeta,
  normalizeInvoiceAttachmentResponseData,
  type InvoiceAttachmentMeta,
} from '../invoiceAttachmentModel';

type InvoiceEditModalProps = {
  invoice: InvoiceEditSource | null;
  suppliers?: SupplierOptionRow[] | null;
  companyId: string;
  vaultsList?: InvoiceVaultFilterEntity[];
  onSaved?: () => void;
  onClose?: () => void;
};

export function InvoiceEditModal({
  invoice,
  suppliers,
  companyId,
  vaultsList = [],
  onSaved,
  onClose,
}: InvoiceEditModalProps) {
  const { t, lang } = useTranslation();
  const { showToast } = useToast();
  const { companies } = useApp();
  const vatRateDecimal = useMemo(
    () => vatRateDecimalFromCompany(companies.find((company) => company.id === companyId)),
    [companies, companyId],
  );
  const [form, setForm] = useState(EMPTY_INVOICE_EDIT_FORM);
  const [error, setError] = useState('');
  const [attachmentBusy, setAttachmentBusy] = useState(false);
  const [attachMeta, setAttachMeta] = useState<InvoiceAttachmentMeta>({ has: false, name: null });

  const kind = invoice?.kind;
  const { hasSupplier, supplierRequired } = getInvoiceEditSupplierPolicy(kind);

  const initialVaultKey = useMemo(() => resolveInvoiceEditInitialVaultId(invoice), [invoice]);

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
      vaultsList.map((vault) => ({
        value: String(vault.id || ''),
        label: vaultDisplayName(vault, lang) || String(vault.id || ''),
      })),
    [vaultsList, lang],
  );

  const saveMutation = useApiMutation({
    mutationFn: ({ id, body }: { id: string; body: InvoiceEditUpdateBody }) => updateInvoice(id, body, companyId),
    showErrorToast: false,
    onSuccess: () => {
      onSaved?.();
      onClose?.();
    },
    onError: (err: unknown) => setError(getInvoiceListErrorMessage(err, t('saveFailed'))),
  });

  useEffect(() => {
    if (!invoice) return;
    setForm(buildInvoiceEditInitialForm(invoice, vatRateDecimal));
  }, [invoice, vatRateDecimal]);

  useEffect(() => {
    if (!invoice) return;
    setAttachMeta(getInvoiceAttachmentMeta(invoice));
  }, [invoice]);

  async function handleAttachmentFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !invoice?.id || !companyId) return;
    setAttachmentBusy(true);
    try {
      const res = await uploadInvoiceAttachment(invoice.id, companyId, file);
      throwIfApiFailed(res, t('saveFailed'));
      const inv = normalizeInvoiceAttachmentResponseData(res?.data);
      setAttachMeta({
        has: !!inv?.hasInvoiceAttachment,
        name: inv?.attachmentOriginalName || file.name,
      });
      showToast(t('documentUploaded'), 'success');
      onSaved?.();
    } catch (err: unknown) {
      showToast(getInvoiceListErrorMessage(err, t('saveFailed')), 'error');
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
    } catch (err: unknown) {
      showToast(getInvoiceListErrorMessage(err, t('saveFailed')), 'error');
    } finally {
      setAttachmentBusy(false);
    }
  }

  async function handleDownloadAttachment() {
    if (!invoice?.id || !companyId) return;
    try {
      await downloadInvoiceAttachment(invoice.id, companyId);
    } catch (err: unknown) {
      showToast(getInvoiceListErrorMessage(err, t('saveFailed')), 'error');
    }
  }

  function updateField(field: keyof InvoiceEditForm, value: unknown) {
    setForm((previous) => updateInvoiceEditFormField(previous, field, value, vatRateDecimal));
  }
  async function handleSave() {
    if (!invoice?.id) return;
    setError('');
    const validationError = validateInvoiceEditForm({
      form,
      supplierRequired,
      hasVaults: vaultsList.length > 0,
      messages: {
        invoiceNumberRequired: t('invoiceNumberRequired'),
        totalMustBePositiveShort: t('totalMustBePositiveShort'),
        selectVault: t('selectVault'),
      },
    });
    if (validationError) {
      setError(validationError);
      return;
    }
    const body = buildInvoiceEditUpdateBody({
      form,
      hasSupplier,
      supplierRequired,
      isMultiVault,
      initialVaultKey,
    });
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
                suppliers={suppliers || undefined}
                value={form.supplierId}
                onChange={(value: string) => updateField('supplierId', value)}
                bookmarkedIds={[]}
                placeholder={t('selectSupplier')}
              />
            </div>

            <Input
              label={supplierRequired ? `${t('supplierInvoiceNumber')} *` : t('supplierInvoiceNumber')}
              value={form.supplierInvoiceNumber}
              onChange={(event: ChangeEvent<HTMLInputElement>) => updateField('supplierInvoiceNumber', event.target.value)}
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
            onChange={(event: ChangeEvent<HTMLInputElement>) => updateField('totalAmount', event.target.value)}
            className="nx-font-numbers"
          />
          {hasSupplier && hasPositiveInvoiceEditTotal(form.totalAmount) && (
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

        <DateField
          label={t('transactionDateLabel')}
          value={form.transactionDate}
          onValueChange={(value) => updateField('transactionDate', value)}
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
          onChange={(event: ChangeEvent<HTMLInputElement>) => updateField('notes', event.target.value)}
          placeholder={t('invoiceNotesPlaceholder')}
        />
      </div>
    </AdaptiveSheet>
  );
}
