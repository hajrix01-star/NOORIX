import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import Decimal from 'decimal.js';
import { useApp } from '../../../context/AppContext';
import { useTranslation } from '../../../i18n/useTranslation';
import { useToast } from '../../../context/ToastContext';
import {
  getDashboardSalesPack,
  getEmployeesMonthlySalaryContractTotal,
  getExpenseLines,
  throwIfApiFailed,
} from '../../../services/api';
import { fmt } from '../../../utils/format';
import { TAX_RATE } from '../../../utils/math-engine';
import { formatUiDateTime, getSaudiYearMonth } from '../../../utils/saudiDate';
import { openPrintWindow } from '../../../utils/printUtils';
import { exportToExcel } from '../../../utils/exportUtils';
import {
  aggregateSalesChannelsInRange,
  computeCostAppsPl,
  reverseGrossTotalForTargetProfit,
  type CostAppsCommissionBase,
} from '../costAccountingAppsModel';
import {
  buildCostAppsScenarioFile,
  parseCostAppsScenarioJson,
  type CostAppsScenarioRestore,
} from '../costAccountingAppsScenario';
import { monthlyAmountFromExpenseLine } from '../costAccountingAppsFixedExpenseImport';
import {
  type CostAppsSavedSlot,
  prependSavedSlot,
  readSavedSlots,
  removeSavedSlotById,
} from '../costAccountingAppsSavedSlots';
import {
  draftKey,
  formatCommissionPctForColumnLabel,
  formatYearMonthLabel,
  importMonthKeyFromRange,
  lastDayOfMonth,
  newLine,
  normalizeFixedLines,
  parseCsvForCostApps,
  parseMoneyInput,
  ymdParts,
  type FixedLine,
} from './costAccountingAppsScreenUtils';

export function useCostAccountingAppsScreen() {
  const { activeCompanyId, companies } = useApp();
  const { t, lang } = useTranslation();
  const { showToast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

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
  const [importingExpenses, setImportingExpenses] = useState(false);
  const [salaryStr, setSalaryStr] = useState('');
  const [targetProfitStr, setTargetProfitStr] = useState('20000');
  const [reverseGrossStr, setReverseGrossStr] = useState('');
  const [appSharePctStr, setAppSharePctStr] = useState('');
  const [cogsLocalPctStr, setCogsLocalPctStr] = useState('0');
  const [appPriceMarkupPctStr, setAppPriceMarkupPctStr] = useState('0');
  /** حصة التطبيقات من إجمالي المبيعات في الحساب العكسي (%) */
  const [reverseAppSharePctStr, setReverseAppSharePctStr] = useState('30');
  /** إجمالي مبيعات لمعاينة صافي الربح (توزيع بنفس حصة التطبيقات أعلاه) */
  const [probeSalesGrossStr, setProbeSalesGrossStr] = useState('');
  const [probePlPreview, setProbePlPreview] = useState<{
    netProfit: Decimal;
    netSales: Decimal;
    commission: Decimal;
    grossTotal: Decimal;
  } | null>(null);
  const [savedSlots, setSavedSlots] = useState<CostAppsSavedSlot[]>([]);
  const [previewSlot, setPreviewSlot] = useState<CostAppsSavedSlot | null>(null);

  const vatRateDec = useMemo(() => {
    /** حقل الواجهة كنسبة مئوية (مثلاً 15 = 15٪) — يُحوَّل دائماً إلى كسر عشري للنموذج. */
    const p = parseMoneyInput(vatRatePctStr);
    return p.div(100);
  }, [vatRatePctStr]);

  const commissionPctDec = useMemo(() => parseMoneyInput(commissionPctStr), [commissionPctStr]);

  const withAppsScenarioLabel = useMemo(
    () => t('reportCostAppsScenarioWithAppsPct', { pct: formatCommissionPctForColumnLabel(commissionPctDec) }),
    [t, commissionPctDec],
  );

  const fixedTotal = useMemo(() => {
    return fixedLines.reduce((acc, line) => acc.plus(parseMoneyInput(line.amount)), new Decimal(0));
  }, [fixedLines]);

  const grossApp = useMemo(() => parseMoneyInput(grossAppStr), [grossAppStr]);
  const grossCash = useMemo(() => parseMoneyInput(grossCashStr), [grossCashStr]);
  const grossBank = useMemo(() => parseMoneyInput(grossBankStr), [grossBankStr]);

  const grossInputsSum = useMemo(() => grossApp.plus(grossCash).plus(grossBank), [grossApp, grossCash, grossBank]);

  const salaryTotal = useMemo(() => parseMoneyInput(salaryStr), [salaryStr]);

  const expensesMonthlyTotal = useMemo(() => fixedTotal.plus(salaryTotal), [fixedTotal, salaryTotal]);
  const expensesAnnualTotal = useMemo(() => expensesMonthlyTotal.mul(12), [expensesMonthlyTotal]);

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

  const appSalesRowLabel = useMemo(
    () =>
      t('reportCostAppsPlAppSalesShare', {
        pct: formatCommissionPctForColumnLabel(plWith.appShareOfGrossPct),
      }),
    [t, plWith.appShareOfGrossPct],
  );

  const importYearForPicker = useMemo(() => {
    const y = parseInt(importFrom.slice(0, 4), 10);
    return Number.isFinite(y) && y >= 2000 ? y : getSaudiYearMonth().year;
  }, [importFrom]);

  const importMonthOptions = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => {
        const m = i + 1;
        const y = importYearForPicker;
        return {
          value: `${y}-${String(m).padStart(2, '0')}`,
          label: formatYearMonthLabel(y, m, lang),
        };
      }),
    [importYearForPicker, lang],
  );

  const importMonthSelectValue = useMemo(() => {
    const k = importMonthKeyFromRange(importFrom, importTo);
    if (k) return k;
    if (importFrom.length >= 7) {
      const m = parseInt(importFrom.slice(5, 7), 10);
      if (Number.isFinite(m) && m >= 1 && m <= 12) {
        return `${importYearForPicker}-${String(m).padStart(2, '0')}`;
      }
    }
    const sa = getSaudiYearMonth();
    return `${sa.year}-${String(sa.month).padStart(2, '0')}`;
  }, [importFrom, importTo, importYearForPicker]);

  useLayoutEffect(() => {
    if (!activeCompanyId) return;
    setImporting(false);
    setImportingExpenses(false);

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
    setProbeSalesGrossStr(pickStr('probeSalesGrossStr', ''));
    setProbePlPreview(null);
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
      probeSalesGrossStr,
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
    probeSalesGrossStr,
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
    if (restore.probeSalesGrossStr !== undefined) setProbeSalesGrossStr(restore.probeSalesGrossStr);
    if (restore.cogsLocalPctStr !== undefined) setCogsLocalPctStr(restore.cogsLocalPctStr);
    if (restore.appPriceMarkupPctStr !== undefined) setAppPriceMarkupPctStr(restore.appPriceMarkupPctStr);
    setProbePlPreview(null);
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

  const handleImportExpensesFromSystem = useCallback(async () => {
    if (!activeCompanyId) {
      showToast(t('pleaseSelectCompany'), 'error');
      return;
    }
    if (typeof window !== 'undefined' && !window.confirm(t('reportCostAppsFixedImportConfirm'))) return;
    setImportingExpenses(true);
    try {
      const [expRes, salRes] = await Promise.all([
        getExpenseLines(activeCompanyId, 'fixed_expense'),
        getEmployeesMonthlySalaryContractTotal(activeCompanyId),
      ]);
      const rows = Array.isArray(expRes.data) ? expRes.data : [];
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
      let payrollOk = false;
      let amt = new Decimal(0);
      if (salRes.success) {
        const payload = salRes.data as { totalAmount?: string; employeeCount?: number } | undefined;
        const rawSal = payload?.totalAmount;
        amt =
          rawSal != null && String(rawSal).trim() !== ''
            ? new Decimal(String(rawSal).replace(/,/g, '').trim())
            : new Decimal(0);
        payrollOk = amt.isFinite() && amt.gt(0);
      } else {
        showToast(String(salRes.error || t('reportCostAppsSalaryLoadErr')), 'error');
      }
      if (!mapped.length && !payrollOk) {
        showToast(t('reportCostAppsExpensesImportEmpty'), 'error');
        return;
      }
      setFixedLines(mapped.length ? mapped : [newLine()]);
      if (salRes.success) {
        setSalaryStr(payrollOk ? amt.toFixed(2) : '');
      }
      const payrollMonthly = payrollOk ? fmt(amt.toNumber(), 2) : '—';
      showToast(t('reportCostAppsExpensesImportOk', { expenseCount: mapped.length, payrollMonthly }), 'success');
    } catch (e: any) {
      showToast(e?.message || String(e), 'error');
    } finally {
      setImportingExpenses(false);
    }
  }, [activeCompanyId, lang, showToast, t]);

  const handleCsvPick = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
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

  const handleProbeProfit = useCallback(() => {
    const G = parseMoneyInput(probeSalesGrossStr);
    const alphaPct = parseMoneyInput(reverseAppSharePctStr);
    const alpha = alphaPct.div(100);
    if (G.lte(0) || alpha.lt(0) || alpha.gt(1)) {
      showToast(t('reportCostAppsReverseErr'), 'error');
      setProbePlPreview(null);
      return;
    }
    const loc = grossCash.plus(grossBank);
    const cashRatio = loc.gt(0) ? grossCash.div(loc) : new Decimal(0.5);
    const gApp = G.mul(alpha);
    const gLoc = G.minus(gApp);
    const gCashNew = gLoc.mul(cashRatio);
    const gBankNew = gLoc.minus(gCashNew);
    const pl = computeCostAppsPl({
      grossApp: gApp,
      grossLocalCash: gCashNew,
      grossLocalBank: gBankNew,
      vatInclusive,
      vatRate: vatRateDec,
      commissionPct: commissionPctDec,
      commissionBase,
      fixedTotal,
      salaryTotal,
      includeAppChannel: alpha.gt(0),
      cogsLocalPct: parseMoneyInput(cogsLocalPctStr),
      appPriceMarkupPct: parseMoneyInput(appPriceMarkupPctStr),
    });
    setProbePlPreview({
      netProfit: pl.netProfit,
      netSales: pl.netSales,
      commission: pl.commission,
      grossTotal: pl.grossTotal,
    });
  }, [
    appPriceMarkupPctStr,
    cogsLocalPctStr,
    commissionBase,
    commissionPctDec,
    fixedTotal,
    grossBank,
    grossCash,
    probeSalesGrossStr,
    reverseAppSharePctStr,
    salaryTotal,
    showToast,
    t,
    vatInclusive,
    vatRateDec,
  ]);

  const handleApplyProbeToFields = useCallback(() => {
    const G = parseMoneyInput(probeSalesGrossStr);
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
  }, [grossBank, grossCash, probeSalesGrossStr, reverseAppSharePctStr, showToast, t]);

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
      ['', withAppsScenarioLabel, t('reportCostAppsScenarioNoApps')],
      [appSalesRowLabel, fmt2(plWith.grossApp), fmt2(plWithout.grossApp)],
      [t('reportCostAppsPlLocalSales'), fmt2(plWith.grossLocal), fmt2(plWithout.grossLocal)],
      [t('reportCostAppsGrossTotal'), fmt2(plWith.grossTotal), fmt2(plWithout.grossTotal)],
      [t('reportCostAppsNetSales'), fmt2(plWith.netSales), fmt2(plWithout.netSales)],
      [t('reportCostAppsVatExtracted'), fmt2(plWith.vatAmount), fmt2(plWithout.vatAmount)],
      [t('reportCostAppsCommission'), fmt2(plWith.commission), fmt2(plWithout.commission)],
      [t('reportCostAppsCogsLocal'), fmt2(plWith.cogsLocal), fmt2(plWithout.cogsLocal)],
      [t('reportCostAppsCogsApp'), fmt2(plWith.cogsApp), fmt2(plWithout.cogsApp)],
      [t('reportCostAppsCogsTotal'), fmt2(plWith.cogsTotal), fmt2(plWithout.cogsTotal)],
      [
        t('reportCostAppsExpensesTotalRow'),
        fmt2(plWith.fixedTotal.plus(plWith.salaryTotal)),
        fmt2(plWithout.fixedTotal.plus(plWithout.salaryTotal)),
      ],
      [t('reportCostAppsNetProfit'), fmt2(plWith.netProfit), fmt2(plWithout.netProfit)],
    ];
    const body = `
      <table>
        <thead><tr><th>${t('reportItem')}</th><th>${withAppsScenarioLabel}</th><th>${t('reportCostAppsScenarioNoApps')}</th></tr></thead>
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
          <tr>
            <td class="border border-noorix-border px-2 py-2">${String(t('reportCostAppsPayrollLineLabel')).replace(/</g, '&lt;')}</td>
            <td style="text-align:right">${fmt(parseMoneyInput(salaryStr).toNumber(), 2)}</td>
            <td style="text-align:right">${fmt(parseMoneyInput(salaryStr).mul(12).toNumber(), 2)}</td>
          </tr>
          ${fixedLines
            .map((l) => {
              const m = parseMoneyInput(l.amount);
              const a = m.mul(12);
              return `<tr><td>${String(l.label || '—').replace(/</g, '&lt;')}</td><td style="text-align:right">${fmt(m.toNumber(), 2)}</td><td style="text-align:right">${fmt(a.toNumber(), 2)}</td></tr>`;
            })
            .join('')}
          <tr><td><strong>${t('reportTotalAmount')}</strong></td><td style="text-align:right"><strong>${fmt2(expensesMonthlyTotal)}</strong></td><td style="text-align:right"><strong>${fmt2(expensesAnnualTotal)}</strong></td></tr>
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
  }, [appSalesRowLabel, companyName, expensesAnnualTotal, expensesMonthlyTotal, fixedLines, plWith, plWithout, salaryStr, t, withAppsScenarioLabel]);

  const handleExportExcel = useCallback(async () => {
    const rows = [
      { item: appSalesRowLabel, withApps: plWith.grossApp.toNumber(), noApps: plWithout.grossApp.toNumber() },
      { item: t('reportCostAppsPlLocalSales'), withApps: plWith.grossLocal.toNumber(), noApps: plWithout.grossLocal.toNumber() },
      { item: t('reportCostAppsGrossTotal'), withApps: plWith.grossTotal.toNumber(), noApps: plWithout.grossTotal.toNumber() },
      { item: t('reportCostAppsNetSales'), withApps: plWith.netSales.toNumber(), noApps: plWithout.netSales.toNumber() },
      { item: t('reportCostAppsCommission'), withApps: plWith.commission.toNumber(), noApps: plWithout.commission.toNumber() },
      { item: t('reportCostAppsCogsLocal'), withApps: plWith.cogsLocal.toNumber(), noApps: plWithout.cogsLocal.toNumber() },
      { item: t('reportCostAppsCogsApp'), withApps: plWith.cogsApp.toNumber(), noApps: plWithout.cogsApp.toNumber() },
      { item: t('reportCostAppsCogsTotal'), withApps: plWith.cogsTotal.toNumber(), noApps: plWithout.cogsTotal.toNumber() },
      {
        item: t('reportCostAppsExpensesTotalRow'),
        withApps: plWith.fixedTotal.plus(plWith.salaryTotal).toNumber(),
        noApps: plWithout.fixedTotal.plus(plWithout.salaryTotal).toNumber(),
      },
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
        { key: 'withApps', label: withAppsScenarioLabel },
        { key: 'noApps', label: t('reportCostAppsScenarioNoApps') },
      ],
      money2ColumnKeys: ['withApps', 'noApps'],
    });
  }, [appSalesRowLabel, companyName, plWith, plWithout, t, withAppsScenarioLabel]);

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
    setProbeSalesGrossStr('');
    setProbePlPreview(null);
    setImporting(false);
    showToast(lang === 'ar' ? 'تم المسح.' : 'Cleared.', 'success');
  }, [activeCompanyId, lang, showToast]);

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
      probeSalesGrossStr,
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
    probeSalesGrossStr,
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

  return {
    activeCompanyId,
    t,
    lang,
    fileRef,
    companyName,
    grossAppStr,
    setGrossAppStr,
    grossCashStr,
    setGrossCashStr,
    grossBankStr,
    setGrossBankStr,
    vatInclusive,
    setVatInclusive,
    vatRatePctStr,
    setVatRatePctStr,
    commissionPctStr,
    setCommissionPctStr,
    commissionBase,
    setCommissionBase,
    fixedLines,
    setFixedLines,
    importFrom,
    setImportFrom,
    importTo,
    setImportTo,
    importing,
    importingExpenses,
    salaryStr,
    setSalaryStr,
    targetProfitStr,
    setTargetProfitStr,
    reverseGrossStr,
    appSharePctStr,
    setAppSharePctStr,
    cogsLocalPctStr,
    setCogsLocalPctStr,
    appPriceMarkupPctStr,
    setAppPriceMarkupPctStr,
    reverseAppSharePctStr,
    setReverseAppSharePctStr,
    probeSalesGrossStr,
    setProbeSalesGrossStr,
    probePlPreview,
    savedSlots,
    previewSlot,
    setPreviewSlot,
    withAppsScenarioLabel,
    fixedTotal,
    grossInputsSum,
    expensesMonthlyTotal,
    expensesAnnualTotal,
    plWith,
    plWithout,
    appSalesRowLabel,
    importMonthOptions,
    importMonthSelectValue,
    fmt2,
    handleImportSystem,
    handleImportExpensesFromSystem,
    handleCsvPick,
    handleReverse,
    handleProbeProfit,
    handleApplyProbeToFields,
    handleApplyReverse,
    handleApplyAppShare,
    handlePrint,
    handleExportExcel,
    clearDraft,
    handleSaveCalculatorSlot,
    handleImportSavedSlot,
    handleDeleteSavedSlot,
  };
}
