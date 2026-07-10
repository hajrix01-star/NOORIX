import { useMemo, useState } from 'react';
import type { HajriTaxCompanyRef } from '../../types/api/domains/hajriTax';
import { useVatPlanningRegistry, useVatPlanningRegistryMetadata } from '../../hooks/useVatPlanning';

type UseHajriTaxRegistryDataParams = {
  companies: HajriTaxCompanyRef[];
  currentYear: number;
  detailCompanyId: string | null;
  lang: string;
  initialCompanyId: string;
};

export function useHajriTaxRegistryData({
  companies,
  currentYear,
  detailCompanyId,
  lang,
  initialCompanyId,
}: UseHajriTaxRegistryDataParams) {
  const [regFilterCompany, setRegFilterCompany] = useState(initialCompanyId);
  const [regFilterYear, setRegFilterYear] = useState<number | ''>('');
  const [regFilterQuarter, setRegFilterQuarter] = useState<number | ''>('');

  const registryQueryFilters = useMemo(() => {
    const y = regFilterYear === '' ? undefined : Number(regFilterYear);
    const q = regFilterQuarter === '' ? undefined : Number(regFilterQuarter);
    return {
      year: y !== undefined && Number.isFinite(y) && y >= 2000 && y <= 2100 ? y : undefined,
      quarter: q !== undefined && Number.isFinite(q) && q >= 1 && q <= 4 ? q : undefined,
      companyId: regFilterCompany || undefined,
    };
  }, [regFilterYear, regFilterQuarter, regFilterCompany]);

  const { data: registryRows = [], isLoading: registryLoading, refetch: refetchRegistry } = useVatPlanningRegistry(
    registryQueryFilters,
    !detailCompanyId,
  );
  const { data: registryMetadata } = useVatPlanningRegistryMetadata(!detailCompanyId);

  const registryFilterCompanies = useMemo(() => {
    const map = new Map<string, HajriTaxCompanyRef>();
    const seed =
      registryMetadata?.companies && registryMetadata.companies.length > 0
        ? registryMetadata.companies
        : companies || [];

    seed.forEach((company) => {
      const isArchived = company.isArchived === true;
      if (!company.id || isArchived) return;
      map.set(company.id, {
        id: company.id,
        nameAr: company.nameAr,
        nameEn: company.nameEn ?? null,
        name: company.name ?? null,
        taxNumber: company.taxNumber ?? null,
      });
    });

    const collator = lang === 'ar' ? 'ar' : 'en';
    return Array.from(map.values()).sort((a, b) =>
      (a.nameAr || a.name || a.nameEn || '').localeCompare(b.nameAr || b.name || b.nameEn || '', collator),
    );
  }, [companies, lang, registryMetadata]);

  const registryFilterYearOptions = useMemo(() => {
    const years = new Set([currentYear, currentYear - 1, currentYear - 2, currentYear - 3, currentYear - 4]);
    (registryMetadata?.years || []).forEach((year) => {
      if (Number.isFinite(year) && year >= 2000) years.add(year);
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [currentYear, registryMetadata]);

  return {
    registryRows,
    registryLoading,
    refetchRegistry,
    registryFilterCompanies,
    registryFilterYearOptions,
    regFilterCompany,
    setRegFilterCompany,
    regFilterYear,
    setRegFilterYear,
    regFilterQuarter,
    setRegFilterQuarter,
  };
}
