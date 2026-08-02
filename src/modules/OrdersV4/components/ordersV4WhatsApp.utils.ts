import type { OrdersV4Document, OrdersV4DocumentLine } from '../../../types/api';

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
export function buildOrdersV4WhatsAppText(document: WhatsAppDocument): string {
  if (document.documentType === 'registration' && document.registrationEntryType === 'cancellation') {
    const reasonLabels: Record<string, string> = {
      customer_disliked: 'لم يعجب العميل', replaced_item: 'استُبدل بصنف آخر', order_error: 'خطأ في الطلب',
      registration_error: 'خطأ في التسجيل', delayed_order: 'تأخر الطلب', duplicate_order: 'طلب مكرر',
      customer_changed_mind: 'العميل غيّر رأيه', item_unavailable: 'الصنف غير متوفر', other: 'أخرى',
    };
    const section = document.section?.nameAr || '—';
    return [
      `سجل إلغاء — ${section}`,
      `التاريخ: ${formatDate(document.documentDate)}`,
      `رقم العملية: ${document.documentNumber}`,
      '──────────────',
      ...document.lines.flatMap((line) => [
        `• ${line.itemNameSnapshot} (${line.inputUnit.nameAr}): ${formatNumber(Math.abs(Number(line.inputQuantity)))}`,
        `  السبب: ${(line.cancellationReasons ?? []).map((reason) => reasonLabels[reason] || reason).join('، ')}`,
        line.cancellationNote?.trim() ? `  التوضيح: ${line.cancellationNote.trim()}` : '',
      ]),
      '──────────────',
      document.notes?.trim() ? `ملاحظات عامة: ${document.notes.trim()}` : '',
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
