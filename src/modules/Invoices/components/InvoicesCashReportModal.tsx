import React, { useEffect, useMemo, useState } from 'react';
import { Button, Modal } from '../../../ui';
import {
  fetchAllSalesSummariesForExport,
  getInvoices,
  throwIfApiFailed,
} from '../../../services/api';
import { toYmd } from '../../../utils/saudiDate';
import {
  buildInvoicesCashReportBody,
  INVOICES_CASH_REPORT_PRINT_EXTRA_CSS,
} from '../utils/buildInvoicesCashReportPrint';
import { DAY_CLOSE_REPORT_STYLES } from './dayCloseReportStyles';

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
  t: (key: string, ...args: any[]) => string;
  fmt: (value: number) => string;
};

type CashReportState =
  | { status: 'idle' | 'loading'; body: string; error: string }
  | { status: 'success'; body: string; error: string }
  | { status: 'error'; body: string; error: string };

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
      fromUrl && toUrl
        ? `${fromUrl} — ${toUrl}`
        : `${toYmd(invoiceQueryStartDate) || '—'} — ${toYmd(invoiceQueryEndDate) || '—'}`,
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

        const pack = invRes.data as {
          inflowByVault?: {
            vaultId: string;
            nameAr?: string;
            nameEn?: string;
            total: string;
            outflow: string;
            remainder: string;
          }[];
        };
        const cashVaultIds = new Set(
          vaultsList
            .filter((v) => String(v.type || '').toLowerCase() === 'cash')
            .map((v) => String(v.id)),
        );
        const cashRows = (pack?.inflowByVault ?? []).filter((r) => r.vaultId && cashVaultIds.has(r.vaultId));
        const summaries = await fetchAllSalesSummariesForExport(
          companyId,
          invoiceQueryStartDate,
          invoiceQueryEndDate,
          undefined,
          'transactionDate',
          'desc',
          false,
        );

        const cashOnHandSum = (summaries as { cashOnHand?: unknown }[]).reduce(
          (acc, s) => acc + Number(s.cashOnHand ?? 0),
          0,
        );
        const vaultRows = cashRows.map((r) => {
          const n = lang === 'en' ? r.nameEn || r.nameAr : r.nameAr || r.nameEn;
          return {
            vaultName: n || '—',
            inflow: fmt(Number(r.total ?? 0)),
            outflow: fmt(Number(r.outflow ?? 0)),
            remainder: fmt(Number(r.remainder ?? 0)),
          };
        });

        const totals = cashRows.reduce(
          (acc, row) => ({
            inflow: acc.inflow + Number(row.total ?? 0),
            outflow: acc.outflow + Number(row.outflow ?? 0),
            remainder: acc.remainder + Number(row.remainder ?? 0),
          }),
          { inflow: 0, outflow: 0, remainder: 0 },
        );

        const body = buildInvoicesCashReportBody(
          {
            reportTitle: t('invoicesCashReportTitle'),
            subtitle: t('invoicesCashReportSubtitle'),
            periodLine,
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
          vaultRows,
          {
            inflow: fmt(totals.inflow),
            outflow: fmt(totals.outflow),
            remainder: fmt(totals.remainder),
          },
          fmt(cashOnHandSum),
          summaries.length,
        );

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
        <div className="day-close-no-print mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="m-0 text-[17px] font-extrabold text-noorix-text">{t('invoicesCashReportTitle')}</h2>
            <p className="m-0 mt-1 text-[12px] text-noorix-muted">
              {companyName || '—'} · {(fromUrl && toUrl ? periodLine : dateFilterLabel) || periodLine}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => window.print()} disabled={state.status !== 'success'}>
              {t('print')}
            </Button>
            <Button size="sm" onClick={onClose}>
              {t('dayCloseClose')}
            </Button>
          </div>
        </div>

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
