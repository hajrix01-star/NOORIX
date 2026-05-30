/** Staff list: full employee directory (active, terminated, archived). */
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { useTranslation } from '../../i18n/useTranslation';
import { useEmployees } from '../../hooks/useEmployees';
import { useCustomAllowances } from '../../hooks/useCustomAllowances';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useApiMutation } from '../../hooks/useApiMutation';
import { invalidateOnFinancialMutation } from '../../utils/queryInvalidation';
import { rejectIfApiFailed } from '../../utils/apiResponse';
import { getSaudiToday, formatSaudiDate } from '../../utils/saudiDate';
import { exportToExcel } from '../../utils/exportUtils';
import ImportExportModal from '../../components/ImportExportModal';
import {
  buildEmployeeAllowanceTotalsMap,
  EMPLOYEE_EXCEL_EXPORT_OPTS,
  formatEmployeeForExport,
} from '../../utils/importTemplates';
import {
  createCustomAllowance,
  deleteCustomAllowance,
  deleteEmployee,
  getCustomAllowances,
  getEmployeesPaged,
  getEmployeesBulk,
  throwIfApiFailed,
} from '../../services/api';
import { Badge, Button, Input, Modal, ScreenShell, cn, FmtNum, KebabMenu, SmartTable } from '../../ui';
import { HRActionsCell } from './components/HRActionsCell';
import { StaffFormModal } from './components/StaffFormModal';
import { AdvanceQuickModal } from './components/AdvanceQuickModal';
import TerminationSettlementModal from './components/TerminationSettlementModal';
import { composeEmployeeNotes, parseEmployeeNotesMeta } from './utils/employeeNotesMeta';
import { moneyAmountsEqual, roundMoney2 } from '../../utils/moneyInput';
import { totalSalary } from './utils/employeeSalaryMath';
import { employeeDisplayName } from '../../utils/employeeDisplayName';
import { buildEmployeeHrStatusMap } from '../../constants/badgeMaps';
import { employeeKeys, hrKeys } from '../../services/queryKeys';
import {
  HR_EMBEDDED_SHELL_CLASS,
  HR_STAFF_CONTROLS_CLASS,
  HR_STAFF_LIST_CLASS,
  HR_WORKSPACE_TABLE_CLASS,
} from './hrWorkspaceLayout';
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
  const terminationReasonOptions = [
    t('terminationReasonOptionArt80'),
    t('terminationReasonOptionArt77'),
    t('terminationReasonOptionContractEnd'),
    t('terminationReasonOptionResignation'),
    t('terminationReasonOptionAbsence'),
  ];

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
  const { allowances: customAllowances = [] } = useCustomAllowances(companyId);

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

  const STATUS_MAP = useMemo(() => buildEmployeeHrStatusMap(t), [t]);

  const allowanceTotals = useMemo(() => {
    const map = new Map();
    for (const row of customAllowances) {
      const employeeId = row.employeeId;
      if (!employeeId) continue;
      const next = (map.get(employeeId) || 0) + (Number(row.amount) || 0);
      map.set(employeeId, roundMoney2(next));
    }
    return map;
  }, [customAllowances]);

  const tableData = useMemo(() => {
    return pagedItems.map((e: any) => {
      const parsed = parseEmployeeNotesMeta(e.notes);
      const meta = parsed.meta || {};
      return {
        ...e,
        totalSalary: totalSalary(e, allowanceTotals.get(e.id) || 0),
        terminationReason: meta.terminationReason || '',
        terminationClause: meta.terminationClause || '',
        terminationDate: meta.terminationDate || '',
      };
    });
  }, [pagedItems, allowanceTotals]);

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
      render: (_: any, row: any) => <FmtNum n={row.totalSalary} className="nx-cell-num text-[13px]" /> },
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
      const rows = (res.data || []).map((e: any) => {
        const parsed = parseEmployeeNotesMeta(e.notes);
        const meta = parsed.meta || {};
        return {
          ...formatEmployeeForExport(e, allowanceTotals),
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
    rejectIfApiFailed(res, t('loadingError'));
    const currentRows = Array.isArray(res?.data) ? res.data : (res?.data?.items ?? []);
    const currentById = new Map(currentRows.map((row: any) => [row.id, row]));
    const desiredIds = new Set(desiredRows.filter((row: any) => row.id).map((row: any) => row.id));

    for (const currentRow of currentRows) {
      const desiredRow = desiredRows.find((row: any) => row.id === currentRow.id);
      const changed = desiredRow
        && (desiredRow.nameAr !== currentRow.nameAr || !moneyAmountsEqual(desiredRow.amount, currentRow.amount));
      if (!desiredIds.has(currentRow.id) || changed) {
        const delRes = await deleteCustomAllowance(currentRow.id, companyId);
        rejectIfApiFailed(delRes, t('deleteFailed'));
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
        rejectIfApiFailed(createRes, t('saveFailed'));
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
    const displayName = employeeDisplayName(row, lang);
    return (
      <div
        className={cn(
          'nx-hr-staff-row__inner flex min-w-0 items-start justify-between gap-3',
          embedded && 'py-3',
        )}
        onClick={() => navigate(`/hr/employee/${row.id}`)}
        style={{ cursor: 'pointer' }}
      >
        <div className="flex min-w-0 flex-col gap-0.5">
          <span
            className="font-bold text-[14px] text-noorix-blue truncate"
            title={displayName}
          >
            {displayName}
          </span>
          <span className="text-[11px] text-noorix-muted">
            {formatSaudiDate(row.joinDate)}
          </span>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1 min-w-0">
          <div className="flex max-w-full flex-wrap items-center justify-end gap-1.5">
            {row.jobTitle && (
              <span className="max-w-[11rem] truncate text-[12px] text-noorix-muted sm:max-w-[9.5rem]" title={row.jobTitle}>
                {row.jobTitle}
              </span>
            )}
            <Badge {...Badge.fromStatus(row.status, STATUS_MAP)} size="sm" />
          </div>
          <div className="flex items-center gap-2">
            <span className="nx-cr__amount text-noorix-green">
              <FmtNum n={row.totalSalary} /> <span className="nx-sar">SR</span>
            </span>
            <div className="nx-cr__kebab" onClick={(e) => e.stopPropagation()}>
              <KebabMenu
                ariaLabel={t('actions')}
                items={renderStaffRowMenuItems(row)}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }, [STATUS_MAP, t, lang, navigate, renderStaffRowMenuItems, embedded]);

  const renderCompactRow = useCallback((row: any) => renderStaffMobileRow(row), [renderStaffMobileRow]);

  return (
    embedded ? (
      <div className={cn(HR_EMBEDDED_SHELL_CLASS, 'gap-0')}>
        {renderStaffContent()}
      </div>
    ) : (
      <ScreenShell>
        {renderStaffContent()}
      </ScreenShell>
    )
  );

  function renderStaffContent() {
    return (
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
              const allAllow = await getCustomAllowances(companyId);
              throwIfApiFailed(allAllow, t('loadingError'));
              const allowanceRows = Array.isArray(allAllow.data) ? allAllow.data : (allAllow.data?.items ?? []);
              const totalsMap = buildEmployeeAllowanceTotalsMap(allowanceRows);
              return list.map((e: any) => formatEmployeeForExport(e, totalsMap));
            }}
            onImportSuccess={(count: any) => {
              queryClient.invalidateQueries({ queryKey: employeeKeys.root() });
              queryClient.invalidateQueries({ queryKey: employeeKeys.pagedByCompany(companyId) });
              showToast(t('employeesImportSuccessCount', String(count)), 'success');
            }}
          />

          {embedded ? (
            <div className={HR_STAFF_CONTROLS_CLASS}>
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
              <Input
                type="search"
                value={searchInput}
                onChange={(e: any) => setSearchInput(e.target.value)}
                placeholder={t('searchPlaceholder')}
                size="sm"
                className="w-full min-w-0"
                aria-label={t('searchPlaceholder')}
              />
            </div>
          ) : (
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
          )}

          {embedded ? (
            <div className={HR_STAFF_LIST_CLASS}>
              <SmartTable
                compact
                showRowNumbers
                tableMinWidth={960}
                innerPadding={0}
                frameClassName={cn(
                  HR_WORKSPACE_TABLE_CLASS,
                  'nx-hr-table--flat-list noorix-table-frame--mobile-list',
                )}
                columns={columns}
                data={tableData}
                total={listTotal}
                page={listPage}
                pageSize={PAGE_SIZE}
                onPageChange={setListPage}
                isLoading={isLoading}
                isError={!!employeesError}
                errorMessage={employeesError?.message || t('employeesLoadFailed')}
                searchValue={searchInput}
                onSearchChange={setSearchInput}
                showSearchInHeader={false}
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={toggleSort}
                emptyMessage={t('noEmployees')}
                renderCompactRow={renderCompactRow}
                stripeMobileCards
              />
            </div>
          ) : (
            <SmartTable
              compact
              showRowNumbers
              tableMinWidth={960}
              innerPadding={8}
              columns={columns}
              data={tableData}
              total={listTotal}
              page={listPage}
              pageSize={PAGE_SIZE}
              onPageChange={setListPage}
              isLoading={isLoading}
              isError={!!employeesError}
              errorMessage={employeesError?.message || t('employeesLoadFailed')}
              title={t('employeesList')}
              badge={<span className="nx-pill nx-pill--blue nx-pill--sm">{listTotal}</span>}
              searchValue={searchInput}
              onSearchChange={setSearchInput}
              showSearchInHeader
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={toggleSort}
              emptyMessage={t('noEmployees')}
              renderCompactRow={renderCompactRow}
              stripeMobileCards
            />
          )}
        </>
      )}

      {showForm && (
        <StaffFormModal
          employee={null}
          companyId={companyId}
          onSave={handleSave}
          onClose={() => setShowForm(false)}
          isSaving={create.isPending}
        />
      )}

      {editingEmployee && !showForm && (
        <StaffFormModal
          employee={editingEmployee}
          companyId={companyId}
          onSave={handleSave}
          onClose={() => setEditingEmployee(null)}
          isSaving={update.isPending}
        />
      )}

      {advanceEmployee && (
        <AdvanceQuickModal
          employee={advanceEmployee}
          companyId={companyId}
          createAdvance={createAdvance}
          onSuccess={() => {
            invalidateOnFinancialMutation(queryClient);
            showToast(t('advancePaid'), 'success');
          }}
          onClose={() => setAdvanceEmployee(null)}
        />
      )}
      {terminationSettlementEmp && (
        <TerminationSettlementModal
          open
          employee={terminationSettlementEmp}
          companyId={companyId}
          companyName={companyNameAr}
          onClose={() => setTerminationSettlementEmp(null)}
        />
      )}

      <Modal
        open={!!terminatingEmployee}
        onClose={() => setTerminatingEmployee(null)}
        title={t('terminateEmployee')}
        size="md"
        variant="danger"
        footer={
          <>
            <Button variant="ghost" onClick={() => setTerminatingEmployee(null)}>{t('cancel')}</Button>
            <Button
              variant="danger"
              onClick={() => {
                if (!terminationForm.reason?.trim()) {
                  showToast(t('terminationReasonPlaceholder'), 'error');
                  return;
                }
                const parsed = parseEmployeeNotesMeta(terminatingEmployee.notes);
                const meta = {
                  ...(parsed.meta || {}),
                  terminationReason: terminationForm.reason?.trim() || '',
                  terminationClause: terminationForm.clause?.trim() || '',
                  terminationDate: terminationForm.date || getSaudiToday(),
                };
                const composedNotes = composeEmployeeNotes(parsed.notesText, meta);
                update.mutate(
                  { id: terminatingEmployee.id, body: { status: 'terminated', notes: composedNotes } },
                  {
                    onSuccess: () => {
                      showToast(t('employeeTerminated'), 'success');
                      setTerminationSettlementEmp({
                        ...terminatingEmployee,
                        status: 'terminated',
                        notes: composedNotes,
                      });
                      setTerminatingEmployee(null);
                    },
                    onError: (e: any) => showToast(e?.message || t('updateFailed'), 'error'),
                  },
                );
              }}
            >
              {t('terminateEmployee')}
            </Button>
          </>
        }
      >
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
          <Input
            type="select"
            label={t('terminationReason')}
            hint={t('terminationReasonExamples')}
            value={terminationForm.reason}
            onChange={(e: any) => setTerminationForm((p: any) => ({ ...p, reason: e.target.value }))}
          >
            <option value="">{t('terminationReasonPlaceholder')}</option>
            {terminationReasonOptions.map((opt: any) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </Input>

          <Input
            type="select"
            label={t('terminationClause')}
            value={terminationForm.clause}
            onChange={(e: any) => setTerminationForm((p: any) => ({ ...p, clause: e.target.value }))}
          >
            <option value="">{t('terminationClausePlaceholder')}</option>
            <option value={t('terminationClauseArt80')}>{t('terminationClauseArt80')}</option>
            <option value={t('terminationClauseArt77')}>{t('terminationClauseArt77')}</option>
            <option value={t('terminationClauseArt74')}>{t('terminationClauseArt74')}</option>
            <option value={t('terminationClauseArt81')}>{t('terminationClauseArt81')}</option>
          </Input>

          <Input
            type="date"
            label={t('terminationDate')}
            value={terminationForm.date}
            onChange={(e: any) => setTerminationForm((p: any) => ({ ...p, date: e.target.value }))}
          />
        </div>
      </Modal>
    </>
    );
  }
}
