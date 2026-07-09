import {
  getInvoices,
  getMovements,
  unwrapApiList,
} from '../../../services/api';
import { formatSaudiDate, toYmd } from '../../../utils/saudiDate';
import { buildPrintHtmlTable } from '../../../utils/printTableHtml';
import { buildPrintDocumentHtml } from '../../../utils/printUtils';
import { employeeDisplayName } from '../../../utils/employeeDisplayName';
import { toLocalDayKey } from '../utils/payrollAttendanceMath';
import { hrFmt } from '../utils/hrFmt';
import type { HrEmployee } from '../../../types/api';

export type HrInvoiceRef = Record<string, unknown> & {
  id?: string | null;
  invoiceNumber?: string | number | null;
  kind?: string | null;
  status?: string | null;
  notes?: string | null;
};

export type HrMovementRef = Record<string, unknown> & {
  notes?: string | null;
};

export type TerminationSettlementPrintPreview = {
  fullMonthly: number;
  grossProrated: number;
  netSuggested: number;
  pr: {
    effectiveEnd?: string | Date | null;
    employedDays: number;
    daysInMonth: number;
  };
};

type Translate = (key: string) => string;

function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function effectiveEndYmd(
  pr: { effectiveEnd?: string | Date | null } | null | undefined,
  fallbackYmd: string,
): string {
  if (pr?.effectiveEnd) return toLocalDayKey(new Date(pr.effectiveEnd));
  return toYmd(fallbackYmd);
}

export function lastDayOfMonthYmd(monthFirstYmd: string): string {
  const s = toYmd(monthFirstYmd);
  const parts = s.split('-');
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return s;
  return toLocalDayKey(new Date(y, m, 0));
}

export function terminationSalaryInvoiceTag(employeeId: string, monthFirstYmd: string): string {
  const ym = toYmd(monthFirstYmd).slice(0, 7);
  return `[NOORIX_TERM_SALARY:${employeeId}:${ym}]`;
}

export async function findTerminationSalaryInvoiceThisMonth(
  companyId: string,
  employeeId: string,
  monthFirstYmd: string,
  tag: string,
): Promise<HrInvoiceRef | null> {
  const from = toYmd(monthFirstYmd);
  const to = lastDayOfMonthYmd(from);
  const res = await getInvoices(companyId, from, to, 1, 100, null, employeeId, 'salary');
  const items = unwrapApiList<HrInvoiceRef>(res, 'فشل تحميل فواتير راتب إنهاء الخدمة');
  return (
    items.find(
      (inv) =>
        inv.kind === 'salary' &&
        inv.status !== 'cancelled' &&
        String(inv.notes || '').includes(tag),
    ) || null
  );
}

export async function hasTerminationMovementForInvoiceNumber(
  companyId: string,
  employeeId: string,
  invoiceNumber: string,
): Promise<boolean> {
  if (!invoiceNumber) return false;
  const res = await getMovements(companyId, employeeId);
  const list = unwrapApiList<HrMovementRef>(res, 'فشل تحميل حركات الموظف');
  const marker = `صرف راتب إنهاء خدمة — ${invoiceNumber}`;
  return list.some((movement) => String(movement.notes || '').includes(marker));
}

export function buildTerminationSettlementPrintHtml(input: {
  employee: HrEmployee;
  lang: string;
  companyName: string;
  companyLogoUrl?: string;
  terminationYmd: string;
  monthFirst: string;
  preview: TerminationSettlementPrintPreview;
  advancesRemaining: number;
  t: Translate;
}): string {
  const { employee, lang, companyName, companyLogoUrl, terminationYmd, monthFirst, preview, advancesRemaining, t } = input;
  const name = employeeDisplayName(employee, lang);
  const endDisplay = formatSaudiDate(preview.pr.effectiveEnd || terminationYmd);
  const monthDisplay = formatSaudiDate(monthFirst);
  const rows = [
    [`${t('employeeName')} / Employee`, name],
    [`${t('terminationDate')} / Termination`, formatSaudiDate(terminationYmd)],
    [`${t('payrollMonth')} / Payroll month`, monthDisplay],
    [`${t('terminationSettlementMonthlyTotal')} / Monthly package`, `${hrFmt(preview.fullMonthly)} SR`],
    [`${t('terminationSettlementEmployedDays')} / Days in month`, `${String(preview.pr.employedDays)} / ${String(preview.pr.daysInMonth)}`],
    [`${t('terminationSettlementEffectiveEnd')} / Last work day`, endDisplay],
    [`${t('terminationSettlementProratedGross')} / Prorated gross (est.)`, `${hrFmt(preview.grossProrated)} SR`],
    [`${t('terminationSettlementAdvancesOutstanding')} / Advances`, `${hrFmt(advancesRemaining)} SR`],
    [`${t('terminationSettlementSuggestedNet')} / Net (estimate)`, `${hrFmt(preview.netSuggested)} SR`],
  ];
  const settlementTable = buildPrintHtmlTable({
    wrapperClassName: null,
    bodyRows: rows.map(([label, value]) => ({
      cells: [
        { value: label, style: 'font-weight:600;width:42%' },
        { value },
      ],
    })),
  });

  const body = `
    <div style="font-family:Cairo,Tahoma,sans-serif;direction:rtl;padding:16px;max-width:720px;margin:0 auto">
      <h1 style="font-size:18px;margin:0 0 8px">${esc(t('terminationSettlementTitle'))}</h1>
      <p style="font-size:12px;color:#64748b;margin:0 0 16px">${esc(t('terminationSettlementDisclaimer'))}</p>
      ${settlementTable}
    </div>`;

  return buildPrintDocumentHtml({
    title: t('terminationSettlementTitle'),
    companyName: companyName || undefined,
    logoUrl: companyLogoUrl || '',
    subtitle: name,
    body,
  });
}
