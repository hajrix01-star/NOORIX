import type { ChangeEvent } from 'react';
import { DateField, DialogActions, Input, Modal, Spinner } from '../../../ui';
import { toDateInputYmd } from '../../../utils/saudiDate';
import type {
  HrLeaveRow,
  IssueSettlementPayload,
  LeaveReturnMutationPayload,
  LeaveSettlementPreview,
} from './leaveTabModel';

type TranslationFn = (key: string, ...args: string[]) => string;

type LeaveSalarySettlementModalProps = {
  row: HrLeaveRow | null;
  amount: string;
  overrideReason: string;
  preview?: LeaveSettlementPreview;
  isLoading: boolean;
  isError: boolean;
  errorMessage: string;
  isPending: boolean;
  t: TranslationFn;
  onClose: () => void;
  onAmountChange: (value: string) => void;
  onOverrideReasonChange: (value: string) => void;
  onSave: (payload: IssueSettlementPayload) => void;
};

export function LeaveSalarySettlementModal({
  row,
  amount,
  overrideReason,
  preview,
  isLoading,
  isError,
  errorMessage,
  isPending,
  t,
  onClose,
  onAmountChange,
  onOverrideReasonChange,
  onSave,
}: LeaveSalarySettlementModalProps) {
  const suggestedAmount = Number(preview?.suggestedAmount ?? (amount || 0));
  const hasOverride = Math.abs(Number(amount || 0) - suggestedAmount) > 0.005;
  const saveDisabled = isPending || isLoading || !preview || !amount || (hasOverride && !overrideReason.trim());

  return (
    <Modal
      open={!!row}
      onClose={onClose}
      title={t('leaveSalarySettlementTitle')}
      size="sm"
      footer={(
        <DialogActions
          actions={[
            { key: 'cancel', label: t('cancel'), role: 'cancel', onClick: onClose },
            {
              key: 'save',
              label: isPending ? t('saving') : t('save'),
              role: 'save',
              disabled: saveDisabled,
              onClick: () => {
                if (!row) return;
                onSave({
                  id: row.id,
                  grossAmount: amount,
                  manualOverrideReason: overrideReason,
                });
              },
            },
          ]}
        />
      )}
    >
      {isLoading && (
        <div className="flex justify-center py-6">
          <Spinner />
        </div>
      )}
      {!isLoading && isError && (
        <p className="text-[13px] text-noorix-red">{errorMessage}</p>
      )}
      {!isLoading && preview && (
        <>
          <p className="text-[12px] text-noorix-muted mb-2">
            {t(
              'leaveSalarySettlementCalendarHint',
              String(preview.calendarDaysPaid),
              String(preview.daysInMonth),
            )}
          </p>
          <Input
            type="number"
            step="0.01"
            min="0.01"
            label={t('leaveSalarySettlementAmountLabel')}
            value={amount}
            onChange={(event: ChangeEvent<HTMLInputElement>) => onAmountChange(event.target.value)}
            className="ltr"
          />
          {hasOverride && (
            <Input
              multiline
              rows={3}
              label={t('leaveSalarySettlementOverrideReasonLabel')}
              value={overrideReason}
              onChange={(event: ChangeEvent<HTMLTextAreaElement>) => onOverrideReasonChange(event.target.value)}
              placeholder={t('leaveSalarySettlementOverrideReasonPlaceholder')}
            />
          )}
        </>
      )}
    </Modal>
  );
}

type LeaveReturnModalProps = {
  row: HrLeaveRow | null;
  returnDate: string;
  isPending: boolean;
  t: TranslationFn;
  onClose: () => void;
  onReturnDateChange: (value: string) => void;
  onSave: (payload: LeaveReturnMutationPayload) => void;
};

export function LeaveReturnModal({
  row,
  returnDate,
  isPending,
  t,
  onClose,
  onReturnDateChange,
  onSave,
}: LeaveReturnModalProps) {
  return (
    <Modal
      open={!!row}
      onClose={onClose}
      title={t('leaveReturnFromLeave')}
      size="sm"
      footer={(
        <DialogActions
          actions={[
            { key: 'cancel', label: t('cancel'), role: 'cancel', onClick: onClose },
            {
              key: 'save',
              label: isPending ? t('saving') : t('save'),
              role: 'save',
              disabled: isPending || !returnDate,
              onClick: () => {
                if (!row) return;
                onSave({ id: row.id, actualReturnDate: returnDate });
              },
            },
          ]}
        />
      )}
    >
      <p className="text-[13px] text-noorix-muted mb-3">{t('leaveReturnEarlyHint')}</p>
      {row && (
        <DateField
          label={t('leaveActualReturnDate')}
          value={returnDate}
          min={toDateInputYmd(row.startDate)}
          max={toDateInputYmd(row.endDate)}
          onValueChange={onReturnDateChange}
          lang="en"
        />
      )}
    </Modal>
  );
}
