import React, { useEffect, useMemo, useState } from 'react';
import type { OrdersV4Bootstrap, OrdersV4Document, OrdersV4DocumentPayload, OrdersV4Item, OrdersV4ReceivePayload, OrdersV4Summary } from '../../../types/api';
import { AdaptiveSheet, Button, DialogActions, Input, Modal, type SimpleTableColumn, TransactionDatePicker } from '../../../ui';
import { getSaudiToday } from '../../../utils/saudiDate';
import { OrdersV4Field, OrdersV4Kpi, OrdersV4Panel, OrdersV4QueryState, OrdersV4Select, OrdersV4Table as SimpleTable, v4Date, v4Number } from '../OrdersV4Shared';
import { useCreateOrdersV4Document, useOrdersV4Documents, useOrdersV4Summary, useReceiveOrdersV4Document, useReverseOrdersV4Document } from '../useOrdersV4';
import { OrdersV4DocumentItemPicker } from './OrdersV4DocumentItemPicker';
import { OrdersV4DocumentLinesTable, type OrdersV4DocumentDraftLine } from './OrdersV4DocumentLinesTable';
import { OrdersV4DocumentLineModal, type OrdersV4DocumentLineDraft } from './OrdersV4DocumentLineModal';
import { buildOrdersV4WhatsAppText } from './ordersV4WhatsApp.utils';

type DraftLine = OrdersV4DocumentDraftLine;

function OrdersV4PurchaseSummaryCard({ summary }: { summary?: OrdersV4Summary }) {
  const panes = [
    {
      title: 'عهدة المندوب',
      tone: 'bg-[var(--color-nx-sales)]',
      rows: [
        { label: 'العهدة المستلمة', value: summary?.custodyFunded, className: 'text-noorix-green' },
        { label: 'مشتريات العهدة', value: summary?.custodySpent, className: 'text-noorix-red' },
      ],
      resultLabel: 'رصيد العهدة',
      result: Number(summary?.custodyBalance ?? 0),
    },
    {
      title: 'نقد المحل والتحويل',
      tone: 'bg-[var(--color-nx-profit)]',
      rows: [
        { label: 'نقد المبيعات المستورد', value: summary?.cashSalesImported, className: 'text-noorix-green' },
        { label: 'مشتريات نقد المحل', value: summary?.cashUsed, className: 'text-noorix-red' },
        { label: 'مشتريات التحويل', value: summary?.transferTotal, className: 'text-noorix-muted' },
      ],
      resultLabel: 'نقد المحل المتاح',
      result: Number(summary?.cashAvailable ?? 0),
    },
  ];
  return (
    <div className="overflow-hidden rounded-lg border border-noorix-border bg-noorix-surface">
      <div className="h-1 bg-gradient-to-r from-noorix-blue to-noorix-green" aria-hidden />
      <div className="flex items-center justify-between gap-2 border-b border-noorix-border px-3 py-2.5 sm:px-4 sm:py-3">
        <div className="text-[12px] font-bold tracking-[0.04em] text-noorix-muted sm:text-[13px]">ملخص الطلبات والعهدة</div>
        <span className="text-[11px] text-noorix-muted">SR</span>
      </div>
      <div className="grid grid-cols-1 divide-y divide-noorix-border sm:grid-cols-2 sm:divide-x sm:divide-y-0">
        {panes.map((pane) => (
          <div key={pane.title} className="flex min-w-0 flex-col px-3 py-3 sm:px-4 sm:py-3.5">
            <div className="mb-2.5 flex items-center gap-2">
              <span className={`h-4 w-1 shrink-0 rounded-full ${pane.tone}`} aria-hidden />
              <div className="text-[11px] font-bold uppercase tracking-[0.04em] text-noorix-muted">{pane.title}</div>
            </div>
            <div className="overflow-hidden rounded-md border border-noorix-border">
              <SimpleTable
                data={pane.rows}
                columns={[
                  { key: 'label', label: 'البند' },
                  { key: 'value', label: 'المبلغ', render: (_value, row) => <span className={`font-semibold tabular-nums ${row.className}`}>{v4Number(row.value)} SR</span> },
                ]}
                footer={<tr className="bg-noorix-bg-muted/60 font-bold"><td>{pane.resultLabel}</td><td><span className={`text-[15px] tabular-nums ${pane.result < 0 ? 'text-noorix-red' : 'text-noorix-text'}`}>{v4Number(pane.result)} SR</span></td></tr>}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function addOrMergeDraftLine(current: DraftLine[], draft: OrdersV4DocumentLineDraft): DraftLine[] {
  const existingIndex = current.findIndex((line) => line.itemId === draft.itemId
    && line.unitId === draft.unitId
    && line.priceUnitId === draft.priceUnitId);
  if (existingIndex < 0) return [...current, { ...draft, key: crypto.randomUUID() }];
  return current.map((line, index) => index === existingIndex
    ? { ...line, quantity: String(Math.max(0, Number(line.quantity) || 0) + Math.max(0, Number(draft.quantity) || 0)), unitPrice: draft.unitPrice }
    : line);
}

export function OrdersV4DocumentsTab({
  companyId,
  documentType,
  startDate,
  endDate,
  bootstrap,
  canReport = true,
  canCreate = false,
  canReverse = false,
  canReceive = false,
}: {
  companyId: string;
  documentType: 'purchase' | 'registration';
  startDate: string;
  endDate: string;
  bootstrap?: OrdersV4Bootstrap;
  canReport?: boolean;
  canCreate?: boolean;
  canReverse?: boolean;
  canReceive?: boolean;
}) {
  const documentsQuery = useOrdersV4Documents(companyId, documentType, startDate, endDate);
  const summaryQuery = useOrdersV4Summary(companyId, startDate, endDate, canReport);
  const reverseMutation = useReverseOrdersV4Document(companyId);
  const [createOpen, setCreateOpen] = useState(false);
  const [viewing, setViewing] = useState<OrdersV4Document | null>(null);
  const [receiving, setReceiving] = useState<OrdersV4Document | null>(null);
  const isPurchase = documentType === 'purchase';
  const documents = documentsQuery.data ?? [];
  const summary = summaryQuery.data;

  const columns = useMemo<SimpleTableColumn<OrdersV4Document>[]>(() => [
    { key: 'documentNumber', label: isPurchase ? 'رقم الطلب' : 'رقم التسجيل', minWidth: 180, render: (value) => <span className="font-bold text-noorix-blue">{String(value)}</span> },
    { key: 'documentDate', label: 'التاريخ', render: (value) => v4Date(String(value)) },
    ...(isPurchase ? [
      { key: 'paymentMethod', label: 'طريقة الدفع', render: (value: unknown) => value === 'custody' ? 'عهدة' : value === 'transfer' ? 'تحويل' : 'نقد المحل' },
      { key: 'pettyCashAmount', label: 'العهدة المستلمة', numeric: true, render: (value: unknown, row: OrdersV4Document) => row.paymentMethod === 'custody' && value != null ? `${v4Number(value)} ر.س` : '—' },
    ] : []),
    { key: 'section', label: 'القسم', render: (_value, row) => row.section?.nameAr || '—' },
    { key: 'location', label: 'الموقع', render: (_value, row) => row.location?.nameAr || '—' },
    { key: 'lines', label: 'الأسطر', numeric: true, render: (_value, row) => row.lines.length },
    { key: isPurchase ? 'totalAmount' : 'operationalCost', label: isPurchase ? 'الإجمالي' : 'التكلفة', numeric: true, render: (value) => <strong>{v4Number(value)} ر.س</strong> },
    { key: 'status', label: 'الحالة', render: (value) => <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${value === 'received' ? 'bg-emerald-50 text-emerald-700' : value === 'prepared' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>{value === 'received' ? 'مستلم' : value === 'prepared' ? 'بانتظار الاستلام' : 'معكوس'}</span> },
    { key: 'actions', label: '', render: (_value, row) => <div className="flex gap-1">{isPurchase && canReceive && row.status === 'prepared' && <Button size="sm" variant="primary" onClick={(event) => { event.stopPropagation(); setReceiving(row); }}>استلام</Button>}{canReverse && row.status === 'received' && <Button size="sm" variant="ghost" onClick={(event) => { event.stopPropagation(); reverseMutation.mutate({ id: row.id, idempotencyKey: crypto.randomUUID() }); }}>عكس</Button>}</div> },
  ], [canReceive, canReverse, isPurchase, reverseMutation]);

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {canCreate && (
        <div className="flex justify-start" role="toolbar" aria-label={isPurchase ? 'إجراءات الطلبات' : 'إجراءات التسجيل الداخلي'}>
          <Button variant="primary" onClick={() => setCreateOpen(true)}>+ {isPurchase ? 'طلب جديد' : 'تسجيل جديد'}</Button>
        </div>
      )}
      {isPurchase ? <OrdersV4PurchaseSummaryCard summary={summary} /> : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <OrdersV4Kpi label="عدد التسجيلات" value={summary?.registrationCount ?? 0} />
          <OrdersV4Kpi label="التكلفة المركزية" value={`${v4Number(summary?.registrationTotal)} ر.س`} tone="green" />
          <OrdersV4Kpi label="أسطر التسجيل" value={documents.reduce((sum, row) => sum + row.lines.length, 0)} tone="amber" />
          <OrdersV4Kpi label="نسخة النواة" value="V4" />
        </div>
      )}
      <OrdersV4Panel
        title={isPurchase ? 'طلبات الشراء — V4' : 'التسجيل الداخلي — V4'}
      >
        <OrdersV4QueryState loading={documentsQuery.isLoading} error={documentsQuery.error as Error | null} />
        {!documentsQuery.isLoading && <SimpleTable columns={columns} data={documents} emptyMessage="لا توجد مستندات في الفترة المحددة" tableMinWidth={isPurchase ? 1120 : 980} onRowClick={setViewing} />}
      </OrdersV4Panel>
      {canCreate && <OrdersV4DocumentModal open={createOpen} onClose={() => setCreateOpen(false)} companyId={companyId} documentType={documentType} bootstrap={bootstrap} />}
      {canReceive && receiving && <OrdersV4DocumentModal open={!!receiving} onClose={() => setReceiving(null)} companyId={companyId} documentType="purchase" bootstrap={bootstrap} initialDocument={receiving} />}
      <OrdersV4DocumentDetails document={viewing} onClose={() => setViewing(null)} />
    </div>
  );
}

function OrdersV4DocumentModal({ open, onClose, companyId, documentType, bootstrap, initialDocument }: {
  open: boolean; onClose: () => void; companyId: string; documentType: 'purchase' | 'registration'; bootstrap?: OrdersV4Bootstrap; initialDocument?: OrdersV4Document | null;
}) {
  const createMutation = useCreateOrdersV4Document(companyId);
  const receiveMutation = useReceiveOrdersV4Document(companyId);
  const mutation = initialDocument ? receiveMutation : createMutation;
  const [date, setDate] = useState(getSaudiToday());
  const [paymentMethod, setPaymentMethod] = useState<'custody' | 'cash' | 'transfer'>('custody');
  const [sectionId, setSectionId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [pettyCashAmount, setPettyCashAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [selectedItem, setSelectedItem] = useState<OrdersV4Item | null>(null);
  const [sendWhatsAppPrompt, setSendWhatsAppPrompt] = useState<string | null>(null);
  const isPurchase = documentType === 'purchase';
  const items = (bootstrap?.items ?? []).filter((item) => item.isActive
    && (isPurchase ? item.itemType !== 'sale' : item.itemType !== 'purchased')
    && (!isPurchase || !!initialDocument || item.units.some((row) => row.isActive && row.isOrderEnabled && row.lastPrice != null)));
  const units = (bootstrap?.units ?? []).filter((unit) => unit.isActive);
  const defaultLocationId = bootstrap?.locations.find((row) => row.isActive)?.id || '';

  useEffect(() => {
    if (!open) return;
    if (initialDocument) {
      setDate(initialDocument.documentDate.slice(0, 10));
      setPaymentMethod(initialDocument.paymentMethod ?? 'custody');
      setSectionId(initialDocument.sectionId ?? '');
      setLocationId(initialDocument.locationId);
      setPettyCashAmount(String(initialDocument.pettyCashAmount ?? ''));
      setNotes(initialDocument.notes ?? '');
      setSelectedItem(null);
      setLines(initialDocument.lines.map((line) => ({
        key: crypto.randomUUID(), itemId: line.itemId, quantity: String(line.inputQuantity),
        unitId: line.inputUnit.id, unitPrice: String(line.unitPrice), priceUnitId: line.priceUnit.id,
      })));
      return;
    }
    setDate(getSaudiToday());
    setPaymentMethod('custody');
    setSectionId('');
    setLocationId(defaultLocationId);
    setPettyCashAmount('');
    setNotes('');
    setLines([]);
    setSelectedItem(null);
  }, [defaultLocationId, initialDocument, open]);

  function patchLine(key: string, patch: Partial<DraftLine>) {
    setLines((current) => current.map((line) => line.key === key ? { ...line, ...patch } : line));
  }

  const selectedQuantities = useMemo(() => {
    const quantities = new Map<string, number>();
    for (const line of lines) quantities.set(line.itemId, (quantities.get(line.itemId) ?? 0) + Math.max(0, Number(line.quantity) || 0));
    return quantities;
  }, [lines]);

  function addItem(item: OrdersV4Item) {
    setSelectedItem(item);
  }

  function confirmItem(draft: OrdersV4DocumentLineDraft) {
    setLines((current) => addOrMergeDraftLine(current, draft));
    setSelectedItem(null);
  }

  function removeItem(itemId: string) {
    setLines((current) => current.filter((line) => line.itemId !== itemId));
  }

  async function submit() {
    const resolvedLocation = locationId || bootstrap?.locations.find((row) => row.isActive)?.id || '';
    if (!resolvedLocation || lines.length === 0 || lines.some((line) => !line.itemId || !line.unitId || Number(line.quantity) <= 0)) return;
    const payload: OrdersV4DocumentPayload = {
      documentType,
      documentDate: date,
      paymentMethod: isPurchase ? paymentMethod : null,
      sectionId: sectionId || null,
      locationId: resolvedLocation,
      pettyCashAmount: isPurchase && paymentMethod === 'custody' ? pettyCashAmount || null : null,
      notes: notes || null,
      idempotencyKey: crypto.randomUUID(),
      lines: lines.map((line) => ({ itemId: line.itemId, quantity: line.quantity, unitId: line.unitId, unitPrice: line.unitPrice || '0', priceUnitId: line.priceUnitId || line.unitId })),
    };
    if (initialDocument) {
      const { documentType: _documentType, ...receiveBody } = payload;
      await receiveMutation.mutateAsync({
        id: initialDocument.id,
        body: { ...receiveBody, revision: initialDocument.revision } as OrdersV4ReceivePayload,
      });
    } else {
      const response = await createMutation.mutateAsync(payload);
      if (response.data) setSendWhatsAppPrompt(buildOrdersV4WhatsAppText(response.data));
    }
    setLines([]);
    setNotes('');
    onClose();
  }

  return (
    <>
    <AdaptiveSheet
      open={open}
      onClose={onClose}
      size="2xl"
      side="start"
      title={initialDocument ? `استلام ${initialDocument.documentNumber}` : isPurchase ? 'طلب شراء جديد — طلبات V4' : 'تسجيل داخلي جديد — طلبات V4'}
      footer={<DialogActions className="w-full sm:w-auto" actions={[{ key: 'cancel', label: 'إلغاء', onClick: onClose, role: 'cancel' }, { key: 'save', label: initialDocument ? 'تأكيد الاستلام والترحيل' : isPurchase ? 'حفظ طلب الغد' : 'حفظ التسجيل الداخلي', onClick: submit, role: 'save', loading: mutation.isPending }]} />}
    >
      <div className="flex flex-col gap-4">
        <div className={`grid gap-3 sm:grid-cols-2 ${isPurchase ? 'lg:grid-cols-3' : ''}`}>
          <OrdersV4Field label="التاريخ"><TransactionDatePicker value={date} onValueChange={setDate} /></OrdersV4Field>
          {isPurchase && (
            <OrdersV4Field label="طريقة الدفع">
              <div className="grid grid-cols-3 gap-1.5" role="group" aria-label="طريقة الدفع">
                {([
                  ['custody', 'عهدة'],
                  ['cash', 'نقد المحل'],
                  ['transfer', 'تحويل'],
                ] as const).map(([value, label]) => {
                  const selected = paymentMethod === value;
                  return (
                    <Button
                      key={value}
                      type="button"
                      variant="raw"
                      aria-pressed={selected}
                      onClick={() => setPaymentMethod(value)}
                      className={`h-9 rounded-lg border px-2 text-[12px] font-semibold transition-all ${selected ? 'border-noorix-blue bg-noorix-blue text-white shadow-sm' : 'border-noorix-border bg-noorix-surface text-noorix-text hover:border-noorix-blue/50'}`}
                    >
                      {label}
                    </Button>
                  );
                })}
              </div>
            </OrdersV4Field>
          )}
          <OrdersV4Field label="موقع المخزون"><OrdersV4Select value={locationId || defaultLocationId} onChange={(event) => setLocationId(event.target.value)}>{bootstrap?.locations.filter((row) => row.isActive).map((row) => <option key={row.id} value={row.id}>{row.nameAr}</option>)}</OrdersV4Select></OrdersV4Field>
          {isPurchase && paymentMethod === 'custody' && <OrdersV4Field label="مبلغ العهدة"><Input type="number" min="0" step="0.01" value={pettyCashAmount} onChange={(event: React.ChangeEvent<HTMLInputElement>) => setPettyCashAmount(event.target.value)} /></OrdersV4Field>}
        </div>
        <div className="rounded-xl border border-noorix-border bg-noorix-bg-muted/30 p-3">
          <div className="mb-3 text-[13px] font-bold">اختر الأصناف</div>
          <OrdersV4DocumentItemPicker items={items} sections={(bootstrap?.sections ?? []).filter((row) => row.isActive)} sectionId={sectionId} onSectionChange={setSectionId} selectedQuantities={selectedQuantities} onSelect={addItem} onRemove={removeItem} />
        </div>
        <div className="rounded-xl border border-noorix-border bg-noorix-bg-muted/30 p-3">
          <div className="mb-3 flex items-center justify-between"><strong className="text-[13px]">الأصناف المضافة</strong><span className="text-[11px] text-noorix-muted">{lines.length} سطر</span></div>
          <OrdersV4DocumentLinesTable
            lines={lines}
            items={items}
            isPurchase={isPurchase}
            isReceiving={!!initialDocument}
            onPatch={patchLine}
            onRemove={(key) => setLines((current) => current.filter((row) => row.key !== key))}
          />
        </div>
        <OrdersV4Field label="ملاحظات"><Input multiline rows={3} value={notes} onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => setNotes(event.target.value)} /></OrdersV4Field>
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-[12px] text-blue-800">لا ترسل الواجهة أي إجمالي رسمي؛ نواة V4 تحل التحويلات وتحسب كمية الأساس والسعر والتكلفة وحركات المخزون داخل معاملة واحدة.</div>
        <OrdersV4DocumentLineModal
          item={selectedItem}
          isPurchase={isPurchase}
          isReceiving={!!initialDocument}
          onClose={() => setSelectedItem(null)}
          onConfirm={confirmItem}
        />
      </div>
    </AdaptiveSheet>
    <Modal
      open={!!sendWhatsAppPrompt}
      onClose={() => setSendWhatsAppPrompt(null)}
      size="sm"
      title={isPurchase ? 'إرسال الطلب عبر واتساب؟' : 'إرسال التسجيل الداخلي عبر واتساب؟'}
    >
      <div className="flex flex-col gap-4 p-1">
        <p className="m-0 text-[13px] leading-relaxed text-noorix-muted">
          تم الحفظ بنجاح. هل تريد إرسال التفاصيل الآن عبر واتساب؟
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="ghost" size="md" onClick={() => setSendWhatsAppPrompt(null)}>ليس الآن</Button>
          <Button
            variant="success"
            size="md"
            onClick={() => {
              const text = sendWhatsAppPrompt;
              if (!text) return;
              window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
              setSendWhatsAppPrompt(null);
            }}
          >
            إرسال عبر واتساب
          </Button>
        </div>
      </div>
    </Modal>
    </>
  );
}

function OrdersV4DocumentDetails({ document, onClose }: { document: OrdersV4Document | null; onClose: () => void }) {
  const columns: SimpleTableColumn<OrdersV4Document['lines'][number]>[] = [
    { key: 'lineNumber', label: '#' },
    { key: 'itemNameSnapshot', label: 'الصنف' },
    { key: 'inputQuantity', label: 'الكمية المدخلة', numeric: true, render: (value, row) => `${v4Number(value, 6)} ${row.inputUnit.nameAr}` },
    { key: 'baseQuantity', label: 'كمية الأساس وقت المستند', numeric: true, render: (value, row) => `${v4Number(value, 6)} ${row.baseUnit.nameAr}` },
    { key: 'unitPrice', label: 'سعر الوحدة', numeric: true, render: (value, row) => `${v4Number(value)} / ${row.priceUnit.nameAr}` },
    { key: document?.documentType === 'registration' ? 'operationalCost' : 'lineTotal', label: document?.documentType === 'registration' ? 'التكلفة' : 'الإجمالي', numeric: true, render: (value) => `${v4Number(value)} ر.س` },
  ];
  return <Modal open={!!document} onClose={onClose} size="xl" title={document?.documentNumber} footer={<DialogActions actions={[{ key: 'close', label: 'إغلاق', onClick: onClose, role: 'cancel' }]} />}>{document && <div className="flex flex-col gap-3"><div className="grid grid-cols-2 gap-2 rounded-xl bg-noorix-bg-muted p-3 text-[12px] sm:grid-cols-4"><span>التاريخ: <b>{v4Date(document.documentDate)}</b></span><span>الموقع: <b>{document.location.nameAr}</b></span><span>الحالة: <b>{document.status}</b></span><span>{document.documentType === 'registration' ? 'التكلفة' : 'الإجمالي'}: <b>{v4Number(document.documentType === 'registration' ? document.operationalCost : document.totalAmount)} ر.س</b></span></div><SimpleTable columns={columns} data={document.lines} tableMinWidth={760} /></div>}</Modal>;
}
