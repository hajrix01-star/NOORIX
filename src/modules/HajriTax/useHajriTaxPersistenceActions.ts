import { useCallback, type ChangeEvent, type Dispatch, type SetStateAction } from 'react';
import {
  defaultDisclosureData,
  mergeImportedDisclosure,
  normalizeDisclosureDecimals,
  syncVatPlanningSummaryFields,
  type TaxDisclosureData,
} from '../../constants/taxDisclosure';
import { getTaxVatReport, throwIfApiFailed, upsertVatPlanning } from '../../services/api';
import { vatKeys } from '../../services/queryKeys';
import type {
  HajriTaxQuarter,
  HajriTaxTranslate,
  VatPlanningSourceSnapshot,
  VatPlanningUpsertPayload,
} from '../../types/api/domains/hajriTax';
import { createHajriTaxImportIso } from './hajriTaxImportMetadataModel';

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

type QueryClientLike = {
  invalidateQueries: (args: { queryKey: readonly unknown[] }) => void;
};

type MutationLike = {
  mutateAsync: (payload: VatPlanningUpsertPayload) => Promise<unknown>;
};

type UseHajriTaxPersistenceActionsParams = {
  detailCompanyId: string | null;
  detailReadOnly: boolean;
  year: number;
  quarter: HajriTaxQuarter;
  periodStr: string;
  salesAmountIncludesVat: boolean;
  draftData: TaxDisclosureData;
  setDraftData: Dispatch<SetStateAction<TaxDisclosureData>>;
  paymentTargetStr: string;
  notes: string;
  sourceSnapshot: VatPlanningSourceSnapshot | null;
  setSourceSnapshot: Dispatch<SetStateAction<VatPlanningSourceSnapshot | null>>;
  importIso: string | null;
  setImportIso: Dispatch<SetStateAction<string | null>>;
  detailFilingSubmitted: boolean;
  setDetailFilingSubmitted: Dispatch<SetStateAction<boolean>>;
  setImportingReport: Dispatch<SetStateAction<boolean>>;
  setSaveHint: Dispatch<SetStateAction<string>>;
  upsertMutation: MutationLike;
  t: HajriTaxTranslate;
  qc: QueryClientLike;
  refetchRegistry: () => void;
  refetch: () => void;
};

function isJsonRecord(value: unknown): value is JsonImportRecord {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function parsePaymentTarget(value: unknown): number | null {
  const parsed = parseFloat(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(parsed) && Math.abs(parsed) > 1e-9 ? parsed : null;
}

function parseImportQuarter(value: unknown): HajriTaxQuarter | null {
  const parsed = Number(value);
  return parsed === 1 || parsed === 2 || parsed === 3 || parsed === 4 ? parsed : null;
}

export function useHajriTaxPersistenceActions({
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
}: UseHajriTaxPersistenceActionsParams) {
  const handleImportFromTaxReport = useCallback(async () => {
    if (!detailCompanyId || detailReadOnly) return;
    setImportingReport(true);
    try {
      const res = await getTaxVatReport(detailCompanyId, year, periodStr, { salesAmountIncludesVat });
      throwIfApiFailed(res, 'فشل استيراد تقرير الضريبة');
      const imported = res.data;
      setDraftData((prev) =>
        normalizeDisclosureDecimals(syncVatPlanningSummaryFields(mergeImportedDisclosure(prev, imported))),
      );
      setSourceSnapshot(imported && typeof imported === 'object' ? { ...imported } : null);
      setImportIso(createHajriTaxImportIso());
    } finally {
      setImportingReport(false);
    }
  }, [
    detailCompanyId,
    detailReadOnly,
    year,
    periodStr,
    salesAmountIncludesVat,
    setDraftData,
    setSourceSnapshot,
    setImportIso,
    setImportingReport,
  ]);

  const persistDetailFilingSubmitted = useCallback(
    async (next: boolean) => {
      if (!detailCompanyId) return;
      await upsertMutation.mutateAsync({
        companyId: detailCompanyId,
        year,
        quarter,
        payload: normalizeDisclosureDecimals(syncVatPlanningSummaryFields(draftData)),
        sourceSnapshot: sourceSnapshot ?? undefined,
        paymentTarget: parsePaymentTarget(paymentTargetStr),
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
      setDetailFilingSubmitted,
      setSaveHint,
      t,
    ],
  );

  const handleSaveDetail = useCallback(async () => {
    if (!detailCompanyId || detailReadOnly) return;
    await upsertMutation.mutateAsync({
      companyId: detailCompanyId,
      year,
      quarter,
      payload: normalizeDisclosureDecimals(syncVatPlanningSummaryFields(draftData)),
      sourceSnapshot: sourceSnapshot ?? undefined,
      paymentTarget: parsePaymentTarget(paymentTargetStr),
      notes: notes.trim() || null,
      importedAt: importIso || undefined,
      filingSubmitted: detailFilingSubmitted,
    });
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
    setSaveHint,
    t,
  ]);

  const onJsonImport = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = '';
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
        const parsedQuarter = parseImportQuarter(q);
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
    handleImportFromTaxReport,
    persistDetailFilingSubmitted,
    handleSaveDetail,
    onJsonImport,
    handleBulkImportSuccess,
  };
}
