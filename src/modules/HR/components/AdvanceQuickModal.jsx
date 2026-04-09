/**
 * AdvanceQuickModal — صرف سلفة سريع لموظف
 * يدعم employee محدد أو اختيار موظف من القائمة (employee=null)
 */
import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { useVaults } from '../../../hooks/useVaults';
import { useQuery } from '@tanstack/react-query';
import { getEmployees } from '../../../services/api';
import { getSaudiToday } from '../../../utils/saudiDate';
import { roundMoney2 } from '../../../utils/moneyInput';
import { employeeDisplayName } from '../../../utils/employeeDisplayName';
import { Button, Input, AdaptiveSheet } from '../../../ui';

export function AdvanceQuickModal({ employee: initialEmployee, companyId, createAdvance, onSuccess, onClose }) {
  const { t, lang } = useTranslation();
  const { paymentVaults = [] } = useVaults({ companyId });
  const vaults = paymentVaults;
  const [employee, setEmployee] = useState(initialEmployee);
  const [employeeId, setEmployeeId] = useState(initialEmployee?.id || '');
  const [amount, setAmount] = useState('');
  const [vaultId, setVaultId] = useState('');
  const [txDate, setTxDate] = useState(getSaudiToday());
  const [notes, setNotes] = useState('');
  const [installmentCount, setInstallmentCount] = useState('');

  const { data: employees = [] } = useQuery({
    queryKey: ['employees', companyId, false],
    queryFn: async () => {
      const res = await getEmployees(companyId, false);
      if (!res?.success) return [];
      return Array.isArray(res.data) ? res.data : [];
    },
    enabled: !!companyId && !initialEmployee,
  });

  const activeEmployees = (employees || []).filter((e) => e.status !== 'terminated' && e.status !== 'archived');

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

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    const amt = roundMoney2(amount);
    const empId = initialEmployee ? initialEmployee.id : employeeId;
    const selectedEmp = initialEmployee ?? activeEmployees.find((em) => em.id === empId);
    const empName = selectedEmp ? employeeDisplayName(selectedEmp, 'ar', '') : '';
    if (!amt || amt <= 0 || !vaultId || !empId) return;
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
    } catch (err) {
      console.error(err);
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
          <Button variant="primary" onClick={handleSubmit} disabled={createAdvance.isPending}>
            {createAdvance.isPending ? t('saving') : t('payAdvance')}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit}>
        {!initialEmployee && (
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
        )}
        <Input
          type="number"
          step="0.01"
          min="0"
          label={t('advanceAmount')}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0"
        />
        <Input
          type="select"
          label={t('selectVault')}
          value={vaultId}
          onChange={(e) => setVaultId(e.target.value)}
          required
        >
          <option value="">— {t('selectVault') || 'اختر الخزينة'} —</option>
          {vaults.map((v) => (
            <option key={v.id} value={v.id}>{v.nameAr || v.nameEn || v.id}</option>
          ))}
        </Input>
        <Input
          type="date"
          label={t('transactionDate')}
          value={txDate}
          onChange={(e) => setTxDate(e.target.value)}
        />
        <Input
          type="number"
          min="1"
          max="120"
          step="1"
          label={t('installmentCount') || 'عدد الدفعات'}
          value={installmentCount}
          onChange={(e) => setInstallmentCount(e.target.value)}
          placeholder="1"
        />
        {parsedInstallments > 1 && installmentAmt && (
          <div className="flex items-center justify-between px-1 py-2 rounded-lg bg-noorix-bg-muted border border-noorix-border">
            <span className="text-[13px] text-noorix-muted">{t('installmentAmount') || 'مبلغ الدفعة'}</span>
            <span className="text-[15px] font-bold text-noorix-blue ltr">
              {installmentAmt.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ﷼
            </span>
          </div>
        )}
        <Input
          label={t('notes')}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={t('notes')}
        />
      </form>
    </AdaptiveSheet>
  );
}
