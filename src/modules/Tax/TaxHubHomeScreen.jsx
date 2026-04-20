/**
 * قائمة الشركات في مركز الضرائب — دخول موحّد لكل شركة.
 */
import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from '../../i18n/useTranslation';
import { useApp } from '../../context/AppContext';
import { Input, Button } from '../../ui';

export default function TaxHubHomeScreen() {
  const { t, lang } = useTranslation();
  const { companies } = useApp();
  const [q, setQ] = useState('');

  const rows = useMemo(() => {
    const list = Array.isArray(companies) ? companies : [];
    const needle = q.trim().toLowerCase();
    if (!needle) return list;
    return list.filter((c) => {
      const a = (c.nameAr || '').toLowerCase();
      const e = (c.nameEn || '').toLowerCase();
      const tax = (c.taxNumber || '').toLowerCase();
      return a.includes(needle) || e.includes(needle) || tax.includes(needle);
    });
  }, [companies, q]);

  return (
    <div className="flex flex-col gap-4 min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-end gap-3 justify-between">
        <div className="max-w-md w-full">
          <Input
            type="text"
            label={t('search')}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={lang === 'ar' ? 'اسم الشركة أو الرقم الضريبي' : 'Company name or VAT number'}
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[var(--noorix-border)]">
        <table className="w-full min-w-[520px] border-collapse text-[14px] table-fixed">
          <thead>
            <tr className="bg-[var(--noorix-bg-surface)] border-b border-[var(--noorix-border)]">
              <th className="text-start font-bold py-3 px-3 border-e border-[var(--noorix-border)]">#</th>
              <th className="text-start font-bold py-3 px-3 border-e border-[var(--noorix-border)]">{t('taxColCompanyName')}</th>
              <th className="text-start font-bold py-3 px-3 border-e border-[var(--noorix-border)]">{t('taxColTaxNumber')}</th>
              <th className="text-end font-bold py-3 px-3 w-[140px]">{t('taxColAction')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="py-8 text-center text-[var(--noorix-text-muted)]">
                  {t('taxHubNoCompanies')}
                </td>
              </tr>
            )}
            {rows.map((c, i) => (
              <tr key={c.id} className="border-b border-[var(--noorix-border)] hover:bg-[var(--noorix-blue-4)]">
                <td className="py-2.5 px-3 text-[var(--noorix-text-muted)] nx-font-numbers border-e border-[var(--noorix-border)]">{i + 1}</td>
                <td className="py-2.5 px-3 font-semibold truncate border-e border-[var(--noorix-border)]" title={lang === 'en' ? c.nameEn || c.nameAr : c.nameAr || c.nameEn}>
                  {lang === 'en' ? c.nameEn || c.nameAr : c.nameAr || c.nameEn}
                </td>
                <td className="py-2.5 px-3 nx-font-numbers border-e border-[var(--noorix-border)]">{c.taxNumber || '—'}</td>
                <td className="py-2.5 px-3 text-end">
                  <Link to={`/hajri-tax/company/${c.id}`} className="inline-flex">
                    <Button type="button" variant="primary" size="sm">
                      {t('taxHubOpenCompany')}
                    </Button>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
