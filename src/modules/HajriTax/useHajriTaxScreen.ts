import { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useApp } from '../../context/AppContext';
import { useTranslation } from '../../i18n/useTranslation';
import {
  useUpsertVatPlanning,
  useVatPlanningList,
} from '../../hooks/useVatPlanning';
import {
  defaultDisclosureData,
  roundMoney2,
  computeNetPayable,
  computeOutputTotal,
  computeInputTotal,
  getRowValue,
  SUMMARY_ROWS,
  type TaxDisclosureData,
  type TaxDisclosureField,
  type TaxDisclosureRowKey,
} from '../../constants/taxDisclosure';
import { vatRateDecimalFromCompany } from '../../utils/vatRate';
import { useHajriTaxExports } from './useHajriTaxExports';
import { useHajriTaxDetailNavigation } from './useHajriTaxDetailNavigation';
import { useHajriTaxPaymentSimulator } from './useHajriTaxPaymentSimulator';
import { useHajriTaxPersistenceActions } from './useHajriTaxPersistenceActions';
import { useHajriTaxRegistryFiling } from './useHajriTaxRegistryFiling';
import { useHajriTaxRegistryData } from './useHajriTaxRegistryData';
import type {
  HajriTaxCellEdit,
  HajriTaxQuarter,
  VatPlanningSourceSnapshot,
} from '../../types/api/domains/hajriTax';

function isHajriQuarter(value: unknown): value is HajriTaxQuarter {
  return value === 1 || value === 2 || value === 3 || value === 4;
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

  const { data: apiRecords = [], isLoading: listLoading, refetch } = useVatPlanningList(
    year,
    quarter,
    undefined,
    true,
  );

  const upsertMutation = useUpsertVatPlanning();

  const { handleRegistryFilingChange } = useHajriTaxRegistryFiling({
    upsertMutation,
    setFilingBusyRowId,
  });
  const { openFromRegistryRow, handleNewDeclarationConfirm, closeDetail } = useHajriTaxDetailNavigation({
    apiRecords,
    listLoading,
    searchParams,
    setSearchParams,
    companies,
    urlOpenKeyRef,
    refetch,
    refetchRegistry,
    setYear,
    setQuarter,
    setRegFilterCompany,
    setDetailReadOnly,
    setDraftData,
    setPaymentTargetStr,
    setNotes,
    setSourceSnapshot,
    setImportIso,
    setDetailFilingSubmitted,
    setDetailCompanyId,
    setSaveHint,
  });
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

  const {
    handleImportFromTaxReport,
    persistDetailFilingSubmitted,
    handleSaveDetail,
    onJsonImport,
    handleBulkImportSuccess,
  } = useHajriTaxPersistenceActions({
    detailCompanyId,
    detailReadOnly,
    year,
    quarter,
    periodStr,
    salesAmountIncludesVat,
    draftData,
    setDraftData,
    paymentTargetStr,
    notes,
    sourceSnapshot,
    setSourceSnapshot,
    importIso,
    setImportIso,
    detailFilingSubmitted,
    setDetailFilingSubmitted,
    setImportingReport,
    setSaveHint,
    upsertMutation,
    t,
    qc,
    refetchRegistry,
    refetch,
  });
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
