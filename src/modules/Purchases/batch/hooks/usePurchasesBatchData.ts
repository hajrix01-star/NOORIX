import { useMemo, useEffect } from 'react';
import Decimal from 'decimal.js';
import { useSuppliers } from '../../../../hooks/useSuppliers';
import { useCategories } from '../../../../hooks/useCategories';
import { useVaults } from '../../../../hooks/useVaults';
import { useTableFilter } from '../../../../hooks/useTableFilter';
import { useBatchSummary } from '../../../../hooks/useBatchCalculation';
import { useApiQuery, useApiQueryOr } from '../../../../hooks/useApiQuery';
import { getCompany, getPurchaseBatchSummaries } from '../../../../services/api';
import { purchaseKeys, companyKeys } from '../../../../services/queryKeys';
import { buildActiveCancelledPartialStatusMap } from '../../../../constants/badgeMaps';
import {
  mapApiBatchSummaryToTableRow,
  type PurchaseBatchSummaryApiRow,
} from '../utils/purchasesBatchMappers';
import { vatRateDecimalFromCompany } from '../../../../utils/vatRate';
import { PAGE_SIZE } from '../constants';
import { normalizePurchaseBatchSummariesQueryInput } from '../../../../services/domains/apiEndpoints/purchase-batch-query';
import type {
  BatchTranslateFn,
  PurchaseBatchEntryRow,
  PurchaseBatchSupplier,
  PurchaseBatchSupplierCategory,
  PurchaseBatchSummaryRow,
  PurchaseBatchVault,
} from '../purchaseBatchTypes';

type PurchasesBatchDateFilter = {
  startDate: string;
  endDate: string;
};

type PurchaseBatchSummariesResponse = {
  batches?: PurchaseBatchSummaryApiRow[];
};

function isPurchaseBatchSupplierCategory(value: unknown): value is PurchaseBatchSupplierCategory {
  return typeof value === 'object' && value !== null;
}

function isPurchaseBatchSupplier(value: unknown): value is PurchaseBatchSupplier {
  return typeof value === 'object' && value !== null && 'id' in value && typeof value.id === 'string';
}

function isPurchaseBatchVault(value: unknown): value is PurchaseBatchVault {
  return typeof value === 'object' && value !== null && 'id' in value && typeof value.id === 'string';
}

export function usePurchasesBatchData(options: {
  companyId: string;
  lang: string;
  activeTab: string;
  dateFilter: PurchasesBatchDateFilter;
  debouncedBatchQ: string;
  showCancelledBatches: boolean;
  rows: PurchaseBatchEntryRow[];
  batchNotes: string;
  setBatchVaultId: (value: string) => void;
  batchVaultId: string;
  t: BatchTranslateFn;
}) {
  const {
    companyId,
    lang,
    activeTab,
    dateFilter,
    debouncedBatchQ,
    showCancelledBatches,
    rows,
    batchNotes,
    setBatchVaultId,
    batchVaultId,
    t,
  } = options;

  const { suppliers: rawSuppliers } = useSuppliers(companyId);
  const suppliers = rawSuppliers.filter(isPurchaseBatchSupplier);
  const bookmarks = useMemo(
    () => suppliers.filter((supplier) => supplier.isBookmarked).map((supplier) => supplier.id),
    [suppliers],
  );

  const { flatCategories: rawFlatCategories = [] } = useCategories(companyId);
  const flatCategories = rawFlatCategories.filter(isPurchaseBatchSupplierCategory);

  const { paymentVaults: rawActiveVaults = [], isLoading: vaultsLoading } = useVaults({ companyId });
  const activeVaults = rawActiveVaults.filter(isPurchaseBatchVault);

  const { data: companyData } = useApiQueryOr<unknown | null>({
    queryKey: companyKeys.single(companyId),
    queryFn: () => getCompany(companyId),
    fallback: null,
    enabled: !!companyId,
    fallbackMessage: t('loadingError'),
  });
  const vatRateDecimal = vatRateDecimalFromCompany(companyData);

  useEffect(() => {
    setBatchVaultId('');
  }, [companyId, setBatchVaultId]);

  useEffect(() => {
    if (batchVaultId && !activeVaults.some((vault) => vault.id === batchVaultId)) setBatchVaultId('');
  }, [activeVaults, batchVaultId, setBatchVaultId]);

  const {
    data: batchSummaryData,
    isLoading: batchesLoading,
    isError: batchesError,
    error: batchesErr,
  } = useApiQuery<PurchaseBatchSummariesResponse>({
    queryKey: purchaseKeys.batchSummaries(
      normalizePurchaseBatchSummariesQueryInput({
        companyId,
        startDate: dateFilter.startDate,
        endDate: dateFilter.endDate,
        q: debouncedBatchQ,
        lang,
      }),
    ),
    queryFn: () =>
      getPurchaseBatchSummaries(
        companyId,
        dateFilter.startDate,
        dateFilter.endDate,
        debouncedBatchQ || undefined,
        lang,
      ),
    enabled: !!companyId && activeTab === 'history',
    fallbackMessage: t('loadBatchFailed'),
  });

  const statusBadgeMap = useMemo(() => buildActiveCancelledPartialStatusMap(t), [t]);

  const batchesTableData = useMemo<PurchaseBatchSummaryRow[]>(() => {
    const list = batchSummaryData?.batches ?? [];
    return list.map((batch) => mapApiBatchSummaryToTableRow(batch));
  }, [batchSummaryData]);

  const batchesForTable = useMemo(() => {
    if (showCancelledBatches) return batchesTableData;
    return batchesTableData.filter((batch) => batch.status !== 'cancelled');
  }, [batchesTableData, showCancelledBatches]);

  const { filteredData, allFilteredData, page, setPage, sortKey, sortDir, toggleSort, setSearch: setBatchTableSearch } = useTableFilter(
    batchesForTable,
    {
      searchKeys: ['batchId', 'transactionDate', 'supplierNames', 'vaultName'],
      pageSize: PAGE_SIZE,
      defaultSortKey: 'transactionDate',
      defaultSortDir: 'desc',
      dateKeys: ['transactionDate'],
    },
  );

  useEffect(() => {
    setBatchTableSearch(debouncedBatchQ);
    setPage(1);
  }, [debouncedBatchQ, showCancelledBatches, setBatchTableSearch, setPage]);

  const filteredPurchaseBatches: PurchaseBatchSummaryRow[] = filteredData;
  const allFilteredPurchaseBatches: PurchaseBatchSummaryRow[] = allFilteredData;
  const activeOnly = allFilteredPurchaseBatches.filter((batch) => batch.status !== 'cancelled');
  const displayedTotal = allFilteredPurchaseBatches.length;
  const totalNet = activeOnly.reduce((sum, batch) => sum.plus(batch.netAmount), new Decimal(0));
  const totalTax = activeOnly.reduce((sum, batch) => sum.plus(batch.taxAmount), new Decimal(0));
  const totalAmount = activeOnly.reduce((sum, batch) => sum.plus(batch.totalAmount), new Decimal(0));

  const summary = useBatchSummary(rows, vatRateDecimal, batchNotes);

  return {
    suppliers,
    bookmarks,
    flatCategories,
    activeVaults,
    vaultsLoading,
    batchSummaryData,
    batchesLoading,
    batchesError,
    batchesErr,
    batchesTableData,
    batchesForTable,
    filteredData: filteredPurchaseBatches,
    allFilteredData: allFilteredPurchaseBatches,
    page,
    setPage,
    sortKey,
    sortDir,
    toggleSort,
    displayedTotal,
    activeOnly,
    totalNet,
    totalTax,
    totalAmount,
    statusBadgeMap,
    summary,
    vatRateDecimal,
  };
}
