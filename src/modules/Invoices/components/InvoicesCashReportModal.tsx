import React, { useEffect, useMemo, useState } from 'react';
import { Button, Modal, Toolbar } from '../../../ui';
import {
  fetchAllSalesSummariesForExport,
  getInvoices,
  throwIfApiFailed,
} from '../../../services/api';
import {
  INVOICES_CASH_REPORT_PRINT_EXTRA_CSS,
} from '../utils/buildInvoicesCashReportPrint';
import { DAY_CLOSE_REPORT_STYLES } from './dayCloseReportStyles';
import {
  buildInvoicesCashReportHtml,
  filterCashVaultRows,
  resolveInvoicesCashReportPeriodLine,
} from '../invoicesCashReportModel';
import { printCurrentInvoiceWindow } from '../invoicePrintModel';

type Props = {
  companyId: string;
  isOpen: boolean;
  onClose: () => void;
  invoiceQueryStartDate: string;
  invoiceQueryEndDate: string;
  dateFilterLabel: string;
  fromUrl: string;
  toUrl: string;
  vaultsList: Array<{ id?: string; type?: string }>;
  companyName: string;
  lang: string;
  t: (key: string, ...args: unknown[]) => string;
  fmt: (value: number) => string;
};

type CashReportState =
  | { status: 'idle' | 'loading'; body: string; error: string }
  | { status: 'success'; body: string; error: string }
  | { status: 'error'; body: string; error: string };

type CashOnHandSummary = { cashOnHand?: unknown };

function isCashOnHandSummary(value: unknown): value is CashOnHandSummary {
  return Boolean(value && typeof value === 'object');
}

export function InvoicesCashReportModal({
  companyId,
  isOpen,
  onClose,
  invoiceQueryStartDate,
  invoiceQueryEndDate,
  dateFilterLabel,
  fromUrl,
  toUrl,
  vaultsList,
  companyName,
  lang,
  t,
  fmt,
}: Props) {
  const [state, setState] = useState<CashReportState>({ status: 'idle', body: '', error: '' });

  const periodLine = useMemo(
    () =>
      resolveInvoicesCashReportPeriodLine({
        fromUrl,
        toUrl,
        invoiceQueryStartDate,
        invoiceQueryEndDate,
      }),
    [fromUrl, toUrl, invoiceQueryStartDate, invoiceQueryEndDate],
  );

  useEffect(() => {
    if (!isOpen || !companyId) return undefined;
    let cancelled = false;

    async function load() {
      setState({ status: 'loading', body: '', error: '' });
      try {
        const invRes = await getInvoices(
          companyId,
          invoiceQueryStartDate,
          invoiceQueryEndDate,
          1,
          1,
          null,
          null,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          false,
          undefined,
          undefined,
          undefined,
          undefined,
        );
        throwIfApiFailed(invRes, t('invoicesCashReportLoadFailed'));

        const cashRows = filterCashVaultRows(invRes.data?.inflowByVault, vaultsList);
        const summaries = await fetchAllSalesSummariesForExport(
          companyId,
          invoiceQueryStartDate,
          invoiceQueryEndDate,
          undefined,
          'transactionDate',
          'desc',
          false,
        );

        const body = buildInvoicesCashReportHtml({
          periodLine,
          labels: {
            reportTitle: t('invoicesCashReportTitle'),
            subtitle: t('invoicesCashReportSubtitle'),
            scopeNote: t('invoicesCashReportScope'),
            vaultSectionTitle: t('invoicesCashReportVaultSection'),
            colVault: t('invoicesCashReportColVault'),
            colIn: t('invoicesCashReportColIn'),
            colOut: t('invoicesCashReportColOut'),
            colRemain: t('invoicesCashReportColRemain'),
            totalsTitle: t('invoicesCashReportTotalsRow'),
            salesCashOnHandTitle: t('invoicesCashReportSalesCashOnHandTitle'),
            salesCashOnHandHint: t('invoicesCashReportSalesCashOnHandHint'),
            summariesCountLabel: t('invoicesCashReportSummariesCount'),
            noCashVaults: t('invoicesCashReportNoCashVaults'),
          },
          cashRows,
          summaries: summaries.filter(isCashOnHandSummary),
          lang,
          fmt,
        });

        if (!cancelled) setState({ status: 'success', body, error: '' });
      } catch (e) {
        if (!cancelled) {
          setState({
            status: 'error',
            body: '',
            error: e instanceof Error ? e.message : t('invoicesCashReportLoadFailed'),
          });
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [
    isOpen,
    companyId,
    invoiceQueryStartDate,
    invoiceQueryEndDate,
    vaultsList,
    lang,
    fmt,
    t,
    periodLine,
  ]);

  if (!isOpen) return null;

  return (
    <Modal open={isOpen} onClose={onClose} size="xl" closeOnBackdrop={false} hideClose className="day-close-modal">
      <style>{DAY_CLOSE_REPORT_STYLES}</style>
      <style>{INVOICES_CASH_REPORT_PRINT_EXTRA_CSS}</style>
      <div className="day-close-print-root w-full" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
        <Toolbar className="day-close-no-print mb-4 gap-3" justify="between">
          <div>
            <h2 className="m-0 text-[17px] font-extrabold text-noorix-text">{t('invoicesCashReportTitle')}</h2>
            <p className="m-0 mt-1 text-[12px] text-noorix-muted">
              {companyName || '—'} · {(fromUrl && toUrl ? periodLine : dateFilterLabel) || periodLine}
            </p>
          </div>
          <Toolbar className="gap-2" printHidden={false}>
            <Button size="sm" onClick={printCurrentInvoiceWindow} disabled={state.status !== 'success'}>
              {t('print')}
            </Button>
            <Button size="sm" onClick={onClose}>
              {t('dayCloseClose')}
            </Button>
          </Toolbar>
        </Toolbar>

        {state.status === 'loading' && (
          <p className="m-0 text-[13px] text-noorix-muted">{t('dayCloseLoading')}</p>
        )}
        {state.status === 'error' && (
          <p className="m-0 text-[13px] text-noorix-red">{state.error}</p>
        )}
        {state.status === 'success' && (
          <div className="day-close-report" dangerouslySetInnerHTML={{ __html: state.body }} />
        )}
      </div>
    </Modal>
  );
}
