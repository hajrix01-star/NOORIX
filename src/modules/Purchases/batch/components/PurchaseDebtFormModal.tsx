import React, { useEffect, useState } from 'react';
import { Checkbox, DateField, DialogActions, Input, Modal, SearchableOptionsPicker } from '../../../../ui';
import { getSaudiToday } from '../../../../utils/saudiDate';
import type { PurchaseDebtRecord } from '../../../../services/api';
import type { PurchaseBatchSupplier } from '../purchaseBatchTypes';

export type PurchaseDebtFormValue = {
  supplierId: string;
  supplierInvoiceNumber: string;
  invoiceDate: string;
  totalAmount: number;
  isTaxable: boolean;
  notes?: string;
};

type Props = {
  open: boolean;
  lang: string;
  suppliers: PurchaseBatchSupplier[];
  editing: PurchaseDebtRecord | null;
  saving: boolean;
  onClose: () => void;
  onSave: (value: PurchaseDebtFormValue) => void;
};

const emptyForm = () => ({
  supplierId: '', supplierInvoiceNumber: '', invoiceDate: getSaudiToday(),
  totalAmount: '', isTaxable: true, notes: '',
});

export default function PurchaseDebtFormModal({ open, lang, suppliers, editing, saving, onClose, onSave }: Props) {
  const ar = lang !== 'en';
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    setForm(editing ? {
      supplierId: editing.supplierId,
      supplierInvoiceNumber: editing.supplierInvoiceNumber,
      invoiceDate: String(editing.invoiceDate).slice(0, 10),
      totalAmount: String(editing.totalAmount),
      isTaxable: editing.isTaxable,
      notes: editing.notes || '',
    } : emptyForm());
  }, [editing, open]);

  const submit = () => {
    const amount = Number(form.totalAmount);
    if (!form.supplierId || !form.supplierInvoiceNumber.trim() || !form.invoiceDate || !Number.isFinite(amount) || amount <= 0) {
      setError(ar ? 'أكمل المورد ورقم الفاتورة والتاريخ والمبلغ بشكل صحيح.' : 'Complete supplier, invoice number, date, and amount.');
      return;
    }
    onSave({
      supplierId: form.supplierId,
      supplierInvoiceNumber: form.supplierInvoiceNumber.trim(),
      invoiceDate: form.invoiceDate,
      totalAmount: amount,
      isTaxable: form.isTaxable,
      notes: form.notes.trim() || undefined,
    });
  };

  return (
    <Modal
      open={open}
      onClose={saving ? undefined : onClose}
      title={editing ? (ar ? 'تعديل مديونية سابقة' : 'Edit previous debt') : (ar ? 'تسجيل مديونية سابقة' : 'Register previous debt')}
      size="md"
      footer={(
        <DialogActions actions={[
          { key: 'cancel', label: ar ? 'إلغاء' : 'Cancel', role: 'cancel', onClick: onClose, disabled: saving },
          { key: 'save', label: ar ? 'حفظ السجل' : 'Save record', role: 'save', onClick: submit, loading: saving, disabled: saving },
        ]} />
      )}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SearchableOptionsPicker
          mode="single"
          label={ar ? 'المورد' : 'Supplier'}
          value={form.supplierId}
          onChange={(value) => setForm((old) => ({ ...old, supplierId: value }))}
          options={suppliers.map((supplier) => ({
            value: supplier.id,
            label: ar ? (supplier.nameAr || supplier.nameEn || '') : (supplier.nameEn || supplier.nameAr || ''),
          }))}
          allowEmpty
          emptyValue=""
          emptyLabel={ar ? 'اختر المورد' : 'Select supplier'}
          className="sm:col-span-2"
        />
        <Input
          label={ar ? 'رقم فاتورة المورد' : 'Supplier invoice number'}
          required
          value={form.supplierInvoiceNumber}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => setForm((old) => ({ ...old, supplierInvoiceNumber: event.target.value }))}
        />
        <DateField
          label={ar ? 'تاريخ الفاتورة الأصلي' : 'Original invoice date'}
          required
          max={getSaudiToday()}
          value={form.invoiceDate}
          lang={ar ? 'ar' : 'en'}
          onValueChange={(value) => setForm((old) => ({ ...old, invoiceDate: value }))}
        />
        <Input
          type="number"
          label={ar ? 'إجمالي الفاتورة' : 'Invoice total'}
          required
          min="0.01"
          max="10000000"
          step="0.01"
          suffix={ar ? 'ر.س' : 'SR'}
          value={form.totalAmount}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => setForm((old) => ({ ...old, totalAmount: event.target.value }))}
        />
        <div className="flex items-end pb-2">
          <Checkbox
            checked={form.isTaxable}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => setForm((old) => ({ ...old, isTaxable: event.target.checked }))}
            label={ar ? 'فاتورة خاضعة للضريبة' : 'Taxable invoice'}
          />
        </div>
        <Input
          label={ar ? 'ملاحظات' : 'Notes'}
          multiline
          rows={3}
          value={form.notes}
          onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => setForm((old) => ({ ...old, notes: event.target.value }))}
          containerClassName="sm:col-span-2"
        />
      </div>
      <p className="mt-4 rounded-lg bg-noorix-bg-muted p-3 text-[12px] text-noorix-muted">
        {ar
          ? 'هذا السجل للتوثيق فقط، ولن يؤثر على الخزنة أو التقارير أو الأرباح والخسائر حتى ترحيله من الإدخال الجماعي.'
          : 'This is a documentation-only record. It affects no vault or financial report until promoted through batch entry.'}
      </p>
      {error ? <p className="mt-3 text-[12px] font-semibold text-noorix-red">{error}</p> : null}
    </Modal>
  );
}
