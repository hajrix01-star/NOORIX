/**
 * StaffFormModal — نافذة إضافة/تعديل موظف.
 * Props: employee (null للإضافة), companyId, onSave(body), onClose, isSaving
 */
import React, { useState, useEffect, memo } from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { getSaudiToday } from '../../../utils/saudiDate';
import { useCustomAllowances } from '../../../hooks/useCustomAllowances';
import { composeEmployeeNotes, parseEmployeeNotesMeta } from '../utils/employeeNotesMeta';

const IS = {
  width: '100%', padding: '9px 12px', borderRadius: 8,
  border: '1px solid var(--noorix-border)', background: 'var(--noorix-bg-surface)',
  color: 'var(--noorix-text)', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box',
};

const EMPTY = {
  name: '', nameEn: '', jobTitle: '', iqamaNumber: '',
  basicSalary: '', housingAllowance: '', transportAllowance: '', otherAllowance: '',
  workHours: '', workSchedule: '',
  joinDate: getSaudiToday(), status: 'active', notes: '',
  terminationReason: '', terminationClause: '', terminationDate: '',
};

const ALLOWANCE_TEMPLATES = [
  { key: 'meal', labelKey: 'allowanceTemplateMeal' },
  { key: 'housing', labelKey: 'allowanceTemplateHousing' },
  { key: 'transport', labelKey: 'allowanceTemplateTransport' },
  { key: 'overtime', labelKey: 'allowanceTemplateOvertime' },
];

function makeRowId() {
  return `allowance-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export const StaffFormModal = memo(function StaffFormModal({
  employee, companyId, onSave, onClose, isSaving,
}) {
  const { t } = useTranslation();
  const terminationReasonOptions = [
    t('terminationReasonOptionArt80'),
    t('terminationReasonOptionArt77'),
    t('terminationReasonOptionContractEnd'),
    t('terminationReasonOptionResignation'),
    t('terminationReasonOptionAbsence'),
  ];
  const isEdit = !!employee;
  const [form, setForm] = useState(EMPTY);
  const [customAllowances, setCustomAllowances] = useState([]);
  const [allowanceError, setAllowanceError] = useState('');
  const { allowances } = useCustomAllowances(companyId, employee?.id);

  useEffect(() => {
    if (employee) {
      const parsed = parseEmployeeNotesMeta(employee.notes);
      const meta = parsed.meta || {};
      setForm({
        name: employee.name || '',
        nameEn: employee.nameEn || '',
        jobTitle: employee.jobTitle || '',
        iqamaNumber: employee.iqamaNumber || '',
        basicSalary: String(employee.basicSalary ?? 0),
        housingAllowance: String(employee.housingAllowance ?? 0),
        transportAllowance: String(employee.transportAllowance ?? 0),
        otherAllowance: String(employee.otherAllowance ?? 0),
        workHours: employee.workHours || '',
        workSchedule: employee.workSchedule || '',
        joinDate: employee.joinDate ? new Date(employee.joinDate).toISOString().slice(0, 10) : getSaudiToday(),
        status: employee.status || 'active',
        notes: parsed.notesText || '',
        terminationReason: meta.terminationReason || '',
        terminationClause: meta.terminationClause || '',
        terminationDate: meta.terminationDate || '',
      });
    } else {
      setForm({ ...EMPTY, joinDate: getSaudiToday() });
    }
  }, [employee]);

  useEffect(() => {
    if (!employee) {
      setCustomAllowances([]);
      return;
    }
    setCustomAllowances(
      (allowances || []).map((row) => ({
        id: row.id,
        rowId: row.id || makeRowId(),
        nameAr: row.nameAr || '',
        amount: String(row.amount ?? ''),
      })),
    );
  }, [employee, allowances]);

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const setAllowance = (rowId, patch) => {
    setCustomAllowances((prev) => prev.map((row) => (row.rowId === rowId ? { ...row, ...patch } : row)));
  };
  const addAllowanceRow = (nameAr = '') => {
    setCustomAllowances((prev) => [...prev, { rowId: makeRowId(), nameAr, amount: '' }]);
  };
  const removeAllowanceRow = (rowId) => {
    setCustomAllowances((prev) => prev.filter((row) => row.rowId !== rowId));
  };

  function handleSubmit(e) {
    e.preventDefault();
    setAllowanceError('');
    if (!form.name.trim()) return;
    const basic = parseFloat(form.basicSalary) || 0;
    const housing = parseFloat(form.housingAllowance) || 0;
    const transport = parseFloat(form.transportAllowance) || 0;
    const other = parseFloat(form.otherAllowance) || 0;
    if (basic < 0 || housing < 0 || transport < 0 || other < 0) return;

    const body = {
      name: form.name.trim(),
      nameEn: form.nameEn.trim() || undefined,
      jobTitle: form.jobTitle.trim() || undefined,
      iqamaNumber: form.iqamaNumber.trim() || undefined,
      basicSalary: basic,
      housingAllowance: housing,
      transportAllowance: transport,
      otherAllowance: other,
      joinDate: form.joinDate,
      status: form.status,
      workHours: form.workHours?.trim() || undefined,
      workSchedule: form.workSchedule?.trim() || undefined,
    };
    const meta = {
      terminationReason: form.status === 'terminated' ? form.terminationReason?.trim() : undefined,
      terminationClause: form.status === 'terminated' ? form.terminationClause?.trim() : undefined,
      terminationDate: form.status === 'terminated'
        ? (form.terminationDate || getSaudiToday())
        : undefined,
    };
    body.notes = composeEmployeeNotes(form.notes, meta) || undefined;
    if (!isEdit) body.companyId = companyId;
    const preparedAllowances = customAllowances.map((row) => ({
      id: row.id,
      nameAr: String(row.nameAr || '').trim(),
      amount: parseFloat(row.amount) || 0,
      hasAnyValue: !!String(row.nameAr || '').trim() || !!String(row.amount || '').trim(),
    }));
    const invalidAllowance = preparedAllowances.find((row) => row.hasAnyValue && (!row.nameAr || row.amount <= 0));
    if (invalidAllowance) {
      setAllowanceError('يجب إدخال اسم البدل ومبلغ أكبر من صفر لكل بدل مضاف.');
      return;
    }
    const normalizedAllowances = preparedAllowances
      .filter((row) => row.nameAr && row.amount > 0)
      .map(({ id, nameAr, amount }) => ({ id, nameAr, amount }));
    onSave({ employeeBody: body, customAllowances: normalizedAllowances });
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.4)', padding: 20,
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="noorix-surface-card"
        style={{ width: '100%', maxWidth: 520, maxHeight: '90vh', overflow: 'auto', borderRadius: 14, padding: 24, boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
            {isEdit ? t('editEmployee') : t('addEmployee')}
          </h4>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--noorix-text-muted)' }}
          >
            ×
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{t('employeeName')}</label>
              <input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder={t('employeeNamePlaceholder')} required style={IS} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{t('jobTitle')}</label>
              <input value={form.jobTitle} onChange={(e) => set('jobTitle', e.target.value)} placeholder={t('jobTitlePlaceholder')} style={IS} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{t('joinDate')}</label>
              <input type="date" value={form.joinDate} onChange={(e) => set('joinDate', e.target.value)} required style={IS} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{t('iqamaNumber')}</label>
              <input value={form.iqamaNumber} onChange={(e) => set('iqamaNumber', e.target.value)} placeholder="1234567890" style={IS} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{t('basicSalary')}</label>
              <input type="number" step="0.01" min="0" value={form.basicSalary} onChange={(e) => set('basicSalary', e.target.value)} required style={IS} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{t('housingAllowance')}</label>
              <input type="number" step="0.01" min="0" value={form.housingAllowance} onChange={(e) => set('housingAllowance', e.target.value)} style={IS} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{t('transportAllowance')}</label>
              <input type="number" step="0.01" min="0" value={form.transportAllowance} onChange={(e) => set('transportAllowance', e.target.value)} style={IS} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{t('workHours')}</label>
              <input value={form.workHours} onChange={(e) => set('workHours', e.target.value)} placeholder={t('workHoursPlaceholder')} style={IS} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{t('workSchedule')}</label>
              <input value={form.workSchedule} onChange={(e) => set('workSchedule', e.target.value)} placeholder={t('workSchedulePlaceholder')} style={IS} />
            </div>
            {isEdit && (
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{t('status')}</label>
                <select value={form.status} onChange={(e) => set('status', e.target.value)} style={IS}>
                  <option value="active">{t('statusActive')}</option>
                  <option value="on_leave">{t('statusOnLeave')}</option>
                  <option value="terminated">{t('statusTerminated')}</option>
                  <option value="archived">{t('statusArchived')}</option>
                </select>
              </div>
            )}
          </div>
          {isEdit && form.status === 'terminated' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{t('terminationReason')}</label>
                <select value={form.terminationReason} onChange={(e) => set('terminationReason', e.target.value)} style={IS}>
                  <option value="">{t('terminationReasonPlaceholder')}</option>
                  {terminationReasonOptions.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
                <div style={{ marginTop: 4, fontSize: 11, color: 'var(--noorix-text-muted)' }}>
                  {t('terminationReasonExamples')}
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{t('terminationClause')}</label>
                <select value={form.terminationClause} onChange={(e) => set('terminationClause', e.target.value)} style={IS}>
                  <option value="">{t('terminationClausePlaceholder')}</option>
                  <option value={t('terminationClauseArt80')}>{t('terminationClauseArt80')}</option>
                  <option value={t('terminationClauseArt77')}>{t('terminationClauseArt77')}</option>
                  <option value={t('terminationClauseArt74')}>{t('terminationClauseArt74')}</option>
                  <option value={t('terminationClauseArt81')}>{t('terminationClauseArt81')}</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{t('terminationDate')}</label>
                <input type="date" value={form.terminationDate || ''} onChange={(e) => set('terminationDate', e.target.value)} style={IS} />
              </div>
            </div>
          )}
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{t('notes')}</label>
            <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={2} style={{ ...IS, resize: 'vertical' }} />
          </div>
          <div style={{ marginBottom: 18, border: '1px solid var(--noorix-border)', borderRadius: 12, padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
              <strong style={{ fontSize: 13 }}>{t('customAllowances')}</strong>
              <button type="button" className="noorix-btn-nav" style={{ padding: '6px 10px' }} onClick={() => addAllowanceRow()}>
                {t('addCustomAllowance')}
              </button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              {ALLOWANCE_TEMPLATES.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className="noorix-btn-nav"
                  style={{ padding: '6px 10px' }}
                  onClick={() => addAllowanceRow(t(item.labelKey))}
                >
                  {t(item.labelKey)}
                </button>
              ))}
            </div>
            {customAllowances.length === 0 && (
              <div style={{ fontSize: 12, color: 'var(--noorix-text-muted)' }}>{t('noCustomAllowances')}</div>
            )}
            <div style={{ display: 'grid', gap: 8 }}>
              {customAllowances.map((row) => (
                <div key={row.rowId} style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr auto', gap: 8, alignItems: 'end' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{t('customAllowanceName')}</label>
                    <input value={row.nameAr} onChange={(e) => setAllowance(row.rowId, { nameAr: e.target.value })} style={IS} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{t('customAllowanceAmount')}</label>
                    <input type="number" min="0" step="0.01" value={row.amount} onChange={(e) => setAllowance(row.rowId, { amount: e.target.value })} style={IS} />
                  </div>
                  <button type="button" className="noorix-btn-nav" style={{ padding: '9px 10px' }} onClick={() => removeAllowanceRow(row.rowId)}>
                    {t('delete') || 'حذف'}
                  </button>
                </div>
              ))}
            </div>
            {allowanceError && (
              <div style={{ marginTop: 10, fontSize: 12, color: '#dc2626' }}>{allowanceError}</div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" className="noorix-btn-nav" onClick={onClose}>{t('cancel')}</button>
            <button type="submit" className="noorix-btn-nav noorix-btn-success" disabled={isSaving || !form.name.trim()}>
              {isSaving ? t('saving') : t('saveChanges')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
});

export default StaffFormModal;
