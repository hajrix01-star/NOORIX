/**
 * تجميع صافي ضريبة القيمة المضافة من استجابة ‎/reports/tax-vat‎ (نفس بنود TaxReportTab).
 */
export function netVatFromImportedTaxData(d) {
  if (!d || typeof d !== 'object') return null;
  const outVat =
    Number(d.standard_sales?.vat ?? 0) +
    Number(d.special_sales?.vat ?? 0) +
    Number(d.zero_rated_domestic?.vat ?? 0) +
    Number(d.exports?.vat ?? 0) +
    Number(d.exempt_sales?.vat ?? 0);
  const inVat =
    Number(d.standard_purchases?.vat ?? 0) +
    Number(d.imports_customs?.vat ?? 0) +
    Number(d.reverse_charge?.vat ?? 0) +
    Number(d.exempt_purchases?.vat ?? 0);
  return outVat - inVat;
}
