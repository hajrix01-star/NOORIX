/**
 * StaffListScreen — قائمة الموظفين (احترافي كامل)
 */
import React, { useState, useMemo, memo, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { useTranslation } from '../../i18n/useTranslation';
import { useEmployees } from '../../hooks/useEmployees';
import { useCustomAllowances } from '../../hooks/useCustomAllowances';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { invalidateOnFinancialMutation } from '../../utils/queryInvalidation';
import { fmt } from '../../utils/format';
import { getSaudiToday, formatSaudiDate } from '../../utils/saudiDate';
import { exportToExcel } from '../../utils/exportUtils';
import ImportExportModal from '../../components/ImportExportModal';
import { formatEmployeeForExport } from '../../utils/importTemplates';
import {
  createCustomAllowance,
  createEmployeesBatch,
  deleteCustomAllowance,
  getCustomAllowances,
  getEmployeesPaged,
  getEmployeesBulk,
} from '../../services/api';
import SmartTable from '../../components/common/SmartTable';
import { HRActionsCell } from './components/HRActionsCell';
import Toast from '../../components/Toast';
import { StaffFormModal } from './components/StaffFormModal';
import { AdvanceQuickModal } from './components/AdvanceQuickModal';
import { composeEmployeeNotes, parseEmployeeNotesMeta } from './utils/employeeNotesMeta';
import Decimal from 'decimal.js';

const PAGE_SIZE = 50;
const SAUDI_STANDARD_HOURS = 8;
const SAUDI_DAYS_PER_MONTH = 30;
const WORK_DAYS_PER_MONTH = 26;

const Badge = memo(function Badge({ map, value }) {
  const s = map[value] || { bg: 'rgba(100,116,139,0.08)', color: '#64748b', label: value };
  return (
    <span style={{
      padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700,
      background: s.bg, color: s.color, whiteSpace: 'nowrap',
    }}>
      {s.label}
    </span>
  );
});

function parseWorkHours(str) {
  if (!str) return SAUDI_STANDARD_HOURS;
  const m = String(str).match(/(\d+(?:\.\d+)?)/);
  return m ? Math.max(1, Math.min(12, parseFloat(m[1]))) : SAUDI_STANDARD_HOURS;
}

function overtimePay(emp, extraAllowances = 0) {
  const basic = new Decimal(emp.basicSalary ?? 0);
  const housing = new Decimal(emp.housingAllowance ?? 0);
  const transport = new Decimal(emp.transportAllowance ?? 0);
  const other = new Decimal(emp.otherAllowance ?? 0);
  const actualWage = basic.plus(housing).plus(transport).plus(other).plus(extraAllowances || 0);
  const overtimeHoursPerDay = Math.max(0, parseWorkHours(emp.workHours) - SAUDI_STANDARD_HOURS);
  if (overtimeHoursPerDay <= 0) return 0;
  const actualHourlyRate = actualWage.div(SAUDI_DAYS_PER_MONTH).div(SAUDI_STANDARD_HOURS);
  const basicHourlyRate = basic.div(SAUDI_DAYS_PER_MONTH).div(SAUDI_STANDARD_HOURS);
  return actualHourlyRate.plus(basicHourlyRate.times(0.5)).times(overtimeHoursPerDay).times(WORK_DAYS_PER_MONTH).toNumber();
}

function totalSalary(emp, extraAllowances = 0) {
  const basic = new Decimal(emp.basicSalary ?? 0);
  const housing = new Decimal(emp.housingAllowance ?? 0);
  const transport = new Decimal(emp.transportAllowance ?? 0);
  const other = new Decimal(emp.otherAllowance ?? 0);
  return basic
    .plus(housing)
    .plus(transport)
    .plus(other)
    .plus(extraAllowances || 0)
    .plus(overtimePay(emp, extraAllowances))
    .toNumber();
}

export default function StaffListScreen({ embedded }) {
  const navigate = useNavigate();
  const { activeCompanyId, companies } = useApp();
  const { t } = useTranslation();
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
  const [importing, setImporting] = useState(false);
  const [showImportExport, setShowImportExport] = useState(false);
  const terminationReasonOptions = [
    t('terminationReasonOptionArt80'),
    t('terminationReasonOptionArt77'),
    t('terminationReasonOptionContractEnd'),
    t('terminationReasonOptionResignation'),
    t('terminationReasonOptionAbsence'),
  ];
  const fileInputRef = useRef(null);
  const queryClient = useQueryClient();

  const { create, update, createAdvance } = useEmployees(companyId, { includeTerminated: true, fetchEnabled: false });
  const { allowances: customAllowances = [] } = useCustomAllowances(companyId);

  const [listPage, setListPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [sortKey, setSortKey] = useState('joinDate');
  const [sortDir, setSortDir] = useState('desc');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    setListPage(1);
  }, [viewMode, debouncedQ]);

  const {
    data: pagedResult,
    isLoading,
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

  const statusStyles = useMemo(() => ({
    active:     { bg: 'rgba(22,163,74,0.1)',  color: '#16a34a', label: t('statusActive') },
    on_leave:   { bg: 'rgba(245,158,11,0.1)', color: '#f59e0b', label: t('statusOnLeave') },
    terminated: { bg: 'rgba(239,68,68,0.1)',  color: '#ef4444', label: t('statusTerminated') },
    archived:   { bg: 'rgba(100,116,139,0.1)', color: '#64748b', label: t('statusArchived') },
  }), [t]);

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

  const columns = useMemo(() => [
    { key: 'employeeSerial', label: t('employeeSerial'), sortable: true, width: 120, minWidth: 110,
      render: (v) => <span className="noorix-cell-ellipsis" style={{ fontWeight: 700, fontFamily: 'var(--noorix-font-numbers)', fontSize: 13, display: 'inline-block', maxWidth: '100%' }} title={v || ''}>{v || '—'}</span> },
    { key: 'name', label: t('employeeName'), sortable: true, minWidth: 170,
      render: (v) => <span style={{ fontWeight: 600, fontSize: 13 }}>{v || '—'}</span> },
    { key: 'jobTitle', label: t('jobTitle'), sortable: true, minWidth: 150,
      render: (v) => <span style={{ color: 'var(--noorix-text-muted)', fontSize: 13 }}>{v || '—'}</span> },
    { key: 'joinDate', label: t('joinDate'), sortable: true, width: 125, minWidth: 120,
      render: (v) => <span style={{ fontSize: 12, whiteSpace: 'nowrap', color: 'var(--noorix-text-muted)' }}>{formatSaudiDate(v)}</span> },
    { key: 'totalSalary', label: t('totalSalary'), numeric: true, sortable: true, width: 140, minWidth: 130,
      render: (_, row) => <span style={{ fontFamily: 'var(--noorix-font-numbers)', fontSize: 13 }}>{fmt(row.totalSalary)}</span> },
    { key: 'status', label: t('status'), width: 120, minWidth: 110, render: (v) => <Badge map={statusStyles} value={v} /> },
    ...(viewMode === 'terminated' || viewMode === 'archived'
      ? [
          {
            key: 'terminationReason',
            label: t('terminationReason'),
            minWidth: 190,
            render: (v) => <span style={{ color: 'var(--noorix-text-muted)', fontSize: 13 }}>{v || '—'}</span>,
          },
          {
            key: 'terminationClause',
            label: t('terminationClause'),
            minWidth: 130,
            render: (v) => <span style={{ color: 'var(--noorix-text-muted)', fontSize: 13 }}>{v || '—'}</span>,
          },
        ]
      : []),
    { key: 'actions', label: t('actions'), width: '5%', align: 'center',
      render: (_, row) => (
        <HRActionsCell
          row={row}
          onView={() => navigate(`/hr/employee/${row.id}`)}
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
        />
      ) },
  ], [t, statusStyles, viewMode, navigate, update]);

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
          name: e.name,
          jobTitle: e.jobTitle,
          joinDate: formatSaudiDate(e.joinDate),
          totalSalary: fmt(ts),
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

  async function handleImportFile(file) {
    if (!file || !companyId) return;
    setImporting(true);
    try {
      const XLSX = await import('xlsx');
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
      if (!rows.length || rows.length < 2) {
        setToast({ visible: true, message: t('noDataInPeriod'), type: 'error' });
        return;
      }
      const headers = rows[0].map((h) => String(h || '').trim().toLowerCase());
      const col = (...names) => {
        for (const n of names) {
          const i = headers.findIndex((h) => (h && String(h).includes(n)) || (n === 'name' && (h === 'الاسم' || h === 'اسم')));
          if (i >= 0) return i;
        }
        return -1;
      };
      const idx = {
        name: col('name', 'الاسم', 'اسم') >= 0 ? col('name', 'الاسم', 'اسم') : 0,
        jobTitle: col('job', 'المسمى', 'الوظيفة'),
        basicSalary: col('basic', 'الراتب', 'راتب'),
        housing: col('housing', 'السكن', 'سكن'),
        transport: col('transport', 'النقل', 'نقل'),
        joinDate: col('join', 'date', 'التاريخ', 'تاريخ'),
        workHours: col('hours', 'ساعات', 'ساعة', 'work'),
      };
      const today = new Date().toISOString().slice(0, 10);
      const items = [];
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || !row[idx.name]) continue;
        const name = String(row[idx.name] || '').trim();
        if (!name) continue;
        let joinDate = today;
        if (idx.joinDate >= 0 && row[idx.joinDate] != null) {
          const d = row[idx.joinDate];
          if (typeof d === 'number' && d > 0) {
            const parsed = XLSX.SSF?.parse_date_code?.(d);
            if (parsed && parsed.y) {
              joinDate = `${String(parsed.y).padStart(4, '0')}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`;
            }
          } else if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
            joinDate = d;
          } else if (typeof d === 'string' && d.includes('/')) {
            const parts = d.split('/');
            if (parts.length === 3) joinDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
          }
        }
        let workHours = undefined;
        if (idx.workHours >= 0 && row[idx.workHours] != null) {
          const v = row[idx.workHours];
          workHours = typeof v === 'number' ? String(v) : String(v || '').trim();
          if (workHours && !/^\d+(\.\d+)?$/.test(workHours)) {
            const num = String(v).match(/(\d+(?:\.\d+)?)/);
            workHours = num ? num[1] : undefined;
          }
        }
        items.push({
          name,
          jobTitle: idx.jobTitle >= 0 && row[idx.jobTitle] ? String(row[idx.jobTitle]).trim() : undefined,
          basicSalary: idx.basicSalary >= 0 ? Number(row[idx.basicSalary]) || 0 : 0,
          housingAllowance: idx.housing >= 0 ? Number(row[idx.housing]) || 0 : 0,
          transportAllowance: idx.transport >= 0 ? Number(row[idx.transport]) || 0 : 0,
          joinDate: typeof joinDate === 'string' ? joinDate : today,
          workHours: workHours || undefined,
        });
      }
      if (items.length === 0) {
        setToast({ visible: true, message: t('noDataInPeriod'), type: 'error' });
        return;
      }
      const res = await createEmployeesBatch({ companyId, items });
      if (res?.success && res?.data) {
        queryClient.invalidateQueries({ queryKey: ['employees'] });
        queryClient.invalidateQueries({ queryKey: ['employees-paged', companyId] });
        const { created, failed } = res.data;
        setToast({ visible: true, message: `تم استيراد ${created} موظف${failed > 0 ? `، فشل ${failed}` : ''}`, type: 'success' });
      } else {
        setToast({ visible: true, message: res?.error || t('saveFailed'), type: 'error' });
      }
    } catch (e) {
      setToast({ visible: true, message: e?.message || t('saveFailed'), type: 'error' });
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
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
        && (desiredRow.nameAr !== currentRow.nameAr || Number(desiredRow.amount) !== Number(currentRow.amount));
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
        && (row.nameAr !== existing.nameAr || Number(row.amount) !== Number(existing.amount));
      if (!row.id || changed) {
        const createRes = await createCustomAllowance({
          companyId,
          employeeId,
          nameAr: row.nameAr,
          amount: row.amount,
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

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      {!embedded && (
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>{t('staffTitle')}</h1>
          <p style={{ marginTop: 4, fontSize: 13, color: 'var(--noorix-text-muted)' }}>
            {t('staffDesc')}
          </p>
        </div>
      )}

      {!companyId && (
        <div className="noorix-surface-card" style={{ padding: 20, textAlign: 'center', color: 'var(--noorix-text-muted)' }}>
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

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', flex: '1 1 auto', minWidth: 0 }}>
              <button type="button" className="noorix-btn-nav" onClick={() => setViewMode('active')} style={{ fontSize: 13 }}>
                {t('activeEmployeesList')}
              </button>
              <button type="button" className="noorix-btn-nav" onClick={() => setViewMode('terminated')} style={{ fontSize: 13 }}>
                {t('terminatedEmployeesList')}
              </button>
              <button type="button" className="noorix-btn-nav" onClick={() => setViewMode('archived')} style={{ fontSize: 13 }}>
                {t('archivedEmployeesList')}
              </button>
              <button
                type="button"
                className="noorix-btn-nav"
                onClick={() => setShowImportExport(true)}
                style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 5 }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                استيراد / تصدير
              </button>
            </div>
            <button
              type="button"
              className="noorix-btn-nav noorix-btn-primary"
              onClick={() => { setEditingEmployee(null); setShowForm(true); }}
              style={{ flexShrink: 0 }}
            >
              {t('addEmployee')}
            </button>
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
            title={t('employeesList')}
            badge={<span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 999, background: 'rgba(37,99,235,0.08)', color: '#2563eb', fontWeight: 700 }}>{listTotal}</span>}
            searchValue={searchInput}
            onSearchChange={setSearchInput}
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={toggleSort}
            emptyMessage={t('noEmployees')}
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
      {terminatingEmployee && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.4)', padding: 20,
          }}
          onClick={(e) => e.target === e.currentTarget && setTerminatingEmployee(null)}
        >
          <div className="noorix-surface-card" style={{ width: '100%', maxWidth: 560, borderRadius: 14, padding: 20 }}>
            <h4 style={{ margin: '0 0 14px' }}>{t('terminateEmployee')}</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{t('terminationReason')}</label>
                <select
                  value={terminationForm.reason}
                  onChange={(e) => setTerminationForm((p) => ({ ...p, reason: e.target.value }))}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--noorix-border)', background: 'var(--noorix-bg-surface)' }}
                >
                  <option value="">{t('terminationReasonPlaceholder')}</option>
                  {terminationReasonOptions.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
                <div style={{ marginTop: 4, fontSize: 11, color: 'var(--noorix-text-muted)' }}>
                  {t('terminationReasonExamples')}
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{t('terminationClause')}</label>
                <select
                  value={terminationForm.clause}
                  onChange={(e) => setTerminationForm((p) => ({ ...p, clause: e.target.value }))}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--noorix-border)', background: 'var(--noorix-bg-surface)' }}
                >
                  <option value="">{t('terminationClausePlaceholder')}</option>
                  <option value={t('terminationClauseArt80')}>{t('terminationClauseArt80')}</option>
                  <option value={t('terminationClauseArt77')}>{t('terminationClauseArt77')}</option>
                  <option value={t('terminationClauseArt74')}>{t('terminationClauseArt74')}</option>
                  <option value={t('terminationClauseArt81')}>{t('terminationClauseArt81')}</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{t('terminationDate')}</label>
                <input
                  type="date"
                  value={terminationForm.date}
                  onChange={(e) => setTerminationForm((p) => ({ ...p, date: e.target.value }))}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--noorix-border)', background: 'var(--noorix-bg-surface)' }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
              <button type="button" className="noorix-btn-nav" onClick={() => setTerminatingEmployee(null)}>{t('cancel')}</button>
              <button
                type="button"
                className="noorix-btn-nav noorix-btn-danger"
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
                    {
                      id: terminatingEmployee.id,
                      body: {
                        status: 'terminated',
                        notes: composeEmployeeNotes(parsed.notesText, meta),
                      },
                    },
                    {
                      onSuccess: () => {
                        setToast({ visible: true, message: t('employeeTerminated'), type: 'success' });
                        setTerminatingEmployee(null);
                      },
                      onError: (e) => setToast({ visible: true, message: e?.message || t('updateFailed'), type: 'error' }),
                    },
                  );
                }}
              >
                {t('terminateEmployee')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
