import type { ComponentProps } from 'react';
import { AdvanceQuickModal } from '../AdvanceQuickModal';
import { EmployeeCareerMovementModal } from '../EmployeeCareerMovementModal';
import { SalaryCertificateModal, ContractModal, FinalSettlementModal } from '../EmployeeDocModal';
import { LeaveFormModal } from '../LeaveFormModal';
import { ResidencyFormModal } from '../ResidencyFormModal';
import { StaffListModals } from '../StaffListModals';
import type { HrCompensationSnapshot, HrEmployee } from '../../../../types/api';
import type { ProfileRecord } from './employeeProfileModel';

type TranslationFn = (key: string, ...args: unknown[]) => string;
type DocumentModalKind = 'salary' | 'contract' | 'settlement' | null;
type CareerModalKind = ComponentProps<typeof EmployeeCareerMovementModal>['kind'];
type ProfileServiceAdd = { category: string } | null;

type EmployeeProfileModalsProps = {
  t: TranslationFn;
  employee: HrEmployee;
  employeeId?: string;
  companyId: string;
  companyName: string;
  companyLogo: string;
  compensationSnapshot: HrCompensationSnapshot;
  docModal: DocumentModalKind;
  onCloseDocModal: () => void;
  onDocumentSaved: () => void;
  showAdvance: boolean;
  createAdvance: ComponentProps<typeof AdvanceQuickModal>['createAdvance'];
  onCloseAdvance: () => void;
  onAdvanceSaved: () => void;
  careerModal: CareerModalKind;
  editRaiseMovement: ProfileRecord | null;
  onCloseCareerModal: () => void;
  onCareerSaved: (isEditRaise: boolean) => void;
  editProfileLeave: ProfileRecord | null;
  onLeaveSaved: () => void;
  onCloseProfileLeave: () => void;
  profileServiceAdd: ProfileServiceAdd;
  onServiceAdded: () => void;
  onCloseServiceAdd: () => void;
  editProfileResidency: ProfileRecord | null;
  onServiceUpdated: () => void;
  onCloseProfileResidency: () => void;
  onDeleteService: ComponentProps<typeof ResidencyFormModal>['onDelete'];
  staffListModalsProps: ComponentProps<typeof StaffListModals>;
};

export function EmployeeProfileModals({
  t,
  employee,
  employeeId,
  companyId,
  companyName,
  companyLogo,
  compensationSnapshot,
  docModal,
  onCloseDocModal,
  onDocumentSaved,
  showAdvance,
  createAdvance,
  onCloseAdvance,
  onAdvanceSaved,
  careerModal,
  editRaiseMovement,
  onCloseCareerModal,
  onCareerSaved,
  editProfileLeave,
  onLeaveSaved,
  onCloseProfileLeave,
  profileServiceAdd,
  onServiceAdded,
  onCloseServiceAdd,
  editProfileResidency,
  onServiceUpdated,
  onCloseProfileResidency,
  onDeleteService,
  staffListModalsProps,
}: EmployeeProfileModalsProps) {
  const documentModalProps = {
    employee,
    compensationSnapshot,
    companyId,
    companyName,
    companyLogo,
    onClose: onCloseDocModal,
    onSaved: onDocumentSaved,
  };

  return (
    <>
      {docModal === 'salary' && <SalaryCertificateModal {...documentModalProps} />}
      {docModal === 'contract' && <ContractModal {...documentModalProps} />}
      {docModal === 'settlement' && <FinalSettlementModal {...documentModalProps} />}
      {showAdvance && (
        <AdvanceQuickModal
          employee={employee}
          companyId={companyId}
          createAdvance={createAdvance}
          onSuccess={onAdvanceSaved}
          onClose={onCloseAdvance}
        />
      )}
      {(careerModal || editRaiseMovement) && (
        <EmployeeCareerMovementModal
          kind={editRaiseMovement ? 'raise' : careerModal}
          employee={employee}
          companyId={companyId}
          customAllowanceTotal={compensationSnapshot.customAllowances?.total ?? 0}
          currentTotalAllIn={compensationSnapshot.salaryPackage.total}
          editMovement={editRaiseMovement}
          onClose={onCloseCareerModal}
          onSuccess={() => onCareerSaved(!!editRaiseMovement)}
        />
      )}
      {editProfileLeave && (
        <LeaveFormModal
          key={editProfileLeave.id}
          companyId={companyId}
          employeeId={employeeId}
          editLeave={editProfileLeave}
          lockEmployeeSelector
          onSuccess={onLeaveSaved}
          onClose={onCloseProfileLeave}
        />
      )}
      {profileServiceAdd && employeeId && (
        <ResidencyFormModal
          key={`${profileServiceAdd.category}-${employeeId}`}
          companyId={companyId}
          defaultCategory={profileServiceAdd.category}
          defaultEmployeeId={employeeId}
          onSuccess={onServiceAdded}
          onClose={onCloseServiceAdd}
        />
      )}
      {editProfileResidency && (
        <ResidencyFormModal
          key={editProfileResidency.id}
          residency={editProfileResidency}
          companyId={companyId}
          defaultEmployeeId={employeeId}
          onSuccess={onServiceUpdated}
          onClose={onCloseProfileResidency}
          onDelete={onDeleteService}
        />
      )}
      <StaffListModals {...staffListModalsProps} />
    </>
  );
}
