import { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { useApp } from '../../context/AppContext';
import { useTranslation } from '../../i18n/useTranslation';
import { useUpsertVatPlanning, useVatPlanningList, useVatPlanningRegistry } from '../../hooks/useVatPlanning';
import {
  OUTPUT_ROWS,
  INPUT_ROWS,
  defaultDisclosureData,
  mergeImportedDisclosure,
  normalizeDisclosureDecimals,
  roundMoney2,
  computeNetPayable,
  computeOutputTotal,
  computeInputTotal,
  getRowValue,
  scaleInputVatForPaymentTarget,
  syncVatPlanningSummaryFields,
  SUMMARY_ROWS,
} from '../../constants/taxDisclosure';
import { fmt, fmtTax } from '../../utils/format';
import { vatRateDecimalFromCompany } from '../../utils/vatRate';
import { exportToExcel } from '../../utils/exportUtils';
import { openPrintWindow } from '../../utils/printUtils';
import { getTaxVatReport, getVatPlanningList, getCompanies, throwIfApiFailed, upsertVatPlanning } from '../../services/api';
import { vatKeys, appKeys } from '../../services/queryKeys';
import {
  isHajriDeclarationSubmitted,
  registryInputVat,
  registryOutputVat,
  registryPayload,
  registryPurchasesAmount,
  registrySalesAmount,
} from './hajriRegistryMetrics';
import { clonePayload, formatLoadedPaymentTarget, fmtDisclosurePrintCell } from './hajriTaxScreenHelpers';

export function useHajriTaxScreen() {
  const { companies } = useApp();
  const { t, lang } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const qc = useQueryClient();
  const jsonInputRef = useRef<any>(null);
  const urlOpenKeyRef = useRef('');

  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(() => {
    const y = Number(searchParams.get('year'));
    return Number.isFinite(y) && y >= 2000 ? y : currentYear;
  });
  const [quarter, setQuarter] = useState(() => {
    const q = Number(searchParams.get('quarter'));
    return [1, 2, 3, 4].includes(q) ? q : 1;
  });
  const [regFilterCompany, setRegFilterCompany] = useState(() => searchParams.get('company') || '');
  const [regFilterYear, setRegFilterYear] = useState('');
  const [regFilterQuarter, setRegFilterQuarter] = useState('');
  const [detailCompanyId, setDetailCompanyId] = useState<any>(null);
  const detailVatRateDecimal = useMemo(
    () => vatRateDecimalFromCompany(companies?.find((c: any) => c.id === detailCompanyId)),
    [companies, detailCompanyId],
  );
  const [detailReadOnly, setDetailReadOnly] = useState(false);
  const [showNewDeclarationModal, setShowNewDeclarationModal] = useState(false);
  const [showBulkImportModal, setShowBulkImportModal] = useState(false);
  /** تحرير حر في خلايا الجدول — النص يُطبَّق على المسودة عند blur فقط */
  const [cellEdit, setCellEdit] = useState<any>(null);

  const [draftData, setDraftData] = useState(() => defaultDisclosureData());
  const [paymentTargetStr, setPaymentTargetStr] = useState('');
  const [notes, setNotes] = useState('');
  const [sourceSnapshot, setSourceSnapshot] = useState<any>(null);
  const [importIso, setImportIso] = useState<any>(null);
  const [detailFilingSubmitted, setDetailFilingSubmitted] = useState(false);
  const [filingBusyRowId, setFilingBusyRowId] = useState<string | null>(null);
  const [saveHint, setSaveHint] = useState('');
  const [showSimulator, setShowSimulator] = useState(true);
  const [importingReport, setImportingReport] = useState(false);
  /** استيراد مبيعات بدون ضريبة مسجّلة: إذا كان صافي الفاتورة إجماليًا شاملاً 15% وليس أساسًا خاضعًا */
  const [salesAmountIncludesVat, setSalesAmountIncludesVat] = useState(false);

  const registryQueryFilters = useMemo(() => {
    const y = regFilterYear === '' ? undefined : Number(regFilterYear);
    const q = regFilterQuarter === '' ? undefined : Number(regFilterQuarter);
    return {
      year: y !== undefined && Number.isFinite(y) && y >= 2000 && y <= 2100 ? y : undefined,
      quarter: q !== undefined && Number.isFinite(q) && q >= 1 && q <= 4 ? q : undefined,
      companyId: regFilterCompany || undefined,
    };
  }, [regFilterYear, regFilterQuarter, regFilterCompany]);

  const { data: registryRows = [], isLoading: registryLoading, refetch: refetchRegistry } = useVatPlanningRegistry(
    registryQueryFilters,
    !detailCompanyId,
  );

  /** سجل بدون فلتر — لخيارات الشركة/السنة في القائمة فقط (لا نعتمد على الصفوف المصفّاة وإلا تختفي شركات من الفلتر) */
  const registryUnfilteredFilters = useMemo(() => ({}), []);
  const { data: registryAllRows = [] } = useVatPlanningRegistry(registryUnfilteredFilters, !detailCompanyId);

  /** شركات نشطة فقط — للفلتر؛ الإقرارات المؤرشفة لا تُدرَج كخيار شركة */
  const { data: companiesActiveForFilter = [] } = useQuery({
    queryKey: appKeys.companies(false),
    queryFn: async () => {
      try {
        const r = await getCompanies(false);
        return r?.success && Array.isArray(r.data) ? r.data : [];
      } catch {
        return [];
      }
    },
    staleTime: 60_000,
  });

  /** قائمة الشركات للفلتر: نشطة من API ثم إضافة من السجل فقط إن لم تكن مؤرشفة */
  const registryFilterCompanies = useMemo(() => {
    const map = new Map<
      string,
      {
        id: string;
        nameAr?: string;
        nameEn?: string | null;
        taxNumber?: string | null;
      }
    >();

    const seed =
      Array.isArray(companiesActiveForFilter) && companiesActiveForFilter.length > 0
        ? companiesActiveForFilter
        : companies || [];
    seed.forEach((c: any) => {
      if (c?.id && !c.isArchived)
        map.set(c.id, {
          id: c.id,
          nameAr: c.nameAr,
          nameEn: c.nameEn ?? null,
          taxNumber: c.taxNumber ?? null,
        });
    });

    (registryAllRows || []).forEach((r: any) => {
      const c = r?.company;
      if (!c?.id || c.isArchived === true) return;
      const prev = map.get(c.id);
      const tn = c.taxNumber ?? null;
      if (!prev) {
        map.set(c.id, {
          id: c.id,
          nameAr: c.nameAr,
          nameEn: c.nameEn ?? null,
          taxNumber: tn,
        });
      } else if (!prev.taxNumber && tn) {
        map.set(c.id, { ...prev, taxNumber: tn });
      }
    });

    const collator = lang === 'ar' ? 'ar' : 'en';
    return Array.from(map.values()).sort((a, b) =>
      (a.nameAr || a.nameEn || '').localeCompare(b.nameAr || b.nameEn || '', collator),
    );
  }, [companiesActiveForFilter, companies, registryAllRows, lang]);

  /** سنوات الفلتر: السنوات الافتراضية + أي سنة موجودة في السجل الكامل */
  const registryFilterYearOptions = useMemo(() => {
    const base = [currentYear, currentYear - 1, currentYear - 2, currentYear - 3, currentYear - 4];
    const years = new Set(base);
    (registryAllRows || []).forEach((r: any) => {
      if (Number.isFinite(r.year) && r.year >= 2000) years.add(r.year);
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [currentYear, registryAllRows]);

  const periodStr = `Q${quarter}`;
  const periodLabel = `${year}-${periodStr}`;

  /** جلب إقرارات الربع المحدد — للربط مع `resolveRecord` وروابط ?edit=1 من دون فتح التفاصيل أولًا */
  const { data: apiRecords = [], isLoading: listLoading, refetch } = useVatPlanningList(
    year,
    quarter,
    undefined,
    true,
  );

  const upsertMutation = useUpsertVatPlanning();

  const buildUpsertFromRegistryRow = useCallback((row: any, overrides: Record<string, unknown> = {}) => {
    const payload = normalizeDisclosureDecimals(
      syncVatPlanningSummaryFields(mergeImportedDisclosure(defaultDisclosureData(), registryPayload(row))),
    );
    const pt = row.paymentTarget != null ? parseFloat(String(row.paymentTarget)) : NaN;
    return {
      companyId: row.companyId,
      year: row.year,
      quarter: row.quarter,
      payload,
      sourceSnapshot: row.sourceSnapshot ?? undefined,
      paymentTarget: Number.isFinite(pt) ? pt : null,
      notes: row.notes ?? null,
      importedAt: row.importedAt ?? undefined,
      ...overrides,
    };
  }, []);

  const handleRegistryFilingChange = useCallback(
    async (row: any, next: boolean) => {
      setFilingBusyRowId(row.id);
      try {
        await upsertMutation.mutateAsync(buildUpsertFromRegistryRow(row, { filingSubmitted: next }));
      } finally {
        setFilingBusyRowId(null);
      }
    },
    [buildUpsertFromRegistryRow, upsertMutation],
  );

  const recordByCompany = useMemo(() => {
    const m = new Map();
    (apiRecords || []).forEach((r: any) => m.set(r.companyId, r));
    return m;
  }, [apiRecords]);

  const resolveRecord = useCallback(
    (companyId: any) => recordByCompany.get(companyId),
    [recordByCompany],
  );

  const openCompanyDetail = useCallback(
    async (companyId: any, forcedPeriod: any) => {
      let rec = null;
      if (
        forcedPeriod &&
        Number.isFinite(forcedPeriod.year) &&
        forcedPeriod.year >= 2000 &&
        Number.isFinite(forcedPeriod.quarter) &&
        [1, 2, 3, 4].includes(forcedPeriod.quarter)
      ) {
        setYear(forcedPeriod.year);
        setQuarter(forcedPeriod.quarter);
        const res = await getVatPlanningList(forcedPeriod.year, forcedPeriod.quarter, companyId);
        throwIfApiFailed(res, 'فشل تحميل السجل');
        const arr = Array.isArray(res.data) ? res.data : [];
        rec = arr[0] || null;
      } else {
        rec = resolveRecord(companyId);
      }
      const payload = rec?.payload && typeof rec.payload === 'object' ? rec.payload : {};
      setDraftData(clonePayload(payload));
      setPaymentTargetStr(formatLoadedPaymentTarget(rec?.paymentTarget));
      setNotes(rec?.notes || '');
      setSourceSnapshot(rec?.sourceSnapshot ?? null);
      setImportIso(rec?.importedAt || null);
      setDetailFilingSubmitted(rec ? isHajriDeclarationSubmitted(rec) : false);
      setDetailCompanyId(companyId);
      setDetailReadOnly(false);
      setSaveHint('');
    },
    [resolveRecord],
  );

  const openFromRegistryRow = useCallback((row: any, mode: any) => {
    setYear(row.year);
    setQuarter(row.quarter);
    setRegFilterCompany(row.companyId);
    setDetailReadOnly(mode === 'view');
    const payload = row.payload && typeof row.payload === 'object' ? row.payload : {};
    setDraftData(clonePayload(payload));
    setPaymentTargetStr(formatLoadedPaymentTarget(row.paymentTarget));
    setNotes(row.notes || '');
    setSourceSnapshot(row.sourceSnapshot ?? null);
    setImportIso(row.importedAt || null);
    setDetailFilingSubmitted(isHajriDeclarationSubmitted(row));
    setDetailCompanyId(row.companyId);
    setSaveHint('');
  }, []);

  const handleNewDeclarationConfirm = useCallback(
    async ({ companyId, year: y, quarter: q }: any) => {
      setYear(y);
      setQuarter(q);
      setRegFilterCompany(companyId);
      setDetailReadOnly(false);
      const res = await getVatPlanningList(y, q, companyId);
      throwIfApiFailed(res, 'فشل تحميل السجل');
      const rec = Array.isArray(res.data) && res.data[0] ? res.data[0] : null;
      if (rec) {
        setDraftData(clonePayload(rec.payload));
        setPaymentTargetStr(formatLoadedPaymentTarget(rec.paymentTarget));
        setNotes(rec.notes || '');
        setSourceSnapshot(rec.sourceSnapshot ?? null);
        setImportIso(rec.importedAt || null);
        setDetailFilingSubmitted(isHajriDeclarationSubmitted(rec));
      } else {
        setDraftData(defaultDisclosureData());
        setPaymentTargetStr('');
        setNotes('');
        setSourceSnapshot(null);
        setImportIso(null);
        setDetailFilingSubmitted(false);
      }
      setDetailCompanyId(companyId);
      setSaveHint('');
    },
    [],
  );

  const closeDetail = useCallback(() => {
    setDetailCompanyId(null);
    setDetailReadOnly(false);
    setDetailFilingSubmitted(false);
    refetch();
    refetchRegistry();
    setSearchParams((sp: any) => {
      const next = new URLSearchParams(sp);
      next.delete('edit');
      return next;
    });
  }, [refetch, refetchRegistry, setSearchParams]);

  useEffect(() => {
    if (listLoading) return;
    if (searchParams.get('edit') !== '1') {
      urlOpenKeyRef.current = '';
      return;
    }
    const c = searchParams.get('company');
    if (!c || !companies?.some((x: any) => x.id === c)) return;
    const key = `${c}|${searchParams.get('year')}|${searchParams.get('quarter')}|1`;
    if (urlOpenKeyRef.current === key) return;
    urlOpenKeyRef.current = key;
    const yNum = Number(searchParams.get('year'));
    const qNum = Number(searchParams.get('quarter'));
    const forcedPeriod =
      Number.isFinite(yNum) && yNum >= 2000 && [1, 2, 3, 4].includes(qNum)
        ? { year: yNum, quarter: qNum }
        : undefined;
    void openCompanyDetail(c, forcedPeriod);
  }, [listLoading, searchParams, companies, openCompanyDetail]);

  useEffect(() => {
    setCellEdit(null);
  }, [detailCompanyId, year, quarter, detailReadOnly]);

  const updateRow = useCallback((key: any, field: any, value: any) => {
    if (detailReadOnly) return;
    const raw = String(value).replace(/,/g, '').trim();
    const parsed = raw === '' ? 0 : parseFloat(raw);
    const num = roundMoney2(Number.isFinite(parsed) ? parsed : 0);
    setDraftData((prev: any) => {
      const next = { ...prev };
      const isSummaryField = !field || SUMMARY_ROWS.some((r: any) => r.key === key);
      if (isSummaryField) next[key] = num;
      else {
        const row = { ...(next[key] || { amount: 0, adjustment: 0, vat: 0 }), [field]: num };
        next[key] = row;
        if (field === 'amount' && (key === 'standard_sales' || key === 'standard_purchases')) {
          next[key] = { ...row, vat: roundMoney2(num * detailVatRateDecimal) };
        }
      }
      return next;
    });
  }, [detailReadOnly, detailVatRateDecimal]);

  const outputTotal = useMemo(() => computeOutputTotal(draftData), [draftData]);
  const inputTotal = useMemo(() => computeInputTotal(draftData), [draftData]);
  const netPayableDraft = useMemo(() => computeNetPayable(draftData), [draftData]);
  const priorAdj = getRowValue(draftData, 'prior_adjustments', 'amount');
  const balanceCarried = getRowValue(draftData, 'balance_carried', 'amount');
  const netVat = outputTotal - inputTotal;

  const paymentTargetParsed = useMemo(() => {
    const p = parseFloat(String(paymentTargetStr).replace(/,/g, ''));
    return Number.isFinite(p) ? p : NaN;
  }, [paymentTargetStr]);

  /** ضريبة المدخلات النظرية المطلوبة إذا كان صافي السداد = المبلغ المستهدف (بافتراض ثابت التعديلات) */
  const simulatorRequiredInputVat = useMemo(() => {
    if (!Number.isFinite(paymentTargetParsed)) return null;
    return outputTotal + priorAdj + balanceCarried - paymentTargetParsed;
  }, [outputTotal, priorAdj, balanceCarried, paymentTargetParsed]);

  const simulatorEstimatedBaseAtStandardRate = useMemo(() => {
    if (simulatorRequiredInputVat == null || simulatorRequiredInputVat <= 0) return null;
    if (detailVatRateDecimal <= 0) return null;
    return +(simulatorRequiredInputVat / detailVatRateDecimal).toFixed(2);
  }, [simulatorRequiredInputVat, detailVatRateDecimal]);

  const simulatorInvalidTarget = useMemo(() => {
    if (!Number.isFinite(paymentTargetParsed)) return false;
    if (simulatorRequiredInputVat == null) return false;
    return simulatorRequiredInputVat < 0;
  }, [paymentTargetParsed, simulatorRequiredInputVat]);

  const handleImportFromTaxReport = useCallback(async () => {
    if (!detailCompanyId || detailReadOnly) return;
    setImportingReport(true);
    try {
      const res = await getTaxVatReport(detailCompanyId, year, periodStr, {
        salesAmountIncludesVat,
      });
      throwIfApiFailed(res, 'فشل استيراد تقرير الضريبة');
      const imported = res.data;
      setDraftData((prev: any) =>
        normalizeDisclosureDecimals(syncVatPlanningSummaryFields(mergeImportedDisclosure(prev, imported))),
      );
      setSourceSnapshot(imported && typeof imported === 'object' ? { ...imported } : imported);
      setImportIso(new Date().toISOString());
    } finally {
      setImportingReport(false);
    }
  }, [detailCompanyId, detailReadOnly, year, periodStr, salesAmountIncludesVat]);

  const handleBalancePayment = useCallback(() => {
    if (detailReadOnly) return;
    const target = parseFloat(String(paymentTargetStr).replace(/,/g, ''));
    if (!Number.isFinite(target)) return;
    setDraftData((prev: any) =>
      normalizeDisclosureDecimals(syncVatPlanningSummaryFields(
        scaleInputVatForPaymentTarget(prev, target, detailVatRateDecimal),
      )),
    );
  }, [paymentTargetStr, detailReadOnly, detailVatRateDecimal]);

  const persistDetailFilingSubmitted = useCallback(
    async (next: boolean) => {
      if (!detailCompanyId) return;
      const pt = parseFloat(String(paymentTargetStr).replace(/,/g, ''));
      await upsertMutation.mutateAsync({
        companyId: detailCompanyId,
        year,
        quarter,
        payload: normalizeDisclosureDecimals(syncVatPlanningSummaryFields(draftData)),
        sourceSnapshot: sourceSnapshot ?? undefined,
        paymentTarget: Number.isFinite(pt) && Math.abs(pt) > 1e-9 ? pt : null,
        notes: notes.trim() || null,
        importedAt: importIso || undefined,
        filingSubmitted: next,
      });
      setDetailFilingSubmitted(next);
      setSaveHint(next ? t('hajriTaxFilingApprovedOk') : t('hajriTaxFilingReopenedOk'));
    },
    [
      detailCompanyId,
      year,
      quarter,
      draftData,
      sourceSnapshot,
      paymentTargetStr,
      notes,
      importIso,
      upsertMutation,
      t,
    ],
  );

  const handleSaveDetail = useCallback(async () => {
    if (!detailCompanyId || detailReadOnly) return;
    const pt = parseFloat(String(paymentTargetStr).replace(/,/g, ''));
    const body = {
      companyId: detailCompanyId,
      year,
      quarter,
      payload: normalizeDisclosureDecimals(syncVatPlanningSummaryFields(draftData)),
      sourceSnapshot: sourceSnapshot ?? undefined,
      paymentTarget: Number.isFinite(pt) && Math.abs(pt) > 1e-9 ? pt : null,
      notes: notes.trim() || null,
      importedAt: importIso || undefined,
      filingSubmitted: detailFilingSubmitted,
    };
    await upsertMutation.mutateAsync(body);
    setSaveHint(t('vatSavedOk'));
  }, [
    detailCompanyId,
    detailReadOnly,
    year,
    quarter,
    draftData,
    sourceSnapshot,
    paymentTargetStr,
    notes,
    importIso,
    detailFilingSubmitted,
    upsertMutation,
    t,
  ]);

  const companyMeta = useCallback(
    (id: any) => {
      const c = companies?.find((x: any) => x.id === id);
      if (!c) return { name: id, tax: '' };
      const name = lang === 'en' ? (c.nameEn || c.nameAr || '') : (c.nameAr || c.nameEn || '');
      return { name, tax: c.taxNumber || '' };
    },
    [companies, lang],
  );

  const printDetail = useCallback(() => {
    const { name } = companyMeta(detailCompanyId);
    const label = (r: any) => (lang === 'ar' ? r.labelAr : r.labelEn);
    const outRows = OUTPUT_ROWS.map((r: any) => {
      const amt = r.isTotal ? outputTotal : getRowValue(draftData, r.key, 'amount');
      const vat = r.isTotal ? outputTotal : getRowValue(draftData, r.key, 'vat');
      return `<tr><td>${(label(r) || '').replace(/</g, '&lt;')}</td><td>${fmtDisclosurePrintCell(amt)}</td><td>${r.isTotal ? '—' : fmtDisclosurePrintCell(getRowValue(draftData, r.key, 'adjustment'))}</td><td>${fmtDisclosurePrintCell(vat)}</td></tr>`;
    }).join('');
    const inRows = INPUT_ROWS.map((r: any) => {
      const amt = r.isTotal ? inputTotal : getRowValue(draftData, r.key, 'amount');
      const vat = r.isTotal ? inputTotal : getRowValue(draftData, r.key, 'vat');
      return `<tr><td>${(label(r) || '').replace(/</g, '&lt;')}</td><td>${fmtDisclosurePrintCell(amt)}</td><td>${r.isTotal ? '—' : fmtDisclosurePrintCell(getRowValue(draftData, r.key, 'adjustment'))}</td><td>${fmtDisclosurePrintCell(vat)}</td></tr>`;
    }).join('');
    openPrintWindow({
      title: t('hajriTax'),
      companyName: name || '',
      subtitle: `${periodLabel} — ${lang === 'ar' ? 'تخطيط ضريبي (لا يؤثر على المحاسبة)' : 'Planning only (no accounting impact)'}`,
      body: `<p>${lang === 'ar' ? 'مبلغ الدفع المستهدف:' : 'Target payment:'} ${(() => {
        const p = parseFloat(String(paymentTargetStr).replace(/,/g, ''));
        return Number.isFinite(p) && Math.abs(p) > 1e-9 ? `${fmtTax(p)} SR` : '—';
      })()}</p>
<table><thead><tr><th>${t('reportItem')}</th><th>SR</th><th>${lang === 'ar' ? 'تعديل' : 'Adj.'}</th><th>VAT</th></tr></thead>
<tbody><tr><td colspan="4" style="background:#f0fdf4;font-weight:700">${lang === 'ar' ? 'مخرجات ضريبة القيمة المضافة (المبيعات)' : 'Output VAT (sales)'}</td></tr>${outRows}
<tr><td colspan="4" style="background:#fef2f2;font-weight:700">${lang === 'ar' ? 'ضريبة المشتريات والمصروفات (ما سُجّلت ضريبته فقط)' : 'Purchases & expenses VAT (tax lines only)'}</td></tr>${inRows}</tbody></table>
<p><b>${lang === 'ar' ? 'صافي مستحق' : 'Net payable'}:</b> ${fmtTax(netPayableDraft)} SR</p>`,
    });
  }, [detailCompanyId, companyMeta, lang, draftData, outputTotal, inputTotal, netPayableDraft, paymentTargetStr, periodLabel, t]);

  const exportDetailExcel = useCallback(() => {
    const rows = [];
    const label = (r: any) => (lang === 'ar' ? r.labelAr : r.labelEn);
    OUTPUT_ROWS.forEach((r: any) => {
      if (!r.isTotal) rows.push({ Item: label(r), Amount: getRowValue(draftData, r.key, 'amount'), VAT: getRowValue(draftData, r.key, 'vat') });
    });
    INPUT_ROWS.forEach((r: any) => {
      if (!r.isTotal) rows.push({ Item: label(r), Amount: getRowValue(draftData, r.key, 'amount'), VAT: getRowValue(draftData, r.key, 'vat') });
    });
    rows.push({ Item: lang === 'ar' ? 'صافي مستحق' : 'Net payable', Amount: '', VAT: netPayableDraft });
    exportToExcel(rows, `hajri-tax-${detailCompanyId}-${periodLabel}.xlsx`);
  }, [draftData, lang, detailCompanyId, netPayableDraft, periodLabel]);

  const exportConsolidatedExcel = useCallback(() => {
    const rows = registryRows.map((r: any) => {
      const payload = registryPayload(r);
      const net = computeNetPayable(payload);
      const pt = r.paymentTarget != null ? parseFloat(String(r.paymentTarget)) : null;
      const submitted = isHajriDeclarationSubmitted(r);
      return {
        [lang === 'ar' ? 'الشركة' : 'Company']: lang === 'en'
          ? (r.company?.nameEn || r.company?.nameAr)
          : (r.company?.nameAr || r.company?.nameEn),
        Year: r.year,
        Quarter: `Q${r.quarter}`,
        [t('hajriTaxColSales')]: registrySalesAmount(payload),
        [t('hajriTaxColPurchases')]: registryPurchasesAmount(payload),
        [t('hajriTaxColOutputVat')]: registryOutputVat(payload),
        [t('hajriTaxColInputVat')]: registryInputVat(payload),
        [t('vatNetPayable')]: net,
        [t('vatPaymentTarget')]: Number.isFinite(pt) ? pt : '',
        [t('hajriTaxColFiling')]: submitted ? t('hajriTaxSubmittedYes') : t('hajriTaxSubmittedNo'),
        [t('vatNotes')]: r.notes || '',
        [t('vatLastUpdated')]: r.updatedAt ? String(r.updatedAt).slice(0, 19) : '—',
      };
    });
    exportToExcel(rows, `hajri-tax-registry-${currentYear}.xlsx`);
  }, [registryRows, lang, t, currentYear]);

  const printConsolidated = useCallback(() => {
    const bodyRows = registryRows
      .map((r: any) => {
        const nm = lang === 'en' ? (r.company?.nameEn || r.company?.nameAr) : r.company?.nameAr;
        const payload = registryPayload(r);
        const net = computeNetPayable(payload);
        const pt = r.paymentTarget != null ? parseFloat(String(r.paymentTarget)) : null;
        const submitted = isHajriDeclarationSubmitted(r);
        const esc = (s: string) => String(s || '').replace(/</g, '&lt;');
        return `<tr><td>${esc(nm || '')}</td><td>${r.year}</td><td>Q${r.quarter}</td><td>${fmt(registrySalesAmount(payload), 2)} SR</td><td>${fmt(registryPurchasesAmount(payload), 2)} SR</td><td>${fmtTax(registryOutputVat(payload))} SR</td><td>${fmtTax(registryInputVat(payload))} SR</td><td>${fmtTax(net)} SR</td><td>${pt != null && Number.isFinite(pt) ? `${fmtTax(pt)} SR` : '—'}</td><td>${esc(submitted ? t('hajriTaxSubmittedYes') : t('hajriTaxSubmittedNo'))}</td><td>${esc(r.notes || '')}</td></tr>`;
      })
      .join('');
    openPrintWindow({
      title: `${t('hajriTax')} — ${lang === 'ar' ? 'السجل' : 'Registry'}`,
      companyName: '',
      subtitle: '',
      body: `<table class="w-full"><thead><tr><th>${lang === 'ar' ? 'الشركة' : 'Company'}</th><th>${lang === 'ar' ? 'السنة' : 'Year'}</th><th>${t('vatQuarter')}</th><th>${t('hajriTaxColSales')}</th><th>${t('hajriTaxColPurchases')}</th><th>${t('hajriTaxColOutputVat')}</th><th>${t('hajriTaxColInputVat')}</th><th>${t('vatNetPayable')}</th><th>${t('vatPaymentTarget')}</th><th>${t('hajriTaxColFiling')}</th><th>${t('vatNotes')}</th></tr></thead><tbody>${bodyRows}</tbody></table>`,
    });
  }, [registryRows, lang, t]);

  const exportJsonBundle = useCallback(() => {
    const records = registryRows.map((r: any) => ({
      companyId: r.companyId,
      year: r.year,
      quarter: r.quarter,
      payload: r.payload && typeof r.payload === 'object' ? r.payload : defaultDisclosureData(),
      paymentTarget: r.paymentTarget ?? null,
      notes: r.notes ?? null,
      sourceSnapshot: r.sourceSnapshot ?? null,
    }));
    const blob = new Blob(
      [JSON.stringify({ version: 2, exportedAt: new Date().toISOString(), records }, null, 2)],
      { type: 'application/json' },
    );
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'hajri-tax-registry-export.json';
    a.click();
    URL.revokeObjectURL(a.href);
  }, [registryRows]);

  const onJsonImport = useCallback(
    async (e: any) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;
      let parsed;
      try {
        parsed = JSON.parse(await file.text());
      } catch {
        return;
      }
      const list = Array.isArray(parsed?.records) ? parsed.records : Array.isArray(parsed) ? parsed : [];
      const fallbackYear = parsed.year;
      const fallbackQuarter = parsed.quarter;
      for (const item of list) {
        if (!item?.companyId) continue;
        const y = item.year ?? fallbackYear;
        const q = item.quarter ?? fallbackQuarter;
        if (!Number.isFinite(Number(y)) || !Number.isFinite(Number(q))) continue;
        const res = await upsertVatPlanning({
          companyId: item.companyId,
          year: Number(y),
          quarter: Number(q),
          payload: normalizeDisclosureDecimals(item.payload || defaultDisclosureData()),
          paymentTarget: item.paymentTarget ?? null,
          notes: item.notes ?? null,
          sourceSnapshot: item.sourceSnapshot ?? undefined,
        });
        throwIfApiFailed(res, 'فشل استيراد سجل');
      }
      qc.invalidateQueries({ queryKey: vatKeys.root() });
      refetchRegistry();
      refetch();
    },
    [qc, refetchRegistry, refetch],
  );

  const handleBulkImportSuccess = useCallback(() => {
    qc.invalidateQueries({ queryKey: vatKeys.root() });
    refetchRegistry();
    refetch();
  }, [qc, refetchRegistry, refetch]);

  return {
    companies,
    t,
    lang,
    currentYear,
    detailCompanyId,
    detailReadOnly,
    setDetailReadOnly,
    showNewDeclarationModal,
    setShowNewDeclarationModal,
    showBulkImportModal,
    setShowBulkImportModal,
    cellEdit,
    setCellEdit,
    draftData,
    paymentTargetStr,
    setPaymentTargetStr,
    notes,
    setNotes,
    sourceSnapshot,
    detailFilingSubmitted,
    filingBusyRowId,
    saveHint,
    showSimulator,
    setShowSimulator,
    importingReport,
    salesAmountIncludesVat,
    setSalesAmountIncludesVat,
    registryFilterCompanies,
    registryFilterYearOptions,
    registryRows,
    registryLoading,
    regFilterYear,
    setRegFilterYear,
    regFilterQuarter,
    setRegFilterQuarter,
    regFilterCompany,
    setRegFilterCompany,
    periodLabel,
    upsertMutation,
    handleRegistryFilingChange,
    openFromRegistryRow,
    handleNewDeclarationConfirm,
    closeDetail,
    updateRow,
    outputTotal,
    inputTotal,
    netPayableDraft,
    priorAdj,
    balanceCarried,
    netVat,
    paymentTargetParsed,
    simulatorRequiredInputVat,
    simulatorEstimatedBaseAt15: simulatorEstimatedBaseAtStandardRate,
    simulatorInvalidTarget,
    handleImportFromTaxReport,
    handleBalancePayment,
    persistDetailFilingSubmitted,
    handleSaveDetail,
    companyMeta,
    printDetail,
    exportDetailExcel,
    exportConsolidatedExcel,
    printConsolidated,
    exportJsonBundle,
    jsonInputRef,
    onJsonImport,
    handleBulkImportSuccess,
  };
}
