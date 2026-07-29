import React from 'react';
import { Checkbox, DialogActions, Input } from '../../../ui';
import { vaultDisplayName } from '../../../utils/vaultDisplay';
import { fmt } from '../../../utils/format';
import type { ResidencyRecord, VaultOption } from './ResidencyFormModal';

type Translate = (key: string) => string;
type ResidencyInputChange = React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>;

type ResidencyFormActionsProps = {
  t: Translate;
  formId: string;
  isEdit: boolean;
  submitting: boolean;
  residency?: ResidencyRecord | null;
  onClose?: () => void;
  onDelete?: (residency: ResidencyRecord) => void;
  onIssueInvoice?: (residency: ResidencyRecord) => void;
};

export function ResidencyFormActions({
  t,
  formId,
  isEdit,
  submitting,
  residency,
  onClose,
  onDelete,
  onIssueInvoice,
}: ResidencyFormActionsProps) {
  return (
    <DialogActions
      actions={[
        { key: 'cancel', label: t('cancel'), role: 'cancel', onClick: onClose },
        {
          key: 'delete',
          label: t('delete'),
          role: 'delete',
          hidden: !isEdit || !onDelete,
          className: 'me-auto',
          onClick: () => {
            if (residency) onDelete?.(residency);
          },
        },
        {
          key: 'issue-invoice',
          label: t('hrServiceIssueInvoice'),
          role: 'success',
          hidden: !isEdit || !onIssueInvoice || !!residency?.invoiceId,
          onClick: () => {
            if (residency) onIssueInvoice?.(residency);
          },
        },
        {
          key: 'save',
          label: submitting ? t('saving') : (isEdit ? t('save') : t('add')),
          role: 'save',
          type: 'submit',
          form: formId,
          disabled: submitting,
        },
      ]}
    />
  );
}

type ResidencyInvoiceCreationFieldsProps = {
  t: Translate;
  lang: string;
  createInvoiceForService: boolean;
  invoiceAmount: string;
  vaultId: string;
  vaults: VaultOption[];
  onCreateInvoiceChange: (checked: boolean) => void;
  onInvoiceAmountChange: (value: string) => void;
  onVaultChange: (value: string) => void;
};

export function ResidencyInvoiceCreationFields({
  t,
  lang,
  createInvoiceForService,
  invoiceAmount,
  vaultId,
  vaults,
  onCreateInvoiceChange,
  onInvoiceAmountChange,
  onVaultChange,
}: ResidencyInvoiceCreationFieldsProps) {
  return (
    <>
      <Checkbox
        checked={createInvoiceForService}
        onChange={(event: React.ChangeEvent<HTMLInputElement>) => onCreateInvoiceChange(event.target.checked)}
        label={t('hrServiceIssueInvoice')}
        containerClassName="mb-3 text-[13px] mt-2"
      />
      {createInvoiceForService && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <Input
            type="number"
            step="0.01"
            min="0"
            label={t('advanceAmount')}
            value={invoiceAmount}
            onChange={(event: ResidencyInputChange) => onInvoiceAmountChange(event.target.value)}
          />
          <Input
            type="select"
            label={t('selectVault')}
            value={vaultId}
            onChange={(event: ResidencyInputChange) => onVaultChange(event.target.value)}
            required
          >
            <option value="">— {t('selectVault')} —</option>
            {vaults.map((vault) => (
              <option key={vault.id || ''} value={vault.id || ''}>
                {vaultDisplayName(vault, lang)}
              </option>
            ))}
          </Input>
        </div>
      )}
    </>
  );
}

type ResidencyInvoiceSummaryProps = {
  t: Translate;
  invoiceNumber?: string | number | null;
  amount?: number | string | null;
};

export function ResidencyInvoiceSummary({ t, invoiceNumber, amount }: ResidencyInvoiceSummaryProps) {
  if (!invoiceNumber) return null;

  return (
    <div className="mb-3 rounded-lg border border-noorix-border bg-noorix-bg-muted px-3 py-2 text-[13px]">
      <span className="text-noorix-muted">{t('invoiceNumber')}: </span>
      <span className="font-semibold ltr text-noorix-blue">{invoiceNumber}</span>
      {amount != null && (
        <span className="ms-2 text-noorix-muted ltr">
          ({fmt(Number(amount))} <span className="nx-sar">SR</span>)
        </span>
      )}
    </div>
  );
}
