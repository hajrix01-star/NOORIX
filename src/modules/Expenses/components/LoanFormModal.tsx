import React, { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useApiMutation } from '../../../hooks/useApiMutation';
import { createLoan } from '../../../services/api';
import { loanKeys } from '../../../services/queryKeys';
import { getSaudiToday } from '../../../utils/saudiDate';
import { invalidateOnFinancialMutation } from '../../../utils/queryInvalidation';
import { AdaptiveSheet, DialogActions, Input, TransactionDatePicker } from '../../../ui';
import type { LoanCreatePayload } from '../../../types/api';

type Props = { companyId: string; onClose: () => void; onSaved: () => void };

function attemptKey(companyId: string) {
  const suffix = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2);
  return `loan-open-${companyId}-${suffix}`;
}

export default function LoanFormModal({ companyId, onClose, onSaved }: Props) {
  const queryClient = useQueryClient();
  const keyRef = useRef(attemptKey(companyId));
  const [nameAr, setNameAr] = useState('تمويل الراجحي');
  const [creditorName, setCreditorName] = useState('مصرف الراجحي');
  const [amount, setAmount] = useState('');
  const [openingDate, setOpeningDate] = useState(getSaudiToday());
  const [dueDate, setDueDate] = useState('');
  const [historicalPaymentsCount, setHistoricalPaymentsCount] = useState('');
  const [historicalPaidAmount, setHistoricalPaidAmount] = useState('');
  const [historicalPaidThroughDate, setHistoricalPaidThroughDate] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  const mutation = useApiMutation({
    mutationFn: (payload: LoanCreatePayload) => createLoan(payload),
    showErrorToast: false,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: loanKeys.root() });
      invalidateOnFinancialMutation(queryClient);
      onSaved();
    },
    onError: (err: Error) => setError(err.message || 'تعذر حفظ التمويل'),
  });

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    const openingBalance = Number(amount);
    if (!nameAr.trim() || !Number.isFinite(openingBalance) || openingBalance <= 0) {
      setError('أدخل اسم التمويل ورصيده الافتتاحي المتبقي.');
      return;
    }
    mutation.mutate({
      companyId,
      nameAr: nameAr.trim(),
      creditorName: creditorName.trim() || undefined,
      amount: openingBalance,
      openingDate,
      dueDate: dueDate || undefined,
      historicalPaymentsCount: historicalPaymentsCount ? Number(historicalPaymentsCount) : undefined,
      historicalPaidAmount: historicalPaidAmount ? Number(historicalPaidAmount) : undefined,
      historicalPaidThroughDate: historicalPaidThroughDate || undefined,
      notes: notes.trim() || undefined,
      idempotencyKey: keyRef.current,
    });
  };

  return (
    <AdaptiveSheet
      open onClose={onClose} size="md" side="start" title="إضافة قرض برصيد افتتاحي"
      footer={<DialogActions actions={[{ key: 'cancel', label: 'إلغاء', role: 'cancel', onClick: onClose }, { key: 'save', label: mutation.isPending ? 'جارٍ الحفظ…' : 'حفظ التمويل', role: 'save', type: 'submit', form: 'loan-opening-form', disabled: mutation.isPending }]} />}
    >
      <form id="loan-opening-form" onSubmit={submit} className="flex flex-col gap-3">
        <p className="m-0 rounded-lg border border-noorix-blue/25 bg-noorix-blue/5 px-3 py-2 text-[12px] leading-6 text-noorix-muted">
          هذا رصيد افتتاحي فقط. الدفعات التي سبقت نوركس توثّق هنا ولا تنشئ حركة خزينة أو فاتورة.
        </p>
        {error ? <div className="rounded-lg border border-noorix-red/30 bg-noorix-red/5 px-3 py-2 text-[13px] text-noorix-red">{error}</div> : null}
        <Input label="اسم التمويل *" value={nameAr} onChange={(event: React.ChangeEvent<HTMLInputElement>) => setNameAr(event.target.value)} required />
        <Input label="الجهة الممولة" value={creditorName} onChange={(event: React.ChangeEvent<HTMLInputElement>) => setCreditorName(event.target.value)} />
        <Input label="الرصيد الافتتاحي المتبقي (شامل الربح) *" type="number" min="0.0001" step="0.01" value={amount} onChange={(event: React.ChangeEvent<HTMLInputElement>) => setAmount(event.target.value)} className="ltr" required />
        <TransactionDatePicker label="تاريخ بداية المتابعة في نوركس" value={openingDate} onValueChange={setOpeningDate} required />
        <TransactionDatePicker label="تاريخ آخر قسط متوقع" value={dueDate} onValueChange={setDueDate} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input label="عدد الدفعات السابقة (توثيقي)" type="number" min="0" step="1" value={historicalPaymentsCount} onChange={(event: React.ChangeEvent<HTMLInputElement>) => setHistoricalPaymentsCount(event.target.value)} className="ltr" />
          <Input label="إجمالي المسدد سابقاً (توثيقي)" type="number" min="0" step="0.01" value={historicalPaidAmount} onChange={(event: React.ChangeEvent<HTMLInputElement>) => setHistoricalPaidAmount(event.target.value)} className="ltr" />
        </div>
        <TransactionDatePicker label="مسدد حتى تاريخ" value={historicalPaidThroughDate} onValueChange={setHistoricalPaidThroughDate} />
        <Input label="ملاحظات / مرجع العقد" value={notes} onChange={(event: React.ChangeEvent<HTMLInputElement>) => setNotes(event.target.value)} maxLength={2000} />
      </form>
    </AdaptiveSheet>
  );
}
