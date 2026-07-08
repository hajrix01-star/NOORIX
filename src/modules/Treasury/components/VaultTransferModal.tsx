/**
 * VaultTransferModal — تحويل نقد بين خزينتين عبر FinancialCore.processTransfer
 * (قيد transfer في الدفتر؛ بدون فاتورة؛ بدون أثر على P&L)
 */
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useApiMutation } from '../../../hooks/useApiMutation';
import { useApiListQuery } from '../../../hooks/useApiQuery';
import { createVaultTransfer, getVaults } from '../../../services/api';
import { invalidateOnFinancialMutation } from '../../../utils/queryInvalidation';
import { vaultKeys } from '../../../services/queryKeys';
import { useTranslation } from '../../../i18n/useTranslation';
import { getSaudiToday } from '../../../utils/saudiDate';
import { vaultDisplayName } from '../../../utils/vaultDisplay';
import { roundMoney2 } from '../../../utils/moneyInput';
import { fmt } from '../../../utils/format';
import { useToast } from '../../../context/ToastContext';
import { Button, TransactionDatePicker, Input, AdaptiveSheet } from '../../../ui';
import type { VaultRecord, VaultTransferPayload, VaultTransferResult } from '../../../types/api';

type VaultTransferModalProps = {
  companyId: string;
  onClose: () => void;
};

function createTransferAttemptKey(companyId: string) {
  const randomPart = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
  return `vtr-${companyId}-${randomPart}`;
}

function hasTransferData(res: { data?: VaultTransferResult } | VaultTransferResult): res is { data?: VaultTransferResult } {
  return Object.prototype.hasOwnProperty.call(res, 'data');
}

function unwrapTransferResult(res: { data?: VaultTransferResult } | VaultTransferResult): VaultTransferResult {
  return hasTransferData(res) ? (res.data ?? {}) : res;
}

export default function VaultTransferModal({ companyId, onClose }: VaultTransferModalProps) {
  const { t, lang } = useTranslation();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const idempotencyKeyRef = useRef(createTransferAttemptKey(companyId));

  /**
   * جلب الخزائن بدون فلتر تاريخ حتى يعكس الرصيد المعروض الرصيد الكلي التراكمي.
   * التحويل لا يُرفض لنقص الرصيد (سياسة مقصودة — يُسمح بالرصيد السالب في الدفتر).
   */
  const { data: rawVaults = [], isLoading: vaultsLoading } = useApiListQuery<VaultRecord>({
    queryKey: vaultKeys.list(companyId, false, '', ''),
    queryFn: () => getVaults(companyId, false, undefined, undefined),
    enabled: !!companyId,
    fallbackMessage: t('loadMovementsFailed'),
  });

  const selectableVaults = useMemo(
    () => (rawVaults || []).filter((v) => v.isActive !== false && !v.isArchived),
    [rawVaults],
  );

  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState('');
  const [amount, setAmount] = useState('');
  const [txDate, setTxDate] = useState(getSaudiToday());
  const [notes, setNotes] = useState('');

  useEffect(() => {
    const list = (rawVaults || []).filter((v) => v.isActive !== false && !v.isArchived);
    if (list.length < 2) return;
    setFromId(list[0].id);
    setToId(list[1].id);
  }, [rawVaults]);

  const transferMut = useApiMutation({
    mutationFn: (payload: VaultTransferPayload) => createVaultTransfer(payload),
    successToast: false,
    onSuccess: (res: { data?: VaultTransferResult } | VaultTransferResult) => {
      invalidateOnFinancialMutation(queryClient);
      const data = unwrapTransferResult(res);
      const ref = data?.referenceId ?? '';
      showToast(
        ref ? t('vaultTransferSuccessRef', ref) : t('vaultTransferSuccess'),
        'success',
      );
      onClose?.();
    },
    showErrorToast: true,
    errorToast: (err: Error) => err.message || t('saveFailed'),
  });

  const handleSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e?.preventDefault?.();
      const amt = roundMoney2(amount);
      if (!companyId || !fromId || !toId || fromId === toId) return;
      if (!amt || amt <= 0) return;
      transferMut.mutate({
        companyId,
        fromVaultId: fromId,
        toVaultId: toId,
        amount: String(amt),
        transactionDate: txDate,
        notes: notes.trim() || undefined,
        idempotencyKey: idempotencyKeyRef.current,
      });
    },
    [companyId, fromId, toId, amount, txDate, notes, transferMut],
  );

  const fromVault = selectableVaults.find((v) => v.id === fromId);

  return (
    <AdaptiveSheet
      open
      onClose={onClose}
      title={t('vaultTransferTitle')}
      size="md"
      side="start"
      className="vault-transfer-drawer"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} type="button">
            {t('cancel')}
          </Button>
          <Button
            variant="primary"
            type="submit"
            form="vault-transfer-form"
            disabled={
              transferMut.isPending ||
              selectableVaults.length < 2 ||
              !fromId ||
              !toId ||
              fromId === toId
            }
          >
            {transferMut.isPending ? t('saving') : t('vaultTransferSubmit')}
          </Button>
        </>
      }
    >
      <p className="text-[12px] leading-relaxed text-noorix-muted m-0 mb-4">
        {t('vaultTransferHint')}
      </p>

      {vaultsLoading && (
        <div className="text-[12px] text-noorix-muted mb-3">{t('loading')}</div>
      )}

      {!vaultsLoading && selectableVaults.length < 2 && (
        <div className="rounded-lg border border-noorix-border bg-noorix-bg-muted px-3 py-2 text-[12px] text-noorix-muted mb-4">
          {t('vaultTransferNeedTwoVaults')}
        </div>
      )}

      <form id="vault-transfer-form" onSubmit={handleSubmit} className="flex flex-col gap-3">
        <Input
          type="select"
          label={t('vaultTransferFrom')}
          value={fromId}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFromId(e.target.value)}
          required
        >
          <option value="">—</option>
          {selectableVaults.map((v) => (
            <option key={v.id} value={v.id}>
              {vaultDisplayName(v, lang)}
              {typeof v.balance === 'number' ? ` — ${fmt(v.balance)} SR` : ''}
            </option>
          ))}
        </Input>
        {fromVault && typeof fromVault.balance === 'number' && (
          <div className="-mt-1 flex flex-wrap items-baseline gap-1 text-[11px] text-noorix-muted">
            <span>{t('balance')}:</span>
            <span className="font-semibold nx-font-numbers text-noorix-text">{fmt(fromVault.balance)}</span>
            <span className="nx-sar">SR</span>
          </div>
        )}

        <Input
          type="select"
          label={t('vaultTransferTo')}
          value={toId}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setToId(e.target.value)}
          required
        >
          <option value="">—</option>
          {selectableVaults.map((v) => (
            <option key={v.id} value={v.id} disabled={v.id === fromId}>
              {vaultDisplayName(v, lang)}
            </option>
          ))}
        </Input>

        <Input
          type="number"
          step="0.01"
          min="0"
          label={t('amount')}
          value={amount}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAmount(e.target.value)}
          placeholder="0"
          required
        />

        <TransactionDatePicker label={t('vaultTransferDate')} value={txDate} onValueChange={setTxDate} required />

        <Input
          type="text"
          label={t('vaultTransferNotes')}
          value={notes}
          onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setNotes(e.target.value)}
          multiline
          rows={2}
          placeholder={t('vaultTransferNotesPlaceholder')}
        />

      </form>
    </AdaptiveSheet>
  );
}
