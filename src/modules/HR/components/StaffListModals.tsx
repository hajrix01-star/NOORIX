import React from 'react';
import { Button, Input, Modal } from '../../../ui';
import { StaffFormModal } from './StaffFormModal';
import { AdvanceQuickModal } from './AdvanceQuickModal';
import TerminationSettlementModal from './TerminationSettlementModal';
import { getSaudiToday } from '../../../utils/saudiDate';
import { composeEmployeeNotes, parseEmployeeNotesMeta } from '../utils/employeeNotesMeta';
import { invalidateOnFinancialMutation } from '../../../utils/queryInvalidation';

type StaffListModalsProps = {
  t: (key: string, ...args: any[]) => string;
  companyId: string;
  companyName: string;
  showForm: boolean;
  setShowForm: (value: boolean) => void;
  editingEmployee: any;
  setEditingEmployee: (value: any) => void;
  advanceEmployee: any;
  setAdvanceEmployee: (value: any) => void;
  terminatingEmployee: any;
  setTerminatingEmployee: (value: any) => void;
  terminationSettlementEmp: any;
  setTerminationSettlementEmp: (value: any) => void;
  terminationForm: { reason: string; clause: string; date: string };
  setTerminationForm: (updater: any) => void;
  handleSave: (payload: any) => void;
  create: any;
  update: any;
  createAdvance: any;
  queryClient: any;
  showToast: (message: string, variant?: any) => void;
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
                if (!terminationForm.reason?.trim()) {
                  showToast(t('terminationReasonPlaceholder'), 'error');
                  return;
                }
                const parsed = parseEmployeeNotesMeta(terminatingEmployee.notes);
                const meta = {
                  ...(parsed.meta || {}),
                  terminationReason: terminationForm.reason?.trim() || '',
                  terminationClause: terminationForm.clause?.trim() || '',
                  terminationDate: terminationForm.date || getSaudiToday(),
                };
                const composedNotes = composeEmployeeNotes(parsed.notesText, meta);
                update.mutate(
                  { id: terminatingEmployee.id, body: { status: 'terminated', notes: composedNotes } },
                  {
                    onSuccess: () => {
                      showToast(t('employeeTerminated'), 'success');
                      setTerminationSettlementEmp({
                        ...terminatingEmployee,
                        status: 'terminated',
                        notes: composedNotes,
                      });
                      setTerminatingEmployee(null);
                    },
                    onError: (e: any) => showToast(e?.message || t('updateFailed'), 'error'),
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
            onChange={(e: any) => setTerminationForm((p: any) => ({ ...p, reason: e.target.value }))}
          >
            <option value="">{t('terminationReasonPlaceholder')}</option>
            {terminationReasonOptions.map((opt: any) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </Input>

          <Input
            type="select"
            label={t('terminationClause')}
            value={terminationForm.clause}
            onChange={(e: any) => setTerminationForm((p: any) => ({ ...p, clause: e.target.value }))}
          >
            <option value="">{t('terminationClausePlaceholder')}</option>
            <option value={t('terminationClauseArt80')}>{t('terminationClauseArt80')}</option>
            <option value={t('terminationClauseArt77')}>{t('terminationClauseArt77')}</option>
            <option value={t('terminationClauseArt74')}>{t('terminationClauseArt74')}</option>
            <option value={t('terminationClauseArt81')}>{t('terminationClauseArt81')}</option>
          </Input>

          <Input
            type="date"
            label={t('terminationDate')}
            value={terminationForm.date}
            onChange={(e: any) => setTerminationForm((p: any) => ({ ...p, date: e.target.value }))}
          />
        </div>
      </Modal>
    </>
  );
}
