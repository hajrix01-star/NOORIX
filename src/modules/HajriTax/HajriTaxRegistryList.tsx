/**
 * سجل الإقرارات الضريبية — فلاتر + جدول صفوف + إقرار جديد
 */
import React, { useMemo, useState } from 'react';
import { Button, Input } from '../../ui';
import { fmtTax } from '../../utils/format';
import { computeNetPayable, defaultDisclosureData } from '../../constants/taxDisclosure';

export default function HajriTaxRegistryList({
  t,
  lang,
  companies,
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
  jsonToolbar,
}: any) {
  const yearOptions = useMemo(
    () => ['', currentYear, currentYear - 1, currentYear - 2, currentYear - 3, currentYear - 4],
    [currentYear],
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
        <div className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end lg:gap-4">
          <Input
            type="select"
            label={t('vatFilterCompany')}
            value={filterCompanyId}
            onChange={(e: any) => setFilterCompanyId(e.target.value)}
            className="min-w-[200px]"
          >
            <option value="">{t('vatAllCompanies')}</option>
            {(companies || []).map((c: any) => (
              <option key={c.id} value={c.id}>
                {lang === 'en' ? (c.nameEn || c.nameAr) : c.nameAr}
              </option>
            ))}
          </Input>
          <Input
            type="select"
            label={t('reportYear')}
            value={filterYear === '' ? '' : String(filterYear)}
            onChange={(e: any) => {
              const v = e.target.value;
              setFilterYear(v === '' ? '' : Number(v));
            }}
            className="min-w-[120px]"
          >
            <option value="">{t('hajriTaxFilterAllYears')}</option>
            {yearOptions.filter((y: any) => y !== '').map((y: any) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </Input>
          <Input
            type="select"
            label={t('vatQuarter')}
            value={filterQuarter === '' ? '' : String(filterQuarter)}
            onChange={(e: any) => {
              const v = e.target.value;
              setFilterQuarter(v === '' ? '' : Number(v));
            }}
            className="min-w-[120px]"
          >
            <option value="">{t('hajriTaxFilterAllQuarters')}</option>
            {[1, 2, 3, 4].map((q: any) => (
              <option key={q} value={q}>
                {lang === 'ar' ? `الربع ${q}` : `Q${q}`}
              </option>
            ))}
          </Input>
        </div>
      </div>

      {jsonToolbar ? <div className="flex flex-wrap gap-2 items-center">{jsonToolbar}</div> : null}

      {registryLoading ? (
        <div className="text-[14px] text-noorix-muted">{t('loading')}</div>
      ) : !registryRows?.length ? (
        <div className="noorix-surface-card p-10 text-center text-[14px] text-noorix-muted">{t('hajriTaxRegistryEmpty')}</div>
      ) : (
        <div className="noorix-surface-card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] table-fixed border-collapse text-[14px]">
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
                    {t('vatNetPayable')}
                  </th>
                  <th className="border-b border-noorix-border bg-[var(--noorix-table-header-bg)] px-3 py-3 text-end font-bold nx-font-numbers">
                    {t('vatPaymentTarget')}
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
                {registryRows.map((row: any) => {
                  const nm =
                    lang === 'en'
                      ? row.company?.nameEn || row.company?.nameAr
                      : row.company?.nameAr || row.company?.nameEn;
                  const payload =
                    row.payload && typeof row.payload === 'object' ? row.payload : defaultDisclosureData();
                  const net = computeNetPayable(payload);
                  const pt = row.paymentTarget != null ? parseFloat(String(row.paymentTarget)) : null;
                  const updated = row.updatedAt ? String(row.updatedAt).slice(0, 19) : '—';
                  return (
                    <tr key={row.id} className="hover:bg-[var(--noorix-blue-6)]/40">
                      <td className="border-b border-noorix-border px-3 py-2.5 truncate" title={nm}>
                        {nm}
                      </td>
                      <td className="border-b border-noorix-border px-3 py-2.5 text-end nx-font-numbers">{row.year}</td>
                      <td className="border-b border-noorix-border px-3 py-2.5 text-end font-medium">Q{row.quarter}</td>
                      <td className="border-b border-noorix-border px-3 py-2.5 text-end nx-font-numbers">{fmtTax(net)}</td>
                      <td className="border-b border-noorix-border px-3 py-2.5 text-end nx-font-numbers">
                        {Number.isFinite(pt) ? fmtTax(pt) : '—'}
                      </td>
                      <td className="border-b border-noorix-border px-3 py-2.5 text-end text-[12px] text-noorix-muted">
                        {updated}
                      </td>
                      <td className="sticky end-0 border-b border-noorix-border bg-noorix-surface px-3 py-2 text-end shadow-[inset_1px_0_0_var(--noorix-border)]">
                        <div className="flex flex-wrap justify-end gap-2">
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
