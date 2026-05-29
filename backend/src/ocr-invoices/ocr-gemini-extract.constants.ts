import { getGeminiModel } from '../config/gemini.config';

export const GEMINI_FALLBACK_CHAIN = [
  { model: 'gemini-2.5-flash', version: 'v1beta' as const },
  { model: 'gemini-2.5-pro', version: 'v1beta' as const },
  { model: 'gemini-2.0-flash', version: 'v1beta' as const },
  { model: 'gemini-1.5-pro', version: 'v1' as const },
  { model: 'gemini-1.5-flash', version: 'v1' as const },
];

function resolveGeminiApiVersion(model: string): 'v1' | 'v1beta' {
  return /^gemini-1\.[05]/.test(model) ? 'v1' : 'v1beta';
}

function parseModelOrderEnv(): string[] {
  const raw = process.env.OCR_GEMINI_MODEL_PRIORITY?.trim();
  if (!raw) return [];
  return raw
    .split(',')
    .map((x) => x.trim())
    .filter((x) => /^gemini-/i.test(x));
}

function getMaxModelsToTry(): number {
  const n = Number(process.env.OCR_GEMINI_MAX_MODELS_TO_TRY);
  if (!Number.isFinite(n)) return 5;
  return Math.max(1, Math.min(10, Math.trunc(n)));
}

export function buildGeminiUrl(model: string, version: string): string {
  return `https://generativelanguage.googleapis.com/${version}/models/${model}:generateContent`;
}

export function getGeminiModelsToTry(): Array<{ model: string; version: string }> {
  const configured = getGeminiModel();
  const preferredOrder = parseModelOrderEnv();
  const maxModels = getMaxModelsToTry();
  const order = [
    ...preferredOrder,
    configured,
    ...GEMINI_FALLBACK_CHAIN.map((x) => x.model),
  ];

  const seen = new Set<string>();
  const result: Array<{ model: string; version: string }> = [];
  for (const model of order) {
    const norm = model.trim();
    if (!norm || seen.has(norm)) continue;
    seen.add(norm);
    result.push({ model: norm, version: resolveGeminiApiVersion(norm) });
    if (result.length >= maxModels) break;
  }

  return result;
}

export interface GeminiExtractedItem {
  name?: string;
  quantity?: number;
  unitPrice?: number;
  totalPrice?: number;
  confidence?: number;
  nameAr?: string;
  nameEn?: string;
  size?: string;
  sizeUnit?: string;
  cleanName?: string;
}

export interface GeminiExtractedInvoice {
  supplier?: { name?: string; confidence?: number };
  vatNumber?: { value?: string; confidence?: number };
  invoiceNumber?: { value?: string; confidence?: number };
  invoiceDate?: { value?: string; confidence?: number };
  subtotalAmount?: { value?: number; confidence?: number };
  totalAmount?: { value?: number; confidence?: number };
  vatAmount?: { value?: number; confidence?: number };
  items?: GeminiExtractedItem[];
}

export function supportsStructuredGeminiResponse(model: string): boolean {
  return /^gemini-(1\.5|2\.0|2\.5)/i.test(model);
}

export const OCR_EXTRACTION_PROMPT = `You are a production-grade OCR extraction engine for Saudi supplier invoices.
Your ONLY task is to extract reliable invoice data in strict JSON that matches the provided schema exactly.
Do not explain. Do not add markdown. Do not add extra keys.

OUTPUT FORMAT (no markdown, no explanation — start with { end with }):
{"supplier":{"name":"seller name","confidence":0.95},"vatNumber":{"value":"tax registration number","confidence":0.9},"invoiceNumber":{"value":"invoice number","confidence":0.95},"invoiceDate":{"value":"YYYY-MM-DD","confidence":0.95},"subtotalAmount":{"value":515.85,"confidence":0.98},"vatAmount":{"value":77.30,"confidence":0.98},"totalAmount":{"value":593.22,"confidence":0.98},"items":[{"name":"item name as printed","quantity":5,"unitPrice":60.00,"totalPrice":300.00,"confidence":0.90}]}

SAUDI VAT INVOICE STRUCTURE — CRITICAL:
Saudi tax invoices have THREE separate totals at the bottom:
  1. subtotalAmount (المجموع قبل الضريبة / Taxable Amount) — sum of all line items BEFORE VAT
  2. vatAmount (ضريبة القيمة المضافة / VAT 15%) — the tax amount
  3. totalAmount (الإجمالي شامل الضريبة / Total with VAT) — subtotalAmount + vatAmount
ALWAYS extract all three.
For line items, extract unitPrice/totalPrice exactly as printed on the line:
  - If line values are VAT-inclusive, keep them VAT-inclusive.
  - If line values are before VAT, keep them before VAT.
Do NOT force-convert line prices between inclusive/exclusive VAT.
Verify: subtotalAmount + vatAmount ≈ totalAmount

MATH RULES FOR LINE ITEMS:
- Every item: totalPrice = quantity × unitPrice (within 1%)
- If conflict: totalPrice printed on invoice is truth → recalculate the other value
- "12x1-L" or "12x1L" = quantity:12, size:1L — NOT quantity:0.5
- "6x500ml" = quantity:6, size:500ml
- Carton/pack quantities like "24PCS" = quantity:24

GENERAL RULES:
- Return ONLY valid JSON starting with {
- confidence 0.0–1.0 per field
- use null only when value is truly unreadable
- supplier.name: use the official seller / company name in the invoice header (الاسم التجاري أو اسم المنشأة كما في الترويسة)، not branch nicknames if both appear.
- supplier.name MUST be a clean company name only (max 70 chars). Never include explanations, reasoning, or instruction-like text.
- NEVER output phrases like: "using", "as per instructions", "re-evaluating", "combined for clarity", or any commentary in supplier.name.
- vatNumber: the seller VAT / tax registration number from the header (digits only in value).
- Keep item names exactly as printed (Arabic, English, or mixed)
- Date: YYYY-MM-DD format
- Numbers only (no currency symbols, no commas)
- Extract ALL line items — do not skip any
- Common OCR confusion handling:
  - O↔0, I↔1, S↔5 in VAT/invoice numbers
  - Arabic-Indic digits to western digits
  - If uncertain between two values, choose the one that keeps invoice math consistent
- Never invent lines, supplier names, or numbers that are not visible`;

export const OCR_EXTRACTION_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    supplier: {
      type: 'OBJECT',
      properties: {
        name: { type: 'STRING' },
        confidence: { type: 'NUMBER' },
      },
    },
    vatNumber: {
      type: 'OBJECT',
      properties: {
        value: { type: 'STRING' },
        confidence: { type: 'NUMBER' },
      },
    },
    invoiceNumber: {
      type: 'OBJECT',
      properties: {
        value: { type: 'STRING' },
        confidence: { type: 'NUMBER' },
      },
    },
    invoiceDate: {
      type: 'OBJECT',
      properties: {
        value: { type: 'STRING' },
        confidence: { type: 'NUMBER' },
      },
    },
    subtotalAmount: {
      type: 'OBJECT',
      properties: {
        value: { type: 'NUMBER' },
        confidence: { type: 'NUMBER' },
      },
    },
    totalAmount: {
      type: 'OBJECT',
      properties: {
        value: { type: 'NUMBER' },
        confidence: { type: 'NUMBER' },
      },
    },
    vatAmount: {
      type: 'OBJECT',
      properties: {
        value: { type: 'NUMBER' },
        confidence: { type: 'NUMBER' },
      },
    },
    items: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING' },
          quantity: { type: 'NUMBER' },
          unitPrice: { type: 'NUMBER' },
          totalPrice: { type: 'NUMBER' },
          confidence: { type: 'NUMBER' },
        },
      },
    },
  },
} as const;
