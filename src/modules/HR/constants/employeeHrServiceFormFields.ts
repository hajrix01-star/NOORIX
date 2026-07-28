/**
 * حقول النموذج حسب نوع خدمة الموظف
 */
export const VISA_DURATION_MONTHS = [1, 2, 3, 4, 5];

type TFunction = (key: string, ...args: Array<string | number>) => string;
type HrServiceRow = {
  serviceCategory?: string | null;
  referenceLabel?: string | null;
  iqamaNumber?: string | null;
  expiryDate?: string | null;
  transactionDate?: string | null;
  metadata?: Record<string, unknown> | null;
};

export function requiresExpiryDate(category: string | null | undefined) {
  return ['iqama_new', 'iqama_renewal', 'medical_insurance', 'health_certificate'].includes(String(category || ''));
}

export function showsIssueDate(category: string | null | undefined) {
  return ['iqama_new', 'iqama_renewal', 'medical_insurance', 'health_certificate'].includes(String(category || ''));
}

export function showsVisaDurationMonths(category: string | null | undefined) {
  return category === 'exit_reentry_visa';
}

export function requiresVisaDurationMonths(category: string | null | undefined) {
  return showsVisaDurationMonths(category);
}

export function showsReferenceLabel(category: string | null | undefined) {
  return ['flight_ticket', 'medical_insurance'].includes(String(category || ''));
}

export function parseVisaDurationMonths(residency: { metadata?: Record<string, unknown> | null } | null | undefined) {
  const raw = residency?.metadata?.visaDurationMonths ?? residency?.metadata?.visa_duration_months;
  const n = Number(raw);
  if (Number.isInteger(n) && n >= 1 && n <= 5) return String(n);
  return '';
}

export function visaDurationLabel(months: string | number | null | undefined, t: TFunction) {
  const n = Number(months);
  if (!Number.isInteger(n) || n < 1 || n > 5) return '—';
  const key = `hrServiceVisaDuration${n}Month`;
  return t(key) || `${n}`;
}

export function formatHrServiceDetail(row: HrServiceRow | null | undefined, t: TFunction) {
  const cat = row?.serviceCategory || 'iqama_renewal';
  const metadata = row?.metadata || {};
  if (cat === 'exit_reentry_visa') {
    const m = metadata.visaDurationMonths as string | number | null | undefined;
    if (m) return visaDurationLabel(m, t);
    return row?.referenceLabel || '—';
  }
  if (cat === 'sponsorship_transfer') {
    return row?.referenceLabel || '—';
  }
  if (cat === 'health_certificate') {
    const certificateNumber = row?.referenceLabel || '—';
    return `${certificateNumber} — ${t('hrServiceMunicipalitiesMinistry')}`;
  }
  if (cat === 'flight_ticket' || cat === 'medical_insurance') {
    return row?.referenceLabel || '—';
  }
  return row?.iqamaNumber || row?.referenceLabel || '—';
}

/** عمود التاريخ الثانوي في الجدول (انتهاء أو مدة) */
export function formatHrServiceSecondaryDate(
  row: HrServiceRow | null | undefined,
  t: TFunction,
  formatSaudiDate: (value: string) => string,
) {
  const cat = row?.serviceCategory || 'iqama_renewal';
  const metadata = row?.metadata || {};
  if (cat === 'exit_reentry_visa') {
    const m = metadata.visaDurationMonths as string | number | null | undefined;
    if (m) return visaDurationLabel(m, t);
    return '—';
  }
  if (requiresExpiryDate(cat) && row?.expiryDate) {
    return formatSaudiDate(row?.expiryDate);
  }
  if (row?.transactionDate) return formatSaudiDate(row?.transactionDate);
  return '—';
}


