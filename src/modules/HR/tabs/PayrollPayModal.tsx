import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { VaultRecord } from '../../../types/api';
import { Button, DateField, DialogActions, Input, Modal } from '../../../ui';
import { vaultDisplayName } from '../../../utils/vaultDisplay';
import { hrFmt } from '../utils/hrFmt';
import type { PayrollIssuePaymentMutation, PayrollPayModalRun } from './payrollTabModel';
import {
  payrollMoneyInputFromMinor,
  payrollMoneyToMinor,
  summarizePayrollVaultAllocations,
  validatePayrollVaultAllocations,
  type PayrollVaultAllocationRow,
} from './payrollVaultAllocation';

type Translate = (key: string) => string;

type PayrollPayModalProps = {
  run: PayrollPayModalRun | null;
  transactionDate: string;
  paymentVaults: VaultRecord[];
  lang: string;
  isPending: boolean;
  t: Translate;
  onTransactionDateChange: (value: string) => void;
  onClose: () => void;
  onSubmit: (payload: PayrollIssuePaymentMutation) => void;
};

function createAllocationRow(id: string, amount: string): PayrollVaultAllocationRow {
  return { id, vaultId: '', amount };
}

export function PayrollPayModal({
  run,
  transactionDate,
  paymentVaults,
  lang,
  isPending,
  t,
  onTransactionDateChange,
  onClose,
  onSubmit,
}: PayrollPayModalProps) {
  const nextRowId = useRef(1);
  const [rows, setRows] = useState<PayrollVaultAllocationRow[]>([]);
  const [vaultError, setVaultError] = useState('');

  useEffect(() => {
    if (!run) {
      setRows([]);
      setVaultError('');
      return;
    }

    nextRowId.current = 1;
    setRows([createAllocationRow('payroll-vault-0', payrollMoneyInputFromMinor(payrollMoneyToMinor(run.netTotal ?? 0)))]);
    setVaultError('');
  }, [run?.id, run?.netTotal]);

  const netTotal = run?.netTotal ?? 0;
  const summary = useMemo(
    () => summarizePayrollVaultAllocations(netTotal, rows),
    [netTotal, rows],
  );
  const validation = useMemo(
    () => validatePayrollVaultAllocations(netTotal, rows),
    [netTotal, rows],
  );

  const updateRow = (rowId: string, patch: Partial<PayrollVaultAllocationRow>) => {
    setRows((current) => current.map((row) => (row.id === rowId ? { ...row, ...patch } : row)));
    setVaultError('');
  };

  const addVaultRow = () => {
    const amount = summary.remainingMinor > 0
      ? payrollMoneyInputFromMinor(summary.remainingMinor)
      : '';
    const id = `payroll-vault-${nextRowId.current}`;
    nextRowId.current += 1;
    setRows((current) => [...current, createAllocationRow(id, amount)]);
    setVaultError('');
  };

  const removeVaultRow = (rowId: string) => {
    setRows((current) => current.filter((row) => row.id !== rowId));
    setVaultError('');
  };

  const handleConfirm = () => {
    if (!run || !transactionDate) return;

    if (!validation.valid) {
      if (validation.reason === 'duplicate') {
        setVaultError(t('invoiceVaultsMustDiffer'));
      } else if (validation.reason === 'total-mismatch') {
        setVaultError(t('payrollAllocationTotalMismatch'));
      } else {
        setVaultError(t('payrollSplitVaultsIncomplete'));
      }
      return;
    }

    setVaultError('');
    onSubmit({
      id: run.id,
      transactionDate,
      vaultSplits: validation.vaultSplits,
    });
  };

  const canAddRow = summary.remainingMinor > 0 && rows.length < paymentVaults.length;

  return (
    <Modal
      open={!!run}
      onClose={onClose}
      title={t('payrollPayConfirmTitle')}
      size="lg"
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
              disabled: !validation.valid,
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

        <div className="noorix-surface-card p-3 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <p className="m-0 text-[13px] font-bold text-noorix-text">{t('payrollVaultAllocationTitle')}</p>
              <p className="m-0 mt-0.5 text-[11px] text-noorix-muted">{t('payrollRunPayVaultSection')}</p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="success"
              disabled={!canAddRow}
              onClick={addVaultRow}
            >
              {t('payrollAddVault')}
            </Button>
          </div>

          <div className="overflow-x-auto rounded-lg border border-noorix-border">
            <div className="min-w-[720px]">
              <div className="grid grid-cols-[minmax(190px,1.5fr)_120px_140px_130px_64px] bg-noorix-bg-muted border-b border-noorix-border text-[11px] font-bold text-noorix-text text-center">
                <div className="px-2 py-2">{t('payrollPayVaultCol')}</div>
                <div className="px-2 py-2">{t('payrollVaultCurrentBalance')}</div>
                <div className="px-2 py-2">{t('payrollAllocationAmount')}</div>
                <div className="px-2 py-2">{t('payrollVaultBalanceAfter')}</div>
                <div className="px-2 py-2">{t('actions')}</div>
              </div>

              {rows.map((row, index) => {
                const selectedVault = paymentVaults.find((vault) => vault.id === row.vaultId);
                const hasBalance = selectedVault?.balance != null && Number.isFinite(Number(selectedVault.balance));
                const currentBalance = hasBalance ? Number(selectedVault?.balance) : null;
                const amount = payrollMoneyToMinor(row.amount) / 100;
                const balanceAfter = currentBalance == null ? null : currentBalance - amount;
                const usedByOtherRow = new Set(rows.filter((candidate) => candidate.id !== row.id).map((candidate) => candidate.vaultId));

                return (
                  <div
                    key={row.id}
                    className="grid grid-cols-[minmax(190px,1.5fr)_120px_140px_130px_64px] items-center border-b last:border-b-0 border-noorix-border bg-noorix-surface text-center"
                  >
                    <div className="p-1.5">
                      <Input
                        type="select"
                        size="sm"
                        aria-label={`${t('payrollPayVaultCol')} ${index + 1}`}
                        value={row.vaultId}
                        onChange={(event: React.ChangeEvent<HTMLSelectElement>) => updateRow(row.id, { vaultId: event.target.value })}
                      >
                        <option value="">{t('payrollSelectVault')}</option>
                        {paymentVaults.map((vault) => (
                          <option key={vault.id} value={vault.id} disabled={usedByOtherRow.has(vault.id)}>
                            {vaultDisplayName(vault, lang)}
                          </option>
                        ))}
                      </Input>
                    </div>
                    <div className="px-2 py-2 text-[12px] nx-font-numbers">
                      {currentBalance == null ? '—' : hrFmt(currentBalance)}
                    </div>
                    <div className="p-1.5">
                      <Input
                        type="number"
                        size="sm"
                        inputMode="decimal"
                        step="0.01"
                        min="0.01"
                        aria-label={`${t('payrollAllocationAmount')} ${index + 1}`}
                        value={row.amount}
                        onChange={(event: React.ChangeEvent<HTMLInputElement>) => updateRow(row.id, { amount: event.target.value })}
                      />
                    </div>
                    <div className={`px-2 py-2 text-[12px] font-semibold nx-font-numbers ${balanceAfter != null && balanceAfter < 0 ? 'text-noorix-red' : ''}`}>
                      {balanceAfter == null ? '—' : hrFmt(balanceAfter)}
                    </div>
                    <div className="p-1.5">
                      <Button
                        type="button"
                        size="sm"
                        variant="danger"
                        className="w-8 px-0"
                        disabled={rows.length === 1}
                        aria-label={`${t('delete')} ${index + 1}`}
                        title={t('delete')}
                        onClick={() => removeVaultRow(row.id)}
                      >
                        ×
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-noorix-bg-muted px-3 py-2">
              <span className="block text-[11px] text-noorix-muted">{t('payrollTotal')}</span>
              <strong className="block mt-0.5 text-[14px] nx-font-numbers">{hrFmt(summary.totalMinor / 100)}</strong>
            </div>
            <div className="rounded-lg bg-noorix-bg-muted px-3 py-2">
              <span className="block text-[11px] text-noorix-muted">{t('payrollAllocatedTotal')}</span>
              <strong className="block mt-0.5 text-[14px] nx-font-numbers">{hrFmt(summary.allocatedMinor / 100)}</strong>
            </div>
            <div className={`rounded-lg px-3 py-2 ${summary.remainingMinor === 0 ? 'bg-noorix-green/10 text-noorix-green' : 'bg-noorix-red/10 text-noorix-red'}`}>
              <span className="block text-[11px]">{t('payrollRemainingAmount')}</span>
              <strong className="block mt-0.5 text-[14px] nx-font-numbers">{hrFmt(summary.remainingMinor / 100)}</strong>
            </div>
          </div>
        </div>

        {vaultError && (
          <p className="m-0 text-[12px] font-semibold text-noorix-red">{vaultError}</p>
        )}
        <p className="m-0 text-[12px] text-noorix-muted leading-relaxed">{t('payrollPayDateHelp')}</p>
      </div>
    </Modal>
  );
}
