import React from 'react';
import { Checkbox, DialogActions, Input } from '../../../ui';
import { SupplierSelect } from '../../../components/common/SupplierSelect';
import { vaultDisplayName } from '../../../utils/vaultDisplay';
import { fmt } from '../../../utils/format';
import { employeeDisplayName } from '../../../utils/employeeDisplayName';
import {
  HR_SERVICE_CATEGORIES,
  HR_SERVICE_CATEGORY_LABEL_KEYS,
} from '../constants/employeeHrServiceCategories';
import { HrServiceFormFields } from './HrServiceFormFields';
import type { ResidencyRecord, VaultOption } from './ResidencyFormModalTypes';
import type { HrEmployee } from '../../../types/api';
import type { SupplierRecord } from '../../Suppliers/supplierTypes';

type Translate = (key: string) => string;
type ResidencyInputChange = React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>;

const STATUS_OPTIONS = [
  { value: 'active', labelKey: 'statusActive' },
  { value: 'expired', labelKey: 'statusExpired' },
  { value: 'renewed', labelKey: 'statusRenewed' },
];

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
            <option value="">- {t('selectVault')} -</option>
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

type ResidencyServiceFormBodyProps = {
  t: Translate;
  lang: string;
  isEdit: boolean;
  lockEmployee: boolean;
  activeEmployees: HrEmployee[];
  selectedEmployee?: HrEmployee;
  serviceCategory: string;
  employeeId: string;
  companySponsorName: string;
  iqamaNumber: string;
  referenceLabel: string;
  visaDurationMonths: string;
  issueDate: string;
  expiryDate: string;
  transactionDate: string;
  showIqama: boolean;
  supplierId: string;
  suppliers: SupplierRecord[];
  requiresServiceSupplier: boolean;
  createInvoiceForService: boolean;
  invoiceAmount: string;
  vaultId: string;
  vaults: VaultOption[];
  status: string;
  residency?: ResidencyRecord | null;
  notes: string;
  onServiceCategoryChange: (category: string) => void;
  onEmployeeChange: (employeeId: string) => void;
  onIqamaNumberChange: (value: string) => void;
  onReferenceLabelChange: (value: string) => void;
  onVisaDurationMonthsChange: (value: string) => void;
  onIssueDateChange: (value: string) => void;
  onExpiryDateChange: (value: string) => void;
  onTransactionDateChange: (value: string) => void;
  onSupplierChange: (value: string) => void;
  onCreateInvoiceChange: (checked: boolean) => void;
  onInvoiceAmountChange: (value: string) => void;
  onVaultChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onNotesChange: (value: string) => void;
};

export function ResidencyServiceFormBody({
  t,
  lang,
  isEdit,
  lockEmployee,
  activeEmployees,
  selectedEmployee,
  serviceCategory,
  employeeId,
  companySponsorName,
  iqamaNumber,
  referenceLabel,
  visaDurationMonths,
  issueDate,
  expiryDate,
  transactionDate,
  showIqama,
  supplierId,
  suppliers,
  requiresServiceSupplier,
  createInvoiceForService,
  invoiceAmount,
  vaultId,
  vaults,
  status,
  residency,
  notes,
  onServiceCategoryChange,
  onEmployeeChange,
  onIqamaNumberChange,
  onReferenceLabelChange,
  onVisaDurationMonthsChange,
  onIssueDateChange,
  onExpiryDateChange,
  onTransactionDateChange,
  onSupplierChange,
  onCreateInvoiceChange,
  onInvoiceAmountChange,
  onVaultChange,
  onStatusChange,
  onNotesChange,
}: ResidencyServiceFormBodyProps) {
  return (
    <>
      <Input
        type="select"
        label={t('hrServiceCategory')}
        value={serviceCategory}
        onChange={(event: ResidencyInputChange) => onServiceCategoryChange(event.target.value)}
        disabled={isEdit}
      >
        {HR_SERVICE_CATEGORIES.map((cat) => (
          <option key={cat} value={cat}>{t(HR_SERVICE_CATEGORY_LABEL_KEYS[cat])}</option>
        ))}
      </Input>

      <Input
        type="select"
        label={t('selectEmployee')}
        value={employeeId}
        onChange={(event: ResidencyInputChange) => onEmployeeChange(event.target.value)}
        required
        disabled={isEdit || lockEmployee}
      >
        <option value="">-</option>
        {activeEmployees.map((emp) => (
          <option key={emp.id} value={emp.id}>{employeeDisplayName(emp, lang)}</option>
        ))}
      </Input>
      {lockEmployee && selectedEmployee && (
        <p className="text-[12px] text-noorix-muted -mt-2 mb-2">
          {employeeDisplayName(selectedEmployee, lang)}
        </p>
      )}

      <HrServiceFormFields
        t={t}
        lang={lang}
        serviceCategory={serviceCategory}
        companySponsorName={companySponsorName}
        iqamaNumber={iqamaNumber}
        setIqamaNumber={onIqamaNumberChange}
        referenceLabel={referenceLabel}
        setReferenceLabel={onReferenceLabelChange}
        visaDurationMonths={visaDurationMonths}
        setVisaDurationMonths={onVisaDurationMonthsChange}
        issueDate={issueDate}
        setIssueDate={onIssueDateChange}
        expiryDate={expiryDate}
        setExpiryDate={onExpiryDateChange}
        transactionDate={transactionDate}
        setTransactionDate={onTransactionDateChange}
        showIqama={showIqama}
      />

      <div>
        <label className="block text-[12px] font-semibold mb-1" htmlFor="hr-service-supplier">
          {t('hrServiceEntitySupplier')}{requiresServiceSupplier ? ' *' : ''}
        </label>
        <SupplierSelect
          id="hr-service-supplier"
          suppliers={suppliers}
          value={supplierId}
          onChange={onSupplierChange}
          placeholder={t('selectSupplierPlaceholder')}
        />
      </div>

      {!isEdit && (
        <ResidencyInvoiceCreationFields
          t={t}
          lang={lang}
          createInvoiceForService={createInvoiceForService}
          invoiceAmount={invoiceAmount}
          vaultId={vaultId}
          vaults={vaults}
          onCreateInvoiceChange={onCreateInvoiceChange}
          onInvoiceAmountChange={onInvoiceAmountChange}
          onVaultChange={onVaultChange}
        />
      )}

      {isEdit && (
        <Input
          type="select"
          label={t('status')}
          value={status}
          onChange={(event: ResidencyInputChange) => onStatusChange(event.target.value)}
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{t(option.labelKey)}</option>
          ))}
        </Input>
      )}

      <ResidencyInvoiceSummary
        t={t}
        invoiceNumber={residency?.invoice?.invoiceNumber}
        amount={residency?.residencyInvoiceAmount}
      />

      <Input
        label={t('notes')}
        value={notes}
        onChange={(event: ResidencyInputChange) => onNotesChange(event.target.value)}
        placeholder={t('notes')}
      />
    </>
  );
}
