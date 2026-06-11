/**
 * شريط إرسال تقرير يومي شامل (شفت صباحي + مسائي + المجموع) عبر واتساب
 */
import React, { useState } from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { getSaudiToday, formatSaudiDate, formatSaudiWeekdayName } from '../../../utils/saudiDate';
import { fetchAllSalesSummariesForExport } from '../../../services/api';
import { Button, Input } from '../../../ui';
import {
  aggregateSalesDayByShift,
  buildDailyShiftWhatsAppText,
  openWhatsAppWithText,
} from '../utils/salesDayShiftReport';
import type { SalesSummaryChannelsLike } from '../utils/salesWhatsAppChannels';
import { buildVaultLookup } from '../utils/salesWhatsAppChannels';
import { fetchMonthAppShare } from '../utils/fetchMonthAppShare';
import { useSalesChannels } from '../../../hooks/useSalesChannels';

type Props = {
  companyId: string;
  companyName: string;
  disabled?: boolean;
};

export function SalesDailyWhatsAppReportBar({ companyId, companyName, disabled }: Props) {
  const { t, lang } = useTranslation();
  const { salesChannels } = useSalesChannels(companyId);
  const vaultById = buildVaultLookup(salesChannels);
  const [reportDate, setReportDate] = useState(() => getSaudiToday());
  const [loading, setLoading] = useState(false);

  async function handleSend() {
    if (!companyId || loading) return;
    setLoading(true);
    try {
      const list = await fetchAllSalesSummariesForExport(
        companyId,
        reportDate,
        reportDate,
        undefined,
        'transactionDate',
        'asc',
        false,
        'any',
      );
      const report = aggregateSalesDayByShift(list as any[], reportDate);
      if (report.grand.summaryCount === 0) {
        window.alert(t('salesDailyWaNoDataForDay'));
        return;
      }
      const dateRaw = formatSaudiDate(reportDate);
      let dateLabel = dateRaw;
      if (dateRaw !== '—') {
        const wd = formatSaudiWeekdayName(reportDate, lang);
        if (wd) dateLabel = `${dateRaw} ${wd}`;
      }
      const monthAppShare = await fetchMonthAppShare(companyId, reportDate, vaultById);
      const text = buildDailyShiftWhatsAppText({
        companyName,
        dateLabel,
        report,
        t,
        daySummaries: list as SalesSummaryChannelsLike[],
        dayYmd: reportDate,
        lang,
        vaultById,
        monthAppShare,
      });
      openWhatsAppWithText(text);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : t('salesDailyWaLoadFailed');
      window.alert(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="noorix-surface-card flex flex-col gap-3 p-3 sm:flex-row sm:flex-wrap sm:items-end print:hidden">
      <div className="flex-1 min-w-[min(100%,200px)] max-w-[220px]">
        <Input
          type="date"
          label={t('salesDailyWaPickDay')}
          value={reportDate}
          onChange={(e: any) => setReportDate(e.target.value)}
        />
      </div>
      <Button
        size="sm"
        variant="success"
        disabled={disabled || loading || !companyId}
        onClick={() => void handleSend()}
        className="min-h-[44px] sm:mb-0.5"
      >
        {loading ? t('loading') : t('salesDailyWaSend')}
      </Button>
      <p className="m-0 w-full text-[11px] text-noorix-muted leading-relaxed sm:basis-full">
        {t('salesDailyWaHint')}
      </p>
    </div>
  );
}
