/**
 * حقول النموذج حسب نوع خدمة الموظف
 */
export const VISA_DURATION_MONTHS = [1, 2, 3, 4, 5];

export function requiresExpiryDate(category) {
  return ['iqama_new', 'iqama_renewal', 'medical_insurance'].includes(category);
}

export function showsIssueDate(category) {
  return ['iqama_new', 'iqama_renewal', 'medical_insurance'].includes(category);
}

export function showsVisaDurationMonths(category) {
  return category === 'exit_reentry_visa';
}

export function requiresVisaDurationMonths(category) {
  return showsVisaDurationMonths(category);
}

export function showsReferenceLabel(category) {
  return ['flight_ticket', 'medical_insurance'].includes(category);
}

export function parseVisaDurationMonths(residency) {
  const raw = residency?.metadata?.visaDurationMonths ?? residency?.metadata?.visa_duration_months;
  const n = Number(raw);
  if (Number.isInteger(n) && n >= 1 && n <= 5) return String(n);
  return '';
}

export function visaDurationLabel(months, t) {
  const n = Number(months);
  if (!Number.isInteger(n) || n < 1 || n > 5) return '—';
  const key = `hrServiceVisaDuration${n}Month`;
  return t(key) || `${n}`;
}

export function formatHrServiceDetail(row, t) {
  const cat = row?.serviceCategory || 'iqama_renewal';
  if (cat === 'exit_reentry_visa') {
    const m = row?.metadata?.visaDurationMonths;
    if (m) return visaDurationLabel(m, t);
    return row.referenceLabel || '—';
  }
  if (cat === 'sponsorship_transfer') {
    return row.referenceLabel || '—';
  }
  if (cat === 'flight_ticket' || cat === 'medical_insurance') {
    return row.referenceLabel || '—';
  }
  return row.iqamaNumber || row.referenceLabel || '—';
}

/** عمود التاريخ الثانوي في الجدول (انتهاء أو مدة) */
export function formatHrServiceSecondaryDate(row, t, formatSaudiDate) {
  const cat = row?.serviceCategory || 'iqama_renewal';
  if (cat === 'exit_reentry_visa') {
    const m = row?.metadata?.visaDurationMonths;
    if (m) return visaDurationLabel(m, t);
    return '—';
  }
  if (requiresExpiryDate(cat) && row.expiryDate) {
    return formatSaudiDate(row.expiryDate);
  }
  if (row.transactionDate) return formatSaudiDate(row.transactionDate);
  return '—';
}
