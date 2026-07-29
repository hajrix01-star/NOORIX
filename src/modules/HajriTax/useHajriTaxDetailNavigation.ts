import { useCallback, useEffect, useMemo, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import {
  defaultDisclosureData,
  type TaxDisclosureData,
} from '../../constants/taxDisclosure';
import { getVatPlanningList, throwIfApiFailed } from '../../services/api';
import type {
  HajriTaxQuarter,
  VatPlanningRecord,
  VatPlanningSourceSnapshot,
} from '../../types/api/domains/hajriTax';
import { isHajriDeclarationSubmitted } from './hajriRegistryMetrics';
import { removeHajriTaxEditSearchParam } from './hajriTaxNavigationModel';
import { clonePayload, formatLoadedPaymentTarget } from './hajriTaxScreenHelpers';

type DetailMode = 'view' | 'edit';
type ForcedPeriod = { year: number; quarter: HajriTaxQuarter };
type CompanyRef = { id?: string | null };

type UseHajriTaxDetailNavigationParams = {
  apiRecords: VatPlanningRecord[];
  listLoading: boolean;
  searchParams: URLSearchParams;
  setSearchParams: (updater: (params: URLSearchParams) => URLSearchParams) => void;
  companies?: CompanyRef[];
  urlOpenKeyRef: MutableRefObject<string>;
  refetch: () => void;
  refetchRegistry: () => void;
  setYear: Dispatch<SetStateAction<number>>;
  setQuarter: Dispatch<SetStateAction<HajriTaxQuarter>>;
  setRegFilterCompany: Dispatch<SetStateAction<string>>;
  setDetailReadOnly: Dispatch<SetStateAction<boolean>>;
  setDraftData: Dispatch<SetStateAction<TaxDisclosureData>>;
  setPaymentTargetStr: Dispatch<SetStateAction<string>>;
  setNotes: Dispatch<SetStateAction<string>>;
  setSourceSnapshot: Dispatch<SetStateAction<VatPlanningSourceSnapshot | null>>;
  setImportIso: Dispatch<SetStateAction<string | null>>;
  setDetailFilingSubmitted: Dispatch<SetStateAction<boolean>>;
  setDetailCompanyId: Dispatch<SetStateAction<string | null>>;
  setSaveHint: Dispatch<SetStateAction<string>>;
};

function parseQuarter(value: unknown): HajriTaxQuarter | null {
  const parsed = Number(value);
  return parsed === 1 || parsed === 2 || parsed === 3 || parsed === 4 ? parsed : null;
}

export function useHajriTaxDetailNavigation({
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
}: UseHajriTaxDetailNavigationParams) {
  const recordByCompany = useMemo(() => {
    const records = new Map<string, VatPlanningRecord>();
    apiRecords.forEach((record) => records.set(record.companyId, record));
    return records;
  }, [apiRecords]);

  const loadRecordToDetail = useCallback((companyId: string, record: VatPlanningRecord | null, readOnly: boolean) => {
    const payload = record?.payload && typeof record.payload === 'object' ? record.payload : {};
    setDraftData(clonePayload(payload));
    setPaymentTargetStr(formatLoadedPaymentTarget(record?.paymentTarget));
    setNotes(record?.notes || '');
    setSourceSnapshot(record?.sourceSnapshot ?? null);
    setImportIso(record?.importedAt || null);
    setDetailFilingSubmitted(record ? isHajriDeclarationSubmitted(record) : false);
    setDetailCompanyId(companyId);
    setDetailReadOnly(readOnly);
    setSaveHint('');
  }, [
    setDetailCompanyId,
    setDetailFilingSubmitted,
    setDetailReadOnly,
    setDraftData,
    setImportIso,
    setNotes,
    setPaymentTargetStr,
    setSaveHint,
    setSourceSnapshot,
  ]);

  const openCompanyDetail = useCallback(
    async (companyId: string, forcedPeriod?: ForcedPeriod) => {
      let record: VatPlanningRecord | null = null;
      if (forcedPeriod) {
        setYear(forcedPeriod.year);
        setQuarter(forcedPeriod.quarter);
        const res = await getVatPlanningList(forcedPeriod.year, forcedPeriod.quarter, companyId);
        throwIfApiFailed(res, 'فشل تحميل السجل');
        record = Array.isArray(res.data) ? res.data[0] || null : null;
      } else {
        record = recordByCompany.get(companyId) ?? null;
      }
      loadRecordToDetail(companyId, record, false);
    },
    [loadRecordToDetail, recordByCompany, setQuarter, setYear],
  );

  const openFromRegistryRow = useCallback((row: VatPlanningRecord, mode: DetailMode) => {
    setYear(row.year);
    setQuarter(row.quarter);
    setRegFilterCompany(row.companyId);
    loadRecordToDetail(row.companyId, row, mode === 'view');
  }, [loadRecordToDetail, setQuarter, setRegFilterCompany, setYear]);

  const handleNewDeclarationConfirm = useCallback(
    async ({ companyId, year, quarter }: { companyId: string; year: number; quarter: HajriTaxQuarter }) => {
      setYear(year);
      setQuarter(quarter);
      setRegFilterCompany(companyId);
      const res = await getVatPlanningList(year, quarter, companyId);
      throwIfApiFailed(res, 'فشل تحميل السجل');
      const record = Array.isArray(res.data) && res.data[0] ? res.data[0] : null;
      if (record) {
        loadRecordToDetail(companyId, record, false);
      } else {
        setDraftData(defaultDisclosureData());
        setPaymentTargetStr('');
        setNotes('');
        setSourceSnapshot(null);
        setImportIso(null);
        setDetailFilingSubmitted(false);
        setDetailCompanyId(companyId);
        setDetailReadOnly(false);
        setSaveHint('');
      }
    },
    [
      loadRecordToDetail,
      setDetailCompanyId,
      setDetailFilingSubmitted,
      setDetailReadOnly,
      setDraftData,
      setImportIso,
      setNotes,
      setPaymentTargetStr,
      setQuarter,
      setRegFilterCompany,
      setSaveHint,
      setSourceSnapshot,
      setYear,
    ],
  );

  const closeDetail = useCallback(() => {
    setDetailCompanyId(null);
    setDetailReadOnly(false);
    setDetailFilingSubmitted(false);
    refetch();
    refetchRegistry();
    setSearchParams(removeHajriTaxEditSearchParam);
  }, [refetch, refetchRegistry, setDetailCompanyId, setDetailFilingSubmitted, setDetailReadOnly, setSearchParams]);

  useEffect(() => {
    if (listLoading) return;
    if (searchParams.get('edit') !== '1') {
      urlOpenKeyRef.current = '';
      return;
    }
    const companyId = searchParams.get('company');
    if (!companyId || !companies?.some((company) => company.id === companyId)) return;
    const key = `${companyId}|${searchParams.get('year')}|${searchParams.get('quarter')}|1`;
    if (urlOpenKeyRef.current === key) return;
    urlOpenKeyRef.current = key;
    const year = Number(searchParams.get('year'));
    const quarter = parseQuarter(searchParams.get('quarter'));
    const forcedPeriod = Number.isFinite(year) && year >= 2000 && quarter != null ? { year, quarter } : undefined;
    void openCompanyDetail(companyId, forcedPeriod);
  }, [companies, listLoading, openCompanyDetail, searchParams, urlOpenKeyRef]);

  return { openCompanyDetail, openFromRegistryRow, handleNewDeclarationConfirm, closeDetail };
}
