import type { ReactNode } from 'react';
import type { SmartTableColumn, SmartTableRow } from './types';

const ALIGN_MAP: Record<string, string> = { right: 'right', left: 'left', center: 'center', start: 'start', end: 'end' };

export function columnLabel<TRow extends SmartTableRow = SmartTableRow>(col: SmartTableColumn<TRow> | null | undefined): ReactNode {
  if (col == null) return '';
  return col.label ?? col.header ?? '';
}

const COMPACT_LABEL_BY_KEY: Record<string, { ar: string; en: string }> = {
  supplierInvoiceNumber: { ar: 'رقم الفاتورة', en: 'Invoice no.' },
  invoiceNumber: { ar: 'رقم السند', en: 'Doc no.' },
  documentNumber: { ar: 'رقم السند', en: 'Doc no.' },
  transactionDate: { ar: 'التاريخ', en: 'Date' },
  totalAmount: { ar: 'الإجمالي', en: 'Total' },
  netAmount: { ar: 'الصافي', en: 'Net' },
  taxAmount: { ar: 'VAT', en: 'VAT' },
  vatAmount: { ar: 'VAT', en: 'VAT' },
};

const COMPACT_LABEL_TEXT: Record<string, string> = {
  'رقم فاتورة المورد': 'رقم الفاتورة',
  'Supplier invoice number': 'Invoice no.',
  'Supplier invoice no.': 'Invoice no.',
  'Invoice number': 'Invoice no.',
  'Document number': 'Doc no.',
  'ضريبة القيمة المضافة': 'VAT',
  'الضريبة': 'VAT',
  Tax: 'VAT',
};

function isArabicText(value: string): boolean {
  return /[\u0600-\u06FF]/.test(value);
}

export function compactColumnLabel<TRow extends SmartTableRow = SmartTableRow>(
  col: SmartTableColumn<TRow> | null | undefined,
): ReactNode {
  const label = columnLabel(col);
  if (col == null) return label;
  if (typeof label !== 'string') return label;
  const byText = COMPACT_LABEL_TEXT[label.trim()];
  if (byText) return byText;
  const byKey = COMPACT_LABEL_BY_KEY[col.key];
  if (!byKey) return label;
  return isArabicText(label) ? byKey.ar : byKey.en;
}

export function getAlign<TRow extends SmartTableRow = SmartTableRow>(col: SmartTableColumn<TRow> | null | undefined) {
  if (col?.align) return (ALIGN_MAP as Record<string, string>)[String(col.align)] || 'center';
  return 'center';
}
