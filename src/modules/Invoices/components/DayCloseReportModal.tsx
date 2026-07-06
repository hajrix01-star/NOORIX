import React, { useEffect, useMemo, useState } from 'react';
import { useApiQuery } from '../../../hooks/useApiQuery';
import { useTranslation } from '../../../i18n/useTranslation';
import { useApp } from '../../../context/AppContext';
import { getInvoiceDayCloseReport, throwIfApiFailed } from '../../../services/api';
import { getSaudiToday, toYmd } from '../../../utils/saudiDate';
import { Button, Modal, DateField, Toolbar, cn } from '../../../ui';
import { useToast } from '../../../context/ToastContext';
import { invoiceKeys } from '../../../services/queryKeys';
import { buildDayCloseWhatsAppText, openDayCloseWhatsApp } from '../utils/dayCloseWhatsApp';
import { DayCloseReportBody } from './DayCloseReportBody';
import { DAY_CLOSE_REPORT_STYLES } from './dayCloseReportStyles';
import {
  type DayClosePrintRow,
  type DayCloseReportData,
  enumerateDayCloseYmdDates,
  formatDayCloseReportDateLabel,
  getEmptyDayCloseValue,
  isValidDayCloseDate,
  MAX_DAY_CLOSE_RANGE_DAYS,
  normalizeDayCloseReportData,
  resolveDayCloseCompanyName,
} from '../dayCloseReportModel';

type DayCloseReportModalProps = {
  companyId: string;
  isOpen: boolean;
  onClose: () => void;
  defaultDateYmd?: unknown;
  compact?: boolean;
};

function resolveInitialDayCloseDate(defaultDateYmd: unknown) {
  return toYmd(defaultDateYmd) || getSaudiToday();
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function waitForPrintFrame() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      window.setTimeout(resolve, 50);
    });
  });
}

export default function DayCloseReportModal({
  companyId,
  isOpen,
  onClose,
  defaultDateYmd,
  compact = false,
}: DayCloseReportModalProps) {
  const { t, lang } = useTranslation();
  const reportTitle = t('dayCloseTitle');
  const { companies, activeCompanyId } = useApp();
  const { showToast } = useToast();

  const [dateStr, setDateStr] = useState(() => resolveInitialDayCloseDate(defaultDateYmd));
  const [rangeFrom, setRangeFrom] = useState(() => resolveInitialDayCloseDate(defaultDateYmd));
  const [rangeTo, setRangeTo] = useState(() => resolveInitialDayCloseDate(defaultDateYmd));
  const [rangePrintLoading, setRangePrintLoading] = useState(false);
  const [multiDayPrint, setMultiDayPrint] = useState<DayClosePrintRow[] | null>(null);

  const companyName = useMemo(
    () => resolveDayCloseCompanyName({ companies, activeCompanyId, companyId, lang }),
    [companies, activeCompanyId, companyId, lang],
  );

  const kindLabel = useMemo(
    () => ({
      purchase: t('categoryTypes'),
      expense: t('categoryTypeExpense'),
      fixed_expense: t('fixedExpenseType'),
      hr_expense: t('invoiceKindHrExpense'),
      salary: t('totalSalary'),
      advance: t('quickAdvance'),
      sale: t('categoryTypeSale'),
    }),
    [t],
  );

  useEffect(() => {
    if (!isOpen) return;
    setDateStr(resolveInitialDayCloseDate(defaultDateYmd));
  }, [isOpen, defaultDateYmd]);

  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setMultiDayPrint(null);
      return;
    }
    const baseDate = resolveInitialDayCloseDate(defaultDateYmd);
    setRangeFrom(baseDate);
    setRangeTo(baseDate);
  }, [isOpen, defaultDateYmd]);

  useEffect(() => {
    const onAfterPrint = () => setMultiDayPrint(null);
    window.addEventListener('afterprint', onAfterPrint);
    return () => window.removeEventListener('afterprint', onAfterPrint);
  }, []);

  const { data, isLoading, isError, error, refetch, isFetching } = useApiQuery<DayCloseReportData>({
    queryKey: invoiceKeys.dayClose(companyId, dateStr),
    queryFn: async () => getInvoiceDayCloseReport(companyId, dateStr),
    enabled: Boolean(isOpen && companyId && isValidDayCloseDate(dateStr)),
    staleTime: 30_000,
    fallbackMessage: t('dayCloseLoadFailed'),
  });

  if (!isOpen) return null;

  const reportDateLabel = formatDayCloseReportDateLabel(dateStr);
  const printMode = multiDayPrint?.length ? 'multi' : 'single';

  const toastError = (message: string) => showToast(message, 'error');

  const handleWhatsApp = () => {
    if (!data) {
      toastError(t('dayCloseWaNoData'));
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

  const handlePrintSingleDay = () => {
    setMultiDayPrint(null);
    requestAnimationFrame(() => window.print());
  };

  const handlePrintRange = async () => {
    const dates = enumerateDayCloseYmdDates(rangeFrom, rangeTo);
    if (dates.length === 0) {
      toastError(t('dayClosePrintRangeInvalid'));
      return;
    }
    if (dates.length > MAX_DAY_CLOSE_RANGE_DAYS) {
      toastError(t('dayClosePrintRangeTooMany', MAX_DAY_CLOSE_RANGE_DAYS));
      return;
    }
    if (!companyId) return;

    setRangePrintLoading(true);
    try {
      const rows: DayClosePrintRow[] = [];
      for (const date of dates) {
        const response = await getInvoiceDayCloseReport(companyId, date);
        throwIfApiFailed(response, t('dayCloseLoadFailed'));
        rows.push({ date, data: normalizeDayCloseReportData(response.data) });
      }
      setMultiDayPrint(rows);
      await waitForPrintFrame();
      window.print();
    } catch (caughtError: unknown) {
      toastError(getErrorMessage(caughtError, t('dayCloseLoadFailed')));
      setMultiDayPrint(null);
    } finally {
      setRangePrintLoading(false);
    }
  };

  return (
    <Modal open={isOpen} onClose={onClose} size="xl" closeOnBackdrop={false} hideClose className="day-close-modal">
      <style>{DAY_CLOSE_REPORT_STYLES}</style>

      <div
        className="day-close-print-root relative w-full"
        dir={lang === 'ar' ? 'rtl' : 'ltr'}
        data-print-mode={printMode}
      >
        <div className="day-close-report">
          <Toolbar className="day-close-no-print gap-3 mb-[14px]" direction="column" align="stretch">
            <Toolbar className="gap-2" justify="between">
              <Toolbar className="gap-6" printHidden={false}>
                <h2 id="day-close-title" className="m-0 font-extrabold text-[17px]">
                  {reportTitle}
                </h2>
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
                <Button size="sm" variant="success" onClick={handleWhatsApp} disabled={!data || isLoading}>
                  {t('dayCloseWhatsApp')}
                </Button>
                <Button size="sm" onClick={handlePrintSingleDay}>
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

          {isLoading && <p className="m-0 text-[13px] text-noorix-muted">{t('dayCloseLoading')}</p>}
          {isError && (
            <p className="m-0 text-[13px] text-noorix-red">
              {getErrorMessage(error, t('dayCloseLoadFailed'))}
            </p>
          )}

          {data && !isLoading && (
            <div className="day-close-single-print">
              <div className="day-close-print-only dc-print-block">
                <header className="dc-print-header">
                  <p className="dc-print-header__co">{companyName || getEmptyDayCloseValue()}</p>
                  <p className="dc-print-header__doc">{reportTitle}</p>
                  <p className="dc-print-header__date">
                    {t('dayCloseReportDate')}: {reportDateLabel}
                  </p>
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
              {multiDayPrint.map((item, index) => {
                const itemDateLabel = formatDayCloseReportDateLabel(item.date);
                return (
                  <div key={item.date} className={cn(index > 0 && 'day-close-multi-day--break')}>
                    <div className="day-close-print-only dc-print-block">
                      <header className="dc-print-header">
                        <p className="dc-print-header__co">{companyName || getEmptyDayCloseValue()}</p>
                        <p className="dc-print-header__doc">{reportTitle}</p>
                        <p className="dc-print-header__date">
                          {t('dayCloseReportDate')}: {itemDateLabel}
                        </p>
                      </header>
                    </div>
                    <DayCloseReportBody
                      data={item.data}
                      kindLabel={kindLabel}
                      t={t}
                      reportDateLabel={itemDateLabel}
                      lang={lang}
                      compact={compact}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
