import React from 'react';
import { Input, SearchableOptionsPicker } from '../../../ui';
import type { SearchableOption } from '../../../ui/filters/SearchableOptionsPicker';
import { useTranslation } from '../../../i18n/useTranslation';
import type { ExpenseBatchRowValidation } from '../expenseModels';

type CommonValidatedFieldProps = {
  validation: ExpenseBatchRowValidation;
  rowIndex: number;
};

type ExpenseBatchLinePickerFieldProps = CommonValidatedFieldProps & {
  value: string;
  options: SearchableOption[];
  onChange: (value: string) => void;
  label?: React.ReactNode;
};

export function ExpenseBatchLinePickerField({
  value,
  options,
  onChange,
  label,
  validation,
  rowIndex,
}: ExpenseBatchLinePickerFieldProps) {
  const { t } = useTranslation();
  return (
    <SearchableOptionsPicker
      label={label}
      size="sm"
      allowEmpty
      emptyValue=""
      emptyLabel={t('select')}
      value={value}
      onChange={onChange}
      options={options}
      aria-label={`${t('expenseLineNameCol')} - ${rowIndex}`}
      invalid={!!validation.expenseLineError}
    />
  );
}

type ExpenseBatchSupplierInvoiceFieldProps = CommonValidatedFieldProps & {
  value: string;
  onChange: React.ChangeEventHandler<HTMLInputElement>;
  label?: React.ReactNode;
};

export function ExpenseBatchSupplierInvoiceField({
  value,
  onChange,
  label,
  validation,
  rowIndex,
}: ExpenseBatchSupplierInvoiceFieldProps) {
  const { t } = useTranslation();
  return (
    <Input
      label={label}
      type="text"
      size="sm"
      required={validation.supplierInvoiceNumberRequired}
      value={value}
      onChange={onChange}
      placeholder={validation.supplierInvoiceNumberRequired ? t('expenseBatchRequiredShort') : t('optional')}
      aria-invalid={validation.supplierInvoiceNumberError ? true : undefined}
      aria-label={`${t('supplierInvoiceNumber')} - ${rowIndex}`}
    />
  );
}

type ExpenseBatchAmountFieldProps = CommonValidatedFieldProps & {
  value: string;
  onChange: React.ChangeEventHandler<HTMLInputElement>;
  label?: React.ReactNode;
};

export function ExpenseBatchAmountField({
  value,
  onChange,
  label,
  validation,
  rowIndex,
}: ExpenseBatchAmountFieldProps) {
  const { t } = useTranslation();
  return (
    <Input
      label={label}
      type="number"
      step="0.01"
      min="0"
      value={value}
      onChange={onChange}
      placeholder="0.00"
      aria-invalid={validation.amountError ? true : undefined}
      aria-label={`${t('total')} - ${rowIndex}`}
    />
  );
}
