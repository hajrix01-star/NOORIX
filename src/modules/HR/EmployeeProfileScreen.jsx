/**
 * EmployeeProfileScreen — صفحة ملف الموظف الموسعة (جداول احترافية)
 */
import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { invalidateOnFinancialMutation } from '../../utils/queryInvalidation';
import { useEmployee, useEmployees } from '../../hooks/useEmployees';
import { useCustomAllowances } from '../../hooks/useCustomAllowances';
import { useApp } from '../../context/AppContext';
import { useTranslation } from '../../i18n/useTranslation';
import {
  getLeaves,
  getResidencies,
  getDocuments,
  getInvoices,
  getDeductions,
  uploadDocumentFile,
  downloadDocument,
  deleteEmployee,
} from '../../services/api';
import { formatSaudiDate } from '../../utils/saudiDate';
import { hrFmt } from './utils/hrFmt';
import { Badge, Button } from '../../ui';
import SmartTable from '../../components/common/SmartTable';
import {
  parseWorkHours,
  overtimePay,
  totalSalary,
  SAUDI_STANDARD_HOURS,
} from './utils/employeeSalaryMath';
import { AdvanceQuickModal } from './components/AdvanceQuickModal';
import { SalaryCertificateModal, ContractModal, FinalSettlementModal } from './components/EmployeeDocModal';
import Toast from '../../components/Toast';
import { employeeDisplayName } from '../../utils/employeeDisplayName';

const TYPE_MAP = { annual: 'leaveAnnual', sick: 'leaveSick', unpaid: 'leaveUnpaid', other: 'leaveOther' };

export default function EmployeeProfileScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { activeCompanyId, companies, userPermissions } = useApp();
  const { t, lang } = useTranslation();
  const companyId = activeCompanyId ?? '';
  const canDeleteEmployee = Array.isArray(userPermissions) && userPermissions.includes('EMPLOYEES_DELETE');
  const activeCompany = companies?.find((c) => c.id === companyId);
  const companyName = activeCompany?.nameAr || activeCompany?.name || '';
  const companyLogo = activeCompany?.logoUrl || '';
  const [showAdvance, setShowAdvance] = useState(false);
  const [docModal, setDocModal] = useState(null);
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' });
  const [uploading, setUploading] = useState(false);
  const docFileRef = React.useRef(null);

  const { data: employee, isLoading, error } = useEmployee(id, companyId);
  const { createAdvance } = useEmployees(companyId, { includeTerminated: true });
  const { allowances: customAllowances = [] } = useCustomAllowances(companyId, id);

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
        getInvoices(companyId, null, null, 1, 100, null, id, 'advance'),
        getInvoices(companyId, null, null, 1, 100, null, id, 'hr_expense'),
        getInvoices(companyId, null, null, 1, 100, null, id, 'salary'),
      ]);
      const items = [];
      if (advRes?.success) items.push(...(advRes.data?.items ?? []).filter((i) => i.kind === 'advance'));
      if (hrRes?.success) items.push(...(hrRes.data?.items ?? []).filter((i) => i.kind === 'hr_expense'));
      if (salRes?.success) items.push(...(salRes.data?.items ?? []).filter((i) => i.kind === 'salary'));
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

  const advances = invoicesData?.items ?? [];
  const customAllowanceTotal = React.useMemo(
    () => customAllowances.reduce((sum, row) => sum + (Number(row.amount) || 0), 0),
    [customAllowances],
  );

  const financialRecords = React.useMemo(() => {
    const recs = [];
    const hrInvs = hrInvoicesData?.items ?? [];
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

  async function handlePermanentDeleteFromProfile() {
    if (!employee?.id || !companyId) return;
    if (!window.confirm(t('deleteEmployeePermanentConfirm', employeeDisplayName(employee, lang, '') || ''))) return;
    if (!window.confirm(t('deleteEmployeePermanentSecond'))) return;
    const res = await deleteEmployee(employee.id, companyId);
    if (!res?.success) {
      setToast({ visible: true, message: res?.error || t('updateFailed'), type: 'error' });
      return;
    }
    queryClient.invalidateQueries({ queryKey: ['employees'] });
    queryClient.invalidateQueries({ queryKey: ['employees-paged', companyId] });
    invalidateOnFinancialMutation(queryClient);
    setToast({ visible: true, message: t('employeeDeletedPermanent'), type: 'success' });
    navigate('/hr');
  }

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['employee', id] });
    queryClient.invalidateQueries({ queryKey: ['custom-allowances', companyId, id] });
    queryClient.invalidateQueries({ queryKey: ['leaves', companyId, id] });
    queryClient.invalidateQueries({ queryKey: ['residencies', companyId, id] });
    queryClient.invalidateQueries({ queryKey: ['documents', companyId, id] });
    queryClient.invalidateQueries({ queryKey: ['invoices', companyId] });
    queryClient.invalidateQueries({ queryKey: ['deductions', companyId, id] });
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
      if (!res?.success) throw new Error(res?.error || 'فشل الرفع');
      invalidateAll();
      setToast({ visible: true, message: t('documentUploaded'), type: 'success' });
    } catch (err) {
      setToast({ visible: true, message: err?.message || t('saveFailed'), type: 'error' });
    } finally {
      setUploading(false);
      if (docFileRef.current) docFileRef.current.value = '';
    }
  };

  const handleDownloadDoc = async (docId) => {
    try {
      await downloadDocument(docId, companyId);
    } catch (err) {
      setToast({ visible: true, message: err?.message || 'فشل التحميل', type: 'error' });
    }
  };

  if (isLoading) return <div className="nx-p-24">{t('loading')}</div>;
  if (error || !employee) {
    return (
      <div className="nx-p-24 nx-grid nx-gap-12">
        <p className="nx-cell-muted">{t('noEmployees')}</p>
        <div><Button onClick={() => navigate('/hr')}>← العودة للقائمة</Button></div>
      </div>
    );
  }

  const EMP_STATUS_MAP = {
    active:     { color: 'green',  label: t('statusActive')     },
    terminated: { color: 'red',    label: t('statusTerminated') },
    archived:   { color: 'gray',   label: t('statusArchived')   },
    on_leave:   { color: 'amber',  label: t('statusOnLeave')    },
  };
  const LEAVE_STATUS_MAP = {
    pending:  { color: 'amber', label: t('statusPending')   },
    approved: { color: 'green', label: t('statusApproved')  },
    rejected: { color: 'red',   label: t('statusRejected')  },
  };
  const ADVANCE_STATUS_MAP = {
    settled:   { color: 'green', label: t('advanceSettled')      },
    cancelled: { color: 'gray',  label: t('cancelled')           },
    active:    { color: 'amber', label: t('advanceOutstanding')  },
  };
  const RESIDENCY_STATUS_MAP = {
    expired: { color: 'red',   label: t('statusExpired') },
    renewed: { color: 'green', label: t('statusRenewed') },
    active:  { color: 'blue',  label: t('statusActive')  },
  };

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
    <div className="nx-screen nx-p-24">
      <Toast visible={toast.visible} message={toast.message} type={toast.type} onDismiss={() => setToast((p) => ({ ...p, visible: false }))} />

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
      <div className="noorix-surface-card nx-p-24">
        <h1 className="nx-page-title nx-mb-16">{employeeDisplayName(employee, lang)}</h1>
        <p className="nx-cell-muted nx-m-0">{employee.jobTitle || '—'}</p>
        <p className="nx-text-base nx-mt-8 nx-mb-0">{t('employeeSerial')}: {employee.employeeSerial || '—'}</p>
        <p className="nx-text-base nx-mt-4 nx-mb-0">{t('joinDate')}: {formatSaudiDate(employee.joinDate)}</p>
        <div className="nx-mt-10">
          <Badge {...Badge.fromStatus(employee.status, EMP_STATUS_MAP)} />
        </div>
      </div>

      {/* تفاصيل الراتب */}
      <div className="noorix-surface-card nx-p-24">
        <h2 className="nx-text-2xl nx-font-700 nx-text-primary nx-mb-16">{t('totalSalary')}</h2>
        <div className="nx-border-all nx-rounded-lg nx-overflow-hidden">
          {salaryRows.map((row, idx) => (
            <div
              key={`${row.label}-${idx}`}
              className={`employee-profile-salary-row${row.total ? ' employee-profile-salary-row--total' : ''}`}
            >
              <div className={row.total || row.strong ? 'employee-profile-salary-row__label employee-profile-salary-row__label--strong' : 'employee-profile-salary-row__label'}>{row.label}</div>
              <div className={row.total ? 'employee-profile-salary-row__amount employee-profile-salary-row__amount--total' : 'employee-profile-salary-row__amount'}>
                {hrFmt(row.amount)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* السجل المالي */}
      <div className="noorix-surface-card noorix-table-frame nx-overflow-hidden employee-profile-layout__wide">
        <div className="nx-section-header">
          <span className="nx-section-header__title">{t('financialRecord') || 'السجل المالي'}</span>
          <span className="nx-pill nx-pill--blue nx-pill--sm">{financialRecords.length}</span>
        </div>
        <SmartTable
          compact
          showRowNumbers
          rowNumberWidth="1%"
          innerPadding={8}
          columns={[
            { key: 'date',      label: t('transactionDate'),            width: '12%', render: (v) => <span className="nx-cell-muted-sm">{formatSaudiDate(v)}</span> },
            { key: 'typeLabel', label: t('status') || 'النوع',         width: '18%', render: (v) => v },
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
      <div className="noorix-surface-card noorix-table-frame nx-overflow-hidden">
        <div className="nx-section-header">
          <span className="nx-section-header__title">{t('hrTabLeave')}</span>
          <span className="nx-pill nx-pill--blue nx-pill--sm">{leaves.length}</span>
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
            { key: 'status',    label: t('status'),    width: '18%', render: (v) => <Badge {...Badge.fromStatus(v, LEAVE_STATUS_MAP)} size="sm" /> },
          ]}
          data={leaves}
          total={leaves.length}
          page={1}
          pageSize={50}
          emptyMessage={t('noDataInPeriod')}
        />
      </div>

      {/* السلفيات */}
      <div className="noorix-surface-card noorix-table-frame nx-overflow-hidden">
        <div className="nx-section-header">
          <span className="nx-section-header__title">{t('advancesList')}</span>
          <span className="nx-pill nx-pill--blue nx-pill--sm">{advances.length}</span>
        </div>
        <SmartTable
          compact
          showRowNumbers
          rowNumberWidth="1%"
          innerPadding={8}
          columns={[
            { key: 'totalAmount',     label: t('advanceAmount'),    numeric: true, width: '25%', render: (v) => <span className="nx-cell-num nx-cell-bold">{hrFmt(v)}</span> },
            { key: 'transactionDate', label: t('transactionDate'),                width: '25%', render: (v) => <span className="nx-cell-muted-sm">{formatSaudiDate(v)}</span> },
            { key: 'status',          label: t('status'),                         width: '25%', render: (v) => <Badge {...Badge.fromStatus(v, ADVANCE_STATUS_MAP)} size="sm" /> },
          ]}
          data={advances}
          total={advances.length}
          page={1}
          pageSize={50}
          emptyMessage={t('noDataInPeriod')}
        />
      </div>

      {/* الإقامات */}
      <div className="noorix-surface-card noorix-table-frame nx-overflow-hidden">
        <div className="nx-section-header">
          <span className="nx-section-header__title">{t('hrTabResidency')}</span>
          <span className="nx-pill nx-pill--blue nx-pill--sm">{residencies.length}</span>
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
            { key: 'status',      label: t('status'),       width: '24%', render: (v) => <Badge {...Badge.fromStatus(v, RESIDENCY_STATUS_MAP)} size="sm" /> },
          ]}
          data={residencies}
          total={residencies.length}
          page={1}
          pageSize={50}
          emptyMessage={t('noDataInPeriod')}
        />
      </div>

      {/* المستندات */}
      <div className="noorix-surface-card noorix-table-frame nx-overflow-hidden">
        <div className="nx-section-header">
          <span className="nx-section-header__title">{t('addDocument')}</span>
          <div className="nx-section-header__actions">
            <input ref={docFileRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png" style={{ display: 'none' }} onChange={handleUploadDoc} />
            <Button size="sm" disabled={uploading} loading={uploading} onClick={() => docFileRef.current?.click()}>
              {uploading ? t('saving') : t('uploadFile')}
            </Button>
            <span className="nx-pill nx-pill--blue nx-pill--sm">{documents.length}</span>
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
          onSaved={() => { invalidateAll(); setToast({ visible: true, message: t('documentUploaded'), type: 'success' }); }}
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
          onSaved={() => { invalidateAll(); setToast({ visible: true, message: t('documentUploaded'), type: 'success' }); }}
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
          onSaved={() => { invalidateAll(); setToast({ visible: true, message: t('documentUploaded'), type: 'success' }); }}
        />
      )}
      {showAdvance && (
        <AdvanceQuickModal
          employee={employee}
          companyId={companyId}
          createAdvance={createAdvance}
          onSuccess={() => {
            invalidateOnFinancialMutation(queryClient);
            setToast({ visible: true, message: t('advancePaid'), type: 'success' });
          }}
          onClose={() => setShowAdvance(false)}
        />
      )}
    </div>
  );
}
