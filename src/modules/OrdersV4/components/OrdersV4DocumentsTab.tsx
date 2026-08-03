import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { OrdersV4Bootstrap, OrdersV4Document, OrdersV4DocumentPayload, OrdersV4DocumentPreview, OrdersV4Item, OrdersV4ReceivePayload, OrdersV4Summary } from '../../../types/api';
import { AdaptiveSheet, Button, DialogActions, Input, Modal, type SimpleTableColumn, TransactionDatePicker, usePrintPreview } from '../../../ui';
import { exportToExcel } from '../../../utils/exportUtils';
import { buildPrintTableHtml } from '../../../utils/printTableHtml';
import { getSaudiToday } from '../../../utils/saudiDate';
import { OrdersV4Field, OrdersV4Kpi, OrdersV4Panel, OrdersV4QueryState, OrdersV4Select, OrdersV4Table as SimpleTable, v4Date, v4Number } from '../OrdersV4Shared';
import { useCreateOrdersV4Document, useOrdersV4Documents, useOrdersV4Summary, usePreviewOrdersV4Document, useReceiveOrdersV4Document, useReopenOrdersV4Document, useReverseOrdersV4Document, useUndoReverseOrdersV4Document } from '../useOrdersV4';
import { OrdersV4DocumentItemPicker } from './OrdersV4DocumentItemPicker';
import { OrdersV4DocumentLinesTable, type OrdersV4DocumentDraftLine } from './OrdersV4DocumentLinesTable';
import { OrdersV4DocumentLineModal, type OrdersV4DocumentLineDraft } from './OrdersV4DocumentLineModal';
import { buildOrdersV4PeriodCustodyBalances } from './ordersV4CustodyPeriod.utils';
import { buildOrdersV4WhatsAppText } from './ordersV4WhatsApp.utils';
import { ordersV4CancellationReasonLabel } from './ordersV4CancellationReasons';
import { useTranslation } from '../../../i18n/useTranslation';

type DraftLine = OrdersV4DocumentDraftLine;

function OrdersV4PurchaseSummaryCard({ summary }: { summary?: OrdersV4Summary }) {
  const panes = [
    {
      title: 'عهدة المندوب',
      tone: 'bg-[var(--color-nx-sales)]',
      rows: [
        { label: 'العهدة المستلمة خلال الفترة', value: summary?.custodyFunded, className: 'text-noorix-green' },
        { label: 'مشتريات العهدة خلال الفترة', value: summary?.custodySpent, className: 'text-noorix-red' },
      ],
      resultLabel: 'رصيد العهدة خلال الفترة',
      result: Number(summary?.custodyBalance ?? 0),
    },
    {
      title: 'نقد المحل والتحويل',
      tone: 'bg-[var(--color-nx-profit)]',
      rows: [
        { label: 'نقد المبيعات خلال الفترة', value: summary?.cashSalesImported, className: 'text-noorix-green' },
        { label: 'مشتريات نقد المحل خلال الفترة', value: summary?.cashUsed, className: 'text-noorix-red' },
        { label: 'مشتريات التحويل خلال الفترة', value: summary?.transferTotal, className: 'text-noorix-muted' },
      ],
      resultLabel: 'صافي نقد الفترة',
      result: Number(summary?.cashAvailable ?? 0),
    },
  ];
  return (
    <div className="overflow-hidden rounded-lg border border-noorix-border bg-noorix-surface">
      <div className="h-1 bg-gradient-to-r from-noorix-blue to-noorix-green" aria-hidden />
      <div className="flex items-center justify-between gap-2 border-b border-noorix-border px-3 py-2.5 sm:px-4 sm:py-3">
        <div className="text-[12px] font-bold tracking-[0.04em] text-noorix-muted sm:text-[13px]">ملخص الفترة المختارة</div>
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

function OrdersV4PurchaseSummaryCards({ summary }: { summary?: OrdersV4Summary }) {
  const cards = [
    {
      title: 'عهدة المندوب',
      accent: 'bg-noorix-green',
      rows: [
        { label: 'العهدة المستلمة خلال الفترة', value: summary?.custodyFunded, tone: 'text-noorix-green' },
        { label: 'مشتريات العهدة خلال الفترة', value: summary?.custodySpent, tone: 'text-noorix-red' },
      ],
      totalLabel: 'رصيد عهدة الفترة',
      total: Number(summary?.custodyBalance ?? 0),
    },
    {
      title: 'نقد المحل والتحويل',
      accent: 'bg-noorix-blue',
      rows: [
        { label: 'نقد المبيعات خلال الفترة', value: summary?.cashSalesImported, tone: 'text-noorix-green' },
        { label: 'مشتريات نقد المحل', value: summary?.cashUsed, tone: 'text-noorix-red' },
        { label: 'مشتريات التحويل', value: summary?.transferTotal, tone: 'text-noorix-muted' },
      ],
      totalLabel: 'صافي نقد الفترة',
      total: Number(summary?.cashAvailable ?? 0),
    },
  ];
  return <section data-testid="orders-v4-purchase-summary-cards" className="overflow-hidden rounded-xl border border-noorix-border bg-noorix-surface shadow-sm">
    <div className="flex items-center justify-between border-b border-noorix-border px-4 py-3">
      <strong className="text-[15px] leading-6">ملخص الفترة المختارة</strong>
      <span className="text-[12px] font-semibold text-noorix-muted">SR</span>
    </div>
    <div className="grid gap-3 p-3 md:grid-cols-2">
      {cards.map((card) => <article key={card.title} className="overflow-hidden rounded-xl border border-noorix-border bg-white shadow-sm">
        <header className="flex items-center gap-2 border-b border-noorix-border bg-noorix-bg-muted/35 px-3 py-2.5">
          <span className={`h-5 w-1 rounded-full ${card.accent}`} aria-hidden />
          <strong className="text-[14px] leading-6">{card.title}</strong>
        </header>
        <div className="divide-y divide-noorix-border">
          {card.rows.map((row) => <div key={row.label} className="flex items-center justify-between gap-3 px-3 py-3"><span className="min-w-0 text-[13px] font-medium leading-5 text-noorix-muted sm:text-[14px]">{row.label}</span><b className={`shrink-0 text-[14px] tabular-nums sm:text-[15px] ${row.tone}`}>{v4Number(row.value)} SR</b></div>)}
        </div>
        <footer className="flex items-center justify-between gap-3 border-t border-noorix-border bg-noorix-bg-muted/60 px-3 py-3.5"><strong className="text-[14px] leading-5">{card.totalLabel}</strong><b className={`shrink-0 text-[18px] tabular-nums ${card.total < 0 ? 'text-noorix-red' : 'text-noorix-text'}`}>{v4Number(card.total)} SR</b></footer>
      </article>)}
    </div>
  </section>;
}

export function addOrMergeDraftLine(current: DraftLine[], draft: OrdersV4DocumentLineDraft): DraftLine[] {
  const existingIndex = current.findIndex((line) => line.itemId === draft.itemId
    && line.unitId === draft.unitId
    && line.priceUnitId === draft.priceUnitId);
  if (existingIndex < 0) return [...current, { ...draft, key: crypto.randomUUID() }];
  return current.map((line, index) => index === existingIndex
    ? {
      ...line,
      quantity: String(Math.max(0, Number(line.quantity) || 0) + Math.max(0, Number(draft.quantity) || 0)),
      unitPrice: draft.unitPrice,
      cancellationReasons: [...new Set([...(line.cancellationReasons ?? []), ...(draft.cancellationReasons ?? [])])],
      cancellationNote: [line.cancellationNote, draft.cancellationNote].filter(Boolean).join(' — ') || undefined,
    }
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
  canUndoReverse = false,
  canReopen = false,
  canReceive = false,
  showOverviewCards = true,
  historyWindowDays,
  companyName = '',
  companyLogoUrl = '',
}: {
  companyId: string;
  documentType: 'purchase' | 'registration';
  startDate: string;
  endDate: string;
  bootstrap?: OrdersV4Bootstrap;
  canReport?: boolean;
  canCreate?: boolean;
  canReverse?: boolean;
  canUndoReverse?: boolean;
  canReopen?: boolean;
  canReceive?: boolean;
  showOverviewCards?: boolean;
  historyWindowDays?: number;
  companyName?: string;
  companyLogoUrl?: string;
}) {
  const { t, lang } = useTranslation();
  const [resultLimit, setResultLimit] = useState(250);
  const [createOpen, setCreateOpen] = useState(false);
  const [cancellationOpen, setCancellationOpen] = useState(false);
  const [viewing, setViewing] = useState<OrdersV4Document | null>(null);
  const [receiving, setReceiving] = useState<OrdersV4Document | null>(null);
  const [reverseTarget, setReverseTarget] = useState<OrdersV4Document | null>(null);
  const [undoReverseTarget, setUndoReverseTarget] = useState<OrdersV4Document | null>(null);
  const [reopenTarget, setReopenTarget] = useState<OrdersV4Document | null>(null);
  const [sectionFilter, setSectionFilter] = useState('');
  const isPurchase = documentType === 'purchase';
  const documentsQuery = useOrdersV4Documents(companyId, documentType, startDate, endDate, true, resultLimit, {
    sectionId: !isPurchase && sectionFilter ? sectionFilter : undefined,
  });
  const summaryQuery = useOrdersV4Summary(companyId, startDate, endDate, canReport);
  const reverseMutation = useReverseOrdersV4Document(companyId);
  const undoReverseMutation = useUndoReverseOrdersV4Document(companyId);
  const reopenMutation = useReopenOrdersV4Document(companyId);
  const documents = documentsQuery.data ?? [];
  useEffect(() => setResultLimit(250), [documentType, endDate, sectionFilter, startDate]);
  const summary = summaryQuery.data;
  const availableItems = useMemo(() => (bootstrap?.items ?? []).filter((item) => item.itemType === (isPurchase ? 'purchased' : 'sale')), [bootstrap?.items, isPurchase]);
  const sections = useMemo(() => (bootstrap?.sections ?? []).filter((section) => availableItems.some((item) => item.sections.some((entry) => entry.section.id === section.id))), [availableItems, bootstrap?.sections]);
  useEffect(() => {
    setSectionFilter('');
  }, [companyId, documentType]);
  const periodCustodyBalanceByDocumentId = useMemo(
    () => buildOrdersV4PeriodCustodyBalances(documents),
    [documents],
  );
  const filteredDocuments = documents;
  const { openPrintDocumentPreview, printPreviewModal } = usePrintPreview({
    title: isPurchase ? 'طباعة الطلب' : 'طباعة التسجيل الداخلي',
    closeLabel: 'إغلاق',
    printLabel: 'طباعة / PDF',
  });

  function exportDocument(document: OrdersV4Document) {
    return exportToExcel(document.lines.map((line) => ({
      'رقم المستند': document.documentNumber,
      'التاريخ': v4Date(document.documentDate),
      'الصنف': line.itemNameSnapshot,
      'الكمية': Number(line.inputQuantity),
      'الوحدة': line.inputUnit.nameAr,
      'سعر الوحدة': Number(line.unitPrice),
      'الإجمالي': Number(document.documentType === 'registration' ? line.operationalCost : line.lineTotal),
    })), `orders-v4-${document.documentNumber}.xlsx`, { title: document.documentNumber });
  }

  function printDocument(document: OrdersV4Document) {
    const body = buildPrintTableHtml({
      columns: [
        { key: 'item', header: 'الصنف' },
        { key: 'quantity', header: 'الكمية', align: 'center' },
        { key: 'unitPrice', header: 'سعر الوحدة', align: 'end' },
        { key: 'total', header: document.documentType === 'registration' ? 'التكلفة' : 'الإجمالي', align: 'end' },
      ],
      rows: document.lines.map((line) => ({
        item: line.itemNameSnapshot,
        quantity: `${v4Number(line.inputQuantity, 6)} ${line.inputUnit.nameAr}`,
        unitPrice: `${v4Number(line.unitPrice)} / ${line.priceUnit.nameAr}`,
        total: `${v4Number(document.documentType === 'registration' ? line.operationalCost : line.lineTotal)} ر.س`,
      })),
      footerRows: [[
        { value: 'الإجمالي', colSpan: 3 },
        { value: `${v4Number(document.documentType === 'registration' ? document.operationalCost : document.totalAmount)} ر.س`, align: 'end' },
      ]],
    });
    openPrintDocumentPreview({
      title: `${document.documentType === 'purchase' ? 'طلب شراء' : 'تسجيل داخلي'} — ${document.documentNumber}`,
      companyName,
      logoUrl: companyLogoUrl.trim(),
      subtitle: v4Date(document.documentDate),
      body,
    });
  }

  function sendDocumentWhatsApp(document: OrdersV4Document) {
    window.open(`https://wa.me/?text=${encodeURIComponent(buildOrdersV4WhatsAppText(document, lang === 'en' ? 'en' : 'ar'))}`, '_blank', 'noopener,noreferrer');
  }

  const columns = useMemo<SimpleTableColumn<OrdersV4Document>[]>(() => [
    ...(!isPurchase ? [
      { key: 'registrationEntryType', label: t('ordersV4CancellationRecordType'), minWidth: 115, render: (_value: unknown, row: OrdersV4Document) => (row.registrationEntryType ?? 'issue') === 'cancellation' ? <span className="rounded-full bg-red-50 px-2 py-1 text-[11px] font-bold text-red-700">{t('ordersV4CancellationShort')}</span> : <span className="rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-700">{t('ordersV4CancellationShortRecord')}</span> },
      { key: 'cancellationReasons', label: t('ordersV4CancellationReasonsPlural'), minWidth: 220, render: (_value: unknown, row: OrdersV4Document) => {
        const reasons = [...new Set(row.lines.flatMap((line) => line.cancellationReasons ?? []))];
        return reasons.length ? reasons.map((reason) => ordersV4CancellationReasonLabel(reason, t)).join(lang === 'en' ? ', ' : '، ') : '—';
      } },
    ] as SimpleTableColumn<OrdersV4Document>[] : []),
    { key: 'documentNumber', label: isPurchase ? 'رقم الطلب' : 'رقم التسجيل', minWidth: 180, render: (value) => <span className="font-bold text-noorix-blue">{String(value)}</span> },
    { key: 'documentDate', label: 'التاريخ', render: (value) => v4Date(String(value)) },
    ...(isPurchase ? [
      { key: 'paymentMethod', label: 'طريقة الدفع', render: (value: unknown) => value === 'custody' ? 'عهدة' : value === 'transfer' ? 'تحويل' : 'نقد المحل' },
      { key: 'pettyCashAmount', label: 'العهدة المستلمة', numeric: true, render: (value: unknown, row: OrdersV4Document) => row.paymentMethod === 'custody' && value != null ? `${v4Number(value)} ر.س` : '—' },
      { key: 'periodCustodyBalance', label: 'رصيد الفترة بعد الطلب', numeric: true, render: (_value: unknown, row: OrdersV4Document) => {
        const value = periodCustodyBalanceByDocumentId.get(row.id);
        return value != null ? `${v4Number(value)} ر.س` : '—';
      } },
    ] : []),
    { key: 'section', label: 'القسم', render: (_value, row) => row.section?.nameAr || '—' },
    {
      key: 'lines',
      label: isPurchase ? 'الأسطر' : 'الكمية',
      numeric: true,
      render: (_value, row) => isPurchase
        ? row.lines.length
        : v4Number(row.lines.reduce((sum, line) => sum + Number(line.inputQuantity || 0), 0), 6),
    },
    { key: isPurchase ? 'totalAmount' : 'operationalCost', label: isPurchase ? 'الإجمالي' : 'التكلفة', numeric: true, render: (value) => <strong>{v4Number(value)} ر.س</strong> },
    { key: 'status', label: 'الحالة', render: (value, row) => <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${value === 'received' ? 'bg-emerald-50 text-emerald-700' : value === 'prepared' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>{value === 'received' ? 'مستلم' : value === 'prepared' ? 'بانتظار الاستلام' : row.calculationSnapshot?.reopenedByDocumentId ? 'أعيد فتحه' : 'معكوس'}</span> },
    { key: 'actions', label: '', render: (_value, row) => <div className="flex flex-wrap gap-1">{isPurchase && canReceive && row.status === 'prepared' && <Button size="sm" variant="primary" onClick={(event) => { event.stopPropagation(); setReceiving(row); }}>استلام</Button>}{canReverse && row.status === 'received' && <Button size="sm" variant="ghost" className="border-amber-300 text-amber-700" onClick={(event) => { event.stopPropagation(); setReverseTarget(row); }}>عكس</Button>}{canUndoReverse && row.status === 'reversed' && !row.calculationSnapshot?.reopenedByDocumentId && <Button size="sm" variant="ghost" className="border-blue-300 text-blue-700" onClick={(event) => { event.stopPropagation(); setUndoReverseTarget(row); }}>إلغاء العكس</Button>}</div> },
  ], [canReceive, canReverse, canUndoReverse, isPurchase, lang, periodCustodyBalanceByDocumentId, t]);

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {printPreviewModal}
      {canCreate && (
        <div className="flex flex-wrap justify-start gap-2" role="toolbar" aria-label={isPurchase ? 'إجراءات الطلبات' : 'إجراءات التسجيل الداخلي'}>
          <Button variant="primary" onClick={() => setCreateOpen(true)}>+ {isPurchase ? 'طلب جديد' : 'تسجيل جديد'}</Button>
          {!isPurchase && <Button variant="ghost" className="border-red-300 bg-red-50 text-red-700 hover:bg-red-100" onClick={() => setCancellationOpen(true)}>{t('staffCancellationStart')}</Button>}
        </div>
      )}
      {historyWindowDays && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-center text-[12px] font-semibold text-blue-900">
          يعرض حساب الموظف تسجيلاته الداخلية لآخر {historyWindowDays} أيام فقط.
        </div>
      )}
      {isPurchase ? <OrdersV4PurchaseSummaryCards summary={summary} /> : showOverviewCards ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <OrdersV4Kpi label="عدد التسجيلات" value={summary?.registrationCount ?? 0} />
          <OrdersV4Kpi label="التكلفة المركزية" value={`${v4Number(summary?.registrationTotal)} ر.س`} tone="green" />
          <OrdersV4Kpi label="أسطر التسجيل" value={documents.reduce((sum, row) => sum + row.lines.length, 0)} tone="amber" />
          <OrdersV4Kpi label={t('ordersV4CancellationRecords')} value={summary?.cancellationCount ?? 0} tone="red" />
        </div>
      ) : null}
      {!isPurchase && <div className="w-full rounded-xl border border-noorix-border bg-noorix-bg-muted/35 p-3 sm:max-w-md">
        <OrdersV4Field label="القسم"><OrdersV4Select value={sectionFilter} onChange={(event) => setSectionFilter(event.target.value)}><option value="">كل الأقسام</option>{sections.map((section) => <option key={section.id} value={section.id}>{section.nameAr}</option>)}</OrdersV4Select></OrdersV4Field>
      </div>}
      <OrdersV4Panel
        title={isPurchase ? 'طلبات الشراء — V4' : 'التسجيل الداخلي — V4'}
      >
        <OrdersV4QueryState loading={documentsQuery.isLoading} error={documentsQuery.error as Error | null} />
        {!documentsQuery.isLoading && <SimpleTable columns={columns} data={filteredDocuments} emptyMessage="لا توجد مستندات ضمن الفترة المحددة" tableMinWidth={isPurchase ? 1240 : 980} onRowClick={setViewing} />}
        {!documentsQuery.isLoading && documents.length >= resultLimit && resultLimit < 2000 && <div className="mt-3 flex justify-center"><Button size="sm" variant="ghost" onClick={() => setResultLimit((current) => Math.min(2000, current + 250))}>تحميل 250 سجلًا إضافيًا</Button></div>}
      </OrdersV4Panel>
      {canCreate && <OrdersV4DocumentModal open={createOpen} onClose={() => setCreateOpen(false)} companyId={companyId} documentType={documentType} bootstrap={bootstrap} />}
      {canCreate && !isPurchase && <OrdersV4DocumentModal open={cancellationOpen} onClose={() => setCancellationOpen(false)} companyId={companyId} documentType="registration" registrationEntryType="cancellation" bootstrap={bootstrap} />}
      {canReceive && receiving && <OrdersV4DocumentModal open={!!receiving} onClose={() => setReceiving(null)} companyId={companyId} documentType="purchase" bootstrap={bootstrap} initialDocument={receiving} />}
      <OrdersV4DocumentDetails
        document={viewing}
        canReopen={canReopen}
        onClose={() => setViewing(null)}
        onPrint={printDocument}
        onExport={exportDocument}
        onWhatsApp={sendDocumentWhatsApp}
        onReopen={(document) => {
          setViewing(null);
          setReopenTarget(document);
        }}
      />
      <OrdersV4ReversalConfirmModal
        document={reverseTarget}
        mode="reverse"
        busy={reverseMutation.isPending}
        onClose={() => setReverseTarget(null)}
        onConfirm={async () => {
          if (!reverseTarget) return;
          await reverseMutation.mutateAsync({ id: reverseTarget.id, idempotencyKey: crypto.randomUUID() });
          setReverseTarget(null);
        }}
      />
      <OrdersV4ReopenConfirmModal
        document={reopenTarget}
        busy={reopenMutation.isPending}
        onClose={() => setReopenTarget(null)}
        onConfirm={async () => {
          if (!reopenTarget) return;
          await reopenMutation.mutateAsync({ id: reopenTarget.id, idempotencyKey: crypto.randomUUID() });
          setReopenTarget(null);
        }}
      />
      <OrdersV4ReversalConfirmModal
        document={undoReverseTarget}
        mode="undo"
        busy={undoReverseMutation.isPending}
        onClose={() => setUndoReverseTarget(null)}
        onConfirm={async () => {
          if (!undoReverseTarget) return;
          await undoReverseMutation.mutateAsync({ id: undoReverseTarget.id, idempotencyKey: crypto.randomUUID() });
          setUndoReverseTarget(null);
        }}
      />
    </div>
  );
}

function OrdersV4DocumentModal({ open, onClose, companyId, documentType, registrationEntryType = 'issue', bootstrap, initialDocument }: {
  open: boolean; onClose: () => void; companyId: string; documentType: 'purchase' | 'registration'; registrationEntryType?: 'issue' | 'cancellation'; bootstrap?: OrdersV4Bootstrap; initialDocument?: OrdersV4Document | null;
}) {
  const { t, lang } = useTranslation();
  const createMutation = useCreateOrdersV4Document(companyId);
  const receiveMutation = useReceiveOrdersV4Document(companyId);
  const previewMutation = usePreviewOrdersV4Document(companyId);
  const previewDocument = previewMutation.mutateAsync;
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
  const [purchasePreview, setPurchasePreview] = useState<OrdersV4DocumentPreview | null>(null);
  const [previewState, setPreviewState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const previewRequestId = useRef(0);
  const isPurchase = documentType === 'purchase';
  const isCancellation = !isPurchase && registrationEntryType === 'cancellation';
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

  useEffect(() => {
    const requestId = ++previewRequestId.current;
    if (!open || !isPurchase) {
      setPurchasePreview(null);
      setPreviewState('idle');
      return;
    }
    if (lines.length === 0) {
      setPurchasePreview(null);
      setPreviewState('idle');
      return;
    }
    const valid = lines.every((line) => line.itemId && line.unitId && (line.priceUnitId || line.unitId)
      && Number(line.quantity) > 0 && Number(line.unitPrice || 0) >= 0);
    if (!valid) {
      setPurchasePreview(null);
      setPreviewState('error');
      return;
    }

    setPreviewState('loading');
    const timer = window.setTimeout(() => {
      void previewDocument({
        lines: lines.map((line) => ({
          itemId: line.itemId,
          quantity: line.quantity,
          unitId: line.unitId,
          unitPrice: line.unitPrice || '0',
          priceUnitId: line.priceUnitId || line.unitId,
        })),
      }).then((response) => {
        if (previewRequestId.current !== requestId) return;
        if (!response.data) {
          setPurchasePreview(null);
          setPreviewState('error');
          return;
        }
        setPurchasePreview(response.data);
        setPreviewState('ready');
      }).catch(() => {
        if (previewRequestId.current !== requestId) return;
        setPurchasePreview(null);
        setPreviewState('error');
      });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [isPurchase, lines, open, previewDocument]);

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
    if (isCancellation && lines.some((line) => !line.cancellationReasons?.length || (line.cancellationReasons.includes('other') && !line.cancellationNote?.trim()))) return;
    const payload: OrdersV4DocumentPayload = {
      documentType,
      registrationEntryType: isPurchase ? undefined : registrationEntryType,
      documentDate: date,
      paymentMethod: isPurchase ? paymentMethod : null,
      sectionId: sectionId || null,
      locationId: resolvedLocation,
      pettyCashAmount: isPurchase && paymentMethod === 'custody' ? pettyCashAmount || null : null,
      notes: notes || null,
      idempotencyKey: crypto.randomUUID(),
      lines: lines.map((line) => ({ itemId: line.itemId, quantity: line.quantity, unitId: line.unitId, unitPrice: line.unitPrice || '0', priceUnitId: line.priceUnitId || line.unitId, cancellationReasons: isCancellation ? line.cancellationReasons ?? [] : undefined, cancellationNote: isCancellation ? line.cancellationNote || null : undefined })),
    };
    if (initialDocument) {
      const { documentType: _documentType, ...receiveBody } = payload;
      await receiveMutation.mutateAsync({
        id: initialDocument.id,
        body: { ...receiveBody, revision: initialDocument.revision } as OrdersV4ReceivePayload,
      });
    } else {
      const response = await createMutation.mutateAsync(payload);
      if (response.data) setSendWhatsAppPrompt(buildOrdersV4WhatsAppText(response.data, lang === 'en' ? 'en' : 'ar'));
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
      title={initialDocument ? `استلام ${initialDocument.documentNumber}` : isPurchase ? 'طلب شراء جديد — طلبات V4' : isCancellation ? t('ordersV4CancellationTitle') : 'تسجيل داخلي جديد — طلبات V4'}
      footer={<div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        {isPurchase && <div data-testid="orders-v4-live-purchase-total" aria-live="polite" className="flex min-h-11 items-center justify-between gap-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 sm:min-w-64">
          <div>
            <div className="text-[11px] font-semibold text-emerald-800">إجمالي الطلب الحالي</div>
            <div className="text-[10px] text-emerald-700">محسوب بنواة التحويلات المركزية</div>
          </div>
          <strong className={`shrink-0 tabular-nums ${previewState === 'error' ? 'text-[12px] text-red-700' : 'text-[20px] text-emerald-950'}`}>
            {previewState === 'loading' ? 'جارٍ الحساب…' : previewState === 'error' ? 'تحقق من الأسطر' : `${v4Number(purchasePreview?.totalAmount ?? 0)} ر.س`}
          </strong>
        </div>}
        <DialogActions className="w-full sm:w-auto" actions={[{ key: 'cancel', label: t('cancel'), onClick: onClose, role: 'cancel' }, { key: 'save', label: initialDocument ? 'تأكيد الاستلام والترحيل' : isPurchase ? 'حفظ طلب الغد' : isCancellation ? t('ordersV4CancellationSaveRecord') : 'حفظ التسجيل الداخلي', onClick: submit, role: isCancellation ? 'danger' : 'save', loading: mutation.isPending, disabled: isPurchase && (lines.length === 0 || previewState !== 'ready') }]} />
      </div>}
    >
      <div className="flex flex-col gap-4">
        {isCancellation && <div className="rounded-xl border border-red-300 bg-red-50 p-3 text-[12px] font-semibold leading-6 text-red-900">{t('ordersV4CancellationIndependentHint')}</div>}
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
          {isPurchase && paymentMethod === 'custody' && <OrdersV4Field label="مبلغ العهدة"><Input type="number" min="0" step="0.01" value={pettyCashAmount} onChange={(event: React.ChangeEvent<HTMLInputElement>) => setPettyCashAmount(event.target.value)} /></OrdersV4Field>}
        </div>
        <div className="rounded-xl border border-noorix-border bg-noorix-bg-muted/30 p-3">
          <div className="mb-3 text-[13px] font-bold">اختر الأصناف</div>
          <OrdersV4DocumentItemPicker items={items} sections={(bootstrap?.sections ?? []).filter((row) => row.isActive)} sectionId={sectionId} onSectionChange={setSectionId} selectedQuantities={selectedQuantities} onSelect={addItem} onRemove={removeItem} sectionLocked={lines.length > 0} />
        </div>
        <div className="rounded-xl border border-noorix-border bg-noorix-bg-muted/30 p-3">
          <div className="mb-3 flex items-center justify-between"><strong className="text-[13px]">الأصناف المضافة</strong><span className="text-[11px] text-noorix-muted">{lines.length} سطر</span></div>
          <OrdersV4DocumentLinesTable
            lines={lines}
            items={items}
            isPurchase={isPurchase}
            isReceiving={!!initialDocument}
            isCancellation={isCancellation}
            onPatch={patchLine}
            onRemove={(key) => setLines((current) => current.filter((row) => row.key !== key))}
          />
        </div>
        <OrdersV4Field label="ملاحظات"><Input multiline rows={3} value={notes} onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => setNotes(event.target.value)} /></OrdersV4Field>
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-[12px] text-blue-800">الإجمالي الظاهر معاينة مباشرة من نواة V4 نفسها؛ عند الحفظ تعيد النواة التحقق والحساب داخل معاملة واحدة قبل اعتماد الطلب.</div>
        <OrdersV4DocumentLineModal
          item={selectedItem}
          isPurchase={isPurchase}
          isReceiving={!!initialDocument}
          isCancellation={isCancellation}
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

function OrdersV4ReversalConfirmModal({
  document,
  mode,
  busy,
  onClose,
  onConfirm,
}: {
  document: OrdersV4Document | null;
  mode: 'reverse' | 'undo';
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
}) {
  const undo = mode === 'undo';
  return <Modal
    open={!!document}
    onClose={onClose}
    size="sm"
    title={undo ? 'تنبيه: إلغاء عكس المستند' : 'تنبيه قبل عكس المستند'}
    footer={<DialogActions actions={[
      { key: 'cancel', label: 'إلغاء', role: 'cancel', onClick: onClose },
      { key: 'confirm', label: undo ? 'تأكيد إلغاء العكس' : 'تأكيد العكس', role: undo ? 'save' : 'danger', onClick: onConfirm, loading: busy },
    ]} />}
  >
    {document && <div className="flex flex-col gap-3">
      <div className={`rounded-xl border p-3 text-[13px] leading-7 ${undo ? 'border-blue-200 bg-blue-50 text-blue-900' : 'border-amber-300 bg-amber-50 text-amber-950'}`}>
        {undo
          ? 'هذه صلاحية للمالك فقط. سيتم إنشاء قيد جديد يلغي أثر قيد العكس ويعيد المستند إلى حالة مستلم، مع بقاء جميع القيود السابقة محفوظة للمراجعة.'
          : 'العكس لا يحذف المستند. سيتم إنشاء قيد عكسي مستقل يعكس أثر المخزون والعهدة والتكلفة، ويبقى المستند وسلسلة القيود محفوظين. يستطيع المالك فقط إلغاء العكس لاحقاً.'}
      </div>
      <div className="grid grid-cols-2 gap-2 rounded-xl bg-noorix-bg-muted p-3 text-[12px]">
        <span>المستند: <b>{document.documentNumber}</b></span>
        <span>الإجمالي: <b>{v4Number(document.documentType === 'registration' ? document.operationalCost : document.totalAmount)} ر.س</b></span>
      </div>
    </div>}
  </Modal>;
}

function OrdersV4ReopenConfirmModal({
  document,
  busy,
  onClose,
  onConfirm,
}: {
  document: OrdersV4Document | null;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
}) {
  return <Modal
    open={!!document}
    onClose={onClose}
    size="sm"
    title="إعادة فتح الطلب للتعديل"
    footer={<DialogActions actions={[
      { key: 'cancel', label: 'إلغاء', role: 'cancel', onClick: onClose },
      { key: 'confirm', label: 'عكس الاستلام وإعادة الفتح', role: 'edit', onClick: onConfirm, loading: busy },
    ]} />}
  >
    {document && <div className="flex flex-col gap-3">
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-[13px] leading-7 text-blue-950">
        سيُعكس أثر الاستلام على المخزون والعهدة والأسعار، ويُحفظ الطلب الحالي كسجل تدقيق، ثم يُنشأ طلب بديل بحالة «بانتظار الاستلام» وبنفس الأصناف ليعدله الكاشير ويستلمه من جديد. العملية متاحة للطلبات المستلمة خلال آخر 7 أيام، ولا يمكن فتح أكثر من طلب للتعديل في الوقت نفسه.
      </div>
      <div className="grid grid-cols-2 gap-2 rounded-xl bg-noorix-bg-muted p-3 text-[12px]">
        <span>الطلب: <b>{document.documentNumber}</b></span>
        <span>الإجمالي: <b>{v4Number(document.totalAmount)} ر.س</b></span>
      </div>
    </div>}
  </Modal>;
}

function OrdersV4DocumentDetails({ document, canReopen, onClose, onPrint, onExport, onWhatsApp, onReopen }: {
  document: OrdersV4Document | null;
  canReopen: boolean;
  onClose: () => void;
  onPrint: (document: OrdersV4Document) => void;
  onExport: (document: OrdersV4Document) => void;
  onWhatsApp: (document: OrdersV4Document) => void;
  onReopen: (document: OrdersV4Document) => void;
}) {
  const { t, lang } = useTranslation();
  const columns: SimpleTableColumn<OrdersV4Document['lines'][number]>[] = [
    ...(document?.registrationEntryType === 'cancellation' ? [{
      key: 'cancellationReasons',
      label: t('ordersV4CancellationReasonsPlural'),
      minWidth: 230,
      render: (_value: unknown, row: OrdersV4Document['lines'][number]) => <div className="flex flex-col gap-1"><span>{(row.cancellationReasons ?? []).map((reason) => ordersV4CancellationReasonLabel(reason, t)).join(lang === 'en' ? ', ' : '، ')}</span>{row.cancellationNote && <small className="text-noorix-muted">{row.cancellationNote}</small>}</div>,
    } as SimpleTableColumn<OrdersV4Document['lines'][number]>] : []),
    { key: 'lineNumber', label: '#' },
    { key: 'itemNameSnapshot', label: 'الصنف' },
    { key: 'inputQuantity', label: 'الكمية المدخلة', numeric: true, render: (value, row) => `${v4Number(value, 6)} ${row.inputUnit.nameAr}` },
    { key: 'baseQuantity', label: 'كمية الأساس وقت المستند', numeric: true, render: (value, row) => `${v4Number(value, 6)} ${row.baseUnit.nameAr}` },
    { key: 'unitPrice', label: 'سعر الوحدة', numeric: true, render: (value, row) => `${v4Number(value)} / ${row.priceUnit.nameAr}` },
    { key: document?.documentType === 'registration' ? 'operationalCost' : 'lineTotal', label: document?.documentType === 'registration' ? 'التكلفة' : 'الإجمالي', numeric: true, render: (value) => `${v4Number(value)} ر.س` },
  ];
  const statusLabel = document?.status === 'received'
    ? 'مستلم'
    : document?.status === 'prepared'
      ? 'بانتظار الاستلام'
      : document?.status === 'reversed'
        ? document.calculationSnapshot?.reopenedByDocumentId ? 'أعيد فتحه' : 'معكوس'
        : 'ملغي';
  return <AdaptiveSheet
    open={!!document}
    onClose={onClose}
    size="xl"
    title={document?.documentNumber}
    footer={<DialogActions actions={document ? [
      { key: 'close', label: 'إغلاق', onClick: onClose, role: 'cancel' },
      { key: 'excel', label: 'تصدير Excel', onClick: () => onExport(document) },
      { key: 'print', label: document.documentType === 'registration' ? 'طباعة التسجيل' : 'طباعة الطلب', onClick: () => onPrint(document) },
      { key: 'whatsapp', label: 'واتساب', role: 'save', onClick: () => onWhatsApp(document) },
      ...(canReopen && document.documentType === 'purchase' && document.canReopen
        ? [{ key: 'reopen', label: 'إعادة فتح', role: 'edit' as const, onClick: () => onReopen(document) }]
        : []),
    ] : [{ key: 'close', label: 'إغلاق', onClick: onClose, role: 'cancel' }]} />}
  >
    {document && <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2 rounded-xl bg-noorix-bg-muted p-3 text-[12px] sm:grid-cols-4">
        <span>التاريخ: <b>{v4Date(document.documentDate)}</b></span>
        <span>الحالة: <b>{statusLabel}</b></span>
        <span>{document.documentType === 'registration' ? 'التكلفة' : 'الإجمالي'}: <b>{v4Number(document.documentType === 'registration' ? document.operationalCost : document.totalAmount)} ر.س</b></span>
      </div>
      <SimpleTable columns={columns} data={document.lines} tableMinWidth={760} />
      {document.notes && <div className="rounded-xl border border-noorix-border p-3 text-[12px]"><b>ملاحظات:</b> {document.notes}</div>}
    </div>}
  </AdaptiveSheet>;
}
