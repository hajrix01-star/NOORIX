/**
 * StaffFormModal — نافذة إضافة/تعديل موظف.
 * Props: employee (null للإضافة), companyId, onSave(body), onClose, isSaving
 */
import React, { useState, useEffect, memo } from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { getSaudiToday } from '../../../utils/saudiDate';
import { useCustomAllowances } from '../../../hooks/useCustomAllowances';
import { composeEmployeeNotes, parseEmployeeNotesMeta } from '../utils/employeeNotesMeta';
import { moneyFieldString, roundMoney2 } from '../../../utils/moneyInput';
import {
  stripOvertimeWorkDaysTag,
  parseOvertimeWorkDaysPerMonth,
  mergeOvertimeWorkDaysIntoSchedule,
  DEFAULT_OVERTIME_WORK_DAYS,
} from '../utils/employeeSalaryMath';
import { Button, Input, AdaptiveSheet } from '../../../ui';

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
  const [overtimeWorkDays, setOvertimeWorkDays] = useState(String(DEFAULT_OVERTIME_WORK_DAYS));
  const { allowances } = useCustomAllowances(companyId, employee?.id);

  useEffect(() => {
    if (employee) {
      const parsed = parseEmployeeNotesMeta(employee.notes);
      const meta = parsed.meta || {};
      setOvertimeWorkDays(String(parseOvertimeWorkDaysPerMonth(employee)));
      setForm({
        name: employee.name || '',
        nameEn: employee.nameEn || '',
        jobTitle: employee.jobTitle || '',
        iqamaNumber: employee.iqamaNumber || '',
        basicSalary: moneyFieldString(employee.basicSalary ?? 0),
        housingAllowance: moneyFieldString(employee.housingAllowance ?? 0),
        transportAllowance: moneyFieldString(employee.transportAllowance ?? 0),
        otherAllowance: moneyFieldString(employee.otherAllowance ?? 0),
        workHours: employee.workHours || '',
        workSchedule: stripOvertimeWorkDaysTag(employee.workSchedule || ''),
        joinDate: employee.joinDate ? new Date(employee.joinDate).toISOString().slice(0, 10) : getSaudiToday(),
        status: employee.status || 'active',
        notes: parsed.notesText || '',
        terminationReason: meta.terminationReason || '',
        terminationClause: meta.terminationClause || '',
        terminationDate: meta.terminationDate || '',
      });
    } else {
      setOvertimeWorkDays(String(DEFAULT_OVERTIME_WORK_DAYS));
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
        amount: moneyFieldString(row.amount ?? ''),
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
    e?.preventDefault?.();
    setAllowanceError('');
    if (!form.name.trim()) return;
    const basic = roundMoney2(form.basicSalary);
    const housing = roundMoney2(form.housingAllowance);
    const transport = roundMoney2(form.transportAllowance);
    const other = roundMoney2(form.otherAllowance);
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
      workSchedule: mergeOvertimeWorkDaysIntoSchedule(
        form.workSchedule?.trim() || '',
        parseInt(String(overtimeWorkDays), 10) || DEFAULT_OVERTIME_WORK_DAYS,
      ),
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
      amount: roundMoney2(row.amount),
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
    <AdaptiveSheet
      open={true}
      onClose={onClose}
      title={isEdit ? t('editEmployee') : t('addEmployee')}
      size="lg"
      side="start"
      className="staff-form-drawer"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>{t('cancel')}</Button>
          <Button variant="primary" onClick={handleSubmit} disabled={isSaving || !form.name.trim()}>
            {isSaving ? t('saving') : t('saveChanges')}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit}>
        <div className="staff-form-names-grid nx-grid-2 nx-gap-12" style={{ marginBottom: 14 }}>
          <Input
            label={`${t('employeeName')} *`}
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder={t('employeeNamePlaceholder')}
            required
          />
          <Input
            label="Name (English)"
            value={form.nameEn}
            onChange={(e) => set('nameEn', e.target.value)}
            placeholder="Employee name in English"
            className="nx-ltr nx-text-start"
          />
          <Input
            label={t('jobTitle')}
            value={form.jobTitle}
            onChange={(e) => set('jobTitle', e.target.value)}
            placeholder={t('jobTitlePlaceholder')}
          />
          <Input
            type="date"
            label={t('joinDate')}
            value={form.joinDate}
            onChange={(e) => set('joinDate', e.target.value)}
            required
          />
          <Input
            label={t('iqamaNumber')}
            value={form.iqamaNumber}
            onChange={(e) => set('iqamaNumber', e.target.value)}
            placeholder="1234567890"
          />
          <Input
            type="number"
            step="0.01"
            min="0"
            label={t('basicSalary')}
            value={form.basicSalary}
            onChange={(e) => set('basicSalary', e.target.value)}
            required
          />
          <Input
            type="number"
            step="0.01"
            min="0"
            label={t('housingAllowance')}
            value={form.housingAllowance}
            onChange={(e) => set('housingAllowance', e.target.value)}
          />
          <Input
            type="number"
            step="0.01"
            min="0"
            label={t('transportAllowance')}
            value={form.transportAllowance}
            onChange={(e) => set('transportAllowance', e.target.value)}
          />
          <Input
            type="number"
            step="0.01"
            min="0"
            label={t('otherAllowance')}
            value={form.otherAllowance}
            onChange={(e) => set('otherAllowance', e.target.value)}
          />
          <Input
            label={t('workHours')}
            value={form.workHours}
            onChange={(e) => set('workHours', e.target.value)}
            placeholder={t('workHoursPlaceholder')}
          />
          <Input
            label={t('workSchedule')}
            value={form.workSchedule}
            onChange={(e) => set('workSchedule', e.target.value)}
            placeholder={t('workSchedulePlaceholder')}
          />
          <div>
            <Input
              type="number"
              min={1}
              max={31}
              label={t('overtimeWorkDaysPerMonth')}
              value={overtimeWorkDays}
              onChange={(e) => setOvertimeWorkDays(e.target.value)}
            />
            <div className="nx-text-xs nx-text-muted nx-mt-4" style={{ lineHeight: 1.45 }}>
              {t('overtimeWorkDaysHelp')}
            </div>
          </div>
          {isEdit && (
            <Input
              type="select"
              label={t('status')}
              value={form.status}
              onChange={(e) => set('status', e.target.value)}
            >
              <option value="active">{t('statusActive')}</option>
              <option value="on_leave">{t('statusOnLeave')}</option>
              <option value="terminated">{t('statusTerminated')}</option>
              <option value="archived">{t('statusArchived')}</option>
            </Input>
          )}
        </div>
        {isEdit && form.status === 'terminated' && (
          <div className="nx-grid nx-gap-12" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', marginBottom: 14 }}>
            <div>
              <Input
                type="select"
                label={t('terminationReason')}
                value={form.terminationReason}
                onChange={(e) => set('terminationReason', e.target.value)}
              >
                <option value="">{t('terminationReasonPlaceholder')}</option>
                {terminationReasonOptions.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </Input>
              <div className="nx-mt-4 nx-text-xs nx-text-muted">
                {t('terminationReasonExamples')}
              </div>
            </div>
            <Input
              type="select"
              label={t('terminationClause')}
              value={form.terminationClause}
              onChange={(e) => set('terminationClause', e.target.value)}
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
              value={form.terminationDate || ''}
              onChange={(e) => set('terminationDate', e.target.value)}
            />
          </div>
        )}
        <div style={{ marginBottom: 14 }}>
          <Input
            multiline
            label={t('notes')}
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            rows={2}
            style={{ resize: 'vertical' }}
          />
        </div>
        <div className="nx-border-all nx-rounded-lg nx-p-14" style={{ marginBottom: 18 }}>
          <div className="nx-flex nx-flex-between nx-flex-wrap nx-gap-8" style={{ marginBottom: 10 }}>
            <strong className="nx-text-base">{t('customAllowances')}</strong>
            <Button type="button" size="sm" onClick={() => addAllowanceRow()}>
              {t('addCustomAllowance')}
            </Button>
          </div>
          <div className="nx-flex nx-flex-wrap nx-gap-8 nx-mb-12">
            {ALLOWANCE_TEMPLATES.map((item) => (
              <Button
                key={item.key}
                type="button"
                size="sm"
                onClick={() => addAllowanceRow(t(item.labelKey))}
              >
                {t(item.labelKey)}
              </Button>
            ))}
          </div>
          {customAllowances.length === 0 && (
            <div className="nx-text-sm nx-text-muted">{t('noCustomAllowances')}</div>
          )}
          <div className="nx-grid nx-gap-8">
            {customAllowances.map((row) => (
              <div key={row.rowId} className="nx-grid nx-gap-8" style={{ gridTemplateColumns: '1.4fr 1fr auto', alignItems: 'end' }}>
                <Input
                  label={t('customAllowanceName')}
                  value={row.nameAr}
                  onChange={(e) => setAllowance(row.rowId, { nameAr: e.target.value })}
                />
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  label={t('customAllowanceAmount')}
                  value={row.amount}
                  onChange={(e) => setAllowance(row.rowId, { amount: e.target.value })}
                />
                <Button type="button" variant="danger" size="sm" onClick={() => removeAllowanceRow(row.rowId)}>
                  {t('delete') || 'حذف'}
                </Button>
              </div>
            ))}
          </div>
          {allowanceError && (
            <div className="nx-mt-10 nx-text-sm" style={{ color: '#dc2626' }}>{allowanceError}</div>
          )}
        </div>
      </form>
    </AdaptiveSheet>
  );
});

export default StaffFormModal;
