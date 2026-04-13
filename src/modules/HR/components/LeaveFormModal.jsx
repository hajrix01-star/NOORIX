/**
 * LeaveFormModal — إضافة أو تعديل إجازة (معتمدة أو غير معتمدة)
 */
import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from '../../../i18n/useTranslation';
import { useApp } from '../../../context/AppContext';
import { getEmployees, createLeave, updateLeave } from '../../../services/api';
import { employeeDisplayName } from '../../../utils/employeeDisplayName';
import { Button, Input, AdaptiveSheet } from '../../../ui';
import { assertApiOk } from '../../../utils/apiResponse';

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

function sliceYmd(iso) {
  return String(iso || '').slice(0, 10);
}

export function LeaveFormModal({
  companyId,
  employeeId: initialEmployeeId,
  editLeave = null,
  lockEmployeeSelector = false,
  onSuccess,
  onClose,
}) {
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

  useEffect(() => {
    if (isEdit && editLeave) {
      setEmployeeId(editLeave.employeeId || '');
      setLeaveType(editLeave.leaveType || 'annual');
      setStartDate(sliceYmd(editLeave.startDate));
      setEndDate(sliceYmd(editLeave.endDate));
      setDaysCount(editLeave.daysCount != null ? String(editLeave.daysCount) : '');
      setStatus(editLeave.status || 'approved');
      setNotes(editLeave.notes || '');
    } else {
      setEmployeeId(initialEmployeeId || '');
      setLeaveType('annual');
      setStartDate('');
      setEndDate('');
      setDaysCount('');
      setStatus('approved');
      setNotes('');
    }
    setError('');
  }, [isEdit, editLeave?.id, initialEmployeeId]);

  const { data: employees = [] } = useQuery({
    queryKey: ['employees', cid, false],
    queryFn: async () => {
      const res = await getEmployees(cid, false);
      if (!res?.success) return [];
      return Array.isArray(res.data) ? res.data : [];
    },
    enabled: !!cid,
  });

  const activeEmployees = (employees || []).filter((e) => e.status !== 'terminated' && e.status !== 'archived');

  const handleStartEndChange = (field, value) => {
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
        const days = Math.ceil((e - s) / (24 * 60 * 60 * 1000)) + 1;
        setDaysCount(String(days));
      }
    }
  };

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
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
        const res = await updateLeave(editLeave.id, cid, base);
        assertApiOk(res, t('saveFailed'));
      } else {
        const payload = { companyId: cid, ...base };
        const res = await createLeave(payload);
        assertApiOk(res, t('saveFailed'));
      }
      onSuccess?.();
      onClose?.();
    } catch (err) {
      setError(err?.message || t('saveFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AdaptiveSheet
      open={true}
      onClose={onClose}
      title={isEdit ? t('editLeave') : t('addLeave')}
      size="md"
      side="start"
      className="leave-form-drawer"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>{t('cancel')}</Button>
          <Button variant="primary" onClick={handleSubmit} disabled={submitting}>
            {submitting ? t('saving') : (isEdit ? t('save') : t('add'))}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit}>
        <Input
          type="select"
          label={t('selectEmployee')}
          value={employeeId}
          onChange={(e) => setEmployeeId(e.target.value)}
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
          onChange={(e) => setLeaveType(e.target.value)}
        >
          {Object.keys(TYPE_MAP).map((k) => (
            <option key={k} value={k}>{t(TYPE_MAP[k])}</option>
          ))}
        </Input>

        <div className="grid grid-cols-2 gap-3">
          <Input
            type="date"
            label={t('startDate')}
            value={startDate}
            onChange={(e) => handleStartEndChange('startDate', e.target.value)}
            required
          />
          <Input
            type="date"
            label={t('endDate')}
            value={endDate}
            onChange={(e) => handleStartEndChange('endDate', e.target.value)}
            required
          />
        </div>

        <Input
          type="number"
          min="1"
          label={t('daysCount')}
          value={daysCount}
          onChange={(e) => setDaysCount(e.target.value)}
          placeholder="0"
        />

        <Input
          type="select"
          label={t('status')}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{t(opt.labelKey)}</option>
          ))}
        </Input>

        <Input
          label={t('notes')}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={t('notes')}
        />

        {error && (
          <div className="mb-3 p-[10px] rounded-lg text-[13px] bg-noorix-bg-muted text-noorix-red">
            {error}
          </div>
        )}
      </form>
    </AdaptiveSheet>
  );
}
