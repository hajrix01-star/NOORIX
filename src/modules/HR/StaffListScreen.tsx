/** Staff list: full employee directory (active, terminated, archived). */
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useDebouncedValue } from '../../ui';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { useTranslation } from '../../i18n/useTranslation';
import { useEmployees } from '../../hooks/useEmployees';
import { useQueryClient } from '@tanstack/react-query';
import { useApiQuery } from '../../hooks/useApiQuery';
import { getSaudiToday, formatSaudiDate } from '../../utils/saudiDate';
import { exportToExcel } from '../../utils/exportUtils';
import ImportExportModal from '../../components/ImportExportModal';
import {
  EMPLOYEE_EXCEL_EXPORT_OPTS,
} from '../../utils/importTemplates';
import {
  getEmployeeCompensationSnapshots,
  getEmployeesPaged,
  getEmployeesBulk,
} from '../../services/api';
import { Badge, Button, Input, ScreenShell, FmtNum, SmartTable } from '../../ui';
import { StaffListMobileRow } from './components/StaffListMobileRow';
import { StaffListModals } from './components/StaffListModals';
import {
  buildCentralEmployeeExportRows,
  getCreatedEmployeeId,
  syncCustomAllowanceRows,
  type HrStaffSavePayload,
} from './staffListDataOps';
import { parseEmployeeNotesMeta } from './utils/employeeNotesMeta';
import { employeeDisplayName } from '../../utils/employeeDisplayName';
import { buildEmployeeHrStatusMap } from '../../constants/badgeMaps';
import { employeeKeys, hrKeys } from '../../services/queryKeys';
import { normalizeEmployeesPagedQueryInput } from '../../services/domains/apiEndpoints/hr-query';
import {
  hrFlatSmartTableShellProps,
} from './hrWorkspaceLayout';
import { HrFlatListTabShell } from './components/HrFlatListTabShell';
import { HrTabToolbar } from './components/HrTabToolbar';
import { HrSegmentedControl } from './components/HrSegmentedControl';
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

type HrStaffTableRow = HrEmployee & {
  totalSalary?: number | null;
  terminationReason?: string;
  terminationClause?: string;
  terminationDate?: string;
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
  /** After termination wizard — optional settlement invoice modal */
  const [terminationSettlementEmp, setTerminationSettlementEmp] = useState<HrEmployee | null>(null);
  const employeeViewModeItems = useMemo(
    () =>
      (
        [
          { id: 'active', fullKey: 'activeEmployeesList', shortKey: 'activeEmployeesListShort' },
          { id: 'terminated', fullKey: 'terminatedEmployeesList', shortKey: 'terminatedEmployeesListShort' },
          { id: 'archived', fullKey: 'archivedEmployeesList', shortKey: 'archivedEmployeesListShort' },
        ] as const
      ).map(({ id, fullKey, shortKey }) => {
        const full = t(fullKey);
        const short = t(shortKey);
        const label =
          short === full ? (
            full
          ) : (
            <>
              <span className="hidden sm:inline">{full}</span>
              <span className="sm:hidden">{short}</span>
            </>
          );
        return { id, label };
      }),
    [t],
  );
  const queryClient = useQueryClient();
  const { create, update, createAdvance } = useEmployees(companyId, { includeTerminated: true, fetchEnabled: false });

  const [listPage, setListPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const debouncedQ = useDebouncedValue(searchInput.trim(), 300);
  const [sortKey, setSortKey] = useState('joinDate');
  const [sortDir, setSortDir] = useState('desc');
  const [exporting, setExporting] = useState(false);
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

  const columns = useMemo(() => [
    { key: 'employeeSerial', label: t('employeeSerial'), sortable: true, width: 120,
      render: (v: unknown) => <span className="nx-cell-num nx-cell-bold nx-cell-ellipsis text-[13px]" title={String(v || '')}>{String(v || '—')}</span> },
    { key: 'name', label: t('employeeName'), sortable: true, width: 200,
      render: (_: unknown, row: HrStaffTableRow) => (
        <Button
          variant="raw"
          size="auto"
          className="nx-cell-bold text-[13px] text-noorix-blue hover:underline cursor-pointer p-0 bg-transparent text-start"
          onClick={() => navigate(`/hr/employee/${row.id}`)}
        >
          {employeeDisplayName(row, lang)}
        </Button>
      ) },
    { key: 'jobTitle', label: t('jobTitle'), sortable: true, width: 170, align: 'center',
      render: (v: unknown) => <span className="nx-cell-muted block text-center">{String(v || '—')}</span> },
    { key: 'joinDate', label: t('joinDate'), sortable: true, width: 125,
      render: (v: unknown) => <span className="nx-cell-muted-sm">{formatSaudiDate(String(v || ''))}</span> },
    { key: 'totalSalary', label: t('totalSalary'), numeric: true, sortable: true, width: 140, align: 'center',
      render: (_: unknown, row: HrStaffTableRow) => (
        Number.isFinite(Number(row.totalSalary))
          ? <FmtNum n={Number(row.totalSalary)} className="nx-cell-num block text-center text-[13px]" />
          : <span className="nx-cell-muted">—</span>
      ) },
    { key: 'status', label: t('status'), width: 110,
      render: (v: unknown) => <Badge {...Badge.fromStatus(String(v || ''), STATUS_MAP)} size="sm" /> },
    ...(viewMode === 'terminated' || viewMode === 'archived'
      ? [
          {
            key: 'terminationReason',
            label: t('terminationReason'),
            width: 190,
            render: (v: unknown) => <span className="nx-cell-muted">{String(v || '—')}</span>,
          },
          {
            key: 'terminationClause',
            label: t('terminationClause'),
            width: 140,
            render: (v: unknown) => <span className="nx-cell-muted">{String(v || '—')}</span>,
          },
        ]
      : []),
  ], [t, lang, STATUS_MAP, viewMode, navigate]);

  async function handleExportExcel() {
    if (!companyId) return;
    setExporting(true);
    try {
      const res = await getEmployeesBulk(companyId, viewMode);
      if (!res?.success) {
        showToast(res?.error || t('saveFailed'), 'error');
        return;
      }
      const list = res.data || [];
      const centralRows = await buildCentralEmployeeExportRows(companyId, list, t);
      const rows = list.map((e, index: number) => {
        const parsed = parseEmployeeNotesMeta(e.notes);
        const meta = parsed.meta || {};
        return {
          ...centralRows[index],
          [t('employeesExcelColJoinDate')]: formatSaudiDate(e.joinDate),
          [t('employeesExcelColStatus')]: (STATUS_MAP as Record<string, { label?: string }>)[String(e.status)]?.label || e.status,
          [t('employeesExcelColTerminationReason')]: meta.terminationReason || '',
          [t('employeesExcelColTerminationClause')]: meta.terminationClause || '',
          [t('employeesExcelColTerminationDate')]: meta.terminationDate ? formatSaudiDate(meta.terminationDate) : '',
        };
      });
      exportToExcel(rows, 'employees.xlsx', EMPLOYEE_EXCEL_EXPORT_OPTS);
    } catch (e: unknown) {
      showToast(getErrorMessage(e, t('saveFailed')), 'error');
    } finally {
      setExporting(false);
    }
  }

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
    <HrTabToolbar
      leading={(
        <HrSegmentedControl
          tone="filter"
          className="nx-hr-view-modes w-full min-w-0"
          items={employeeViewModeItems}
          value={viewMode}
          onChange={handleViewModeChange}
        />
      )}
      desktopActions={(
        <Button
          size="sm"
          className="hidden lg:inline-flex shrink-0 whitespace-nowrap"
          icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>}
          onClick={() => setShowImportExport(true)}
        >
          {t('importExportLabel')}
        </Button>
      )}
      menuItems={[
        {
          key: 'import',
          label: t('importExportLabel'),
          onClick: () => setShowImportExport(true),
        },
      ]}
      primaryAction={{
        label: t('addEmployee'),
        onClick: () => {
          setEditingEmployee(null);
          setShowForm(true);
        },
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
          <ImportExportModal
            isOpen={showImportExport}
            onClose={() => setShowImportExport(false)}
            entityType="employees"
            companyId={companyId}
            exportFetcher={async () => {
              const res = await getEmployeesBulk(companyId, 'active');
              if (!res?.success) {
                throw new Error(res?.error || t('saveFailed'));
              }
              const list = res.data || [];
              return buildCentralEmployeeExportRows(companyId, list, t);
            }}
            onImportSuccess={(count: number) => {
              queryClient.invalidateQueries({ queryKey: employeeKeys.root() });
              queryClient.invalidateQueries({ queryKey: employeeKeys.pagedByCompany(companyId) });
              showToast(t('employeesImportSuccessCount', String(count)), 'success');
            }}
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
