import React, { useEffect, useState } from 'react';
import { AdaptiveSheet, Button, DateField, DialogActions, Input } from '../../../ui';
import { useCreateShishaPurchasesMutation } from '../../../hooks/useOrders';
import type { CreateShishaPurchaseBatchPayload } from '../../../types/api';
import { getSaudiToday } from '../../../utils/saudiDate';

type PurchaseMaterial = CreateShishaPurchaseBatchPayload['items'][number]['materialType'];
type PurchaseUnit = CreateShishaPurchaseBatchPayload['items'][number]['unit'];

type PurchaseDraftRow = {
  id: string;
  materialType: PurchaseMaterial;
  quantity: string;
  unit: PurchaseUnit;
  costInclVat: string;
};

type Props = {
  open: boolean;
  companyId: string;
  initialized: boolean;
  charcoalPurchasesLinked: boolean;
  onClose: () => void;
};

let rowSequence = 0;

function unitFor(materialType: PurchaseMaterial): PurchaseUnit {
  if (materialType === 'tobacco') return 'kg';
  if (materialType === 'charcoal') return 'pack';
  return 'piece';
}

function newRow(materialType: PurchaseMaterial = 'tobacco'): PurchaseDraftRow {
  return {
    id: `shisha-purchase-row-${++rowSequence}`,
    materialType,
    quantity: '',
    unit: unitFor(materialType),
    costInclVat: '',
  };
}

export function ShishaPurchaseSheet({
  open,
  companyId,
  initialized,
  charcoalPurchasesLinked,
  onClose,
}: Props) {
  const today = getSaudiToday();
  const [purchaseDate, setPurchaseDate] = useState(today);
  const [rows, setRows] = useState<PurchaseDraftRow[]>(() => [newRow()]);
  const purchase = useCreateShishaPurchasesMutation();

  useEffect(() => {
    if (!open) return;
    setPurchaseDate(today);
    setRows([newRow()]);
  }, [open, today]);

  useEffect(() => {
    if (!charcoalPurchasesLinked) return;
    setRows((current) =>
      current.map((row) =>
        row.materialType === 'charcoal'
          ? { ...row, materialType: 'tobacco', unit: unitFor('tobacco') }
          : row,
      ),
    );
  }, [charcoalPurchasesLinked]);

  const updateRow = (id: string, patch: Partial<PurchaseDraftRow>) => {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  const changeMaterial = (id: string, materialType: PurchaseMaterial) => {
    updateRow(id, { materialType, unit: unitFor(materialType) });
  };

  const removeRow = (id: string) => {
    setRows((current) => (current.length === 1 ? current : current.filter((row) => row.id !== id)));
  };

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!initialized) return;

    const form = Object.fromEntries(new FormData(event.currentTarget)) as Record<string, string>;
    const body: CreateShishaPurchaseBatchPayload = {
      companyId,
      transactionDate: purchaseDate,
      invoiceNumber: form.invoiceNumber || undefined,
      supplierName: form.supplierName || undefined,
      notes: form.notes || undefined,
      items: rows.map((row) => ({
        materialType: row.materialType,
        quantity: row.quantity,
        unit: row.unit,
        costInclVat: row.costInclVat || undefined,
      })),
    };

    purchase.mutate(body, { onSuccess: onClose });
  };

  return (
    <AdaptiveSheet
      open={open}
      onClose={onClose}
      title="تسجيل شراء مواد الشيشة"
      size="lg"
    >
      {!initialized ? (
        <div className="space-y-4">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-[13px] text-amber-800">
            يجب تسجيل مخزون البداية من تبويبة مخزون وتكلفة الشيشة قبل إدخال مشتريات المواد.
          </div>
          <DialogActions actions={[{ key: 'close', label: 'إغلاق', role: 'cancel', onClick: onClose }]} />
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <DateField label="تاريخ الشراء" value={purchaseDate} onValueChange={setPurchaseDate} max={today} required />
            <Input name="invoiceNumber" label="رقم الفاتورة" />
            <Input name="supplierName" label="المورد" />
          </div>

          {charcoalPurchasesLinked && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-[12px] text-emerald-800">
              مشتريات الفحم مربوطة بصنف الفحم في الطلبات وتضاف تلقائيا للمخزون، لذلك لا تحتاج تسجيلها هنا.
            </div>
          )}

          <div className="space-y-3 rounded-xl border border-noorix-border p-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-[13px] font-bold text-noorix-text">أصناف الفاتورة</div>
                <div className="text-[11px] text-noorix-muted">سجل المعسل والليات، والفحم فقط إذا لم يكن مربوطا بصنف طلبات.</div>
              </div>
              <Button type="button" size="sm" onClick={() => setRows((current) => [...current, newRow()])}>
                إضافة صنف
              </Button>
            </div>

            {rows.map((row, index) => (
              <div
                key={row.id}
                className="grid grid-cols-1 items-end gap-2 rounded-lg bg-noorix-bg-muted p-3 sm:grid-cols-2 lg:grid-cols-[1.1fr_1fr_1fr_1fr_auto]"
              >
                <Input
                  type="select"
                  label={`المادة ${index + 1}`}
                  value={row.materialType}
                  onChange={(event: React.ChangeEvent<HTMLSelectElement>) => changeMaterial(row.id, event.target.value as PurchaseMaterial)}
                  required
                >
                  <option value="tobacco">معسل</option>
                  <option value="hose">ليات</option>
                  {!charcoalPurchasesLinked && <option value="charcoal">فحم</option>}
                </Input>
                <Input
                  type="number"
                  label="الكمية"
                  value={row.quantity}
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) => updateRow(row.id, { quantity: event.target.value })}
                  min="0.001"
                  step={row.materialType === 'charcoal' ? '0.25' : '0.001'}
                  required
                />
                <Input
                  type="select"
                  label="الوحدة"
                  value={row.unit}
                  onChange={(event: React.ChangeEvent<HTMLSelectElement>) => updateRow(row.id, { unit: event.target.value as PurchaseUnit })}
                  required
                >
                  {row.materialType === 'tobacco' && (
                    <>
                      <option value="kg">كيلو</option>
                      <option value="g">جرام</option>
                    </>
                  )}
                  {row.materialType === 'hose' && <option value="piece">حبة</option>}
                  {row.materialType === 'charcoal' && <option value="pack">علبة (64 حبة)</option>}
                </Input>
                <Input
                  type="number"
                  label="التكلفة شاملة VAT"
                  value={row.costInclVat}
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) => updateRow(row.id, { costInclVat: event.target.value })}
                  min="0"
                  step="0.01"
                />
                <Button type="button" size="sm" variant="danger" disabled={rows.length === 1} onClick={() => removeRow(row.id)}>
                  حذف
                </Button>
              </div>
            ))}
          </div>

          <Input name="notes" label="ملاحظات" multiline rows={2} />
          <DialogActions
            actions={[
              { key: 'cancel', label: 'إلغاء', role: 'cancel', onClick: onClose },
              { key: 'save', label: 'تسجيل الشراء', role: 'save', type: 'submit', loading: purchase.isPending },
            ]}
          />
        </form>
      )}
    </AdaptiveSheet>
  );
}
