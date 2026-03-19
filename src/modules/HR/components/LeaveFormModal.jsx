/**
 * LeaveFormModal — إضافة إجازة جديدة
 */
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from '../../../i18n/useTranslation';
import { useApp } from '../../../context/AppContext';
import { getEmployees } from '../../../services/api';
import { createLeave } from '../../../services/api';

const TYPE_MAP = {
  annual: 'leaveAnnual',
  sick: 'leaveSick',
  unpaid: 'leaveUnpaid',
  other: 'leaveOther',
};

export function LeaveFormModal({ companyId, employeeId: initialEmployeeId, onSuccess, onClose }) {
  const { t } = useTranslation();
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
    e.preventDefault();
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
      if (!res?.success) throw new Error(res?.error || 'فشل إضافة الإجازة');
      onSuccess?.();
      onClose?.();
    } catch (err) {
      setError(err?.message || t('saveFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="modal-overlay"
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}
      onClick={onClose}
    >
      <div className="noorix-surface-card" style={{ padding: 24, maxWidth: 400, width: '95%' }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 16px', fontSize: 18 }}>{t('addLeave')}</h3>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 13, marginBottom: 4 }}>{t('selectEmployee')}</label>
            <select
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              required
              style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--noorix-border)' }}
            >
              <option value="">—</option>
              {activeEmployees.map((emp) => (
                <option key={emp.id} value={emp.id}>{emp.name || emp.nameAr || '—'}</option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 13, marginBottom: 4 }}>{t('leaveType')}</label>
            <select
              value={leaveType}
              onChange={(e) => setLeaveType(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--noorix-border)' }}
            >
              {Object.keys(TYPE_MAP).map((k) => (
                <option key={k} value={k}>{t(TYPE_MAP[k])}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, marginBottom: 4 }}>{t('startDate')}</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => handleStartEndChange('startDate', e.target.value)}
                required
                style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--noorix-border)' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, marginBottom: 4 }}>{t('endDate')}</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => handleStartEndChange('endDate', e.target.value)}
                required
                style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--noorix-border)' }}
              />
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 13, marginBottom: 4 }}>{t('daysCount')}</label>
            <input
              type="number"
              min="1"
              value={daysCount}
              onChange={(e) => setDaysCount(e.target.value)}
              placeholder="0"
              style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--noorix-border)' }}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, marginBottom: 4 }}>{t('notes')}</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('notes')}
              style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--noorix-border)' }}
            />
          </div>

          {error && (
            <div style={{ marginBottom: 12, padding: 10, background: 'rgba(239,68,68,0.1)', borderRadius: 8, color: '#ef4444', fontSize: 13 }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" className="noorix-btn-nav" onClick={onClose}>{t('cancel')}</button>
            <button type="submit" className="noorix-btn-nav" style={{ background: 'var(--btn-primary-bg)', color: '#fff' }} disabled={submitting}>
              {submitting ? t('saving') : t('add')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
