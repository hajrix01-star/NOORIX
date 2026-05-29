import { fmt } from '../../../utils/format';

const MAX_WA_OPERATIONS = 12;

export type DayCloseKindLabels = Record<string, string>;

function pickBilingual(lang: string, nameAr?: string | null, nameEn?: string | null): string {
  const ar = nameAr != null && String(nameAr).trim() !== '' ? String(nameAr).trim() : '';
  const en = nameEn != null && String(nameEn).trim() !== '' ? String(nameEn).trim() : '';
  if (lang === 'en') return en || ar || '—';
  return ar || en || '—';
}

function counterpartyLabel(op: any, lang: string): string {
  const sup = pickBilingual(lang, op.supplierNameAr ?? op.supplierName, op.supplierNameEn);
  if (sup !== '—') return sup;
  if (op.employeeName) return String(op.employeeName);
  const el = pickBilingual(lang, op.expenseLineNameAr ?? op.expenseLineName, op.expenseLineNameEn);
  if (el !== '—') return el;
  const notes = op.notes != null ? String(op.notes).trim() : '';
  return notes || '—';
}

function getDayCloseCashKpis(cash: any) {
  const lifetime = Number(cash?.balanceLifetimeCashVaultsEod ?? cash?.balanceEndOfDayCashVaults ?? 0);
  const raw = cash?.availableCashMonthScoped;
  const hasMonthScoped = raw != null && raw !== '';
  const monthScoped = hasMonthScoped ? Number(raw) : lifetime;
  return { monthScoped, lifetime };
}

function sectionHeader(t: (key: string) => string, key: string): string {
  return `━━ ${t(key)} ━━`;
}

export type BuildDayCloseWhatsAppParams = {
  companyName: string;
  dateLabel: string;
  data: any;
  kindLabel: DayCloseKindLabels;
  lang: string;
  t: (key: string, ...args: unknown[]) => string;
};

/** نص واتساب منسّق لتقرير نهاية اليوم (ملخص + تفاصيل مختصرة) */
export function buildDayCloseWhatsAppText(p: BuildDayCloseWhatsAppParams): string {
  const { companyName, dateLabel, data, kindLabel, lang, t } = p;
  const name = (companyName || '').trim();
  const { monthScoped, lifetime } = getDayCloseCashKpis(data.cash);
  const showLifetimeFootnote =
    Number.isFinite(monthScoped) &&
    Number.isFinite(lifetime) &&
    Math.abs(monthScoped - lifetime) > 1e-6;

  const lines: string[] = [
    `${t('dayCloseWaTitle')}${name ? ` — ${name}` : ''}`,
    `${t('dayCloseWaDateLine')} ${dateLabel}`,
    '',
    sectionHeader(t, 'dayCloseWaSectionSummary'),
    `${t('dayCloseWaInflowLine')} ${fmt(Number(data.sums?.inflow?.total || 0))} SR (${data.sums?.inflow?.count ?? 0} ${t('dayCloseOperations')})`,
    `${t('dayCloseWaOutflowLine')} ${fmt(Number(data.sums?.outflow?.total || 0))} SR (${data.sums?.outflow?.count ?? 0} ${t('dayCloseOperations')})`,
    `${t('dayCloseWaNetCashLine')} ${fmt(Number(data.cash?.netDay ?? 0))} SR`,
    `${t('dayCloseWaAvailableCashLine')} ${fmt(monthScoped)} SR`,
  ];

  if (showLifetimeFootnote) {
    lines.push(`${t('dayCloseLifetimeCashFootnote', fmt(lifetime))}`);
  }

  lines.push(
    `${t('dayCloseWaCashMoveLine')} ${t('dayCloseCashIn')} ${fmt(Number(data.cash?.dayTotalIn ?? 0))} · ${t('dayCloseCashOut')} ${fmt(Number(data.cash?.dayTotalOut ?? 0))} SR`,
    `${t('dayCloseWaTransfersLine')} ${data.transfers?.count ?? 0} / ${fmt(Number(data.transfers?.volume || 0))} SR`,
    '',
  );

  const byKind = data.byKind || [];
  if (byKind.length > 0) {
    lines.push(sectionHeader(t, 'dayCloseByKind'));
    for (const row of byKind) {
      const label = kindLabel[row.kind] || row.kind;
      lines.push(`• ${label}: ${row.count} · ${fmt(Number(row.total))} SR`);
    }
    lines.push('');
  }

  const outflowChannels = data.outflowByPaymentMethod || [];
  if (outflowChannels.length > 0) {
    lines.push(sectionHeader(t, 'dayCloseByPaymentChannel'));
    for (const row of outflowChannels) {
      const vault = pickBilingual(lang, row.nameAr ?? row.label, row.nameEn);
      lines.push(`• ${vault}: ${fmt(Number(row.total))} SR`);
    }
    lines.push('');
  }

  const salesSummaries = data.salesSummaries || [];
  if (salesSummaries.length > 0) {
    lines.push(sectionHeader(t, 'dayCloseSalesSummaries'));
    for (const s of salesSummaries) {
      lines.push(
        `• #${s.summaryNumber}: ${fmt(Number(s.customerCount), 0)} ${t('dayCloseCustomers')} · ${t('dayCloseCashOnHand')} ${fmt(Number(s.cashOnHand))} · ${fmt(Number(s.totalAmount))} SR`,
      );
    }
    lines.push('');
  }

  const vaultMovement = data.vaults?.movementOnDayByVault || [];
  if (vaultMovement.length > 0) {
    lines.push(sectionHeader(t, 'dayCloseVaultMovementDay'));
    for (const v of vaultMovement) {
      const vaultName = pickBilingual(lang, v.nameAr, v.nameEn);
      lines.push(
        `• ${vaultName}: ${t('dayCloseCashIn')} ${fmt(Number(v.totalIn))} · ${t('dayCloseCashOut')} ${fmt(Number(v.totalOut))} · ${t('dayCloseNet')} ${fmt(Number(v.netDay))} SR`,
      );
    }
    lines.push('');
  }

  const operations = data.operations || [];
  const totalOps = data.meta?.invoiceCountAll ?? operations.length;
  if (operations.length > 0) {
    lines.push(sectionHeader(t, 'dayCloseOperationsTable'));
    const slice = operations.slice(0, MAX_WA_OPERATIONS);
    for (const op of slice) {
      const kind = kindLabel[op.kind] || op.kind;
      const party = counterpartyLabel(op, lang);
      const vault = pickBilingual(lang, op.vaultNameAr ?? op.vaultName, op.vaultNameEn);
      const statusSuffix = op.status === 'cancelled' ? ` (${t('statusCancelled')})` : '';
      lines.push(
        `• ${op.invoiceNumber} · ${kind} · ${fmt(Number(op.totalAmount))} SR · ${party} · ${vault}${statusSuffix}`,
      );
    }
    const truncatedTable = data.meta?.invoicesTruncated;
    const remaining = totalOps - slice.length;
    if (truncatedTable || remaining > 0) {
      lines.push(t('dayCloseWaOpsMore', totalOps, slice.length));
    }
    lines.push('');
  }

  lines.push(t('dayCloseWaFooter'));
  return lines.join('\n').trim();
}

export function openDayCloseWhatsApp(text: string) {
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
}
