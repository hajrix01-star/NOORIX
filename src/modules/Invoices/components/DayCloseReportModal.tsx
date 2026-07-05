/**
 * تقرير نهاية اليوم — جداول موحّدة + طباعة نظيفة (بدون قوالب التطبيق)
 */
import React, { useMemo, useState, useEffect } from 'react';
import { useApiQuery } from '../../../hooks/useApiQuery';
import { useTranslation } from '../../../i18n/useTranslation';
import { useApp } from '../../../context/AppContext';
import { getInvoiceDayCloseReport, throwIfApiFailed } from '../../../services/api';
import { formatSaudiDateISO, getSaudiToday, toYmd } from '../../../utils/saudiDate';
import { Button, Modal, DateField, Toolbar, cn } from '../../../ui';
import { useToast } from '../../../context/ToastContext';
import { invoiceKeys } from '../../../services/queryKeys';
import { buildDayCloseWhatsAppText, openDayCloseWhatsApp } from '../utils/dayCloseWhatsApp';
import { DayCloseReportBody, MAX_DAY_CLOSE_RANGE_DAYS, enumerateYmdDates } from './DayCloseReportBody';
import { DAY_CLOSE_REPORT_STYLES } from './dayCloseReportStyles';

export default function DayCloseReportModal({ companyId, isOpen, onClose, defaultDateYmd, compact = false }: any) {
  const { t, lang } = useTranslation();
  const reportTitle = t('dayCloseTitle');
  const { companies, activeCompanyId } = useApp();
  const [dateStr, setDateStr] = useState(() => toYmd(defaultDateYmd) || getSaudiToday());

  const companyName = useMemo(() => {
    const c = companies?.find((x: any) => x.id === (activeCompanyId || companyId));
    if (!c) return '';
    return lang === 'en'
      ? (c.nameEn || c.nameAr || c.name || '')
      : (c.nameAr || c.nameEn || c.name || '');
  }, [companies, activeCompanyId, companyId, lang]);

  useEffect(() => {
    if (isOpen) setDateStr(toYmd(defaultDateYmd) || getSaudiToday());
  }, [isOpen, defaultDateYmd]);

  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [isOpen]);

  const { data, isLoading, isError, error, refetch, isFetching } = useApiQuery<any>({
    queryKey: invoiceKeys.dayClose(companyId, dateStr),
    queryFn: () => getInvoiceDayCloseReport(companyId, dateStr),
    enabled: Boolean(isOpen && companyId && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)),
    staleTime: 30_000,
    fallbackMessage: t('dayCloseLoadFailed'),
  });

  const kindLabel = useMemo(() => ({
    purchase: t('categoryTypes'),
    expense: t('categoryTypeExpense'),
    fixed_expense: t('fixedExpenseType'),
    hr_expense: t('invoiceKindHrExpense'),
    salary: t('totalSalary'),
    advance: t('quickAdvance'),
    sale: t('categoryTypeSale'),
  }), [t]);

  const { showToast } = useToast();
  const [rangeFrom, setRangeFrom] = useState(() => toYmd(defaultDateYmd) || getSaudiToday());
  const [rangeTo, setRangeTo] = useState(() => toYmd(defaultDateYmd) || getSaudiToday());
  const [rangePrintLoading, setRangePrintLoading] = useState(false);
  const [multiDayPrint, setMultiDayPrint] = useState<any>(null);

  useEffect(() => {
    if (!isOpen) {
      setMultiDayPrint(null);
      return;
    }
    const base = toYmd(defaultDateYmd) || getSaudiToday();
    setRangeFrom(base);
    setRangeTo(base);
  }, [isOpen, defaultDateYmd]);

  const handlePrintRange = async () => {
    const dates = enumerateYmdDates(rangeFrom, rangeTo);
    if (dates.length === 0) {
      showToast(t('dayClosePrintRangeInvalid'), 'error');
      return;
    }
    if (dates.length > MAX_DAY_CLOSE_RANGE_DAYS) {
      showToast(t('dayClosePrintRangeTooMany', MAX_DAY_CLOSE_RANGE_DAYS), 'error');
      return;
    }
    if (!companyId) return;
    setRangePrintLoading(true);
    try {
      const rows = [];
      for (const d of dates) {
        const res = await getInvoiceDayCloseReport(companyId, d);
        throwIfApiFailed(res, t('dayCloseLoadFailed'));
        rows.push({ date: d, data: res.data });
      }
      setMultiDayPrint(rows);
      await new Promise((r: any) => requestAnimationFrame(() => setTimeout(r, 50)));
      window.print();
    } catch (e: any) {
      showToast(e?.message || t('dayCloseLoadFailed'), 'error');
      setMultiDayPrint(null);
    } finally {
      setRangePrintLoading(false);
    }
  };

  useEffect(() => {
    const onAfterPrint = () => setMultiDayPrint(null);
    window.addEventListener('afterprint', onAfterPrint);
    return () => window.removeEventListener('afterprint', onAfterPrint);
  }, []);

  if (!isOpen) return null;

  const reportDateLabel = formatSaudiDateISO(`${dateStr}T12:00:00.000Z`);

  const handleWhatsApp = () => {
    if (!data) {
      showToast(t('dayCloseWaNoData'), 'error');
      return;
    }
    const text = buildDayCloseWhatsAppText({
      companyName,
      dateLabel: reportDateLabel,
      data,
      kindLabel,
      lang,
      t,
    });
    openDayCloseWhatsApp(text);
  };

  return (
    <Modal open={isOpen} onClose={onClose} size="xl" closeOnBackdrop={false} hideClose className="day-close-modal">
      <style>{DAY_CLOSE_REPORT_STYLES}</style>

      <div
        className="day-close-print-root relative w-full"
        dir={lang === 'ar' ? 'rtl' : 'ltr'}
        data-print-mode={multiDayPrint?.length ? 'multi' : 'single'}
      >
        <div className="day-close-report">
          <Toolbar className="day-close-no-print gap-3 mb-[14px]" direction="column" align="stretch">
            <Toolbar className="gap-2" justify="between">
              <Toolbar className="gap-6" printHidden={false}>
                <h2 id="day-close-title" className="m-0 font-extrabold text-[17px]">{reportTitle}</h2>
                <label className="flex items-center gap-3 text-[13px]">
                  <span className="text-noorix-muted">{t('date')}</span>
                  <DateField
                    value={dateStr}
                    onValueChange={setDateStr}
                    className="rounded-lg py-1 px-2 border border-noorix-border"
                  />
                </label>
                <Button size="sm" onClick={() => refetch()} disabled={isFetching}>
                  {t('dayCloseRefresh')}
                </Button>
              </Toolbar>
              <Toolbar className="gap-2" printHidden={false}>
                <Button
                  size="sm"
                  variant="success"
                  onClick={handleWhatsApp}
                  disabled={!data || isLoading}
                >
                  {t('dayCloseWhatsApp')}
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    setMultiDayPrint(null);
                    requestAnimationFrame(() => window.print());
                  }}
                >
                  {t('dayClosePrint')}
                </Button>
                <Button size="sm" onClick={onClose}>
                  {t('dayCloseClose')}
                </Button>
              </Toolbar>
            </Toolbar>
            <Toolbar className="gap-3 pt-1 border-t border-noorix-border border-dashed" align="end">
              <span className="text-[12px] font-bold text-noorix-text">{t('dayClosePrintRangeSection')}</span>
              <label className="flex items-center gap-2 text-[13px]">
                <span className="text-noorix-muted">{t('dayClosePrintRangeFrom')}</span>
                <DateField
                  value={rangeFrom}
                  onValueChange={setRangeFrom}
                  className="rounded-lg py-1 px-2 border border-noorix-border"
                />
              </label>
              <label className="flex items-center gap-2 text-[13px]">
                <span className="text-noorix-muted">{t('dayClosePrintRangeTo')}</span>
                <DateField
                  value={rangeTo}
                  onValueChange={setRangeTo}
                  className="rounded-lg py-1 px-2 border border-noorix-border"
                />
              </label>
              <Button size="sm" variant="primary" onClick={handlePrintRange} disabled={rangePrintLoading}>
                {rangePrintLoading ? t('dayClosePrintRangeLoading') : t('dayClosePrintRange')}
              </Button>
            </Toolbar>
          </Toolbar>

          {isLoading && (
            <p className="m-0 text-[13px] text-noorix-muted">{t('dayCloseLoading')}</p>
          )}
          {isError && (
            <p className="m-0 text-[13px] text-noorix-red">{error?.message || t('dayCloseLoadFailed')}</p>
          )}

          {data && !isLoading && (
            <div className="day-close-single-print">
              <div className="day-close-print-only dc-print-block">
                <header className="dc-print-header">
                  <p className="dc-print-header__co">{companyName || '—'}</p>
                  <p className="dc-print-header__doc">{reportTitle}</p>
                  <p className="dc-print-header__date">{t('dayCloseReportDate')}: {reportDateLabel}</p>
                </header>
              </div>
              <DayCloseReportBody
                data={data}
                kindLabel={kindLabel}
                t={t}
                reportDateLabel={reportDateLabel}
                lang={lang}
                compact={compact}
              />
            </div>
          )}

          {multiDayPrint && multiDayPrint.length > 0 && (
            <div className="day-close-multi-print" aria-hidden>
              {multiDayPrint.map((item: any, idx: any) => (
                <div
                  key={item.date}
                  className={cn(idx > 0 && 'day-close-multi-day--break')}
                >
                  <div className="day-close-print-only dc-print-block">
                    <header className="dc-print-header">
                      <p className="dc-print-header__co">{companyName || '—'}</p>
                      <p className="dc-print-header__doc">{reportTitle}</p>
                      <p className="dc-print-header__date">
                        {t('dayCloseReportDate')}: {formatSaudiDateISO(`${item.date}T12:00:00.000Z`)}
                      </p>
                    </header>
                  </div>
                  <DayCloseReportBody
                    data={item.data}
                    kindLabel={kindLabel}
                    t={t}
                    reportDateLabel={formatSaudiDateISO(`${item.date}T12:00:00.000Z`)}
                    lang={lang}
                    compact={compact}
                  />
                </div>
              ))}
            </div>
          )}

        </div>
      </div>
    </Modal>
  );
}
