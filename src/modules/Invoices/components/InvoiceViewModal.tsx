import React, { useMemo } from 'react';
import { downloadInvoiceAttachment } from '../../../services/api';
import { Button, Modal, FmtNum } from '../../../ui';
import {
  type InvoiceViewField,
  type InvoiceViewLang,
  type InvoiceViewSource,
  buildInvoiceViewFields,
  getInvoiceViewAttachmentName,
  getInvoiceViewDocumentNumber,
  getInvoiceViewEmptyValue,
  getInvoiceViewVaultSplits,
  hasInvoiceViewMultipleVaultSplits,
  shouldShowInvoiceViewAttachment,
} from '../invoiceViewModel';

type ToastVariant = 'success' | 'error' | 'info' | 'warning';
type Translate = (key: string, ...args: unknown[]) => string;

type InvoiceViewModalProps = {
  invoice: InvoiceViewSource | null;
  companyId?: string;
  showToast?: (message: string, variant?: ToastVariant) => void;
  onClose: () => void;
  t: Translate;
  lang: InvoiceViewLang;
  fmt: (value: number) => string;
};

function fieldToneClass(field: InvoiceViewField) {
  if (field.tone === 'green') return 'text-noorix-green';
  if (field.tone === 'amber') return 'text-noorix-amber';
  if (field.tone === 'blue') return 'text-noorix-blue';
  return 'text-noorix-text';
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function InvoiceViewModal({
  invoice,
  companyId,
  showToast,
  onClose,
  t,
  lang,
  fmt,
}: InvoiceViewModalProps) {
  const fields = useMemo(
    () =>
      invoice
        ? buildInvoiceViewFields({
            invoice,
            labels: {
              invoiceNumber: t('invoiceNumber'),
              date: t('date'),
              type: t('type'),
              status: t('status'),
              supplier: t('supplier'),
              invoiceVaultColumn: t('invoiceVaultColumn'),
              net: t('net'),
              tax: t('tax'),
              total: t('total'),
              invoiceVaultMultiple: t('invoiceVaultMultiple'),
            },
            lang,
            fmt,
          })
        : [],
    [invoice, t, lang, fmt],
  );

  if (!invoice) return null;

  const documentNumber = getInvoiceViewDocumentNumber(invoice);
  const vaultSplits = getInvoiceViewVaultSplits(invoice, lang);
  const showVaultSplits = hasInvoiceViewMultipleVaultSplits(invoice);
  const showAttachment = shouldShowInvoiceViewAttachment(invoice, companyId);
  const attachmentName = getInvoiceViewAttachmentName(invoice);
  const emptyValue = getInvoiceViewEmptyValue();

  const handleDownloadAttachment = async () => {
    if (!companyId) return;
    try {
      await downloadInvoiceAttachment(invoice.id, companyId);
    } catch (error: unknown) {
      showToast?.(getErrorMessage(error, t('saveFailed')), 'error');
    }
  };

  return (
    <Modal open={!!invoice} onClose={onClose} size="sm" hideClose className="nx-modal--flush">
      <div className="flex items-center justify-between py-4 px-5 bg-[linear-gradient(135deg,var(--noorix-accent-blue)_0%,var(--noorix-navy-mid,#1d4ed8)_100%)]">
        <div>
          <div className="text-[11px] mb-[3px] text-white/75">{t('invoicesTitle')}</div>
          <h3 className="m-0 font-bold text-[17px] text-[var(--noorix-navy-text)]">{documentNumber}</h3>
        </div>
        <Button className="nx-gradient-close-btn" onClick={onClose}>
          {t('close')}
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-2.5 p-5">
        {fields.map((field) => (
          <div
            key={field.label}
            className="bg-noorix-bg-muted py-[10px] px-3 rounded-[10px] border border-noorix-border"
          >
            <div className="text-noorix-muted mb-1 text-[10px] uppercase tracking-[0.05em]">
              {field.label}
            </div>
            <div
              className={`text-[14px] nx-font-numbers ${
                field.bold ? 'font-bold' : 'font-semibold'
              } ${fieldToneClass(field)}`}
            >
              {field.value}
            </div>
          </div>
        ))}

        {showVaultSplits && (
          <div className="bg-noorix-bg-muted col-span-full py-[10px] px-3 rounded-[10px] border border-noorix-border">
            <div className="text-noorix-muted mb-2 text-[10px] uppercase tracking-[0.05em]">
              {t('invoiceVaultSplitsDetail')}
            </div>
            <ul className="m-0 p-0 list-none flex flex-col gap-1.5">
              {vaultSplits.map((split) => (
                <li key={split.key} className="flex justify-between gap-2 text-[13px] text-noorix-text">
                  <span className="truncate">{split.vaultName}</span>
                  <span className="ltr font-semibold shrink-0">
                    <FmtNum n={split.amount} /> <span className="nx-sar">SR</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {invoice.notes && (
          <div className="bg-noorix-bg-muted col-span-full py-[10px] px-3 rounded-[10px] border border-noorix-border">
            <div className="text-noorix-muted mb-1 text-[10px] uppercase tracking-[0.05em]">{t('notes')}</div>
            <div className="text-[13px] text-noorix-text">{invoice.notes}</div>
          </div>
        )}

        {showAttachment && (
          <div className="bg-noorix-bg-muted col-span-full py-[10px] px-3 rounded-[10px] border border-noorix-border flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="text-noorix-muted mb-1 text-[10px] uppercase tracking-[0.05em]">
                {t('invoiceReceiptAttachment')}
              </div>
              <div
                className="text-[13px] text-noorix-text truncate"
                title={attachmentName === emptyValue ? '' : attachmentName}
              >
                {attachmentName}
              </div>
            </div>
            <Button
              size="sm"
              variant="ghost"
              type="button"
              className="shrink-0"
              onClick={handleDownloadAttachment}
            >
              {t('invoiceReceiptDownload')}
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
