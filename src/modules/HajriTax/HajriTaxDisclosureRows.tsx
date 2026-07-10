import React from 'react';
import {
  type TaxDisclosureField,
  type TaxDisclosureLineRow,
  type TaxDisclosureRowKey,
} from '../../constants/taxDisclosure';
import { fmtTax } from '../../utils/format';
import type { HajriTaxLanguage, HajriTaxTranslate } from '../../types/api/domains/hajriTax';

type HajriTaxDisclosureRowsProps = {
  rows: readonly TaxDisclosureLineRow[];
  sectionTotal: number;
  lang: HajriTaxLanguage;
  t: HajriTaxTranslate;
  renderEditableCell: (key: TaxDisclosureRowKey, field: TaxDisclosureField) => React.ReactNode;
  totalVatLabelKey?: string;
};

export default function HajriTaxDisclosureRows({
  rows,
  sectionTotal,
  lang,
  t,
  renderEditableCell,
  totalVatLabelKey = 'vatColumnVat',
}: HajriTaxDisclosureRowsProps) {
  return (
    <>
      {rows.map((row) => {
        const label = lang === 'ar' ? row.labelAr : row.labelEn;
        if (row.isTotal) {
          return (
            <div
              key={row.key}
              className="flex flex-col gap-1 border-b border-noorix-border bg-[var(--noorix-navy-4)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <span className="font-bold text-[13px] text-noorix-text">{label}</span>
              <div className="flex flex-wrap items-baseline gap-2 sm:gap-6">
                <span className="text-[11px] text-noorix-muted">{t(totalVatLabelKey)}</span>
                <span className="nx-font-numbers text-[16px] font-bold">
                  {fmtTax(sectionTotal)} <span className="nx-sar text-[13px]">SR</span>
                </span>
              </div>
            </div>
          );
        }
        return (
          <div
            key={row.key}
            className="grid grid-cols-1 items-center gap-2 border-b border-noorix-border px-4 py-3 sm:grid-cols-[minmax(0,2fr)_1fr_1fr_88px]"
          >
            <div className="min-w-0 text-[13px] leading-snug text-noorix-text">{label}</div>
            <div className="min-w-0">{renderEditableCell(row.key, 'amount')}</div>
            <div className="min-w-0">{renderEditableCell(row.key, 'vat')}</div>
            <div className="min-w-0">{renderEditableCell(row.key, 'adjustment')}</div>
          </div>
        );
      })}
    </>
  );
}
