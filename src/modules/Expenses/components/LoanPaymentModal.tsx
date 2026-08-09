import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useApiMutation } from '../../../hooks/useApiMutation';
import { useVaults } from '../../../hooks/useVaults';
import { createLoanPayment } from '../../../services/api';
import { loanKeys } from '../../../services/queryKeys';
import { getSaudiToday } from '../../../utils/saudiDate';
import { invalidateOnFinancialMutation } from '../../../utils/queryInvalidation';
import { AdaptiveSheet, DialogActions, Input, SearchableOptionsPicker, TransactionDatePicker } from '../../../ui';
import type { LoanPaymentCreatePayload, LoanRecord } from '../../../types/api';
import { getLoanReferenceInstallmentAmount } from '../loanSchedule';

type Props = { companyId: string; loans: LoanRecord[]; loanId?: string; onClose: () => void; onSaved: () => void };
function attemptKey(companyId: string) { const suffix = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2); return `loan-pay-${companyId}-${suffix}`; }

export default function LoanPaymentModal({ companyId, loans, loanId: initialLoanId, onClose, onSaved }: Props) {
  const queryClient = useQueryClient();
  const keyRef = useRef(attemptKey(companyId));
  const { paymentVaults } = useVaults({ companyId });
  const [loanId, setLoanId] = useState(initialLoanId || loans[0]?.id || '');
  const [vaultId, setVaultId] = useState('');
  const [amount, setAmount] = useState('');
  const [transactionDate, setTransactionDate] = useState(getSaudiToday());
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const selectedLoan = loans.find((loan) => loan.id === loanId);
  const installmentAmount = selectedLoan ? getLoanReferenceInstallmentAmount(selectedLoan) : null;
  const loanOptions = useMemo(() => loans.map((loan) => ({ value: loan.id, label: `${loan.nameAr} — المتبقي ${Number(loan.outstandingAmount).toLocaleString('en-US', { maximumFractionDigits: 1 })} SR` })), [loans]);
  const vaultOptions = useMemo(() => paymentVaults.map((vault) => ({ value: vault.id, label: vault.nameAr || vault.nameEn || vault.id })), [paymentVaults]);
  const mutation = useApiMutation({ mutationFn: ({ id, body }: { id: string; body: LoanPaymentCreatePayload }) => createLoanPayment(id, body), showErrorToast: false, onSuccess: () => { void queryClient.invalidateQueries({ queryKey: loanKeys.root() }); invalidateOnFinancialMutation(queryClient); onSaved(); }, onError: (err: Error) => setError(err.message || 'تعذر تسجيل السداد') });

  useEffect(() => {
    if (!selectedLoan) return;
    const referenceAmount = getLoanReferenceInstallmentAmount(selectedLoan);
    setAmount(referenceAmount ? referenceAmount.toFixed(2) : '');
  }, [selectedLoan?.id]);

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError(''); const value = Number(amount);
    if (!loanId || !vaultId || !Number.isFinite(value) || value <= 0) { setError('اختر التمويل والخزينة وأدخل مبلغاً صحيحاً.'); return; }
    if (selectedLoan && value > Number(selectedLoan.outstandingAmount)) { setError('المبلغ أكبر من الرصيد المتبقي.'); return; }
    mutation.mutate({ id: loanId, body: { companyId, vaultId, amount: value, transactionDate, notes: notes.trim() || undefined, idempotencyKey: keyRef.current } });
  };
  return <AdaptiveSheet open onClose={onClose} size="sm" side="start" title="سداد قرض" footer={<DialogActions actions={[{ key: 'cancel', label: 'إلغاء', role: 'cancel', onClick: onClose }, { key: 'save', label: mutation.isPending ? 'جارٍ الحفظ…' : 'تأكيد السداد', role: 'save', type: 'submit', form: 'loan-payment-form', disabled: mutation.isPending }]} />}>
    <form id="loan-payment-form" onSubmit={submit} className="flex flex-col gap-3">
      <p className="m-0 rounded-lg border border-noorix-blue/25 bg-noorix-blue/5 px-3 py-2 text-[12px] leading-6 text-noorix-muted">السداد يدوي بالكامل. يعبئ نوركس قيمة القسط المرجعية فقط لتسريع الإدخال، ولن ينشئ أي سداد أو يخصم أي مبلغ بدون تأكيدك.</p>
      {error ? <div className="rounded-lg border border-noorix-red/30 bg-noorix-red/5 px-3 py-2 text-[13px] text-noorix-red">{error}</div> : null}
      <SearchableOptionsPicker label="القرض" value={loanId} onChange={setLoanId} options={loanOptions} aria-label="القرض" />
      {selectedLoan ? <div className="rounded-lg border border-noorix-border bg-noorix-bg-muted px-3 py-2 text-center text-[13px]">الرصيد المتبقي: <strong className="nx-font-numbers">{Number(selectedLoan.outstandingAmount).toLocaleString('en-US', { maximumFractionDigits: 2 })} SR</strong>{installmentAmount ? <> · قيمة القسط المرجعية: <strong className="nx-font-numbers">{installmentAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SR</strong></> : null}</div> : null}
      <SearchableOptionsPicker label="السداد من خزينة" value={vaultId} onChange={setVaultId} options={vaultOptions} aria-label="الخزينة" />
      <Input label="مبلغ السداد" type="number" min="0.0001" step="0.01" value={amount} onChange={(event: React.ChangeEvent<HTMLInputElement>) => setAmount(event.target.value)} className="ltr" required />
      <TransactionDatePicker label="تاريخ السداد" value={transactionDate} onValueChange={setTransactionDate} required />
      <Input label="ملاحظات" value={notes} onChange={(event: React.ChangeEvent<HTMLInputElement>) => setNotes(event.target.value)} maxLength={2000} />
    </form>
  </AdaptiveSheet>;
}
