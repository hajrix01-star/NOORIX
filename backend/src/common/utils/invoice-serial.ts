/**
 * invoice-serial — مولّد السيريال الداخلي للفواتير
 *
 * القاعدة: invoiceNumber = سيريال فريد يُولَّد دائماً من النظام، لا يُقبل من العميل.
 *         supplierInvoiceNumber = رقم فاتورة المورد، يُدخله المستخدم.
 *
 * الصيغة: {PREFIX}-{YYYYMMDD}-{SEQ}
 * - PREFIX: PUR | EXP | HR | ADV | SAL
 * - SEQ: 3 أرقام تسلسلية (001, 002...) لكل شركة + نوع + تاريخ
 */
const PREFIX_BY_KIND: Record<string, string> = {
  purchase:      'PUR',
  expense:       'EXP',
  fixed_expense: 'EXP',
  hr_expense:    'HR',
  salary:        'SAL',
  advance:       'ADV',
  sale:          'SAL',
};

export type InvoiceSerialTx = {
  invoice: { count: (args: { where: { companyId: string; invoiceNumber: { startsWith: string } } }) => Promise<number> };
};

/**
 * يولّد سيريال تسلسلي للفاتورة.
 * يُستدعى من داخل transaction — يتطلب tx و companyId.
 */
export async function generateInvoiceSerial(
  tx: InvoiceSerialTx,
  companyId: string,
  kind: string,
  txDate: Date,
): Promise<string> {
  const prefix = PREFIX_BY_KIND[kind] || 'INV';
  const ymd = [
    txDate.getFullYear(),
    String(txDate.getMonth() + 1).padStart(2, '0'),
    String(txDate.getDate()).padStart(2, '0'),
  ].join('');
  const pattern = `${prefix}-${ymd}-`;
  const count = await tx.invoice.count({
    where: {
      companyId,
      invoiceNumber: { startsWith: pattern },
    },
  });
  return `${pattern}${String(count + 1).padStart(3, '0')}`;
}
