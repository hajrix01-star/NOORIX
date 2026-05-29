import { extractJsonFromOcrLlmText } from '../common/utils/ocr-llm-json.util';
import {
  normalizeOcrDateToYmd,
  normalizeOcrDigits,
  normalizeOcrInvoiceNumber,
  normalizeOcrSupplierName,
  parseOcrConfidence,
  parseOcrNumber,
} from './ocr-extraction-normalize.util';
import { validateItemMath, validateInvoiceTotals, type OcrLineTaxMode } from './ocr-invoice-math-validate.util';
import type { GeminiExtractedInvoice, GeminiExtractedItem } from './ocr-gemini-extract.constants';

export type ItemMathWarning = {
  message?: string;
  suggestedQuantity?: number;
  suggestedUnitPrice?: number;
};

export type ItemPriceWarning = {
  avg: number;
  deviation: number;
  lastPrice: number;
};

export type GeminiItemWithWarnings = GeminiExtractedItem & {
  mathWarning?: ItemMathWarning;
  priceWarning?: ItemPriceWarning;
  itemMatch?: {
    id: string;
    nameAr: string;
    nameEn?: string | null;
    score: number;
    status: string;
    hasSizes: boolean;
    sizeGateDecision?: string;
    qualityFlags?: string[];
  } | null;
};

export type GeminiExtractionWithMath = Omit<GeminiExtractedInvoice, 'items'> & {
  items: GeminiItemWithWarnings[];
  invoiceTotalWarning?: string;
  vatAdjusted: boolean;
  lineTaxMode: OcrLineTaxMode;
};

function tryParseJsonCandidate(candidate: string): GeminiExtractedInvoice | null {
  const trimmed = candidate.trim();
  if (!trimmed) return null;
  try {
    const parsed = JSON.parse(trimmed) as GeminiExtractedInvoice;
    if (parsed && typeof parsed === 'object') return parsed;
  } catch {
    return null;
  }
  return null;
}

export function tryLocalJsonRepair(rawText: string): GeminiExtractedInvoice | null {
  if (!rawText.trim()) return null;

  const noMarkdown = rawText.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
  const normalizedQuotes = noMarkdown
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, '\'')
    .replace(/\u00A0/g, ' ');
  const withoutTrailingCommas = normalizedQuotes.replace(/,\s*([}\]])/g, '$1');
  const quotedKeys = withoutTrailingCommas.replace(/([{,]\s*)'([^']+?)'\s*:/g, '$1"$2":');
  const quotedValues = quotedKeys.replace(/:\s*'([^']*)'/g, (_, value: string) => {
    const escaped = value.replace(/"/g, '\\"');
    return `: "${escaped}"`;
  });

  const candidates = [
    normalizedQuotes,
    withoutTrailingCommas,
    quotedKeys,
    quotedValues,
  ];
  for (const candidate of candidates) {
    const direct = tryParseJsonCandidate(candidate);
    if (direct) return direct;
    const extracted = extractJsonFromOcrLlmText<GeminiExtractedInvoice>(candidate);
    if (extracted) return extracted;
  }
  return null;
}

export function normalizeExtractedInvoicePayload(extracted: GeminiExtractedInvoice): GeminiExtractedInvoice {
  const supplierName = normalizeOcrSupplierName(extracted?.supplier?.name);
  const supplierConfidence = parseOcrConfidence(extracted?.supplier?.confidence);
  const vatValue = normalizeOcrDigits(extracted?.vatNumber?.value);
  const vatConfidence = parseOcrConfidence(extracted?.vatNumber?.confidence);
  const invoiceNumber = normalizeOcrInvoiceNumber(extracted?.invoiceNumber?.value);
  const invoiceNumberConfidence = parseOcrConfidence(extracted?.invoiceNumber?.confidence);
  const invoiceDate = normalizeOcrDateToYmd(extracted?.invoiceDate?.value);
  const invoiceDateConfidence = parseOcrConfidence(extracted?.invoiceDate?.confidence);
  const subtotalValue = parseOcrNumber(extracted?.subtotalAmount?.value);
  const subtotalConfidence = parseOcrConfidence(extracted?.subtotalAmount?.confidence);
  const totalValue = parseOcrNumber(extracted?.totalAmount?.value);
  const totalConfidence = parseOcrConfidence(extracted?.totalAmount?.confidence);
  const vatAmountValue = parseOcrNumber(extracted?.vatAmount?.value);
  const vatAmountConfidence = parseOcrConfidence(extracted?.vatAmount?.confidence);

  const items = Array.isArray(extracted?.items)
    ? extracted.items
      .map((item): GeminiExtractedItem | null => {
        const name = item?.name?.toString().trim() || undefined;
        if (!name) return null;

        const quantity = parseOcrNumber(item?.quantity);
        const unitPrice = parseOcrNumber(item?.unitPrice);
        const totalPrice = parseOcrNumber(item?.totalPrice);
        const confidence = parseOcrConfidence(item?.confidence);

        const rawNameAr = item?.nameAr?.toString().trim() || undefined;
        const hasArabicInNameAr = !!rawNameAr && /[\u0600-\u06FF]/.test(rawNameAr);
        const nameAr = hasArabicInNameAr ? rawNameAr : undefined;
        const nameEn = item?.nameEn?.toString().trim() || undefined;
        const size = item?.size?.toString().trim() || undefined;
        const sizeUnit = item?.sizeUnit?.toString().trim() || undefined;
        const cleanName = item?.cleanName?.toString().trim() || undefined;

        return {
          name,
          ...(quantity != null ? { quantity } : {}),
          ...(unitPrice != null ? { unitPrice } : {}),
          ...(totalPrice != null ? { totalPrice } : {}),
          ...(confidence != null ? { confidence } : {}),
          ...(nameAr ? { nameAr } : {}),
          ...(nameEn ? { nameEn } : {}),
          ...(size ? { size } : {}),
          ...(sizeUnit ? { sizeUnit } : {}),
          ...(cleanName ? { cleanName } : {}),
        };
      })
      .filter((item): item is GeminiExtractedItem => !!item)
    : [];

  return {
    ...(supplierName || supplierConfidence != null
      ? {
        supplier: {
          ...(supplierName ? { name: supplierName } : {}),
          ...(supplierConfidence != null ? { confidence: supplierConfidence } : {}),
        },
      }
      : {}),
    ...(vatValue || vatConfidence != null
      ? {
        vatNumber: {
          ...(vatValue ? { value: vatValue } : {}),
          ...(vatConfidence != null ? { confidence: vatConfidence } : {}),
        },
      }
      : {}),
    ...(invoiceNumber || invoiceNumberConfidence != null
      ? {
        invoiceNumber: {
          ...(invoiceNumber ? { value: invoiceNumber } : {}),
          ...(invoiceNumberConfidence != null ? { confidence: invoiceNumberConfidence } : {}),
        },
      }
      : {}),
    ...(invoiceDate || invoiceDateConfidence != null
      ? {
        invoiceDate: {
          ...(invoiceDate ? { value: invoiceDate } : {}),
          ...(invoiceDateConfidence != null ? { confidence: invoiceDateConfidence } : {}),
        },
      }
      : {}),
    ...(subtotalValue != null || subtotalConfidence != null
      ? {
        subtotalAmount: {
          ...(subtotalValue != null ? { value: subtotalValue } : {}),
          ...(subtotalConfidence != null ? { confidence: subtotalConfidence } : {}),
        },
      }
      : {}),
    ...(totalValue != null || totalConfidence != null
      ? {
        totalAmount: {
          ...(totalValue != null ? { value: totalValue } : {}),
          ...(totalConfidence != null ? { confidence: totalConfidence } : {}),
        },
      }
      : {}),
    ...(vatAmountValue != null || vatAmountConfidence != null
      ? {
        vatAmount: {
          ...(vatAmountValue != null ? { value: vatAmountValue } : {}),
          ...(vatAmountConfidence != null ? { confidence: vatAmountConfidence } : {}),
        },
      }
      : {}),
    items,
  };
}

export function applyMathValidation(extracted: GeminiExtractedInvoice): GeminiExtractionWithMath {
  const items = (extracted.items || []).map((item) => {
    const mathResult = validateItemMath(item.quantity, item.unitPrice, item.totalPrice);
    return {
      ...item,
      mathWarning: mathResult.valid
        ? undefined
        : {
          message: mathResult.warning,
          suggestedQuantity: mathResult.suggestedQuantity,
          suggestedUnitPrice: mathResult.suggestedUnitPrice,
        },
    };
  });

  const itemsSum = items.reduce((s, i) => s + (i.totalPrice || 0), 0);
  const invoiceTotalValidation = validateInvoiceTotals(
    itemsSum,
    extracted.totalAmount?.value,
    extracted.vatAmount?.value,
    extracted.subtotalAmount?.value,
  );

  return {
    ...extracted,
    items,
    invoiceTotalWarning: invoiceTotalValidation.valid ? undefined : invoiceTotalValidation.warning,
    vatAdjusted: invoiceTotalValidation.vatAdjusted,
    lineTaxMode: invoiceTotalValidation.lineTaxMode,
  };
}

export function buildQualityFlags(
  extracted: GeminiExtractionWithMath,
  options?: { schemaIssues?: string[]; enrichError?: boolean },
): string[] {
  const flags = new Set<string>();

  if (options?.schemaIssues?.length) flags.add('schema_validation_warning');
  if (options?.enrichError) flags.add('matching_enrichment_failed');
  if (!extracted.totalAmount?.value) flags.add('missing_total_amount');
  if (!extracted.items.length) flags.add('missing_items');

  const confidenceValues = [
    extracted.supplier?.confidence,
    extracted.vatNumber?.confidence,
    extracted.invoiceNumber?.confidence,
    extracted.invoiceDate?.confidence,
    extracted.totalAmount?.confidence,
    extracted.vatAmount?.confidence,
  ].filter((v): v is number => typeof v === 'number');
  if (confidenceValues.some((v) => v < 0.7)) flags.add('low_confidence_header');
  if (extracted.items.some((i) => typeof i.confidence === 'number' && i.confidence < 0.7)) {
    flags.add('low_confidence_items');
  }
  if (extracted.items.some((i) => i.mathWarning?.message) || extracted.invoiceTotalWarning) {
    flags.add('math_validation_warning');
  }

  if (!flags.size) flags.add('validated');
  return Array.from(flags);
}

export function mergeExtractionQualityFlags(
  baseFlags: string[],
  items: GeminiItemWithWarnings[],
): { qualityFlags: string[]; qualityStatus: 'validated' | 'needs_review' } {
  const itemGateFlags = Array.from(new Set(
    (items || []).flatMap((x) => (
      Array.isArray(x?.itemMatch?.qualityFlags)
        ? x.itemMatch.qualityFlags.filter((flag: unknown): flag is string => typeof flag === 'string')
        : []
    )),
  ));
  const qualityFlags = Array.from(new Set([
    ...baseFlags,
    ...itemGateFlags,
  ]));
  const blockingQualityFlags = new Set([
    'size_mismatch',
    'missing_size_for_multi_size_item',
    'incompatible_size_units',
    'possible_decimal_size_error',
    'size_gate_blocked_auto_match',
  ]);
  const hasBlockingFlags = qualityFlags.some((flag) => blockingQualityFlags.has(flag));
  const qualityStatus = hasBlockingFlags
    ? 'needs_review'
    : qualityFlags.some((flag) => flag !== 'validated' && flag !== 'size_missing_on_candidate')
      ? 'needs_review'
      : 'validated';

  return { qualityFlags, qualityStatus };
}

export function hasMeaningfulExtractionPayload(extracted: GeminiExtractedInvoice): boolean {
  return summarizeExtractionSignal(extracted).hasMeaningful;
}

export type OcrExtractionSignalSummary = {
  hasMeaningful: boolean;
  actionable: boolean;
  headerSignalCount: number;
  itemSignalCount: number;
  completenessScore: number;
};

export function summarizeExtractionSignal(extracted: GeminiExtractedInvoice): OcrExtractionSignalSummary {
  const hasSupplier = !!extracted.supplier?.name;
  const hasVatNumber = !!extracted.vatNumber?.value;
  const hasInvoiceNumber = !!extracted.invoiceNumber?.value;
  const hasInvoiceDate = !!extracted.invoiceDate?.value;
  const hasSubtotal = extracted.subtotalAmount?.value != null;
  const hasTotal = extracted.totalAmount?.value != null;
  const hasVatAmount = extracted.vatAmount?.value != null;

  const hasFinancialSignal = hasSubtotal || hasTotal || hasVatAmount;
  const itemSignalCount = (extracted.items || []).reduce((count, item) => {
    const hasName = !!item.name;
    const hasNumbers = item.quantity != null || item.unitPrice != null || item.totalPrice != null;
    return count + (hasName || hasNumbers ? 1 : 0);
  }, 0);
  const hasItemsSignal = itemSignalCount > 0;

  const headerSignalCount = [
    hasSupplier,
    hasVatNumber,
    hasInvoiceNumber,
    hasInvoiceDate,
    hasSubtotal,
    hasTotal,
    hasVatAmount,
  ].filter(Boolean).length;

  const hasMeaningful = headerSignalCount > 0 || hasItemsSignal;
  // Actionable payloads must include line-level or money-level signal.
  // Supplier/VAT-only payloads are considered non-actionable to avoid false "success".
  const actionable = hasItemsSignal || hasFinancialSignal;
  const completenessScore = headerSignalCount + Math.min(itemSignalCount, 3) * 2;

  return {
    hasMeaningful,
    actionable,
    headerSignalCount,
    itemSignalCount,
    completenessScore,
  };
}

export function isActionableExtractionPayload(extracted: GeminiExtractedInvoice): boolean {
  return summarizeExtractionSignal(extracted).actionable;
}
