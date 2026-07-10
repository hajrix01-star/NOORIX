import {
  defaultDisclosureData,
  mergeImportedDisclosure,
  normalizeDisclosureDecimals,
  syncVatPlanningSummaryFields,
  type TaxDisclosureData,
} from '../../constants/taxDisclosure';
import { fmtTax } from '../../utils/format';

export function clonePayload(from: unknown): TaxDisclosureData {
  return normalizeDisclosureDecimals(syncVatPlanningSummaryFields(mergeImportedDisclosure(defaultDisclosureData(), from || {})));
}

export function formatLoadedPaymentTarget(paymentTarget: unknown): string {
  if (paymentTarget == null || paymentTarget === '') return '';
  const value = Number(paymentTarget);
  return Number.isFinite(value) && Math.abs(value) > 1e-9 ? String(value) : '';
}

export function fmtDisclosurePrintCell(value: unknown): string {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || Math.abs(numericValue) < 0.0005) return '-';
  return fmtTax(numericValue);
}

export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
