import type { SaveInvoiceDto, SaveInvoiceLineDto } from './dto/save-invoice.dto';
import { hasPermission, PERMISSIONS } from '../auth/constants/permissions';
import type { OcrSaveInvoiceCaller } from './ocr-invoices.types';

type EnrichedItem = Record<string, unknown> & {
  name?: string;
  nameAr?: string | null;
  nameEn?: string | null;
  size?: string | null;
  sizeUnit?: string | null;
  quantity?: number | null;
  unitPrice?: number | null;
  totalPrice?: number | null;
  confidence?: number;
  itemMatch?: { id?: string; status?: string } | null;
};

function readAmount(block: unknown): number | undefined {
  if (!block || typeof block !== 'object') return undefined;
  const value = (block as { value?: unknown }).value;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function readText(block: unknown): string | undefined {
  if (!block || typeof block !== 'object') return undefined;
  const value = String((block as { value?: unknown }).value || '').trim();
  return value || undefined;
}

function optStr(value: string | null | undefined): string | undefined {
  const v = String(value || '').trim();
  return v || undefined;
}

export function buildAutoSaveDtoFromEnriched(
  invoiceId: string,
  enriched: Record<string, unknown>,
): SaveInvoiceDto | null {
  const items = Array.isArray(enriched.items) ? enriched.items as EnrichedItem[] : [];
  const totalAmount = readAmount(enriched.totalAmount);
  const hasItems = items.length > 0;
  if (!hasItems && totalAmount == null) return null;

  const supplierMatch = enriched.supplierMatch as { id?: string } | null | undefined;
  const supplier = enriched.supplier as { name?: string } | null | undefined;

  const lines: SaveInvoiceLineDto[] = items.map((item) => {
    const match = item.itemMatch;
    const autoItemId = match?.status === 'auto' ? optStr(match?.id) : undefined;
    return {
      rawName: String(item.name || ''),
      nameAr: optStr(item.nameAr),
      nameEn: optStr(item.nameEn),
      size: optStr(item.size),
      sizeUnit: optStr(item.sizeUnit),
      itemId: autoItemId,
      quantity: item.quantity ?? undefined,
      unitPrice: item.unitPrice ?? undefined,
      totalPrice: item.totalPrice ?? undefined,
      confidence: typeof item.confidence === 'number' ? item.confidence : 0,
      matchStatus: match?.status || 'pending',
    };
  });

  return {
    id: invoiceId,
    supplierId: optStr(supplierMatch?.id),
    supplierName: !supplierMatch?.id ? optStr(supplier?.name) : undefined,
    invoiceNumber: readText(enriched.invoiceNumber),
    invoiceDate: readText(enriched.invoiceDate),
    subtotalAmount: readAmount(enriched.subtotalAmount),
    totalAmount,
    vatAmount: readAmount(enriched.vatAmount),
    rawExtraction: enriched,
    lines,
  };
}

/** يُحفظ تلقائياً فقط إذا كان المرسل يملك OCR_READ (محاسب/مالك). إرسال الموظف/الكاشير يبقى للمراجعة. */
export function shouldAutoFinalizeOcrSubmission(
  submittedByUserId: string | null | undefined,
  caller?: OcrSaveInvoiceCaller | null,
): boolean {
  if (!submittedByUserId) return true;
  if (!caller) return false;
  return hasPermission(caller.role || '', PERMISSIONS.OCR_READ, caller.permissions);
}
