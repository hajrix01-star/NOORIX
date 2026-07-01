import React, { useCallback, useMemo, useState } from 'react';
import { Badge, Button, FmtNum, Modal, SmartTable } from '../../../ui';
import { useInvoices } from '../../../hooks/useInvoices';
import { fetchAllInvoicesForExport } from '../../../services/api';
import { useTranslation } from '../../../i18n/useTranslation';
import { fmt } from '../../../utils/format';
import { formatSaudiDateISO, getSaudiToday } from '../../../utils/saudiDate';
import { openPrintWindow } from '../../../utils/printUtils';

const PAGE_SIZE = 10;

function esc(v: any) {
  return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function supplierName(supplier: any, lang: string) {
  return (lang === 'en' ? supplier?.nameEn || supplier?.nameAr : supplier?.nameAr || supplier?.nameEn) || '-';
}

function categoryName(category: any, lang: string) {
  return category ? (lang === 'en' ? category.nameEn || category.nameAr : category.nameAr || category.nameEn) : '-';
}

function buildInvoicesTableHtml(invoices: any[], t: (key: string, ...args: any[]) => string) {
  const rows = invoices
    .map((inv: any) => `<tr>
      <td>${esc(inv.supplierInvoiceNumber || inv.invoiceNumber || '-')}</td>
      <td>${esc(inv.invoiceNumber || '-')}</td>
      <td>${esc(inv.kind || '-')}</td>
      <td>${esc(inv.transactionDate ? formatSaudiDateISO(inv.transactionDate) : '-')}</td>
      <td>${esc(fmt(Number(inv.netAmount || 0)))} SR</td>
      <td>${esc(fmt(Number(inv.taxAmount || 0)))} SR</td>
      <td>${esc(fmt(Number(inv.totalAmount || 0)))} SR</td>
    </tr>`)
    .join('');
  return `<table>
    <thead>
      <tr>
        <th>${esc(t('supplierInvoiceNumber'))}</th>
        <th>${esc(t('documentNumber'))}</th>
        <th>${esc(t('type'))}</th>
        <th>${esc(t('date'))}</th>
        <th>${esc(t('net'))}</th>
        <th>${esc(t('tax'))}</th>
        <th>${esc(t('total'))}</th>
      </tr>
    </thead>
    <tbody>${rows || `<tr><td colspan="7">${esc(t('noInvoicesInPeriod'))}</td></tr>`}</tbody>
  </table>`;
}

export type SupplierProfileModalProps = {
  open: boolean;
  supplier: any;
  companyId: string;
  flatCategories?: any[];
  onClose: () => void;
};

export function SupplierProfileModal({
  open,
  supplier,
  companyId,
  flatCategories = [],
  onClose,
}: SupplierProfileModalProps) {
  const { t, lang } = useTranslation();
  const [page, setPage] = useState(1);
  const supplierId = supplier?.id || '';
  const supplierLabel = supplierName(supplier, lang);
  const category = useMemo(
    () => flatCategories.find((c: any) => c.id === supplier?.supplierCategoryId),
    [flatCategories, supplier?.supplierCategoryId],
  );

  const { items, total, sums, isLoading, isError, error } = useInvoices({
    companyId,
    page,
    pageSize: PAGE_SIZE,
    supplierId: supplierId || undefined,
    includeCancelled: false,
    sortBy: 'transactionDate',
    sortDir: 'desc',
  });

  const latestInvoice = items?.[0];
  const totals = sums?.all ?? { net: '0', tax: '0', total: '0', count: 0 };

  const loadAllInvoices = useCallback(
    () =>
      fetchAllInvoicesForExport({
        companyId,
        supplierId,
        includeCancelled: false,
        sortBy: 'transactionDate',
        sortDir: 'desc',
      }),
    [companyId, supplierId],
  );

  const handlePrintInvoices = useCallback(async () => {
    const all = await loadAllInvoices();
    openPrintWindow({
      title: t('supplierProfileInvoicesPrintTitle'),
      companyName: supplierLabel,
      subtitle: t('supplierProfileInvoicesSubtitle', String(all.length)),
      landscape: true,
      body: buildInvoicesTableHtml(all, t),
      htmlLang: lang === 'en' ? 'en' : 'ar',
      htmlDir: lang === 'en' ? 'ltr' : 'rtl',
    });
  }, [lang, loadAllInvoices, supplierLabel, t]);

  const handlePrintProfile = useCallback(async () => {
    const all = await loadAllInvoices();
    const sum = (key: string) => all.reduce((a: number, inv: any) => a + Number(inv[key] || 0), 0);
    const profileHtml = `
      <section>
        <h2>${esc(t('supplierProfile'))}</h2>
        <table><tbody>
          <tr><th>${esc(t('name'))}</th><td>${esc(supplierLabel)}</td></tr>
          <tr><th>${esc(t('category'))}</th><td>${esc(categoryName(category, lang))}</td></tr>
          <tr><th>${esc(t('taxNumber'))}</th><td>${esc(supplier?.taxNumber || '-')}</td></tr>
          <tr><th>${esc(t('phone'))}</th><td>${esc(supplier?.phone || '-')}</td></tr>
          <tr><th>${esc(t('taxRegisteredCol'))}</th><td>${esc(supplier?.isTaxRegistered ? t('taxRegisteredBadgeYes') : t('taxRegisteredBadgeNo'))}</td></tr>
        </tbody></table>
        <h2>${esc(t('supplierProfileSummary'))}</h2>
        <table><tbody>
          <tr><th>${esc(t('supplierProfileInvoiceCount'))}</th><td>${esc(String(all.length))}</td></tr>
          <tr><th>${esc(t('net'))}</th><td>${esc(fmt(sum('netAmount')))} SR</td></tr>
          <tr><th>${esc(t('tax'))}</th><td>${esc(fmt(sum('taxAmount')))} SR</td></tr>
          <tr><th>${esc(t('total'))}</th><td>${esc(fmt(sum('totalAmount')))} SR</td></tr>
        </tbody></table>
        <h2>${esc(t('supplierProfileInvoicesTab'))}</h2>
        ${buildInvoicesTableHtml(all, t)}
      </section>`;
    openPrintWindow({
      title: t('supplierProfilePrintTitle'),
      companyName: supplierLabel,
      subtitle: `${t('supplierProfile')} - ${getSaudiToday()}`,
      body: profileHtml,
      htmlLang: lang === 'en' ? 'en' : 'ar',
      htmlDir: lang === 'en' ? 'ltr' : 'rtl',
    });
  }, [category, lang, loadAllInvoices, supplier, supplierLabel, t]);

  const columns = useMemo(
    () => [
      {
        key: 'supplierInvoiceNumber',
        label: t('supplierInvoiceNumber'),
        minWidth: 130,
        render: (_: any, row: any) => (
          <span className="nx-cell-num nx-cell-bold">{row.supplierInvoiceNumber || row.invoiceNumber || '-'}</span>
        ),
      },
      { key: 'invoiceNumber', label: t('documentNumber'), minWidth: 115, render: (v: any) => <span className="nx-cell-num nx-cell-muted">{v || '-'}</span> },
      { key: 'kind', label: t('type'), minWidth: 110, render: (v: any) => <Badge color={v === 'purchase' ? 'blue' : 'amber'} size="sm">{String(v || '-')}</Badge> },
      { key: 'transactionDate', label: t('date'), minWidth: 110, render: (v: any) => <span className="nx-cell-muted-sm">{v ? formatSaudiDateISO(v) : '-'}</span> },
      { key: 'netAmount', label: t('net'), numeric: true, minWidth: 105, render: (v: any) => <FmtNum n={v} /> },
      { key: 'taxAmount', label: t('tax'), numeric: true, minWidth: 105, render: (v: any) => <FmtNum n={v} /> },
      { key: 'totalAmount', label: t('total'), numeric: true, minWidth: 115, render: (v: any) => <FmtNum n={v} className="font-bold" /> },
    ],
    [t],
  );

  if (!supplier) return null;

  const summaryCards = [
    { label: t('supplierProfileInvoiceCount'), value: String(total || 0) },
    { label: t('net'), value: `${fmt(Number(totals.net || 0))} SR` },
    { label: t('tax'), value: `${fmt(Number(totals.tax || 0))} SR` },
    { label: t('total'), value: `${fmt(Number(totals.total || 0))} SR` },
  ];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${t('supplierProfile')} - ${supplierLabel}`}
      size="full"
      footer={
        <>
          <Button size="sm" onClick={handlePrintProfile}>{t('supplierProfilePrint')}</Button>
          <Button size="sm" onClick={handlePrintInvoices}>{t('supplierProfilePrintInvoices')}</Button>
          <Button size="sm" variant="ghost" onClick={onClose}>{t('close')}</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-[1.2fr_2fr]">
          <div className="rounded-lg border border-noorix-border bg-noorix-bg-muted/40 p-4">
            <div className="text-[18px] font-extrabold text-noorix-text">{supplierLabel}</div>
            <div className="mt-3 grid gap-2 text-[13px]">
              <div className="flex justify-between gap-3"><span className="text-noorix-muted">{t('category')}</span><strong>{categoryName(category, lang)}</strong></div>
              <div className="flex justify-between gap-3"><span className="text-noorix-muted">{t('taxNumber')}</span><span className="nx-cell-num">{supplier.taxNumber || '-'}</span></div>
              <div className="flex justify-between gap-3"><span className="text-noorix-muted">{t('phone')}</span><span>{supplier.phone || '-'}</span></div>
              <div className="flex justify-between gap-3">
                <span className="text-noorix-muted">{t('taxRegisteredCol')}</span>
                <Badge color={supplier.isTaxRegistered ? 'green' : 'gray'} size="sm">
                  {supplier.isTaxRegistered ? t('taxRegisteredBadgeYes') : t('taxRegisteredBadgeNo')}
                </Badge>
              </div>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {summaryCards.map((card) => (
              <div key={card.label} className="rounded-lg border border-noorix-border bg-white p-4">
                <div className="text-[12px] text-noorix-muted">{card.label}</div>
                <div className="mt-1 text-[17px] font-extrabold nx-font-numbers">{card.value}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-noorix-border bg-white p-3 text-[13px]">
          <span className="text-noorix-muted">{t('supplierProfileLastInvoice')}: </span>
          <strong className="nx-cell-num">
            {latestInvoice ? `${latestInvoice.supplierInvoiceNumber || latestInvoice.invoiceNumber || '-'} - ${formatSaudiDateISO(latestInvoice.transactionDate)}` : '-'}
          </strong>
        </div>

        <SmartTable
          compact
          showRowNumbers
          columns={columns}
          data={items}
          total={total}
          page={page}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
          isLoading={isLoading}
          isError={isError}
          errorMessage={error?.message || t('loadInvoicesFailed')}
          title={t('supplierProfileInvoicesTab')}
          badge={<span className="nx-pill nx-pill--blue nx-pill--sm">{total}</span>}
          emptyMessage={t('noInvoicesInPeriod')}
          tableMinWidth={860}
        />
      </div>
    </Modal>
  );
}

export default SupplierProfileModal;
