/**
 * تفاصيل ضريبة شركة واحدة: ملخص مبيعات/مشتريات/مصروفات + سجل إقرارات بالفلترة.
 */
import React, { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQueries } from '@tanstack/react-query';
import { useTranslation } from '../../i18n/useTranslation';
import { useApp } from '../../context/AppContext';
import { usePeriodAnalytics } from '../../hooks/useReports';
import { getTaxVatReport, throwIfApiFailed } from '../../services/api';
import { fmt } from '../../utils/format';
import { netVatFromImportedTaxData } from './taxVatHelpers';
import { Button, Input } from '../../ui';

function periodLabel(lang, code) {
  if (code.startsWith('Q')) {
    const n = code.slice(1);
    return lang === 'ar' ? `الربع ${n}` : `Q${n}`;
  }
  if (code.startsWith('M')) {
    const m = parseInt(code.slice(1), 10);
    const ar = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
    const en = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return lang === 'ar' ? ar[m - 1] : en[m - 1];
  }
  return code;
}

export default function TaxCompanyDetailScreen() {
  const { companyId } = useParams();
  const { t, lang } = useTranslation();
  const { companies } = useApp();
  const currentYear = new Date().getFullYear();
  const [summaryYear, setSummaryYear] = useState(currentYear);
  const [historyYear, setHistoryYear] = useState(currentYear);
  const [historyGranularity, setHistoryGranularity] = useState('quarterly');

  const company = useMemo(
    () => (Array.isArray(companies) ? companies.find((c) => c.id === companyId) : null),
    [companies, companyId],
  );

  const from = `${summaryYear}-01-01`;
  const to = `${summaryYear}-12-31`;

  const { data: periodData, isLoading: periodLoading, isError: periodError } = usePeriodAnalytics({
    companyId,
    startDate: from,
    endDate: to,
    enabled: !!companyId,
  });

  const totalsByKind = periodData?.totalsByKind || {};
  const sumKind = (k) => Number(totalsByKind[k]?.totalAmount ?? 0);
  const salesTotal = sumKind('sale');
  const purchaseTotal = sumKind('purchase');
  const expensesTotal =
    sumKind('expense') + sumKind('fixed_expense') + sumKind('hr_expense');

  const periodCodes = useMemo(() => {
    if (historyGranularity === 'monthly') {
      return Array.from({ length: 12 }, (_, i) => `M${i + 1}`);
    }
    return ['Q1', 'Q2', 'Q3', 'Q4'];
  }, [historyGranularity]);

  const declQueries = useQueries({
    queries: periodCodes.map((period) => ({
      queryKey: ['reports', 'tax-vat', companyId, historyYear, period],
      queryFn: async () => {
        const res = await getTaxVatReport(companyId, historyYear, period);
        throwIfApiFailed(res, t('loadingError'));
        return res.data;
      },
      enabled: !!companyId,
      staleTime: 60_000,
    })),
  });

  const declarationRows = periodCodes.map((code, i) => {
    const q = declQueries[i];
    const net = q.data ? netVatFromImportedTaxData(q.data) : null;
    return {
      code,
      label: periodLabel(lang, code),
      netVat,
      loading: q.isLoading,
      error: q.isError,
    };
  });

  if (!companyId) {
    return (
      <div className="text-sm text-[var(--noorix-text-muted)]">{t('loadingError')}</div>
    );
  }

  if (!company) {
    return (
      <div className="flex flex-col gap-3 items-start">
        <p className="text-sm text-[var(--noorix-text-muted)] m-0">{t('taxHubCompanyNotFound')}</p>
        <Link to="/hajri-tax" className="inline-flex">
          <Button type="button" variant="default">
            {t('taxHubBackToList')}
          </Button>
        </Link>
      </div>
    );
  }

  const companyName = lang === 'en' ? company.nameEn || company.nameAr : company.nameAr || company.nameEn;

  return (
    <div className="flex flex-col gap-6 min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <Link to="/hajri-tax" className="text-[13px] text-[var(--noorix-blue)] no-underline hover:underline">
            ← {t('taxHubBackToList')}
          </Link>
          <h2 className="text-lg font-bold text-[var(--noorix-text)] m-0 mt-1">{companyName}</h2>
          <p className="text-[13px] text-[var(--noorix-text-muted)] m-0 mt-1">
            {t('taxNumber')}: {company.taxNumber || '—'}
          </p>
        </div>
        <Link to="/reports/tax">
          <Button type="button" variant="ghost" className="border border-[var(--noorix-border)]">
            {t('taxHubOpenDisclosureForm')}
          </Button>
        </Link>
      </div>

      <section aria-labelledby="tax-summary-heading">
        <h3 id="tax-summary-heading" className="text-[15px] font-bold m-0 mb-3">
          {t('taxHubFlowSummary')} — {summaryYear}
        </h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-[var(--noorix-border)] bg-[var(--noorix-bg-surface)] p-4">
            <div className="text-[12px] text-[var(--noorix-text-muted)] mb-1">{t('categoryTypeSale')}</div>
            <div className="text-[18px] font-bold nx-font-numbers text-end">{periodLoading ? '…' : fmt(salesTotal, 2)}</div>
          </div>
          <div className="rounded-xl border border-[var(--noorix-border)] bg-[var(--noorix-bg-surface)] p-4">
            <div className="text-[12px] text-[var(--noorix-text-muted)] mb-1">{t('categoryTypes')}</div>
            <div className="text-[18px] font-bold nx-font-numbers text-end">{periodLoading ? '…' : fmt(purchaseTotal, 2)}</div>
          </div>
          <div className="rounded-xl border border-[var(--noorix-border)] bg-[var(--noorix-bg-surface)] p-4">
            <div className="text-[12px] text-[var(--noorix-text-muted)] mb-1">{t('taxHubExpensesCombined')}</div>
            <div className="text-[18px] font-bold nx-font-numbers text-end">{periodLoading ? '…' : fmt(expensesTotal, 2)}</div>
          </div>
        </div>
        {periodError && (
          <p className="text-[13px] text-[var(--noorix-red)] mt-2 m-0">{t('loadDataFailed')}</p>
        )}
        <div className="mt-3 max-w-[200px]">
          <Input
            type="select"
            label={t('reportYear')}
            value={summaryYear}
            onChange={(e) => setSummaryYear(Number(e.target.value))}
          >
            {[currentYear, currentYear - 1, currentYear - 2, currentYear - 3].map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </Input>
        </div>
      </section>

      <section aria-labelledby="tax-decl-heading">
        <div className="flex flex-col lg:flex-row lg:items-end gap-3 flex-wrap justify-between">
          <h3 id="tax-decl-heading" className="text-[15px] font-bold m-0">
            {t('taxHubDeclarationsHistory')}
          </h3>
          <div className="flex flex-wrap gap-3 items-end">
            <div className="w-[140px]">
              <Input
                type="select"
                label={t('reportYear')}
                value={historyYear}
                onChange={(e) => setHistoryYear(Number(e.target.value))}
              >
                {[currentYear, currentYear - 1, currentYear - 2, currentYear - 3, currentYear - 4].map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </Input>
            </div>
            <div className="w-[180px]">
              <Input
                type="select"
                label={t('taxHubFilterGranularity')}
                value={historyGranularity}
                onChange={(e) => setHistoryGranularity(e.target.value)}
              >
                <option value="quarterly">{t('taxHubPeriodQuarterly')}</option>
                <option value="monthly">{t('taxHubPeriodMonthly')}</option>
              </Input>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-[var(--noorix-border)] mt-3">
          <table className="w-full min-w-[400px] border-collapse text-[14px]">
            <thead>
              <tr className="bg-[var(--noorix-bg-surface)] border-b border-[var(--noorix-border)]">
                <th className="text-start font-bold py-3 px-3 border-e border-[var(--noorix-border)]">{t('taxHubDeclPeriod')}</th>
                <th className="text-end font-bold py-3 px-3">{t('taxHubNetVat')}</th>
              </tr>
            </thead>
            <tbody>
              {declarationRows.map((row) => (
                <tr key={row.code} className="border-b border-[var(--noorix-border)]">
                  <td className="py-2.5 px-3 border-e border-[var(--noorix-border)]">
                    {row.label} ({historyYear})
                  </td>
                  <td className="py-2.5 px-3 text-end nx-font-numbers font-semibold">
                    {row.loading && '…'}
                    {!row.loading && row.error && '—'}
                    {!row.loading && !row.error && row.netVat != null && fmt(row.netVat, 2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[12px] text-[var(--noorix-text-muted)] m-0 mt-2">{t('taxHubDeclHint')}</p>
      </section>
    </div>
  );
}
