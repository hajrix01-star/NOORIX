import React, { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useApiMutation } from '../../../hooks/useApiMutation';
import { useTranslation } from '../../../i18n/useTranslation';
import { reverseVaultTransfer } from '../../../services/api';
import type { ReverseVaultTransferPayload } from '../../../types/api';
import { getSaudiToday } from '../../../utils/saudiDate';
import { invalidateOnFinancialMutation } from '../../../utils/queryInvalidation';
import { AdaptiveSheet, DialogActions, Input, TransactionDatePicker } from '../../../ui';

type Props = {
  companyId: string;
  transferId: string;
  transferNumber: string;
  originalDate: string;
  onClose: () => void;
};

function createReversalAttemptKey(companyId: string) {
  const suffix = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
  return `vtr-reverse-${companyId}-${suffix}`;
}

export default function VaultTransferReverseModal({
  companyId,
  transferId,
  transferNumber,
  originalDate,
  onClose,
}: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const keyRef = useRef(createReversalAttemptKey(companyId));
  const today = getSaudiToday();
  const minimumDate = String(originalDate || '').slice(0, 10);
  const [transactionDate, setTransactionDate] = useState(
    minimumDate && minimumDate > today ? minimumDate : today,
  );
  const [reason, setReason] = useState('');

  const mutation = useApiMutation<unknown, ReverseVaultTransferPayload>({
    mutationFn: (payload) => reverseVaultTransfer(transferId, payload),
    successToast: t('vaultTransferReverseSuccess'),
    onSuccess: () => {
      invalidateOnFinancialMutation(queryClient);
      onClose();
    },
    errorToast: (error) => error.message || t('saveFailed'),
  });

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    mutation.mutate({
      companyId,
      transactionDate,
      reason: reason.trim() || undefined,
      idempotencyKey: keyRef.current,
    });
  };

  return (
    <AdaptiveSheet
      open
      onClose={onClose}
      title={t('vaultTransferReverseTitle')}
      size="sm"
      side="start"
      footer={(
        <DialogActions
          actions={[
            { key: 'cancel', label: t('cancel'), role: 'cancel', onClick: onClose },
            {
              key: 'submit',
              label: t('vaultTransferReverseSubmit'),
              role: 'danger',
              type: 'submit',
              form: 'vault-transfer-reverse-form',
              disabled: mutation.isPending,
            },
          ]}
        />
      )}
    >
      <form id="vault-transfer-reverse-form" onSubmit={submit} className="flex flex-col gap-3">
        <div className="rounded-lg border border-noorix-border bg-noorix-bg-muted px-3 py-2 text-center text-[13px] font-bold nx-font-numbers">
          {transferNumber}
        </div>
        <p className="m-0 text-[12px] leading-relaxed text-noorix-muted">
          {t('vaultTransferReverseHint')}
        </p>
        <TransactionDatePicker
          label={t('vaultTransferDate')}
          value={transactionDate}
          min={minimumDate || undefined}
          onValueChange={setTransactionDate}
          required
        />
        <Input
          label={t('vaultTransferReverseReason')}
          value={reason}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => setReason(event.target.value)}
          maxLength={500}
        />
      </form>
    </AdaptiveSheet>
  );
}
