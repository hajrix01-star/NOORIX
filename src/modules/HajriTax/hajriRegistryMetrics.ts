import {
  computeInputTotal,
  computeOutputTotal,
  defaultDisclosureData,
  getRowValue,
  type TaxDisclosureData,
} from '../../constants/taxDisclosure';
import type {
  HajriTaxCompanyRef,
  HajriTaxLanguage,
  VatPlanningRecord,
  VatPlanningSourceSnapshot,
} from '../../types/api/domains/hajriTax';
import { localizedDisplayName } from '../../utils/displayName';

export function registryPayload(row: VatPlanningRecord | null | undefined): TaxDisclosureData {
  return row?.payload && typeof row.payload === 'object' ? row.payload : defaultDisclosureData();
}

export function registrySalesAmount(payload: TaxDisclosureData): number {
  return getRowValue(payload, 'standard_sales', 'amount');
}

export function registryPurchasesAmount(payload: TaxDisclosureData): number {
  return getRowValue(payload, 'standard_purchases', 'amount');
}

export function registryOutputVat(payload: TaxDisclosureData): number {
  return computeOutputTotal(payload);
}

export function registryInputVat(payload: TaxDisclosureData): number {
  return computeInputTotal(payload);
}

export function companyDisplayName(company: HajriTaxCompanyRef | null | undefined, lang: HajriTaxLanguage): string {
  return localizedDisplayName(company, lang, '');
}

export function buildCompanyFilterSelectOptions(
  items: HajriTaxCompanyRef[],
  lang: HajriTaxLanguage,
): Array<{ id: string; label: string }> {
  const baseLabel = (company: HajriTaxCompanyRef) => companyDisplayName(company, lang);
  const counts = new Map<string, number>();
  items.forEach((company) => {
    const label = baseLabel(company);
    if (label) counts.set(label, (counts.get(label) || 0) + 1);
  });

  return items.map((company) => {
    const base = baseLabel(company);
    const duplicated = Boolean(base && (counts.get(base) || 0) > 1);
    let label = base || company.id;
    if (duplicated) {
      const taxNumber = String(company.taxNumber || '').trim();
      label = taxNumber ? `${base} (${taxNumber})` : `${base} · ${company.id.slice(-6)}`;
    }
    return { id: company.id, label };
  });
}

export function isHajriDeclarationSubmitted(row: VatPlanningRecord): boolean {
  if (typeof row.filingSubmitted === 'boolean') {
    return row.filingSubmitted === true;
  }
  const notes = row.notes || '';
  if (/submitted|filed/i.test(notes)) return true;
  const sourceSnapshot: VatPlanningSourceSnapshot | null | undefined = row.sourceSnapshot;
  if (sourceSnapshot && typeof sourceSnapshot === 'object') {
    if (sourceSnapshot.submitted === true) return true;
    if (sourceSnapshot.source === 'seed-vat-planning-history') return true;
  }
  return false;
}
