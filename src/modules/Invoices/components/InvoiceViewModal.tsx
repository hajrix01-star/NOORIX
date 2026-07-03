import React from 'react';
import { formatSaudiDate } from '../../../utils/saudiDate';
import { downloadInvoiceAttachment } from '../../../services/api';
import { Button, Modal, FmtNum } from '../../../ui';

/**
 * نافذة عرض الفاتورة (قراءة فقط) — كانت داخل InvoicesListScreen
 */
export function InvoiceViewModal({ invoice, companyId, showToast, onClose, t, lang, fmt }: any) {
  if (!invoice) return null;
  const fmtDate = (d: any) => (d ? formatSaudiDate(d) : '—');
  const supplierName =
    (lang === 'en'
      ? invoice.supplier?.nameEn || invoice.supplier?.nameAr
      : invoice.supplier?.nameAr || invoice.supplier?.nameEn) || '—';
  const alloc = invoice.vaultAllocations;
  let vaultSummary = '—';
  if (alloc?.length > 1) {
    vaultSummary = t('invoiceVaultMultiple');
  } else if (alloc?.length === 1) {
    const v = alloc[0].vault;
    vaultSummary = (lang === 'en' ? v?.nameEn || v?.nameAr : v?.nameAr || v?.nameEn) || '—';
  } else if (invoice.vault) {
    vaultSummary =
      (lang === 'en'
        ? invoice.vault.nameEn || invoice.vault.nameAr
        : invoice.vault.nameAr || invoice.vault.nameEn) || '—';
  }
  const fields = [
    { label: t('invoiceNumber'), value: invoice.supplierInvoiceNumber || invoice.invoiceNumber || '—' },
    { label: t('date'), value: fmtDate(invoice.transactionDate) },
    { label: t('type'), value: invoice.kind || '—' },
    { label: t('status'), value: invoice.status || '—' },
    { label: t('supplier'), value: supplierName },
    { label: t('invoiceVaultColumn'), value: vaultSummary },
    {
      label: t('net'),
      value: invoice.netAmount != null ? `${fmt(invoice.netAmount)} SR` : '—',
      tone: 'green',
    },
    {
      label: t('tax'),
      value: invoice.taxAmount != null ? `${fmt(invoice.taxAmount)} SR` : '—',
      tone: 'amber',
    },
    {
      label: t('total'),
      value: invoice.totalAmount != null ? `${fmt(invoice.totalAmount)} SR` : '—',
      tone: 'blue',
      bold: true,
    },
  ].filter(Boolean);
  return (
    <Modal open={!!invoice} onClose={onClose} size="sm" hideClose className="nx-modal--flush">
      <div className="flex items-center justify-between py-4 px-5 bg-[linear-gradient(135deg,var(--noorix-accent-blue)_0%,var(--noorix-navy-mid,#1d4ed8)_100%)]">
        <div>
          <div className="text-[11px] mb-[3px] text-white/75">
            {t('invoicesTitle')}
          </div>
          <h3 className="m-0 font-bold text-[17px] text-[var(--noorix-navy-text)]">
            {invoice.supplierInvoiceNumber || invoice.invoiceNumber || '—'}
          </h3>
        </div>
        <Button className="nx-gradient-close-btn" onClick={onClose}>
          {t('close')}
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-2.5 p-5">
        {fields.map(({ label, value, tone, bold }: any) => (
          <div key={label} className="bg-noorix-bg-muted py-[10px] px-3 rounded-[10px] border border-noorix-border">
            <div className="text-noorix-muted mb-1 text-[10px] uppercase tracking-[0.05em]">{label}</div>
            <div
              className={`text-[14px] nx-font-numbers ${bold ? 'font-bold' : 'font-semibold'} ${
                tone === 'green'
                  ? 'text-noorix-green'
                  : tone === 'amber'
                    ? 'text-noorix-amber'
                    : tone === 'blue'
                      ? 'text-noorix-blue'
                      : 'text-noorix-text'
              }`}
            >
              {value}
            </div>
          </div>
        ))}
        {alloc?.length > 1 && (
          <div className="bg-noorix-bg-muted col-span-full py-[10px] px-3 rounded-[10px] border border-noorix-border">
            <div className="text-noorix-muted mb-2 text-[10px] uppercase tracking-[0.05em]">
              {t('invoiceVaultSplitsDetail')}
            </div>
            <ul className="m-0 p-0 list-none flex flex-col gap-1.5">
              {alloc.map((a: any) => {
                const vn = lang === 'en' ? a.vault?.nameEn || a.vault?.nameAr : a.vault?.nameAr || a.vault?.nameEn;
                return (
                  <li key={a.id} className="flex justify-between gap-2 text-[13px] text-noorix-text">
                    <span className="truncate">{vn || '—'}</span>
                    <span className="ltr font-semibold shrink-0">
                      <FmtNum n={a.amount} /> <span className="nx-sar">SR</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        {invoice.notes && (
          <div className="bg-noorix-bg-muted col-span-full py-[10px] px-3 rounded-[10px] border border-noorix-border">
            <div className="text-noorix-muted mb-1 text-[10px] uppercase tracking-[0.05em]">{t('notes')}</div>
            <div className="text-[13px] text-noorix-text">{invoice.notes}</div>
          </div>
        )}
        {invoice.hasInvoiceAttachment && companyId ? (
          <div className="bg-noorix-bg-muted col-span-full py-[10px] px-3 rounded-[10px] border border-noorix-border flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="text-noorix-muted mb-1 text-[10px] uppercase tracking-[0.05em]">
                {t('invoiceReceiptAttachment')}
              </div>
              <div className="text-[13px] text-noorix-text truncate" title={invoice.attachmentOriginalName || ''}>
                {invoice.attachmentOriginalName || '—'}
              </div>
            </div>
            <Button
              size="sm"
              variant="ghost"
              type="button"
              className="shrink-0"
              onClick={async () => {
                try {
                  await downloadInvoiceAttachment(invoice.id, companyId);
                } catch (e: any) {
                  showToast?.(e?.message || t('saveFailed'), 'error');
                }
              }}
            >
              {t('invoiceReceiptDownload')}
            </Button>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
