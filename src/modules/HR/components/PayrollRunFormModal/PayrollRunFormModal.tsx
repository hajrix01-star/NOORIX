/**
 * PayrollRunFormModal — إنشاء/تعديل مسيرة راتب (حاوية)
 */
import React, { useMemo } from 'react';
import { useApp } from '../../../../context/AppContext';
import { useTranslation } from '../../../../i18n/useTranslation';
import { Button, AdaptiveSheet } from '../../../../ui';
import { usePayrollRunFormState } from './hooks/usePayrollRunFormState';
import { usePayrollRunRows } from './hooks/usePayrollRunRows';
import { usePayrollRunFormActions } from './hooks/usePayrollRunFormActions';
import { PayrollRunFormHeader } from './components/PayrollRunFormHeader';
import { PayrollRunRowsTable } from './components/PayrollRunRowsTable';
import { PayrollRunSummary } from './components/PayrollRunSummary';
import { PayrollRunActions } from './components/PayrollRunActions';
import type { PayrollRunFormModalProps } from './types';

export function PayrollRunFormModal({
  companyId,
  runId = null,
  onCreate,
  onClose,
}: PayrollRunFormModalProps) {
  const { t } = useTranslation();
  const { activeCompanyId } = useApp();

  const st = usePayrollRunFormState({ companyId, activeCompanyId, runId });

  const payrollEmployees = st.employees.map((employee) => ({
    ...employee,
    status: employee.status || undefined,
    name: employee.name || undefined,
    nameAr: employee.nameAr || undefined,
  }));

  const rowModel = usePayrollRunRows({
    defaultMonth: st.defaultMonth,
    payrollMonth: st.payrollMonth,
    setPayrollMonth: st.setPayrollMonth,
    setNotes: st.setNotes,
    setItems: st.setItems,
    items: st.items,
    isEditMode: st.isEditMode,
    runId: st.runId,
    employees: payrollEmployees,
    existingRuns: st.existingRuns,
    editingRun: st.editingRun,
    monthStr: st.monthStr,
    compensationSnapshotByEmployeeId: st.compensationSnapshotByEmployeeId,
    advances: st.advances,
    deductions: st.deductions,
    leaves: st.leaves,
    leaveSalarySettlements: st.leaveSalarySettlements,
  });

  const actions = usePayrollRunFormActions({
    items: st.items,
    setItems: st.setItems,
    setError: st.setError,
    setSubmitting: st.setSubmitting,
    payrollMonth: st.payrollMonth,
    notes: st.notes,
    cid: st.cid,
    isEditMode: st.isEditMode,
    runId: st.runId,
    alreadyExists: rowModel.alreadyExists,
    t: rowModel.t,
    onCreate,
    onClose,
    buildLineForEmployee: rowModel.buildLineForEmployee,
    employees: st.employees as Array<Record<string, unknown> & { id?: string }>,
  });

  const modalTitle = st.isEditMode ? `${t('edit')} ${t('hrTabPayroll')}` : t('createPayrollRun');
  const primaryLabel = st.submitting
    ? t('saving')
    : st.isEditMode
      ? t('save') || 'حفظ'
      : t('create') || 'إنشاء';
  const totalLabel = t('payrollTotal');

  const primaryDisabled = useMemo(
    () =>
      st.submitting ||
      st.items.length === 0 ||
      rowModel.alreadyExists ||
      st.compensationSnapshotsLoading ||
      !!st.compensationSnapshotsError ||
      rowModel.missingCentralSalaryEmployeeIds.length > 0,
    [
      st.submitting,
      st.items.length,
      rowModel.alreadyExists,
      st.compensationSnapshotsLoading,
      st.compensationSnapshotsError,
      rowModel.missingCentralSalaryEmployeeIds.length,
    ],
  );

  if (st.isEditMode && st.isLoadingRun) {
    return (
      <AdaptiveSheet open onClose={onClose} title={t('loading')} size="sm" side="start">
        {t('loading')}
      </AdaptiveSheet>
    );
  }

  return (
    <AdaptiveSheet
      open
      onClose={onClose}
      title={modalTitle}
      size="full"
      side="start"
      className="payroll-run-form-drawer"
      footer={
        <>
          <PayrollRunSummary totalLabel={totalLabel} totalNet={rowModel.totalNet} />
          <PayrollRunActions
            cancelLabel={t('cancel')}
            primaryLabel={primaryLabel}
            onCancel={() => onClose?.()}
            onPrimary={() => actions.handleSubmit(null)}
            primaryDisabled={primaryDisabled}
          />
        </>
      }
    >
      <form className="prfm-modal-form" onSubmit={actions.handleSubmit}>
        <PayrollRunFormHeader
          payrollMonth={st.payrollMonth}
          defaultMonth={st.defaultMonth}
          setPayrollMonth={st.setPayrollMonth}
          notes={st.notes}
          setNotes={st.setNotes}
          alreadyExists={rowModel.alreadyExists}
          t={rowModel.t}
        />

        {rowModel.leaveSettledEmployeeIds.size > 0 && (
          <div className="text-[12px] text-noorix-muted bg-noorix-bg-muted border border-noorix-border rounded-lg px-3 py-2 mb-1 shrink-0">
            {rowModel.t('payrollLeaveSettlementHint')}
          </div>
        )}

        <div className="flex items-center justify-between gap-2 flex-wrap pt-2 pb-1.5 shrink-0">
          <span className="text-[13px] font-bold">
            {rowModel.t('employeesList')} ({st.items.length})
          </span>
          <Button
            type="button"
            size="sm"
            disabled={
              st.compensationSnapshotsLoading ||
              !!st.compensationSnapshotsError ||
              rowModel.missingCentralSalaryEmployeeIds.length > 0
            }
            onClick={st.isEditMode ? rowModel.loadEditingItems : rowModel.initItems}
          >
            {rowModel.t('refresh') || 'تحديث'}
          </Button>
        </div>
        {st.compensationSnapshotsError ? (
          <div
            className="text-[13px] font-semibold mt-1 rounded-lg p-3 shrink-0 bg-noorix-red/15 border border-noorix-red/25 text-noorix-red"
            role="alert"
          >
            {st.compensationSnapshotsError instanceof Error ? st.compensationSnapshotsError.message : t('loadingError')}
          </div>
        ) : null}
        {rowModel.missingCentralSalaryEmployeeIds.length > 0 ? (
          <div
            className="text-[13px] font-semibold mt-1 rounded-lg p-3 shrink-0 bg-noorix-red/15 border border-noorix-red/25 text-noorix-red"
            role="alert"
          >
            {t('loadingError')}
          </div>
        ) : null}

        <PayrollRunRowsTable
          displayEmployees={rowModel.displayEmployees as { id?: string; name?: string; nameAr?: string }[]}
          items={st.items}
          lang={rowModel.lang}
          t={rowModel.t}
          updateItem={actions.updateItem}
          toggleInclude={actions.toggleInclude}
          toggleAdvance={actions.toggleAdvance}
          selectInput={actions.selectInput}
        />

        {st.error && (
          <div
            className="text-[13px] font-semibold mt-3 rounded-lg p-3 shrink-0 bg-noorix-red/15 border border-noorix-red/25 text-noorix-red"
            role="alert"
          >
            {st.error}
          </div>
        )}
      </form>
    </AdaptiveSheet>
  );
}
