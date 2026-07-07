import React from 'react';
import { Button, DateField, Input, Modal } from '../../../ui';
import { StaffFormModal } from './StaffFormModal';
import { AdvanceQuickModal } from './AdvanceQuickModal';
import type { AdvanceCreateMutation } from './AdvanceQuickModal';
import TerminationSettlementModal from './TerminationSettlementModal';
import { getSaudiToday } from '../../../utils/saudiDate';
import { composeEmployeeNotes, parseEmployeeNotesMeta } from '../utils/employeeNotesMeta';
import { invalidateOnFinancialMutation } from '../../../utils/queryInvalidation';
import type { QueryClient } from '@tanstack/react-query';
import type { HrEmployee, HrMutationPayload } from '../../../types/api';

type TranslationFn = (key: string, ...args: unknown[]) => string;
type ToastVariant = 'success' | 'error' | 'info' | 'warning';
type TerminationFormState = { reason: string; clause: string; date: string };
type TerminationFormUpdater = TerminationFormState | ((previous: TerminationFormState) => TerminationFormState);
type MutationCallbacks = {
  onSuccess?: () => void;
  onError?: (error: unknown) => void;
};
type MutationLike<TVariables> = {
  isPending?: boolean;
  mutate: (variables: TVariables, callbacks?: MutationCallbacks) => void;
};
type EmployeeUpdateVariables = {
  id: string;
  body: HrMutationPayload;
};

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

type StaffListModalsProps = {
  t: TranslationFn;
  companyId: string;
  companyName: string;
  showForm: boolean;
  setShowForm: (value: boolean) => void;
  editingEmployee: HrEmployee | null;
  setEditingEmployee: (value: HrEmployee | null) => void;
  advanceEmployee: HrEmployee | null;
  setAdvanceEmployee: (value: HrEmployee | null) => void;
  terminatingEmployee: HrEmployee | null;
  setTerminatingEmployee: (value: HrEmployee | null) => void;
  terminationSettlementEmp: HrEmployee | null;
  setTerminationSettlementEmp: (value: HrEmployee | null) => void;
  terminationForm: TerminationFormState;
  setTerminationForm: (updater: TerminationFormUpdater) => void;
  handleSave: (payload: Record<string, unknown>) => void;
  create: { isPending?: boolean };
  update: MutationLike<EmployeeUpdateVariables>;
  createAdvance: AdvanceCreateMutation;
  queryClient: QueryClient;
  showToast: (message: string, variant?: ToastVariant) => void;
};

export function StaffListModals({
  t,
  companyId,
  companyName,
  showForm,
  setShowForm,
  editingEmployee,
  setEditingEmployee,
  advanceEmployee,
  setAdvanceEmployee,
  terminatingEmployee,
  setTerminatingEmployee,
  terminationSettlementEmp,
  setTerminationSettlementEmp,
  terminationForm,
  setTerminationForm,
  handleSave,
  create,
  update,
  createAdvance,
  queryClient,
  showToast,
}: StaffListModalsProps) {
  const terminationReasonOptions = [
    t('terminationReasonOptionArt80'),
    t('terminationReasonOptionArt77'),
    t('terminationReasonOptionContractEnd'),
    t('terminationReasonOptionResignation'),
    t('terminationReasonOptionAbsence'),
  ];

  return (
    <>
      {showForm && (
        <StaffFormModal
          employee={null}
          companyId={companyId}
          onSave={handleSave}
          onClose={() => setShowForm(false)}
          isSaving={Boolean(create.isPending)}
        />
      )}

      {editingEmployee && !showForm && (
        <StaffFormModal
          employee={editingEmployee}
          companyId={companyId}
          onSave={handleSave}
          onClose={() => setEditingEmployee(null)}
          isSaving={Boolean(update.isPending)}
        />
      )}

      {advanceEmployee && (
        <AdvanceQuickModal
          employee={advanceEmployee}
          companyId={companyId}
          createAdvance={createAdvance}
          onSuccess={() => {
            invalidateOnFinancialMutation(queryClient);
            showToast(t('advancePaid'), 'success');
          }}
          onClose={() => setAdvanceEmployee(null)}
        />
      )}

      {terminationSettlementEmp && (
        <TerminationSettlementModal
          open
          employee={terminationSettlementEmp}
          companyId={companyId}
          companyName={companyName}
          onClose={() => setTerminationSettlementEmp(null)}
        />
      )}

      <Modal
        open={!!terminatingEmployee}
        onClose={() => setTerminatingEmployee(null)}
        title={t('terminateEmployee')}
        size="md"
        variant="danger"
        footer={(
          <>
            <Button variant="ghost" onClick={() => setTerminatingEmployee(null)}>{t('cancel')}</Button>
            <Button
              variant="danger"
              onClick={() => {
                const employeeForTermination = terminatingEmployee;
                if (!employeeForTermination?.id) {
                  showToast(t('updateFailed'), 'error');
                  return;
                }
                if (!terminationForm.reason?.trim()) {
                  showToast(t('terminationReasonPlaceholder'), 'error');
                  return;
                }
                const parsed = parseEmployeeNotesMeta(employeeForTermination.notes);
                const meta = {
                  ...(parsed.meta || {}),
                  terminationReason: terminationForm.reason?.trim() || '',
                  terminationClause: terminationForm.clause?.trim() || '',
                  terminationDate: terminationForm.date || getSaudiToday(),
                };
                const composedNotes = composeEmployeeNotes(parsed.notesText, meta);
                update.mutate(
                  { id: employeeForTermination.id, body: { status: 'terminated', notes: composedNotes } },
                  {
                    onSuccess: () => {
                      showToast(t('employeeTerminated'), 'success');
                      setTerminationSettlementEmp({
                        ...employeeForTermination,
                        status: 'terminated',
                        notes: composedNotes,
                      });
                      setTerminatingEmployee(null);
                    },
                    onError: (e: unknown) => showToast(getErrorMessage(e, t('updateFailed')), 'error'),
                  },
                );
              }}
            >
              {t('terminateEmployee')}
            </Button>
          </>
        )}
      >
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(160px,1fr))]">
          <Input
            type="select"
            label={t('terminationReason')}
            hint={t('terminationReasonExamples')}
            value={terminationForm.reason}
            onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
              setTerminationForm((p) => ({ ...p, reason: e.target.value }));
            }}
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
            onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
              setTerminationForm((p) => ({ ...p, clause: e.target.value }));
            }}
          >
            <option value="">{t('terminationClausePlaceholder')}</option>
            <option value={t('terminationClauseArt80')}>{t('terminationClauseArt80')}</option>
            <option value={t('terminationClauseArt77')}>{t('terminationClauseArt77')}</option>
            <option value={t('terminationClauseArt74')}>{t('terminationClauseArt74')}</option>
            <option value={t('terminationClauseArt81')}>{t('terminationClauseArt81')}</option>
          </Input>

          <DateField
            label={t('terminationDate')}
            value={terminationForm.date}
            onValueChange={(value) => setTerminationForm((p) => ({ ...p, date: value }))}
          />
        </div>
      </Modal>
    </>
  );
}
