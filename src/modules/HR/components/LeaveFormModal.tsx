/**
 * LeaveFormModal — إضافة أو تعديل إجازة (معتمدة أو غير معتمدة)
 * عند وجود تسوية راتب: تعديل الملاحظات فقط دون تأكيد؛ أي تغيير جوهري يطلب موافقة على إلغاء التسوية.
 */
import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { useApp } from '../../../context/AppContext';
import { getEmployees, createLeave, updateLeave, throwIfApiFailed } from '../../../services/api';
import { useApiListQuery } from '../../../hooks/useApiQuery';
import { employeeKeys } from '../../../services/queryKeys';
import { employeeDisplayName } from '../../../utils/employeeDisplayName';
import { DateField, DialogActions, Input, AdaptiveSheet, Modal } from '../../../ui';
import { toDateInputYmd, getSaudiToday } from '../../../utils/saudiDate';
import type { HrEmployee } from '../../../types/api';

const TYPE_MAP = {
  annual: 'leaveAnnual',
  sick: 'leaveSick',
  unpaid: 'leaveUnpaid',
  other: 'leaveOther',
};

const STATUS_OPTIONS = [
  { value: 'pending', labelKey: 'statusPending' },
  { value: 'approved', labelKey: 'statusApproved' },
  { value: 'rejected', labelKey: 'statusRejected' },
];

const LEAVE_FORM_ID = 'leave-form-modal';
type LeaveType = keyof typeof TYPE_MAP;
type LeaveStatus = (typeof STATUS_OPTIONS)[number]['value'];
type LeaveFormState = {
  leaveType: string;
  startDate: string;
  endDate: string;
  daysCount: string;
  status: string;
  employeeId: string;
};
type LeaveRecord = Record<string, unknown> & {
  id?: string | null;
  employeeId?: string | null;
  leaveType?: LeaveType | string | null;
  startDate?: string | Date | null;
  endDate?: string | Date | null;
  daysCount?: number | string | null;
  status?: LeaveStatus | string | null;
  notes?: string | null;
  salarySettlement?: unknown;
};
type LeaveFormModalProps = {
  companyId?: string;
  employeeId?: string;
  editLeave?: LeaveRecord | null;
  lockEmployeeSelector?: boolean;
  onReturnFromLeave?: () => void;
  onSalarySettlement?: () => void;
  onDelete?: (leave: LeaveRecord) => void;
  onSuccess?: () => void;
  onClose?: () => void;
};
type LeaveInputChange = React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>;

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

/** تغيير يتطلب إلغاء تسوية الراتب (المسار الخلفي يفرّق عن تعديل الملاحظات فقط) */
function leaveHasStructuralChange(editLeave: LeaveRecord | null | undefined, state: LeaveFormState) {
  if (!editLeave) return false;
  return (
    state.leaveType !== (editLeave.leaveType || 'annual') ||
    state.startDate !== toDateInputYmd(editLeave.startDate) ||
    state.endDate !== toDateInputYmd(editLeave.endDate) ||
    String(state.daysCount || '').trim() !== String(editLeave.daysCount ?? '').trim() ||
    state.status !== (editLeave.status || 'approved') ||
    state.employeeId !== editLeave.employeeId
  );
}

export function LeaveFormModal({
  companyId,
  employeeId: initialEmployeeId,
  editLeave = null,
  lockEmployeeSelector = false,
  onReturnFromLeave,
  onSalarySettlement,
  onDelete,
  onSuccess,
  onClose,
}: LeaveFormModalProps) {
  const { t, lang } = useTranslation();
  const { activeCompanyId } = useApp();
  const cid = companyId || activeCompanyId || '';
  const isEdit = Boolean(editLeave?.id);

  const [employeeId, setEmployeeId] = useState('');
  const [leaveType, setLeaveType] = useState('annual');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [daysCount, setDaysCount] = useState('');
  const [status, setStatus] = useState('approved');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [voidModalOpen, setVoidModalOpen] = useState(false);
  const voidAckRef = useRef(false);

  useEffect(() => {
    voidAckRef.current = false;
    if (isEdit && editLeave) {
      setEmployeeId(editLeave.employeeId || '');
      setLeaveType(editLeave.leaveType || 'annual');
      setStartDate(toDateInputYmd(editLeave.startDate));
      setEndDate(toDateInputYmd(editLeave.endDate));
      setDaysCount(editLeave.daysCount != null ? String(editLeave.daysCount) : '');
      setStatus(editLeave.status || 'approved');
      setNotes(editLeave.notes || '');
    } else {
      const today = getSaudiToday();
      setEmployeeId(initialEmployeeId || '');
      setLeaveType('annual');
      setStartDate(today);
      setEndDate(today);
      setDaysCount('1');
      setStatus('approved');
      setNotes('');
    }
    setError('');
  }, [isEdit, editLeave?.id, initialEmployeeId]);

  const { data: employees = [] } = useApiListQuery<HrEmployee>({
    queryKey: employeeKeys.list(cid, false),
    queryFn: () => getEmployees(cid, false),
    fallbackMessage: t('employeesLoadFailed'),
    enabled: !!cid,
  });

  const activeEmployees = (employees || []).filter((e) => e.status !== 'terminated' && e.status !== 'archived');

  const handleStartEndChange = (field: 'startDate' | 'endDate', value: string) => {
    if (field === 'startDate') {
      setStartDate(value);
      if (endDate && value > endDate) setEndDate(value);
    } else {
      setEndDate(value);
    }
    const sStr = field === 'startDate' ? value : startDate;
    const eStr = field === 'endDate' ? value : endDate;
    if (sStr && eStr) {
      const s = new Date(sStr);
      const e = new Date(eStr);
      if (e >= s) {
        const days = Math.ceil((e.getTime() - s.getTime()) / (24 * 60 * 60 * 1000)) + 1;
        setDaysCount(String(days));
      }
    }
  };

  const runSave = async () => {
    setError('');
    if (!employeeId || !startDate || !endDate) {
      setError(t('requiredFields') || 'الحقول المطلوبة ناقصة');
      return;
    }
    const s = new Date(startDate);
    const end = new Date(endDate);
    if (end < s) {
      setError(t('endDateBeforeStart') || 'تاريخ النهاية يجب أن يكون بعد تاريخ البداية');
      return;
    }

    const state = {
      leaveType,
      startDate,
      endDate,
      daysCount,
      status,
      employeeId,
    };
    const structural =
      isEdit &&
      editLeave?.salarySettlement &&
      leaveHasStructuralChange(editLeave, state);

    if (structural && !voidAckRef.current) {
      setVoidModalOpen(true);
      return;
    }

    voidAckRef.current = false;
    setSubmitting(true);
    try {
      const base = {
        employeeId,
        leaveType,
        startDate: `${startDate}T00:00:00.000Z`,
        endDate: `${endDate}T00:00:00.000Z`,
        daysCount: daysCount ? parseInt(daysCount, 10) : undefined,
        status,
        notes: notes || undefined,
      };
      if (isEdit) {
        if (!editLeave?.id) {
          setError(t('saveFailed'));
          return;
        }
        const body = { ...base, ...(structural ? { voidSalarySettlement: true } : {}) };
        const res = await updateLeave(editLeave.id, cid, body);
        throwIfApiFailed(res, t('saveFailed'));
      } else {
        const payload = { companyId: cid, ...base };
        const res = await createLeave(payload);
        throwIfApiFailed(res, t('saveFailed'));
      }
      onSuccess?.();
      onClose?.();
    } catch (err: unknown) {
      setError(getErrorMessage(err, t('saveFailed')));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e?.preventDefault?.();
    void runSave();
  };

  const confirmVoidAndSave = () => {
    voidAckRef.current = true;
    setVoidModalOpen(false);
    void runSave();
  };

  return (
    <>
      <AdaptiveSheet
        open={true}
        onClose={onClose}
        title={isEdit ? t('editLeave') : t('addLeave')}
        size="md"
        side="start"
        className="leave-form-drawer"
        footer={
          <DialogActions
            actions={[
              { key: 'cancel', label: t('cancel'), role: 'cancel', onClick: onClose },
              {
                key: 'delete',
                label: t('delete'),
                role: 'delete',
                hidden: !isEdit || !onDelete,
                className: 'me-auto',
                onClick: () => onDelete?.(editLeave),
              },
              {
                key: 'return-from-leave',
                label: t('leaveReturnFromLeave'),
                role: 'primary',
                hidden: !isEdit || !onReturnFromLeave,
                onClick: onReturnFromLeave,
              },
              {
                key: 'salary-settlement',
                label: t('leaveSalarySettlement'),
                role: 'success',
                hidden: !isEdit || !onSalarySettlement,
                onClick: onSalarySettlement,
              },
              {
                key: 'save',
                label: submitting ? t('saving') : (isEdit ? t('save') : t('add')),
                role: 'save',
                type: 'submit',
                form: LEAVE_FORM_ID,
                disabled: submitting,
              },
            ]}
          />
        }
      >
        <form id={LEAVE_FORM_ID} onSubmit={handleSubmit}>
          {error && (
            <div className="mb-3 p-[10px] rounded-lg text-[13px] bg-noorix-red/10 text-noorix-red" role="alert">
              {error}
            </div>
          )}
          <Input
            type="select"
            label={t('selectEmployee')}
            value={employeeId}
            onChange={(e: LeaveInputChange) => setEmployeeId(e.target.value)}
            required
            disabled={lockEmployeeSelector}
          >
            <option value="">—</option>
            {activeEmployees.map((emp) => (
              <option key={emp.id} value={emp.id}>{employeeDisplayName(emp, lang)}</option>
            ))}
          </Input>

          <Input
            type="select"
            label={t('leaveType')}
            value={leaveType}
            onChange={(e: LeaveInputChange) => setLeaveType(e.target.value)}
          >
            {Object.keys(TYPE_MAP).map((k) => (
              <option key={k} value={k}>{t((TYPE_MAP as Record<string, string>)[String(k)])}</option>
            ))}
          </Input>

          <div className="grid grid-cols-2 gap-3">
            <DateField
              label={t('startDate')}
              value={startDate}
              onValueChange={(value) => handleStartEndChange('startDate', value)}
              required
              lang="en"
            />
            <DateField
              label={t('endDate')}
              value={endDate}
              onValueChange={(value) => handleStartEndChange('endDate', value)}
              required
              lang="en"
            />
          </div>

          <Input
            type="number"
            min="1"
            label={t('daysCount')}
            value={daysCount}
            onChange={(e: LeaveInputChange) => setDaysCount(e.target.value)}
            placeholder="0"
          />

          <Input
            type="select"
            label={t('status')}
            value={status}
            onChange={(e: LeaveInputChange) => setStatus(e.target.value)}
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{t(opt.labelKey)}</option>
            ))}
          </Input>

          <Input
            label={t('notes')}
            value={notes}
            onChange={(e: LeaveInputChange) => setNotes(e.target.value)}
            placeholder={t('notes')}
          />

        </form>
      </AdaptiveSheet>

      <Modal
        open={voidModalOpen}
        onClose={() => setVoidModalOpen(false)}
        title={t('leaveEditVoidSettlementTitle')}
        size="md"
        footer={
          <DialogActions
            actions={[
              { key: 'cancel', label: t('cancel'), role: 'cancel', onClick: () => setVoidModalOpen(false) },
              {
                key: 'confirm',
                label: t('leaveVoidConfirmProceed'),
                role: 'primary',
                disabled: submitting,
                onClick: confirmVoidAndSave,
              },
            ]}
          />
        }
      >
        <p className="text-[13px] text-noorix-text leading-relaxed m-0">
          {t('leaveEditVoidSettlementBody')}
        </p>
      </Modal>
    </>
  );
}
