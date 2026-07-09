import { useMemo, useState, useCallback, useRef, useEffect, type ChangeEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useApp } from '../../context/AppContext';
import { useTranslation } from '../../i18n/useTranslation';
import {
  useUpsertVatPlanning,
  useVatPlanningList,
} from '../../hooks/useVatPlanning';
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
  syncVatPlanningSummaryFields,
  SUMMARY_ROWS,
  type TaxDisclosureData,
  type TaxDisclosureField,
  type TaxDisclosureRowKey,
} from '../../constants/taxDisclosure';
import { vatRateDecimalFromCompany } from '../../utils/vatRate';
import { getTaxVatReport, getVatPlanningList, throwIfApiFailed, upsertVatPlanning } from '../../services/api';
import { vatKeys } from '../../services/queryKeys';
import {
  isHajriDeclarationSubmitted,
  registryPayload,
} from './hajriRegistryMetrics';
import { clonePayload, formatLoadedPaymentTarget } from './hajriTaxScreenHelpers';
import { useHajriTaxExports } from './useHajriTaxExports';
import { useHajriTaxPaymentSimulator } from './useHajriTaxPaymentSimulator';
import { useHajriTaxRegistryData } from './useHajriTaxRegistryData';
import type {
  HajriTaxCellEdit,
  HajriTaxNewDeclarationRequest,
  HajriTaxQuarter,
  VatPlanningRecord,
  VatPlanningSourceSnapshot,
  VatPlanningUpsertPayload,
} from '../../types/api/domains/hajriTax';

type DetailMode = 'view' | 'edit';
type ForcedPeriod = { year: number; quarter: HajriTaxQuarter };
type JsonImportBundle = {
  year?: unknown;
  quarter?: unknown;
  records?: unknown;
};
type JsonImportRecord = {
  companyId?: unknown;
  year?: unknown;
  quarter?: unknown;
  payload?: unknown;
  paymentTarget?: unknown;
  notes?: unknown;
  sourceSnapshot?: unknown;
};

function isHajriQuarter(value: unknown): value is HajriTaxQuarter {
  return value === 1 || value === 2 || value === 3 || value === 4;
}

function parseHajriQuarter(value: unknown): HajriTaxQuarter | null {
  const parsed = Number(value);
  return isHajriQuarter(parsed) ? parsed : null;
}

function parsePaymentTarget(value: unknown): number | null {
  const parsed = parseFloat(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(parsed) && Math.abs(parsed) > 1e-9 ? parsed : null;
}

function isJsonRecord(value: unknown): value is JsonImportRecord {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function useHajriTaxScreen() {
  const { companies } = useApp();
  const { t, lang } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const qc = useQueryClient();
  const jsonInputRef = useRef<HTMLInputElement | null>(null);
  const urlOpenKeyRef = useRef('');

  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(() => {
    const y = Number(searchParams.get('year'));
    return Number.isFinite(y) && y >= 2000 ? y : currentYear;
  });
  const [quarter, setQuarter] = useState<HajriTaxQuarter>(() => {
    const q = Number(searchParams.get('quarter'));
    return isHajriQuarter(q) ? q : 1;
  });
  const [detailCompanyId, setDetailCompanyId] = useState<string | null>(null);
  const detailVatRateDecimal = useMemo(
    () => vatRateDecimalFromCompany(companies?.find((c) => c.id === detailCompanyId)),
    [companies, detailCompanyId],
  );
  const [detailReadOnly, setDetailReadOnly] = useState(false);
  const [showNewDeclarationModal, setShowNewDeclarationModal] = useState(false);
  const [showBulkImportModal, setShowBulkImportModal] = useState(false);
  /** ØªØ­Ø±ÙŠØ± Ø­Ø± ÙÙŠ Ø®Ù„Ø§ÙŠØ§ Ø§Ù„Ø¬Ø¯ÙˆÙ„ â€” Ø§Ù„Ù†Øµ ÙŠÙØ·Ø¨Ù‘ÙŽÙ‚ Ø¹Ù„Ù‰ Ø§Ù„Ù…Ø³ÙˆØ¯Ø© Ø¹Ù†Ø¯ blur ÙÙ‚Ø· */
  const [cellEdit, setCellEdit] = useState<HajriTaxCellEdit | null>(null);

  const [draftData, setDraftData] = useState<TaxDisclosureData>(() => defaultDisclosureData());
  const [paymentTargetStr, setPaymentTargetStr] = useState('');
  const [notes, setNotes] = useState('');
  const [sourceSnapshot, setSourceSnapshot] = useState<VatPlanningSourceSnapshot | null>(null);
  const [importIso, setImportIso] = useState<string | null>(null);
  const [detailFilingSubmitted, setDetailFilingSubmitted] = useState(false);
  const [filingBusyRowId, setFilingBusyRowId] = useState<string | null>(null);
  const [saveHint, setSaveHint] = useState('');
  const [showSimulator, setShowSimulator] = useState(true);
  const [importingReport, setImportingReport] = useState(false);
  /** Ø§Ø³ØªÙŠØ±Ø§Ø¯ Ù…Ø¨ÙŠØ¹Ø§Øª Ø¨Ø¯ÙˆÙ† Ø¶Ø±ÙŠØ¨Ø© Ù…Ø³Ø¬Ù‘Ù„Ø©: Ø¥Ø°Ø§ ÙƒØ§Ù† ØµØ§ÙÙŠ Ø§Ù„ÙØ§ØªÙˆØ±Ø© Ø¥Ø¬Ù…Ø§Ù„ÙŠÙ‹Ø§ Ø´Ø§Ù…Ù„Ø§Ù‹ 15% ÙˆÙ„ÙŠØ³ Ø£Ø³Ø§Ø³Ù‹Ø§ Ø®Ø§Ø¶Ø¹Ù‹Ø§ */
  const [salesAmountIncludesVat, setSalesAmountIncludesVat] = useState(false);

  const registryData = useHajriTaxRegistryData({
    companies,
    currentYear,
    detailCompanyId,
    lang,
    initialCompanyId: searchParams.get('company') || '',
  });
  const {
    registryRows,
    registryLoading,
    refetchRegistry,
    registryFilterCompanies,
    registryFilterYearOptions,
    regFilterCompany,
    setRegFilterCompany,
    regFilterYear,
    setRegFilterYear,
    regFilterQuarter,
    setRegFilterQuarter,
  } = registryData;

  const periodStr = `Q${quarter}`;
  const periodLabel = `${year}-${periodStr}`;

  /** Ø¬Ù„Ø¨ Ø¥Ù‚Ø±Ø§Ø±Ø§Øª Ø§Ù„Ø±Ø¨Ø¹ Ø§Ù„Ù…Ø­Ø¯Ø¯ â€” Ù„Ù„Ø±Ø¨Ø· Ù…Ø¹ `resolveRecord` ÙˆØ±ÙˆØ§Ø¨Ø· ?edit=1 Ù…Ù† Ø¯ÙˆÙ† ÙØªØ­ Ø§Ù„ØªÙØ§ØµÙŠÙ„ Ø£ÙˆÙ„Ù‹Ø§ */
  const { data: apiRecords = [], isLoading: listLoading, refetch } = useVatPlanningList(
    year,
    quarter,
    undefined,
    true,
  );

  const upsertMutation = useUpsertVatPlanning();

  const buildUpsertFromRegistryRow = useCallback((
    row: VatPlanningRecord,
    overrides: Partial<VatPlanningUpsertPayload> = {},
  ): VatPlanningUpsertPayload => {
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
      importedAt: row.importedAt ?? null,
      ...overrides,
    };
  }, []);

  const handleRegistryFilingChange = useCallback(
    async (row: VatPlanningRecord, next: boolean) => {
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
    const m = new Map<string, VatPlanningRecord>();
    (apiRecords || []).forEach((r) => m.set(r.companyId, r));
    return m;
  }, [apiRecords]);

  const resolveRecord = useCallback(
    (companyId: string) => recordByCompany.get(companyId),
    [recordByCompany],
  );

  const openCompanyDetail = useCallback(
    async (companyId: string, forcedPeriod?: ForcedPeriod) => {
      let rec: VatPlanningRecord | null = null;
      if (
        forcedPeriod &&
        Number.isFinite(forcedPeriod.year) &&
        forcedPeriod.year >= 2000 &&
        Number.isFinite(forcedPeriod.quarter) &&
        isHajriQuarter(forcedPeriod.quarter)
      ) {
        setYear(forcedPeriod.year);
        setQuarter(forcedPeriod.quarter);
        const res = await getVatPlanningList(forcedPeriod.year, forcedPeriod.quarter, companyId);
        throwIfApiFailed(res, 'ÙØ´Ù„ ØªØ­Ù…ÙŠÙ„ Ø§Ù„Ø³Ø¬Ù„');
        const arr = Array.isArray(res.data) ? res.data : [];
        rec = arr[0] || null;
      } else {
        rec = resolveRecord(companyId) ?? null;
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

  const openFromRegistryRow = useCallback((row: VatPlanningRecord, mode: DetailMode) => {
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
    async ({ companyId, year: y, quarter: q }: HajriTaxNewDeclarationRequest) => {
      setYear(y);
      setQuarter(q);
      setRegFilterCompany(companyId);
      setDetailReadOnly(false);
      const res = await getVatPlanningList(y, q, companyId);
      throwIfApiFailed(res, 'ÙØ´Ù„ ØªØ­Ù…ÙŠÙ„ Ø§Ù„Ø³Ø¬Ù„');
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
    setSearchParams((sp) => {
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
    if (!c || !companies?.some((x) => x.id === c)) return;
    const key = `${c}|${searchParams.get('year')}|${searchParams.get('quarter')}|1`;
    if (urlOpenKeyRef.current === key) return;
    urlOpenKeyRef.current = key;
    const yNum = Number(searchParams.get('year'));
    const qNum = Number(searchParams.get('quarter'));
    const forcedQuarter = parseHajriQuarter(qNum);
    const forcedPeriod =
      Number.isFinite(yNum) && yNum >= 2000 && forcedQuarter != null
        ? { year: yNum, quarter: forcedQuarter }
        : undefined;
    void openCompanyDetail(c, forcedPeriod);
  }, [listLoading, searchParams, companies, openCompanyDetail]);

  useEffect(() => {
    setCellEdit(null);
  }, [detailCompanyId, year, quarter, detailReadOnly]);

  const updateRow = useCallback((key: TaxDisclosureRowKey, field: TaxDisclosureField | null, value: string) => {
    if (detailReadOnly) return;
    const raw = String(value).replace(/,/g, '').trim();
    const parsed = raw === '' ? 0 : parseFloat(raw);
    const num = roundMoney2(Number.isFinite(parsed) ? parsed : 0);
    setDraftData((prev) => {
      const next = { ...prev };
      const isSummaryField = !field || SUMMARY_ROWS.some((r) => r.key === key);
      if (isSummaryField) next[key] = num;
      else {
        const current = next[key];
        const row = {
          ...(typeof current === 'object' && current !== null ? current : { amount: 0, adjustment: 0, vat: 0 }),
          [field]: num,
        };
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

  const {
    paymentTargetParsed,
    simulatorRequiredInputVat,
    simulatorEstimatedBaseAtStandardRate,
    simulatorInvalidTarget,
    handleBalancePayment,
  } = useHajriTaxPaymentSimulator({
    paymentTargetStr,
    outputTotal,
    priorAdj,
    balanceCarried,
    detailVatRateDecimal,
    detailReadOnly,
    setDraftData,
  });

  const handleImportFromTaxReport = useCallback(async () => {
    if (!detailCompanyId || detailReadOnly) return;
    setImportingReport(true);
    try {
      const res = await getTaxVatReport(detailCompanyId, year, periodStr, {
        salesAmountIncludesVat,
      });
      throwIfApiFailed(res, 'ÙØ´Ù„ Ø§Ø³ØªÙŠØ±Ø§Ø¯ ØªÙ‚Ø±ÙŠØ± Ø§Ù„Ø¶Ø±ÙŠØ¨Ø©');
      const imported = res.data;
      setDraftData((prev) =>
        normalizeDisclosureDecimals(syncVatPlanningSummaryFields(mergeImportedDisclosure(prev, imported))),
      );
      setSourceSnapshot(imported && typeof imported === 'object' ? { ...imported } : null);
      setImportIso(new Date().toISOString());
    } finally {
      setImportingReport(false);
    }
  }, [detailCompanyId, detailReadOnly, year, periodStr, salesAmountIncludesVat]);

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
    (id: string | null) => {
      const c = companies?.find((x) => x.id === id);
      if (!c) return { name: id ?? '', tax: '' };
      const name = lang === 'en' ? (c.nameEn || c.nameAr || c.name || '') : (c.nameAr || c.name || c.nameEn || '');
      return { name: name || id || '', tax: c.taxNumber || '', logoUrl: String(c.logoUrl || '').trim() };
    },
    [companies, lang],
  );

  const {
    printDetail,
    exportDetailExcel,
    exportConsolidatedExcel,
    printConsolidated,
    exportJsonBundle,
    printPreviewModal,
  } = useHajriTaxExports({
    t,
    lang,
    detailCompanyId,
    companyMeta,
    draftData,
    outputTotal,
    inputTotal,
    netPayableDraft,
    paymentTargetStr,
    periodLabel,
    registryRows,
    currentYear,
  });

  const onJsonImport = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;
      let parsed: JsonImportBundle | unknown[];
      try {
        parsed = JSON.parse(await file.text()) as JsonImportBundle | unknown[];
      } catch {
        return;
      }
      const list = Array.isArray(parsed)
        ? parsed
        : isJsonRecord(parsed) && Array.isArray(parsed.records)
          ? parsed.records
          : [];
      const fallbackYear = !Array.isArray(parsed) && isJsonRecord(parsed) ? parsed.year : undefined;
      const fallbackQuarter = !Array.isArray(parsed) && isJsonRecord(parsed) ? parsed.quarter : undefined;
      for (const item of list) {
        if (!isJsonRecord(item) || !item.companyId) continue;
        const y = item.year ?? fallbackYear;
        const q = item.quarter ?? fallbackQuarter;
        const parsedQuarter = parseHajriQuarter(q);
        if (!Number.isFinite(Number(y)) || parsedQuarter == null) continue;
        const res = await upsertVatPlanning({
          companyId: String(item.companyId),
          year: Number(y),
          quarter: parsedQuarter,
          payload: normalizeDisclosureDecimals(item.payload || defaultDisclosureData()),
          paymentTarget: parsePaymentTarget(item.paymentTarget),
          notes: item.notes == null ? null : String(item.notes),
          sourceSnapshot: isJsonRecord(item.sourceSnapshot) ? { ...item.sourceSnapshot } : undefined,
        });
        throwIfApiFailed(res, 'ÙØ´Ù„ Ø§Ø³ØªÙŠØ±Ø§Ø¯ Ø³Ø¬Ù„');
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
    printPreviewModal,
    jsonInputRef,
    onJsonImport,
    handleBulkImportSuccess,
  };
}
