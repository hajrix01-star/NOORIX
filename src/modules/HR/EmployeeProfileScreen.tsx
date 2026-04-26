/**
 * EmployeeProfileScreen — صفحة ملف الموظف (المنطق والتنسيق في مكوّنات employeeProfile/*)
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
  getEmployeePayrollItems,
  uploadDocumentFile,
  downloadDocument,
  deleteEmployee,
} from '../../services/api';
import { assertApiOk } from '../../utils/apiResponse';
import { ScreenShell } from '../../ui';
import {
  parseWorkHours,
  overtimePay,
  totalSalary,
  SAUDI_STANDARD_HOURS,
} from './utils/employeeSalaryMath';
import { AdvanceQuickModal } from './components/AdvanceQuickModal';
import { EmployeeCareerMovementModal } from './components/EmployeeCareerMovementModal';
import { SalaryCertificateModal, ContractModal, FinalSettlementModal } from './components/EmployeeDocModal';
import { LeaveFormModal } from './components/LeaveFormModal';
import { employeeDisplayName } from '../../utils/employeeDisplayName';
import { buildLeaveRequestStatusMap, buildResidencyRecordStatusMap, buildPayrollRunStatusMap } from '../../constants/badgeMaps';
import { EmployeeProfileLoading, EmployeeProfileNotFound } from './components/employeeProfile/EmployeeProfileStates';
import { EmployeeProfileHeaderBar } from './components/employeeProfile/EmployeeProfileHeaderBar';
import {
  EmployeeProfileBasicInfoCard,
  EmployeeProfileSalaryCard,
} from './components/employeeProfile/EmployeeProfileBasicAndSalaryCards';
import { EmployeeProfileCareerSection } from './components/employeeProfile/EmployeeProfileCareerSection';
import { EmployeeProfileFinancialSection } from './components/employeeProfile/EmployeeProfileFinancialSection';
import { EmployeeProfilePayrollSection } from './components/employeeProfile/EmployeeProfilePayrollSection';
import { EmployeeProfileLeaveSection } from './components/employeeProfile/EmployeeProfileLeaveSection';
import { EmployeeProfileAdvancesSection } from './components/employeeProfile/EmployeeProfileAdvancesSection';
import { EmployeeProfileResidencySection } from './components/employeeProfile/EmployeeProfileResidencySection';
import { EmployeeProfileDocumentsSection } from './components/employeeProfile/EmployeeProfileDocumentsSection';
import {
  buildCareerTableRows,
  buildFinancialRecords,
  buildSalaryRows,
} from './components/employeeProfile/employeeProfileModel';

export default function EmployeeProfileScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { activeCompanyId, companies, userPermissions } = useApp();
  const { t, lang } = useTranslation();
  const companyId = activeCompanyId ?? '';
  const canDeleteEmployee = Array.isArray(userPermissions) && userPermissions.includes('EMPLOYEES_DELETE');
  const canEditHrLeave = Array.isArray(userPermissions) && userPermissions.includes('HR_WRITE');
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
  const [editProfileLeave, setEditProfileLeave] = useState(null);
  const docFileRef = React.useRef(null);

  const { data: employee, isLoading, error } = useEmployee(id, companyId);
  const { createAdvance } = useEmployees(companyId, { includeTerminated: true });
  const { allowances: customAllowances = [] } = useCustomAllowances(companyId, id);

  const leaveProfileStatusMap = useMemo(() => buildLeaveRequestStatusMap(t), [t]);
  const residencyProfileStatusMap = useMemo(() => buildResidencyRecordStatusMap(t), [t]);
  const payrollRunStatusMap = useMemo(() => buildPayrollRunStatusMap(t), [t]);

  const { data: leaves = [] } = useQuery({
    queryKey: ['leaves', companyId, id],
    queryFn: async () => {
      const res = await getLeaves(companyId, id);
      if (!res?.success) return [];
      const d = res.data;
      return Array.isArray(d) ? d : d?.items ?? [];
    },
    enabled: !!companyId && !!id,
  });

  const { data: residencies = [] } = useQuery({
    queryKey: ['residencies', companyId, id],
    queryFn: async () => {
      const res = await getResidencies(companyId, id);
      if (!res?.success) return [];
      const d = res.data;
      return Array.isArray(d) ? d : d?.items ?? [];
    },
    enabled: !!companyId && !!id,
  });

  const { data: documents = [] } = useQuery({
    queryKey: ['documents', companyId, id],
    queryFn: async () => {
      const res = await getDocuments(companyId, id);
      if (!res?.success) return [];
      const d = res.data;
      const items = Array.isArray(d) ? d : d?.items ?? [];
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
        getInvoices(companyId, null, null, 1, 100, null, id, 'advance', null, null, null, null, null, null, false),
        getInvoices(companyId, null, null, 1, 100, null, id, 'hr_expense', null, null, null, null, null, null, false),
        getInvoices(companyId, null, null, 1, 100, null, id, 'salary', null, null, null, null, null, null, false),
      ]);
      const items = [];
      if (advRes?.success) {
        items.push(
          ...(advRes.data?.items ?? []).filter((i) => i.kind === 'advance' && i.status !== 'cancelled'),
        );
      }
      if (hrRes?.success) {
        items.push(
          ...(hrRes.data?.items ?? []).filter((i) => i.kind === 'hr_expense' && i.status !== 'cancelled'),
        );
      }
      if (salRes?.success) {
        items.push(
          ...(salRes.data?.items ?? []).filter((i) => i.kind === 'salary' && i.status !== 'cancelled'),
        );
      }
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
      return Array.isArray(d) ? d : d?.items ?? [];
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

  const { data: payrollItems = [] } = useQuery({
    queryKey: ['payroll-run-items', companyId, id],
    queryFn: async () => {
      const res = await getEmployeePayrollItems(companyId, id);
      if (!res?.success) return [];
      return Array.isArray(res.data) ? res.data : res.data?.items ?? [];
    },
    enabled: !!companyId && !!id,
  });

  const careerTableRows = useMemo(() => buildCareerTableRows(movements, t), [movements, t]);
  const advances = invoicesData?.items ?? [];
  const customAllowanceTotal = useMemo(
    () => customAllowances.reduce((sum, row) => sum + (Number(row.amount) || 0), 0),
    [customAllowances],
  );

  const financialRecords = useMemo(
    () => buildFinancialRecords(hrInvoicesData, deductions, t),
    [hrInvoicesData, deductions, t],
  );
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
    if (!window.confirm(t('deleteEmployeePermanentConfirm', employeeDisplayName(employee, lang, '') || '')))
      return;
    if (!window.confirm(t('deleteEmployeePermanentSecond'))) return;
    permanentDeleteEmployeeMut.mutate({ empId: employee.id });
  }

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['employee', id] });
    queryClient.invalidateQueries({ queryKey: ['custom-allowances', companyId, id] });
    queryClient.invalidateQueries({ queryKey: ['leaves', companyId, id] });
    queryClient.invalidateQueries({ queryKey: ['leave-salary-settlements', companyId] });
    queryClient.invalidateQueries({ queryKey: ['residencies', companyId, id] });
    queryClient.invalidateQueries({ queryKey: ['documents', companyId, id] });
    invalidateOnFinancialMutation(queryClient);
    queryClient.invalidateQueries({ queryKey: ['payroll-run-items', companyId, id] });
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
    return <EmployeeProfileLoading t={t} />;
  }
  if (error || !employee) {
    return <EmployeeProfileNotFound t={t} onBack={() => navigate('/hr')} />;
  }

  const empStatusMap = {
    active: { color: 'green', label: t('statusActive') },
    terminated: { color: 'red', label: t('statusTerminated') },
    archived: { color: 'gray', label: t('statusArchived') },
    on_leave: { color: 'amber', label: t('statusOnLeave') },
  };
  const advanceStatusMap = {
    settled: { color: 'green', label: t('advanceSettled') },
    cancelled: { color: 'gray', label: t('cancelled') },
    active: { color: 'amber', label: t('advanceOutstanding') },
  };
  const canShowCareerActions = canRecordCareer && ['active', 'on_leave'].includes(employee.status);

  const overtimeTotal = overtimePay(employee, customAllowanceTotal);
  const total = totalSalary(employee, customAllowanceTotal);
  const overtimeHoursPerDay = Math.max(0, parseWorkHours(employee?.workHours) - SAUDI_STANDARD_HOURS);
  const salaryRows = buildSalaryRows(
    employee,
    customAllowances,
    overtimeTotal,
    total,
    overtimeHoursPerDay,
    t,
  );

  return (
    <ScreenShell>
      <EmployeeProfileHeaderBar
        t={t}
        onBack={() => navigate('/hr')}
        onSalaryCert={() => setDocModal('salary')}
        onContract={() => setDocModal('contract')}
        onSettlement={() => setDocModal('settlement')}
        onPayAdvance={() => setShowAdvance(true)}
        onPermanentDelete={handlePermanentDeleteFromProfile}
        canDelete={canDeleteEmployee}
        canPayAdvance={employee.status === 'active'}
      />

      <div className="employee-profile-layout">
        <EmployeeProfileBasicInfoCard
          employee={employee}
          lang={lang}
          empStatusMap={empStatusMap}
          t={t}
        />
        <EmployeeProfileSalaryCard t={t} salaryRows={salaryRows} total={total} />
        <EmployeeProfileCareerSection
          t={t}
          careerTableRows={careerTableRows}
          canShowCareerActions={canShowCareerActions}
          onOpenPromotion={() => setCareerModal('promotion')}
          onOpenRaise={() => setCareerModal('raise')}
        />
        <EmployeeProfileFinancialSection t={t} financialRecords={financialRecords} />
        <EmployeeProfilePayrollSection
          t={t}
          payrollItems={payrollItems}
          payrollRunStatusMap={payrollRunStatusMap}
        />
        <EmployeeProfileLeaveSection
          t={t}
          leaves={leaves}
          leaveProfileStatusMap={leaveProfileStatusMap}
          canEditHrLeave={canEditHrLeave}
          onEditLeave={setEditProfileLeave}
        />
        <EmployeeProfileAdvancesSection t={t} advances={advances} advanceStatusMap={advanceStatusMap} />
        <EmployeeProfileResidencySection
          t={t}
          residencies={residencies}
          residencyProfileStatusMap={residencyProfileStatusMap}
        />
        <EmployeeProfileDocumentsSection
          t={t}
          documents={documents}
          uploading={uploading}
          fileInputRef={docFileRef}
          onFileChange={handleUploadDoc}
          onPickFile={() => docFileRef.current?.click()}
          onDownload={handleDownloadDoc}
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
          onSaved={() => {
            invalidateAll();
            showToast(t('documentUploaded'), 'success');
          }}
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
          onSaved={() => {
            invalidateAll();
            showToast(t('documentUploaded'), 'success');
          }}
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
          onSaved={() => {
            invalidateAll();
            showToast(t('documentUploaded'), 'success');
          }}
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
            invalidateOnFinancialMutation(queryClient);
            queryClient.invalidateQueries({ queryKey: ['employee', id, companyId] });
            queryClient.invalidateQueries({ queryKey: ['employees', companyId] });
            queryClient.invalidateQueries({ queryKey: ['employees-paged', companyId] });
            showToast(t('careerMovementSaved'), 'success');
          }}
        />
      )}
      {editProfileLeave && (
        <LeaveFormModal
          key={editProfileLeave.id}
          companyId={companyId}
          employeeId={id}
          editLeave={editProfileLeave}
          lockEmployeeSelector
          onSuccess={() => {
            invalidateAll();
            showToast(t('leaveUpdated'), 'success');
          }}
          onClose={() => setEditProfileLeave(null)}
        />
      )}
    </ScreenShell>
  );
}
