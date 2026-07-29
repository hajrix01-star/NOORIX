/** Staff list: full employee directory (active, terminated, archived). */
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useDebouncedValue } from '../../ui';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { useTranslation } from '../../i18n/useTranslation';
import { useEmployees } from '../../hooks/useEmployees';
import { keepPreviousData, useQueryClient } from '@tanstack/react-query';
import { useApiQuery } from '../../hooks/useApiQuery';
import { getSaudiToday } from '../../utils/saudiDate';
import {
  getEmployeeCompensationSnapshots,
  getEmployeesPaged,
} from '../../services/api';
import { Input, ScreenShell, SmartTable } from '../../ui';
import { StaffListMobileRow } from './components/StaffListMobileRow';
import { StaffListModals } from './components/StaffListModals';
import { buildStaffListColumns, type HrStaffTableRow } from './staffListColumns';
import {
  getCreatedEmployeeId,
  syncCustomAllowanceRows,
  type HrStaffSavePayload,
} from './staffListDataOps';
import { parseEmployeeNotesMeta } from './utils/employeeNotesMeta';
import { buildEmployeeHrStatusMap } from '../../constants/badgeMaps';
import { hrKeys } from '../../services/queryKeys';
import { normalizeEmployeesPagedQueryInput } from '../../services/domains/apiEndpoints/hr-query';
import {
  hrFlatSmartTableShellProps,
} from './hrWorkspaceLayout';
import { buildStaffEmployeeViewModeItems } from './staffListViewModel';
import { HrFlatListTabShell } from './components/HrFlatListTabShell';
import { StaffListImportExportModal } from './components/StaffListImportExportModal';
import { StaffListToolbar } from './components/StaffListToolbar';
import type {
  ApiParsedResult,
  HrCompensationSnapshot,
  HrCompensationSnapshotsResult,
  HrEmployee,
  HrEmployeeTab,
} from '../../types/api';

const PAGE_SIZE = 50;

type StaffListScreenProps = {
  embedded?: boolean;
};

type HrCompanyRef = {
  id?: string | null;
  name?: string | null;
  nameAr?: string | null;
  nameEn?: string | null;
};

type HrEmployeesPagedView = {
  items: HrEmployee[];
  total: number;
  page: number;
  pageSize: number;
};

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export default function StaffListScreen({ embedded }: StaffListScreenProps) {
  const navigate = useNavigate();
  const { activeCompanyId, companies } = useApp();
  const activeCompany = (companies as HrCompanyRef[] | undefined)?.find((c) => c.id === activeCompanyId);
  const companyNameAr = activeCompany?.nameAr || activeCompany?.name || '';
  const { t, lang } = useTranslation();
  const companyId = activeCompanyId ?? '';
  const { showToast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<HrEmployee | null>(null);
  const [advanceEmployee, setAdvanceEmployee] = useState<HrEmployee | null>(null);
  const [terminatingEmployee, setTerminatingEmployee] = useState<HrEmployee | null>(null);
  const [viewMode, setViewMode] = useState<HrEmployeeTab>('active');
  const [terminationForm, setTerminationForm] = useState({
    reason: '',
    clause: '',
    date: getSaudiToday(),
  });
  const [showImportExport, setShowImportExport] = useState(false);
  const [terminationSettlementEmp, setTerminationSettlementEmp] = useState<HrEmployee | null>(null);
  const employeeViewModeItems = useMemo(
    () => buildStaffEmployeeViewModeItems(t),
    [t],
  );
  const queryClient = useQueryClient();
  const { create, update, createAdvance } = useEmployees(companyId, { includeTerminated: true, fetchEnabled: false });

  const [listPage, setListPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const debouncedQ = useDebouncedValue(searchInput.trim(), 300);
  const [sortKey, setSortKey] = useState('joinDate');
  const [sortDir, setSortDir] = useState('desc');
  const employeesPagedQuery = useMemo(
    () =>
      normalizeEmployeesPagedQueryInput({
        companyId,
        tab: viewMode,
        page: listPage,
        pageSize: PAGE_SIZE,
        q: debouncedQ,
        sortBy: sortKey,
        sortDir,
      }),
    [companyId, debouncedQ, listPage, sortDir, sortKey, viewMode],
  );

  useEffect(() => {
    setListPage(1);
  }, [viewMode, debouncedQ]);

  const {
    data: pagedResult,
    isLoading,
    error: employeesError,
  } = useApiQuery<HrEmployeesPagedView>({
    queryKey: hrKeys.employeesPaged(employeesPagedQuery),
    queryFn: async () => {
      const res = await getEmployeesPaged(companyId, {
        tab: employeesPagedQuery.tab,
        page: employeesPagedQuery.page,
        pageSize: employeesPagedQuery.pageSize,
        q: employeesPagedQuery.q,
        sortBy: employeesPagedQuery.sortBy,
        sortDir: employeesPagedQuery.sortDir,
      });
      if (!res.success) return res;
      return {
        success: true,
        data: {
          items: res.items ?? [],
          total: res.total ?? 0,
          page: res.page ?? employeesPagedQuery.page,
          pageSize: res.pageSize ?? employeesPagedQuery.pageSize,
        },
      };
    },
    enabled: !!companyId,
    placeholderData: (previousData, previousQuery) => {
      const previousCompanyId = previousQuery?.queryKey?.[1];
      if (previousCompanyId !== companyId) return undefined;
      return previousData;
    },
    fallbackMessage: t('employeesLoadFailed'),
  });

  const listTotal = pagedResult?.total ?? 0;
  const pagedItems = pagedResult?.items ?? [];
  const pagedEmployeeIds = useMemo(() => pagedItems.map((row) => row.id).filter(Boolean), [pagedItems]);

  const {
    data: compensationSnapshots,
    isLoading: compensationSnapshotsLoading,
    error: compensationSnapshotsError,
  } = useApiQuery<HrCompensationSnapshotsResult>({
    queryKey: hrKeys.compensationSnapshots(companyId, pagedEmployeeIds),
    queryFn: () => getEmployeeCompensationSnapshots(companyId, pagedEmployeeIds),
    enabled: !!companyId && pagedEmployeeIds.length > 0,
    placeholderData: keepPreviousData,
    fallbackMessage: t('employeesLoadFailed'),
  });

  const STATUS_MAP = useMemo(() => buildEmployeeHrStatusMap(t), [t]);

  const snapshotByEmployeeId = useMemo(() => {
    const map = new Map<string, HrCompensationSnapshot>();
    for (const snapshot of compensationSnapshots?.items ?? []) {
      if (snapshot?.employeeId) map.set(snapshot.employeeId, snapshot);
    }
    return map;
  }, [compensationSnapshots]);

  const tableData = useMemo(() => {
    return pagedItems.map((e) => {
      const parsed = parseEmployeeNotesMeta(e.notes);
      const meta = parsed.meta || {};
      const salarySnapshot = snapshotByEmployeeId.get(e.id);
      return {
        ...e,
        totalSalary: salarySnapshot?.salaryPackage?.total ?? null,
        terminationReason: meta.terminationReason || '',
        terminationClause: meta.terminationClause || '',
        terminationDate: meta.terminationDate || '',
      };
    });
  }, [pagedItems, snapshotByEmployeeId]);

  const toggleSort = useCallback((key: string) => {
    setSortKey((prev) => {
      if (prev === key) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        return key;
      }
      setSortDir('asc');
      return key;
    });
    setListPage(1);
  }, []);

  const columns = useMemo(
    () => buildStaffListColumns({ t, lang, statusMap: STATUS_MAP, viewMode, navigate }),
    [t, lang, STATUS_MAP, viewMode, navigate],
  );

  function handleSave(payload: HrStaffSavePayload | Record<string, unknown>) {
    const { employeeBody, customAllowances: customRows = [] } = payload?.employeeBody
      ? payload as HrStaffSavePayload
      : { employeeBody: payload, customAllowances: [] };
    if (!companyId) {
      showToast(t('pleaseSelectCompany'), 'error');
      return;
    }
    if (editingEmployee) {
      update.mutate(
        { id: editingEmployee.id, body: employeeBody },
        {
          onSuccess: async () => {
            try {
              await syncCustomAllowanceRows({ companyId, employeeId: editingEmployee.id, desiredRows: customRows, queryClient, t });
              showToast(t('employeeUpdated'), 'success');
              setEditingEmployee(null);
            } catch (e: unknown) {
              showToast(getErrorMessage(e, t('saveFailed')), 'error');
            }
          },
          onError: (e: unknown) => showToast(getErrorMessage(e, t('updateFailed')), 'error'),
        },
      );
    } else {
      create.mutate(employeeBody, {
        onSuccess: async (res: ApiParsedResult<HrEmployee> | HrEmployee) => {
          try {
            const employeeId = getCreatedEmployeeId(res);
            await syncCustomAllowanceRows({ companyId, employeeId, desiredRows: customRows, queryClient, t });
            showToast(t('employeeAdded'), 'success');
            setShowForm(false);
          } catch (e: unknown) {
            showToast(getErrorMessage(e, t('saveFailed')), 'error');
          }
        },
        onError: (e: unknown) => showToast(getErrorMessage(e, t('addFailed')), 'error'),
      });
    }
  }

  const renderStaffMobileRow = useCallback((row: HrStaffTableRow) => {
    return (
      <StaffListMobileRow
        row={row}
        lang={lang}
        statusMap={STATUS_MAP}
      />
    );
  }, [STATUS_MAP, lang]);

  const renderCompactRow = useCallback((row: HrStaffTableRow) => renderStaffMobileRow(row), [renderStaffMobileRow]);

  const flatTableProps = hrFlatSmartTableShellProps(embedded);
  const handleViewModeChange = useCallback((id: string) => {
    if (id === 'active' || id === 'terminated' || id === 'archived') {
      setViewMode(id);
    }
  }, []);

  const staffToolbar = (
    <StaffListToolbar
      t={t}
      items={employeeViewModeItems}
      viewMode={viewMode}
      onViewModeChange={handleViewModeChange}
      onOpenImportExport={() => setShowImportExport(true)}
      onAddEmployee={() => {
        setEditingEmployee(null);
        setShowForm(true);
      }}
    />
  );

  const staffControls = (
    <>
      {!embedded && (
        <div>
          <h1 className="text-[20px] font-bold text-noorix-text m-0">{t('staffTitle')}</h1>
          <p className="text-[13px] text-noorix-muted m-0">{t('staffDesc')}</p>
        </div>
      )}
      {!companyId && (
        <div className="noorix-surface-card nx-empty-state">
          {t('pleaseSelectCompany')}
        </div>
      )}
      {companyId && (
        <>
          <StaffListImportExportModal
            isOpen={showImportExport}
            companyId={companyId}
            t={t}
            queryClient={queryClient}
            showToast={showToast}
            onClose={() => setShowImportExport(false)}
          />
          {staffToolbar}
          {embedded ? (
            <Input
              type="search"
              value={searchInput}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchInput(e.target.value)}
              placeholder={t('searchPlaceholder')}
              size="sm"
              className="w-full min-w-0"
              aria-label={t('searchPlaceholder')}
            />
          ) : null}
        </>
      )}
    </>
  );

  const staffList = companyId ? (
    <SmartTable
      compact
      showRowNumbers
      tableMinWidth={960}
      {...flatTableProps}
      columns={columns}
      data={tableData}
      total={listTotal}
      page={listPage}
      pageSize={PAGE_SIZE}
      onPageChange={setListPage}
      title={embedded ? undefined : t('employeesList')}
      badge={embedded ? undefined : <span className="nx-pill nx-pill--blue nx-pill--sm">{listTotal}</span>}
      searchValue={searchInput}
      onSearchChange={setSearchInput}
      showSearchInHeader={!embedded}
      sortKey={sortKey}
      sortDir={sortDir}
      onSort={toggleSort}
      emptyMessage={t('noEmployees')}
      renderCompactRow={renderCompactRow}
      stripeMobileCards
      isLoading={isLoading || compensationSnapshotsLoading}
      isError={!!employeesError || !!compensationSnapshotsError}
      errorMessage={employeesError?.message || compensationSnapshotsError?.message || t('employeesLoadFailed')}
    />
  ) : null;

  const staffModals = (
    <StaffListModals
      t={t}
      companyId={companyId}
      companyName={companyNameAr}
      showForm={showForm}
      setShowForm={setShowForm}
      editingEmployee={editingEmployee}
      setEditingEmployee={setEditingEmployee}
      advanceEmployee={advanceEmployee}
      setAdvanceEmployee={setAdvanceEmployee}
      terminatingEmployee={terminatingEmployee}
      setTerminatingEmployee={setTerminatingEmployee}
      terminationSettlementEmp={terminationSettlementEmp}
      setTerminationSettlementEmp={setTerminationSettlementEmp}
      terminationForm={terminationForm}
      setTerminationForm={setTerminationForm}
      handleSave={handleSave}
      create={create}
      update={update}
      createAdvance={createAdvance}
      queryClient={queryClient}
      showToast={showToast}
    />
  );

  const shell = (
    <HrFlatListTabShell embedded={embedded} controls={staffControls} list={staffList}>
      {staffModals}
    </HrFlatListTabShell>
  );

  return embedded ? shell : <ScreenShell variant="data">{shell}</ScreenShell>;
}
