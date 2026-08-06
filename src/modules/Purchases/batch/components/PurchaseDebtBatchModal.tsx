import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Button,
  Checkbox,
  DateField,
  DialogActions,
  Input,
  Modal,
  SearchableOptionsPicker,
  SmartTable,
  cn,
  type SmartTableColumn,
} from '../../../../ui';
import { useApiMutation } from '../../../../hooks/useApiMutation';
import { createPurchaseDebtsBatch } from '../../../../services/api';
import { purchaseKeys } from '../../../../services/queryKeys';
import { getSaudiToday } from '../../../../utils/saudiDate';
import type { PurchaseBatchSupplier } from '../purchaseBatchTypes';
import {
  buildPurchaseDebtBatchRows,
  createPurchaseDebtBatchRow,
  validatePurchaseDebtBatchRows,
  type PurchaseDebtBatchRow,
  type PurchaseDebtBatchRowErrors,
} from '../purchaseDebtBatchModels';

type Props = {
  open: boolean;
  lang: string;
  suppliers: PurchaseBatchSupplier[];
  onClose: () => void;
  onSaved: () => void;
};

type ViewRow = PurchaseDebtBatchRow & { index: number };

export default function PurchaseDebtBatchModal({ open, lang, suppliers, onClose, onSaved }: Props) {
  const ar = lang !== 'en';
  const today = getSaudiToday();
  const queryClient = useQueryClient();
  const seedRef = useRef(4);
  const [rows, setRows] = useState<PurchaseDebtBatchRow[]>(() => buildPurchaseDebtBatchRows(3, today));
  const [errorsByKey, setErrorsByKey] = useState<Map<string, PurchaseDebtBatchRowErrors>>(new Map());
  const [validationNote, setValidationNote] = useState('');

  const messages = useMemo(() => ({
    supplier: ar ? 'اختر المورد' : 'Select supplier',
    invoice: ar ? 'أدخل رقم فاتورة صحيحًا' : 'Enter a valid invoice number',
    date: ar ? 'حدد التاريخ' : 'Select a date',
    futureDate: ar ? 'التاريخ لا يكون مستقبليًا' : 'Date cannot be in the future',
    amount: ar ? 'أدخل مبلغًا صحيحًا' : 'Enter a valid amount',
    duplicate: ar ? 'فاتورة مكررة داخل الدفعة' : 'Duplicate invoice in this batch',
  }), [ar]);

  useEffect(() => {
    if (!open) return;
    setRows(buildPurchaseDebtBatchRows(3, today, seedRef.current));
    seedRef.current += 3;
    setErrorsByKey(new Map());
    setValidationNote('');
  }, [open, today]);

  const supplierOptions = useMemo(() => suppliers.map((supplier) => ({
    value: supplier.id,
    label: ar ? (supplier.nameAr || supplier.nameEn || '') : (supplier.nameEn || supplier.nameAr || ''),
  })), [ar, suppliers]);

  const viewRows = useMemo<ViewRow[]>(() => rows.map((row, index) => ({ ...row, index: index + 1 })), [rows]);
  const enteredRows = rows.filter((row) => row.supplierId.trim() || row.supplierInvoiceNumber.trim() || row.totalAmount.trim() || row.notes.trim());
  const draftTotal = enteredRows.reduce((sum, row) => {
    const amount = Number(row.totalAmount);
    return sum + (Number.isFinite(amount) && amount > 0 ? amount : 0);
  }, 0);

  const updateRow = (key: string, updates: Partial<PurchaseDebtBatchRow>) => {
    setRows((current) => current.map((row) => row.key === key ? { ...row, ...updates } : row));
    setErrorsByKey((current) => {
      if (!current.has(key)) return current;
      const next = new Map(current);
      next.delete(key);
      return next;
    });
    setValidationNote('');
  };

  const addRow = () => {
    setRows((current) => [...current, createPurchaseDebtBatchRow(seedRef.current, today)]);
    seedRef.current += 1;
  };

  const removeRow = (key: string) => {
    setRows((current) => current.length <= 1
      ? [createPurchaseDebtBatchRow(seedRef.current++, today)]
      : current.filter((row) => row.key !== key));
    setErrorsByKey((current) => {
      const next = new Map(current);
      next.delete(key);
      return next;
    });
  };

  const saveMutation = useApiMutation({
    mutationFn: (items: Parameters<typeof createPurchaseDebtsBatch>[0]) => createPurchaseDebtsBatch(items),
    successToast: ar ? 'تم حفظ المديونيات دفعة واحدة.' : 'Debt records saved as one batch.',
    errorToast: (error) => error.message,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: purchaseKeys.debtsRoot() });
      onSaved();
      onClose();
    },
  });

  const submit = () => {
    const validation = validatePurchaseDebtBatchRows(rows, today, messages);
    setErrorsByKey(validation.errorsByKey);
    if (validation.enteredCount === 0) {
      setValidationNote(ar ? 'أدخل فاتورة واحدة على الأقل.' : 'Enter at least one invoice.');
      return;
    }
    if (validation.errorsByKey.size > 0) {
      setValidationNote(ar ? 'راجع الصفوف المعلّمة ثم احفظ الدفعة.' : 'Review the marked rows, then save the batch.');
      return;
    }
    setValidationNote('');
    saveMutation.mutate(validation.items);
  };

  const rowNumber = (row: ViewRow) => (
    <span className={cn(
      'inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-[11px] font-bold',
      errorsByKey.has(row.key) ? 'bg-red-50 text-noorix-red' : 'bg-noorix-bg-muted text-noorix-muted',
    )}>{row.index}</span>
  );

  const columns: SmartTableColumn<ViewRow>[] = [
    { key: 'index', size: 'count', label: '#', shrink: true, render: (_value, row) => rowNumber(row) },
    {
      key: 'supplierId', size: 'supplier', label: ar ? 'المورد' : 'Supplier',
      render: (_value, row) => (
        <SearchableOptionsPicker
          mode="single" size="sm" value={row.supplierId}
          onChange={(value) => updateRow(row.key, { supplierId: value })}
          options={supplierOptions} allowEmpty emptyValue="" emptyLabel={ar ? 'اختر المورد' : 'Select supplier'}
          invalid={!!errorsByKey.get(row.key)?.supplierId}
        />
      ),
    },
    {
      key: 'supplierInvoiceNumber', size: 'document', label: ar ? 'رقم الفاتورة' : 'Invoice no.',
      render: (_value, row) => (
        <Input size="sm" maxLength={120} value={row.supplierInvoiceNumber}
          className={cn((errorsByKey.get(row.key)?.supplierInvoiceNumber || errorsByKey.get(row.key)?.duplicate) && 'border-noorix-red')}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => updateRow(row.key, { supplierInvoiceNumber: event.target.value })}
          placeholder={ar ? 'رقم فاتورة المورد' : 'Supplier invoice no.'} />
      ),
    },
    {
      key: 'invoiceDate', size: 'date', label: ar ? 'تاريخ الفاتورة' : 'Invoice date',
      render: (_value, row) => (
        <DateField size="sm" lang={ar ? 'ar' : 'en'} max={today} value={row.invoiceDate}
          className={cn(errorsByKey.get(row.key)?.invoiceDate && 'border-noorix-red')}
          onValueChange={(value) => updateRow(row.key, { invoiceDate: value })} />
      ),
    },
    {
      key: 'totalAmount', size: 'money-md', label: ar ? 'الإجمالي' : 'Total', numeric: true,
      render: (_value, row) => (
        <Input size="sm" type="number" min="0.01" max="10000000" step="0.01" suffix={ar ? 'ر.س' : 'SR'}
          value={row.totalAmount} className={cn(errorsByKey.get(row.key)?.totalAmount && 'border-noorix-red')}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => updateRow(row.key, { totalAmount: event.target.value })} />
      ),
    },
    {
      key: 'isTaxable', size: 'tax', label: 'VAT', align: 'center',
      render: (_value, row) => (
        <Checkbox checked={row.isTaxable}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => updateRow(row.key, { isTaxable: event.target.checked })}
          aria-label={`${ar ? 'خاضعة للضريبة' : 'Taxable'} ${row.index}`} />
      ),
    },
    {
      key: 'notes', size: 'name', label: ar ? 'ملاحظات' : 'Notes',
      render: (_value, row) => (
        <Input size="sm" maxLength={2000} value={row.notes}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => updateRow(row.key, { notes: event.target.value })}
          placeholder={ar ? 'اختياري' : 'Optional'} />
      ),
    },
    {
      key: 'actions', kind: 'actions', label: '', align: 'center',
      render: (_value, row) => <Button variant="danger" size="sm" onClick={() => removeRow(row.key)}>{ar ? 'حذف' : 'Delete'}</Button>,
    },
  ];

  const renderMobileCard = (row: ViewRow) => {
    const errors = errorsByKey.get(row.key);
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          {rowNumber(row)}
          <Button variant="danger" size="sm" onClick={() => removeRow(row.key)}>{ar ? 'حذف' : 'Delete'}</Button>
        </div>
        <SearchableOptionsPicker
          mode="single" label={ar ? 'المورد' : 'Supplier'} value={row.supplierId}
          onChange={(value) => updateRow(row.key, { supplierId: value })}
          options={supplierOptions} allowEmpty emptyValue="" emptyLabel={ar ? 'اختر المورد' : 'Select supplier'}
          invalid={!!errors?.supplierId}
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input label={ar ? 'رقم الفاتورة' : 'Invoice no.'} value={row.supplierInvoiceNumber}
            error={errors?.supplierInvoiceNumber || errors?.duplicate}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => updateRow(row.key, { supplierInvoiceNumber: event.target.value })} />
          <DateField label={ar ? 'تاريخ الفاتورة' : 'Invoice date'} lang={ar ? 'ar' : 'en'} max={today} value={row.invoiceDate}
            error={errors?.invoiceDate} onValueChange={(value) => updateRow(row.key, { invoiceDate: value })} />
          <Input label={ar ? 'الإجمالي' : 'Total'} type="number" min="0.01" max="10000000" step="0.01"
            suffix={ar ? 'ر.س' : 'SR'} value={row.totalAmount} error={errors?.totalAmount}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => updateRow(row.key, { totalAmount: event.target.value })} />
          <div className="flex items-end pb-2">
            <Checkbox checked={row.isTaxable} label={ar ? 'خاضعة للضريبة' : 'Taxable'}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) => updateRow(row.key, { isTaxable: event.target.checked })} />
          </div>
        </div>
        <Input label={ar ? 'ملاحظات' : 'Notes'} value={row.notes} placeholder={ar ? 'اختياري' : 'Optional'}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => updateRow(row.key, { notes: event.target.value })} />
      </div>
    );
  };

  return (
    <Modal
      open={open}
      onClose={saveMutation.isPending ? undefined : onClose}
      title={ar ? 'إدخال جماعي للمديونيات السابقة' : 'Batch entry for previous debts'}
      size="full"
      footer={<DialogActions actions={[
        { key: 'cancel', label: ar ? 'إلغاء' : 'Cancel', role: 'cancel', onClick: onClose, disabled: saveMutation.isPending },
        { key: 'save', label: ar ? `حفظ الدفعة (${enteredRows.length})` : `Save batch (${enteredRows.length})`, role: 'save', onClick: submit, loading: saveMutation.isPending, disabled: saveMutation.isPending },
      ]} />}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[12px] text-noorix-muted">
          {ar ? 'أدخل الفواتير القديمة هنا؛ تبقى توثيقية ولا تؤثر ماليًا حتى ترحيلها.' : 'Enter old invoices here; they remain non-financial until promoted.'}
        </p>
        <Button size="sm" disabled={rows.length >= 100} onClick={addRow}>+ {ar ? 'إضافة صف' : 'Add row'}</Button>
      </div>

      <SmartTable
        compact innerPadding={8} columns={columns} data={viewRows}
        keyExtractor={(row) => row.key} showSearchInHeader={false}
        title={ar ? 'فواتير المديونية' : 'Debt invoices'}
        badge={<span className="nx-pill nx-pill--blue nx-pill--sm">{rows.length}</span>}
        tableId="purchase-debt-batch" tableLayout="fixed" tableMinWidth={1040}
        stickyActionColumn={false} renderMobileCard={renderMobileCard} stripeMobileCards
      />

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-noorix-border bg-noorix-bg-muted px-4 py-3">
          <div className="text-[11px] text-noorix-muted">{ar ? 'الفواتير المدخلة' : 'Entered invoices'}</div>
          <div className="mt-1 text-[18px] font-bold text-noorix-text">{enteredRows.length}</div>
        </div>
        <div className="rounded-xl border border-noorix-border bg-noorix-bg-muted px-4 py-3">
          <div className="text-[11px] text-noorix-muted">{ar ? 'إجمالي الدفعة' : 'Batch total'}</div>
          <div className="mt-1 text-[18px] font-bold text-noorix-green">
            {draftTotal.toLocaleString(ar ? 'ar-SA' : 'en-SA', { maximumFractionDigits: 2 })} {ar ? 'ر.س' : 'SR'}
          </div>
        </div>
      </div>
      {validationNote ? (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] font-semibold text-amber-800">{validationNote}</p>
      ) : null}
    </Modal>
  );
}
