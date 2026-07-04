/**
 * AdvanceQuickModal — صرف سلفة سريع لموظف
 * يدعم employee محدد أو اختيار موظف من القائمة (employee=null)
 */
import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { useVaults } from '../../../hooks/useVaults';
import { useQuery } from '@tanstack/react-query';
import { getEmployees } from '../../../services/api';
import { useApiListQuery } from '../../../hooks/useApiQuery';
import { employeeKeys } from '../../../services/queryKeys';
import { getSaudiToday } from '../../../utils/saudiDate';
import { roundMoney2 } from '../../../utils/moneyInput';
import { fmt } from '../../../utils/format';
import { employeeDisplayName } from '../../../utils/employeeDisplayName';
import { vaultDisplayName } from '../../../utils/vaultDisplay';
import { Button, DateField, Input, AdaptiveSheet , FmtNum } from '../../../ui';
import { useToast } from '../../../context/ToastContext';

const ADVANCE_FORM_ID = 'advance-quick-form';

export function AdvanceQuickModal({ employee: initialEmployee, companyId, createAdvance, onSuccess, onClose }: any) {
  const { t, lang } = useTranslation();
  const { showToast } = useToast();
  const { paymentVaults = [] } = useVaults({ companyId });
  const vaults = paymentVaults;
  const [employee, setEmployee] = useState(initialEmployee);
  const [employeeId, setEmployeeId] = useState(initialEmployee?.id || '');
  const [amount, setAmount] = useState('');
  const [vaultId, setVaultId] = useState('');
  const [txDate, setTxDate] = useState(getSaudiToday());
  const [notes, setNotes] = useState('');
  const [installmentCount, setInstallmentCount] = useState('');

  const { data: employees = [] } = useApiListQuery<any>({
    queryKey: employeeKeys.list(companyId, false),
    queryFn: () => getEmployees(companyId, false),
    fallbackMessage: t('employeesLoadFailed'),
    enabled: !!companyId && !initialEmployee,
  });

  const activeEmployees = (employees || []).filter((e: any) => e.status !== 'terminated' && e.status !== 'archived');

  useEffect(() => {
    if (initialEmployee) {
      setEmployee(initialEmployee);
      setEmployeeId(initialEmployee.id);
    }
  }, [initialEmployee]);

  const parsedInstallments = parseInt(installmentCount, 10) || 1;
  const installmentAmt = useMemo(() => {
    const amt = parseFloat(amount) || 0;
    if (!amt || parsedInstallments <= 1) return null;
    return Math.ceil((amt / parsedInstallments) * 100) / 100;
  }, [amount, parsedInstallments]);

  const handleSubmit = async (e: any) => {
    e?.preventDefault?.();
    const amt = roundMoney2(amount);
    const empId = initialEmployee ? initialEmployee.id : employeeId;
    const selectedEmp = initialEmployee ?? activeEmployees.find((em: any) => em.id === empId);
    const empName = selectedEmp ? employeeDisplayName(selectedEmp, 'ar', '') : '';
    if (!empId) {
      showToast(t('requiredFields') || 'الحقول المطلوبة ناقصة', 'error');
      return;
    }
    if (!amt || amt <= 0) {
      showToast(t('requiredFields') || 'الحقول المطلوبة ناقصة', 'error');
      return;
    }
    if (!vaultId) {
      showToast(t('selectVault') || 'اختر الخزينة', 'error');
      return;
    }
    try {
      await createAdvance.mutateAsync({
        employeeId: empId,
        companyId,
        vaultId,
        amount: amt,
        transactionDate: txDate,
        notes: notes.trim() || `سلفة — ${empName}`,
        installmentCount: parsedInstallments > 1 ? parsedInstallments : undefined,
        installmentAmount: parsedInstallments > 1 ? installmentAmt : undefined,
      });
      onSuccess?.();
      onClose?.();
    } catch (err: any) {
      showToast(t('errorGeneral') || 'حدث خطأ أثناء الحفظ', 'error');
    }
  };

  const title = initialEmployee
    ? t('advanceForEmployee', employeeDisplayName(initialEmployee, lang, ''))
    : (t('payAdvance') || 'صرف سلفة');

  return (
    <AdaptiveSheet
      open={true}
      onClose={onClose}
      title={title}
      size="md"
      side="start"
      className="advance-quick-drawer"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>{t('cancel')}</Button>
          <Button type="submit" form={ADVANCE_FORM_ID} variant="primary" disabled={createAdvance.isPending}>
            {createAdvance.isPending ? t('saving') : t('payAdvance')}
          </Button>
        </>
      }
    >
      <form id={ADVANCE_FORM_ID} onSubmit={handleSubmit}>
        {!initialEmployee && (
          <Input
            type="select"
            label={t('selectEmployee')}
            value={employeeId}
            onChange={(e: any) => setEmployeeId(e.target.value)}
            required
          >
            <option value="">—</option>
            {activeEmployees.map((emp: any) => (
              <option key={emp.id} value={emp.id}>{employeeDisplayName(emp, lang)}</option>
            ))}
          </Input>
        )}
        <Input
          type="number"
          step="0.01"
          min="0"
          label={t('advanceAmount')}
          value={amount}
          onChange={(e: any) => setAmount(e.target.value)}
          placeholder="0"
        />
        <Input
          type="select"
          label={t('selectVault')}
          value={vaultId}
          onChange={(e: any) => setVaultId(e.target.value)}
          required
        >
          <option value="">— {t('selectVault') || 'اختر الخزينة'} —</option>
          {vaults.map((v: any) => (
            <option key={v.id} value={v.id}>{vaultDisplayName(v, lang)}</option>
          ))}
        </Input>
        <DateField
          label={t('transactionDate')}
          value={txDate}
          onValueChange={setTxDate}
          lang="en"
        />
        <Input
          type="number"
          min="1"
          max="120"
          step="1"
          label={t('installmentCount') || 'عدد الدفعات'}
          value={installmentCount}
          onChange={(e: any) => setInstallmentCount(e.target.value)}
          placeholder="1"
        />
        {parsedInstallments > 1 && installmentAmt && (
          <div className="flex items-center justify-between px-1 py-2 rounded-lg bg-noorix-bg-muted border border-noorix-border">
            <span className="text-[13px] text-noorix-muted">{t('installmentAmount') || 'مبلغ الدفعة'}</span>
            <span dir="ltr" className="text-[15px] font-bold text-noorix-blue">
              <FmtNum n={installmentAmt} /> <span className="nx-sar">SR</span>
            </span>
          </div>
        )}
        <Input
          label={t('notes')}
          value={notes}
          onChange={(e: any) => setNotes(e.target.value)}
          placeholder={t('notes')}
        />
      </form>
    </AdaptiveSheet>
  );
}
