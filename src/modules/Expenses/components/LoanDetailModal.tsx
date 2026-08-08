import React, { useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useApiMutation } from '../../../hooks/useApiMutation';
import { convertLoanLegacyInvoices, reverseLoanPayment } from '../../../services/api';
import { loanKeys } from '../../../services/queryKeys';
import { getSaudiToday, formatSaudiDate } from '../../../utils/saudiDate';
import { invalidateOnFinancialMutation } from '../../../utils/queryInvalidation';
import { AdaptiveSheet, Badge, Button, DialogActions, FmtNum, Input, TransactionDatePicker } from '../../../ui';
import type { LoanPaymentReversePayload, LoanRecord } from '../../../types/api';
import LoanPaymentModal from './LoanPaymentModal';

type Props = { companyId: string; loan: LoanRecord; allLoans: LoanRecord[]; onClose: () => void; onChanged: () => void };
function attemptKey(companyId: string) { const suffix = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2); return `loan-reverse-${companyId}-${suffix}`; }

function ReversePaymentModal({ companyId, loan, paymentId, paymentDate, onClose, onSaved }: { companyId: string; loan: LoanRecord; paymentId: string; paymentDate: string; onClose: () => void; onSaved: () => void }) {
  const queryClient = useQueryClient(); const keyRef = useRef(attemptKey(companyId));
  const minimumDate = String(paymentDate).slice(0, 10); const today = getSaudiToday();
  const [transactionDate, setTransactionDate] = useState(minimumDate > today ? minimumDate : today); const [notes, setNotes] = useState(''); const [error, setError] = useState('');
  const mutation = useApiMutation({ mutationFn: (body: LoanPaymentReversePayload) => reverseLoanPayment(loan.id, paymentId, body), showErrorToast: false, onSuccess: () => { void queryClient.invalidateQueries({ queryKey: loanKeys.root() }); invalidateOnFinancialMutation(queryClient); onSaved(); }, onError: (err: Error) => setError(err.message || 'تعذر إلغاء السداد') });
  return <AdaptiveSheet open onClose={onClose} size="sm" side="start" title="إلغاء سداد قرض" footer={<DialogActions actions={[{ key: 'cancel', label: 'إلغاء', role: 'cancel', onClick: onClose }, { key: 'save', label: mutation.isPending ? 'جارٍ الحفظ…' : 'تأكيد الإلغاء', role: 'danger', type: 'submit', form: 'loan-payment-reverse-form', disabled: mutation.isPending }]} />}>
    <form id="loan-payment-reverse-form" onSubmit={(event) => { event.preventDefault(); setError(''); mutation.mutate({ companyId, transactionDate, notes: notes.trim() || undefined, idempotencyKey: keyRef.current }); }} className="flex flex-col gap-3">
      <p className="m-0 rounded-lg border border-noorix-red/25 bg-noorix-red/5 px-3 py-2 text-[12px] leading-6 text-noorix-muted">لن نحذف السداد. سيُنشئ النظام حركة عكس تحفظ تاريخ العملية وتعيد الرصيد المتبقي.</p>
      {error ? <div className="rounded-lg border border-noorix-red/30 bg-noorix-red/5 px-3 py-2 text-[13px] text-noorix-red">{error}</div> : null}
      <TransactionDatePicker label="تاريخ الإلغاء" value={transactionDate} min={minimumDate} onValueChange={setTransactionDate} required />
      <Input label="سبب الإلغاء" value={notes} onChange={(event: React.ChangeEvent<HTMLInputElement>) => setNotes(event.target.value)} maxLength={2000} />
    </form>
  </AdaptiveSheet>;
}

function ConvertLegacyInvoicesModal({ loan, onClose, onSaved }: { loan: LoanRecord; onClose: () => void; onSaved: () => void }) {
  const queryClient = useQueryClient();
  const [error, setError] = useState('');
  const pending = (loan.legacyInvoices || []).filter((invoice) => !invoice.convertedAt);
  const total = pending.reduce((sum, invoice) => sum + Number(invoice.amount), 0);
  const mutation = useApiMutation({ mutationFn: () => convertLoanLegacyInvoices(loan.id), showErrorToast: false, onSuccess: () => { void queryClient.invalidateQueries({ queryKey: loanKeys.root() }); onSaved(); }, onError: (err: Error) => setError(err.message || 'تعذّر تحويل الفواتير إلى سدادات قرض') });
  return <AdaptiveSheet open onClose={onClose} size="sm" side="start" title="تحويل الفواتير إلى سدادات" footer={<DialogActions actions={[{ key: 'cancel', label: 'إلغاء', role: 'cancel', onClick: onClose }, { key: 'save', label: mutation.isPending ? 'جارٍ التحويل…' : 'تأكيد التحويل', role: 'save', onClick: () => mutation.mutate(), disabled: mutation.isPending || !pending.length }]} />}>
    <div className="flex flex-col gap-3 text-[13px] leading-6 text-noorix-muted">
      <div className="rounded-lg border border-noorix-blue/25 bg-noorix-blue/5 px-3 py-2">سيُعطّل أثر الفاتورة كمصروف مع الإبقاء عليها في السجل، ثم ينشأ سداد قرض بنفس التاريخ والخزينة والمبلغ. لا تتغير حركة الخزينة أو الرصيد الحالي للقرض.</div>
      <div className="rounded-lg border border-noorix-border bg-noorix-bg-muted px-3 py-2"><strong className="text-noorix-text">{pending.length}</strong> فواتير · <strong className="nx-font-numbers text-noorix-text">{total.toLocaleString('en-US', { maximumFractionDigits: 2 })} SR</strong></div>
      {error ? <div className="rounded-lg border border-noorix-red/30 bg-noorix-red/5 px-3 py-2 text-noorix-red">{error}</div> : null}
    </div>
  </AdaptiveSheet>;
}

export default function LoanDetailModal({ companyId, loan, allLoans, onClose, onChanged }: Props) {
  const [showPayment, setShowPayment] = useState(false);
  const [paymentToReverse, setPaymentToReverse] = useState<{ id: string; date: string } | null>(null);
  const [showLegacyConversion, setShowLegacyConversion] = useState(false);
  const payments = useMemo(() => (loan.payments || []).filter((payment) => !payment.reversalOfId), [loan.payments]);
  const pendingLegacyInvoices = (loan.legacyInvoices || []).filter((invoice) => !invoice.convertedAt);
  const changed = () => { setShowPayment(false); setPaymentToReverse(null); onChanged(); };
  return <>
    <AdaptiveSheet open onClose={onClose} size="lg" side="start" title={loan.nameAr} footer={<DialogActions actions={[{ key: 'close', label: 'إغلاق', role: 'cancel', onClick: onClose }, ...(pendingLegacyInvoices.length ? [{ key: 'convert', label: 'تحويل إلى سدادات', role: 'secondary' as const, onClick: () => setShowLegacyConversion(true) }] : []), { key: 'pay', label: 'سداد قرض', role: 'save', onClick: () => setShowPayment(true) }]} />}>
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div className="rounded-lg border border-noorix-border bg-noorix-bg-muted px-3 py-3 text-center"><div className="text-[11px] text-noorix-muted">الرصيد الافتتاحي</div><FmtNum n={Number(loan.openingAmount)} className="mt-1 block nx-font-numbers text-[18px] font-bold" /><span className="nx-sar text-[11px]">SR</span></div>
          <div className="rounded-lg border border-noorix-green/30 bg-noorix-green/5 px-3 py-3 text-center"><div className="text-[11px] text-noorix-muted">المتبقي الآن</div><FmtNum n={Number(loan.outstandingAmount)} className="mt-1 block nx-font-numbers text-[18px] font-bold text-noorix-green" /><span className="nx-sar text-[11px]">SR</span></div>
          <div className="rounded-lg border border-noorix-border bg-noorix-bg-muted px-3 py-3 text-center"><div className="text-[11px] text-noorix-muted">آخر تاريخ متوقع</div><div className="mt-1 font-bold nx-font-numbers text-[14px]">{loan.dueDate ? formatSaudiDate(loan.dueDate) : '-'}</div></div>
        </div>
        {loan.creditorName || loan.notes ? <div className="rounded-lg border border-noorix-border px-3 py-2 text-[13px] text-noorix-muted">{loan.creditorName ? <div>الجهة: <strong className="text-noorix-text">{loan.creditorName}</strong></div> : null}{loan.notes ? <div className="mt-1">{loan.notes}</div> : null}</div> : null}
        {(loan.historicalPaymentsCount || Number(loan.historicalPaidAmount || 0) > 0) ? <div className="rounded-lg border border-noorix-blue/25 bg-noorix-blue/5 px-3 py-2 text-[12px] text-noorix-muted">دفعات سابقة قبل نوركس: <strong>{loan.historicalPaymentsCount || 0}</strong> دفعة، بإجمالي <strong className="nx-font-numbers">{Number(loan.historicalPaidAmount || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })} SR</strong>{loan.historicalPaidThroughDate ? ` حتى ${formatSaudiDate(loan.historicalPaidThroughDate)}` : ''}. هذه معلومات توثيقية ولا تؤثر على الخزينة.</div> : null}
        {loan.legacyInvoices?.length ? <div className="rounded-lg border border-noorix-blue/25 bg-noorix-blue/5 px-3 py-2 text-[12px] text-noorix-muted"><strong>فواتير مرتبطة من البند القديم ({loan.legacyInvoices.length})</strong><div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">{loan.legacyInvoices.map((invoice) => <span key={invoice.id} className="nx-font-numbers">{invoice.invoiceNumber} · {formatSaudiDate(invoice.transactionDate)} · {Number(invoice.amount).toLocaleString('en-US', { maximumFractionDigits: 2 })} SR</span>)}</div><div className="mt-1">{pendingLegacyInvoices.length ? 'يمكن تحويلها إلى سدادات قرض موثقة دون تغيير الرصيد الحالي.' : 'تم تحويلها إلى سدادات قرض؛ الفواتير الأصلية معطّلة ومحفوظة للتدقيق.'}</div></div> : null}
        <div className="overflow-x-auto rounded-lg border border-noorix-border"><table className="w-full min-w-[42rem] border-collapse text-[13px]"><thead className="bg-noorix-bg-muted"><tr><th className="p-2 text-right">التاريخ</th><th className="p-2 text-right">الخزينة / المصدر</th><th className="p-2 text-right">المبلغ</th><th className="p-2 text-right">الحالة</th><th className="p-2 text-right">إجراء</th></tr></thead><tbody>{payments.length ? payments.map((payment) => <tr key={payment.id} className="border-t border-noorix-border"><td className="p-2 nx-font-numbers">{formatSaudiDate(payment.transactionDate)}</td><td className="p-2">{payment.vault?.nameAr || payment.vault?.nameEn || '-'}{payment.sourceInvoice?.invoiceNumber ? <div className="mt-0.5 text-[11px] text-noorix-muted nx-font-numbers">{payment.sourceInvoice.invoiceNumber}</div> : null}</td><td className="p-2 nx-font-numbers"><FmtNum n={Number(payment.amount)} /> <span className="nx-sar">SR</span></td><td className="p-2"><Badge color={payment.status === 'reversed' ? 'red' : 'green'} size="sm">{payment.status === 'reversed' ? 'ملغى' : payment.sourceInvoice ? 'سداد مرحّل' : 'مسدد'}</Badge></td><td className="p-2">{payment.status === 'posted' ? <Button size="sm" variant="danger" onClick={() => setPaymentToReverse({ id: payment.id, date: payment.transactionDate })}>إلغاء السداد</Button> : '-'}</td></tr>) : <tr><td className="p-5 text-center text-noorix-muted" colSpan={5}>لا توجد سدادات داخل نوركس حتى الآن.</td></tr>}</tbody></table></div>
      </div>
    </AdaptiveSheet>
    {showPayment ? <LoanPaymentModal companyId={companyId} loans={allLoans} loanId={loan.id} onClose={() => setShowPayment(false)} onSaved={changed} /> : null}
    {paymentToReverse ? <ReversePaymentModal companyId={companyId} loan={loan} paymentId={paymentToReverse.id} paymentDate={paymentToReverse.date} onClose={() => setPaymentToReverse(null)} onSaved={changed} /> : null}
    {showLegacyConversion ? <ConvertLegacyInvoicesModal loan={loan} onClose={() => setShowLegacyConversion(false)} onSaved={() => { setShowLegacyConversion(false); onChanged(); }} /> : null}
  </>;
}
