import React from 'react';
import { fmt } from '../../../utils/format';
import {
  calculateDayCloseCashKpis,
  formatDayCloseMonthStartLabel,
  getEmptyDayCloseValue,
  pickDayCloseBilingualName,
  resolveDayCloseCounterpartyLabel,
} from '../dayCloseReportModel';

const SEPARATOR = '\u2014';
const CHANNEL_SEPARATOR = ' \u00b7 ';

type Translate = (key: string, ...args: unknown[]) => string;
type DayCloseKindLabels = Record<string, string>;

type DayCloseTotalRow = {
  count?: number | string | null;
  total?: number | string | null;
};

type DayCloseKindRow = DayCloseTotalRow & {
  kind: string;
};

type DayClosePaymentRow = DayCloseTotalRow & {
  vaultId?: string | null;
  label?: string | null;
  nameAr?: string | null;
  nameEn?: string | null;
};

type DayCloseSalesChannel = {
  amount?: number | string | null;
  vaultName?: string | null;
  vaultNameAr?: string | null;
  vaultNameEn?: string | null;
};

type DayCloseSalesSummary = {
  id: string;
  summaryNumber?: string | number | null;
  customerCount?: number | string | null;
  cashOnHand?: number | string | null;
  totalAmount?: number | string | null;
  channels?: DayCloseSalesChannel[];
};

type DayCloseVaultMovementRow = {
  id: string;
  nameAr?: string | null;
  nameEn?: string | null;
  type?: string | null;
  totalIn?: number | string | null;
  totalOut?: number | string | null;
  netDay?: number | string | null;
};

type DayCloseOperationRow = {
  id: string;
  invoiceNumber?: string | number | null;
  kind?: string | null;
  totalAmount?: number | string | null;
  status?: string | null;
  supplierName?: string | null;
  supplierNameAr?: string | null;
  supplierNameEn?: string | null;
  employeeName?: string | null;
  expenseLineName?: string | null;
  expenseLineNameAr?: string | null;
  expenseLineNameEn?: string | null;
  vaultName?: string | null;
  vaultNameAr?: string | null;
  vaultNameEn?: string | null;
  notes?: string | null;
};

type DayCloseReportData = {
  meta?: {
    cashMonthScopeStart?: unknown;
    invoicesTruncated?: boolean;
    operationsReturned?: number | string | null;
    invoiceCountAll?: number | string | null;
  };
  sums?: {
    inflow?: DayCloseTotalRow;
    outflow?: DayCloseTotalRow;
  };
  cash?: {
    netDay?: number | string | null;
    dayTotalIn?: number | string | null;
    dayTotalOut?: number | string | null;
    balanceLifetimeCashVaultsEod?: unknown;
    balanceEndOfDayCashVaults?: unknown;
    availableCashMonthScoped?: unknown;
  };
  transfers?: {
    volume?: number | string | null;
    count?: number | string | null;
  };
  byKind?: DayCloseKindRow[];
  outflowByPaymentMethod?: DayClosePaymentRow[];
  salesSummaries?: DayCloseSalesSummary[];
  vaults?: {
    movementOnDayByVault?: DayCloseVaultMovementRow[];
  };
  operations?: DayCloseOperationRow[];
};

type DayCloseReportBodyProps = {
  data: DayCloseReportData;
  kindLabel: DayCloseKindLabels;
  t: Translate;
  reportDateLabel: string;
  lang: string;
  compact?: boolean;
};

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className="dc-section-title">{children}</div>;
}

function money(value: unknown) {
  return fmt(Number(value ?? 0));
}

function count(value: unknown): string | number {
  if (typeof value === 'number' || typeof value === 'string') return value;
  return 0;
}

function EmptyRow({ colSpan }: { colSpan: number }) {
  return (
    <tr>
      <td colSpan={colSpan} className="dc-empty">
        {getEmptyDayCloseValue()}
      </td>
    </tr>
  );
}

function formatSalesChannels(channels: DayCloseSalesChannel[] | undefined, lang: string) {
  return (
    channels
      ?.map(
        (channel) =>
          `${pickDayCloseBilingualName(
            lang,
            channel.vaultNameAr ?? channel.vaultName,
            channel.vaultNameEn,
          )}: ${money(channel.amount)}`,
      )
      .join(CHANNEL_SEPARATOR) || getEmptyDayCloseValue()
  );
}

export function DayCloseReportBody({
  data,
  kindLabel,
  t,
  reportDateLabel,
  lang,
  compact = false,
}: DayCloseReportBodyProps) {
  const monthStartLabel = formatDayCloseMonthStartLabel(data.meta?.cashMonthScopeStart);
  const { monthScoped, lifetime, showLifetimeFootnote } = calculateDayCloseCashKpis(data.cash);
  const byKind = data.byKind ?? [];
  const paymentRows = data.outflowByPaymentMethod ?? [];
  const salesSummaries = data.salesSummaries ?? [];
  const vaultMovements = data.vaults?.movementOnDayByVault ?? [];
  const operations = data.operations ?? [];

  return (
    <div className="grid gap-3.5">
      <div className="day-close-screen-only flex gap-2 justify-between items-baseline flex-wrap pb-2 border-b border-noorix-border">
        <div>
          <div className="text-[11px] text-noorix-muted">{t('dayCloseReportDate')}</div>
          <div className="text-[15px] font-extrabold">{reportDateLabel}</div>
        </div>
        <div className="text-[10px] text-[var(--noorix-text-muted-2)] max-w-[340px] text-right leading-[1.45]">
          {t(compact ? 'dayCloseVaultBalanceNoteCompact' : 'dayCloseVaultBalanceNote')}
        </div>
      </div>

      {data.meta?.invoicesTruncated && (
        <div className="text-[11px] py-2 px-[10px] bg-[var(--noorix-yellow-12)] rounded-lg text-noorix-amber border border-[var(--noorix-yellow-35)]">
          {t('dayCloseTruncatedWarning', data.meta.operationsReturned)}
        </div>
      )}

      <div className="day-close-screen-only dc-kpi-grid">
        <div className="dc-kpi-card dc-kpi-card--in">
          <div className="dc-kpi-card__label">
            {t('inbound')} {SEPARATOR} {t('categoryTypeSale')}
          </div>
          <div className="dc-kpi-card__val">{money(data.sums?.inflow?.total)} SR</div>
          <div className="dc-kpi-card__sub">
            {count(data.sums?.inflow?.count)} {t('dayCloseOperations')}
          </div>
        </div>
        <div className="dc-kpi-card dc-kpi-card--out">
          <div className="dc-kpi-card__label">{t('outbound')}</div>
          <div className="dc-kpi-card__val">{money(data.sums?.outflow?.total)} SR</div>
          <div className="dc-kpi-card__sub">
            {count(data.sums?.outflow?.count)} {t('dayCloseOperations')}
          </div>
        </div>
        <div className="dc-kpi-card dc-kpi-card--cash">
          <div className="dc-kpi-card__label">{t('dayCloseNetDayCash')}</div>
          <div className="dc-kpi-card__val">{money(data.cash?.netDay)} SR</div>
          <div className="dc-kpi-card__sub">{t('dayCloseCashVaultsOnly')}</div>
        </div>
        <div className="dc-kpi-card dc-kpi-card--bal">
          <div className="dc-kpi-card__label">{t('dayCloseCashRemainingEod')}</div>
          <div className="dc-kpi-card__val">
            {fmt(monthScoped)} <span className="nx-sar">SR</span>
          </div>
          <div className="dc-kpi-card__sub">{t('dayCloseEodDefinition')}</div>
          {showLifetimeFootnote && (
            <div className="dc-kpi-card__footnote text-[10px] text-noorix-muted mt-1 leading-snug">
              {t('dayCloseLifetimeCashFootnote', fmt(lifetime))}
            </div>
          )}
        </div>
      </div>

      <div className="day-close-print-only dc-print-block dc-print-cash-line">
        <div className="dc-print-cash-line__row">
          <span className="dc-print-cash-line__label">{t('dayCloseCashRemainingEod')}:</span>
          <span className="dc-print-cash-line__amount">
            {fmt(monthScoped)} <span className="nx-sar">SR</span>
          </span>
          <span className="dc-print-cash-line__meta">
            {' '}
            {SEPARATOR}{' '}
            {t('dayCloseAvailableCashPrintScope', monthStartLabel, reportDateLabel)}
          </span>
        </div>
        {showLifetimeFootnote && (
          <div className="dc-print-cash-line__sub">{t('dayCloseLifetimeCashFootnote', fmt(lifetime))}</div>
        )}
      </div>

      <table className="dc-table day-close-print-only" aria-label={t('dayCloseKpiPrintCaption')}>
        <caption>{t('dayCloseKpiPrintCaption')}</caption>
        <thead>
          <tr>
            <th>{t('dayCloseKpiColMetric')}</th>
            <th className="dc-num">{t('dayCloseKpiColValue')}</th>
            <th className="dc-num">{t('dayCloseKpiColCount')}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              {t('inbound')} ({t('categoryTypeSale')})
            </td>
            <td className="dc-num">{money(data.sums?.inflow?.total)}</td>
            <td className="dc-num">{count(data.sums?.inflow?.count)}</td>
          </tr>
          <tr>
            <td>{t('outbound')}</td>
            <td className="dc-num">{money(data.sums?.outflow?.total)}</td>
            <td className="dc-num">{count(data.sums?.outflow?.count)}</td>
          </tr>
          <tr>
            <td>{t('dayCloseNetDayCash')}</td>
            <td className="dc-num">{money(data.cash?.netDay)}</td>
            <td className="dc-empty">{getEmptyDayCloseValue()}</td>
          </tr>
          <tr>
            <td>{t('dayCloseCashRemainingEod')}</td>
            <td className="dc-num">{fmt(monthScoped)}</td>
            <td className="dc-empty">{getEmptyDayCloseValue()}</td>
          </tr>
          <tr>
            <td>{t('dayCloseCashMovement')}</td>
            <td className="dc-num" colSpan={2}>
              {t('dayCloseCashIn')} {money(data.cash?.dayTotalIn)} &nbsp;|&nbsp; {t('dayCloseCashOut')}{' '}
              {money(data.cash?.dayTotalOut)}
            </td>
          </tr>
          <tr>
            <td>{t('dayCloseTransfers')}</td>
            <td className="dc-num">{money(data.transfers?.volume)}</td>
            <td className="dc-num">{count(data.transfers?.count)}</td>
          </tr>
        </tbody>
      </table>

      {!compact && (
        <div className="day-close-screen-only dc-inline-stats">
          <div>
            <strong>{t('dayCloseCashMovement')}</strong>
            {' '}
            {SEPARATOR}{' '}
            {t('dayCloseCashIn')} {money(data.cash?.dayTotalIn)} {CHANNEL_SEPARATOR} {t('dayCloseCashOut')}{' '}
            {money(data.cash?.dayTotalOut)}
          </div>
          <div>
            <strong>{t('dayCloseTransfers')}</strong>
            {' '}
            {SEPARATOR} {count(data.transfers?.count)} / {money(data.transfers?.volume)} SR
          </div>
        </div>
      )}

      <div className="grid gap-3.5 grid-cols-[repeat(auto-fit,minmax(240px,1fr))] items-start">
        <div>
          <SectionTitle>{t('dayCloseByKind')}</SectionTitle>
          <table className="dc-table">
            <thead>
              <tr>
                <th>{t('type')}</th>
                <th className="dc-num">{t('dayCloseCount')}</th>
                <th className="dc-num">{t('total')} (SR)</th>
              </tr>
            </thead>
            <tbody>
              {byKind.length === 0 ? (
                <EmptyRow colSpan={3} />
              ) : (
                byKind.map((row) => (
                  <tr key={row.kind}>
                    <td>{kindLabel[row.kind] || row.kind}</td>
                    <td className="dc-num">{count(row.count)}</td>
                    <td className="dc-num">{money(row.total)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div>
          <SectionTitle>{t('dayCloseByPaymentChannel')}</SectionTitle>
          <table className="dc-table">
            <thead>
              <tr>
                <th>{t('vault')}</th>
                <th className="dc-num">{t('total')} (SR)</th>
              </tr>
            </thead>
            <tbody>
              {paymentRows.length === 0 ? (
                <EmptyRow colSpan={2} />
              ) : (
                paymentRows.map((row, index) => (
                  <tr key={row.vaultId ?? `${row.nameAr ?? row.label}-${index}`}>
                    <td>{pickDayCloseBilingualName(lang, row.nameAr ?? row.label, row.nameEn)}</td>
                    <td className="dc-num">{money(row.total)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {salesSummaries.length > 0 && (
        <div>
          <SectionTitle>{t('dayCloseSalesSummaries')}</SectionTitle>
          <table className="dc-table">
            <thead>
              <tr>
                <th>#</th>
                <th className="dc-num">{t('dayCloseCustomers')}</th>
                <th className="dc-num">{t('dayCloseCashOnHand')}</th>
                <th className="dc-num">{t('total')}</th>
                {!compact && <th>{t('vaults')}</th>}
              </tr>
            </thead>
            <tbody>
              {salesSummaries.map((summary) => (
                <tr key={summary.id}>
                  <td className="font-bold">{summary.summaryNumber}</td>
                  <td className="dc-num">{count(summary.customerCount)}</td>
                  <td className="dc-num">{money(summary.cashOnHand)}</td>
                  <td className="dc-num">{money(summary.totalAmount)}</td>
                  {!compact && (
                    <td className="dc-muted text-[10px]">
                      {formatSalesChannels(summary.channels, lang)}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div>
        <SectionTitle>{t('dayCloseVaultMovementDay')}</SectionTitle>
        <table className="dc-table">
          <thead>
            <tr>
              <th>{t('vault')}</th>
              <th className="dc-num">{t('inbound')}</th>
              <th className="dc-num">{t('outbound')}</th>
              <th className="dc-num">{t('dayCloseNet')}</th>
            </tr>
          </thead>
          <tbody>
            {vaultMovements.length === 0 ? (
              <EmptyRow colSpan={4} />
            ) : (
              vaultMovements.map((vault) => (
                <tr key={vault.id}>
                  <td>
                    {pickDayCloseBilingualName(lang, vault.nameAr, vault.nameEn)}{' '}
                    <span className="dc-muted">({vault.type})</span>
                  </td>
                  <td className="dc-num">{money(vault.totalIn)}</td>
                  <td className="dc-num">{money(vault.totalOut)}</td>
                  <td className="dc-num">{money(vault.netDay)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div>
        <SectionTitle>
          {t('dayCloseOperationsTable')} {SEPARATOR} {data.meta?.invoiceCountAll ?? 0}
        </SectionTitle>
        <div className="day-close-ops-wrap">
          <table className="dc-table m-0 border-0">
            <thead>
              <tr>
                <th>{t('documentNumber')}</th>
                <th>{t('type')}</th>
                <th className="dc-num">{t('total')}</th>
                <th>{t('dayCloseCounterparty')}</th>
                <th>{t('vault')}</th>
                <th>{t('statusLabel')}</th>
              </tr>
            </thead>
            <tbody>
              {operations.length === 0 && <EmptyRow colSpan={6} />}
              {operations.map((operation) => (
                <tr
                  key={operation.id}
                  className={operation.status === 'cancelled' ? 'opacity-[0.55]' : undefined}
                >
                  <td className="font-bold">{operation.invoiceNumber}</td>
                  <td>{kindLabel[operation.kind ?? ''] || operation.kind}</td>
                  <td className="dc-num">{money(operation.totalAmount)}</td>
                  <td className="dc-muted max-w-[200px]">
                    {resolveDayCloseCounterpartyLabel(operation, lang)}
                  </td>
                  <td>
                    {pickDayCloseBilingualName(
                      lang,
                      operation.vaultNameAr ?? operation.vaultName,
                      operation.vaultNameEn,
                    )}
                  </td>
                  <td>{operation.status === 'cancelled' ? t('statusCancelled') : t('statusActive')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
