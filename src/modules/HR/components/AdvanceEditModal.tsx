import React, { useState } from 'react';
import { updateInvoice, throwIfApiFailed } from '../../../services/api';
import { toYmd } from '../../../utils/saudiDate';
import { useTranslation } from '../../../i18n/useTranslation';
import { AdaptiveSheet, Button, DateField, FmtNum, Input } from '../../../ui';

type AdvanceEditRecord = {
  id: string;
  totalAmount?: number | string | null;
  transactionDate?: string | Date | null;
  notes?: string | null;
  installmentCount?: number | string | null;
};
type AdvanceEditModalProps = {
  advance: AdvanceEditRecord;
  companyId: string;
  onClose: () => void;
  onSaved?: () => void;
  onError?: (message: string) => void;
};
type AdvanceEditInputChange = React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>;

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function AdvanceEditModal({ advance, companyId, onClose, onSaved, onError }: AdvanceEditModalProps) {
  const { t } = useTranslation();
  const [amount, setAmount] = useState(String(Number(advance?.totalAmount ?? 0)));
  const [date, setDate] = useState(toYmd(advance?.transactionDate));
  const [notes, setNotes] = useState(advance?.notes || '');
  const [installmentCount, setInstallmentCount] = useState(
    Number(advance?.installmentCount || 0) > 1 ? String(advance.installmentCount) : '',
  );
  const [saving, setSaving] = useState(false);

  const parsedCount = parseInt(installmentCount, 10) || 1;
  const installmentAmt = parsedCount > 1
    ? Math.ceil((Number(amount || 0) / parsedCount) * 100) / 100
    : null;

  async function submit() {
    const val = Number(amount || 0);
    if (val <= 0) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        totalAmount: val,
        isTaxable: false,
        transactionDate: date,
        notes,
      };
      if (parsedCount > 1) {
        payload.installmentCount = parsedCount;
        payload.installmentAmount = installmentAmt;
      } else {
        payload.installmentCount = 1;
        payload.installmentAmount = val;
      }
      const res = await updateInvoice(advance.id, payload, companyId);
      throwIfApiFailed(res, t('saveFailed'));
      onSaved?.();
    } catch (e: unknown) {
      onError?.(getErrorMessage(e, t('saveFailed')));
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdaptiveSheet
      open={true}
      onClose={onClose}
      title={t('editAdvance')}
      size="md"
      side="start"
      className="hr-advance-edit-drawer"
      footer={(
        <>
          <Button variant="ghost" onClick={onClose}>{t('cancel')}</Button>
          <Button variant="primary" disabled={saving} onClick={submit}>{saving ? t('saving') : t('saveChanges')}</Button>
        </>
      )}
    >
      <div className="grid gap-2.5">
        <Input type="number" label={t('advanceAmount')} min="0.01" step="0.01" value={amount} onChange={(e: AdvanceEditInputChange) => setAmount(e.target.value)} />
        <DateField label={t('advanceLoanDate')} value={date} onValueChange={setDate} />
        <Input
          type="number"
          min="1"
          max="120"
          step="1"
          label={t('installmentCount')}
          value={installmentCount}
          onChange={(e: AdvanceEditInputChange) => setInstallmentCount(e.target.value)}
          placeholder="1"
        />
        {parsedCount > 1 && installmentAmt && (
          <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-noorix-bg-muted border border-noorix-border">
            <span className="text-[13px] text-noorix-muted">{t('installmentAmount')}</span>
            <span dir="ltr" className="text-[15px] font-bold text-noorix-blue">
              <FmtNum n={installmentAmt} /> <span className="nx-sar">SR</span>
            </span>
          </div>
        )}
        <Input multiline rows={3} label={t('notes')} value={notes} onChange={(e: AdvanceEditInputChange) => setNotes(e.target.value)} />
      </div>
    </AdaptiveSheet>
  );
}
