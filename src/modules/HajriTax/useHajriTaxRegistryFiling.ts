import { useCallback } from 'react';
import {
  defaultDisclosureData,
  mergeImportedDisclosure,
  normalizeDisclosureDecimals,
  syncVatPlanningSummaryFields,
} from '../../constants/taxDisclosure';
import type {
  VatPlanningRecord,
  VatPlanningUpsertPayload,
} from '../../types/api/domains/hajriTax';
import { registryPayload } from './hajriRegistryMetrics';

type MutationLike = {
  mutateAsync: (payload: VatPlanningUpsertPayload) => Promise<unknown>;
};

type UseHajriTaxRegistryFilingParams = {
  upsertMutation: MutationLike;
  setFilingBusyRowId: (id: string | null) => void;
};

function parseRegistryPaymentTarget(value: unknown): number | null {
  const parsed = value != null ? parseFloat(String(value)) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

export function useHajriTaxRegistryFiling({
  upsertMutation,
  setFilingBusyRowId,
}: UseHajriTaxRegistryFilingParams) {
  const buildUpsertFromRegistryRow = useCallback((
    row: VatPlanningRecord,
    overrides: Partial<VatPlanningUpsertPayload> = {},
  ): VatPlanningUpsertPayload => {
    const payload = normalizeDisclosureDecimals(
      syncVatPlanningSummaryFields(mergeImportedDisclosure(defaultDisclosureData(), registryPayload(row))),
    );
    return {
      companyId: row.companyId,
      year: row.year,
      quarter: row.quarter,
      payload,
      sourceSnapshot: row.sourceSnapshot ?? undefined,
      paymentTarget: parseRegistryPaymentTarget(row.paymentTarget),
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
    [buildUpsertFromRegistryRow, setFilingBusyRowId, upsertMutation],
  );

  return { handleRegistryFilingChange };
}
