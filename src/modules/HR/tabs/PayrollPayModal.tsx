import React from 'react';
import type { VaultRecord } from '../../../types/api';
import { Button, DateField, DialogActions, Input, Modal } from '../../../ui';
import { vaultDisplayName } from '../../../utils/vaultDisplay';
import { hrFmt } from '../utils/hrFmt';
import type { PayrollIssuePaymentMutation, PayrollPayModalRun, PayrollVaultSplit } from './payrollTabModel';

type Translate = (key: string) => string;

type PayrollPayModalProps = {
  run: PayrollPayModalRun | null;
  transactionDate: string;
  vaultId: string;
  secondVaultId: string;
  secondAmount: string;
  secondEnabled: boolean;
  vaultError: string;
  paymentVaults: VaultRecord[];
  lang: string;
  isPending: boolean;
  t: Translate;
  onTransactionDateChange: (value: string) => void;
  onVaultIdChange: (value: string) => void;
  onSecondVaultIdChange: (value: string) => void;
  onSecondAmountChange: (value: string) => void;
  onSecondEnabledChange: (value: boolean) => void;
  onVaultErrorChange: (value: string) => void;
  onClose: () => void;
  onSubmit: (payload: PayrollIssuePaymentMutation) => void;
};

export function PayrollPayModal({
  run,
  transactionDate,
  vaultId,
  secondVaultId,
  secondAmount,
  secondEnabled,
  vaultError,
  paymentVaults,
  lang,
  isPending,
  t,
  onTransactionDateChange,
  onVaultIdChange,
  onSecondVaultIdChange,
  onSecondAmountChange,
  onSecondEnabledChange,
  onVaultErrorChange,
  onClose,
  onSubmit,
}: PayrollPayModalProps) {
  const resetSecondVault = () => {
    onSecondEnabledChange(false);
    onSecondVaultIdChange('');
    onSecondAmountChange('');
  };

  const handleConfirm = () => {
    if (!run || !transactionDate) return;
    onVaultErrorChange('');

    const netTotal = run.netTotal ?? 0;
    let vaultSplits: PayrollVaultSplit[] = [];

    if (secondEnabled) {
      const firstVaultId = vaultId.trim();
      const nextVaultId = secondVaultId.trim();
      const nextAmount = parseFloat(secondAmount);

      if (!firstVaultId || !nextVaultId) {
        onVaultErrorChange(t('payrollSplitVaultsIncomplete'));
        return;
      }
      if (firstVaultId === nextVaultId) {
        onVaultErrorChange(t('invoiceVaultsMustDiffer'));
        return;
      }
      if (Number.isNaN(nextAmount) || nextAmount <= 0 || nextAmount >= netTotal - 0.001) {
        onVaultErrorChange(t('payrollSplitVaultsIncomplete'));
        return;
      }

      const firstAmount = Math.round((netTotal - nextAmount) * 100) / 100;
      vaultSplits = [
        { vaultId: firstVaultId, amount: firstAmount },
        { vaultId: nextVaultId, amount: nextAmount },
      ];
    } else if (vaultId.trim()) {
      vaultSplits = [{ vaultId: vaultId.trim(), amount: netTotal }];
    }

    onSubmit({
      id: run.id,
      transactionDate,
      vaultSplits,
    });
  };

  return (
    <Modal
      open={!!run}
      onClose={onClose}
      title={t('payrollPayConfirmTitle')}
      size="md"
      footer={(
        <DialogActions
          size="md"
          actions={[
            {
              key: 'cancel',
              label: t('cancel'),
              role: 'cancel',
              disabled: isPending,
              onClick: onClose,
            },
            {
              key: 'confirm-pay',
              label: t('payrollPayConfirm'),
              role: 'save',
              loading: isPending,
              onClick: handleConfirm,
            },
          ]}
        />
      )}
    >
      <div className="flex flex-col gap-3">
        {run && (
          <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-noorix-border">
            <span className="text-[13px] text-noorix-text">
              <span className="text-noorix-muted">{t('payrollRunNumber')}: </span>
              <span className="font-semibold">{run.runNumber}</span>
              {run.month && (
                <>
                  <span className="text-noorix-muted"> - {t('payrollMonth')}: </span>
                  <span className="font-semibold">{run.month}</span>
                </>
              )}
            </span>
            {run.netTotal != null && (
              <span className="text-[16px] font-extrabold text-noorix-green ltr nx-font-numbers">
                {hrFmt(run.netTotal)}
              </span>
            )}
          </div>
        )}

        <div>
          <label className="mb-1.5 block text-[12px] font-semibold text-noorix-muted" htmlFor="payroll-issue-date">
            {t('transactionDate')}
          </label>
          <DateField
            id="payroll-issue-date"
            value={transactionDate}
            onValueChange={onTransactionDateChange}
          />
        </div>

        <div className="noorix-surface-card p-3 flex flex-col gap-2.5">
          <p className="m-0 text-[11px] font-semibold text-noorix-muted">{t('payrollRunPayVaultSection')}</p>
          <Input
            type="select"
            label={t('payrollPayVaultCol')}
            value={vaultId}
            onChange={(event: React.ChangeEvent<HTMLSelectElement>) => onVaultIdChange(event.target.value)}
          >
            <option value="">{t('payrollPayVaultDefault')}</option>
            {paymentVaults.map((vault) => (
              <option key={vault.id} value={vault.id}>{vaultDisplayName(vault, lang)}</option>
            ))}
          </Input>

          {!secondEnabled ? (
            <Button type="button" size="sm" variant="ghost" className="self-start" onClick={() => onSecondEnabledChange(true)}>
              {t('payrollAddSecondVaultShort')}
            </Button>
          ) : (
            <div className="flex flex-col gap-2">
              <Input
                type="select"
                label={t('secondVaultSelectLabel')}
                value={secondVaultId}
                onChange={(event: React.ChangeEvent<HTMLSelectElement>) => onSecondVaultIdChange(event.target.value)}
              >
                <option value="">-</option>
                {paymentVaults.map((vault) => (
                  <option key={vault.id} value={vault.id} disabled={vault.id === vaultId}>
                    {vaultDisplayName(vault, lang)}
                  </option>
                ))}
              </Input>
              <Input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0.01"
                label={t('payrollSecondVaultAmountShort')}
                value={secondAmount}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) => onSecondAmountChange(event.target.value)}
              />
              <div className="flex items-center justify-between gap-2 flex-wrap">
                {secondAmount && vaultId && (
                  <span className="text-[11px] text-noorix-muted">{t('payrollPayVaultSplitHint')}</span>
                )}
                <Button type="button" size="sm" variant="ghost" onClick={resetSecondVault}>
                  {t('payrollRemoveVaultSplit')}
                </Button>
              </div>
            </div>
          )}
        </div>

        {vaultError && (
          <p className="m-0 text-[12px] font-semibold text-noorix-red">{vaultError}</p>
        )}
        <p className="m-0 text-[12px] text-noorix-muted leading-relaxed">{t('payrollPayDateHelp')}</p>
      </div>
    </Modal>
  );
}
