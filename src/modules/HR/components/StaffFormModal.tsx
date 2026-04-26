/**
 * StaffFormModal — نافذة إضافة/تعديل موظف.
 * Props: employee (null للإضافة), companyId, onSave(body), onClose, isSaving
 */
import React, { useState, useEffect, useMemo, memo } from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { getSaudiToday, toDateInputYmd } from '../../../utils/saudiDate';
import { useCustomAllowances } from '../../../hooks/useCustomAllowances';
import { composeEmployeeNotes, parseEmployeeNotesMeta } from '../utils/employeeNotesMeta';
import { moneyFieldString, roundMoney2 } from '../../../utils/moneyInput';
import {
  stripOvertimeWorkDaysTag,
  parseOvertimeWorkDaysPerMonth,
  mergeOvertimeWorkDaysIntoSchedule,
  DEFAULT_OVERTIME_WORK_DAYS,
  totalSalary,
} from '../utils/employeeSalaryMath';
import { Button, Input, AdaptiveSheet, FmtNum } from '../../../ui';

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

export type StaffFormModalProps = {
  employee: any;
  companyId: any;
  onSave: (payload: any) => void;
  onClose: () => void;
  isSaving: boolean;
};

export const StaffFormModal = memo(function StaffFormModal({
  employee, companyId, onSave, onClose, isSaving,
}: StaffFormModalProps) {
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
  const [customAllowances, setCustomAllowances] = useState<any[]>([]);
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
        joinDate: employee.joinDate ? toDateInputYmd(employee.joinDate) || getSaudiToday() : getSaudiToday(),
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
      (allowances || []).map((row: any) => ({
        id: row.id,
        rowId: row.id || makeRowId(),
        nameAr: row.nameAr || '',
        amount: moneyFieldString(row.amount ?? ''),
      })),
    );
  }, [employee, allowances]);

  const set = (k: any, v: any) => setForm((p: any) => ({ ...p, [k]: v }));
  const setAllowance = (rowId: any, patch: any) => {
    setCustomAllowances((prev: any) => prev.map((row: any) => (row.rowId === rowId ? { ...row, ...patch } : row)));
  };
  const addAllowanceRow = (nameAr: any = '') => {
    setCustomAllowances((prev: any) => [...prev, { rowId: makeRowId(), nameAr, amount: '' }]);
  };
  const removeAllowanceRow = (rowId: any) => {
    setCustomAllowances((prev: any) => prev.filter((row: any) => row.rowId !== rowId));
  };

  const computedCustomAllowanceTotal = useMemo(
    () => roundMoney2(
      customAllowances.reduce((sum: any, row: any) => sum + (roundMoney2(row.amount) || 0), 0),
    ),
    [customAllowances],
  );

  const salaryPreviewEmployee = useMemo(() => {
    const wd = parseInt(String(overtimeWorkDays), 10) || DEFAULT_OVERTIME_WORK_DAYS;
    return {
      basicSalary: roundMoney2(form.basicSalary),
      housingAllowance: roundMoney2(form.housingAllowance),
      transportAllowance: roundMoney2(form.transportAllowance),
      otherAllowance: roundMoney2(form.otherAllowance),
      workHours: form.workHours,
      workSchedule: mergeOvertimeWorkDaysIntoSchedule(
        form.workSchedule?.trim() || '',
        wd,
      ),
    };
  }, [
    form.basicSalary,
    form.housingAllowance,
    form.transportAllowance,
    form.otherAllowance,
    form.workHours,
    form.workSchedule,
    overtimeWorkDays,
  ]);

  const computedTotalSalary = totalSalary(salaryPreviewEmployee, computedCustomAllowanceTotal);

  function handleSubmit(e: any) {
    e?.preventDefault?.();
    setAllowanceError('');
    if (!form.name.trim()) return;
    const basic = roundMoney2(form.basicSalary);
    const housing = roundMoney2(form.housingAllowance);
    const transport = roundMoney2(form.transportAllowance);
    const other = roundMoney2(form.otherAllowance);
    if (basic < 0 || housing < 0 || transport < 0 || other < 0) return;

    const body: Record<string, any> = {
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
    const preparedAllowances = customAllowances.map((row: any) => ({
      id: row.id,
      nameAr: String(row.nameAr || '').trim(),
      amount: roundMoney2(row.amount),
      hasAnyValue: !!String(row.nameAr || '').trim() || !!String(row.amount || '').trim(),
    }));
    const invalidAllowance = preparedAllowances.find((row: any) => row.hasAnyValue && (!row.nameAr || row.amount <= 0));
    if (invalidAllowance) {
      setAllowanceError('يجب إدخال اسم البدل ومبلغ أكبر من صفر لكل بدل مضاف.');
      return;
    }
    const normalizedAllowances = preparedAllowances
      .filter((row: any) => row.nameAr && row.amount > 0)
      .map(({ id, nameAr, amount }: any) => ({ id, nameAr, amount }));
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
        <div className="staff-form-names-grid grid grid-cols-2 gap-3 mb-[14px]">
          <Input
            label={`${t('employeeName')} *`}
            value={form.name}
            onChange={(e: any) => set('name', e.target.value)}
            placeholder={t('employeeNamePlaceholder')}
            required
          />
          <Input
            label="Name (English)"
            value={form.nameEn}
            onChange={(e: any) => set('nameEn', e.target.value)}
            placeholder="Employee name in English"
            className="nx-ltr text-start"
          />
          <Input
            label={t('jobTitle')}
            value={form.jobTitle}
            onChange={(e: any) => set('jobTitle', e.target.value)}
            placeholder={t('jobTitlePlaceholder')}
          />
          <Input
            type="date"
            label={t('joinDate')}
            value={form.joinDate}
            onChange={(e: any) => set('joinDate', e.target.value)}
            required
          />
          <Input
            label={t('iqamaNumber')}
            value={form.iqamaNumber}
            onChange={(e: any) => set('iqamaNumber', e.target.value)}
            placeholder="1234567890"
          />
          <Input
            type="number"
            step="0.01"
            min="0"
            label={t('basicSalary')}
            value={form.basicSalary}
            onChange={(e: any) => set('basicSalary', e.target.value)}
            required
          />
          <Input
            type="number"
            step="0.01"
            min="0"
            label={t('housingAllowance')}
            value={form.housingAllowance}
            onChange={(e: any) => set('housingAllowance', e.target.value)}
          />
          <Input
            type="number"
            step="0.01"
            min="0"
            label={t('transportAllowance')}
            value={form.transportAllowance}
            onChange={(e: any) => set('transportAllowance', e.target.value)}
          />
          <Input
            type="number"
            step="0.01"
            min="0"
            label={t('otherAllowance')}
            value={form.otherAllowance}
            onChange={(e: any) => set('otherAllowance', e.target.value)}
          />
          <Input
            label={t('workHours')}
            value={form.workHours}
            onChange={(e: any) => set('workHours', e.target.value)}
            placeholder={t('workHoursPlaceholder')}
          />
          <Input
            label={t('workSchedule')}
            value={form.workSchedule}
            onChange={(e: any) => set('workSchedule', e.target.value)}
            placeholder={t('workSchedulePlaceholder')}
          />
          <div>
            <Input
              type="number"
              min={1}
              max={31}
              label={t('overtimeWorkDaysPerMonth')}
              value={overtimeWorkDays}
              onChange={(e: any) => setOvertimeWorkDays(e.target.value)}
            />
            <div className="text-[11px] text-noorix-muted mt-1 leading-[1.45]">
              {t('overtimeWorkDaysHelp')}
            </div>
          </div>
          <div className="col-span-2 rounded-xl border border-noorix-border bg-noorix-bg-muted/40 px-3.5 py-3">
            <div className="text-[11px] text-noorix-muted mb-1">{t('totalSalary')}</div>
            <div className="text-[18px] font-bold ltr text-noorix-text" style={{ fontFamily: 'var(--noorix-font-numbers)' }}>
              <FmtNum n={computedTotalSalary} />
            </div>
          </div>
          {isEdit && (
            <Input
              type="select"
              label={t('status')}
              value={form.status}
              onChange={(e: any) => set('status', e.target.value)}
            >
              <option value="active">{t('statusActive')}</option>
              <option value="on_leave">{t('statusOnLeave')}</option>
              <option value="terminated">{t('statusTerminated')}</option>
              <option value="archived">{t('statusArchived')}</option>
            </Input>
          )}
        </div>
        {isEdit && form.status === 'terminated' && (
          <div className="grid gap-3 mb-[14px] [grid-template-columns:repeat(auto-fit,minmax(160px,1fr))]">
            <div>
              <Input
                type="select"
                label={t('terminationReason')}
                value={form.terminationReason}
                onChange={(e: any) => set('terminationReason', e.target.value)}
              >
                <option value="">{t('terminationReasonPlaceholder')}</option>
                {terminationReasonOptions.map((opt: any) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </Input>
              <div className="mt-1 text-[11px] text-noorix-muted">
                {t('terminationReasonExamples')}
              </div>
            </div>
            <Input
              type="select"
              label={t('terminationClause')}
              value={form.terminationClause}
              onChange={(e: any) => set('terminationClause', e.target.value)}
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
              onChange={(e: any) => set('terminationDate', e.target.value)}
            />
          </div>
        )}
        <div className="mb-[14px]">
          <Input
            multiline
            label={t('notes')}
            value={form.notes}
            onChange={(e: any) => set('notes', e.target.value)}
            rows={2}
            className="resize-y"
          />
        </div>
        <div className="border border-noorix-border rounded-xl p-3.5 mb-[18px]">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-[10px]">
            <strong className="text-[13px]">{t('customAllowances')}</strong>
            <Button type="button" size="sm" onClick={() => addAllowanceRow()}>
              {t('addCustomAllowance')}
            </Button>
          </div>
          <div className="flex flex flex-wrap gap-2 mb-3">
            {ALLOWANCE_TEMPLATES.map((item: any) => (
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
            <div className="text-[12px] text-noorix-muted">{t('noCustomAllowances')}</div>
          )}
          <div className="grid gap-2">
            {customAllowances.map((row: any) => (
              <div key={row.rowId} className="grid gap-2 items-end [grid-template-columns:1.4fr_1fr_auto]">
                <Input
                  label={t('customAllowanceName')}
                  value={row.nameAr}
                  onChange={(e: any) => setAllowance(row.rowId, { nameAr: e.target.value })}
                />
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  label={t('customAllowanceAmount')}
                  value={row.amount}
                  onChange={(e: any) => setAllowance(row.rowId, { amount: e.target.value })}
                />
                <Button type="button" variant="danger" size="sm" onClick={() => removeAllowanceRow(row.rowId)}>
                  {t('delete') || 'حذف'}
                </Button>
              </div>
            ))}
          </div>
          {allowanceError && (
            <div className="mt-2.5 text-[12px] text-noorix-red">{allowanceError}</div>
          )}
        </div>
      </form>
    </AdaptiveSheet>
  );
});

export default StaffFormModal;
