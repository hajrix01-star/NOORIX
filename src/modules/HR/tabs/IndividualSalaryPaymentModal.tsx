import React, { useMemo, useRef, useState } from 'react';
import { useApiListQuery } from '../../../hooks/useApiQuery';
import { useVaults } from '../../../hooks/useVaults';
import { employeeKeys } from '../../../services/queryKeys';
import { getEmployees } from '../../../services/api';
import type { HrEmployee } from '../../../types/api';
import { employeeDisplayName } from '../../../utils/employeeDisplayName';
import { getSaudiToday } from '../../../utils/saudiDate';
import { vaultDisplayName } from '../../../utils/vaultDisplay';
import { AdaptiveSheet, DateField, DialogActions, Input } from '../../../ui';

type Props = {
  companyId: string;
  lang: string;
  pending: boolean;
  onClose: () => void;
  onSubmit: (payload: Record<string, unknown>) => void;
};

const formId = 'individual-salary-payment-form';
const monthNow = () => getSaudiToday().slice(0, 7);

export function IndividualSalaryPaymentModal({ companyId, lang, pending, onClose, onSubmit }: Props) {
  const { paymentVaults = [] } = useVaults({ companyId });
  const { data: employees = [] } = useApiListQuery<HrEmployee>({
    queryKey: employeeKeys.list(companyId, false),
    queryFn: () => getEmployees(companyId, false),
    fallbackMessage: 'تعذر تحميل الموظفين.',
    enabled: !!companyId,
  });
  const [employeeId, setEmployeeId] = useState('');
  const [payrollMonth, setPayrollMonth] = useState(monthNow);
  const [amount, setAmount] = useState('');
  const [vaultId, setVaultId] = useState('');
  const [transactionDate, setTransactionDate] = useState(getSaudiToday);
  const [notes, setNotes] = useState('');
  const idempotencyKey = useRef(globalThis.crypto?.randomUUID?.() ?? `salary-${Date.now()}`).current;
  const activeEmployees = useMemo(
    () => employees.filter((employee) => employee.status !== 'terminated' && employee.status !== 'archived'),
    [employees],
  );
  const valid = !!employeeId && !!vaultId && Number(amount) > 0 && !!payrollMonth && !!transactionDate;

  return (
    <AdaptiveSheet
      open
      onClose={onClose}
      title="صرف راتب فردي"
      size="md"
      side="start"
      footer={<DialogActions actions={[
        { key: 'cancel', label: 'إلغاء', role: 'cancel', onClick: onClose, disabled: pending },
        { key: 'save', label: 'صرف وإنشاء فاتورة راتب', role: 'save', type: 'submit', form: formId, disabled: !valid || pending, loading: pending },
      ]} />}
    >
      <form id={formId} className="flex flex-col gap-3" onSubmit={(event) => {
        event.preventDefault();
        if (!valid) return;
        onSubmit({ companyId, employeeId, payrollMonth: `${payrollMonth}-01`, amount: Number(amount), vaultId, transactionDate, notes: notes.trim() || undefined, idempotencyKey });
      }}>
        <p className="m-0 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-[12px] leading-6 text-blue-900">
          تسجل الدفعة كراتب للموظف ولشهر محدد، وتُخصم تلقائياً من المتبقي عند إصدار المسير.
        </p>
        <Input type="select" label="الموظف" value={employeeId} required onChange={(event: React.ChangeEvent<HTMLSelectElement>) => setEmployeeId(event.target.value)}>
          <option value="">اختر الموظف</option>
          {activeEmployees.map((employee) => <option key={employee.id} value={employee.id}>{employeeDisplayName(employee, lang)}</option>)}
        </Input>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input type="month" label="شهر الراتب" value={payrollMonth} required onChange={(event: React.ChangeEvent<HTMLInputElement>) => setPayrollMonth(event.target.value)} />
          <Input type="number" label="المبلغ" min="0.01" step="0.01" inputMode="decimal" value={amount} required onChange={(event: React.ChangeEvent<HTMLInputElement>) => setAmount(event.target.value)} />
        </div>
        <Input type="select" label="الخزينة" value={vaultId} required onChange={(event: React.ChangeEvent<HTMLSelectElement>) => setVaultId(event.target.value)}>
          <option value="">اختر الخزينة</option>
          {paymentVaults.map((vault) => <option key={vault.id} value={vault.id}>{vaultDisplayName(vault, lang)}</option>)}
        </Input>
        <DateField label="تاريخ الصرف" value={transactionDate} onValueChange={setTransactionDate} lang="en" />
        <Input label="ملاحظات" value={notes} onChange={(event: React.ChangeEvent<HTMLInputElement>) => setNotes(event.target.value)} placeholder="اختياري" />
      </form>
    </AdaptiveSheet>
  );
}
