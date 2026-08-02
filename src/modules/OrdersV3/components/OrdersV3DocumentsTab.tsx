import React, { useMemo, useState } from 'react';
import type { OrdersV3Bootstrap, OrdersV3Document, OrdersV3DocumentPayload } from '../../../types/api';
import { Button, DialogActions, Input, Modal, SimpleTable, type SimpleTableColumn, TransactionDatePicker } from '../../../ui';
import { getSaudiToday } from '../../../utils/saudiDate';
import { OrdersV3Field, OrdersV3Kpi, OrdersV3Panel, OrdersV3QueryState, OrdersV3Select, v3Date, v3Number } from '../OrdersV3Shared';
import { useCreateOrdersV3Document, useOrdersV3Documents, useOrdersV3Summary, useReverseOrdersV3Document } from '../useOrdersV3';

type DraftLine = { key: string; itemId: string; quantity: string; unitId: string; unitPrice: string; priceUnitId: string };

function newLine(): DraftLine {
  return { key: crypto.randomUUID(), itemId: '', quantity: '1', unitId: '', unitPrice: '0', priceUnitId: '' };
}

export function OrdersV3DocumentsTab({
  companyId,
  documentType,
  startDate,
  endDate,
  bootstrap,
  canReport = true,
  canCreate = false,
  canReverse = false,
}: {
  companyId: string;
  documentType: 'purchase' | 'registration';
  startDate: string;
  endDate: string;
  bootstrap?: OrdersV3Bootstrap;
  canReport?: boolean;
  canCreate?: boolean;
  canReverse?: boolean;
}) {
  const documentsQuery = useOrdersV3Documents(companyId, documentType, startDate, endDate);
  const summaryQuery = useOrdersV3Summary(companyId, startDate, endDate, canReport);
  const reverseMutation = useReverseOrdersV3Document(companyId);
  const [createOpen, setCreateOpen] = useState(false);
  const [viewing, setViewing] = useState<OrdersV3Document | null>(null);
  const isPurchase = documentType === 'purchase';
  const documents = documentsQuery.data ?? [];
  const summary = summaryQuery.data;

  const columns = useMemo<SimpleTableColumn<OrdersV3Document>[]>(() => [
    { key: 'documentNumber', label: isPurchase ? 'رقم الطلب' : 'رقم التسجيل', minWidth: 180, render: (value) => <span className="font-bold text-noorix-blue">{String(value)}</span> },
    { key: 'documentDate', label: 'التاريخ', render: (value) => v3Date(String(value)) },
    ...(isPurchase ? [{ key: 'paymentMethod', label: 'طريقة الدفع', render: (value: unknown) => value === 'external' ? 'عهدة' : value === 'transfer' ? 'تحويل' : 'نقد المحل' }] : []),
    { key: 'section', label: 'القسم', render: (_value, row) => row.section?.nameAr || '—' },
    { key: 'location', label: 'الموقع', render: (_value, row) => row.location?.nameAr || '—' },
    { key: 'lines', label: 'الأسطر', numeric: true, render: (_value, row) => row.lines.length },
    { key: 'totalAmount', label: 'الإجمالي', numeric: true, render: (value) => <strong>{v3Number(value)} ر.س</strong> },
    { key: 'status', label: 'الحالة', render: (value) => <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${value === 'posted' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{value === 'posted' ? 'معتمد' : 'معكوس'}</span> },
    { key: 'actions', label: '', render: (_value, row) => canReverse && row.status === 'posted' ? <Button size="sm" variant="ghost" onClick={(event) => { event.stopPropagation(); reverseMutation.mutate({ id: row.id, idempotencyKey: crypto.randomUUID() }); }}>عكس</Button> : null },
  ], [canReverse, isPurchase, reverseMutation]);

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <OrdersV3Kpi label={isPurchase ? 'عدد الطلبات' : 'عدد التسجيلات'} value={isPurchase ? summary?.purchaseCount ?? 0 : summary?.registrationCount ?? 0} />
        <OrdersV3Kpi label="الإجمالي المركزي" value={`${v3Number(isPurchase ? summary?.purchaseTotal : summary?.registrationTotal)} ر.س`} tone="green" />
        <OrdersV3Kpi label={isPurchase ? 'إجمالي العهدة' : 'أسطر التسجيل'} value={isPurchase ? `${v3Number(summary?.externalTotal)} ر.س` : documents.reduce((sum, row) => sum + row.lines.length, 0)} tone="amber" />
        <OrdersV3Kpi label="نسخة النواة" value="V3" />
      </div>
      <OrdersV3Panel
        title={isPurchase ? 'طلبات الشراء — V3' : 'التسجيل الداخلي — V3'}
        action={canCreate ? <Button variant="primary" onClick={() => setCreateOpen(true)}>+ {isPurchase ? 'طلب جديد' : 'تسجيل جديد'}</Button> : undefined}
      >
        <OrdersV3QueryState loading={documentsQuery.isLoading} error={documentsQuery.error as Error | null} />
        {!documentsQuery.isLoading && <SimpleTable columns={columns} data={documents} emptyMessage="لا توجد مستندات في الفترة المحددة" tableMinWidth={980} onRowClick={setViewing} />}
      </OrdersV3Panel>
      {canCreate && <OrdersV3DocumentModal open={createOpen} onClose={() => setCreateOpen(false)} companyId={companyId} documentType={documentType} bootstrap={bootstrap} />}
      <OrdersV3DocumentDetails document={viewing} onClose={() => setViewing(null)} />
    </div>
  );
}

function OrdersV3DocumentModal({ open, onClose, companyId, documentType, bootstrap }: {
  open: boolean; onClose: () => void; companyId: string; documentType: 'purchase' | 'registration'; bootstrap?: OrdersV3Bootstrap;
}) {
  const mutation = useCreateOrdersV3Document(companyId);
  const [date, setDate] = useState(getSaudiToday());
  const [paymentMethod, setPaymentMethod] = useState<'external' | 'internal' | 'transfer'>('internal');
  const [sectionId, setSectionId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [pettyCashAmount, setPettyCashAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([newLine()]);
  const isPurchase = documentType === 'purchase';
  const items = (bootstrap?.items ?? []).filter((item) => item.isActive && (isPurchase ? item.itemType !== 'sale' : item.itemType !== 'purchased'));
  const units = (bootstrap?.units ?? []).filter((unit) => unit.isActive);
  const defaultLocationId = bootstrap?.locations.find((row) => row.isActive)?.id || '';

  function patchLine(key: string, patch: Partial<DraftLine>) {
    setLines((current) => current.map((line) => line.key === key ? { ...line, ...patch } : line));
  }

  function chooseItem(line: DraftLine, itemId: string) {
    const item = items.find((row) => row.id === itemId);
    patchLine(line.key, { itemId, unitId: item?.baseUnitId || '', priceUnitId: item?.baseUnitId || '' });
  }

  async function submit() {
    const resolvedLocation = locationId || bootstrap?.locations.find((row) => row.isActive)?.id || '';
    if (!resolvedLocation || lines.some((line) => !line.itemId || !line.unitId || Number(line.quantity) <= 0)) return;
    const payload: OrdersV3DocumentPayload = {
      documentType,
      documentDate: date,
      paymentMethod: isPurchase ? paymentMethod : null,
      sectionId: sectionId || null,
      locationId: resolvedLocation,
      pettyCashAmount: isPurchase && paymentMethod === 'external' ? pettyCashAmount || null : null,
      notes: notes || null,
      idempotencyKey: crypto.randomUUID(),
      lines: lines.map((line) => ({ itemId: line.itemId, quantity: line.quantity, unitId: line.unitId, unitPrice: line.unitPrice || '0', priceUnitId: line.priceUnitId || line.unitId })),
    };
    await mutation.mutateAsync(payload);
    setLines([newLine()]);
    setNotes('');
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} size="2xl" title={isPurchase ? 'طلب شراء جديد — Orders Core V3' : 'تسجيل داخلي جديد — Orders Core V3'} footer={<DialogActions actions={[{ key: 'cancel', label: 'إلغاء', onClick: onClose, role: 'cancel' }, { key: 'save', label: 'اعتماد وحساب', onClick: submit, role: 'save', loading: mutation.isPending }]} />}>
      <div className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <OrdersV3Field label="التاريخ"><TransactionDatePicker value={date} onValueChange={setDate} /></OrdersV3Field>
          {isPurchase && <OrdersV3Field label="طريقة الدفع"><OrdersV3Select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as typeof paymentMethod)}><option value="external">عهدة</option><option value="internal">نقد المحل</option><option value="transfer">تحويل</option></OrdersV3Select></OrdersV3Field>}
          <OrdersV3Field label="القسم"><OrdersV3Select value={sectionId} onChange={(event) => setSectionId(event.target.value)}><option value="">غير محدد</option>{bootstrap?.sections.filter((row) => row.isActive).map((row) => <option key={row.id} value={row.id}>{row.nameAr}</option>)}</OrdersV3Select></OrdersV3Field>
          <OrdersV3Field label="موقع المخزون"><OrdersV3Select value={locationId || defaultLocationId} onChange={(event) => setLocationId(event.target.value)}>{bootstrap?.locations.filter((row) => row.isActive).map((row) => <option key={row.id} value={row.id}>{row.nameAr}</option>)}</OrdersV3Select></OrdersV3Field>
          {isPurchase && paymentMethod === 'external' && <OrdersV3Field label="مبلغ العهدة"><Input type="number" min="0" step="0.01" value={pettyCashAmount} onChange={(event: React.ChangeEvent<HTMLInputElement>) => setPettyCashAmount(event.target.value)} /></OrdersV3Field>}
        </div>
        <div className="rounded-xl border border-noorix-border bg-noorix-bg-muted/30 p-3">
          <div className="mb-3 flex items-center justify-between"><strong className="text-[13px]">أسطر المستند</strong><Button size="sm" onClick={() => setLines((current) => [...current, newLine()])}>+ إضافة سطر</Button></div>
          <div className="flex flex-col gap-2">
            {lines.map((line, index) => (
              <div key={line.key} className="grid items-end gap-2 rounded-lg bg-white p-2 shadow-sm sm:grid-cols-[2fr_0.8fr_1fr_0.9fr_1fr_auto]">
                <OrdersV3Field label={`الصنف ${index + 1}`}><OrdersV3Select value={line.itemId} onChange={(event) => chooseItem(line, event.target.value)}><option value="">اختر الصنف</option>{items.map((item) => <option key={item.id} value={item.id}>{item.nameAr}</option>)}</OrdersV3Select></OrdersV3Field>
                <OrdersV3Field label="الكمية"><Input type="number" min="0.000001" step="any" value={line.quantity} onChange={(event: React.ChangeEvent<HTMLInputElement>) => patchLine(line.key, { quantity: event.target.value })} /></OrdersV3Field>
                <OrdersV3Field label="وحدة الإدخال"><OrdersV3Select value={line.unitId} onChange={(event) => patchLine(line.key, { unitId: event.target.value })}>{units.map((unit) => <option key={unit.id} value={unit.id}>{unit.nameAr}</option>)}</OrdersV3Select></OrdersV3Field>
                <OrdersV3Field label="سعر الوحدة"><Input type="number" min="0" step="any" value={line.unitPrice} onChange={(event: React.ChangeEvent<HTMLInputElement>) => patchLine(line.key, { unitPrice: event.target.value })} /></OrdersV3Field>
                <OrdersV3Field label="وحدة السعر"><OrdersV3Select value={line.priceUnitId} onChange={(event) => patchLine(line.key, { priceUnitId: event.target.value })}>{units.map((unit) => <option key={unit.id} value={unit.id}>{unit.nameAr}</option>)}</OrdersV3Select></OrdersV3Field>
                <Button variant="danger" size="sm" disabled={lines.length === 1} onClick={() => setLines((current) => current.filter((row) => row.key !== line.key))}>حذف</Button>
              </div>
            ))}
          </div>
        </div>
        <OrdersV3Field label="ملاحظات"><Input multiline rows={3} value={notes} onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => setNotes(event.target.value)} /></OrdersV3Field>
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-[12px] text-blue-800">لا ترسل الواجهة أي إجمالي رسمي؛ نواة V3 تحل التحويلات وتحسب كمية الأساس والسعر والتكلفة وحركات المخزون داخل معاملة واحدة.</div>
      </div>
    </Modal>
  );
}

function OrdersV3DocumentDetails({ document, onClose }: { document: OrdersV3Document | null; onClose: () => void }) {
  const columns: SimpleTableColumn<OrdersV3Document['lines'][number]>[] = [
    { key: 'lineNumber', label: '#' },
    { key: 'itemNameSnapshot', label: 'الصنف' },
    { key: 'inputQuantity', label: 'الكمية المدخلة', numeric: true, render: (value, row) => `${v3Number(value, 6)} ${row.inputUnit.nameAr}` },
    { key: 'baseQuantity', label: 'كمية الأساس', numeric: true, render: (value, row) => `${v3Number(value, 6)} ${row.item.baseUnit.nameAr}` },
    { key: 'unitPrice', label: 'سعر الوحدة', numeric: true, render: (value, row) => `${v3Number(value)} / ${row.priceUnit.nameAr}` },
    { key: 'lineTotal', label: 'الإجمالي', numeric: true, render: (value) => `${v3Number(value)} ر.س` },
  ];
  return <Modal open={!!document} onClose={onClose} size="xl" title={document?.documentNumber} footer={<DialogActions actions={[{ key: 'close', label: 'إغلاق', onClick: onClose, role: 'cancel' }]} />}>{document && <div className="flex flex-col gap-3"><div className="grid grid-cols-2 gap-2 rounded-xl bg-noorix-bg-muted p-3 text-[12px] sm:grid-cols-4"><span>التاريخ: <b>{v3Date(document.documentDate)}</b></span><span>الموقع: <b>{document.location.nameAr}</b></span><span>الحالة: <b>{document.status}</b></span><span>الإجمالي: <b>{v3Number(document.totalAmount)} ر.س</b></span></div><SimpleTable columns={columns} data={document.lines} tableMinWidth={760} /></div>}</Modal>;
}
