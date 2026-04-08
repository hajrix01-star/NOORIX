/**
 * StaffListScreen — قائمة الموظفين (احترافي كامل)
 */
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { useTranslation } from '../../i18n/useTranslation';
import { useEmployees } from '../../hooks/useEmployees';
import { useCustomAllowances } from '../../hooks/useCustomAllowances';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { invalidateOnFinancialMutation } from '../../utils/queryInvalidation';
import { hrFmt } from './utils/hrFmt';
import { getSaudiToday, formatSaudiDate } from '../../utils/saudiDate';
import { exportToExcel } from '../../utils/exportUtils';
import ImportExportModal from '../../components/ImportExportModal';
import { formatEmployeeForExport } from '../../utils/importTemplates';
import {
  createCustomAllowance,
  deleteCustomAllowance,
  deleteEmployee,
  getCustomAllowances,
  getEmployeesPaged,
  getEmployeesBulk,
} from '../../services/api';
import { Badge, Button, Modal, Input, ScreenShell } from '../../ui';
import SmartTable from '../../components/common/SmartTable';
import { HRActionsCell } from './components/HRActionsCell';
import Toast from '../../components/Toast';
import { StaffFormModal } from './components/StaffFormModal';
import { AdvanceQuickModal } from './components/AdvanceQuickModal';
import { composeEmployeeNotes, parseEmployeeNotesMeta } from './utils/employeeNotesMeta';
import { moneyAmountsEqual, roundMoney2 } from '../../utils/moneyInput';
import { overtimePay, totalSalary } from './utils/employeeSalaryMath';
import { employeeDisplayName } from '../../utils/employeeDisplayName';
import { buildEmployeeHrStatusMap } from '../../constants/badgeMaps';

const PAGE_SIZE = 50;

export default function StaffListScreen({ embedded }) {
  const navigate = useNavigate();
  const { activeCompanyId, companies, userPermissions } = useApp();
  const { t, lang } = useTranslation();
  const companyId = activeCompanyId ?? '';
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' });
  const [showForm, setShowForm] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [advanceEmployee, setAdvanceEmployee] = useState(null);
  const [terminatingEmployee, setTerminatingEmployee] = useState(null);
  const [viewMode, setViewMode] = useState('active');
  const [terminationForm, setTerminationForm] = useState({
    reason: '',
    clause: '',
    date: getSaudiToday(),
  });
  const [showImportExport, setShowImportExport] = useState(false);
  const terminationReasonOptions = [
    t('terminationReasonOptionArt80'),
    t('terminationReasonOptionArt77'),
    t('terminationReasonOptionContractEnd'),
    t('terminationReasonOptionResignation'),
    t('terminationReasonOptionAbsence'),
  ];
  const queryClient = useQueryClient();
  const canDeleteEmployee = Array.isArray(userPermissions) && userPermissions.includes('EMPLOYEES_DELETE');

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
    queryKey: ['employees-paged', companyId, viewMode, listPage, PAGE_SIZE, debouncedQ, sortKey, sortDir],
    queryFn: async () => {
      const res = await getEmployeesPaged(companyId, {
        tab: viewMode,
        page: listPage,
        pageSize: PAGE_SIZE,
        q: debouncedQ,
        sortBy: sortKey,
        sortDir,
      });
      if (!res?.success) throw new Error(res?.error || 'فشل تحميل الموظفين');
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
      map.set(employeeId, (map.get(employeeId) || 0) + (Number(row.amount) || 0));
    }
    return map;
  }, [customAllowances]);

  const tableData = useMemo(() => {
    return pagedItems.map((e) => {
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

  const toggleSort = useCallback((key) => {
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

  const handlePermanentDelete = useCallback(async (row) => {
    if (!companyId || !row?.id) return;
    if (!window.confirm(t('deleteEmployeePermanentConfirm', employeeDisplayName(row, lang, '')))) return;
    if (!window.confirm(t('deleteEmployeePermanentSecond'))) return;
    const res = await deleteEmployee(row.id, companyId);
    if (!res?.success) {
      setToast({ visible: true, message: res?.error || t('updateFailed'), type: 'error' });
      return;
    }
    queryClient.invalidateQueries({ queryKey: ['employees'] });
    queryClient.invalidateQueries({ queryKey: ['employees-paged', companyId] });
    queryClient.invalidateQueries({ queryKey: ['employee', row.id, companyId] });
    invalidateOnFinancialMutation(queryClient);
    setToast({ visible: true, message: t('employeeDeletedPermanent'), type: 'success' });
  }, [companyId, t, queryClient, lang]);

  const columns = useMemo(() => [
    { key: 'employeeSerial', label: t('employeeSerial'), sortable: true, width: 120, minWidth: 110,
      render: (v) => <span className="nx-cell-num nx-cell-bold nx-cell-ellipsis text-[13px]" title={v || ''}>{v || '—'}</span> },
    { key: 'name', label: t('employeeName'), sortable: true, minWidth: 170,
      render: (_, row) => (
        <Button
          variant="raw"
          size="auto"
          className="nx-cell-bold text-[13px] text-noorix-blue hover:underline cursor-pointer p-0 bg-transparent text-start"
          onClick={() => navigate(`/hr/employee/${row.id}`)}
        >
          {employeeDisplayName(row, lang)}
        </Button>
      ) },
    { key: 'jobTitle', label: t('jobTitle'), sortable: true, minWidth: 150,
      render: (v) => <span className="nx-cell-muted">{v || '—'}</span> },
    { key: 'joinDate', label: t('joinDate'), sortable: true, width: 125, minWidth: 120,
      render: (v) => <span className="nx-cell-muted-sm">{formatSaudiDate(v)}</span> },
    { key: 'totalSalary', label: t('totalSalary'), numeric: true, sortable: true, width: 140, minWidth: 130,
      render: (_, row) => <span className="nx-cell-num text-[13px]">{hrFmt(row.totalSalary)}</span> },
    { key: 'status', label: t('status'), width: 120, minWidth: 110,
      render: (v) => <Badge {...Badge.fromStatus(v, STATUS_MAP)} size="sm" /> },
    ...(viewMode === 'terminated' || viewMode === 'archived'
      ? [
          {
            key: 'terminationReason',
            label: t('terminationReason'),
            minWidth: 190,
            render: (v) => <span className="nx-cell-muted">{v || '—'}</span>,
          },
          {
            key: 'terminationClause',
            label: t('terminationClause'),
            minWidth: 130,
            render: (v) => <span className="nx-cell-muted">{v || '—'}</span>,
          },
        ]
      : []),
    { key: 'actions', label: t('actions'), width: '5%', align: 'center',
      render: (_, row) => (
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
                    onSuccess: () => setToast({ visible: true, message: t('employeeArchived'), type: 'success' }),
                    onError: (e) => setToast({ visible: true, message: e?.message || t('updateFailed'), type: 'error' }),
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
                    onSuccess: () => setToast({ visible: true, message: t('employeeRestored'), type: 'success' }),
                    onError: (e) => setToast({ visible: true, message: e?.message || t('updateFailed'), type: 'error' }),
                  },
                );
              }
            : undefined}
          onPermanentDelete={canDeleteEmployee ? handlePermanentDelete : undefined}
        />
      ) },
  ], [t, lang, STATUS_MAP, viewMode, navigate, update, canDeleteEmployee, handlePermanentDelete]);

  async function handleExportExcel() {
    if (!companyId) return;
    setExporting(true);
    try {
      const res = await getEmployeesBulk(companyId, viewMode);
      if (!res?.success) {
        setToast({ visible: true, message: res?.error || t('saveFailed'), type: 'error' });
        return;
      }
      const rows = (res.data || []).map((e) => {
        const parsed = parseEmployeeNotesMeta(e.notes);
        const meta = parsed.meta || {};
        const extra = allowanceTotals.get(e.id) || 0;
        const ts = totalSalary(e, extra);
        return {
          employeeSerial: e.employeeSerial,
          name: employeeDisplayName(e, lang),
          jobTitle: e.jobTitle,
          joinDate: formatSaudiDate(e.joinDate),
          totalSalary: hrFmt(ts),
          status: statusStyles[e.status]?.label || e.status,
          terminationReason: meta.terminationReason || '',
          terminationClause: meta.terminationClause || '',
          terminationDate: meta.terminationDate ? formatSaudiDate(meta.terminationDate) : '',
        };
      });
      exportToExcel(rows, 'employees.xlsx');
    } catch (e) {
      setToast({ visible: true, message: e?.message || t('saveFailed'), type: 'error' });
    } finally {
      setExporting(false);
    }
  }

  async function syncCustomAllowanceRows(employeeId, desiredRows = []) {
    if (!companyId || !employeeId) {
      throw new Error('تعذر حفظ البدلات لعدم توفر معرف الموظف.');
    }
    const res = await getCustomAllowances(companyId, employeeId);
    if (res?.success === false) {
      throw new Error(res?.error || 'فشل تحميل البدلات الحالية.');
    }
    const currentRows = Array.isArray(res?.data) ? res.data : (res?.data?.items ?? []);
    const currentById = new Map(currentRows.map((row) => [row.id, row]));
    const desiredIds = new Set(desiredRows.filter((row) => row.id).map((row) => row.id));

    for (const currentRow of currentRows) {
      const desiredRow = desiredRows.find((row) => row.id === currentRow.id);
      const changed = desiredRow
        && (desiredRow.nameAr !== currentRow.nameAr || !moneyAmountsEqual(desiredRow.amount, currentRow.amount));
      if (!desiredIds.has(currentRow.id) || changed) {
        const delRes = await deleteCustomAllowance(currentRow.id, companyId);
        if (delRes?.success === false) {
          throw new Error(delRes?.error || `فشل حذف البدلة: ${currentRow.nameAr}`);
        }
      }
    }

    for (const row of desiredRows) {
      const existing = row.id ? currentById.get(row.id) : null;
      const changed = existing
        && (row.nameAr !== existing.nameAr || !moneyAmountsEqual(row.amount, existing.amount));
      if (!row.id || changed) {
        const createRes = await createCustomAllowance({
          companyId,
          employeeId,
          nameAr: row.nameAr,
          amount: roundMoney2(row.amount),
        });
        if (createRes?.success === false) {
          throw new Error(createRes?.error || `فشل حفظ البدلة: ${row.nameAr}`);
        }
      }
    }

    queryClient.invalidateQueries({ queryKey: ['custom-allowances', companyId] });
    queryClient.invalidateQueries({ queryKey: ['employees', companyId] });
    queryClient.invalidateQueries({ queryKey: ['employees-paged', companyId] });
  }

  function handleSave(payload) {
    const { employeeBody, customAllowances: customRows = [] } = payload?.employeeBody
      ? payload
      : { employeeBody: payload, customAllowances: [] };
    if (!companyId) {
      setToast({ visible: true, message: t('pleaseSelectCompany'), type: 'error' });
      return;
    }
    if (editingEmployee) {
      update.mutate(
        { id: editingEmployee.id, body: employeeBody },
        {
          onSuccess: async (res) => {
            try {
              if (res?.success === false) throw new Error(res?.error || t('updateFailed'));
              await syncCustomAllowanceRows(editingEmployee.id, customRows);
              setToast({ visible: true, message: t('employeeUpdated'), type: 'success' });
              setEditingEmployee(null);
            } catch (e) {
              setToast({ visible: true, message: e?.message || t('saveFailed'), type: 'error' });
            }
          },
          onError: (e) => setToast({ visible: true, message: e?.message || t('updateFailed'), type: 'error' }),
        },
      );
    } else {
      create.mutate(employeeBody, {
        onSuccess: async (res) => {
          try {
            if (res?.success === false) throw new Error(res?.error || t('addFailed'));
            const employeeId = res?.data?.id || res?.id;
            await syncCustomAllowanceRows(employeeId, customRows);
            setToast({ visible: true, message: t('employeeAdded'), type: 'success' });
            setShowForm(false);
          } catch (e) {
            setToast({ visible: true, message: e?.message || t('saveFailed'), type: 'error' });
          }
        },
        onError: (e) => setToast({ visible: true, message: e?.message || t('addFailed'), type: 'error' }),
      });
    }
  }

  const renderMobileCard = useCallback((row) => (
    <div>
      <div className="nx-mc__header mb-1">
        <span className="nx-cell-num nx-cell-muted-sm">{row.employeeSerial || '—'}</span>
        <Badge {...Badge.fromStatus(row.status, STATUS_MAP)} size="sm" />
      </div>
      <Button
        variant="raw"
        size="auto"
        className="nx-mc__name text-noorix-blue font-bold text-[14px] hover:underline cursor-pointer p-0 bg-transparent text-start"
        onClick={() => navigate(`/hr/employee/${row.id}`)}
      >
        {employeeDisplayName(row, lang)}
      </Button>
      {row.jobTitle && <div className="nx-mc__subtitle">{row.jobTitle}</div>}
      <div className="nx-mc__grid nx-mc__grid--2">
        <div>
          <div className="nx-mc__stat-label">{t('joinDate')}</div>
          <div className="nx-mc__stat-value text-[13px]">{formatSaudiDate(row.joinDate)}</div>
        </div>
        <div>
          <div className="nx-mc__stat-label">{t('totalSalary')}</div>
          <div className="nx-mc__stat-value">{hrFmt(row.totalSalary)} ﷼</div>
        </div>
      </div>
      <div className="nx-mc__actions">
        <HRActionsCell
          row={row}
          onEdit={() => setEditingEmployee(row)}
          onAdvance={row.status === 'active' ? () => setAdvanceEmployee(row) : undefined}
          onTerminate={row.status !== 'terminated' && row.status !== 'archived'
            ? () => { setTerminationForm({ reason: '', clause: '', date: getSaudiToday() }); setTerminatingEmployee(row); }
            : undefined}
          onPermanentDelete={canDeleteEmployee ? handlePermanentDelete : undefined}
        />
      </div>
    </div>
  ), [STATUS_MAP, t, lang, navigate, canDeleteEmployee, handlePermanentDelete]);

  return (
    <ScreenShell embedded={!!embedded}>
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
          <Toast visible={toast.visible} message={toast.message} type={toast.type} onDismiss={() => setToast((p) => ({ ...p, visible: false }))} />

          <ImportExportModal
            isOpen={showImportExport}
            onClose={() => setShowImportExport(false)}
            entityType="employees"
            companyId={companyId}
            exportFetcher={async () => {
              const res = await getEmployeesBulk(companyId, 'active');
              const list = Array.isArray(res) ? res : (res?.data ?? []);
              return list.map(formatEmployeeForExport);
            }}
            onImportSuccess={(count) => {
              queryClient.invalidateQueries({ queryKey: ['employees'] });
              queryClient.invalidateQueries({ queryKey: ['employees-paged', companyId] });
              setToast({ visible: true, message: `تم استيراد ${count} موظف بنجاح`, type: 'success' });
            }}
          />

          <div className="nx-page-header mb-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-2 flex-1 min-w-0">
              <Button size="sm" className="whitespace-nowrap shrink-0" onClick={() => setViewMode('active')}>{t('activeEmployeesList')}</Button>
              <Button size="sm" className="whitespace-nowrap shrink-0" onClick={() => setViewMode('terminated')}>{t('terminatedEmployeesList')}</Button>
              <Button size="sm" className="whitespace-nowrap shrink-0" onClick={() => setViewMode('archived')}>{t('archivedEmployeesList')}</Button>
              <Button
                size="sm"
                className="whitespace-nowrap shrink-0"
                icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>}
                onClick={() => setShowImportExport(true)}
              >
                {t('importExportLabel')}
              </Button>
            </div>
            <Button variant="primary" onClick={() => { setEditingEmployee(null); setShowForm(true); }}>
              {t('addEmployee')}
            </Button>
          </div>

          <SmartTable
            compact
            showRowNumbers
            rowNumberWidth="1%"
            innerPadding={8}
            columns={columns}
            data={tableData}
            total={listTotal}
            page={listPage}
            pageSize={PAGE_SIZE}
            onPageChange={setListPage}
            isLoading={isLoading}
            isError={!!employeesError}
            errorMessage={employeesError?.message || 'فشل تحميل الموظفين'}
            title={t('employeesList')}
            badge={<span className="nx-pill nx-pill--blue nx-pill--sm">{listTotal}</span>}
            searchValue={searchInput}
            onSearchChange={setSearchInput}
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={toggleSort}
            emptyMessage={t('noEmployees')}
            renderMobileCard={renderMobileCard}
          />
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
            setToast({ visible: true, message: t('advancePaid'), type: 'success' });
          }}
          onClose={() => setAdvanceEmployee(null)}
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
                  setToast({ visible: true, message: t('terminationReasonPlaceholder'), type: 'error' });
                  return;
                }
                const parsed = parseEmployeeNotesMeta(terminatingEmployee.notes);
                const meta = {
                  ...(parsed.meta || {}),
                  terminationReason: terminationForm.reason?.trim() || '',
                  terminationClause: terminationForm.clause?.trim() || '',
                  terminationDate: terminationForm.date || getSaudiToday(),
                };
                update.mutate(
                  { id: terminatingEmployee.id, body: { status: 'terminated', notes: composeEmployeeNotes(parsed.notesText, meta) } },
                  {
                    onSuccess: () => { setToast({ visible: true, message: t('employeeTerminated'), type: 'success' }); setTerminatingEmployee(null); },
                    onError: (e) => setToast({ visible: true, message: e?.message || t('updateFailed'), type: 'error' }),
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
            onChange={(e) => setTerminationForm((p) => ({ ...p, reason: e.target.value }))}
          >
            <option value="">{t('terminationReasonPlaceholder')}</option>
            {terminationReasonOptions.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </Input>

          <Input
            type="select"
            label={t('terminationClause')}
            value={terminationForm.clause}
            onChange={(e) => setTerminationForm((p) => ({ ...p, clause: e.target.value }))}
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
            onChange={(e) => setTerminationForm((p) => ({ ...p, date: e.target.value }))}
          />
        </div>
      </Modal>
    </ScreenShell>
  );
}
