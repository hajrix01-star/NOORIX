import React, { useCallback, useMemo, useState } from 'react';
import { Badge, Button, FmtNum, Modal, SmartTable, usePrintPreview } from '../../../ui';
import type { SmartTableColumn } from '../../../ui/SmartTable/types';
import { useInvoices } from '../../../hooks/useInvoices';
import { useApp } from '../../../context/AppContext';
import { fetchAllInvoicesForExport } from '../../../services/api';
import { useTranslation } from '../../../i18n/useTranslation';
import { fmt } from '../../../utils/format';
import { formatSaudiDateISO } from '../../../utils/saudiDate';
import type { InvoiceListItem } from '../../../services/domains/apiEndpoints/invoice-list-response';
import type {
  SupplierCategoryRecord,
  SupplierInvoiceRecord,
  SupplierRecord,
  SupplierProfileTotals,
} from '../supplierTypes';
import { findSupplierCategory, getSupplierCategoryName, getSupplierName } from '../supplierDisplayModel';
import {
  buildSupplierInvoicesPrintHtml,
  buildSupplierProfilePrintHtml,
  buildSupplierProfilePrintSubtitle,
} from '../supplierProfilePrint';

const PAGE_SIZE = 10;

function isSupplierInvoiceRecord(value: unknown): value is SupplierInvoiceRecord {
  return Boolean(value && typeof value === 'object');
}

function normalizeSupplierInvoices(values: unknown[]) {
  return values.filter(isSupplierInvoiceRecord);
}

function numericValue(value: unknown) {
  const numeric = Number(value || 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

export type SupplierProfileModalProps = {
  open: boolean;
  supplier: SupplierRecord;
  companyId: string;
  flatCategories?: SupplierCategoryRecord[];
  onClose: () => void;
  onEdit?: (supplier: SupplierRecord) => void;
  onDelete?: (supplier: SupplierRecord) => void;
};

export function SupplierProfileModal({
  open,
  supplier,
  companyId,
  flatCategories = [],
  onClose,
  onEdit,
  onDelete,
}: SupplierProfileModalProps) {
  const { t, lang } = useTranslation();
  const { companies = [] } = useApp();
  const [page, setPage] = useState(1);
  const supplierId = supplier?.id || '';
  const supplierLabel = getSupplierName(supplier, lang);
  const company = companies.find((item) => item.id === companyId);
  const companyName = lang === 'en'
    ? (company?.nameEn || company?.nameAr || '')
    : (company?.nameAr || company?.nameEn || '');
  const companyLogoUrl = String(company?.logoUrl || '').trim();
  const { openPrintDocumentPreview, printPreviewModal } = usePrintPreview({
    title: t('supplierProfile'),
    closeLabel: t('close') || 'إغلاق',
    printLabel: `${t('print')} / PDF`,
  });
  const category = useMemo(
    () => findSupplierCategory(flatCategories, supplier),
    [flatCategories, supplier],
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

  const latestInvoice = items[0];
  const totals: SupplierProfileTotals = sums.all;

  const loadAllInvoices = useCallback(
    async () =>
      normalizeSupplierInvoices(await fetchAllInvoicesForExport({
        companyId,
        supplierId,
        includeCancelled: false,
        sortBy: 'transactionDate',
        sortDir: 'desc',
      })),
    [companyId, supplierId],
  );

  const handlePrintInvoices = useCallback(async () => {
    const invoices = await loadAllInvoices();
    openPrintDocumentPreview({
      title: t('supplierProfileInvoicesPrintTitle'),
      companyName: companyName || supplierLabel,
      logoUrl: companyLogoUrl,
      subtitle: `${supplierLabel} - ${t('supplierProfileInvoicesSubtitle', String(invoices.length))}`,
      landscape: true,
      body: buildSupplierInvoicesPrintHtml(invoices, t),
      htmlLang: lang === 'en' ? 'en' : 'ar',
      htmlDir: lang === 'en' ? 'ltr' : 'rtl',
      autoPrint: false,
    });
  }, [companyLogoUrl, companyName, lang, loadAllInvoices, supplierLabel, t]);

  const handlePrintProfile = useCallback(async () => {
    const invoices = await loadAllInvoices();
    openPrintDocumentPreview({
      title: t('supplierProfilePrintTitle'),
      companyName: companyName || supplierLabel,
      logoUrl: companyLogoUrl,
      subtitle: `${supplierLabel} - ${buildSupplierProfilePrintSubtitle(t)}`,
      body: buildSupplierProfilePrintHtml({
        supplier,
        category,
        invoices,
        summary: {
          count: total,
          net: totals.net,
          tax: totals.tax,
          total: totals.total,
        },
        lang,
        t,
      }),
      htmlLang: lang === 'en' ? 'en' : 'ar',
      htmlDir: lang === 'en' ? 'ltr' : 'rtl',
      autoPrint: false,
    });
  }, [category, companyLogoUrl, companyName, lang, loadAllInvoices, supplier, supplierLabel, t, total, totals]);

  const columns = useMemo<SmartTableColumn<InvoiceListItem>[]>(
    () => [
      {
        key: 'supplierInvoiceNumber',
        label: t('supplierInvoiceNumber'),
        minWidth: 130,
        render: (_value, row) => (
          <span className="nx-cell-num nx-cell-bold">{row.supplierInvoiceNumber || row.invoiceNumber || '-'}</span>
        ),
      },
      {
        key: 'invoiceNumber',
        label: t('documentNumber'),
        minWidth: 115,
        render: (value) => <span className="nx-cell-num nx-cell-muted">{String(value || '-')}</span>,
      },
      {
        key: 'kind',
        label: t('type'),
        minWidth: 110,
        render: (value) => <Badge color={value === 'purchase' ? 'blue' : 'amber'} size="sm">{String(value || '-')}</Badge>,
      },
      {
        key: 'transactionDate',
        label: t('date'),
        minWidth: 110,
        render: (value) => <span className="nx-cell-muted-sm">{value ? formatSaudiDateISO(value) : '-'}</span>,
      },
      {
        key: 'netAmount',
        label: t('net'),
        numeric: true,
        minWidth: 105,
        render: (value) => <FmtNum n={numericValue(value)} />,
      },
      {
        key: 'taxAmount',
        label: t('tax'),
        numeric: true,
        minWidth: 105,
        render: (value) => <FmtNum n={numericValue(value)} />,
      },
      {
        key: 'totalAmount',
        label: t('total'),
        numeric: true,
        minWidth: 115,
        render: (value) => <FmtNum n={numericValue(value)} className="font-bold" />,
      },
    ],
    [t],
  );

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
      footer={(
        <>
          <Button size="sm" onClick={handlePrintProfile}>{t('supplierProfilePrint')}</Button>
          <Button size="sm" onClick={handlePrintInvoices}>{t('supplierProfilePrintInvoices')}</Button>
          {onEdit && (
            <Button
              size="sm"
              variant="success"
              onClick={() => {
                onClose();
                onEdit(supplier);
              }}
            >
              {t('edit')}
            </Button>
          )}
          {onDelete && (
            <Button
              size="sm"
              variant="danger"
              onClick={() => {
                onClose();
                onDelete(supplier);
              }}
            >
              {t('delete')}
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={onClose}>{t('close')}</Button>
        </>
      )}
    >
      {printPreviewModal}
      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-[1.2fr_2fr]">
          <div className="rounded-lg border border-noorix-border bg-noorix-bg-muted/40 p-4">
            <div className="text-[18px] font-extrabold text-noorix-text">{supplierLabel}</div>
            <div className="mt-3 grid gap-2 text-[13px]">
              <div className="flex justify-between gap-3"><span className="text-noorix-muted">{t('category')}</span><strong>{getSupplierCategoryName(category, lang)}</strong></div>
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
