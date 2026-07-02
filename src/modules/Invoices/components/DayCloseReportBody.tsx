import React from 'react';
import { fmt } from '../../../utils/format';
import { formatSaudiDateISO } from '../../../utils/saudiDate';
function SectionTitle({ children }: any) {
  return (
    <div className="dc-section-title">
      {children}
    </div>
  );
}

export const MAX_DAY_CLOSE_RANGE_DAYS = 31;

function pad2(n: any) {
  return String(n).padStart(2, '0');
}

/** عرض اسم مزدوج حسب لغة الواجهة */
function pickBilingual(lang: any, nameAr: any, nameEn: any) {
  const ar = nameAr != null && String(nameAr).trim() !== '' ? String(nameAr).trim() : '';
  const en = nameEn != null && String(nameEn).trim() !== '' ? String(nameEn).trim() : '';
  if (lang === 'en') return en || ar || '—';
  return ar || en || '—';
}

/** تواريخ YYYY-MM-DD من البداية إلى النهاية (شاملة)، UTC تقويمية */
export function enumerateYmdDates(startStr: any, endStr: any) {
  const [sy, sm, sd] = startStr.split('-').map(Number);
  const [ey, em, ed] = endStr.split('-').map(Number);
  const start = new Date(Date.UTC(sy, sm - 1, sd));
  const end = new Date(Date.UTC(ey, em - 1, ed));
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return [];
  const out = [];
  for (let cur = new Date(start); cur <= end; cur.setUTCDate(cur.getUTCDate() + 1)) {
    out.push(`${cur.getUTCFullYear()}-${pad2(cur.getUTCMonth() + 1)}-${pad2(cur.getUTCDate())}`);
  }
  return out;
}

function counterpartyLabel(op: any, lang: any) {
  const sup = pickBilingual(lang, op.supplierNameAr ?? op.supplierName, op.supplierNameEn);
  if (sup !== '—') return sup;
  if (op.employeeName) return op.employeeName;
  const el = pickBilingual(lang, op.expenseLineNameAr ?? op.expenseLineName, op.expenseLineNameEn);
  if (el !== '—') return el;
  return op.notes || '—';
}

/** قيم عرض كرت الكاش: صافي الشهر إن وُجد من الـ API، وإلا الرصيد التراكمي (توافق خلفي). */
function getDayCloseCashKpis(cash: any) {
  const lifetime = Number(cash?.balanceLifetimeCashVaultsEod ?? cash?.balanceEndOfDayCashVaults ?? 0);
  const raw = cash?.availableCashMonthScoped;
  const hasMonthScoped = raw != null && raw !== '';
  const monthScoped = hasMonthScoped ? Number(raw) : lifetime;
  return { monthScoped, lifetime };
}

export function DayCloseReportBody({ data, kindLabel, t, reportDateLabel, lang, compact = false }: any) {
  const monthStartYmd = data.meta?.cashMonthScopeStart;
  const monthStartLabel =
    monthStartYmd && /^\d{4}-\d{2}-\d{2}$/.test(String(monthStartYmd))
      ? formatSaudiDateISO(`${monthStartYmd}T12:00:00.000Z`)
      : '—';
  const { monthScoped, lifetime } = getDayCloseCashKpis(data.cash);
  const showLifetimeFootnote =
    Number.isFinite(monthScoped) &&
    Number.isFinite(lifetime) &&
    Math.abs(monthScoped - lifetime) > 1e-6;

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
          <div className="dc-kpi-card__label">{t('inbound')} — {t('categoryTypeSale')}</div>
          <div className="dc-kpi-card__val">{fmt(Number(data.sums?.inflow?.total || 0))} SR</div>
          <div className="dc-kpi-card__sub">{data.sums?.inflow?.count ?? 0} {t('dayCloseOperations')}</div>
        </div>
        <div className="dc-kpi-card dc-kpi-card--out">
          <div className="dc-kpi-card__label">{t('outbound')}</div>
          <div className="dc-kpi-card__val">{fmt(Number(data.sums?.outflow?.total || 0))} SR</div>
          <div className="dc-kpi-card__sub">{data.sums?.outflow?.count ?? 0} {t('dayCloseOperations')}</div>
        </div>
        <div className="dc-kpi-card dc-kpi-card--cash">
          <div className="dc-kpi-card__label">{t('dayCloseNetDayCash')}</div>
          <div className="dc-kpi-card__val">{fmt(Number(data.cash?.netDay ?? 0))} SR</div>
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
            {' — '}
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
            <td>{t('inbound')} ({t('categoryTypeSale')})</td>
            <td className="dc-num">{fmt(Number(data.sums?.inflow?.total || 0))}</td>
            <td className="dc-num">{data.sums?.inflow?.count ?? 0}</td>
          </tr>
          <tr>
            <td>{t('outbound')}</td>
            <td className="dc-num">{fmt(Number(data.sums?.outflow?.total || 0))}</td>
            <td className="dc-num">{data.sums?.outflow?.count ?? 0}</td>
          </tr>
          <tr>
            <td>{t('dayCloseNetDayCash')}</td>
            <td className="dc-num">{fmt(Number(data.cash?.netDay ?? 0))}</td>
            <td className="dc-empty">—</td>
          </tr>
          <tr>
            <td>{t('dayCloseCashRemainingEod')}</td>
            <td className="dc-num">{fmt(monthScoped)}</td>
            <td className="dc-empty">—</td>
          </tr>
          <tr>
            <td>{t('dayCloseCashMovement')}</td>
            <td className="dc-num" colSpan={2}>
              {t('dayCloseCashIn')} {fmt(Number(data.cash?.dayTotalIn ?? 0))} &nbsp;|&nbsp; {t('dayCloseCashOut')} {fmt(Number(data.cash?.dayTotalOut ?? 0))}
            </td>
          </tr>
          <tr>
            <td>{t('dayCloseTransfers')}</td>
            <td className="dc-num">{fmt(Number(data.transfers?.volume || 0))}</td>
            <td className="dc-num">{data.transfers?.count ?? 0}</td>
          </tr>
        </tbody>
      </table>

      {!compact && (
        <div className="day-close-screen-only dc-inline-stats">
          <div>
            <strong>{t('dayCloseCashMovement')}</strong>
            {' — '}
            {t('dayCloseCashIn')} {fmt(Number(data.cash?.dayTotalIn ?? 0))} · {t('dayCloseCashOut')} {fmt(Number(data.cash?.dayTotalOut ?? 0))}
          </div>
          <div>
            <strong>{t('dayCloseTransfers')}</strong>
            {' — '}
            {data.transfers?.count ?? 0} / {fmt(Number(data.transfers?.volume || 0))} SR
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
              {(data.byKind || []).length === 0 ? (
                <tr><td colSpan={3} className="dc-empty">—</td></tr>
              ) : (
                (data.byKind || []).map((row: any) => (
                  <tr key={row.kind}>
                    <td>{kindLabel[row.kind] || row.kind}</td>
                    <td className="dc-num">{row.count}</td>
                    <td className="dc-num">{fmt(Number(row.total))}</td>
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
              {(data.outflowByPaymentMethod || []).length === 0 ? (
                <tr><td colSpan={2} className="dc-empty">—</td></tr>
              ) : (
                (data.outflowByPaymentMethod || []).map((row: any, i: any) => (
                  <tr key={row.vaultId ?? `${row.nameAr ?? row.label}-${i}`}>
                    <td>{pickBilingual(lang, row.nameAr ?? row.label, row.nameEn)}</td>
                    <td className="dc-num">{fmt(Number(row.total))}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {(data.salesSummaries || []).length > 0 && (
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
              {(data.salesSummaries || []).map((s: any) => (
                <tr key={s.id}>
                  <td className="font-bold">{s.summaryNumber}</td>
                  <td className="dc-num">{s.customerCount}</td>
                  <td className="dc-num">{fmt(Number(s.cashOnHand))}</td>
                  <td className="dc-num">{fmt(Number(s.totalAmount))}</td>
                  {!compact && (
                    <td className="dc-muted text-[10px]">
                      {(s.channels || []).map((c: any) => `${pickBilingual(lang, c.vaultNameAr ?? c.vaultName, c.vaultNameEn)}: ${fmt(Number(c.amount))}`).join(' · ') || '—'}
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
            {(data.vaults?.movementOnDayByVault || []).length === 0 ? (
              <tr><td colSpan={4} className="dc-empty">—</td></tr>
            ) : (
              (data.vaults?.movementOnDayByVault || []).map((v: any) => (
                <tr key={v.id}>
                  <td>{pickBilingual(lang, v.nameAr, v.nameEn)} <span className="dc-muted">({v.type})</span></td>
                  <td className="dc-num">{fmt(Number(v.totalIn))}</td>
                  <td className="dc-num">{fmt(Number(v.totalOut))}</td>
                  <td className="dc-num">{fmt(Number(v.netDay))}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div>
        <SectionTitle>{t('dayCloseOperationsTable')} — {data.meta?.invoiceCountAll ?? 0}</SectionTitle>
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
              {(data.operations || []).length === 0 && (
                <tr><td colSpan={6} className="dc-empty">—</td></tr>
              )}
              {(data.operations || []).map((op: any) => (
                <tr key={op.id} className={op.status === 'cancelled' ? 'opacity-[0.55]' : undefined}>
                  <td className="font-bold">{op.invoiceNumber}</td>
                  <td>{kindLabel[op.kind] || op.kind}</td>
                  <td className="dc-num">{fmt(Number(op.totalAmount))}</td>
                  <td className="dc-muted max-w-[200px]">
                    {counterpartyLabel(op, lang)}
                  </td>
                  <td>{pickBilingual(lang, op.vaultNameAr ?? op.vaultName, op.vaultNameEn)}</td>
                  <td>{op.status === 'cancelled' ? t('statusCancelled') : t('statusActive')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

