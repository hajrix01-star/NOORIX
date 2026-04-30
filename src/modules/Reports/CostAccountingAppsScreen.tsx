/**
 * حاسبة تكاليف / تطبيقات — معزولة عن دفتر الحسابات؛ استيراد مبيعات من الملخصات اليومية فقط.
 */
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Decimal from 'decimal.js';
import { useApp } from '../../context/AppContext';
import { useTranslation } from '../../i18n/useTranslation';
import { useToast } from '../../context/ToastContext';
import {
  getDashboardSalesPack,
  getEmployeesMonthlySalaryContractTotal,
  getExpenseLines,
  throwIfApiFailed,
} from '../../services/api';
import { fmt } from '../../utils/format';
import { TAX_RATE } from '../../utils/math-engine';
import { formatUiDateTime, getSaudiYearMonth } from '../../utils/saudiDate';
import { openPrintWindow } from '../../utils/printUtils';
import { exportToExcel } from '../../utils/exportUtils';
import { Button, Input, cn, Modal } from '../../ui';
import Card from '../../ui/Card';
import {
  aggregateSalesChannelsInRange,
  computeCostAppsPl,
  reverseGrossTotalForTargetProfit,
  type CostAppsCommissionBase,
} from './costAccountingAppsModel';
import {
  buildCostAppsScenarioFile,
  parseCostAppsScenarioJson,
  type CostAppsScenarioRestore,
} from './costAccountingAppsScenario';
import { monthlyAmountFromExpenseLine } from './costAccountingAppsFixedExpenseImport';
import {
  type CostAppsSavedSlot,
  prependSavedSlot,
  readSavedSlots,
  removeSavedSlotById,
} from './costAccountingAppsSavedSlots';

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <span
        className="line-clamp-2 min-h-[2.5rem] text-[11px] font-semibold leading-snug text-noorix-muted"
        title={label}
      >
        {label}
      </span>
      {children}
    </div>
  );
}

function SectionHeading({
  children,
  tone = 'blue',
}: {
  children: React.ReactNode;
  tone?: 'blue' | 'green' | 'amber' | 'slate' | 'rose';
}) {
  const bar = {
    blue: 'bg-noorix-blue',
    green: 'bg-noorix-green',
    amber: 'bg-noorix-amber',
    slate: 'bg-noorix-text/45',
    rose: 'bg-noorix-red',
  }[tone];
  const shell = {
    blue: 'border-noorix-blue/25 bg-gradient-to-br from-noorix-blue/[0.12] via-noorix-blue/[0.04] to-[var(--noorix-surface-2)]',
    green: 'border-noorix-green/25 bg-gradient-to-br from-noorix-green/[0.11] via-noorix-green/[0.04] to-[var(--noorix-surface-2)]',
    amber: 'border-noorix-amber/35 bg-gradient-to-br from-noorix-amber/[0.14] via-noorix-amber/[0.05] to-[var(--noorix-surface-2)]',
    slate: 'border-noorix-border bg-gradient-to-br from-[var(--noorix-surface-2)] to-[var(--noorix-surface-1)]',
    rose: 'border-noorix-red/25 bg-gradient-to-br from-noorix-red/[0.09] via-noorix-red/[0.03] to-[var(--noorix-surface-2)]',
  }[tone];
  return (
    <div className={cn('mb-1 flex items-center gap-2.5 rounded-lg border px-3 py-2 shadow-sm', shell)}>
      <span className={cn('h-7 w-1 shrink-0 rounded-full', bar)} aria-hidden />
      <h3 className="m-0 min-w-0 text-[12px] font-bold leading-snug tracking-wide text-noorix-text">{children}</h3>
    </div>
  );
}

type FixedLine = { id: string; label: string; amount: string };

function ymdParts(y: number, m: number, d: number) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function lastDayOfMonth(y: number, m: number) {
  return new Date(y, m, 0).getDate();
}

function parseMoneyInput(s: string): Decimal {
  const n = String(s || '')
    .replace(/,/g, '')
    .replace(/\s/g, '')
    .trim();
  if (!n) return new Decimal(0);
  try {
    return new Decimal(n);
  } catch {
    return new Decimal(0);
  }
}

function newLine(): FixedLine {
  return { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, label: '', amount: '' };
}

function normalizeFixedLines(raw: unknown): FixedLine[] {
  if (!Array.isArray(raw) || raw.length === 0) return [newLine()];
  const rows: FixedLine[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const x = item as Record<string, unknown>;
    rows.push({
      id: typeof x.id === 'string' && x.id ? x.id : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      label: x.label != null ? String(x.label) : '',
      amount: x.amount != null ? String(x.amount) : '',
    });
  }
  return rows.length ? rows : [newLine()];
}

function draftKey(companyId: string) {
  return `noorix-cost-apps-draft-v1:${companyId}`;
}

function parseCsvForCostApps(text: string): { app: string; cash: string; bank: string } {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length);
  if (!lines.length) return { app: '', cash: '', bank: '' };
  const splitRow = (line: string) => line.split(/[,;\t]/).map((c) => c.trim().replace(/^"|"$/g, ''));
  if (lines.length === 1) {
    const cells = splitRow(lines[0]);
    const nums = cells.filter((c) => /^-?\d/.test(c.replace(/,/g, '')));
    if (cells.length >= 3 && nums.length >= 3) {
      return { app: cells[0], cash: cells[1], bank: cells[2] };
    }
  }
  const headers = splitRow(lines[0]).map((h) => h.toLowerCase());
  const valueRow = lines.length >= 2 ? splitRow(lines[1]) : splitRow(lines[0]);
  const row: Record<string, string> = {};
  headers.forEach((h, i) => {
    row[h] = valueRow[i] ?? '';
  });
  return {
    app: mapCsvAmount(row, ['app', 'تطبيق', 'apps']),
    cash: mapCsvAmount(row, ['cash', 'نقد', 'كاش']),
    bank: mapCsvAmount(row, ['bank', 'بنك', 'مدى', 'mada']),
  };
}

function mapCsvAmount(row: Record<string, string>, keys: string[]): string {
  for (const k of keys) {
    const v = row[k.toLowerCase()];
    if (v != null && String(v).trim() !== '') return String(v).trim();
  }
  return '';
}

export default function CostAccountingAppsScreen() {
  const { activeCompanyId, companies } = useApp();
  const { t, lang } = useTranslation();
  const { showToast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const scenarioFileRef = useRef<HTMLInputElement>(null);

  const company = companies?.find((c: any) => c.id === activeCompanyId);
  const companyName =
    lang === 'en' ? company?.nameEn || company?.nameAr || '' : company?.nameAr || company?.nameEn || '';

  const [grossAppStr, setGrossAppStr] = useState('');
  const [grossCashStr, setGrossCashStr] = useState('');
  const [grossBankStr, setGrossBankStr] = useState('');
  const [vatInclusive, setVatInclusive] = useState(true);
  const [vatRatePctStr, setVatRatePctStr] = useState(String(TAX_RATE * 100));
  const [commissionPctStr, setCommissionPctStr] = useState('25');
  const [commissionBase, setCommissionBase] = useState<CostAppsCommissionBase>('gross');
  const [fixedLines, setFixedLines] = useState<FixedLine[]>(() => [newLine()]);
  const sa0 = getSaudiYearMonth();
  const [importFrom, setImportFrom] = useState(() => ymdParts(sa0.year, sa0.month, 1));
  const [importTo, setImportTo] = useState(() => ymdParts(sa0.year, sa0.month, lastDayOfMonth(sa0.year, sa0.month)));
  const [importing, setImporting] = useState(false);
  const [importingFixedLines, setImportingFixedLines] = useState(false);
  const [importingSalary, setImportingSalary] = useState(false);
  const [salaryStr, setSalaryStr] = useState('');
  const [targetProfitStr, setTargetProfitStr] = useState('20000');
  const [reverseGrossStr, setReverseGrossStr] = useState('');
  const [appSharePctStr, setAppSharePctStr] = useState('');
  const [cogsLocalPctStr, setCogsLocalPctStr] = useState('0');
  const [appPriceMarkupPctStr, setAppPriceMarkupPctStr] = useState('0');
  /** حصة التطبيقات من إجمالي المبيعات في الحساب العكسي (%) */
  const [reverseAppSharePctStr, setReverseAppSharePctStr] = useState('30');
  const [savedSlots, setSavedSlots] = useState<CostAppsSavedSlot[]>([]);
  const [previewSlot, setPreviewSlot] = useState<CostAppsSavedSlot | null>(null);

  const vatRateDec = useMemo(() => {
    /** حقل الواجهة كنسبة مئوية (مثلاً 15 = 15٪) — يُحوَّل دائماً إلى كسر عشري للنموذج. */
    const p = parseMoneyInput(vatRatePctStr);
    return p.div(100);
  }, [vatRatePctStr]);

  const commissionPctDec = useMemo(() => parseMoneyInput(commissionPctStr), [commissionPctStr]);

  const fixedTotal = useMemo(() => {
    return fixedLines.reduce((acc, line) => acc.plus(parseMoneyInput(line.amount)), new Decimal(0));
  }, [fixedLines]);

  const fixedAnnualTotal = useMemo(() => fixedTotal.mul(12), [fixedTotal]);

  const grossApp = useMemo(() => parseMoneyInput(grossAppStr), [grossAppStr]);
  const grossCash = useMemo(() => parseMoneyInput(grossCashStr), [grossCashStr]);
  const grossBank = useMemo(() => parseMoneyInput(grossBankStr), [grossBankStr]);

  const grossInputsSum = useMemo(() => grossApp.plus(grossCash).plus(grossBank), [grossApp, grossCash, grossBank]);

  const salaryTotal = useMemo(() => parseMoneyInput(salaryStr), [salaryStr]);

  const baseParams = useMemo(
    () => ({
      grossApp,
      grossLocalCash: grossCash,
      grossLocalBank: grossBank,
      vatInclusive,
      vatRate: vatRateDec,
      commissionPct: commissionPctDec,
      commissionBase,
      fixedTotal,
      salaryTotal,
      cogsLocalPct: parseMoneyInput(cogsLocalPctStr),
      appPriceMarkupPct: parseMoneyInput(appPriceMarkupPctStr),
    }),
    [
      grossApp,
      grossCash,
      grossBank,
      vatInclusive,
      vatRateDec,
      commissionPctDec,
      commissionBase,
      fixedTotal,
      salaryTotal,
      cogsLocalPctStr,
      appPriceMarkupPctStr,
    ],
  );

  const plWith = useMemo(() => computeCostAppsPl({ ...baseParams, includeAppChannel: true }), [baseParams]);
  const plWithout = useMemo(() => computeCostAppsPl({ ...baseParams, includeAppChannel: false }), [baseParams]);

  useLayoutEffect(() => {
    if (!activeCompanyId) return;
    setImporting(false);
    setImportingFixedLines(false);
    setImportingSalary(false);

    const sa = getSaudiYearMonth();
    const defFrom = ymdParts(sa.year, sa.month, 1);
    const defTo = ymdParts(sa.year, sa.month, lastDayOfMonth(sa.year, sa.month));

    let o: Record<string, unknown> | null = null;
    try {
      const raw = localStorage.getItem(draftKey(activeCompanyId));
      if (raw) o = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      o = null;
    }

    const pickStr = (key: string, fallback: string) => {
      const v = o?.[key];
      return v != null ? String(v) : fallback;
    };

    setGrossAppStr(pickStr('grossAppStr', ''));
    setGrossCashStr(pickStr('grossCashStr', ''));
    setGrossBankStr(pickStr('grossBankStr', ''));
    setVatInclusive(o && typeof o.vatInclusive === 'boolean' ? o.vatInclusive : true);
    setVatRatePctStr(pickStr('vatRatePctStr', String(TAX_RATE * 100)));
    setCommissionPctStr(pickStr('commissionPctStr', '25'));
    setCommissionBase(o?.commissionBase === 'net' ? 'net' : 'gross');
    setFixedLines(normalizeFixedLines(o?.fixedLines));
    setSalaryStr(pickStr('salaryStr', ''));
    setImportFrom(pickStr('importFrom', defFrom));
    setImportTo(pickStr('importTo', defTo));
    setCogsLocalPctStr(pickStr('cogsLocalPctStr', '0'));
    setAppPriceMarkupPctStr(pickStr('appPriceMarkupPctStr', '0'));
    setReverseAppSharePctStr(pickStr('reverseAppSharePctStr', '30'));
    setTargetProfitStr(pickStr('targetProfitStr', '20000'));
    setReverseGrossStr(pickStr('reverseGrossStr', ''));
    setAppSharePctStr(pickStr('appSharePctStr', ''));
    setSavedSlots(readSavedSlots(activeCompanyId));
  }, [activeCompanyId]);

  useEffect(() => {
    if (!activeCompanyId) return;
    const payload = {
      grossAppStr,
      grossCashStr,
      grossBankStr,
      vatInclusive,
      vatRatePctStr,
      commissionPctStr,
      commissionBase,
      fixedLines,
      salaryStr,
      importFrom,
      importTo,
      cogsLocalPctStr,
      appPriceMarkupPctStr,
      reverseAppSharePctStr,
      targetProfitStr,
      reverseGrossStr,
      appSharePctStr,
    };
    try {
      localStorage.setItem(draftKey(activeCompanyId), JSON.stringify(payload));
    } catch {
      /* ignore */
    }
  }, [
    activeCompanyId,
    grossAppStr,
    grossCashStr,
    grossBankStr,
    vatInclusive,
    vatRatePctStr,
    commissionPctStr,
    commissionBase,
    fixedLines,
    salaryStr,
    importFrom,
    importTo,
    cogsLocalPctStr,
    appPriceMarkupPctStr,
    reverseAppSharePctStr,
    targetProfitStr,
    reverseGrossStr,
    appSharePctStr,
  ]);

  const fmt2 = (d: Decimal) => fmt(d.toNumber(), 2);

  const applyScenarioRestore = useCallback((restore: CostAppsScenarioRestore) => {
    if (restore.grossAppStr !== undefined) setGrossAppStr(restore.grossAppStr);
    if (restore.grossCashStr !== undefined) setGrossCashStr(restore.grossCashStr);
    if (restore.grossBankStr !== undefined) setGrossBankStr(restore.grossBankStr);
    if (restore.vatInclusive !== undefined) setVatInclusive(restore.vatInclusive);
    if (restore.vatRatePctStr !== undefined) setVatRatePctStr(restore.vatRatePctStr);
    if (restore.commissionPctStr !== undefined) setCommissionPctStr(restore.commissionPctStr);
    if (restore.commissionBase !== undefined) setCommissionBase(restore.commissionBase);
    if (restore.fixedLines !== undefined) setFixedLines(normalizeFixedLines(restore.fixedLines));
    if (restore.salaryStr !== undefined) setSalaryStr(restore.salaryStr);
    if (restore.importFrom !== undefined) setImportFrom(restore.importFrom);
    if (restore.importTo !== undefined) setImportTo(restore.importTo);
    if (restore.targetProfitStr !== undefined) setTargetProfitStr(restore.targetProfitStr);
    if (restore.reverseGrossStr !== undefined) setReverseGrossStr(restore.reverseGrossStr);
    if (restore.appSharePctStr !== undefined) setAppSharePctStr(restore.appSharePctStr);
    if (restore.reverseAppSharePctStr !== undefined) setReverseAppSharePctStr(restore.reverseAppSharePctStr);
    if (restore.cogsLocalPctStr !== undefined) setCogsLocalPctStr(restore.cogsLocalPctStr);
    if (restore.appPriceMarkupPctStr !== undefined) setAppPriceMarkupPctStr(restore.appPriceMarkupPctStr);
  }, []);

  const handleImportSystem = useCallback(async () => {
    if (!activeCompanyId) {
      showToast(t('pleaseSelectCompany'), 'error');
      return;
    }
    setImporting(true);
    try {
      const yf = parseInt(importFrom.slice(0, 4), 10);
      const yt = parseInt(importTo.slice(0, 4), 10);
      const ys = Math.min(yf, yt);
      const ye = Math.max(yf, yt);
      const res = await getDashboardSalesPack({
        companyId: activeCompanyId,
        yearStart: `${ys}-01-01`,
        yearEnd: `${ye}-12-31`,
        dailyStart: importFrom,
        dailyEnd: importTo,
      });
      throwIfApiFailed(res, t('reportCostAppsImportEmpty'));
      const raw = res.data?.data ?? res.data;
      const daily = raw?.dailySummaries ?? [];
      const agg = aggregateSalesChannelsInRange(daily, importFrom, importTo);
      if (agg.grossApp.plus(agg.grossLocalCash).plus(agg.grossLocalBank).lte(0)) {
        showToast(t('reportCostAppsImportEmpty'), 'error');
        return;
      }
      setGrossAppStr(agg.grossApp.toFixed(2));
      setGrossCashStr(agg.grossLocalCash.toFixed(2));
      setGrossBankStr(agg.grossLocalBank.toFixed(2));
      showToast(t('reportCostAppsImportOk'), 'success');
    } catch (e: any) {
      showToast(e?.message || String(e), 'error');
    } finally {
      setImporting(false);
    }
  }, [activeCompanyId, importFrom, importTo, showToast, t]);

  const handleImportSalaryFromHr = useCallback(async () => {
    if (!activeCompanyId) {
      showToast(t('pleaseSelectCompany'), 'error');
      return;
    }
    setImportingSalary(true);
    try {
      const res = await getEmployeesMonthlySalaryContractTotal(activeCompanyId);
      throwIfApiFailed(res, t('reportCostAppsSalaryLoadErr'));
      const payload = res.data as { totalAmount?: string; employeeCount?: number } | undefined;
      const raw = payload?.totalAmount;
      const amt = raw != null && String(raw).trim() !== ''
        ? new Decimal(String(raw).replace(/,/g, '').trim())
        : new Decimal(0);
      if (!amt.isFinite() || amt.lte(0)) {
        showToast(t('reportCostAppsSalaryImportEmpty'), 'error');
        return;
      }
      setSalaryStr(amt.toFixed(2));
      showToast(t('reportCostAppsSalaryImportOk'), 'success');
    } catch (e: any) {
      showToast(e?.message || String(e), 'error');
    } finally {
      setImportingSalary(false);
    }
  }, [activeCompanyId, showToast, t]);

  const handleImportFixedExpenses = useCallback(async () => {
    if (!activeCompanyId) {
      showToast(t('pleaseSelectCompany'), 'error');
      return;
    }
    if (typeof window !== 'undefined' && !window.confirm(t('reportCostAppsFixedImportConfirm'))) return;
    setImportingFixedLines(true);
    try {
      const res = await getExpenseLines(activeCompanyId, 'fixed_expense');
      throwIfApiFailed(res, t('reportCostAppsFixedImportEmpty'));
      const rows = Array.isArray(res.data) ? res.data : [];
      const mapped: FixedLine[] = [];
      for (const line of rows) {
        const m = monthlyAmountFromExpenseLine(line);
        if (m == null || m.lte(0)) continue;
        const nameAr = line?.nameAr != null ? String(line.nameAr).trim() : '';
        const nameEn = line?.nameEn != null ? String(line.nameEn).trim() : '';
        const label = (lang === 'en' ? nameEn || nameAr : nameAr || nameEn) || '—';
        const row = newLine();
        mapped.push({ ...row, label, amount: m.toFixed(2) });
      }
      if (!mapped.length) {
        showToast(t('reportCostAppsFixedImportEmpty'), 'error');
        return;
      }
      setFixedLines(mapped);
      showToast(t('reportCostAppsFixedImportOk', { count: mapped.length }), 'success');
    } catch (e: any) {
      showToast(e?.message || String(e), 'error');
    } finally {
      setImportingFixedLines(false);
    }
  }, [activeCompanyId, lang, showToast, t]);

  const handleCsvPick = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      e.target.value = '';
      if (!f) return;
      try {
        const text = await f.text();
        const parsed = parseCsvForCostApps(text);
        const app = parsed.app;
        const cash = parsed.cash;
        const bank = parsed.bank;
        if (!app && !cash && !bank) {
          showToast(t('reportCostAppsImportEmpty'), 'error');
          return;
        }
        if (app) setGrossAppStr(app.replace(/,/g, ''));
        if (cash) setGrossCashStr(cash.replace(/,/g, ''));
        if (bank) setGrossBankStr(bank.replace(/,/g, ''));
        showToast(t('reportCostAppsImportOk'), 'success');
      } catch (err: any) {
        showToast(err?.message || String(err), 'error');
      }
    },
    [showToast, t],
  );

  const handleReverse = useCallback(() => {
    const alphaPct = parseMoneyInput(reverseAppSharePctStr);
    const alpha = alphaPct.div(100);
    if (alpha.lt(0) || alpha.gt(1)) {
      showToast(t('reportCostAppsReverseErr'), 'error');
      setReverseGrossStr('');
      return;
    }
    const rev = reverseGrossTotalForTargetProfit({
      targetProfit: parseMoneyInput(targetProfitStr),
      fixedTotal,
      salaryTotal,
      appShareDecimal: alpha,
      vatInclusive,
      vatRate: vatRateDec,
      commissionPct: commissionPctDec,
      commissionBase,
      cogsLocalPct: parseMoneyInput(cogsLocalPctStr),
      appPriceMarkupPct: parseMoneyInput(appPriceMarkupPctStr),
    });
    if (!rev.ok) {
      showToast(t('reportCostAppsReverseErr'), 'error');
      setReverseGrossStr('');
      return;
    }
    setReverseGrossStr(rev.grossTotal.toFixed(2));
  }, [
    appPriceMarkupPctStr,
    cogsLocalPctStr,
    commissionBase,
    commissionPctDec,
    fixedTotal,
    reverseAppSharePctStr,
    salaryTotal,
    showToast,
    t,
    targetProfitStr,
    vatInclusive,
    vatRateDec,
  ]);

  const handleApplyReverse = useCallback(() => {
    const G = parseMoneyInput(reverseGrossStr);
    if (G.lte(0)) {
      showToast(t('reportCostAppsReverseErr'), 'error');
      return;
    }
    const alphaPct = parseMoneyInput(reverseAppSharePctStr);
    const alpha = alphaPct.div(100);
    if (alpha.lt(0) || alpha.gt(1)) {
      showToast(t('reportCostAppsReverseErr'), 'error');
      return;
    }
    const loc = grossCash.plus(grossBank);
    const cashRatio = loc.gt(0) ? grossCash.div(loc) : new Decimal(0.5);
    const gApp = G.mul(alpha);
    const gLoc = G.minus(gApp);
    const gCash = gLoc.mul(cashRatio);
    const gBank = gLoc.minus(gCash);
    setGrossAppStr(gApp.toFixed(2));
    setGrossCashStr(gCash.toFixed(2));
    setGrossBankStr(gBank.toFixed(2));
    showToast(t('reportCostAppsImportOk'), 'success');
  }, [grossBank, grossCash, reverseAppSharePctStr, reverseGrossStr, showToast, t]);

  const handleApplyAppShare = useCallback(() => {
    const G = plWith.grossTotal;
    if (G.lte(0)) {
      showToast(t('reportCostAppsReverseErr'), 'error');
      return;
    }
    const pct = parseMoneyInput(appSharePctStr);
    if (pct.lt(0) || pct.gt(100)) {
      showToast(t('reportCostAppsReverseErr'), 'error');
      return;
    }
    const alpha = pct.div(100);
    const loc = grossCash.plus(grossBank);
    const cashRatio = loc.gt(0) ? grossCash.div(loc) : new Decimal(0.5);
    const gApp = G.mul(alpha);
    const gLoc = G.minus(gApp);
    const gCash = gLoc.mul(cashRatio);
    const gBank = gLoc.minus(gCash);
    setGrossAppStr(gApp.toFixed(2));
    setGrossCashStr(gCash.toFixed(2));
    setGrossBankStr(gBank.toFixed(2));
  }, [appSharePctStr, grossBank, grossCash, plWith.grossTotal, showToast, t]);

  const handlePrint = useCallback(() => {
    const rows = [
      ['', t('reportCostAppsScenarioWithApps'), t('reportCostAppsScenarioNoApps')],
      [t('reportCostAppsGrossTotal'), fmt2(plWith.grossTotal), fmt2(plWithout.grossTotal)],
      [t('reportCostAppsNetSales'), fmt2(plWith.netSales), fmt2(plWithout.netSales)],
      [t('reportCostAppsVatExtracted'), fmt2(plWith.vatAmount), fmt2(plWithout.vatAmount)],
      [t('reportCostAppsCommission'), fmt2(plWith.commission), fmt2(plWithout.commission)],
      [t('reportCostAppsCogsLocal'), fmt2(plWith.cogsLocal), fmt2(plWithout.cogsLocal)],
      [t('reportCostAppsCogsApp'), fmt2(plWith.cogsApp), fmt2(plWithout.cogsApp)],
      [t('reportCostAppsCogsTotal'), fmt2(plWith.cogsTotal), fmt2(plWithout.cogsTotal)],
      [t('reportCostAppsFixedTotalRow'), fmt2(plWith.fixedTotal), fmt2(plWithout.fixedTotal)],
      [t('reportCostAppsSalaryRow'), fmt2(plWith.salaryTotal), fmt2(plWithout.salaryTotal)],
      [t('reportCostAppsNetProfit'), fmt2(plWith.netProfit), fmt2(plWithout.netProfit)],
    ];
    const body = `
      <div style="font-size:11px;line-height:1.35;margin-bottom:8px;">
        ${vatInclusive ? t('reportCostAppsVatInclusive') : '—'} · ${t('reportCostAppsCommissionPct')}: ${fmt(commissionPctDec.toNumber(), 2)}% · ${t('reportCostAppsVatRate')}: ${fmt(vatRateDec.mul(100).toNumber(), 2)}% · ${t('reportCostAppsCogsLocalPct')}: ${fmt(parseMoneyInput(cogsLocalPctStr).toNumber(), 2)}% · ${t('reportCostAppsAppMarkupPct')}: ${fmt(parseMoneyInput(appPriceMarkupPctStr).toNumber(), 2)}%
      </div>
      <table>
        <thead><tr><th>${t('reportItem')}</th><th>${t('reportCostAppsScenarioWithApps')}</th><th>${t('reportCostAppsScenarioNoApps')}</th></tr></thead>
        <tbody>
          ${rows
            .slice(1)
            .map(
              (r) =>
                `<tr><td>${String(r[0]).replace(/</g, '&lt;')}</td><td style="text-align:right">${r[1]}</td><td style="text-align:right">${r[2]}</td></tr>`,
            )
            .join('')}
        </tbody>
      </table>
      <h3 style="margin:12px 0 6px;font-size:13px;">${t('reportCostAppsFixedLines')}</h3>
      <table>
        <thead><tr><th>${t('reportCostAppsLineLabel')}</th><th style="text-align:right">${t('reportCostAppsLineMonthlyAmount')}</th><th style="text-align:right">${t('reportCostAppsLineAnnualAmount')}</th></tr></thead>
        <tbody>
          ${fixedLines
            .map((l) => {
              const m = parseMoneyInput(l.amount);
              const a = m.mul(12);
              return `<tr><td>${String(l.label || '—').replace(/</g, '&lt;')}</td><td style="text-align:right">${fmt(m.toNumber(), 2)}</td><td style="text-align:right">${fmt(a.toNumber(), 2)}</td></tr>`;
            })
            .join('')}
          <tr><td><strong>${t('reportTotalAmount')}</strong></td><td style="text-align:right"><strong>${fmt2(fixedTotal)}</strong></td><td style="text-align:right"><strong>${fmt2(fixedAnnualTotal)}</strong></td></tr>
        </tbody>
      </table>
    `;
    openPrintWindow({
      title: t('reportCostAppsTitle'),
      companyName: companyName || t('reports'),
      subtitle: t('reportCostAppsTitle'),
      landscape: false,
      showPageCounter: false,
      pageMarginMm: 10,
      extraCss: `
        table { font-size: 11px; }
        th, td { padding: 4px 6px; }
        body { font-size: 11px; }
        @page { margin: 10mm; }
      `,
      body,
    });
  }, [
    appPriceMarkupPctStr,
    commissionPctDec,
    companyName,
    cogsLocalPctStr,
    fixedAnnualTotal,
    fixedLines,
    fixedTotal,
    plWith,
    plWithout,
    t,
    vatInclusive,
    vatRateDec,
  ]);

  const handleExportExcel = useCallback(async () => {
    const rows = [
      { item: t('reportCostAppsGrossApp'), withApps: plWith.grossApp.toNumber(), noApps: 0 },
      { item: t('reportCostAppsGrossCash'), withApps: plWith.grossLocalCash.toNumber(), noApps: plWithout.grossLocalCash.toNumber() },
      { item: t('reportCostAppsGrossBank'), withApps: plWith.grossLocalBank.toNumber(), noApps: plWithout.grossLocalBank.toNumber() },
      { item: t('reportCostAppsGrossTotal'), withApps: plWith.grossTotal.toNumber(), noApps: plWithout.grossTotal.toNumber() },
      { item: t('reportCostAppsNetSales'), withApps: plWith.netSales.toNumber(), noApps: plWithout.netSales.toNumber() },
      { item: t('reportCostAppsCommission'), withApps: plWith.commission.toNumber(), noApps: plWithout.commission.toNumber() },
      { item: t('reportCostAppsCogsLocal'), withApps: plWith.cogsLocal.toNumber(), noApps: plWithout.cogsLocal.toNumber() },
      { item: t('reportCostAppsCogsApp'), withApps: plWith.cogsApp.toNumber(), noApps: plWithout.cogsApp.toNumber() },
      { item: t('reportCostAppsCogsTotal'), withApps: plWith.cogsTotal.toNumber(), noApps: plWithout.cogsTotal.toNumber() },
      { item: t('reportCostAppsFixedTotalRow'), withApps: plWith.fixedTotal.toNumber(), noApps: plWithout.fixedTotal.toNumber() },
      { item: t('reportCostAppsSalaryRow'), withApps: plWith.salaryTotal.toNumber(), noApps: plWithout.salaryTotal.toNumber() },
      { item: t('reportCostAppsNetProfit'), withApps: plWith.netProfit.toNumber(), noApps: plWithout.netProfit.toNumber() },
    ];
    await exportToExcel({
      data: rows,
      filename: 'cost-apps-calculator.xlsx',
      title: t('reportCostAppsTitle'),
      companyName: companyName || '',
      sheetName: 'P&L',
      columns: [
        { key: 'item', label: t('reportItem') },
        { key: 'withApps', label: t('reportCostAppsScenarioWithApps') },
        { key: 'noApps', label: t('reportCostAppsScenarioNoApps') },
      ],
      money2ColumnKeys: ['withApps', 'noApps'],
    });
  }, [companyName, plWith, plWithout, t]);

  const clearDraft = useCallback(() => {
    if (!activeCompanyId) return;
    localStorage.removeItem(draftKey(activeCompanyId));
    const sa = getSaudiYearMonth();
    const defFrom = ymdParts(sa.year, sa.month, 1);
    const defTo = ymdParts(sa.year, sa.month, lastDayOfMonth(sa.year, sa.month));
    setGrossAppStr('');
    setGrossCashStr('');
    setGrossBankStr('');
    setSalaryStr('');
    setVatInclusive(true);
    setVatRatePctStr(String(TAX_RATE * 100));
    setCommissionPctStr('25');
    setCommissionBase('gross');
    setFixedLines([newLine()]);
    setImportFrom(defFrom);
    setImportTo(defTo);
    setCogsLocalPctStr('0');
    setAppPriceMarkupPctStr('0');
    setReverseAppSharePctStr('30');
    setTargetProfitStr('20000');
    setReverseGrossStr('');
    setAppSharePctStr('');
    setImporting(false);
    showToast(lang === 'ar' ? 'تم المسح.' : 'Cleared.', 'success');
  }, [activeCompanyId, lang, showToast]);

  const handleExportScenario = useCallback(() => {
    const json = buildCostAppsScenarioFile({
      name: companyName || undefined,
      grossAppStr,
      grossCashStr,
      grossBankStr,
      vatInclusive,
      vatRatePctStr,
      commissionPctStr,
      commissionBase,
      fixedLines,
      salaryStr,
      importFrom,
      importTo,
      targetProfitStr,
      reverseGrossStr,
      appSharePctStr,
      reverseAppSharePctStr,
      cogsLocalPctStr,
      appPriceMarkupPctStr,
    });
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `noorix-cost-apps-scenario-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast(t('reportCostAppsScenarioExportOk'), 'success');
  }, [
    appPriceMarkupPctStr,
    appSharePctStr,
    cogsLocalPctStr,
    commissionBase,
    commissionPctStr,
    companyName,
    fixedLines,
    grossAppStr,
    grossBankStr,
    grossCashStr,
    importFrom,
    importTo,
    reverseAppSharePctStr,
    reverseGrossStr,
    salaryStr,
    showToast,
    t,
    targetProfitStr,
    vatInclusive,
    vatRatePctStr,
  ]);

  const handleSaveCalculatorSlot = useCallback(() => {
    if (!activeCompanyId) {
      showToast(t('pleaseSelectCompany'), 'error');
      return;
    }
    const suggested = formatUiDateTime(new Date(), lang, 'compact');
    const input = typeof window !== 'undefined' ? window.prompt(String(t('reportCostAppsSaveSlotPrompt')), suggested) : null;
    if (input === null) return;
    const labelTrim = input.trim();
    const json = buildCostAppsScenarioFile({
      name: labelTrim || companyName || undefined,
      grossAppStr,
      grossCashStr,
      grossBankStr,
      vatInclusive,
      vatRatePctStr,
      commissionPctStr,
      commissionBase,
      fixedLines,
      salaryStr,
      importFrom,
      importTo,
      targetProfitStr,
      reverseGrossStr,
      appSharePctStr,
      reverseAppSharePctStr,
      cogsLocalPctStr,
      appPriceMarkupPctStr,
    });
    const slot: CostAppsSavedSlot = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      savedAt: new Date().toISOString(),
      label: labelTrim || t('reportCostAppsSavedUnnamed'),
      scenarioJson: json,
    };
    setSavedSlots(prependSavedSlot(activeCompanyId, slot));
    showToast(t('reportCostAppsSaveSlotOk'), 'success');
  }, [
    activeCompanyId,
    appPriceMarkupPctStr,
    appSharePctStr,
    cogsLocalPctStr,
    commissionBase,
    commissionPctStr,
    companyName,
    fixedLines,
    grossAppStr,
    grossBankStr,
    grossCashStr,
    importFrom,
    importTo,
    lang,
    reverseAppSharePctStr,
    reverseGrossStr,
    salaryStr,
    showToast,
    t,
    targetProfitStr,
    vatInclusive,
    vatRatePctStr,
  ]);

  const handleImportSavedSlot = useCallback(
    (slot: CostAppsSavedSlot) => {
      if (typeof window !== 'undefined' && !window.confirm(t('reportCostAppsSavedImportConfirm'))) return;
      const res = parseCostAppsScenarioJson(slot.scenarioJson);
      if (!res.ok) {
        const key =
          res.error === 'invalid_json'
            ? 'reportCostAppsScenarioErrInvalidJson'
            : res.error === 'bad_version'
              ? 'reportCostAppsScenarioErrBadVersion'
              : res.error === 'not_object'
                ? 'reportCostAppsScenarioErrNotObject'
                : res.error === 'empty_scenario'
                  ? 'reportCostAppsScenarioErrEmpty'
                  : 'reportCostAppsScenarioErrGeneric';
        showToast(t(key), 'error');
        return;
      }
      applyScenarioRestore(res.restore);
      showToast(t('reportCostAppsScenarioImportOk'), 'success');
      setPreviewSlot(null);
    },
    [applyScenarioRestore, showToast, t],
  );

  const handleDeleteSavedSlot = useCallback(
    (slotId: string) => {
      if (!activeCompanyId) return;
      if (typeof window !== 'undefined' && !window.confirm(t('reportCostAppsSavedDeleteConfirm'))) return;
      setSavedSlots(removeSavedSlotById(activeCompanyId, slotId));
      setPreviewSlot((p) => (p?.id === slotId ? null : p));
      showToast(t('reportCostAppsSavedDeleteOk'), 'success');
    },
    [activeCompanyId, showToast, t],
  );

  const handleScenarioFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      e.target.value = '';
      if (!f) return;
      try {
        const text = await f.text();
        const res = parseCostAppsScenarioJson(text);
        if (!res.ok) {
          const key =
            res.error === 'invalid_json'
              ? 'reportCostAppsScenarioErrInvalidJson'
              : res.error === 'bad_version'
                ? 'reportCostAppsScenarioErrBadVersion'
                : res.error === 'not_object'
                  ? 'reportCostAppsScenarioErrNotObject'
                  : res.error === 'empty_scenario'
                    ? 'reportCostAppsScenarioErrEmpty'
                    : 'reportCostAppsScenarioErrGeneric';
          showToast(t(key), 'error');
          return;
        }
        const { restore } = res;
        applyScenarioRestore(restore);
        showToast(t('reportCostAppsScenarioImportOk'), 'success');
      } catch (err: any) {
        showToast(err?.message || String(err), 'error');
      }
    },
    [applyScenarioRestore, showToast, t],
  );

  if (!activeCompanyId) {
    return (
      <div className="rounded-lg border border-noorix-border bg-[var(--noorix-surface-1)] p-8 text-center text-noorix-muted">
        {t('pleaseSelectCompany')}
      </div>
    );
  }

  return (
    <div className="cost-apps-calc mx-auto flex w-full max-w-7xl flex-col gap-4 md:gap-5 print:max-w-none print:gap-2">
      <header className="noorix-print-hidden overflow-hidden rounded-2xl border border-noorix-border bg-gradient-to-br from-noorix-blue/[0.07] via-[var(--noorix-surface-1)] to-[var(--noorix-surface-1)] p-4 shadow-sm sm:p-5 print:hidden">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="m-0 text-xl font-bold tracking-tight text-noorix-text sm:text-2xl">{t('reportCostAppsTitle')}</h1>
              <span className="rounded-full border border-noorix-border bg-[var(--noorix-surface-2)] px-2.5 py-0.5 text-[11px] font-semibold text-noorix-muted">
                {t('reportCostAppsNav')}
              </span>
            </div>
            <p className="m-0 max-w-2xl text-sm leading-relaxed text-noorix-muted">{t('reportCostAppsDesc')}</p>
            <div className="flex flex-wrap gap-2 text-[11px] text-noorix-muted">
              <span className="inline-flex items-center gap-1.5 rounded-md bg-[var(--noorix-surface-2)] px-2 py-1">
                <span className="size-1.5 shrink-0 rounded-full bg-noorix-green" aria-hidden />
                {t('reportCostAppsSavedLocal')}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-md bg-[var(--noorix-surface-2)] px-2 py-1">
                <span className="size-1.5 shrink-0 rounded-full bg-noorix-amber" aria-hidden />
                {t('reportCostAppsScenarioHint')}
              </span>
            </div>
          </div>
          {companyName ? (
            <div className="shrink-0 rounded-xl border border-noorix-border bg-[var(--noorix-surface-2)] px-4 py-3 text-center sm:text-end">
              <p className="m-0 text-[10px] font-semibold uppercase tracking-wider text-noorix-muted">{t('reportCostAppsCompanyLabel')}</p>
              <p className="m-0 mt-1 max-w-[200px] truncate text-sm font-bold text-noorix-text sm:max-w-[240px]" title={companyName}>
                {companyName}
              </p>
            </div>
          ) : null}
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:items-start lg:gap-5 print:grid-cols-1 print:gap-3">
        {/* عمود المدخلات والاستيراد */}
        <div className="flex min-h-0 min-w-0 flex-col gap-4 lg:col-span-5 print:order-1">
          <div className="noorix-print-hidden flex items-center gap-2 border-b border-noorix-border pb-2 print:hidden">
            <span className="h-1 w-8 shrink-0 rounded-full bg-noorix-blue/80" aria-hidden />
            <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-noorix-muted">{t('reportCostAppsColumnInputs')}</span>
          </div>

          <Card
            variant="surface"
            padding="none"
            className="overflow-hidden border border-noorix-border shadow-sm print:break-inside-avoid print:shadow-none"
          >
            <div className="border-b border-noorix-border bg-gradient-to-br from-noorix-blue/[0.07] via-[var(--noorix-surface-2)] to-[var(--noorix-surface-2)] px-4 py-3.5 sm:px-5">
              <h2 className="m-0 text-base font-bold tracking-tight text-noorix-text sm:text-[17px]">{t('reportCostAppsInputsPanelTitle')}</h2>
              <p className="m-0 mt-1 max-w-3xl text-[11px] leading-relaxed text-noorix-muted">{t('reportCostAppsInputsPanelSubtitle')}</p>
            </div>

            <div className="space-y-5 p-4 sm:p-5">
          {/* —— المبيعات —— */}
          <div className="space-y-3">
            <SectionHeading tone="blue">{t('reportCostAppsZoneSales')}</SectionHeading>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field label={t('reportCostAppsGrossApp')} className="gap-1.5">
                <Input
                  value={grossAppStr}
                  onChange={(e: any) => setGrossAppStr(e.target.value)}
                  inputMode="decimal"
                  dir="ltr"
                  className="min-h-10 w-full text-end text-sm font-medium tabular-nums"
                />
              </Field>
              <Field label={t('reportCostAppsGrossCash')} className="gap-1.5">
                <Input
                  value={grossCashStr}
                  onChange={(e: any) => setGrossCashStr(e.target.value)}
                  inputMode="decimal"
                  dir="ltr"
                  className="min-h-10 w-full text-end text-sm font-medium tabular-nums"
                />
              </Field>
              <Field label={t('reportCostAppsGrossBank')} className="gap-1.5">
                <Input
                  value={grossBankStr}
                  onChange={(e: any) => setGrossBankStr(e.target.value)}
                  inputMode="decimal"
                  dir="ltr"
                  className="min-h-10 w-full text-end text-sm font-medium tabular-nums"
                />
              </Field>
            </div>
            <div className="flex flex-col gap-1 rounded-lg border border-noorix-border bg-[var(--noorix-surface-2)] px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-[12px] font-bold text-noorix-text">{t('reportCostAppsSalesInputsTotal')}</span>
              <span dir="ltr" className="text-base font-bold tabular-nums text-noorix-blue sm:text-lg">
                {fmt2(grossInputsSum)}
              </span>
            </div>
            <p className="m-0 text-[10px] leading-relaxed text-noorix-muted sm:text-[11px]">{t('reportCostAppsSalesInputsTotalHint')}</p>
          </div>

          {/* —— مزامنة المبيعات —— */}
          <div className="noorix-print-hidden space-y-3 border-t border-noorix-border pt-5 print:hidden">
            <SectionHeading tone="green">{t('reportCostAppsZoneSync')}</SectionHeading>
            <div className="flex flex-wrap items-end gap-2 sm:gap-3">
              <Field label={t('reportDateFrom')}>
                <Input type="date" value={importFrom} onChange={(e: any) => setImportFrom(e.target.value)} dir="ltr" className="min-h-10 min-w-[132px]" />
              </Field>
              <Field label={t('reportDateTo')}>
                <Input type="date" value={importTo} onChange={(e: any) => setImportTo(e.target.value)} dir="ltr" className="min-h-10 min-w-[132px]" />
              </Field>
              <Button type="button" variant="secondary" size="sm" disabled={importing} onClick={handleImportSystem}>
                {importing ? t('loading') : t('reportCostAppsImportBtn')}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => fileRef.current?.click()}>
                {t('reportCostAppsCsvImport')}
              </Button>
              <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleCsvPick} />
            </div>
            <p className="m-0 text-[10px] leading-relaxed text-noorix-muted sm:text-[11px]">{t('reportCostAppsImportHint')}</p>
            <p className="m-0 text-[10px] leading-relaxed text-noorix-muted sm:text-[11px]">{t('reportCostAppsCsvHint')}</p>
          </div>

          {/* —— ضريبة / عمولة / COGS —— */}
          <div className="space-y-3 border-t border-noorix-border pt-5">
            <SectionHeading tone="amber">{t('reportCostAppsZoneRates')}</SectionHeading>
            <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-noorix-border/90 bg-[var(--noorix-surface-1)] px-3 py-2 text-[13px] print:border-0 print:bg-transparent print:px-0 print:py-1">
              <input type="checkbox" className="size-4 shrink-0 rounded border-noorix-border" checked={vatInclusive} onChange={(e) => setVatInclusive(e.target.checked)} />
              <span>{t('reportCostAppsVatInclusive')}</span>
            </label>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Field label={t('reportCostAppsVatRate')}>
                <Input value={vatRatePctStr} onChange={(e: any) => setVatRatePctStr(e.target.value)} inputMode="decimal" dir="ltr" className="min-h-10 w-full text-end tabular-nums" />
              </Field>
              <Field label={t('reportCostAppsCommissionPct')}>
                <Input value={commissionPctStr} onChange={(e: any) => setCommissionPctStr(e.target.value)} inputMode="decimal" dir="ltr" className="min-h-10 w-full text-end tabular-nums" />
              </Field>
              <Field label={t('reportCostAppsCogsLocalPct')} className="max-lg:col-span-2">
                <Input value={cogsLocalPctStr} onChange={(e: any) => setCogsLocalPctStr(e.target.value)} inputMode="decimal" dir="ltr" className="min-h-10 w-full text-end tabular-nums" />
              </Field>
              <Field label={t('reportCostAppsAppMarkupPct')} className="max-lg:col-span-2">
                <Input value={appPriceMarkupPctStr} onChange={(e: any) => setAppPriceMarkupPctStr(e.target.value)} inputMode="decimal" dir="ltr" className="min-h-10 w-full text-end tabular-nums" />
              </Field>
            </div>
            <Field label={t('reportCostAppsCommissionBase')}>
              <select
                className={cn(
                  'min-h-10 w-full max-w-xl rounded-md border border-noorix-border bg-[var(--noorix-surface-1)] px-3 py-2 text-sm',
                )}
                value={commissionBase}
                onChange={(e) => setCommissionBase(e.target.value as CostAppsCommissionBase)}
              >
                <option value="gross">{t('reportCostAppsCommissionOnGross')}</option>
                <option value="net">{t('reportCostAppsCommissionOnNet')}</option>
              </select>
            </Field>
            <p className="m-0 text-[10px] leading-relaxed text-noorix-muted print:text-[10px]">{t('reportCostAppsCogsHint')}</p>
          </div>

          {/* —— حساب عكسي ونسبة التطبيق —— */}
          <div className="noorix-print-hidden space-y-3 border-t border-noorix-border pt-5 print:hidden">
            <SectionHeading tone="slate">{t('reportCostAppsZoneAnalysis')}</SectionHeading>
            <p className="m-0 -mt-1 text-[10px] text-noorix-muted">{t('reportCostAppsReverseTitle')}</p>
            <div className="flex flex-wrap items-end gap-2 sm:gap-3">
              <Field label={t('reportCostAppsTargetProfit')}>
                <Input value={targetProfitStr} onChange={(e: any) => setTargetProfitStr(e.target.value)} inputMode="decimal" dir="ltr" className="min-h-10 w-[128px] text-end tabular-nums" />
              </Field>
              <Field label={t('reportCostAppsReverseAppShare')}>
                <Input
                  value={reverseAppSharePctStr}
                  onChange={(e: any) => setReverseAppSharePctStr(e.target.value)}
                  inputMode="decimal"
                  dir="ltr"
                  className="min-h-10 w-[80px] text-end tabular-nums"
                />
              </Field>
              <Button type="button" variant="secondary" size="sm" onClick={handleReverse}>
                {t('reportCostAppsReverseCalc')}
              </Button>
            </div>
            {reverseGrossStr ? (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-noorix-border bg-[var(--noorix-surface-1)] px-3 py-2 text-sm">
                <span className="text-noorix-muted">{t('reportCostAppsGrossTotal')}:</span>
                <strong className="tabular-nums" dir="ltr">
                  {fmt(parseMoneyInput(reverseGrossStr).toNumber(), 2)}
                </strong>
                <Button type="button" variant="primary" size="sm" onClick={handleApplyReverse}>
                  {t('reportCostAppsReverseApply')}
                </Button>
              </div>
            ) : null}
            <div className="flex flex-wrap items-end gap-2 border-t border-dashed border-noorix-border/80 pt-3 sm:gap-3">
              <Field label={t('reportCostAppsAppShare')}>
                <Input
                  value={appSharePctStr}
                  onChange={(e: any) => setAppSharePctStr(e.target.value)}
                  placeholder={plWith.grossTotal.gt(0) ? fmt(plWith.appShareOfGrossPct.toNumber(), 2) : ''}
                  inputMode="decimal"
                  dir="ltr"
                  className="min-h-10 w-[96px] text-end tabular-nums"
                />
              </Field>
              <Button type="button" variant="secondary" size="sm" onClick={handleApplyAppShare}>
                {t('reportCostAppsApplyShare')}
              </Button>
            </div>
          </div>

          {/* —— الرواتب —— */}
          <div className="space-y-2 border-t border-noorix-border pt-5">
            <SectionHeading tone="rose">{t('reportCostAppsZonePayroll')}</SectionHeading>
            <p className="m-0 text-[10px] leading-relaxed text-noorix-muted sm:text-[11px] print:text-[10px]">{t('reportCostAppsSalaryImportHint')}</p>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <Field label={t('reportCostAppsSalaryAmount')} className="min-w-0 flex-1">
                <Input
                  value={salaryStr}
                  onChange={(e: any) => setSalaryStr(e.target.value)}
                  inputMode="decimal"
                  dir="ltr"
                  className="min-h-10 w-full max-w-xl text-end tabular-nums"
                  placeholder="0"
                />
              </Field>
              <span className="noorix-print-hidden shrink-0 print:hidden">
                <Button type="button" variant="secondary" size="sm" disabled={importingSalary} onClick={handleImportSalaryFromHr}>
                  {importingSalary ? t('loading') : t('reportCostAppsSalaryImportBtn')}
                </Button>
              </span>
            </div>
          </div>
        </div>
      </Card>

      <Card
        key={`cost-apps-fixed-${activeCompanyId}`}
        variant="surface"
        padding="none"
        className="overflow-hidden border border-noorix-border shadow-sm print:break-inside-avoid print:shadow-none"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-noorix-border bg-[var(--noorix-surface-2)] px-4 py-3">
          <div className="min-w-0">
            <h2 className="m-0 text-[15px] font-bold print:text-xs">{t('reportCostAppsFixedLines')}</h2>
            <p className="noorix-print-hidden m-0 mt-1 text-[11px] leading-relaxed text-noorix-muted print:hidden">
              {t('reportCostAppsFixedPerCompanyNote')}
            </p>
          </div>
          <div className="noorix-print-hidden flex flex-wrap gap-2 print:hidden">
            <Button type="button" variant="secondary" size="sm" disabled={importingFixedLines} onClick={handleImportFixedExpenses}>
              {importingFixedLines ? t('loading') : t('reportCostAppsFixedImportBtn')}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setFixedLines((prev) => [...prev, newLine()])}>
              {t('reportCostAppsAddLine')}
            </Button>
          </div>
        </div>
        <p className="noorix-print-hidden mx-4 mt-3 text-[11px] leading-relaxed text-noorix-muted print:hidden">{t('reportCostAppsFixedImportHint')}</p>
        <p className="mx-4 mt-2 text-[11px] text-noorix-muted print:mt-1 print:text-[10px]">{t('reportCostAppsFixedMonthlyNote')}</p>
        <div className="overflow-x-auto p-2 sm:p-0 print:p-0">
          <table className="w-full border-collapse border border-noorix-border text-sm print:text-[11px]">
            <thead>
              <tr className="bg-[var(--noorix-table-header-bg)]">
                <th className="border border-noorix-border px-2 py-2 text-start font-bold print:px-1 print:py-1">{t('reportCostAppsLineLabel')}</th>
                <th className="border border-noorix-border px-2 py-2 text-end font-bold print:px-1 print:py-1" style={{ width: '120px' }}>
                  {t('reportCostAppsLineMonthlyAmount')}
                </th>
                <th className="border border-noorix-border px-2 py-2 text-end font-bold print:px-1 print:py-1" style={{ width: '120px' }}>
                  {t('reportCostAppsLineAnnualAmount')}
                </th>
                <th className="noorix-print-hidden border border-noorix-border px-2 py-2 w-16 print:hidden" />
              </tr>
            </thead>
            <tbody>
              {fixedLines.map((line) => {
                const monthlyDec = parseMoneyInput(line.amount);
                const annualDec = monthlyDec.mul(12);
                return (
                  <tr key={line.id}>
                    <td className="border border-noorix-border p-1">
                      <Input value={line.label} onChange={(e: any) => setFixedLines((rows) => rows.map((r) => (r.id === line.id ? { ...r, label: e.target.value } : r)))} className="border-0" />
                    </td>
                    <td className="border border-noorix-border p-1">
                      <Input value={line.amount} onChange={(e: any) => setFixedLines((rows) => rows.map((r) => (r.id === line.id ? { ...r, amount: e.target.value } : r)))} dir="ltr" className="text-end border-0" inputMode="decimal" />
                    </td>
                    <td className="border border-noorix-border px-2 py-2 text-end tabular-nums text-noorix-text" dir="ltr">
                      {fmt2(annualDec)}
                    </td>
                    <td className="noorix-print-hidden border border-noorix-border p-1 print:hidden">
                      <Button
                        type="button"
                        variant="ghost"
                        className="min-h-0 px-2 py-1 text-xs"
                        onClick={() => setFixedLines((rows) => (rows.length <= 1 ? rows : rows.filter((r) => r.id !== line.id)))}
                      >
                        ×
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td className="border border-noorix-border px-2 py-2 font-bold">{t('reportTotalAmount')}</td>
                <td className="border border-noorix-border px-2 py-2 text-end font-bold tabular-nums" dir="ltr">
                  {fmt2(fixedTotal)}
                </td>
                <td className="border border-noorix-border px-2 py-2 text-end font-bold tabular-nums" dir="ltr">
                  {fmt2(fixedAnnualTotal)}
                </td>
                <td className="noorix-print-hidden print:hidden" />
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      <Card
        key={`cost-apps-saved-slots-${activeCompanyId}`}
        variant="surface"
        padding="none"
        className="noorix-print-hidden overflow-hidden border border-noorix-border shadow-sm print:hidden"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-noorix-border bg-[var(--noorix-surface-2)] px-4 py-3">
          <div className="min-w-0">
            <h2 className="m-0 text-[15px] font-bold">{t('reportCostAppsSavedSlotsTitle')}</h2>
            <p className="m-0 mt-1 text-[11px] leading-relaxed text-noorix-muted">{t('reportCostAppsSavedSlotsHint')}</p>
          </div>
          <Button type="button" variant="secondary" size="sm" onClick={handleSaveCalculatorSlot}>
            {t('reportCostAppsSaveSlotBtn')}
          </Button>
        </div>
        <div className="overflow-x-auto p-2 sm:p-4">
          {savedSlots.length === 0 ? (
            <p className="m-0 px-2 py-6 text-center text-[13px] text-noorix-muted">{t('reportCostAppsSavedSlotsEmpty')}</p>
          ) : (
            <table className="w-full border-collapse border border-noorix-border text-sm">
              <thead>
                <tr className="bg-[var(--noorix-table-header-bg)]">
                  <th className="border border-noorix-border px-2 py-2 text-start font-bold">{t('reportCostAppsSavedColLabel')}</th>
                  <th className="border border-noorix-border px-2 py-2 text-start font-bold">{t('reportCostAppsSavedColDate')}</th>
                  <th className="w-[1%] whitespace-nowrap border border-noorix-border px-2 py-2 text-center font-bold">{t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {savedSlots.map((slot) => (
                  <tr key={slot.id}>
                    <td className="border border-noorix-border px-2 py-2 font-medium">{slot.label}</td>
                    <td className="border border-noorix-border px-2 py-2 text-[12px] text-noorix-muted">{formatUiDateTime(slot.savedAt, lang, 'detailed')}</td>
                    <td className="border border-noorix-border px-2 py-2">
                      <div className="flex flex-wrap justify-center gap-1">
                        <Button type="button" variant="ghost" size="sm" onClick={() => setPreviewSlot(slot)}>
                          {t('reportCostAppsSavedView')}
                        </Button>
                        <Button type="button" variant="secondary" size="sm" onClick={() => handleImportSavedSlot(slot)}>
                          {t('reportCostAppsSavedImport')}
                        </Button>
                        <Button type="button" variant="ghost" size="sm" className="text-noorix-red" onClick={() => handleDeleteSavedSlot(slot.id)}>
                          {t('reportCostAppsSavedDelete')}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>

        </div>

        {/* عمود النتائج: مؤشرات + جدول الربحية + إجراءات */}
        <div className="flex min-h-0 min-w-0 flex-col gap-4 lg:col-span-7 lg:sticky lg:top-4 lg:z-[1] lg:self-start print:order-2">
          <div className="noorix-print-hidden flex items-center gap-2 border-b border-noorix-border pb-2 print:hidden">
            <span className="h-1 w-8 shrink-0 rounded-full bg-noorix-green/90" aria-hidden />
            <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-noorix-muted">{t('reportCostAppsColumnResults')}</span>
          </div>

          <div className="noorix-print-hidden grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3 print:hidden">
            <Card
              variant="stat"
              color="blue"
              label={t('reportCostAppsGrossTotal')}
              value={<span dir="ltr" className="tabular-nums">{fmt2(plWith.grossTotal)}</span>}
            />
            <Card
              variant="stat"
              color="green"
              label={t('reportCostAppsKpiNetWithApps')}
              value={<span dir="ltr" className="tabular-nums">{fmt2(plWith.netProfit)}</span>}
            />
            <Card
              variant="stat"
              color="gray"
              label={t('reportCostAppsKpiNetNoApps')}
              value={<span dir="ltr" className="tabular-nums">{fmt2(plWithout.netProfit)}</span>}
            />
          </div>

      <Card variant="surface" padding="none" className="overflow-hidden border border-noorix-border shadow-sm print:break-inside-avoid print:shadow-none">
        <div className="border-s-4 border-s-noorix-blue border-b border-noorix-border bg-[var(--noorix-surface-2)] px-4 py-3">
          <h2 className="m-0 text-[15px] font-bold text-noorix-text print:text-xs">{t('reportCostAppsPlSummaryTitle')}</h2>
          <p className="m-0 mt-1 text-[11px] text-noorix-muted print:hidden">{t('reportCostAppsNetProfit')}</p>
        </div>
        <div className="overflow-x-auto p-2 sm:p-0 print:p-0">
          <table className="w-full border-collapse border border-noorix-border text-sm print:text-[11px]">
            <thead>
              <tr className="bg-[var(--noorix-table-header-bg)]">
                <th className="border border-noorix-border px-2 py-2 text-start font-bold">{t('reportItem')}</th>
                <th className="border border-noorix-border px-2 py-2 text-end font-bold">{t('reportCostAppsScenarioWithApps')}</th>
                <th className="border border-noorix-border px-2 py-2 text-end font-bold">{t('reportCostAppsScenarioNoApps')}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-noorix-border px-2 py-2">{t('reportCostAppsGrossTotal')}</td>
                <td className="border border-noorix-border px-2 py-2 text-end" dir="ltr">
                  {fmt2(plWith.grossTotal)}
                </td>
                <td className="border border-noorix-border px-2 py-2 text-end" dir="ltr">
                  {fmt2(plWithout.grossTotal)}
                </td>
              </tr>
              <tr>
                <td className="border border-noorix-border px-2 py-2">{t('reportCostAppsNetSales')}</td>
                <td className="border border-noorix-border px-2 py-2 text-end" dir="ltr">
                  {fmt2(plWith.netSales)}
                </td>
                <td className="border border-noorix-border px-2 py-2 text-end" dir="ltr">
                  {fmt2(plWithout.netSales)}
                </td>
              </tr>
              <tr>
                <td className="border border-noorix-border px-2 py-2">{t('reportCostAppsVatExtracted')}</td>
                <td className="border border-noorix-border px-2 py-2 text-end" dir="ltr">
                  {fmt2(plWith.vatAmount)}
                </td>
                <td className="border border-noorix-border px-2 py-2 text-end" dir="ltr">
                  {fmt2(plWithout.vatAmount)}
                </td>
              </tr>
              <tr>
                <td className="border border-noorix-border px-2 py-2">{t('reportCostAppsCommission')}</td>
                <td className="border border-noorix-border px-2 py-2 text-end" dir="ltr">
                  {fmt2(plWith.commission)}
                </td>
                <td className="border border-noorix-border px-2 py-2 text-end" dir="ltr">
                  {fmt2(plWithout.commission)}
                </td>
              </tr>
              <tr>
                <td className="border border-noorix-border px-2 py-2">{t('reportCostAppsCogsLocal')}</td>
                <td className="border border-noorix-border px-2 py-2 text-end" dir="ltr">
                  {fmt2(plWith.cogsLocal)}
                </td>
                <td className="border border-noorix-border px-2 py-2 text-end" dir="ltr">
                  {fmt2(plWithout.cogsLocal)}
                </td>
              </tr>
              <tr>
                <td className="border border-noorix-border px-2 py-2">{t('reportCostAppsCogsApp')}</td>
                <td className="border border-noorix-border px-2 py-2 text-end" dir="ltr">
                  {fmt2(plWith.cogsApp)}
                </td>
                <td className="border border-noorix-border px-2 py-2 text-end" dir="ltr">
                  {fmt2(plWithout.cogsApp)}
                </td>
              </tr>
              <tr>
                <td className="border border-noorix-border px-2 py-2">{t('reportCostAppsCogsTotal')}</td>
                <td className="border border-noorix-border px-2 py-2 text-end" dir="ltr">
                  {fmt2(plWith.cogsTotal)}
                </td>
                <td className="border border-noorix-border px-2 py-2 text-end" dir="ltr">
                  {fmt2(plWithout.cogsTotal)}
                </td>
              </tr>
              <tr>
                <td className="border border-noorix-border px-2 py-2">{t('reportCostAppsFixedTotalRow')}</td>
                <td className="border border-noorix-border px-2 py-2 text-end" dir="ltr">
                  {fmt2(plWith.fixedTotal)}
                </td>
                <td className="border border-noorix-border px-2 py-2 text-end" dir="ltr">
                  {fmt2(plWithout.fixedTotal)}
                </td>
              </tr>
              <tr>
                <td className="border border-noorix-border px-2 py-2">{t('reportCostAppsSalaryRow')}</td>
                <td className="border border-noorix-border px-2 py-2 text-end" dir="ltr">
                  {fmt2(plWith.salaryTotal)}
                </td>
                <td className="border border-noorix-border px-2 py-2 text-end" dir="ltr">
                  {fmt2(plWithout.salaryTotal)}
                </td>
              </tr>
              <tr>
                <td className="border border-noorix-border px-2 py-2 font-bold">{t('reportCostAppsNetProfit')}</td>
                <td className="border border-noorix-border px-2 py-2 text-end font-bold text-noorix-blue" dir="ltr">
                  {fmt2(plWith.netProfit)}
                </td>
                <td className="border border-noorix-border px-2 py-2 text-end font-bold" dir="ltr">
                  {fmt2(plWithout.netProfit)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      <div className="noorix-print-hidden rounded-xl border border-noorix-border bg-[var(--noorix-surface-2)] p-4 print:hidden">
        <p className="m-0 mb-3 text-[11px] font-semibold uppercase tracking-wide text-noorix-muted">{t('actions')}</p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={handlePrint}>
            {t('reportCostAppsPrint')}
          </Button>
          <Button type="button" variant="secondary" onClick={handleExportExcel}>
            {t('reportCostAppsExportExcel')}
          </Button>
          <Button type="button" variant="secondary" onClick={handleExportScenario}>
            {t('reportCostAppsScenarioExport')}
          </Button>
          <Button type="button" variant="ghost" onClick={() => scenarioFileRef.current?.click()}>
            {t('reportCostAppsScenarioImport')}
          </Button>
          <input
            ref={scenarioFileRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={handleScenarioFileChange}
          />
          <Button type="button" variant="ghost" onClick={clearDraft}>
            {t('reportCostAppsResetDraft')}
          </Button>
        </div>
      </div>

        </div>
      </div>

      <Modal
        open={!!previewSlot}
        onClose={() => setPreviewSlot(null)}
        title={previewSlot?.label ?? ''}
        size="xl"
        footer={
          previewSlot ? (
            <>
              <Button type="button" variant="ghost" onClick={() => setPreviewSlot(null)}>
                {t('close')}
              </Button>
              <Button type="button" variant="primary" onClick={() => handleImportSavedSlot(previewSlot)}>
                {t('reportCostAppsSavedImport')}
              </Button>
            </>
          ) : undefined
        }
      >
        {previewSlot ? (
          <pre
            className="m-0 max-w-full overflow-x-auto font-mono text-[12px] leading-relaxed text-noorix-text whitespace-pre-wrap break-words"
            dir="ltr"
          >
            {(() => {
              try {
                return JSON.stringify(JSON.parse(previewSlot.scenarioJson), null, 2);
              } catch {
                return previewSlot.scenarioJson;
              }
            })()}
          </pre>
        ) : null}
      </Modal>

      <style>{`
        @media print {
          .noorix-print-hidden { display: none !important; }
          .cost-apps-calc { break-inside: avoid; }
        }
      `}</style>
    </div>
  );
}
