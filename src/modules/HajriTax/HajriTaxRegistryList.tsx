/**
 * سجل الإقرارات الضريبية — فلاتر + جدول صفوف + إقرار جديد
 */
import React, { useMemo, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { Button, FilterToolbar, SearchableOptionsPicker } from '../../ui';
import { fmt, fmtTax } from '../../utils/format';
import { computeNetPayable } from '../../constants/taxDisclosure';
import {
  buildCompanyFilterSelectOptions,
  isHajriDeclarationSubmitted,
  registryInputVat,
  registryOutputVat,
  registryPayload,
  registryPurchasesAmount,
  registrySalesAmount,
} from './hajriRegistryMetrics';
import type {
  HajriTaxCompanyRef,
  HajriTaxLanguage,
  HajriTaxTranslate,
  VatPlanningRecord,
} from '../../types/api/domains/hajriTax';

type HajriTaxRegistryListProps = {
  t: HajriTaxTranslate;
  lang: HajriTaxLanguage;
  companies: HajriTaxCompanyRef[];
  filterYearOptions: number[];
  currentYear: number;
  registryRows: VatPlanningRecord[];
  registryLoading: boolean;
  filterYear: number | '';
  setFilterYear: Dispatch<SetStateAction<number | ''>>;
  filterQuarter: number | '';
  setFilterQuarter: Dispatch<SetStateAction<number | ''>>;
  filterCompanyId: string;
  setFilterCompanyId: Dispatch<SetStateAction<string>>;
  onNewDeclaration: () => void;
  onViewRow: (row: VatPlanningRecord) => void;
  onEditRow: (row: VatPlanningRecord) => void;
  onRegistryFilingChange: (row: VatPlanningRecord, next: boolean) => void | Promise<void>;
  filingBusyRowId: string | null;
  jsonToolbar?: ReactNode;
};

export default function HajriTaxRegistryList({
  t,
  lang,
  companies,
  /** خيارات سنة الفلتر — إن وُجدت تُستخدم بدل القائمة الثابتة (سنوات إضافية من السجل) */
  filterYearOptions,
  currentYear,
  registryRows,
  registryLoading,
  filterYear,
  setFilterYear,
  filterQuarter,
  setFilterQuarter,
  filterCompanyId,
  setFilterCompanyId,
  onNewDeclaration,
  onViewRow,
  onEditRow,
  onRegistryFilingChange,
  filingBusyRowId,
  jsonToolbar,
}: HajriTaxRegistryListProps) {
  const yearOptions = useMemo(() => {
    if (Array.isArray(filterYearOptions) && filterYearOptions.length > 0) {
      return ['', ...filterYearOptions];
    }
    return ['', currentYear, currentYear - 1, currentYear - 2, currentYear - 3, currentYear - 4];
  }, [filterYearOptions, currentYear]);

  const companyFilterOptions = useMemo(
    () => buildCompanyFilterSelectOptions(companies || [], lang),
    [companies, lang],
  );

  return (
    <div className="grid gap-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div>
          <h3 className="m-0 text-[16px] font-bold text-noorix-text">{t('hajriTaxRegistryTitle')}</h3>
          <p className="mt-1 text-[13px] text-noorix-muted">{t('hajriTaxRegistrySubtitle')}</p>
        </div>
        <Button type="button" variant="primary" size="sm" onClick={onNewDeclaration}>
          {t('hajriTaxNewDeclaration')}
        </Button>
      </div>

      <div className="noorix-surface-card p-4">
        <p className="mb-3 text-[13px] font-semibold text-noorix-text">{t('hajriTaxRegistryFilters')}</p>
        <FilterToolbar
          filtersClassName="gap-4 lg:items-end"
        >
          <div className="w-full min-w-0 lg:w-[min(100%,16rem)]">
            <SearchableOptionsPicker
              label={t('vatFilterCompany')}
              allowEmpty
              emptyValue=""
              emptyLabel={t('vatAllCompanies')}
              value={filterCompanyId}
              onChange={setFilterCompanyId}
              options={companyFilterOptions.map((opt) => ({ value: opt.id, label: opt.label }))}
              aria-label={t('vatFilterCompany')}
            />
          </div>
          <div className="w-full min-w-0 lg:w-32">
            <SearchableOptionsPicker
              label={t('reportYear')}
              allowEmpty
              emptyValue=""
              emptyLabel={t('hajriTaxFilterAllYears')}
              value={filterYear === '' ? '' : String(filterYear)}
              onChange={(v) => setFilterYear(v === '' ? '' : Number(v))}
              options={yearOptions
                .filter((y) => y !== '')
                .map((y) => ({ value: String(y), label: String(y) }))}
              aria-label={t('reportYear')}
            />
          </div>
          <div className="w-full min-w-0 lg:w-36">
            <SearchableOptionsPicker
              label={t('vatQuarter')}
              allowEmpty
              emptyValue=""
              emptyLabel={t('hajriTaxFilterAllQuarters')}
              value={filterQuarter === '' ? '' : String(filterQuarter)}
              onChange={(v) => setFilterQuarter(v === '' ? '' : Number(v))}
              options={[1, 2, 3, 4].map((q) => ({
                value: String(q),
                label: lang === 'ar' ? `الربع ${q}` : `Q${q}`,
              }))}
              aria-label={t('vatQuarter')}
            />
          </div>
        </FilterToolbar>
      </div>

      {jsonToolbar ? (
        <FilterToolbar variant="execution">
          {jsonToolbar}
        </FilterToolbar>
      ) : null}

      {registryLoading ? (
        <div className="text-[14px] text-noorix-muted">{t('loading')}</div>
      ) : !registryRows?.length ? (
        <div className="noorix-surface-card p-10 text-center text-[14px] text-noorix-muted">{t('hajriTaxRegistryEmpty')}</div>
      ) : (
        <div className="noorix-surface-card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1480px] table-fixed border-collapse text-[14px]">
              <thead>
                <tr>
                  <th className="border-b border-noorix-border bg-[var(--noorix-table-header-bg)] px-3 py-3 text-end font-bold">
                    {lang === 'ar' ? 'الشركة' : 'Company'}
                  </th>
                  <th className="border-b border-noorix-border bg-[var(--noorix-table-header-bg)] px-3 py-3 text-end font-bold">
                    {t('reportYear')}
                  </th>
                  <th className="border-b border-noorix-border bg-[var(--noorix-table-header-bg)] px-3 py-3 text-end font-bold">
                    {t('vatQuarter')}
                  </th>
                  <th className="border-b border-noorix-border bg-[var(--noorix-table-header-bg)] px-3 py-3 text-end font-bold nx-font-numbers">
                    {t('hajriTaxColSales')}
                  </th>
                  <th className="border-b border-noorix-border bg-[var(--noorix-table-header-bg)] px-3 py-3 text-end font-bold nx-font-numbers">
                    {t('hajriTaxColPurchases')}
                  </th>
                  <th className="border-b border-noorix-border bg-[var(--noorix-table-header-bg)] px-3 py-3 text-end font-bold nx-font-numbers">
                    {t('hajriTaxColOutputVat')}
                  </th>
                  <th className="border-b border-noorix-border bg-[var(--noorix-table-header-bg)] px-3 py-3 text-end font-bold nx-font-numbers">
                    {t('hajriTaxColInputVat')}
                  </th>
                  <th className="border-b border-noorix-border bg-[var(--noorix-table-header-bg)] px-3 py-3 text-end font-bold nx-font-numbers">
                    {t('vatNetPayable')}
                  </th>
                  <th className="border-b border-noorix-border bg-[var(--noorix-table-header-bg)] px-3 py-3 text-end font-bold nx-font-numbers">
                    {t('vatPaymentTarget')}
                  </th>
                  <th className="border-b border-noorix-border bg-[var(--noorix-table-header-bg)] px-3 py-3 text-end font-bold">
                    {t('hajriTaxColFiling')}
                  </th>
                  <th className="border-b border-noorix-border bg-[var(--noorix-table-header-bg)] px-3 py-3 text-end font-bold">
                    {t('vatLastUpdated')}
                  </th>
                  <th className="sticky end-0 border-b border-noorix-border bg-[var(--noorix-table-header-bg)] px-3 py-3 text-end font-bold shadow-[inset_1px_0_0_var(--noorix-border)]">
                    {lang === 'ar' ? 'إجراءات' : 'Actions'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {registryRows.map((row) => {
                  const nm =
                    lang === 'en'
                      ? row.company?.nameEn || row.company?.nameAr
                      : row.company?.nameAr || row.company?.nameEn;
                  const payload = registryPayload(row);
                  const net = computeNetPayable(payload);
                  const pt = row.paymentTarget != null ? parseFloat(String(row.paymentTarget)) : null;
                  const updated = row.updatedAt ? String(row.updatedAt).slice(0, 19) : '—';
                  const sales = registrySalesAmount(payload);
                  const purchases = registryPurchasesAmount(payload);
                  const outVat = registryOutputVat(payload);
                  const inVat = registryInputVat(payload);
                  const submitted = isHajriDeclarationSubmitted(row);
                  return (
                    <tr key={row.id} className="hover:bg-[var(--noorix-blue-6)]/40">
                      <td className="border-b border-noorix-border px-3 py-2.5 truncate" title={nm ?? undefined}>
                        {nm}
                      </td>
                      <td className="border-b border-noorix-border px-3 py-2.5 text-end nx-font-numbers">{row.year}</td>
                      <td className="border-b border-noorix-border px-3 py-2.5 text-end font-medium">Q{row.quarter}</td>
                      <td className="border-b border-noorix-border px-3 py-2.5 text-end nx-font-numbers whitespace-nowrap">
                        {fmt(sales)} <span className="nx-sar">SR</span>
                      </td>
                      <td className="border-b border-noorix-border px-3 py-2.5 text-end nx-font-numbers whitespace-nowrap">
                        {fmt(purchases)} <span className="nx-sar">SR</span>
                      </td>
                      <td className="border-b border-noorix-border px-3 py-2.5 text-end nx-font-numbers whitespace-nowrap">
                        {fmtTax(outVat)} <span className="nx-sar">SR</span>
                      </td>
                      <td className="border-b border-noorix-border px-3 py-2.5 text-end nx-font-numbers whitespace-nowrap">
                        {fmtTax(inVat)} <span className="nx-sar">SR</span>
                      </td>
                      <td className="border-b border-noorix-border px-3 py-2.5 text-end nx-font-numbers whitespace-nowrap">
                        {fmtTax(net)} <span className="nx-sar">SR</span>
                      </td>
                      <td className="border-b border-noorix-border px-3 py-2.5 text-end nx-font-numbers whitespace-nowrap">
                        {Number.isFinite(pt) ? (
                          <>
                            {fmtTax(pt)} <span className="nx-sar">SR</span>
                          </>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="border-b border-noorix-border px-3 py-2.5 text-end">
                        {submitted ? (
                          <span className="inline-block rounded border border-emerald-200/90 bg-emerald-50 px-2 py-0.5 text-[12px] font-semibold text-emerald-900">
                            {t('hajriTaxSubmittedYes')}
                          </span>
                        ) : (
                          <span className="inline-block rounded border border-noorix-border bg-[var(--noorix-table-header-bg)] px-2 py-0.5 text-[12px] font-medium text-white">
                            {t('hajriTaxSubmittedNo')}
                          </span>
                        )}
                      </td>
                      <td className="border-b border-noorix-border px-3 py-2.5 text-end text-[12px] text-noorix-muted">
                        {updated}
                      </td>
                      <td className="sticky end-0 border-b border-noorix-border bg-noorix-surface px-3 py-2 text-end shadow-[inset_1px_0_0_var(--noorix-border)]">
                        <div className="flex flex-wrap justify-end gap-2">
                          {onRegistryFilingChange ? (
                            submitted ? (
                              <Button
                                type="button"
                                variant="warning"
                                size="sm"
                                loading={filingBusyRowId === row.id}
                                disabled={filingBusyRowId != null && filingBusyRowId !== row.id}
                                onClick={() => onRegistryFilingChange(row, false)}
                              >
                                {t('hajriTaxReopenFiling')}
                              </Button>
                            ) : (
                              <Button
                                type="button"
                                variant="success"
                                size="sm"
                                loading={filingBusyRowId === row.id}
                                disabled={filingBusyRowId != null && filingBusyRowId !== row.id}
                                onClick={() => onRegistryFilingChange(row, true)}
                              >
                                {t('hajriTaxApproveFiling')}
                              </Button>
                            )
                          ) : null}
                          <Button type="button" variant="ghost" size="sm" onClick={() => onViewRow(row)}>
                            {t('hajriTaxActionView')}
                          </Button>
                          <Button type="button" size="sm" onClick={() => onEditRow(row)}>
                            {t('hajriTaxActionEdit')}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
