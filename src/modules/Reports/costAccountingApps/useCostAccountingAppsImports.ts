import { useCallback, useState, type ChangeEvent } from 'react';
import Decimal from 'decimal.js';
import {
  getDashboardSalesPack,
  getEmployeesMonthlySalaryContractTotal,
  getExpenseLines,
  throwIfApiFailed,
} from '../../../services/api';
import { fmt } from '../../../utils/format';
import { aggregateSalesChannelsInRange } from '../costAccountingAppsModel';
import { monthlyAmountFromExpenseLine } from '../costAccountingAppsFixedExpenseImport';
import {
  newLine,
  parseCsvForCostApps,
  type FixedLine,
} from './costAccountingAppsScreenUtils';

type TranslateFn = (key: string, vars?: Record<string, unknown>) => string;
type ToastFn = (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;

export function useCostAccountingAppsImports(params: {
  activeCompanyId: string | null | undefined;
  lang: string;
  importFrom: string;
  importTo: string;
  t: TranslateFn;
  showToast: ToastFn;
  setGrossAppStr: (value: string) => void;
  setGrossCashStr: (value: string) => void;
  setGrossBankStr: (value: string) => void;
  setFixedLines: (value: FixedLine[]) => void;
  setSalaryStr: (value: string) => void;
}) {
  const {
    activeCompanyId,
    lang,
    importFrom,
    importTo,
    t,
    showToast,
    setGrossAppStr,
    setGrossCashStr,
    setGrossBankStr,
    setFixedLines,
    setSalaryStr,
  } = params;
  const [importing, setImporting] = useState(false);
  const [importingExpenses, setImportingExpenses] = useState(false);

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
  }, [activeCompanyId, importFrom, importTo, setGrossAppStr, setGrossBankStr, setGrossCashStr, showToast, t]);

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
  }, [activeCompanyId, lang, setFixedLines, setSalaryStr, showToast, t]);

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
    [setGrossAppStr, setGrossBankStr, setGrossCashStr, showToast, t],
  );

  return {
    importing,
    importingExpenses,
    setImporting,
    setImportingExpenses,
    handleImportSystem,
    handleImportExpensesFromSystem,
    handleCsvPick,
  };
}
