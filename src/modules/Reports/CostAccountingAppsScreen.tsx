/**
 * حاسبة تكاليف / تطبيقات — معزولة عن دفتر الحسابات؛ استيراد مبيعات من الملخصات اليومية فقط.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Decimal from 'decimal.js';
import { useApp } from '../../context/AppContext';
import { useTranslation } from '../../i18n/useTranslation';
import { useToast } from '../../context/ToastContext';
import { getDashboardSalesPack, throwIfApiFailed } from '../../services/api';
import { fmt } from '../../utils/format';
import { TAX_RATE } from '../../utils/math-engine';
import { getSaudiYearMonth } from '../../utils/saudiDate';
import { openPrintWindow } from '../../utils/printUtils';
import { exportToExcel } from '../../utils/exportUtils';
import { Button, Input, cn } from '../../ui';
import {
  aggregateSalesChannelsInRange,
  computeCostAppsPl,
  reverseGrossTotalForTargetProfit,
  type CostAppsCommissionBase,
} from './costAccountingAppsModel';
import {
  buildCostAppsScenarioFile,
  parseCostAppsScenarioJson,
} from './costAccountingAppsScenario';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm font-medium text-noorix-text">{label}</span>
      {children}
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

  const sa = getSaudiYearMonth();
  const defaultFrom = ymdParts(sa.year, sa.month, 1);
  const defaultTo = ymdParts(sa.year, sa.month, lastDayOfMonth(sa.year, sa.month));

  const [grossAppStr, setGrossAppStr] = useState('');
  const [grossCashStr, setGrossCashStr] = useState('');
  const [grossBankStr, setGrossBankStr] = useState('');
  const [vatInclusive, setVatInclusive] = useState(true);
  const [vatRatePctStr, setVatRatePctStr] = useState(String(TAX_RATE * 100));
  const [commissionPctStr, setCommissionPctStr] = useState('25');
  const [commissionBase, setCommissionBase] = useState<CostAppsCommissionBase>('gross');
  const [fixedLines, setFixedLines] = useState<FixedLine[]>(() => [newLine()]);
  const [importFrom, setImportFrom] = useState(defaultFrom);
  const [importTo, setImportTo] = useState(defaultTo);
  const [importing, setImporting] = useState(false);
  const [targetProfitStr, setTargetProfitStr] = useState('20000');
  const [reverseGrossStr, setReverseGrossStr] = useState('');
  const [appSharePctStr, setAppSharePctStr] = useState('');
  const [cogsLocalPctStr, setCogsLocalPctStr] = useState('0');
  const [appPriceMarkupPctStr, setAppPriceMarkupPctStr] = useState('0');
  /** حصة التطبيقات من إجمالي المبيعات في الحساب العكسي (%) */
  const [reverseAppSharePctStr, setReverseAppSharePctStr] = useState('30');

  const vatRateDec = useMemo(() => {
    const p = parseMoneyInput(vatRatePctStr);
    return p.div(100);
  }, [vatRatePctStr]);

  const commissionPctDec = useMemo(() => parseMoneyInput(commissionPctStr), [commissionPctStr]);

  const fixedTotal = useMemo(() => {
    return fixedLines.reduce((acc, line) => acc.plus(parseMoneyInput(line.amount)), new Decimal(0));
  }, [fixedLines]);

  const grossApp = useMemo(() => parseMoneyInput(grossAppStr), [grossAppStr]);
  const grossCash = useMemo(() => parseMoneyInput(grossCashStr), [grossCashStr]);
  const grossBank = useMemo(() => parseMoneyInput(grossBankStr), [grossBankStr]);

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
      cogsLocalPctStr,
      appPriceMarkupPctStr,
    ],
  );

  const plWith = useMemo(() => computeCostAppsPl({ ...baseParams, includeAppChannel: true }), [baseParams]);
  const plWithout = useMemo(() => computeCostAppsPl({ ...baseParams, includeAppChannel: false }), [baseParams]);

  useEffect(() => {
    if (!activeCompanyId) return;
    try {
      const raw = localStorage.getItem(draftKey(activeCompanyId));
      if (!raw) return;
      const o = JSON.parse(raw);
      if (o.grossAppStr != null) setGrossAppStr(String(o.grossAppStr));
      if (o.grossCashStr != null) setGrossCashStr(String(o.grossCashStr));
      if (o.grossBankStr != null) setGrossBankStr(String(o.grossBankStr));
      if (typeof o.vatInclusive === 'boolean') setVatInclusive(o.vatInclusive);
      if (o.vatRatePctStr != null) setVatRatePctStr(String(o.vatRatePctStr));
      if (o.commissionPctStr != null) setCommissionPctStr(String(o.commissionPctStr));
      if (o.commissionBase === 'gross' || o.commissionBase === 'net') setCommissionBase(o.commissionBase);
      if (Array.isArray(o.fixedLines) && o.fixedLines.length) setFixedLines(o.fixedLines);
      if (o.importFrom) setImportFrom(String(o.importFrom));
      if (o.importTo) setImportTo(String(o.importTo));
      if (o.cogsLocalPctStr != null) setCogsLocalPctStr(String(o.cogsLocalPctStr));
      if (o.appPriceMarkupPctStr != null) setAppPriceMarkupPctStr(String(o.appPriceMarkupPctStr));
      if (o.reverseAppSharePctStr != null) setReverseAppSharePctStr(String(o.reverseAppSharePctStr));
    } catch {
      /* ignore */
    }
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
      importFrom,
      importTo,
      cogsLocalPctStr,
      appPriceMarkupPctStr,
      reverseAppSharePctStr,
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
    importFrom,
    importTo,
    cogsLocalPctStr,
    appPriceMarkupPctStr,
    reverseAppSharePctStr,
  ]);

  const fmt2 = (d: Decimal) => fmt(d.toNumber(), 2);

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
        <tbody>
          ${fixedLines
            .map(
              (l) =>
                `<tr><td>${String(l.label || '—').replace(/</g, '&lt;')}</td><td style="text-align:right">${fmt(parseMoneyInput(l.amount).toNumber(), 2)}</td></tr>`,
            )
            .join('')}
          <tr><td><strong>${t('reportAnnualTotal')}</strong></td><td style="text-align:right"><strong>${fmt2(fixedTotal)}</strong></td></tr>
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
    setGrossAppStr('');
    setGrossCashStr('');
    setGrossBankStr('');
    setCogsLocalPctStr('0');
    setAppPriceMarkupPctStr('0');
    setReverseAppSharePctStr('30');
    setFixedLines([newLine()]);
    setReverseGrossStr('');
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
    showToast,
    t,
    targetProfitStr,
    vatInclusive,
    vatRatePctStr,
  ]);

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
        if (restore.grossAppStr !== undefined) setGrossAppStr(restore.grossAppStr);
        if (restore.grossCashStr !== undefined) setGrossCashStr(restore.grossCashStr);
        if (restore.grossBankStr !== undefined) setGrossBankStr(restore.grossBankStr);
        if (restore.vatInclusive !== undefined) setVatInclusive(restore.vatInclusive);
        if (restore.vatRatePctStr !== undefined) setVatRatePctStr(restore.vatRatePctStr);
        if (restore.commissionPctStr !== undefined) setCommissionPctStr(restore.commissionPctStr);
        if (restore.commissionBase !== undefined) setCommissionBase(restore.commissionBase);
        if (restore.fixedLines !== undefined) setFixedLines(restore.fixedLines);
        if (restore.importFrom !== undefined) setImportFrom(restore.importFrom);
        if (restore.importTo !== undefined) setImportTo(restore.importTo);
        if (restore.targetProfitStr !== undefined) setTargetProfitStr(restore.targetProfitStr);
        if (restore.reverseGrossStr !== undefined) setReverseGrossStr(restore.reverseGrossStr);
        if (restore.appSharePctStr !== undefined) setAppSharePctStr(restore.appSharePctStr);
        if (restore.reverseAppSharePctStr !== undefined) setReverseAppSharePctStr(restore.reverseAppSharePctStr);
        if (restore.cogsLocalPctStr !== undefined) setCogsLocalPctStr(restore.cogsLocalPctStr);
        if (restore.appPriceMarkupPctStr !== undefined) setAppPriceMarkupPctStr(restore.appPriceMarkupPctStr);
        showToast(t('reportCostAppsScenarioImportOk'), 'success');
      } catch (err: any) {
        showToast(err?.message || String(err), 'error');
      }
    },
    [showToast, t],
  );

  if (!activeCompanyId) {
    return (
      <div className="rounded-lg border border-noorix-border bg-[var(--noorix-surface-1)] p-8 text-center text-noorix-muted">
        {t('pleaseSelectCompany')}
      </div>
    );
  }

  return (
    <div className="cost-apps-calc flex flex-col gap-6 print:gap-2">
      <div className="flex flex-col gap-1 print:hidden">
        <h2 className="m-0 text-lg font-bold text-noorix-text">{t('reportCostAppsTitle')}</h2>
        <p className="m-0 text-sm text-noorix-muted">{t('reportCostAppsDesc')}</p>
        <p className="m-0 text-xs text-noorix-muted">{t('reportCostAppsSavedLocal')}</p>
        <p className="m-0 text-xs text-noorix-muted">{t('reportCostAppsScenarioHint')}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 print:grid-cols-1 print:gap-2">
        <div className="rounded-lg border border-noorix-border p-4 print:border print:p-2">
          <h3 className="mt-0 mb-3 text-sm font-bold text-noorix-text print:text-xs print:mb-1">{t('reportCostAppsSalesSection')}</h3>
          <div className="flex flex-col gap-3">
            <Field label={t('reportCostAppsGrossApp')}>
              <Input value={grossAppStr} onChange={(e: any) => setGrossAppStr(e.target.value)} inputMode="decimal" dir="ltr" className="text-right" />
            </Field>
            <Field label={t('reportCostAppsGrossCash')}>
              <Input value={grossCashStr} onChange={(e: any) => setGrossCashStr(e.target.value)} inputMode="decimal" dir="ltr" className="text-right" />
            </Field>
            <Field label={t('reportCostAppsGrossBank')}>
              <Input value={grossBankStr} onChange={(e: any) => setGrossBankStr(e.target.value)} inputMode="decimal" dir="ltr" className="text-right" />
            </Field>
          </div>

          <div className="mt-4 space-y-2 rounded-md bg-[var(--noorix-surface-2)] p-3 print:hidden">
            <div className="text-xs font-semibold text-noorix-text">{t('reportCostAppsImportRange')}</div>
            <div className="flex flex-wrap items-end gap-3">
              <Field label={t('reportDateFrom')}>
                <Input type="date" value={importFrom} onChange={(e: any) => setImportFrom(e.target.value)} dir="ltr" className="min-w-[140px]" />
              </Field>
              <Field label={t('reportDateTo')}>
                <Input type="date" value={importTo} onChange={(e: any) => setImportTo(e.target.value)} dir="ltr" className="min-w-[140px]" />
              </Field>
              <Button type="button" variant="secondary" disabled={importing} onClick={handleImportSystem}>
                {importing ? t('loading') : t('reportCostAppsImportBtn')}
              </Button>
              <Button type="button" variant="ghost" onClick={() => fileRef.current?.click()}>
                {t('reportCostAppsCsvImport')}
              </Button>
              <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleCsvPick} />
            </div>
            <p className="m-0 text-[11px] text-noorix-muted">{t('reportCostAppsImportHint')}</p>
            <p className="m-0 text-[11px] text-noorix-muted">{t('reportCostAppsCsvHint')}</p>
          </div>
        </div>

        <div className="rounded-lg border border-noorix-border p-4 print:border print:p-2">
          <h3 className="mt-0 mb-3 text-sm font-bold print:text-xs print:mb-1">{t('reportCostAppsTaxCommissionTitle')}</h3>
          <div className="flex flex-col gap-3">
            <label className="flex cursor-pointer items-center gap-2 text-sm print:text-xs">
              <input type="checkbox" checked={vatInclusive} onChange={(e) => setVatInclusive(e.target.checked)} />
              {t('reportCostAppsVatInclusive')}
            </label>
            <Field label={t('reportCostAppsVatRate')}>
              <Input value={vatRatePctStr} onChange={(e: any) => setVatRatePctStr(e.target.value)} inputMode="decimal" dir="ltr" className="text-right max-w-[120px]" />
            </Field>
            <Field label={t('reportCostAppsCommissionPct')}>
              <Input value={commissionPctStr} onChange={(e: any) => setCommissionPctStr(e.target.value)} inputMode="decimal" dir="ltr" className="text-right max-w-[120px]" />
            </Field>
            <Field label={t('reportCostAppsCommissionBase')}>
              <select
                className={cn(
                  'w-full max-w-[280px] rounded-md border border-noorix-border bg-[var(--noorix-surface-1)] px-3 py-2 text-sm',
                )}
                value={commissionBase}
                onChange={(e) => setCommissionBase(e.target.value as CostAppsCommissionBase)}
              >
                <option value="gross">{t('reportCostAppsCommissionOnGross')}</option>
                <option value="net">{t('reportCostAppsCommissionOnNet')}</option>
              </select>
            </Field>
          </div>

          <div className="mt-4 border-t border-noorix-border pt-4 print:hidden">
            <h4 className="mt-0 mb-2 text-xs font-bold uppercase tracking-wide text-noorix-muted">{t('reportCostAppsReverseTitle')}</h4>
            <div className="flex flex-wrap items-end gap-3">
              <Field label={t('reportCostAppsTargetProfit')}>
                <Input value={targetProfitStr} onChange={(e: any) => setTargetProfitStr(e.target.value)} inputMode="decimal" dir="ltr" className="text-right w-[140px]" />
              </Field>
              <Field label={t('reportCostAppsReverseAppShare')}>
                <Input
                  value={reverseAppSharePctStr}
                  onChange={(e: any) => setReverseAppSharePctStr(e.target.value)}
                  inputMode="decimal"
                  dir="ltr"
                  className="text-right w-[80px]"
                />
              </Field>
              <Button type="button" variant="secondary" onClick={handleReverse}>
                {t('reportCostAppsReverseCalc')}
              </Button>
            </div>
            {reverseGrossStr ? (
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                <span className="text-noorix-muted">{t('reportCostAppsGrossTotal')}:</span>
                <strong dir="ltr">{fmt(parseMoneyInput(reverseGrossStr).toNumber(), 2)}</strong>
                <Button type="button" variant="primary" onClick={handleApplyReverse}>
                  {t('reportCostAppsReverseApply')}
                </Button>
              </div>
            ) : null}
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <Field label={t('reportCostAppsAppShare')}>
                <Input
                  value={appSharePctStr}
                  onChange={(e: any) => setAppSharePctStr(e.target.value)}
                  placeholder={plWith.grossTotal.gt(0) ? fmt(plWith.appShareOfGrossPct.toNumber(), 2) : ''}
                  inputMode="decimal"
                  dir="ltr"
                  className="text-right w-[100px]"
                />
              </Field>
              <Button type="button" variant="secondary" onClick={handleApplyAppShare}>
                {t('reportCostAppsApplyShare')}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-noorix-border p-4 print:border print:p-2">
        <h3 className="mt-0 mb-2 text-sm font-bold print:text-xs">{t('reportCostAppsCogsSection')}</h3>
        <p className="mb-3 text-[11px] leading-relaxed text-noorix-muted print:text-[10px]">{t('reportCostAppsCogsHint')}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t('reportCostAppsCogsLocalPct')}>
            <Input value={cogsLocalPctStr} onChange={(e: any) => setCogsLocalPctStr(e.target.value)} inputMode="decimal" dir="ltr" className="text-right max-w-[120px]" />
          </Field>
          <Field label={t('reportCostAppsAppMarkupPct')}>
            <Input value={appPriceMarkupPctStr} onChange={(e: any) => setAppPriceMarkupPctStr(e.target.value)} inputMode="decimal" dir="ltr" className="text-right max-w-[120px]" />
          </Field>
        </div>
      </div>

      <div className="rounded-lg border border-noorix-border p-4 print:p-2">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 print:hidden">
          <h3 className="m-0 text-sm font-bold">{t('reportCostAppsFixedLines')}</h3>
          <Button type="button" variant="ghost" onClick={() => setFixedLines((prev) => [...prev, newLine()])}>
            {t('reportCostAppsAddLine')}
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-noorix-border text-sm print:text-[11px]">
            <thead>
              <tr className="bg-[var(--noorix-table-header-bg)]">
                <th className="border border-noorix-border px-2 py-2 text-start font-bold print:px-1 print:py-1">{t('reportCostAppsLineLabel')}</th>
                <th className="border border-noorix-border px-2 py-2 text-end font-bold print:px-1 print:py-1" style={{ width: '140px' }}>
                  {t('reportCostAppsLineAmount')}
                </th>
                <th className="noorix-print-hidden border border-noorix-border px-2 py-2 w-16 print:hidden" />
              </tr>
            </thead>
            <tbody>
              {fixedLines.map((line) => (
                <tr key={line.id}>
                  <td className="border border-noorix-border p-1">
                    <Input value={line.label} onChange={(e: any) => setFixedLines((rows) => rows.map((r) => (r.id === line.id ? { ...r, label: e.target.value } : r)))} className="border-0" />
                  </td>
                  <td className="border border-noorix-border p-1">
                    <Input value={line.amount} onChange={(e: any) => setFixedLines((rows) => rows.map((r) => (r.id === line.id ? { ...r, amount: e.target.value } : r)))} dir="ltr" className="text-end border-0" inputMode="decimal" />
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
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td className="border border-noorix-border px-2 py-2 font-bold">{t('reportAnnualTotal')}</td>
                <td className="border border-noorix-border px-2 py-2 text-end font-bold" dir="ltr">
                  {fmt2(fixedTotal)}
                </td>
                <td className="noorix-print-hidden print:hidden" />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div className="rounded-lg border border-noorix-border p-4 print:p-2">
        <h3 className="mt-0 mb-3 text-sm font-bold print:text-xs">{t('reportCostAppsNetProfit')}</h3>
        <div className="overflow-x-auto">
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
      </div>

      <div className="flex flex-wrap gap-2 print:hidden">
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

      <style>{`
        @media print {
          .noorix-print-hidden { display: none !important; }
          .cost-apps-calc { break-inside: avoid; }
        }
      `}</style>
    </div>
  );
}
