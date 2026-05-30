/**
 * Default `kind` filter for GET /invoices when the client sends no `kind` query param.
 * Users with only sales or only purchases permission must still see related outflow kinds
 * (including hr_expense from HR employee services).
 */

export const INVOICE_KIND_SALE = 'sale' as const;

/** All outflow invoice kinds (matches reports / day-close groupings). */
export const INVOICE_OUTFLOW_KINDS_CSV =
  'purchase,expense,fixed_expense,hr_expense,salary,advance';

/** HR module invoice kinds (payroll advances, employee services, …). */
export const INVOICE_HR_KINDS_CSV = 'hr_expense,salary,advance';

export type ResolveInvoiceListKindInput = {
  requestedKind?: string;
  canSales: boolean;
  canPurchases: boolean;
  canHr: boolean;
};

/**
 * @returns kind CSV for Prisma `{ kind: { in: [...] } }`, or undefined = no kind filter (all kinds).
 */
export function resolveInvoiceListKindFilter(input: ResolveInvoiceListKindInput): string | undefined {
  const requested = (input.requestedKind || '').trim();
  if (requested) return requested;

  const { canSales, canPurchases, canHr } = input;

  if (canSales && canPurchases) return undefined;

  if (!canSales && canPurchases) {
    return INVOICE_OUTFLOW_KINDS_CSV;
  }

  if (canSales && !canPurchases) {
    return canHr ? `${INVOICE_KIND_SALE},${INVOICE_HR_KINDS_CSV}` : INVOICE_KIND_SALE;
  }

  return undefined;
}
