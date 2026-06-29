/**
 * EmployeeProfileScreen — صفحة ملف الموظف (المنطق والتنسيق في مكوّنات employeeProfile/*)
 */
import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useApiMutation } from '../../hooks/useApiMutation';
import { useApiListQuery } from '../../hooks/useApiQuery';
import { invalidateOnFinancialMutation } from '../../utils/queryInvalidation';
import { useEmployee, useEmployees } from '../../hooks/useEmployees';
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
  getEmployeeCompensationSnapshot,
  throwIfApiFailed,
  uploadDocumentFile,
  downloadDocument,
  deleteEmployee,
  deleteResidency,
  deleteRaiseMovement,
  unwrapApiList,
} from '../../services/api';
import { ScreenShell } from '../../ui';
import { AdvanceQuickModal } from './components/AdvanceQuickModal';
import { EmployeeCareerMovementModal } from './components/EmployeeCareerMovementModal';
import { SalaryCertificateModal, ContractModal, FinalSettlementModal } from './components/EmployeeDocModal';
import { LeaveFormModal } from './components/LeaveFormModal';
import { ResidencyFormModal } from './components/ResidencyFormModal';
import { employeeDisplayName } from '../../utils/employeeDisplayName';
import {
  buildAdvanceSettlementStatusMap,
  buildLeaveRequestStatusMap,
  buildResidencyRecordStatusMap,
  buildPayrollRunStatusMap,
} from '../../constants/badgeMaps';
import {
  EmployeeProfileCentralDataError,
  EmployeeProfileLoading,
  EmployeeProfileNotFound,
} from './components/employeeProfile/EmployeeProfileStates';
import { EmployeeProfileHeaderBar } from './components/employeeProfile/EmployeeProfileHeaderBar';
import {
  EmployeeProfileBasicInfoCard,
  EmployeeProfileSalaryCard,
} from './components/employeeProfile/EmployeeProfileBasicAndSalaryCards';
import { EmployeeProfileCareerSection } from './components/employeeProfile/EmployeeProfileCareerSection';
import { EmployeeProfileFinancialSection } from './components/employeeProfile/EmployeeProfileFinancialSection';
import { EmployeeProfilePayrollSection } from './components/employeeProfile/EmployeeProfilePayrollSection';
import { EmployeeProfileLeaveSection } from './components/employeeProfile/EmployeeProfileLeaveSection';
import { employeeKeys, hrKeys, invoiceKeys } from '../../services/queryKeys';
import { EmployeeProfileAdvancesSection } from './components/employeeProfile/EmployeeProfileAdvancesSection';
import { EmployeeProfileResidencySection } from './components/employeeProfile/EmployeeProfileResidencySection';
import { EmployeeProfileDocumentsSection } from './components/employeeProfile/EmployeeProfileDocumentsSection';
import {
  buildCareerTableRows,
  buildFinancialRecords,
  buildSalaryRows,
} from './components/employeeProfile/employeeProfileModel';
import { normalizeAdvances } from './utils/advanceBalance';

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
  const activeCompany = companies?.find((c: any) => c.id === companyId);
  const companyName = activeCompany?.nameAr || activeCompany?.name || '';
  const companyLogo = activeCompany?.logoUrl || '';
  const [showAdvance, setShowAdvance] = useState(false);
  const [careerModal, setCareerModal] = useState<any>(null);
  const [editRaiseMovement, setEditRaiseMovement] = useState<any>(null);
  const [docModal, setDocModal] = useState<any>(null);
  const { showToast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [editProfileLeave, setEditProfileLeave] = useState<any>(null);
  const [editProfileResidency, setEditProfileResidency] = useState<any>(null);
  const [profileServiceAdd, setProfileServiceAdd] = useState<{ category: string } | null>(null);
  const docFileRef = React.useRef<any>(null);

  const { data: employee, isLoading, error } = useEmployee(id, companyId);
  const { createAdvance } = useEmployees(companyId, { includeTerminated: true });
  const {
    data: compensationSnapshot,
    isLoading: isCompensationSnapshotLoading,
    error: compensationSnapshotError,
  } = useQuery({
    queryKey: hrKeys.compensationSnapshot(companyId, id),
    queryFn: async () => {
      if (!id) throw new Error('Employee id is required.');
      const res = await getEmployeeCompensationSnapshot(companyId, id);
      throwIfApiFailed(res, 'فشل تحميل بيانات HR المركزية');
      return res.data;
    },
    enabled: !!companyId && !!id,
  });

  const leaveProfileStatusMap = useMemo(() => buildLeaveRequestStatusMap(t), [t]);
  const residencyProfileStatusMap = useMemo(() => buildResidencyRecordStatusMap(t), [t]);
  const payrollRunStatusMap = useMemo(() => buildPayrollRunStatusMap(t), [t]);

  const { data: leaves = [], error: leavesError } = useApiListQuery<any>({
    queryKey: hrKeys.leavesByEmployee(companyId, id),
    queryFn: () => getLeaves(companyId, id),
    fallbackMessage: 'فشل تحميل إجازات الموظف',
    enabled: !!companyId && !!id,
  });

  const { data: residencies = [], error: residenciesError } = useApiListQuery<any>({
    queryKey: hrKeys.residenciesByEmployee(companyId, id),
    queryFn: () => getResidencies(companyId, id),
    fallbackMessage: 'فشل تحميل خدمات الموظف',
    enabled: !!companyId && !!id,
  });

  const { data: documents = [], error: documentsError } = useApiListQuery<any, any[]>({
    queryKey: hrKeys.documents(companyId, id),
    queryFn: () => getDocuments(companyId, id),
    fallbackMessage: 'فشل تحميل مستندات الموظف',
    select: (items) =>
      [...items].sort((a: any, b: any) => {
        const ad = new Date(a?.updatedAt || a?.createdAt || 0).getTime();
        const bd = new Date(b?.updatedAt || b?.createdAt || 0).getTime();
        return bd - ad;
      }),
    enabled: !!companyId && !!id,
  });

  const { data: hrInvoicesData, error: hrInvoicesError } = useQuery({
    queryKey: invoiceKeys.hrAllForEmployee(companyId, id),
    queryFn: async () => {
      const [advRes, hrRes, salRes] = await Promise.all([
        getInvoices(companyId, undefined, undefined, 1, 100, null, id, 'advance', undefined, undefined, undefined, undefined, undefined, undefined, false),
        getInvoices(companyId, undefined, undefined, 1, 100, null, id, 'hr_expense', undefined, undefined, undefined, undefined, undefined, undefined, false),
        getInvoices(companyId, undefined, undefined, 1, 100, null, id, 'salary', undefined, undefined, undefined, undefined, undefined, undefined, false),
      ]);
      const items = [];
      items.push(
        ...unwrapApiList<any>(advRes, 'فشل تحميل سلف الموظف').filter((i: any) => i.kind === 'advance' && i.status !== 'cancelled'),
        ...unwrapApiList<any>(hrRes, 'فشل تحميل مصروفات HR للموظف').filter((i: any) => i.kind === 'hr_expense' && i.status !== 'cancelled'),
        ...unwrapApiList<any>(salRes, 'فشل تحميل رواتب الموظف').filter((i: any) => i.kind === 'salary' && i.status !== 'cancelled'),
      );
      return { items };
    },
    enabled: !!companyId && !!id,
  });

  const { data: deductions = [], error: deductionsError } = useApiListQuery<any>({
    queryKey: hrKeys.deductions(companyId, id),
    queryFn: () => getDeductions(companyId, id),
    fallbackMessage: 'فشل تحميل خصومات الموظف',
    enabled: !!companyId && !!id,
  });

  const { data: movements = [], error: movementsError } = useApiListQuery<any>({
    queryKey: hrKeys.movementsByEmployee(companyId, id),
    queryFn: () => getMovements(companyId, id),
    fallbackMessage: 'فشل تحميل حركات الموظف',
    enabled: !!companyId && !!id,
  });

  const careerTableRows = useMemo(() => buildCareerTableRows(movements, t), [movements, t]);
  const advanceStatusMap = useMemo(() => buildAdvanceSettlementStatusMap(t), [t]);

  const financialRecords = useMemo(
    () => buildFinancialRecords(hrInvoicesData, deductions, t, residencies),
    [hrInvoicesData, deductions, t, residencies],
  );
  const queryClient = useQueryClient();

  const deleteServiceMutation = useApiMutation({
    mutationFn: ({ serviceId, voidInvoice }: { serviceId: string; voidInvoice?: boolean }) =>
      deleteResidency(serviceId, companyId, !!voidInvoice),
    successToast: () => t('hrServiceDeleted'),
    errorToast: (e: any) => e?.message || t('saveFailed'),
    onSuccess: () => {
      setEditProfileResidency(null);
      invalidateAll();
    },
  });

  const handleDeleteService = (row: any) => {
    const msg = row.invoiceId
      ? t('deleteHrServiceWithInvoice')
      : t('deleteHrServiceConfirm');
    if (!window.confirm(msg)) return;
    deleteServiceMutation.mutate({ serviceId: row.id, voidInvoice: !!row.invoiceId });
  };

  const openProfileResidency = (rowOrId: any) => {
    const target = typeof rowOrId === 'string'
      ? residencies.find((r: any) => r.id === rowOrId)
      : rowOrId;
    if (target) setEditProfileResidency(target);
  };

  const permanentDeleteEmployeeMut = useApiMutation({
    mutationFn: ({ empId }: any) => deleteEmployee(empId, companyId),
    successToast: () => t('employeeDeletedPermanent'),
    errorToast: (e: any) => e?.message || t('updateFailed'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: employeeKeys.detail(id, companyId) });
      queryClient.invalidateQueries({ queryKey: employeeKeys.root() });
      queryClient.invalidateQueries({ queryKey: employeeKeys.pagedByCompany(companyId) });
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
    queryClient.invalidateQueries({ queryKey: employeeKeys.detailPartial(id) });
    queryClient.invalidateQueries({ queryKey: hrKeys.customAllowances(companyId, String(id)) });
    queryClient.invalidateQueries({ queryKey: hrKeys.leavesByEmployee(companyId, id) });
    queryClient.invalidateQueries({ queryKey: hrKeys.leaveSalarySettlements(companyId) });
    queryClient.invalidateQueries({ queryKey: hrKeys.residenciesByEmployee(companyId, id) });
    queryClient.invalidateQueries({ queryKey: hrKeys.documents(companyId, id) });
    queryClient.invalidateQueries({ queryKey: hrKeys.movementsByEmployee(companyId, id) });
    queryClient.invalidateQueries({ queryKey: hrKeys.compensationSnapshot(companyId, id) });
    invalidateOnFinancialMutation(queryClient);
    queryClient.invalidateQueries({ queryKey: hrKeys.payrollRunItems(companyId, id) });
  };

  const deleteRaiseMut = useApiMutation({
    mutationFn: (movementId: string) => deleteRaiseMovement(movementId, companyId),
    successToast: () => t('careerRaiseDeleted'),
    errorToast: (e: any) => e?.message || t('saveFailed'),
    onSuccess: () => {
      setEditRaiseMovement(null);
      invalidateAll();
    },
  });

  const handleEditRaise = (row: { id?: string }) => {
    const movement = movements.find((m: any) => m.id === row.id);
    if (movement?.movementType === 'raise') setEditRaiseMovement(movement);
  };

  const handleDeleteRaise = (row: { id?: string }) => {
    if (!row.id || !window.confirm(t('deleteRaiseConfirm'))) return;
    deleteRaiseMut.mutate(row.id);
  };

  const handleUploadDoc = async (e: any) => {
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
      throwIfApiFailed(res, t('saveFailed'));
      invalidateAll();
      showToast(t('documentUploaded'), 'success');
    } catch (err: any) {
      showToast(err?.message || t('saveFailed'), 'error');
    } finally {
      setUploading(false);
      if (docFileRef.current) docFileRef.current.value = '';
    }
  };

  const handleDownloadDoc = async (docId: any) => {
    try {
      await downloadDocument(docId, companyId);
    } catch (err: any) {
      showToast(err?.message || 'فشل التحميل', 'error');
    }
  };

  if (isLoading || isCompensationSnapshotLoading) {
    return <EmployeeProfileLoading t={t} />;
  }
  if (error || !employee) {
    return <EmployeeProfileNotFound t={t} onBack={() => navigate('/hr')} />;
  }
  if (compensationSnapshotError || !compensationSnapshot) {
    return (
      <EmployeeProfileCentralDataError
        t={t}
        onBack={() => navigate('/hr')}
        message={compensationSnapshotError instanceof Error ? compensationSnapshotError.message : undefined}
      />
    );
  }
  const profileSectionError =
    leavesError || residenciesError || documentsError || hrInvoicesError || deductionsError || movementsError;
  if (profileSectionError) {
    return (
      <EmployeeProfileCentralDataError
        t={t}
        onBack={() => navigate('/hr')}
        message={profileSectionError instanceof Error ? profileSectionError.message : undefined}
      />
    );
  }

  const empStatusMap = {
    active: { color: 'green', label: t('statusActive') },
    terminated: { color: 'red', label: t('statusTerminated') },
    archived: { color: 'gray', label: t('statusArchived') },
    on_leave: { color: 'amber', label: t('statusOnLeave') },
  };
  const canShowCareerActions = canRecordCareer && ['active', 'on_leave'].includes(employee.status);

  const total = compensationSnapshot.salaryPackage.total;
  const salaryRows = buildSalaryRows(compensationSnapshot, t);
  const advances = normalizeAdvances(compensationSnapshot.advances.items ?? []);
  const payrollItems = compensationSnapshot.payrollItems ?? [];

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
          canEditRaise={canRecordCareer}
          onOpenPromotion={() => setCareerModal('promotion')}
          onOpenRaise={() => setCareerModal('raise')}
          onEditRaise={handleEditRaise}
          onDeleteRaise={handleDeleteRaise}
        />
        <EmployeeProfileFinancialSection
          t={t}
          financialRecords={financialRecords}
          onOpenResidency={canEditHrLeave ? openProfileResidency : undefined}
        />
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
          canAddService={canEditHrLeave}
          canEditService={canEditHrLeave}
          onQuickAdd={(category: string) => setProfileServiceAdd({ category })}
          onOpenService={canEditHrLeave ? openProfileResidency : undefined}
          onDeleteService={canEditHrLeave ? handleDeleteService : undefined}
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
          compensationSnapshot={compensationSnapshot}
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
          compensationSnapshot={compensationSnapshot}
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
          compensationSnapshot={compensationSnapshot}
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
      {(careerModal || editRaiseMovement) && (
        <EmployeeCareerMovementModal
          kind={editRaiseMovement ? 'raise' : careerModal}
          employee={employee}
          companyId={companyId}
          customAllowanceTotal={compensationSnapshot.customAllowances.total}
          currentTotalAllIn={compensationSnapshot.salaryPackage.total}
          editMovement={editRaiseMovement}
          onClose={() => {
            setCareerModal(null);
            setEditRaiseMovement(null);
          }}
          onSuccess={() => {
            invalidateAll();
            showToast(editRaiseMovement ? t('careerRaiseUpdated') : t('careerMovementSaved'), 'success');
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
      {profileServiceAdd && id && (
        <ResidencyFormModal
          key={`${profileServiceAdd.category}-${id}`}
          companyId={companyId}
          defaultCategory={profileServiceAdd.category}
          defaultEmployeeId={id}
          onSuccess={() => {
            invalidateAll();
            showToast(t('hrServiceAdded'), 'success');
            setProfileServiceAdd(null);
          }}
          onClose={() => setProfileServiceAdd(null)}
        />
      )}
      {editProfileResidency && (
        <ResidencyFormModal
          key={editProfileResidency.id}
          residency={editProfileResidency}
          companyId={companyId}
          defaultEmployeeId={id}
          onSuccess={() => {
            invalidateAll();
            showToast(t('hrServiceUpdated'), 'success');
            setEditProfileResidency(null);
          }}
          onClose={() => setEditProfileResidency(null)}
          onDelete={handleDeleteService}
        />
      )}
    </ScreenShell>
  );
}
