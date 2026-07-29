import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useApiMutation } from '../../../../hooks/useApiMutation';
import { useEmployees } from '../../../../hooks/useEmployees';
import { invalidateOnFinancialMutation } from '../../../../utils/queryInvalidation';
import { getSaudiToday } from '../../../../utils/saudiDate';
import {
  deleteEmployee,
  deleteEmployeePhoto,
  deleteRaiseMovement,
  deleteResidency,
  downloadDocument,
  throwIfApiFailed,
  uploadDocumentFile,
  uploadEmployeePhoto,
} from '../../../../services/api';
import { employeeKeys, hrKeys } from '../../../../services/queryKeys';
import { employeeDisplayName } from '../../../../utils/employeeDisplayName';
import type { ToastContextValue } from '../../../../context/ToastContext';
import type { HrEmployee } from '../../../../types/api';
import { syncCustomAllowanceRows, type HrStaffSavePayload } from '../../staffListDataOps';
import { composeEmployeeNotes, parseEmployeeNotesMeta } from '../../utils/employeeNotesMeta';
import type { ProfileRecord } from './employeeProfileModel';

export function getEmployeeProfileErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

type UseEmployeeProfileActionsParams = {
  employee: HrEmployee;
  employeeId?: string;
  companyId: string;
  lang: string;
  t: (key: string, ...args: unknown[]) => string;
  residencies: ProfileRecord[];
  movements: ProfileRecord[];
  setEmployeePhotoUrl: (value: string) => void;
  showToast: ToastContextValue['showToast'];
};

export function useEmployeeProfileActions({
  employee,
  employeeId,
  companyId,
  lang,
  t,
  residencies,
  movements,
  setEmployeePhotoUrl,
  showToast,
}: UseEmployeeProfileActionsParams) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { update, createAdvance } = useEmployees(companyId, { includeTerminated: true });
  const [showAdvance, setShowAdvance] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<HrEmployee | null>(null);
  const [terminatingEmployee, setTerminatingEmployee] = useState<HrEmployee | null>(null);
  const [terminationSettlementEmp, setTerminationSettlementEmp] = useState<HrEmployee | null>(null);
  const [terminationForm, setTerminationForm] = useState({ reason: '', clause: '', date: getSaudiToday() });
  const [careerModal, setCareerModal] = useState<'movement' | 'promotion' | 'raise' | null>(null);
  const [editRaiseMovement, setEditRaiseMovement] = useState<ProfileRecord | null>(null);
  const [docModal, setDocModal] = useState<'salary' | 'contract' | 'settlement' | null>(null);
  const [uploading, setUploading] = useState(false);
  const [editProfileLeave, setEditProfileLeave] = useState<ProfileRecord | null>(null);
  const [editProfileResidency, setEditProfileResidency] = useState<ProfileRecord | null>(null);
  const [profileServiceAdd, setProfileServiceAdd] = useState<{ category: string } | null>(null);
  const docFileRef = React.useRef<HTMLInputElement | null>(null);

  const invalidateEmployeeProfile = () => {
    if (!employee.id || !companyId) return;
    queryClient.invalidateQueries({ queryKey: employeeKeys.detail(employee.id, companyId) });
    queryClient.invalidateQueries({ queryKey: employeeKeys.root() });
    queryClient.invalidateQueries({ queryKey: employeeKeys.pagedByCompany(companyId) });
  };

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: employeeKeys.detailPartial(employeeId) });
    queryClient.invalidateQueries({ queryKey: hrKeys.customAllowances(companyId, String(employeeId)) });
    queryClient.invalidateQueries({ queryKey: hrKeys.leavesByEmployee(companyId, employeeId) });
    queryClient.invalidateQueries({ queryKey: hrKeys.leaveSalarySettlements(companyId) });
    queryClient.invalidateQueries({ queryKey: hrKeys.residenciesByEmployee(companyId, employeeId) });
    queryClient.invalidateQueries({ queryKey: hrKeys.documents(companyId, employeeId) });
    queryClient.invalidateQueries({ queryKey: hrKeys.movementsByEmployee(companyId, employeeId) });
    queryClient.invalidateQueries({ queryKey: hrKeys.compensationSnapshot(companyId, employeeId) });
    invalidateOnFinancialMutation(queryClient);
    queryClient.invalidateQueries({ queryKey: hrKeys.payrollRunItems(companyId, employeeId) });
  };

  const uploadEmployeePhotoMutation = useApiMutation({
    mutationFn: (file: File) => {
      if (!employee.id) throw new Error(t('saveFailed'));
      return uploadEmployeePhoto(employee.id, companyId, file);
    },
    successToast: () => (lang === 'ar' ? 'تم تحديث صورة الموظف' : 'Employee photo updated'),
    errorToast: (e: unknown) => getEmployeeProfileErrorMessage(e, t('saveFailed')),
    onSuccess: invalidateEmployeeProfile,
  });

  const deleteEmployeePhotoMutation = useApiMutation({
    mutationFn: () => {
      if (!employee.id) throw new Error(t('saveFailed'));
      return deleteEmployeePhoto(employee.id, companyId);
    },
    successToast: () => (lang === 'ar' ? 'تم حذف صورة الموظف' : 'Employee photo removed'),
    errorToast: (e: unknown) => getEmployeeProfileErrorMessage(e, t('saveFailed')),
    onSuccess: () => {
      setEmployeePhotoUrl('');
      invalidateEmployeeProfile();
    },
  });

  const deleteServiceMutation = useApiMutation({
    mutationFn: ({ serviceId, voidInvoice }: { serviceId: string; voidInvoice?: boolean }) =>
      deleteResidency(serviceId, companyId, !!voidInvoice),
    successToast: () => t('hrServiceDeleted'),
    errorToast: (e: unknown) => getEmployeeProfileErrorMessage(e, t('saveFailed')),
    onSuccess: () => {
      setEditProfileResidency(null);
      invalidateAll();
    },
  });

  const permanentDeleteEmployeeMut = useApiMutation({
    mutationFn: ({ empId }: { empId: string }) => deleteEmployee(empId, companyId),
    successToast: () => t('employeeDeletedPermanent'),
    errorToast: (e: unknown) => getEmployeeProfileErrorMessage(e, t('updateFailed')),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: employeeKeys.detail(employeeId, companyId) });
      queryClient.invalidateQueries({ queryKey: employeeKeys.root() });
      queryClient.invalidateQueries({ queryKey: employeeKeys.pagedByCompany(companyId) });
      invalidateOnFinancialMutation(queryClient);
      navigate('/hr');
    },
  });

  const deleteRaiseMut = useApiMutation({
    mutationFn: (movementId: string) => deleteRaiseMovement(movementId, companyId),
    successToast: () => t('careerRaiseDeleted'),
    errorToast: (e: unknown) => getEmployeeProfileErrorMessage(e, t('saveFailed')),
    onSuccess: () => {
      setEditRaiseMovement(null);
      invalidateAll();
    },
  });

  const handleEmployeePhotoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file || !employee.id || !companyId) return;
    uploadEmployeePhotoMutation.mutate(file, {
      onSettled: () => {
        input.value = '';
      },
    });
  };

  const handleDeleteService = (row: ProfileRecord) => {
    if (!row.id) return;
    const msg = row.invoiceId ? t('deleteHrServiceWithInvoice') : t('deleteHrServiceConfirm');
    if (!window.confirm(msg)) return;
    deleteServiceMutation.mutate({ serviceId: row.id, voidInvoice: !!row.invoiceId });
  };

  const openProfileResidency = (rowOrId: string | ProfileRecord) => {
    const target = typeof rowOrId === 'string' ? residencies.find((r) => r.id === rowOrId) : rowOrId;
    if (target) setEditProfileResidency(target);
  };

  function handlePermanentDeleteFromProfile() {
    if (!employee.id || !companyId) return;
    if (!window.confirm(t('deleteEmployeePermanentConfirm', employeeDisplayName(employee, lang, '') || ''))) return;
    if (!window.confirm(t('deleteEmployeePermanentSecond'))) return;
    permanentDeleteEmployeeMut.mutate({ empId: employee.id });
  }

  function handleSaveProfileEmployee(payload: HrStaffSavePayload | Record<string, unknown>) {
    if (!editingEmployee?.id || !companyId) return;
    const { employeeBody, customAllowances: customRows = [] } = payload && 'employeeBody' in payload
      ? payload as HrStaffSavePayload
      : { employeeBody: payload, customAllowances: [] };
    update.mutate(
      { id: editingEmployee.id, body: employeeBody },
      {
        onSuccess: async () => {
          try {
            await syncCustomAllowanceRows({ companyId, employeeId: editingEmployee.id, desiredRows: customRows, queryClient, t });
            showToast(t('employeeUpdated'), 'success');
            setEditingEmployee(null);
            invalidateAll();
            invalidateEmployeeProfile();
          } catch (e: unknown) {
            showToast(getEmployeeProfileErrorMessage(e, t('saveFailed')), 'error');
          }
        },
        onError: (e: unknown) => showToast(getEmployeeProfileErrorMessage(e, t('updateFailed')), 'error'),
      },
    );
  }

  function handleArchiveEmployeeFromProfile() {
    if (!employee.id || !companyId) return;
    const parsed = parseEmployeeNotesMeta(employee.notes);
    update.mutate(
      { id: employee.id, body: { status: 'archived', notes: composeEmployeeNotes(parsed.notesText, parsed.meta) } },
      {
        onSuccess: () => {
          showToast(t('employeeArchived'), 'success');
          invalidateAll();
          invalidateEmployeeProfile();
        },
        onError: (e: unknown) => showToast(getEmployeeProfileErrorMessage(e, t('updateFailed')), 'error'),
      },
    );
  }

  function handleRestoreEmployeeFromProfile() {
    if (!employee.id || !companyId) return;
    const parsed = parseEmployeeNotesMeta(employee.notes);
    update.mutate(
      { id: employee.id, body: { status: 'active', notes: composeEmployeeNotes(parsed.notesText, parsed.meta) } },
      {
        onSuccess: () => {
          showToast(t('employeeRestored'), 'success');
          invalidateAll();
          invalidateEmployeeProfile();
        },
        onError: (e: unknown) => showToast(getEmployeeProfileErrorMessage(e, t('updateFailed')), 'error'),
      },
    );
  }

  const handleEditRaise = (row: { id?: string }) => {
    const movement = movements.find((m) => m.id === row.id);
    if (movement?.movementType === 'raise') setEditRaiseMovement(movement);
  };

  const handleDeleteRaise = (row: { id?: string }) => {
    if (!row.id || !window.confirm(t('deleteRaiseConfirm'))) return;
    deleteRaiseMut.mutate(row.id);
  };

  const handleUploadDoc = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !employeeId || !companyId) return;
    setUploading(true);
    try {
      const res = await uploadDocumentFile({ companyId, employeeId, documentType: 'other', file });
      throwIfApiFailed(res, t('saveFailed'));
      invalidateAll();
      showToast(t('documentUploaded'), 'success');
    } catch (err: unknown) {
      showToast(getEmployeeProfileErrorMessage(err, t('saveFailed')), 'error');
    } finally {
      setUploading(false);
      if (docFileRef.current) docFileRef.current.value = '';
    }
  };

  const handleDownloadDoc = async (docId: string) => {
    try {
      await downloadDocument(docId, companyId);
    } catch (err: unknown) {
      showToast(getEmployeeProfileErrorMessage(err, 'فشل التحميل'), 'error');
    }
  };

  return {
    queryClient,
    update,
    createAdvance,
    showAdvance,
    setShowAdvance,
    editingEmployee,
    setEditingEmployee,
    terminatingEmployee,
    setTerminatingEmployee,
    terminationSettlementEmp,
    setTerminationSettlementEmp,
    terminationForm,
    setTerminationForm,
    careerModal,
    setCareerModal,
    editRaiseMovement,
    setEditRaiseMovement,
    docModal,
    setDocModal,
    uploading,
    editProfileLeave,
    setEditProfileLeave,
    editProfileResidency,
    setEditProfileResidency,
    profileServiceAdd,
    setProfileServiceAdd,
    docFileRef,
    uploadEmployeePhotoMutation,
    deleteEmployeePhotoMutation,
    invalidateAll,
    handleEmployeePhotoChange,
    handleDeleteService,
    openProfileResidency,
    handlePermanentDeleteFromProfile,
    handleSaveProfileEmployee,
    handleArchiveEmployeeFromProfile,
    handleRestoreEmployeeFromProfile,
    handleEditRaise,
    handleDeleteRaise,
    handleUploadDoc,
    handleDownloadDoc,
  };
}
