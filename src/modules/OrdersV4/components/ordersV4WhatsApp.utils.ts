import type { OrdersV4Document, OrdersV4DocumentLine } from '../../../types/api';
import { getText, type TranslationKey, type TranslationLanguage, type TranslationReplacement } from '../../../i18n/translations';
import { ordersV4CancellationReasonLabel } from './ordersV4CancellationReasons';

type WhatsAppLine = Pick<OrdersV4DocumentLine,
  'itemNameSnapshot' | 'inputQuantity' | 'unitPrice' | 'lineTotal' | 'inputUnit' | 'cancellationReasons' | 'cancellationNote'>;

type WhatsAppDocument = Pick<OrdersV4Document,
  'documentNumber' | 'documentType' | 'registrationEntryType' | 'documentDate' | 'paymentMethod' | 'totalAmount' | 'notes' | 'section'> & {
  lines: WhatsAppLine[];
};

function formatNumber(value: unknown, maximumFractionDigits = 6): string {
  const number = Number(value ?? 0);
  if (!Number.isFinite(number)) return '0';
  return new Intl.NumberFormat('en-US', {
    useGrouping: false,
    minimumFractionDigits: 0,
    maximumFractionDigits,
  }).format(number);
}

function formatDate(value: string): string {
  return value.slice(0, 10).replaceAll('-', '/');
}

function paymentMethodLabel(method: OrdersV4Document['paymentMethod']): string {
  if (method === 'cash') return 'نقد المحل';
  if (method === 'transfer') return 'تحويل';
  return 'عهدة';
}

/**
 * نص الإرسال يُبنى من المستند الذي أعاده الخادم بعد نجاح الحفظ، لا من مسودة الواجهة.
 * التنسيق يطابق تجربة الطلبات/التسجيل الداخلي القديم مع الاحتفاظ بوحدات V4 الفعلية.
 */
export function buildOrdersV4WhatsAppText(document: WhatsAppDocument, lang: TranslationLanguage = 'ar'): string {
  if (document.documentType === 'registration' && document.registrationEntryType === 'cancellation') {
    const translate = (key: TranslationKey | string, ...values: TranslationReplacement[]) => getText(String(key), lang, ...values);
    const section = lang === 'en'
      ? (document.section?.nameEn || document.section?.nameAr || '—')
      : (document.section?.nameAr || document.section?.nameEn || '—');
    return [
      translate('ordersV4CancellationWhatsappTitle', section),
      translate('ordersV4CancellationWhatsappDate', formatDate(document.documentDate)),
      translate('ordersV4CancellationWhatsappNumber', document.documentNumber),
      '──────────────',
      ...document.lines.flatMap((line) => [
        `• ${line.itemNameSnapshot} (${lang === 'en' ? (line.inputUnit.nameEn || line.inputUnit.nameAr) : line.inputUnit.nameAr}): ${formatNumber(Math.abs(Number(line.inputQuantity)))}`,
        `  ${translate('ordersV4CancellationWhatsappReason', (line.cancellationReasons ?? []).map((reason) => ordersV4CancellationReasonLabel(reason, translate)).join(lang === 'en' ? ', ' : '، '))}`,
        line.cancellationNote?.trim() ? `  ${translate('ordersV4CancellationWhatsappExplanation', line.cancellationNote.trim())}` : '',
      ]),
      '──────────────',
      document.notes?.trim() ? translate('ordersV4CancellationWhatsappGeneralNotes', document.notes.trim()) : '',
    ].filter(Boolean).join('\n');
  }
  if (document.documentType === 'registration') {
    const section = document.section?.nameAr || '—';
    const totalQuantity = document.lines.reduce((sum, line) => sum + (Number(line.inputQuantity) || 0), 0);
    const lines = [
      `تسجيل داخلي — ${section}`,
      `يوم التسجيل: ${formatDate(document.documentDate)}`,
      `رقم العملية: ${document.documentNumber}`,
      '──────────────',
      ...document.lines.map((line) => (
        `• ${line.itemNameSnapshot} (${line.inputUnit.nameAr}): ${formatNumber(line.inputQuantity)}`
      )),
      '──────────────',
      `إجمالي الكمية: ${formatNumber(totalQuantity)}`,
      document.notes?.trim() ? `ملاحظات: ${document.notes.trim()}` : '',
    ];
    return lines.filter(Boolean).join('\n');
  }

  const lines = [
    `طلب ${document.documentNumber}`,
    `التاريخ: ${formatDate(document.documentDate)}`,
    `طريقة الدفع: ${paymentMethodLabel(document.paymentMethod)}`,
    '',
    ...document.lines.map((line) => (
      `${line.itemNameSnapshot} (${line.inputUnit.nameAr}): ${formatNumber(line.inputQuantity)} × ${formatNumber(line.unitPrice)} = ${formatNumber(line.lineTotal)} SR`
    )),
    '',
    `الإجمالي: ${formatNumber(document.totalAmount)} SR`,
    document.notes?.trim() ? `ملاحظات: ${document.notes.trim()}` : '',
  ];
  return lines.join('\n').trim();
}
