/** Staff list: full employee directory (active, terminated, archived). */
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { useTranslation } from '../../i18n/useTranslation';
import { useEmployees } from '../../hooks/useEmployees';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useApiMutation } from '../../hooks/useApiMutation';
import { invalidateOnFinancialMutation } from '../../utils/queryInvalidation';
import { getSaudiToday, formatSaudiDate } from '../../utils/saudiDate';
import { exportToExcel } from '../../utils/exportUtils';
import ImportExportModal from '../../components/ImportExportModal';
import {
  EMPLOYEE_EXCEL_MONEY_COLUMN_KEYS,
  EMPLOYEE_EXCEL_EXPORT_OPTS,
  formatEmployeeForExport,
} from '../../utils/importTemplates';
import {
  createCustomAllowance,
  deleteCustomAllowance,
  deleteEmployee,
  getCustomAllowances,
  getEmployeeCompensationSnapshots,
  getEmployeesPaged,
  getEmployeesBulk,
  throwIfApiFailed,
} from '../../services/api';
import { Badge, Button, Input, ScreenShell, FmtNum, SmartTable } from '../../ui';
import { HRActionsCell } from './components/HRActionsCell';
import { StaffListMobileRow } from './components/StaffListMobileRow';
import { StaffListModals } from './components/StaffListModals';
import { composeEmployeeNotes, parseEmployeeNotesMeta } from './utils/employeeNotesMeta';
import { moneyAmountsEqual, roundMoney2 } from '../../utils/moneyInput';
import { employeeDisplayName } from '../../utils/employeeDisplayName';
import { buildEmployeeHrStatusMap } from '../../constants/badgeMaps';
import { employeeKeys, hrKeys } from '../../services/queryKeys';
import {
  hrFlatSmartTableShellProps,
} from './hrWorkspaceLayout';
import { HrFlatListTabShell } from './components/HrFlatListTabShell';
import { HrTabToolbar } from './components/HrTabToolbar';
import { HrSegmentedControl } from './components/HrSegmentedControl';

const PAGE_SIZE = 50;

export default function StaffListScreen({ embedded }: any) {
  const navigate = useNavigate();
  const { activeCompanyId, companies, userPermissions } = useApp();
  const activeCompany = companies?.find((c: any) => c.id === activeCompanyId);
  const companyNameAr = activeCompany?.nameAr || activeCompany?.name || '';
  const { t, lang } = useTranslation();
  const companyId = activeCompanyId ?? '';
  const { showToast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<any>(null);
  const [advanceEmployee, setAdvanceEmployee] = useState<any>(null);
  const [terminatingEmployee, setTerminatingEmployee] = useState<any>(null);
  const [viewMode, setViewMode] = useState('active');
  const [terminationForm, setTerminationForm] = useState({
    reason: '',
    clause: '',
    date: getSaudiToday(),
  });
  const [showImportExport, setShowImportExport] = useState(false);
  /** After termination wizard — optional settlement invoice modal */
  const [terminationSettlementEmp, setTerminationSettlementEmp] = useState<any>(null);
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
  const canDeleteEmployee = Array.isArray(userPermissions) && userPermissions.includes('EMPLOYEES_DELETE');

  const permanentDeleteEmployeeMut = useApiMutation({
    mutationFn: ({ id }: any) => deleteEmployee(id, companyId),
    successToast: () => t('employeeDeletedPermanent'),
    errorToast: (e: any) => e?.message || t('updateFailed'),
    onSuccess: (_data: any, variables: any) => {
      const id = variables.id;
      queryClient.invalidateQueries({ queryKey: employeeKeys.root() });
      queryClient.invalidateQueries({ queryKey: employeeKeys.pagedByCompany(companyId) });
      queryClient.invalidateQueries({ queryKey: employeeKeys.detail(id, companyId) });
      invalidateOnFinancialMutation(queryClient);
    },
  });

  const { create, update, createAdvance } = useEmployees(companyId, { includeTerminated: true, fetchEnabled: false });

  const [listPage, setListPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const debouncedQ = useDebouncedValue(searchInput.trim(), 300);
  const [sortKey, setSortKey] = useState('joinDate');
  const [sortDir, setSortDir] = useState('desc');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    setListPage(1);
  }, [viewMode, debouncedQ]);

  const {
    data: pagedResult,
    isLoading,
    error: employeesError,
  } = useQuery({
    queryKey: hrKeys.employeesPaged(companyId, viewMode, listPage, PAGE_SIZE, debouncedQ, sortKey, sortDir),
    queryFn: async () => {
      const res = await getEmployeesPaged(companyId, {
        tab: viewMode,
        page: listPage,
        pageSize: PAGE_SIZE,
        q: debouncedQ,
        sortBy: sortKey,
        sortDir,
      });
      throwIfApiFailed(res, t('employeesLoadFailed'));
      return res;
    },
    enabled: !!companyId,
  });

  const listTotal = pagedResult?.total ?? 0;
  const pagedItems = pagedResult?.items ?? [];
  const pagedEmployeeIds = useMemo(() => pagedItems.map((row: any) => row.id).filter(Boolean), [pagedItems]);

  const {
    data: compensationSnapshots,
    isLoading: compensationSnapshotsLoading,
    error: compensationSnapshotsError,
  } = useQuery({
    queryKey: hrKeys.compensationSnapshots(companyId, pagedEmployeeIds),
    queryFn: async () => {
      const res = await getEmployeeCompensationSnapshots(companyId, pagedEmployeeIds);
      throwIfApiFailed(res, t('employeesLoadFailed'));
      return res.data;
    },
    enabled: !!companyId && pagedEmployeeIds.length > 0,
  });

  const STATUS_MAP = useMemo(() => buildEmployeeHrStatusMap(t), [t]);

  const snapshotByEmployeeId = useMemo(() => {
    const map = new Map();
    for (const snapshot of compensationSnapshots?.items ?? []) {
      if (snapshot?.employeeId) map.set(snapshot.employeeId, snapshot);
    }
    return map;
  }, [compensationSnapshots]);

  async function buildCentralEmployeeExportRows(list: any[]) {
    const ids = list.map((row: any) => row.id).filter(Boolean);
    const res = await getEmployeeCompensationSnapshots(companyId, ids);
    throwIfApiFailed(res, t('employeesLoadFailed'));
    const snapshotMap = new Map((res.data?.items ?? []).map((snapshot: any) => [snapshot.employeeId, snapshot]));
    const allowanceTotals = new Map<string, number>(
      (res.data?.items ?? []).map((snapshot: any) => {
        const customAllowanceTotal = Number(snapshot?.salaryPackage?.customAllowanceTotal);
        if (!Number.isFinite(customAllowanceTotal)) {
          throw new Error(t('employeesLoadFailed'));
        }
        return [snapshot.employeeId, customAllowanceTotal];
      }),
    );
    const customColumn = EMPLOYEE_EXCEL_MONEY_COLUMN_KEYS[4];
    const overtimeColumn = EMPLOYEE_EXCEL_MONEY_COLUMN_KEYS[5];
    const totalColumn = EMPLOYEE_EXCEL_MONEY_COLUMN_KEYS[6];

    return list.map((employee: any) => {
      const snapshot = snapshotMap.get(employee.id) as any;
      if (!snapshot?.salaryPackage) {
        throw new Error(t('employeesLoadFailed'));
      }
      return {
        ...formatEmployeeForExport(employee, allowanceTotals),
        [customColumn]: snapshot.salaryPackage.customAllowanceTotal,
        [overtimeColumn]: snapshot.salaryPackage.overtimePay,
        [totalColumn]: snapshot.salaryPackage.total,
      };
    });
  }

  const tableData = useMemo(() => {
    return pagedItems.map((e: any) => {
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

  const toggleSort = useCallback((key: any) => {
    setSortKey((prev: any) => {
      if (prev === key) {
        setSortDir((d: any) => (d === 'asc' ? 'desc' : 'asc'));
        return key;
      }
      setSortDir('asc');
      return key;
    });
    setListPage(1);
  }, []);

  const handlePermanentDelete = useCallback((row: any) => {
    if (!companyId || !row?.id) return;
    if (!window.confirm(t('deleteEmployeePermanentConfirm', employeeDisplayName(row, lang, '')))) return;
    if (!window.confirm(t('deleteEmployeePermanentSecond'))) return;
    permanentDeleteEmployeeMut.mutate({ id: row.id });
  }, [companyId, t, lang, permanentDeleteEmployeeMut]);

  const columns = useMemo(() => [
    { key: 'employeeSerial', label: t('employeeSerial'), sortable: true, width: 120,
      render: (v: any) => <span className="nx-cell-num nx-cell-bold nx-cell-ellipsis text-[13px]" title={v || ''}>{v || '—'}</span> },
    { key: 'name', label: t('employeeName'), sortable: true, width: 200,
      render: (_: any, row: any) => (
        <Button
          variant="raw"
          size="auto"
          className="nx-cell-bold text-[13px] text-noorix-blue hover:underline cursor-pointer p-0 bg-transparent text-start"
          onClick={() => navigate(`/hr/employee/${row.id}`)}
        >
          {employeeDisplayName(row, lang)}
        </Button>
      ) },
    { key: 'jobTitle', label: t('jobTitle'), sortable: true, width: 170,
      render: (v: any) => <span className="nx-cell-muted">{v || '—'}</span> },
    { key: 'joinDate', label: t('joinDate'), sortable: true, width: 125,
      render: (v: any) => <span className="nx-cell-muted-sm">{formatSaudiDate(v)}</span> },
    { key: 'totalSalary', label: t('totalSalary'), numeric: true, sortable: true, width: 140,
      render: (_: any, row: any) => (
        Number.isFinite(Number(row.totalSalary))
          ? <FmtNum n={Number(row.totalSalary)} className="nx-cell-num text-[13px]" />
          : <span className="nx-cell-muted">—</span>
      ) },
    { key: 'status', label: t('status'), width: 110,
      render: (v: any) => <Badge {...Badge.fromStatus(v, STATUS_MAP)} size="sm" /> },
    ...(viewMode === 'terminated' || viewMode === 'archived'
      ? [
          {
            key: 'terminationReason',
            label: t('terminationReason'),
            width: 190,
            render: (v: any) => <span className="nx-cell-muted">{v || '—'}</span>,
          },
          {
            key: 'terminationClause',
            label: t('terminationClause'),
            width: 140,
            render: (v: any) => <span className="nx-cell-muted">{v || '—'}</span>,
          },
        ]
      : []),
    { key: 'actions', label: t('actions'), width: 60, align: 'center',
      render: (_: any, row: any) => (
        <HRActionsCell
          row={row}
          onEdit={() => setEditingEmployee(row)}
          onAdvance={row.status === 'active' ? () => setAdvanceEmployee(row) : undefined}
          onTerminate={row.status !== 'terminated' && row.status !== 'archived'
            ? () => {
                setTerminationForm({ reason: '', clause: '', date: getSaudiToday() });
                setTerminatingEmployee(row);
              }
            : undefined}
          onArchive={row.status !== 'archived'
            ? () => {
                const parsed = parseEmployeeNotesMeta(row.notes);
                update.mutate(
                  {
                    id: row.id,
                    body: { status: 'archived', notes: composeEmployeeNotes(parsed.notesText, parsed.meta) },
                  },
                  {
                    onSuccess: () => showToast(t('employeeArchived'), 'success'),
                    onError: (e: any) => showToast(e?.message || t('updateFailed'), 'error'),
                  },
                );
              }
            : undefined}
          onRestore={row.status === 'archived'
            ? () => {
                const parsed = parseEmployeeNotesMeta(row.notes);
                update.mutate(
                  {
                    id: row.id,
                    body: { status: 'active', notes: composeEmployeeNotes(parsed.notesText, parsed.meta) },
                  },
                  {
                    onSuccess: () => showToast(t('employeeRestored'), 'success'),
                    onError: (e: any) => showToast(e?.message || t('updateFailed'), 'error'),
                  },
                );
              }
            : undefined}
          onPermanentDelete={canDeleteEmployee ? handlePermanentDelete : undefined}
        />
      ) },
  ], [t, lang, STATUS_MAP, viewMode, navigate, update, canDeleteEmployee, handlePermanentDelete, showToast]);

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
      const centralRows = await buildCentralEmployeeExportRows(list);
      const rows = list.map((e: any, index: number) => {
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
    } catch (e: any) {
      showToast(e?.message || t('saveFailed'), 'error');
    } finally {
      setExporting(false);
    }
  }

  async function syncCustomAllowanceRows(
    employeeId: string,
    desiredRows: Array<{ id?: string; nameAr: string; amount: unknown }> = [],
  ) {
    if (!companyId || !employeeId) {
      throw new Error(t('customAllowanceMissingEmployeeId'));
    }
    const res = await getCustomAllowances(companyId, employeeId);
    throwIfApiFailed(res, t('loadingError'));
    const currentRows = Array.isArray(res?.data) ? res.data : (res?.data?.items ?? []);
    const currentById = new Map(currentRows.map((row: any) => [row.id, row]));
    const desiredIds = new Set(desiredRows.filter((row: any) => row.id).map((row: any) => row.id));

    for (const currentRow of currentRows) {
      const desiredRow = desiredRows.find((row: any) => row.id === currentRow.id);
      const changed = desiredRow
        && (desiredRow.nameAr !== currentRow.nameAr || !moneyAmountsEqual(desiredRow.amount, currentRow.amount));
      if (!desiredIds.has(currentRow.id) || changed) {
        const delRes = await deleteCustomAllowance(currentRow.id, companyId);
        throwIfApiFailed(delRes, t('deleteFailed'));
      }
    }

    for (const row of desiredRows) {
      const dr = row as { id?: string; nameAr: string; amount: unknown };
      const existing = dr.id ? currentById.get(dr.id) as { nameAr?: string; amount?: unknown } | undefined : null;
      const changed = existing
        && (dr.nameAr !== existing.nameAr || !moneyAmountsEqual(dr.amount, existing.amount));
      if (!dr.id || changed) {
        const createRes = await createCustomAllowance({
          companyId,
          employeeId,
          nameAr: dr.nameAr,
          amount: roundMoney2(dr.amount),
        });
        throwIfApiFailed(createRes, t('saveFailed'));
      }
    }

    queryClient.invalidateQueries({ queryKey: hrKeys.customAllowancesByCompany(companyId) });
    queryClient.invalidateQueries({ queryKey: employeeKeys.byCompany(companyId) });
    queryClient.invalidateQueries({ queryKey: employeeKeys.pagedByCompany(companyId) });
  }

  function handleSave(payload: any) {
    const { employeeBody, customAllowances: customRows = [] } = payload?.employeeBody
      ? payload
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
              await syncCustomAllowanceRows(editingEmployee.id, customRows);
              showToast(t('employeeUpdated'), 'success');
              setEditingEmployee(null);
            } catch (e: any) {
              showToast(e?.message || t('saveFailed'), 'error');
            }
          },
          onError: (e: any) => showToast(e?.message || t('updateFailed'), 'error'),
        },
      );
    } else {
      create.mutate(employeeBody, {
        onSuccess: async (res: any) => {
          try {
            const employeeId = res?.data?.id || res?.id;
            await syncCustomAllowanceRows(employeeId, customRows);
            showToast(t('employeeAdded'), 'success');
            setShowForm(false);
          } catch (e: any) {
            showToast(e?.message || t('saveFailed'), 'error');
          }
        },
        onError: (e: any) => showToast(e?.message || t('addFailed'), 'error'),
      });
    }
  }

  const renderStaffRowMenuItems = useCallback((row: any) => [
    {
      key: 'profile',
      label: t('viewProfile'),
      onClick: () => navigate(`/hr/employee/${row.id}`),
    },
    {
      key: 'edit',
      label: t('edit'),
      style: { color: 'var(--noorix-accent-green)' },
      onClick: () => setEditingEmployee(row),
    },
    ...(row.status === 'active' ? [{
      key: 'advance',
      label: t('advance'),
      style: { color: 'var(--noorix-accent-blue)' },
      onClick: () => setAdvanceEmployee(row),
    }] : []),
    ...(row.status !== 'terminated' && row.status !== 'archived' ? [{
      key: 'terminate',
      label: t('terminate'),
      style: { color: 'var(--noorix-accent-amber)' },
      onClick: () => {
        setTerminationForm({ reason: '', clause: '', date: getSaudiToday() });
        setTerminatingEmployee(row);
      },
    }] : []),
    ...(canDeleteEmployee ? [{
      key: 'delete',
      label: t('permanentDelete'),
      style: { color: 'var(--noorix-accent-red)' },
      onClick: () => handlePermanentDelete(row),
    }] : []),
  ], [t, navigate, canDeleteEmployee, handlePermanentDelete,
      setEditingEmployee, setAdvanceEmployee, setTerminatingEmployee, setTerminationForm]);

  const renderStaffMobileRow = useCallback((row: any) => {
    return (
      <StaffListMobileRow
        row={row}
        lang={lang}
        t={t}
        statusMap={STATUS_MAP}
        renderMenuItems={renderStaffRowMenuItems}
      />
    );
  }, [STATUS_MAP, t, lang, renderStaffRowMenuItems]);

  const renderCompactRow = useCallback((row: any) => renderStaffMobileRow(row), [renderStaffMobileRow]);

  const flatTableProps = hrFlatSmartTableShellProps(embedded);

  const staffToolbar = (
    <HrTabToolbar
      leading={(
        <HrSegmentedControl
          tone="filter"
          className="nx-hr-view-modes w-full min-w-0"
          items={employeeViewModeItems}
          value={viewMode}
          onChange={setViewMode}
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
              return buildCentralEmployeeExportRows(list);
            }}
            onImportSuccess={(count: any) => {
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
              onChange={(e: any) => setSearchInput(e.target.value)}
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

  return embedded ? shell : <ScreenShell>{shell}</ScreenShell>;
}
