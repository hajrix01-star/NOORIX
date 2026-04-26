import { formatSaudiDateISO } from '../../utils/saudiDate';
import { MAX_VAULT_SLOTS, getAllocationsForExport } from './invoicesListScreenHelpers';

/**
 * أعمدة تصدير/طباعة Excel للفواتير — منطق خالص من InvoicesListScreen
 */

export function buildInvoiceExportColumnDefs(t: any) {
  const vaultCols = [];
  for (let s = 1; s <= MAX_VAULT_SLOTS; s++) {
    vaultCols.push(
      { key: `vault${s}Name`, label: t('invoicesExportVaultSlotName', s) },
      { key: `vault${s}Type`, label: t('invoicesExportVaultSlotType', s) },
      { key: `vault${s}Amount`, label: t('invoicesExportVaultSlotAmount', s) },
    );
  }
  return [
    { key: 'invoiceNumber', label: t('documentNumber') },
    { key: 'supplierInvoiceNumber', label: t('supplierInvoiceNumber') },
    { key: 'supplierName', label: t('supplier') },
    { key: 'createdByUserName', label: t('invoiceUserColumn') },
    { key: 'notes', label: t('invoiceNotesColumn') || 'ملاحظة' },
    { key: 'kind', label: t('type') },
    ...vaultCols,
    { key: 'netAmount', label: t('net') },
    { key: 'taxAmount', label: t('tax') },
    { key: 'totalAmount', label: t('total') },
    { key: 'transactionDate', label: t('date') },
    { key: 'status', label: t('statusLabel') },
  ];
}

/**
 * @param {object} inv — فاتورة خام من الـ API
 * @param {{ t: Function, lang: string, kindMap: object, statusMap: object }} ctx
 */
export function invoiceToExportRow(inv: any, { t, lang, kindMap, statusMap }: any) {
  const supplierName =
    inv.kind === 'sale'
      ? t('categoryTypeSale') || 'مبيعات'
      : lang === 'en'
        ? inv.supplier?.nameEn || inv.supplier?.nameAr || ''
        : inv.supplier?.nameAr || inv.supplier?.nameEn || '';
  const createdByUserName = inv.createdByUser
    ? lang === 'en'
      ? inv.createdByUser.nameEn || inv.createdByUser.nameAr || inv.createdByUser.email || ''
      : inv.createdByUser.nameAr || inv.createdByUser.nameEn || inv.createdByUser.email || ''
    : '';
  const kindLabel = kindMap[inv.kind]?.label ?? inv.kind ?? '—';
  const statusLabel = statusMap[inv.status]?.label ?? inv.status ?? '—';
  const allocs = getAllocationsForExport(inv, lang, t);
  const row: Record<string, any> = {
    invoiceNumber: inv.invoiceNumber ?? '',
    supplierInvoiceNumber: inv.supplierInvoiceNumber ?? '',
    supplierName: supplierName || '—',
    createdByUserName: createdByUserName || '—',
    notes: inv.notes ?? '',
    kind: kindLabel,
    netAmount: Number(inv.netAmount ?? 0),
    taxAmount: Number(inv.taxAmount ?? 0),
    totalAmount: Number(inv.totalAmount ?? 0),
    transactionDate: inv.transactionDate ? formatSaudiDateISO(inv.transactionDate) : '—',
    status: statusLabel,
  };
  for (let i = 0; i < MAX_VAULT_SLOTS; i++) {
    const slot = i + 1;
    const al = allocs[i];
    row[`vault${slot}Name`] = al?.name ?? '';
    row[`vault${slot}Type`] = al?.type ?? '';
    row[`vault${slot}Amount`] = al != null ? al.amount : '';
  }
  return row;
}
