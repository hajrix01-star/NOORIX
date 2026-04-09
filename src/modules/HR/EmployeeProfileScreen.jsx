/**
 * EmployeeProfileScreen — صفحة ملف الموظف الموسعة (جداول احترافية)
 */
import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useApiMutation } from '../../hooks/useApiMutation';
import { invalidateOnFinancialMutation } from '../../utils/queryInvalidation';
import { useEmployee, useEmployees } from '../../hooks/useEmployees';
import { useCustomAllowances } from '../../hooks/useCustomAllowances';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { useTranslation } from '../../i18n/useTranslation';
import {
  getLeaves,
  getResidencies,
  getDocuments,
  getInvoices,
  getDeductions,
  getMovements,
  uploadDocumentFile,
  downloadDocument,
  deleteEmployee,
} from '../../services/api';
import { formatSaudiDate } from '../../utils/saudiDate';
import { assertApiOk } from '../../utils/apiResponse';
import { hrFmt } from './utils/hrFmt';
import { Badge, Button, ScreenShell, Spinner, SmartTable, cn } from '../../ui';
import {
  parseWorkHours,
  overtimePay,
  totalSalary,
  SAUDI_STANDARD_HOURS,
} from './utils/employeeSalaryMath';
import { AdvanceQuickModal } from './components/AdvanceQuickModal';
import { EmployeeCareerMovementModal } from './components/EmployeeCareerMovementModal';
import { SalaryCertificateModal, ContractModal, FinalSettlementModal } from './components/EmployeeDocModal';
import { employeeDisplayName } from '../../utils/employeeDisplayName';
import { buildLeaveRequestStatusMap, buildResidencyRecordStatusMap } from '../../constants/badgeMaps';

const TYPE_MAP = { annual: 'leaveAnnual', sick: 'leaveSick', unpaid: 'leaveUnpaid', other: 'leaveOther' };

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] || '') + (parts[1][0] || '');
  return (parts[0] || '').slice(0, 2) || '?';
}

function ProfileInfoRow({ label, value, accent = false }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-noorix-border last:border-0">
      <span className="text-[12px] text-noorix-muted shrink-0">{label}</span>
      <span className={cn('text-[13px] font-medium text-end', accent ? 'text-noorix-red' : 'text-noorix-text')}>
        {value || '—'}
      </span>
    </div>
  );
}

export default function EmployeeProfileScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { activeCompanyId, companies, userPermissions } = useApp();
  const { t, lang } = useTranslation();
  const companyId = activeCompanyId ?? '';
  const canDeleteEmployee = Array.isArray(userPermissions) && userPermissions.includes('EMPLOYEES_DELETE');
  const canRecordCareer =
    Array.isArray(userPermissions) &&
    userPermissions.includes('EMPLOYEES_WRITE') &&
    userPermissions.includes('HR_WRITE');
  const activeCompany = companies?.find((c) => c.id === companyId);
  const companyName = activeCompany?.nameAr || activeCompany?.name || '';
  const companyLogo = activeCompany?.logoUrl || '';
  const [showAdvance, setShowAdvance] = useState(false);
  const [careerModal, setCareerModal] = useState(null);
  const [docModal, setDocModal] = useState(null);
  const { showToast } = useToast();
  const [uploading, setUploading] = useState(false);
  const docFileRef = React.useRef(null);

  const { data: employee, isLoading, error } = useEmployee(id, companyId);
  const { createAdvance } = useEmployees(companyId, { includeTerminated: true });
  const { allowances: customAllowances = [] } = useCustomAllowances(companyId, id);

  const leaveProfileStatusMap = useMemo(() => buildLeaveRequestStatusMap(t), [t]);
  const residencyProfileStatusMap = useMemo(() => buildResidencyRecordStatusMap(t), [t]);

  const { data: leaves = [] } = useQuery({
    queryKey: ['leaves', companyId, id],
    queryFn: async () => {
      const res = await getLeaves(companyId, id);
      if (!res?.success) return [];
      const d = res.data;
      return Array.isArray(d) ? d : (d?.items ?? []);
    },
    enabled: !!companyId && !!id,
  });

  const { data: residencies = [] } = useQuery({
    queryKey: ['residencies', companyId, id],
    queryFn: async () => {
      const res = await getResidencies(companyId, id);
      if (!res?.success) return [];
      const d = res.data;
      return Array.isArray(d) ? d : (d?.items ?? []);
    },
    enabled: !!companyId && !!id,
  });

  const { data: documents = [] } = useQuery({
    queryKey: ['documents', companyId, id],
    queryFn: async () => {
      const res = await getDocuments(companyId, id);
      if (!res?.success) return [];
      const d = res.data;
      const items = Array.isArray(d) ? d : (d?.items ?? []);
      return [...items].sort((a, b) => {
        const ad = new Date(a?.updatedAt || a?.createdAt || 0).getTime();
        const bd = new Date(b?.updatedAt || b?.createdAt || 0).getTime();
        return bd - ad;
      });
    },
    enabled: !!companyId && !!id,
  });

  const { data: invoicesData } = useQuery({
    queryKey: ['invoices', companyId, 'advance', id],
    queryFn: async () => {
      const res = await getInvoices(companyId, null, null, 1, 100, null, id, 'advance');
      if (!res?.success) return { items: [] };
      const items = res.data?.items ?? [];
      return { items: items.filter((inv) => inv.kind === 'advance') };
    },
    enabled: !!companyId && !!id,
  });

  const { data: hrInvoicesData } = useQuery({
    queryKey: ['invoices', companyId, 'hr-all', id],
    queryFn: async () => {
      const [advRes, hrRes, salRes] = await Promise.all([
        getInvoices(companyId, null, null, 1, 100, null, id, 'advance',    null, null, null, null, null, null, false),
        getInvoices(companyId, null, null, 1, 100, null, id, 'hr_expense', null, null, null, null, null, null, false),
        getInvoices(companyId, null, null, 1, 100, null, id, 'salary',     null, null, null, null, null, null, false),
      ]);
      const items = [];
      if (advRes?.success) items.push(...(advRes.data?.items ?? []).filter((i) => i.kind === 'advance'    && i.status !== 'cancelled'));
      if (hrRes?.success) items.push(...(hrRes.data?.items ?? []).filter((i) => i.kind === 'hr_expense' && i.status !== 'cancelled'));
      if (salRes?.success) items.push(...(salRes.data?.items ?? []).filter((i) => i.kind === 'salary'     && i.status !== 'cancelled'));
      return { items };
    },
    enabled: !!companyId && !!id,
  });

  const { data: deductions = [] } = useQuery({
    queryKey: ['deductions', companyId, id],
    queryFn: async () => {
      const res = await getDeductions(companyId, id);
      if (!res?.success) return [];
      const d = res.data;
      return Array.isArray(d) ? d : (d?.items ?? []);
    },
    enabled: !!companyId && !!id,
  });

  const { data: movements = [] } = useQuery({
    queryKey: ['movements', companyId, id],
    queryFn: async () => {
      const res = await getMovements(companyId, id);
      if (!res?.success) return [];
      const d = res.data;
      return Array.isArray(d) ? d : [];
    },
    enabled: !!companyId && !!id,
  });

  const careerTableRows = useMemo(() => {
    const labelFor = (mt) => {
      if (mt === 'promotion') return t('movementTypePromotion');
      if (mt === 'raise') return t('movementTypeRaise');
      return t('movementTypeOther');
    };
    return movements.map((m) => {
      let changeSummary = '—';
      if (m.movementType === 'promotion') {
        const a = m.previousValue || '—';
        const b = m.newValue || '—';
        changeSummary = `${a} → ${b}`;
      } else if (m.movementType === 'raise') {
        const a =
          m.previousValue != null && String(m.previousValue).trim() !== ''
            ? hrFmt(Number(m.previousValue))
            : '—';
        const b =
          m.newValue != null && String(m.newValue).trim() !== ''
            ? hrFmt(Number(m.newValue))
            : '—';
        const inc =
          m.amount != null && Number(m.amount) > 0 ? ` (+${hrFmt(Number(m.amount))})` : '';
        changeSummary = `${a} → ${b}${inc}`;
      } else {
        const parts = [m.previousValue, m.newValue].filter(Boolean);
        changeSummary =
          parts.length > 0
            ? parts.join(' → ')
            : m.amount != null
              ? hrFmt(Number(m.amount))
              : '—';
      }
      return {
        id: m.id,
        effectiveDate: m.effectiveDate,
        typeLabel: labelFor(m.movementType),
        changeSummary,
        notes: m.notes || '—',
      };
    });
  }, [movements, t]);

  const advances = invoicesData?.items ?? [];
  const customAllowanceTotal = React.useMemo(
    () => customAllowances.reduce((sum, row) => sum + (Number(row.amount) || 0), 0),
    [customAllowances],
  );

  const financialRecords = React.useMemo(() => {
    const recs = [];
    const hrInvs = (hrInvoicesData?.items ?? []).filter((i) => i.status !== 'cancelled');
    for (const inv of hrInvs) {
      const dt = inv.transactionDate ? (inv.transactionDate.slice ? inv.transactionDate.slice(0, 10) : inv.transactionDate) : '';
      let typeKey = 'opAdvance';
      let typeLabel = t('opAdvance');
      if (inv.kind === 'salary') {
        typeKey = 'opSalary';
        typeLabel = t('opSalary');
      } else if (inv.kind === 'hr_expense') {
        typeKey = 'invoiceKindHrExpense';
        typeLabel = t('invoiceKindHrExpense');
      }
      let notes = inv.notes || '';
      if (inv.kind === 'advance' && inv.settledAt) {
        notes = (notes ? notes + ' — ' : '') + (t('advanceSettled') || 'تم السداد');
      }
      recs.push({
        id: inv.id,
        date: dt,
        type: typeKey,
        typeLabel,
        amount: Number(inv.totalAmount ?? inv.netAmount ?? 0),
        notes,
        source: 'invoice',
        kind: inv.kind,
        status: inv.status,
        settledAt: inv.settledAt,
      });
    }
    for (const d of deductions) {
      const dt = d.transactionDate ? (d.transactionDate.slice ? d.transactionDate.slice(0, 10) : d.transactionDate) : '';
      recs.push({
        id: d.id,
        date: dt,
        type: 'payrollDeductions',
        typeLabel: t('payrollDeductions'),
        amount: -Number(d.amount ?? 0),
        notes: d.notes || '',
        source: 'deduction',
        deductionType: d.deductionType,
      });
    }
    recs.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    return recs;
  }, [hrInvoicesData, deductions, t]);
  const queryClient = useQueryClient();

  const permanentDeleteEmployeeMut = useApiMutation({
    mutationFn: ({ empId }) => deleteEmployee(empId, companyId),
    successToast: () => t('employeeDeletedPermanent'),
    errorToast: (e) => e?.message || t('updateFailed'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee', id, companyId] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['employees-paged', companyId] });
      invalidateOnFinancialMutation(queryClient);
      navigate('/hr');
    },
  });

  function handlePermanentDeleteFromProfile() {
    if (!employee?.id || !companyId) return;
    if (!window.confirm(t('deleteEmployeePermanentConfirm', employeeDisplayName(employee, lang, '') || ''))) return;
    if (!window.confirm(t('deleteEmployeePermanentSecond'))) return;
    permanentDeleteEmployeeMut.mutate({ empId: employee.id });
  }

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['employee', id] });
    queryClient.invalidateQueries({ queryKey: ['custom-allowances', companyId, id] });
    queryClient.invalidateQueries({ queryKey: ['leaves', companyId, id] });
    queryClient.invalidateQueries({ queryKey: ['residencies', companyId, id] });
    queryClient.invalidateQueries({ queryKey: ['documents', companyId, id] });
    queryClient.invalidateQueries({ queryKey: ['invoices', companyId] });
    queryClient.invalidateQueries({ queryKey: ['deductions', companyId, id] });
    queryClient.invalidateQueries({ queryKey: ['movements', companyId, id] });
  };

  const handleUploadDoc = async (e) => {
    const file = e?.target?.files?.[0];
    if (!file || !id || !companyId) return;
    setUploading(true);
    try {
      const res = await uploadDocumentFile({
        companyId,
        employeeId: id,
        documentType: 'other',
        file,
      });
      assertApiOk(res, t('saveFailed'));
      invalidateAll();
      showToast(t('documentUploaded'), 'success');
    } catch (err) {
      showToast(err?.message || t('saveFailed'), 'error');
    } finally {
      setUploading(false);
      if (docFileRef.current) docFileRef.current.value = '';
    }
  };

  const handleDownloadDoc = async (docId) => {
    try {
      await downloadDocument(docId, companyId);
    } catch (err) {
      showToast(err?.message || 'فشل التحميل', 'error');
    }
  };

  if (isLoading) {
    return (
      <ScreenShell>
        <div className="flex items-center justify-center py-20">
          <Spinner size="lg" />
        </div>
      </ScreenShell>
    );
  }
  if (error || !employee) {
    return (
      <ScreenShell>
        <div className="noorix-surface-card p-8 flex flex-col items-center gap-4 text-center">
          <p className="text-noorix-muted text-[14px] m-0">{t('noEmployees')}</p>
          <Button onClick={() => navigate('/hr')}>{t('employeeProfileBack')}</Button>
        </div>
      </ScreenShell>
    );
  }

  const EMP_STATUS_MAP = {
    active:     { color: 'green',  label: t('statusActive')     },
    terminated: { color: 'red',    label: t('statusTerminated') },
    archived:   { color: 'gray',   label: t('statusArchived')   },
    on_leave:   { color: 'amber',  label: t('statusOnLeave')    },
  };
  const ADVANCE_STATUS_MAP = {
    settled:   { color: 'green', label: t('advanceSettled')      },
    cancelled: { color: 'gray',  label: t('cancelled')           },
    active:    { color: 'amber', label: t('advanceOutstanding')  },
  };
  const canShowCareerActions =
    canRecordCareer && ['active', 'on_leave'].includes(employee.status);

  const overtimeTotal = overtimePay(employee, customAllowanceTotal);
  const total = totalSalary(employee, customAllowanceTotal);
  const overtimeHoursPerDay = Math.max(0, parseWorkHours(employee?.workHours) - SAUDI_STANDARD_HOURS);
  const salaryRows = (() => {
    const rows = [
      { label: t('basicSalary'), amount: Number(employee.basicSalary ?? 0), strong: true },
    ];
    if (Number(employee.housingAllowance ?? 0) > 0) {
      rows.push({ label: t('housingAllowance'), amount: Number(employee.housingAllowance ?? 0) });
    }
    if (Number(employee.transportAllowance ?? 0) > 0) {
      rows.push({ label: t('transportAllowance'), amount: Number(employee.transportAllowance ?? 0) });
    }
    if (Number(employee.otherAllowance ?? 0) > 0) {
      rows.push({ label: t('otherAllowance'), amount: Number(employee.otherAllowance ?? 0) });
    }
    for (const allowance of customAllowances) {
      rows.push({ label: allowance.nameAr || t('customAllowanceName'), amount: Number(allowance.amount ?? 0) });
    }
    if (overtimeTotal > 0) {
      rows.push({
        label: overtimeHoursPerDay > 0 ? `${t('salaryCalcOvertimePay')} (${hrFmt(overtimeHoursPerDay)} ساعة/يوم)` : t('salaryCalcOvertimePay'),
        amount: overtimeTotal,
      });
    }
    rows.push({ label: t('totalSalary'), amount: total, total: true });
    return rows;
  })();

  return (
    <ScreenShell>
      <div className="nx-page-header employee-profile-header-bar">
        <Button onClick={() => navigate('/hr')}>{t('employeeProfileBack')}</Button>
        <div className="nx-toolbar">
          <Button onClick={() => setDocModal('salary')}>{t('salaryCertificate') || 'تعريف راتب'}</Button>
          <Button onClick={() => setDocModal('contract')}>{t('documentContract') || 'عقد'}</Button>
          <Button onClick={() => setDocModal('settlement')}>{t('finalSettlement') || 'مخالصة'}</Button>
          {employee.status === 'active' && (
            <Button variant="primary" onClick={() => setShowAdvance(true)}>{t('payAdvance')}</Button>
          )}
          {canDeleteEmployee && (
            <Button variant="danger" onClick={handlePermanentDeleteFromProfile}>
              {t('deleteEmployeePermanent')}
            </Button>
          )}
        </div>
      </div>

      <div className="employee-profile-layout">
      {/* معلومات أساسية */}
      <div className="noorix-surface-card p-6">
        <div className="flex items-start gap-4 mb-5">
          <div className="w-14 h-14 rounded-full bg-noorix-blue flex items-center justify-center text-white text-[20px] font-bold shrink-0 select-none">
            {getInitials(employeeDisplayName(employee, lang))}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h2 className="text-[18px] font-bold text-noorix-text m-0 leading-snug">
                {employeeDisplayName(employee, lang)}
              </h2>
              <Badge {...Badge.fromStatus(employee.status, EMP_STATUS_MAP)} />
            </div>
            <p className="text-noorix-muted text-[13px] m-0">{employee.jobTitle || '—'}</p>
          </div>
        </div>
        <div className="border-t border-noorix-border pt-1">
          <ProfileInfoRow label={t('employeeSerial')} value={employee.employeeSerial} />
          <ProfileInfoRow label={t('joinDate')} value={formatSaudiDate(employee.joinDate)} />
          {employee.workHours ? (
            <ProfileInfoRow label={t('workHours')} value={String(employee.workHours)} />
          ) : null}
          {employee.status === 'terminated' && employee.terminationDate ? (
            <ProfileInfoRow label={t('terminationDate')} value={formatSaudiDate(employee.terminationDate)} accent />
          ) : null}
        </div>
      </div>

      {/* تفاصيل الراتب */}
      <div className="noorix-surface-card p-6">
        <div className="flex items-start justify-between gap-3 mb-4">
          <h2 className="text-[16px] font-bold text-noorix-text m-0">{t('salaryBreakdown')}</h2>
          <div className="text-end shrink-0">
            <div className="text-[11px] text-noorix-muted mb-0.5">{t('totalSalary')}</div>
            <div className="text-[22px] font-bold text-noorix-green ltr">{hrFmt(total)}</div>
          </div>
        </div>
        <div className="border border-noorix-border rounded-xl overflow-hidden">
          {salaryRows.filter((r) => !r.total).map((row, idx) => (
            <div
              key={`${row.label}-${idx}`}
              className="employee-profile-salary-row"
            >
              <div className={row.strong ? 'employee-profile-salary-row__label employee-profile-salary-row__label--strong' : 'employee-profile-salary-row__label'}>
                {row.label}
              </div>
              <div className="employee-profile-salary-row__amount">{hrFmt(row.amount)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* الترقيات وزيادات الراتب */}
      <div className="noorix-surface-card overflow-hidden employee-profile-layout__wide">
        <div className="nx-section-header">
          <span className="nx-section-header__title">{t('careerRecordTitle')}</span>
          <div className="nx-section-header__actions flex flex-wrap items-center gap-2">
            {canShowCareerActions && (
              <>
                <Button size="sm" onClick={() => setCareerModal('promotion')}>
                  {t('movementTypePromotion')}
                </Button>
                <Button size="sm" variant="primary" onClick={() => setCareerModal('raise')}>
                  {t('movementTypeRaise')}
                </Button>
              </>
            )}
          </div>
        </div>
        <SmartTable
          compact
          showRowNumbers
          rowNumberWidth="1%"
          innerPadding={8}
          columns={[
            {
              key: 'effectiveDate',
              label: t('careerEffectiveDate'),
              width: '14%',
              render: (v) => <span className="nx-cell-muted-sm">{formatSaudiDate(v)}</span>,
            },
            { key: 'typeLabel', label: t('movementTypeLabel'), width: '16%', render: (v) => v },
            {
              key: 'changeSummary',
              label: t('careerChangeSummary'),
              width: '32%',
              render: (v) => (
                <span className="nx-cell-ellipsis text-[13px]" title={v || ''}>
                  {v || '—'}
                </span>
              ),
            },
            {
              key: 'notes',
              label: t('invoiceNotesColumn'),
              width: '36%',
              render: (v) => (
                <span className="nx-cell-ellipsis" title={v || ''}>
                  {v || '—'}
                </span>
              ),
            },
          ]}
          data={careerTableRows}
          total={careerTableRows.length}
          page={1}
          pageSize={50}
          emptyMessage={t('noDataInPeriod')}
        />
      </div>

      {/* السجل المالي */}
      <div className="noorix-surface-card overflow-hidden employee-profile-layout__wide">
        <div className="nx-section-header">
          <span className="nx-section-header__title">{t('financialRecord') || 'السجل المالي'}</span>
        </div>
        <SmartTable
          compact
          showRowNumbers
          rowNumberWidth="1%"
          innerPadding={8}
          columns={[
            { key: 'date',      label: t('transactionDate'),            width: '12%', render: (v) => <span className="nx-cell-muted-sm">{formatSaudiDate(v)}</span> },
            { key: 'typeLabel', label: t('operationType'),              width: '18%', render: (v) => v },
            { key: 'amount',    label: t('advanceAmount') || 'المبلغ', numeric: true, width: '15%', render: (v) => (
              <span className={`nx-cell-num${v < 0 ? ' nx-cell-num--red' : ''}`}>{hrFmt(v)}</span>
            ) },
            { key: 'notes',     label: t('invoiceNotesColumn'),        width: '54%', render: (v) => (
              <span className="nx-cell-ellipsis" title={v || ''}>{v || '—'}</span>
            ) },
          ]}
          data={financialRecords}
          total={financialRecords.length}
          page={1}
          pageSize={50}
          emptyMessage={t('noDataInPeriod')}
        />
      </div>

      {/* الإجازات */}
      <div className="noorix-surface-card overflow-hidden">
        <div className="nx-section-header">
          <span className="nx-section-header__title">{t('hrTabLeave')}</span>
        </div>
        <SmartTable
          compact
          showRowNumbers
          rowNumberWidth="1%"
          innerPadding={8}
          columns={[
            { key: 'leaveType', label: t('leaveType'), width: '18%', render: (v) => t(TYPE_MAP[v] || 'leaveOther') },
            { key: 'startDate', label: t('startDate'), width: '18%', render: (v) => <span className="nx-cell-muted-sm">{formatSaudiDate(v)}</span> },
            { key: 'endDate',   label: t('endDate'),   width: '18%', render: (v) => <span className="nx-cell-muted-sm">{formatSaudiDate(v)}</span> },
            { key: 'daysCount', label: t('daysCount'), numeric: true, width: '12%', render: (v) => <span className="nx-cell-num">{v ?? '—'}</span> },
            { key: 'status',    label: t('status'),    width: '18%', render: (v) => <Badge {...Badge.fromStatus(v, leaveProfileStatusMap)} size="sm" /> },
          ]}
          data={leaves}
          total={leaves.length}
          page={1}
          pageSize={50}
          emptyMessage={t('noDataInPeriod')}
        />
      </div>

      {/* السلفيات */}
      <div className="noorix-surface-card overflow-hidden">
        <div className="nx-section-header">
          <span className="nx-section-header__title">{t('advancesList')}</span>
        </div>
        <SmartTable
          compact
          showRowNumbers
          rowNumberWidth="1%"
          innerPadding={8}
          columns={[
            { key: 'totalAmount',     label: t('advanceAmount'),    numeric: true, width: '18%', render: (v) => <span className="nx-cell-num nx-cell-bold">{hrFmt(v)}</span> },
            { key: 'transactionDate', label: t('transactionDate'),                width: '16%', render: (v) => <span className="nx-cell-muted-sm">{formatSaudiDate(v)}</span> },
            { key: 'installmentCount', label: t('installmentInfo'),               width: '20%', render: (_, row) => {
              if (!row.installmentCount || row.installmentCount <= 1) return <span className="nx-cell-muted-sm">—</span>;
              return (
                <span className="text-[12px] text-noorix-blue font-semibold ltr">
                  {row.installmentCount} × {hrFmt(row.installmentAmount ?? 0)}
                </span>
              );
            } },
            { key: 'status',          label: t('status'),                         width: '16%', render: (v) => <Badge {...Badge.fromStatus(v, ADVANCE_STATUS_MAP)} size="sm" /> },
            { key: 'notes',           label: t('invoiceNotesColumn'),             width: '30%', render: (v) => <span className="nx-cell-ellipsis" title={v || ''}>{v || '—'}</span> },
          ]}
          data={advances}
          total={advances.length}
          page={1}
          pageSize={50}
          emptyMessage={t('noDataInPeriod')}
        />
      </div>

      {/* الإقامات */}
      <div className="noorix-surface-card overflow-hidden">
        <div className="nx-section-header">
          <span className="nx-section-header__title">{t('hrTabResidency')}</span>
        </div>
        <SmartTable
          compact
          showRowNumbers
          rowNumberWidth="1%"
          innerPadding={8}
          columns={[
            { key: 'iqamaNumber', label: t('iqamaNumber'), width: '25%', render: (v) => <span className="nx-cell-num">{v || '—'}</span> },
            { key: 'issueDate',   label: t('startDate'),   width: '25%', render: (v) => <span className="nx-cell-muted-sm">{formatSaudiDate(v)}</span> },
            { key: 'expiryDate',  label: t('expiryDate'),  width: '25%', render: (v) => <span className="nx-cell-muted-sm">{formatSaudiDate(v)}</span> },
            { key: 'status',      label: t('status'),       width: '24%', render: (v) => <Badge {...Badge.fromStatus(v, residencyProfileStatusMap)} size="sm" /> },
          ]}
          data={residencies}
          total={residencies.length}
          page={1}
          pageSize={50}
          emptyMessage={t('noDataInPeriod')}
        />
      </div>

      {/* المستندات */}
      <div className="noorix-surface-card overflow-hidden">
        <div className="nx-section-header">
          <span className="nx-section-header__title">{t('employeeDocuments')}</span>
          <div className="nx-section-header__actions">
            <input ref={docFileRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png" className="hidden" onChange={handleUploadDoc} />
            <Button size="sm" disabled={uploading} loading={uploading} onClick={() => docFileRef.current?.click()}>
              {uploading ? t('saving') : t('uploadFile')}
            </Button>
          </div>
        </div>
        <SmartTable
          compact
          showRowNumbers
          rowNumberWidth="1%"
          innerPadding={8}
          columns={[
            { key: 'fileName', label: t('documentType') || 'المستند', width: '75%', render: (v, row) => (
              <span className="nx-cell-ellipsis" title={row.fileName || row.documentType || ''}>
                {row.fileName || row.documentType || 'مستند'}
              </span>
            ) },
            { key: 'actions', label: t('actions'), width: '24%', align: 'center', render: (_, row) => (
              <Button size="sm" onClick={() => handleDownloadDoc(row.id)}>{t('download')}</Button>
            ) },
          ]}
          data={documents}
          total={documents.length}
          page={1}
          pageSize={50}
          emptyMessage={t('noDataInPeriod')}
        />
      </div>
      </div>

      {docModal === 'salary' && (
        <SalaryCertificateModal
          employee={employee}
          customAllowances={customAllowances}
          companyId={companyId}
          companyName={companyName}
          companyLogo={companyLogo}
          onClose={() => setDocModal(null)}
          onSaved={() => { invalidateAll(); showToast(t('documentUploaded'), 'success'); }}
        />
      )}
      {docModal === 'contract' && (
        <ContractModal
          employee={employee}
          customAllowances={customAllowances}
          companyId={companyId}
          companyName={companyName}
          companyLogo={companyLogo}
          onClose={() => setDocModal(null)}
          onSaved={() => { invalidateAll(); showToast(t('documentUploaded'), 'success'); }}
        />
      )}
      {docModal === 'settlement' && (
        <FinalSettlementModal
          employee={employee}
          customAllowances={customAllowances}
          companyId={companyId}
          companyName={companyName}
          companyLogo={companyLogo}
          onClose={() => setDocModal(null)}
          onSaved={() => { invalidateAll(); showToast(t('documentUploaded'), 'success'); }}
        />
      )}
      {showAdvance && (
        <AdvanceQuickModal
          employee={employee}
          companyId={companyId}
          createAdvance={createAdvance}
          onSuccess={() => {
            invalidateOnFinancialMutation(queryClient);
            showToast(t('advancePaid'), 'success');
          }}
          onClose={() => setShowAdvance(false)}
        />
      )}
      {careerModal && (
        <EmployeeCareerMovementModal
          kind={careerModal}
          employee={employee}
          companyId={companyId}
          customAllowanceTotal={customAllowanceTotal}
          onClose={() => setCareerModal(null)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['movements', companyId, id] });
            queryClient.invalidateQueries({ queryKey: ['employee', id, companyId] });
            queryClient.invalidateQueries({ queryKey: ['employees', companyId] });
            queryClient.invalidateQueries({ queryKey: ['employees-paged', companyId] });
            showToast(t('careerMovementSaved'), 'success');
          }}
        />
      )}
    </ScreenShell>
  );
}
