import React, { useMemo } from 'react';
import { hasPermission } from '../../../constants/permissions';
import { downloadInvoiceAttachment } from '../../../services/api';
import { Button, DialogActions, Modal, FmtNum } from '../../../ui';
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
  userRole?: string | null;
  userPermissions?: readonly string[] | null;
  onPrint?: (invoice: InvoiceViewSource) => void;
  onEdit?: (invoice: InvoiceViewSource) => void;
  onDelete?: (invoice: InvoiceViewSource) => void;
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

function InvoiceViewInfoTile({ field }: { field: InvoiceViewField }) {
  return (
    <div className="rounded-lg border border-noorix-border bg-white px-3 py-2.5">
      <div className="mb-1 text-[10px] font-bold text-noorix-muted">
        {field.label}
      </div>
      <div className={`text-[13px] font-bold nx-font-numbers ${fieldToneClass(field)}`}>
        {field.value}
      </div>
    </div>
  );
}

export function InvoiceViewModal({
  invoice,
  companyId,
  showToast,
  onClose,
  t,
  lang,
  fmt,
  userRole,
  userPermissions,
  onPrint,
  onEdit,
  onDelete,
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
              invoiceKindHrExpense: t('invoiceKindHrExpense'),
              invoiceKindUnknown: t('invoiceKindUnknown'),
              kindExpense: t('expenseType'),
              kindPurchase: t('categoryTypes'),
              kindSale: t('categoryTypeSale'),
              statusActive: t('statusActive'),
              statusCancelled: t('statusCancelled'),
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
  const isOwner = (userRole || '').toLowerCase() === 'owner';
  const canPrint = !!onPrint && hasPermission(userRole, 'INVOICES_READ', userPermissions);
  const canEdit = !!onEdit && isOwner && invoice.status === 'active' && invoice.kind !== 'sale';
  const canDelete = !!onDelete && isOwner;
  const fieldByLabel = new Map(fields.map((field) => [field.label, field]));
  const totalField = fieldByLabel.get(t('total'));
  const netField = fieldByLabel.get(t('net'));
  const taxField = fieldByLabel.get(t('tax'));
  const statusField = fieldByLabel.get(t('status'));
  const kindField = fieldByLabel.get(t('type'));
  const detailFields = fields.filter(
    (field) =>
      field.label !== t('net') &&
      field.label !== t('tax') &&
      field.label !== t('total') &&
      field.label !== t('status') &&
      field.label !== t('type'),
  );
  const isCancelledInvoice = String(invoice.status || '').toLowerCase() === 'cancelled';
  const statusPillClass = isCancelledInvoice
    ? 'border-[var(--noorix-red-20)] bg-[var(--noorix-red-10)] text-noorix-red'
    : 'border-[var(--noorix-green-10)] bg-[var(--noorix-green-10)] text-noorix-green';

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
      <div className="border-b border-noorix-border bg-white px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="mb-1 text-[11px] font-bold text-noorix-muted">{t('invoicesTitle')}</div>
            <h3 className="m-0 truncate text-[18px] font-extrabold text-noorix-text nx-font-numbers">
              {documentNumber}
            </h3>
          </div>
          <Button variant="ghost" size="sm" className="shrink-0" onClick={onClose}>
            {t('close')}
          </Button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {kindField ? (
            <span className="rounded-full border border-noorix-border bg-noorix-bg-muted px-2.5 py-1 text-[11px] font-bold text-noorix-text">
              {kindField.value}
            </span>
          ) : null}
          {statusField ? (
            <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${statusPillClass}`}>
              {statusField.value}
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col gap-3 p-5">
        <section className="rounded-xl border border-noorix-border bg-noorix-bg-muted/45 p-4">
          <div className="mb-3 text-[11px] font-bold text-noorix-muted">{t('total')}</div>
          <div className="text-[26px] font-extrabold leading-none text-noorix-blue nx-font-numbers">
            {totalField?.value ?? emptyValue}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {netField ? <InvoiceViewInfoTile field={netField} /> : null}
            {taxField ? <InvoiceViewInfoTile field={taxField} /> : null}
          </div>
        </section>

        <section className="grid grid-cols-2 gap-2.5">
          {detailFields.map((field) => (
            <InvoiceViewInfoTile key={field.label} field={field} />
          ))}
        </section>

        {showVaultSplits && (
          <section className="rounded-xl border border-noorix-border bg-white p-3">
            <div className="mb-2 text-[11px] font-bold text-noorix-muted">
              {t('invoiceVaultSplitsDetail')}
            </div>
            <ul className="m-0 flex list-none flex-col gap-0 p-0 overflow-hidden rounded-lg border border-noorix-border">
              {vaultSplits.map((split) => (
                <li key={split.key} className="flex items-center justify-between gap-2 border-b border-noorix-border px-3 py-2 last:border-b-0">
                  <span className="truncate text-[13px] font-bold text-noorix-text">{split.vaultName}</span>
                  <span className="ltr shrink-0 text-[13px] font-extrabold text-noorix-blue">
                    <FmtNum n={split.amount} /> <span className="nx-sar">SR</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {invoice.notes && (
          <section className="rounded-xl border border-noorix-border bg-white px-3 py-2.5">
            <div className="mb-1 text-[11px] font-bold text-noorix-muted">{t('notes')}</div>
            <div className="text-[13px] text-noorix-text">{invoice.notes}</div>
          </section>
        )}

        {showAttachment && (
          <section className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-noorix-border bg-white px-3 py-2.5">
            <div className="min-w-0 flex-1">
              <div className="mb-1 text-[11px] font-bold text-noorix-muted">
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
          </section>
        )}
      </div>
      {(canPrint || canEdit || canDelete) && (
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-noorix-border bg-noorix-bg-muted/60 px-5 py-3">
          <DialogActions
            actions={[
              {
                key: 'print',
                label: t('print'),
                role: 'print',
                hidden: !canPrint,
                onClick: () => onPrint?.(invoice),
              },
              {
                key: 'edit',
                label: t('edit'),
                role: 'edit',
                hidden: !canEdit,
                onClick: () => {
                  onClose();
                  onEdit?.(invoice);
                },
              },
              {
                key: 'delete',
                label: t('delete'),
                role: 'delete',
                hidden: !canDelete,
                onClick: () => {
                  onClose();
                  onDelete?.(invoice);
                },
              },
            ]}
          />
        </div>
      )}
    </Modal>
  );
}
