import { useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import Decimal from 'decimal.js';
import { useSuppliers } from '../../../../hooks/useSuppliers';
import { useCategories } from '../../../../hooks/useCategories';
import { useVaults } from '../../../../hooks/useVaults';
import { useTableFilter } from '../../../../hooks/useTableFilter';
import { useBatchSummary } from '../../../../hooks/useBatchCalculation';
import { getCompany, getPurchaseBatchSummaries, throwIfApiFailed } from '../../../../services/api';
import { purchaseKeys, companyKeys } from '../../../../services/queryKeys';
import { buildActiveCancelledPartialStatusMap } from '../../../../constants/badgeMaps';
import { mapApiBatchSummaryToTableRow } from '../utils/purchasesBatchMappers';
import { vatRateDecimalFromCompany } from '../../../../utils/vatRate';
import { PAGE_SIZE } from '../constants';

export function usePurchasesBatchData(options: {
  companyId: string;
  lang: string;
  activeTab: string;
  dateFilter: { startDate: string; endDate: string };
  debouncedBatchQ: string;
  showCancelledBatches: boolean;
  rows: any[];
  setBatchVaultId: (v: string) => void;
  batchVaultId: string;
  t: (key: string, ...args: any[]) => string;
}) {
  const {
    companyId,
    lang,
    activeTab,
    dateFilter,
    debouncedBatchQ,
    showCancelledBatches,
    rows,
    setBatchVaultId,
    batchVaultId,
    t,
  } = options;

  const { suppliers } = useSuppliers(companyId);
  const bookmarks = useMemo(
    () => suppliers.filter((s: any) => s.isBookmarked).map((s: any) => s.id),
    [suppliers],
  );
  const { flatCategories = [] } = useCategories(companyId);
  const { paymentVaults: activeVaults = [], isLoading: vaultsLoading } = useVaults({ companyId });

  const { data: companyData } = useQuery({
    queryKey: companyKeys.single(companyId),
    queryFn: async () => {
      const res = await getCompany(companyId);
      return res?.success ? res.data : null;
    },
    enabled: !!companyId,
  });
  const vatRateDecimal = vatRateDecimalFromCompany(companyData);

  useEffect(() => {
    setBatchVaultId('');
  }, [companyId, setBatchVaultId]);

  useEffect(() => {
    if (batchVaultId && !activeVaults.some((v: any) => v.id === batchVaultId)) setBatchVaultId('');
  }, [activeVaults, batchVaultId, setBatchVaultId]);

  const {
    data: batchSummaryData,
    isLoading: batchesLoading,
    isError: batchesError,
    error: batchesErr,
  } = useQuery({
    queryKey: purchaseKeys.batchSummaries(companyId, dateFilter.startDate, dateFilter.endDate, debouncedBatchQ, lang),
    queryFn: async () => {
      const res = await getPurchaseBatchSummaries(
        companyId,
        dateFilter.startDate,
        dateFilter.endDate,
        debouncedBatchQ || undefined,
        lang,
      );
      throwIfApiFailed(res, t('loadBatchFailed'));
      return res.data;
    },
    enabled: !!companyId && activeTab === 'history',
  });

  const statusBadgeMap = useMemo(() => buildActiveCancelledPartialStatusMap(t), [t]);

  const batchesTableData = useMemo(() => {
    const list = batchSummaryData?.batches || [];
    return list.map((b: any) => mapApiBatchSummaryToTableRow(b));
  }, [batchSummaryData]);

  const batchesForTable = useMemo(() => {
    if (showCancelledBatches) return batchesTableData;
    return batchesTableData.filter((b: any) => b.status !== 'cancelled');
  }, [batchesTableData, showCancelledBatches]);

  const { filteredData, allFilteredData, page, setPage, sortKey, sortDir, toggleSort } = useTableFilter(
    batchesForTable,
    {
      searchKeys: [],
      pageSize: PAGE_SIZE,
      defaultSortKey: 'transactionDate',
      defaultSortDir: 'desc',
    },
  );

  useEffect(() => {
    setPage(1);
  }, [debouncedBatchQ, showCancelledBatches, setPage]);

  const activeOnly = allFilteredData.filter((b: any) => b.status !== 'cancelled');
  const displayedTotal = allFilteredData.length;
  const totalNet = activeOnly.reduce((s: any, b: any) => s.plus(b.netAmount), new Decimal(0));
  const totalTax = activeOnly.reduce((s: any, b: any) => s.plus(b.taxAmount), new Decimal(0));
  const totalAmount = activeOnly.reduce((s: any, b: any) => s.plus(b.totalAmount), new Decimal(0));

  const summary = useBatchSummary(rows, vatRateDecimal);

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
    filteredData,
    allFilteredData,
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
