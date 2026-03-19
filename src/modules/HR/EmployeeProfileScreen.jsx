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
  createDocument,
  uploadDocumentFile,
  downloadDocument,
} from '../../services/api';
import { formatSaudiDate } from '../../utils/saudiDate';
import { fmt } from '../../utils/format';
import Decimal from 'decimal.js';
import SmartTable from '../../components/common/SmartTable';
import { AdvanceQuickModal } from './components/AdvanceQuickModal';
import { SalaryCertificateModal, ContractModal, FinalSettlementModal } from './components/EmployeeDocModal';
import Toast from '../../components/Toast';

const TYPE_MAP = { annual: 'leaveAnnual', sick: 'leaveSick', unpaid: 'leaveUnpaid', other: 'leaveOther' };
const SAUDI_STANDARD_HOURS = 8;
const SAUDI_DAYS_PER_MONTH = 30;
const WORK_DAYS_PER_MONTH = 26;

function parseWorkHours(str) {
  if (!str) return SAUDI_STANDARD_HOURS;
  const m = String(str).match(/(\d+(?:\.\d+)?)/);
  return m ? Math.max(1, Math.min(12, parseFloat(m[1]))) : SAUDI_STANDARD_HOURS;
}

function overtimePay(emp, customTotal = 0) {
  const basic = new Decimal(emp?.basicSalary ?? 0);
  const housing = new Decimal(emp?.housingAllowance ?? 0);
  const transport = new Decimal(emp?.transportAllowance ?? 0);
  const other = new Decimal(emp?.otherAllowance ?? 0);
  const actualWage = basic.plus(housing).plus(transport).plus(other).plus(customTotal || 0);
  const overtimeHoursPerDay = Math.max(0, parseWorkHours(emp?.workHours) - SAUDI_STANDARD_HOURS);
  if (overtimeHoursPerDay <= 0) return 0;
  const actualHourlyRate = actualWage.div(SAUDI_DAYS_PER_MONTH).div(SAUDI_STANDARD_HOURS);
  const basicHourlyRate = basic.div(SAUDI_DAYS_PER_MONTH).div(SAUDI_STANDARD_HOURS);
  return actualHourlyRate.plus(basicHourlyRate.times(0.5)).times(overtimeHoursPerDay).times(WORK_DAYS_PER_MONTH).toNumber();
}

function totalSalary(emp, customTotal = 0) {
  const basic = new Decimal(emp?.basicSalary ?? 0);
  const housing = new Decimal(emp?.housingAllowance ?? 0);
  const transport = new Decimal(emp?.transportAllowance ?? 0);
  const other = new Decimal(emp?.otherAllowance ?? 0);
  return basic.plus(housing).plus(transport).plus(other).plus(customTotal || 0).plus(overtimePay(emp, customTotal)).toNumber();
}

export default function EmployeeProfileScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { activeCompanyId, companies } = useApp();
  const { t } = useTranslation();
  const companyId = activeCompanyId ?? '';
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

  if (isLoading) return <div style={{ padding: 24 }}>{t('loading')}</div>;
  if (error || !employee) {
    return (
      <div style={{ padding: 24 }}>
        <p style={{ color: 'var(--noorix-text-muted)' }}>{t('noEmployees')}</p>
        <button type="button" className="noorix-btn-nav" onClick={() => navigate('/hr')}>
          العودة للقائمة
        </button>
      </div>
    );
  }

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
    for (const allowance of customAllowances) {
      rows.push({ label: allowance.nameAr || t('customAllowanceName'), amount: Number(allowance.amount ?? 0) });
    }
    if (overtimeTotal > 0) {
      rows.push({
        label: overtimeHoursPerDay > 0 ? `${t('salaryCalcOvertimePay')} (${fmt(overtimeHoursPerDay)} ساعة/يوم)` : t('salaryCalcOvertimePay'),
        amount: overtimeTotal,
      });
    }
    rows.push({ label: t('totalSalary'), amount: total, total: true });
    return rows;
  })();

  return (
    <div style={{ padding: 24, display: 'grid', gap: 20 }}>
      <Toast visible={toast.visible} message={toast.message} type={toast.type} onDismiss={() => setToast((p) => ({ ...p, visible: false }))} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <button type="button" className="noorix-btn-nav" onClick={() => navigate('/hr')}>
          ← العودة
        </button>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="noorix-btn-nav" onClick={() => setDocModal('salary')}>
            {t('salaryCertificate') || 'تعريف راتب'}
          </button>
          <button type="button" className="noorix-btn-nav" onClick={() => setDocModal('contract')}>
            {t('documentContract') || 'عقد'}
          </button>
          <button type="button" className="noorix-btn-nav" onClick={() => setDocModal('settlement')}>
            {t('finalSettlement') || 'مخالصة'}
          </button>
          {employee.status === 'active' && (
            <button
              type="button"
              className="noorix-btn-nav noorix-btn-primary"
              onClick={() => setShowAdvance(true)}
            >
              {t('payAdvance')}
            </button>
          )}
        </div>
      </div>

      {/* معلومات أساسية */}
      <div className="noorix-surface-card" style={{ padding: 24 }}>
        <h1 style={{ fontSize: 22, margin: '0 0 16px' }}>{employee.name || employee.nameAr || '—'}</h1>
        <p style={{ margin: 0, color: 'var(--noorix-text-muted)' }}>{employee.jobTitle || '—'}</p>
        <p style={{ margin: '8px 0 0', fontSize: 13 }}>الرقم الوظيفي: {employee.employeeSerial || '—'}</p>
        <p style={{ margin: '4px 0 0', fontSize: 13 }}>تاريخ التعيين: {formatSaudiDate(employee.joinDate)}</p>
        <span style={{
          marginTop: 8, display: 'inline-block', padding: '4px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700,
          background: employee.status === 'active'
            ? 'rgba(22,163,74,0.1)'
            : employee.status === 'terminated'
              ? 'rgba(239,68,68,0.1)'
              : employee.status === 'archived'
                ? 'rgba(100,116,139,0.1)'
                : 'rgba(245,158,11,0.1)',
          color: employee.status === 'active'
            ? '#16a34a'
            : employee.status === 'terminated'
              ? '#ef4444'
              : employee.status === 'archived'
                ? '#64748b'
                : '#f59e0b',
        }}>
          {employee.status === 'active'
            ? t('statusActive')
            : employee.status === 'terminated'
              ? t('statusTerminated')
              : employee.status === 'archived'
                ? t('statusArchived')
                : t('statusOnLeave')}
        </span>
      </div>

      {/* تفاصيل الراتب */}
      <div className="noorix-surface-card" style={{ padding: 24 }}>
        <h2 style={{ fontSize: 18, margin: '0 0 16px' }}>{t('totalSalary')}</h2>
        <div style={{ border: '1px solid var(--noorix-border)', borderRadius: 12, overflow: 'hidden' }}>
          {salaryRows.map((row, idx) => (
            <div
              key={`${row.label}-${idx}`}
              style={{
                display: 'grid',
                gridTemplateColumns: '1.2fr 1fr',
                gap: 12,
                padding: '12px 14px',
                borderBottom: idx === salaryRows.length - 1 ? 'none' : '1px solid var(--noorix-border)',
                background: row.total ? 'var(--noorix-bg-muted)' : 'transparent',
                alignItems: 'center',
              }}
            >
              <div style={{ fontWeight: row.total || row.strong ? 700 : 500 }}>{row.label}</div>
              <div style={{ fontFamily: 'var(--noorix-font-numbers)', textAlign: 'right', fontWeight: row.total ? 800 : 600 }}>
                {fmt(row.amount)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* السجل المالي */}
      <div className="noorix-surface-card noorix-table-frame" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--noorix-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <span style={{ fontWeight: 700, fontSize: 15 }}>{t('financialRecord') || 'السجل المالي'}</span>
          <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 999, background: 'rgba(37,99,235,0.08)', color: '#2563eb', fontWeight: 700 }}>{financialRecords.length}</span>
        </div>
        <SmartTable
          compact
          showRowNumbers
          rowNumberWidth="1%"
          innerPadding={8}
          columns={[
            { key: 'date', label: t('transactionDate'), width: '12%', render: (v) => formatSaudiDate(v) },
            { key: 'typeLabel', label: t('status') || 'النوع', width: '18%', render: (v) => v },
            { key: 'amount', label: t('advanceAmount') || 'المبلغ', numeric: true, width: '15%', render: (v) => (
              <span style={{ fontFamily: 'var(--noorix-font-numbers)', color: v >= 0 ? 'inherit' : '#dc2626' }}>{fmt(v)}</span>
            ) },
            { key: 'notes', label: t('invoiceNotesColumn'), width: '54%', render: (v) => (
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', maxWidth: '100%' }} title={v || ''}>{v || '—'}</span>
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
      <div className="noorix-surface-card noorix-table-frame" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--noorix-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <span style={{ fontWeight: 700, fontSize: 15 }}>{t('hrTabLeave')}</span>
          <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 999, background: 'rgba(37,99,235,0.08)', color: '#2563eb', fontWeight: 700 }}>{leaves.length}</span>
        </div>
        <SmartTable
          compact
          showRowNumbers
          rowNumberWidth="1%"
          innerPadding={8}
          columns={[
            { key: 'leaveType', label: t('leaveType'), width: '18%', render: (v) => t(TYPE_MAP[v] || 'leaveOther') },
            { key: 'startDate', label: t('startDate'), width: '18%', render: (v) => formatSaudiDate(v) },
            { key: 'endDate', label: t('endDate'), width: '18%', render: (v) => formatSaudiDate(v) },
            { key: 'daysCount', label: t('daysCount'), numeric: true, width: '12%', render: (v) => v ?? '—' },
            { key: 'status', label: t('status'), width: '18%', render: (v) => (
              <span style={{
                padding: '2px 6px', borderRadius: 999, fontSize: 11, fontWeight: 700,
                background: v === 'approved' ? 'rgba(22,163,74,0.1)' : v === 'rejected' ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)',
                color: v === 'approved' ? '#16a34a' : v === 'rejected' ? '#ef4444' : '#f59e0b',
              }}>
                {v === 'pending' ? t('statusPending') : v === 'approved' ? t('statusApproved') : t('statusRejected')}
              </span>
            ) },
          ]}
          data={leaves}
          total={leaves.length}
          page={1}
          pageSize={50}
          emptyMessage={t('noDataInPeriod')}
        />
      </div>

      {/* السلفيات */}
      <div className="noorix-surface-card noorix-table-frame" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--noorix-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <span style={{ fontWeight: 700, fontSize: 15 }}>{t('advancesList')}</span>
          <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 999, background: 'rgba(37,99,235,0.08)', color: '#2563eb', fontWeight: 700 }}>{advances.length}</span>
        </div>
        <SmartTable
          compact
          showRowNumbers
          rowNumberWidth="1%"
          innerPadding={8}
          columns={[
            { key: 'totalAmount', label: t('advanceAmount'), numeric: true, width: '25%', render: (v) => fmt(v) },
            { key: 'transactionDate', label: t('transactionDate'), width: '25%', render: (v) => formatSaudiDate(v) },
            { key: 'status', label: t('status'), width: '25%', render: (v) => (
              <span style={{
                padding: '2px 6px', borderRadius: 999, fontSize: 11, fontWeight: 700,
                background: v === 'settled' ? 'rgba(22,163,74,0.1)' : v === 'cancelled' ? 'rgba(100,116,139,0.1)' : 'rgba(245,158,11,0.1)',
                color: v === 'settled' ? '#16a34a' : v === 'cancelled' ? '#64748b' : '#f59e0b',
              }}>
                {v === 'settled' ? t('advanceSettled') : v === 'cancelled' ? t('cancelled') : t('advanceOutstanding')}
              </span>
            ) },
          ]}
          data={advances}
          total={advances.length}
          page={1}
          pageSize={50}
          emptyMessage={t('noDataInPeriod')}
        />
      </div>

      {/* الإقامات */}
      <div className="noorix-surface-card noorix-table-frame" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--noorix-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <span style={{ fontWeight: 700, fontSize: 15 }}>{t('hrTabResidency')}</span>
          <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 999, background: 'rgba(37,99,235,0.08)', color: '#2563eb', fontWeight: 700 }}>{residencies.length}</span>
        </div>
        <SmartTable
          compact
          showRowNumbers
          rowNumberWidth="1%"
          innerPadding={8}
          columns={[
            { key: 'iqamaNumber', label: t('iqamaNumber'), width: '25%', render: (v) => <span style={{ fontFamily: 'var(--noorix-font-numbers)' }}>{v || '—'}</span> },
            { key: 'issueDate', label: t('startDate'), width: '25%', render: (v) => formatSaudiDate(v) },
            { key: 'expiryDate', label: t('expiryDate'), width: '25%', render: (v) => formatSaudiDate(v) },
            { key: 'status', label: t('status'), width: '24%', render: (v) => (
              <span style={{
                padding: '2px 6px', borderRadius: 999, fontSize: 11, fontWeight: 700,
                background: v === 'expired' ? 'rgba(239,68,68,0.1)' : v === 'renewed' ? 'rgba(22,163,74,0.1)' : 'rgba(37,99,235,0.1)',
                color: v === 'expired' ? '#ef4444' : v === 'renewed' ? '#16a34a' : '#2563eb',
              }}>
                {v === 'expired' ? t('statusExpired') : v === 'renewed' ? t('statusRenewed') : t('statusActive')}
              </span>
            ) },
          ]}
          data={residencies}
          total={residencies.length}
          page={1}
          pageSize={50}
          emptyMessage={t('noDataInPeriod')}
        />
      </div>

      {/* المستندات */}
      <div className="noorix-surface-card noorix-table-frame" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--noorix-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <span style={{ fontWeight: 700, fontSize: 15 }}>{t('addDocument')}</span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input ref={docFileRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png" style={{ display: 'none' }} onChange={handleUploadDoc} />
            <button type="button" className="noorix-btn-nav" disabled={uploading} onClick={() => docFileRef.current?.click()}>
              {uploading ? t('saving') : t('uploadFile')}
            </button>
            <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 999, background: 'rgba(37,99,235,0.08)', color: '#2563eb', fontWeight: 700 }}>{documents.length}</span>
          </div>
        </div>
        <SmartTable
          compact
          showRowNumbers
          rowNumberWidth="1%"
          innerPadding={8}
          columns={[
            { key: 'fileName', label: t('documentType') || 'المستند', width: '75%', render: (v, row) => (
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', maxWidth: '100%' }} title={row.fileName || row.documentType || ''}>
                {row.fileName || row.documentType || 'مستند'}
              </span>
            ) },
            { key: 'actions', label: t('actions'), width: '24%', align: 'center', render: (_, row) => (
              <button type="button" className="noorix-btn-nav" style={{ padding: '4px 10px' }} onClick={() => handleDownloadDoc(row.id)}>
                {t('download')}
              </button>
            ) },
          ]}
          data={documents}
          total={documents.length}
          page={1}
          pageSize={50}
          emptyMessage={t('noDataInPeriod')}
        />
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
