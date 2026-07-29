import { useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { useTranslation } from '../../i18n/useTranslation';
import { useTabSearchParam } from '../../hooks/useTabSearchParam';
import { getSaudiToday } from '../../utils/saudiDate';
import { ScreenShell } from '../../ui';
import {
  EmployeeProfileCentralDataError,
  EmployeeProfileLoading,
  EmployeeProfileNotFound,
} from './components/employeeProfile/EmployeeProfileStates';
import { EmployeeProfileHeaderBar } from './components/employeeProfile/EmployeeProfileHeaderBar';
import {
  EmployeeProfileTabsPanel,
  EMPLOYEE_PROFILE_TAB_IDS,
  type EmployeeProfileTabId,
} from './components/employeeProfile/EmployeeProfileTabsPanel';
import { EmployeeProfileModals } from './components/employeeProfile/EmployeeProfileModals';
import { EmployeeProfileSummary } from './components/employeeProfile/EmployeeProfileSummary';
import { useEmployeeProfileActions } from './components/employeeProfile/useEmployeeProfileActions';
import { useEmployeeProfileData } from './components/employeeProfile/useEmployeeProfileData';

type HrProfileCompanyRef = {
  id?: string | null;
  name?: string | null;
  nameAr?: string | null;
  logoUrl?: string | null;
};

export default function EmployeeProfileScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { activeCompanyId, companies, userPermissions } = useApp();
  const { t, lang } = useTranslation();
  const { showToast } = useToast();
  const [activeProfileTab, setActiveProfileTab] = useTabSearchParam(
    EMPLOYEE_PROFILE_TAB_IDS,
    'overview',
    'employeeProfileTab',
    'tab',
  );

  const companyId = activeCompanyId ?? '';
  const canDeleteEmployee = Array.isArray(userPermissions) && userPermissions.includes('EMPLOYEES_DELETE');
  const canEditEmployee = Array.isArray(userPermissions) && userPermissions.includes('EMPLOYEES_WRITE');
  const canEditHrLeave = Array.isArray(userPermissions) && userPermissions.includes('HR_WRITE');
  const canRecordCareer =
    Array.isArray(userPermissions) &&
    userPermissions.includes('EMPLOYEES_WRITE') &&
    userPermissions.includes('HR_WRITE');
  const companyRefs = (companies as HrProfileCompanyRef[] | undefined) ?? [];
  const activeCompany = companyRefs.find((c) => c.id === companyId);
  const companyName = activeCompany?.nameAr || activeCompany?.name || '';
  const companyLogo = activeCompany?.logoUrl || '';

  const profileData = useEmployeeProfileData({ employeeId: id, companyId, t });
  const {
    employee,
    isLoading,
    error,
    compensationSnapshot,
    isCompensationSnapshotLoading,
    compensationSnapshotError,
    profileSectionError,
    leaveProfileStatusMap,
    residencyProfileStatusMap,
    payrollRunStatusMap,
    leaves,
    residencies,
    documents,
    movements,
    careerTableRows,
    financialRecords,
    employeePhotoUrl,
    setEmployeePhotoUrl,
    photoLoading,
    salaryRows,
    advances,
    payrollItems,
    profileSummary,
  } = profileData;

  const isCompanySelectionPending = !companyId || (companyRefs.length > 0 && !activeCompany);
  const isEmployeeProfileBootstrapping = !!id && isCompanySelectionPending;
  const handleBack = () => navigate('/hr');

  if (isEmployeeProfileBootstrapping || isLoading || isCompensationSnapshotLoading) {
    return <EmployeeProfileLoading t={t} />;
  }
  if (error || !employee) {
    return <EmployeeProfileNotFound t={t} onBack={handleBack} />;
  }
  if (compensationSnapshotError || !compensationSnapshot || !profileSummary) {
    return (
      <EmployeeProfileCentralDataError
        t={t}
        onBack={handleBack}
        message={compensationSnapshotError instanceof Error ? compensationSnapshotError.message : undefined}
      />
    );
  }
  if (profileSectionError) {
    return (
      <EmployeeProfileCentralDataError
        t={t}
        onBack={handleBack}
        message={profileSectionError instanceof Error ? profileSectionError.message : undefined}
      />
    );
  }

  return (
    <EmployeeProfileResolvedScreen
      id={id}
      companyId={companyId}
      companyName={companyName}
      companyLogo={companyLogo}
      employee={employee}
      compensationSnapshot={compensationSnapshot}
      lang={lang}
      t={t}
      showToast={showToast}
      canDeleteEmployee={canDeleteEmployee}
      canEditEmployee={canEditEmployee}
      canEditHrLeave={canEditHrLeave}
      canRecordCareer={canRecordCareer}
      activeProfileTab={activeProfileTab}
      onTabChange={setActiveProfileTab}
      onBack={handleBack}
      profileData={{
        leaveProfileStatusMap,
        residencyProfileStatusMap,
        payrollRunStatusMap,
        leaves,
        residencies,
        documents,
        movements,
        careerTableRows,
        financialRecords,
        employeePhotoUrl,
        setEmployeePhotoUrl,
        photoLoading,
        salaryRows,
        advances,
        payrollItems,
        profileSummary,
      }}
    />
  );
}

type EmployeeProfileResolvedScreenProps = {
  id?: string;
  companyId: string;
  companyName: string;
  companyLogo: string;
  employee: NonNullable<ReturnType<typeof useEmployeeProfileData>['employee']>;
  compensationSnapshot: NonNullable<ReturnType<typeof useEmployeeProfileData>['compensationSnapshot']>;
  lang: string;
  t: (key: string, ...args: unknown[]) => string;
  showToast: ReturnType<typeof useToast>['showToast'];
  canDeleteEmployee: boolean;
  canEditEmployee: boolean;
  canEditHrLeave: boolean;
  canRecordCareer: boolean;
  activeProfileTab: string;
  onTabChange: (tab: EmployeeProfileTabId) => void;
  onBack: () => void;
  profileData: Omit<Pick<
    ReturnType<typeof useEmployeeProfileData>,
    | 'leaveProfileStatusMap'
    | 'residencyProfileStatusMap'
    | 'payrollRunStatusMap'
    | 'leaves'
    | 'residencies'
    | 'documents'
    | 'movements'
    | 'careerTableRows'
    | 'financialRecords'
    | 'employeePhotoUrl'
    | 'setEmployeePhotoUrl'
    | 'photoLoading'
    | 'salaryRows'
    | 'advances'
    | 'payrollItems'
    | 'profileSummary'
  >, 'profileSummary'> & {
    profileSummary: NonNullable<ReturnType<typeof useEmployeeProfileData>['profileSummary']>;
  };
};

function EmployeeProfileResolvedScreen({
  id,
  companyId,
  companyName,
  companyLogo,
  employee,
  compensationSnapshot,
  lang,
  t,
  showToast,
  canDeleteEmployee,
  canEditEmployee,
  canEditHrLeave,
  canRecordCareer,
  activeProfileTab,
  onTabChange,
  onBack,
  profileData,
}: EmployeeProfileResolvedScreenProps) {
  const actions = useEmployeeProfileActions({
    employee,
    employeeId: id,
    companyId,
    lang,
    t,
    residencies: profileData.residencies,
    movements: profileData.movements,
    setEmployeePhotoUrl: profileData.setEmployeePhotoUrl,
    showToast,
  });
  const empStatusMap = {
    active: { color: 'green', label: t('statusActive') },
    terminated: { color: 'red', label: t('statusTerminated') },
    archived: { color: 'gray', label: t('statusArchived') },
    on_leave: { color: 'amber', label: t('statusOnLeave') },
  };
  const employeeStatus = String(employee.status ?? '');
  const canShowCareerActions = canRecordCareer && ['active', 'on_leave'].includes(employeeStatus);
  const normalizedActiveProfileTab: EmployeeProfileTabId = EMPLOYEE_PROFILE_TAB_IDS.includes(activeProfileTab as EmployeeProfileTabId)
    ? (activeProfileTab as EmployeeProfileTabId)
    : 'overview';

  return (
    <ScreenShell variant="form">
      <EmployeeProfileHeaderBar
        t={t}
        onBack={onBack}
        onSalaryCert={() => actions.setDocModal('salary')}
        onContract={() => actions.setDocModal('contract')}
        onSettlement={() => actions.setDocModal('settlement')}
        onPayAdvance={() => actions.setShowAdvance(true)}
        onEdit={() => actions.setEditingEmployee(employee)}
        onTerminate={() => {
          actions.setTerminationForm({ reason: '', clause: '', date: getSaudiToday() });
          actions.setTerminatingEmployee(employee);
        }}
        onArchive={actions.handleArchiveEmployeeFromProfile}
        onRestore={actions.handleRestoreEmployeeFromProfile}
        onPermanentDelete={actions.handlePermanentDeleteFromProfile}
        canEdit={canEditEmployee}
        canTerminate={canEditEmployee && employee.status !== 'terminated' && employee.status !== 'archived'}
        canArchive={canEditEmployee && employee.status !== 'archived'}
        canRestore={canEditEmployee && employee.status === 'archived'}
        canDelete={canDeleteEmployee}
        canPayAdvance={employee.status === 'active'}
      />

      <div className="employee-profile-shell">
        <EmployeeProfileSummary
          employee={employee}
          lang={lang}
          t={t}
          summary={profileData.profileSummary}
          empStatusMap={empStatusMap}
          photoUrl={profileData.employeePhotoUrl}
          photoLoading={profileData.photoLoading}
          canEditPhoto={canEditEmployee}
          photoBusy={actions.uploadEmployeePhotoMutation.isPending || actions.deleteEmployeePhotoMutation.isPending}
          onPhotoChange={actions.handleEmployeePhotoChange}
          onDeletePhoto={() => actions.deleteEmployeePhotoMutation.mutate()}
        />
        <EmployeeProfileTabsPanel
          t={t}
          lang={lang}
          activeProfileTab={normalizedActiveProfileTab}
          onTabChange={onTabChange}
          employee={employee}
          empStatusMap={empStatusMap}
          salaryRows={profileData.salaryRows}
          total={compensationSnapshot.salaryPackage.total}
          financialRecords={profileData.financialRecords}
          canEditHrLeave={canEditHrLeave}
          onOpenResidency={actions.openProfileResidency}
          payrollItems={profileData.payrollItems}
          payrollRunStatusMap={profileData.payrollRunStatusMap}
          leaves={profileData.leaves}
          leaveProfileStatusMap={profileData.leaveProfileStatusMap}
          onEditLeave={actions.setEditProfileLeave}
          residencies={profileData.residencies}
          residencyProfileStatusMap={profileData.residencyProfileStatusMap}
          onQuickAddService={(category: string) => actions.setProfileServiceAdd({ category })}
          onDeleteService={actions.handleDeleteService}
          documents={profileData.documents}
          uploading={actions.uploading}
          fileInputRef={actions.docFileRef}
          onUploadDocument={actions.handleUploadDoc}
          onPickDocument={() => actions.docFileRef.current?.click()}
          onDownloadDocument={actions.handleDownloadDoc}
          careerTableRows={profileData.careerTableRows}
          canShowCareerActions={canShowCareerActions}
          canRecordCareer={canRecordCareer}
          onOpenPromotion={() => actions.setCareerModal('promotion')}
          onOpenRaise={() => actions.setCareerModal('raise')}
          onEditRaise={actions.handleEditRaise}
          onDeleteRaise={actions.handleDeleteRaise}
        />
      </div>

      <EmployeeProfileModals
        t={t}
        employee={employee}
        employeeId={id}
        companyId={companyId}
        companyName={companyName}
        companyLogo={companyLogo}
        compensationSnapshot={compensationSnapshot}
        docModal={actions.docModal}
        onCloseDocModal={() => actions.setDocModal(null)}
        onDocumentSaved={() => {
          actions.invalidateAll();
          showToast(t('documentUploaded'), 'success');
        }}
        showAdvance={actions.showAdvance}
        createAdvance={actions.createAdvance}
        onCloseAdvance={() => actions.setShowAdvance(false)}
        onAdvanceSaved={() => {
          actions.invalidateAll();
          showToast(t('advancePaid'), 'success');
        }}
        careerModal={actions.careerModal}
        editRaiseMovement={actions.editRaiseMovement}
        onCloseCareerModal={() => {
          actions.setCareerModal(null);
          actions.setEditRaiseMovement(null);
        }}
        onCareerSaved={(isEditRaise) => {
          actions.invalidateAll();
          showToast(isEditRaise ? t('careerRaiseUpdated') : t('careerMovementSaved'), 'success');
        }}
        editProfileLeave={actions.editProfileLeave}
        onLeaveSaved={() => {
          actions.invalidateAll();
          showToast(t('leaveUpdated'), 'success');
        }}
        onCloseProfileLeave={() => actions.setEditProfileLeave(null)}
        profileServiceAdd={actions.profileServiceAdd}
        onServiceAdded={() => {
          actions.invalidateAll();
          showToast(t('hrServiceAdded'), 'success');
          actions.setProfileServiceAdd(null);
        }}
        onCloseServiceAdd={() => actions.setProfileServiceAdd(null)}
        editProfileResidency={actions.editProfileResidency}
        onServiceUpdated={() => {
          actions.invalidateAll();
          showToast(t('hrServiceUpdated'), 'success');
          actions.setEditProfileResidency(null);
        }}
        onCloseProfileResidency={() => actions.setEditProfileResidency(null)}
        onDeleteService={actions.handleDeleteService}
        staffListModalsProps={{
          t,
          companyId,
          companyName,
          showForm: false,
          setShowForm: () => undefined,
          editingEmployee: actions.editingEmployee,
          setEditingEmployee: actions.setEditingEmployee,
          advanceEmployee: null,
          setAdvanceEmployee: () => undefined,
          terminatingEmployee: actions.terminatingEmployee,
          setTerminatingEmployee: actions.setTerminatingEmployee,
          terminationSettlementEmp: actions.terminationSettlementEmp,
          setTerminationSettlementEmp: actions.setTerminationSettlementEmp,
          terminationForm: actions.terminationForm,
          setTerminationForm: actions.setTerminationForm,
          handleSave: actions.handleSaveProfileEmployee,
          create: { isPending: false },
          update: actions.update,
          createAdvance: actions.createAdvance,
          queryClient: actions.queryClient,
          showToast,
        }}
      />
    </ScreenShell>
  );
}
