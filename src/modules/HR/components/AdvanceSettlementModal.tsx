import React, { useState } from 'react';
import { createDeduction, updateInvoice, throwIfApiFailed } from '../../../services/api';
import { getSaudiToday } from '../../../utils/saudiDate';
import { useTranslation } from '../../../i18n/useTranslation';
import { hrFmt } from '../utils/hrFmt';
import { AdaptiveSheet, Button, Input } from '../../../ui';

export function AdvanceSettlementModal({ advance, companyId, onClose, onSaved, onError }: any) {
  const { t } = useTranslation();
  const total = Number(advance?.totalAmount ?? 0);
  const alreadySettled = Number(advance?.settledAmount ?? 0);
  const remaining = Math.max(0, total - alreadySettled);
  const [settlementType, setSettlementType] = useState('full');
  const [settleAmount, setSettleAmount] = useState(String(remaining));
  const [settleDate, setSettleDate] = useState(getSaudiToday());
  const [deferMonth, setDeferMonth] = useState('');
  const [applyToSalary, setApplyToSalary] = useState(true);
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    try {
      if (settlementType === 'defer') {
        const deferNote = `${advance?.notes || ''}\n[ADV_DEFER] ${deferMonth || ''}`.trim();
        const res = await updateInvoice(advance.id, { notes: deferNote }, companyId);
        throwIfApiFailed(res, t('saveFailed'));
        onSaved?.();
        return;
      }

      const amountToSettle = settlementType === 'full' ? remaining : Number(settleAmount || 0);
      if (amountToSettle <= 0 || amountToSettle > remaining) {
        throw new Error('قيمة التسديد غير صحيحة.');
      }

      const newSettledAmount = alreadySettled + amountToSettle;
      const notes = `${advance?.notes || ''}\n[ADV_SETTLE] ${amountToSettle} @ ${settleDate}`.trim();
      const invRes = await updateInvoice(advance.id, {
        settledAmount: newSettledAmount,
        settledAt: settleDate,
        notes,
      }, companyId);
      throwIfApiFailed(invRes, t('saveFailed'));

      if (applyToSalary) {
        const dRes = await createDeduction({
          companyId,
          employeeId: advance.employeeId,
          deductionType: 'advance',
          amount: amountToSettle,
          transactionDate: settleDate,
          referenceId: advance.id,
          notes: `خصم سلفة (${advance.invoiceNumber || advance.id})`,
        });
        throwIfApiFailed(dRes, t('saveFailed'));
      }
      onSaved?.();
    } catch (e: any) {
      onError?.(e?.message || t('saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdaptiveSheet
      open={true}
      onClose={onClose}
      title={t('settleAdvance')}
      size="md"
      side="start"
      className="hr-advance-settle-drawer"
      footer={(
        <>
          <Button variant="ghost" onClick={onClose}>{t('cancel')}</Button>
          <Button variant="primary" disabled={saving} onClick={submit}>{saving ? t('saving') : t('saveChanges')}</Button>
        </>
      )}
    >
      <div className="text-[13px] mb-2">{t('advanceRemainingAmount')}: <strong>{hrFmt(remaining)}</strong></div>
      <div className="grid gap-2.5">
        <Input type="select" label="نوع التسوية" value={settlementType} onChange={(e: any) => setSettlementType(e.target.value)}>
          <option value="full">{t('settlementFull')}</option>
          <option value="partial">{t('settlementPartial')}</option>
          <option value="defer">{t('settlementDefer')}</option>
        </Input>
        {settlementType === 'partial' && (
          <Input type="number" label={t('advanceSettledAmount')} min="0.01" step="0.01" value={settleAmount} onChange={(e: any) => setSettleAmount(e.target.value)} />
        )}
        {settlementType === 'defer' ? (
          <Input type="month" label="شهر التأجيل" value={deferMonth} onChange={(e: any) => setDeferMonth(e.target.value)} />
        ) : (
          <>
            <Input type="date" label={t('advanceSettlementDate')} value={settleDate} onChange={(e: any) => setSettleDate(e.target.value)} />
            <label className="nx-checkbox">
              <input type="checkbox" checked={applyToSalary} onChange={(e: any) => setApplyToSalary(e.target.checked)} />
              {t('applyToSalaryDeduction')}
            </label>
          </>
        )}
      </div>
    </AdaptiveSheet>
  );
}
