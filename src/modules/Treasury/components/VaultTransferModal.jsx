/**
 * VaultTransferModal — تحويل نقد بين خزينتين عبر FinancialCore.processTransfer
 * (قيد transfer في الدفتر؛ بدون فاتورة؛ بدون أثر على P&L)
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useApiMutation } from '../../../hooks/useApiMutation';
import { createVaultTransfer, getVaults, throwIfApiFailed } from '../../../services/api';
import { invalidateOnFinancialMutation } from '../../../utils/queryInvalidation';
import { useTranslation } from '../../../i18n/useTranslation';
import { getSaudiToday } from '../../../utils/saudiDate';
import { vaultDisplayName } from '../../../utils/vaultDisplay';
import { roundMoney2 } from '../../../utils/moneyInput';
import { fmt } from '../../../utils/format';
import { useToast } from '../../../context/ToastContext';
import { Button, Input, AdaptiveSheet } from '../../../ui';

export default function VaultTransferModal({ companyId, onClose }) {
  const { t, lang } = useTranslation();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  /** أرصدة كاملة (بدون فلترة فترة) — مطابقة للتحقق من الرصيد في الخادم */
  const { data: rawVaults = [], isLoading: vaultsLoading } = useQuery({
    queryKey: ['vaults', companyId, false, '', ''],
    queryFn: async () => {
      const res = await getVaults(companyId, false);
      throwIfApiFailed(res, t('loadMovementsFailed'));
      const d = res.data;
      return Array.isArray(d) ? d : (d?.items ?? []);
    },
    enabled: !!companyId,
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
    mutationFn: (payload) => createVaultTransfer(payload),
    successToast: false,
    onSuccess: (res) => {
      invalidateOnFinancialMutation(queryClient);
      const data = res?.data ?? res;
      const ref = data?.referenceId ?? '';
      showToast(
        ref ? t('vaultTransferSuccessRef', ref) : t('vaultTransferSuccess'),
        'success',
      );
      onClose?.();
    },
    showErrorToast: true,
    errorToast: (err) => err?.message || t('saveFailed'),
  });

  const handleSubmit = useCallback(
    (e) => {
      e?.preventDefault?.();
      const amt = roundMoney2(amount);
      if (!companyId || !fromId || !toId || fromId === toId) return;
      if (!amt || amt <= 0) return;
      const idempotencyKey = `vtr-${companyId}-${fromId}-${toId}-${txDate}-${amt}-${Date.now()}`;
      transferMut.mutate({
        companyId,
        fromVaultId: fromId,
        toVaultId: toId,
        amount: String(amt),
        transactionDate: txDate,
        notes: notes.trim() || undefined,
        idempotencyKey,
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
          onChange={(e) => setFromId(e.target.value)}
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
          onChange={(e) => setToId(e.target.value)}
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
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0"
          required
        />

        <Input type="date" label={t('vaultTransferDate')} value={txDate} onChange={(e) => setTxDate(e.target.value)} required />

        <Input
          type="text"
          label={t('vaultTransferNotes')}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          multiline
          rows={2}
          placeholder={t('vaultTransferNotesPlaceholder')}
        />

      </form>
    </AdaptiveSheet>
  );
}
