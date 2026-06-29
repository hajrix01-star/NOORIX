/**
 * عرض الأرباع — بطاقات Q1–Q4 مستوحاة من tax-hajri مع ألوان وبطاقات نووريكس
 */
import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { useTranslation } from '../../i18n/useTranslation';
import { getVatPlanningList, unwrapApiList } from '../../services/api';
import { defaultDisclosureData, computeNetPayable } from '../../constants/taxDisclosure';
import { fmtTax } from '../../utils/format';
import { Button } from '../../ui';
import { vatKeys } from '../../services/queryKeys';
import { useApiQueries } from '../../hooks/useApiQuery';

const QUARTER_LABEL_AR = {
  1: 'الربع الأول (يناير – مارس)',
  2: 'الربع الثاني (أبريل – يونيو)',
  3: 'الربع الثالث (يوليو – سبتمبر)',
  4: 'الربع الرابع (أكتوبر – ديسمبر)',
};

export default function HajriTaxQuarterOverview() {
  const navigate = useNavigate();
  const { companies } = useApp();
  const { t, lang } = useTranslation();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [companyId, setCompanyId] = useState(() => companies?.[0]?.id ?? '');

  useEffect(() => {
    if (!companies?.length) return;
    if (companyId && companies.some((c: any) => c.id === companyId)) return;
    setCompanyId(companies[0].id);
  }, [companies, companyId]);

  const years = useMemo(() => [currentYear, currentYear - 1, currentYear - 2, currentYear - 3], [currentYear]);

  const quarterResults = useApiQueries({
    queries: [1, 2, 3, 4].map((q: any) => ({
      queryKey: vatKeys.planning(year, q, companyId),
      queryFn: async () => {
        if (!companyId) return { success: true as const, data: null };
        const res = await getVatPlanningList(year, q, companyId);
        const rows = unwrapApiList<any>(res, 'فشل تحميل السجل');
        return { success: true as const, data: rows[0] ?? null };
      },
      fallbackMessage: 'Failed to load VAT planning record',
      enabled: !!companyId,
    })),
  });

  const loading = quarterResults.some((r: any) => r.isLoading);

  const companyName = useMemo(() => {
    const c = companies?.find((x: any) => x.id === companyId);
    if (!c) return '';
    return lang === 'en' ? (c.nameEn || c.nameAr || '') : (c.nameAr || c.nameEn || '');
  }, [companies, companyId, lang]);

  if (!companies?.length) {
    return (
      <div className="noorix-surface-card p-8 text-center text-noorix-muted text-[14px]">
        {t('pleaseSelectCompany')}
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end lg:justify-between">
        <div>
          <h2 className="text-[16px] font-bold text-noorix-text m-0">{t('hajriTaxQuarterDashboard')}</h2>
          <p className="text-[13px] text-noorix-muted mt-1">{t('hajriTaxQuarterDashboardDesc')}</p>
        </div>
      </div>

      <div>
        <p className="text-[13px] font-semibold text-noorix-text mb-2">{t('vatFilterCompany')}</p>
        <div className="flex flex-wrap gap-2">
          {companies.map((c: any) => {
            const nm = lang === 'en' ? (c.nameEn || c.nameAr) : c.nameAr;
            const active = companyId === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setCompanyId(c.id)}
                className={
                  active
                    ? 'rounded-lg border-2 border-noorix-blue bg-[var(--noorix-blue-7)] px-3 py-2 text-[13px] font-bold text-noorix-blue'
                    : 'rounded-lg border border-noorix-border bg-noorix-surface px-3 py-2 text-[13px] font-medium text-noorix-text hover:border-noorix-blue/40'
                }
              >
                {nm}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className="text-[13px] font-semibold text-noorix-text mb-2">{t('reportYear')}</p>
        <div className="flex flex-wrap gap-2">
          {years.map((y: any) => (
            <button
              key={y}
              type="button"
              onClick={() => setYear(y)}
              className={
                year === y
                  ? 'rounded-lg border-2 border-noorix-blue bg-[var(--noorix-blue-7)] px-3 py-2 text-[13px] font-bold text-noorix-blue'
                  : 'rounded-lg border border-noorix-border bg-noorix-surface px-3 py-2 text-[13px] font-medium hover:border-noorix-blue/40'
              }
            >
              {y}
            </button>
          ))}
        </div>
      </div>

      {companyId ? (
        <div className="rounded-lg border border-noorix-border bg-[var(--noorix-blue-6)] px-4 py-3 text-[13px]">
          <span className="font-semibold text-noorix-blue">{companyName}</span>
          <span className="text-noorix-muted mx-2">·</span>
          <span className="text-noorix-muted">{year}</span>
        </div>
      ) : null}

      {loading ? (
        <div className="text-noorix-muted text-[14px]">{t('loading')}</div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map((q: any, idx: any) => {
            const qr = quarterResults[idx];
            const rec = qr?.data as any;
            const payload =
              rec?.payload && typeof rec.payload === 'object' ? rec.payload : defaultDisclosureData();
            const net = computeNetPayable(payload);
            const hasRecord = !!rec?.id;

            const editHref = `/hajri-tax?company=${encodeURIComponent(companyId)}&year=${year}&quarter=${q}&edit=1`;

            return (
              <div
                key={q}
                className="noorix-surface-card overflow-hidden border border-noorix-border shadow-sm"
              >
                <div
                  className={`h-1.5 ${hasRecord ? 'bg-noorix-blue' : 'bg-[var(--noorix-table-header-bg)]'}`}
                />
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <div className="text-[15px] font-bold text-noorix-text">Q{q}</div>
                      <div className="text-[12px] text-noorix-muted mt-0.5">{QUARTER_LABEL_AR[q as keyof typeof QUARTER_LABEL_AR]}</div>
                    </div>
                    {hasRecord ? (
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-noorix-green">
                        {lang === 'ar' ? 'مسجّل' : 'Saved'}
                      </span>
                    ) : (
                      <span className="text-[11px] text-noorix-muted">{lang === 'ar' ? 'فارغ' : 'Empty'}</span>
                    )}
                  </div>

                  <div
                    className={`rounded-lg border px-3 py-2 mb-4 ${
                      net >= 0 ? 'border-[var(--noorix-accent-red)]/25 bg-[var(--noorix-red-6)]' : 'border-[var(--noorix-accent-green)]/25 bg-[var(--noorix-green-6)]'
                    }`}
                  >
                    <div className="text-[12px] text-noorix-muted">{t('vatNetPayable')}</div>
                    <div
                      className={`text-[18px] font-bold nx-font-numbers ${net >= 0 ? 'text-[var(--noorix-accent-red)]' : 'text-[var(--noorix-accent-green)]'}`}
                    >
                      {fmtTax(net)} <span className="nx-sar text-[13px]">SR</span>
                    </div>
                  </div>

                  <Button
                    size="sm"
                    className="w-full"
                    type="button"
                    onClick={() => navigate(editHref)}
                  >
                    {hasRecord ? t('hajriTaxOpenEdit') : t('hajriTaxCreateOrEdit')}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
