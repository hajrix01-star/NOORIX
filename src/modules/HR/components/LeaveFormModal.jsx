/**
 * LeaveFormModal — إضافة إجازة جديدة
 */
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from '../../../i18n/useTranslation';
import { useApp } from '../../../context/AppContext';
import { getEmployees } from '../../../services/api';
import { createLeave } from '../../../services/api';
import { employeeDisplayName } from '../../../utils/employeeDisplayName';
import { Button, Input, AdaptiveSheet } from '../../../ui';
import { assertApiOk } from '../../../utils/apiResponse';

const TYPE_MAP = {
  annual: 'leaveAnnual',
  sick: 'leaveSick',
  unpaid: 'leaveUnpaid',
  other: 'leaveOther',
};

export function LeaveFormModal({ companyId, employeeId: initialEmployeeId, onSuccess, onClose }) {
  const { t, lang } = useTranslation();
  const { activeCompanyId } = useApp();
  const cid = companyId || activeCompanyId || '';

  const [employeeId, setEmployeeId] = useState(initialEmployeeId || '');
  const [leaveType, setLeaveType] = useState('annual');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [daysCount, setDaysCount] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

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

  React.useEffect(() => {
    if (initialEmployeeId && !employeeId) setEmployeeId(initialEmployeeId);
  }, [initialEmployeeId]);

  const handleStartEndChange = (field, value) => {
    if (field === 'startDate') {
      setStartDate(value);
      if (endDate && value > endDate) setEndDate(value);
    } else {
      setEndDate(value);
    }
    if (startDate && endDate) {
      const s = new Date(field === 'startDate' ? value : startDate);
      const e = new Date(field === 'endDate' ? value : endDate);
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
      const payload = {
        companyId: cid,
        employeeId,
        leaveType,
        startDate: `${startDate}T00:00:00.000Z`,
        endDate: `${endDate}T00:00:00.000Z`,
        daysCount: daysCount ? parseInt(daysCount, 10) : undefined,
        status: 'pending',
        notes: notes || undefined,
      };
      const res = await createLeave(payload);
      assertApiOk(res, t('saveFailed'));
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
      title={t('addLeave')}
      size="md"
      side="start"
      className="leave-form-drawer"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>{t('cancel')}</Button>
          <Button variant="primary" onClick={handleSubmit} disabled={submitting}>
            {submitting ? t('saving') : t('add')}
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
          label={t('notes')}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={t('notes')}
        />

        {error && (
          <div className="mb-3 p-[10px] rounded-lg text-[13px]" style={{ background: 'var(--noorix-red-10)', color: 'var(--noorix-accent-red)' }}>
            {error}
          </div>
        )}
      </form>
    </AdaptiveSheet>
  );
}
