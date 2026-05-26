import {
  defaultDisclosureData,
  mergeImportedDisclosure,
  normalizeDisclosureDecimals,
  syncVatPlanningSummaryFields,
} from '../../constants/taxDisclosure';
import { fmtTax } from '../../utils/format';

export function clonePayload(from: any) {
  return normalizeDisclosureDecimals(syncVatPlanningSummaryFields(mergeImportedDisclosure(defaultDisclosureData(), from || {})));
}

export function formatLoadedPaymentTarget(pt: any): string {
  if (pt == null || pt === '') return '';
  const n = Number(pt);
  return Number.isFinite(n) && Math.abs(n) > 1e-9 ? String(n) : '';
}

export function fmtDisclosurePrintCell(n: any): string {
  const x = Number(n);
  if (!Number.isFinite(x) || Math.abs(x) < 0.0005) return '—';
  return fmtTax(x);
}
