import React from 'react';
import Decimal from 'decimal.js';
import { Badge, Button, Input, TransactionDatePicker, cn } from '../../ui';
import type { OrderProduct, OrderSection, StaffOrder } from '../../types/api';
import {
  defaultVariantModalState,
  type StaffBasketLine,
} from './utils/staffOrderBasketUtils';
import { ProductCard, StaffBasketTable, VariantPickModal } from './StaffOrdersViewParts';
import {
  StaffSaleLogMetrics,
  StaffSentOrderRow,
  StaffSentSaleGroup,
} from './StaffOrdersSentPanels';
import {
  StaffQtyModal,
  StaffWhatsAppPromptModal,
  type StaffQtyModalState,
} from './StaffOrderPanelModals';
import { OrderConfirmModal } from './components/OrderConfirmModal';

type Translate = (key: string, ...args: unknown[]) => string;

export function StaffSectionFilter({
  sections,
  sectionFilter,
  lang,
  setSectionFilter,
  setSearch,
}: {
  sections: OrderSection[];
  sectionFilter: string;
  lang: string;
  setSectionFilter: (value: string) => void;
  setSearch: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {sections.map((section) => {
        const active = sectionFilter === section.nameAr;
        const label = lang === 'en'
          ? (section.nameEn || section.nameAr)
          : (section.nameAr || section.nameEn);
        return (
          <Button
            key={section.id}
            type="button"
            variant="raw"
            size="auto"
            onClick={() => {
              setSectionFilter(active ? '' : section.nameAr);
              setSearch('');
            }}
            className={`px-4 py-2 rounded-xl text-[13px] font-semibold border transition-all
              ${active
                ? 'bg-noorix-blue text-white border-noorix-blue shadow-sm'
                : 'bg-noorix-surface text-noorix-text border-noorix-border hover:border-noorix-blue/50 hover:text-noorix-blue'
              }`}
          >
            {label}
          </Button>
        );
      })}
    </div>
  );
}

export function StaffCancellationModeControl({
  isCancellation,
  t,
  onChange,
}: {
  isCancellation: boolean;
  t: Translate;
  onChange: (entryType: 'issue' | 'cancellation') => void;
}) {
  if (!isCancellation) {
    return (
      <div className="flex justify-end">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="border border-noorix-red/30 text-noorix-red hover:bg-noorix-red/5"
          onClick={() => onChange('cancellation')}
        >
          {t('staffCancellationStart')}
        </Button>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-noorix-red/30 bg-noorix-red/5 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="font-bold text-noorix-red">{t('staffCancellationModeTitle')}</div>
        <Button type="button" variant="ghost" size="sm" onClick={() => onChange('issue')}>
          {t('staffCancellationExit')}
        </Button>
      </div>
      <p className="m-0 text-[12px] leading-relaxed text-noorix-muted">
        {t('staffCancellationModeHint')}
      </p>
    </div>
  );
}

export function StaffProductPicker({
  products,
  lang,
  t,
  search,
  sectionFilter,
  qtyMap,
  freqMap,
  setSearch,
  tapProduct,
  removeProduct,
}: {
  products: OrderProduct[];
  lang: string;
  t: Translate;
  search: string;
  sectionFilter: string;
  qtyMap: Map<string, number>;
  freqMap: Map<string, number>;
  setSearch: (value: string) => void;
  tapProduct: (product: OrderProduct) => void;
  removeProduct: (productId: string) => void;
}) {
  return (
    <>
      <div className="relative">
        <svg className="absolute start-3 top-1/2 -translate-y-1/2 text-noorix-muted" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <Input
          type="search"
          containerClassName="contents"
          className="w-full h-9 rounded-xl border border-noorix-border bg-noorix-surface ps-9 pe-3 text-[13px] text-noorix-text placeholder:text-noorix-muted focus:outline-none focus:ring-1 focus:ring-noorix-blue"
          placeholder={t('staffOrderSearchProduct')}
          value={search}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
        />
      </div>

      {products.length > 0 ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2">
          {products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              lang={lang}
              qty={qtyMap.get(product.id) ?? 0}
              freqCount={freqMap.get(product.id) ?? 0}
              onTap={() => tapProduct(product)}
              onRemove={() => removeProduct(product.id)}
            />
          ))}
        </div>
      ) : (
        sectionFilter && (
          <div className="noorix-surface-card p-8 text-center text-noorix-muted text-[13px]">
            {t('staffOrderNoProducts')}
          </div>
        )
      )}
    </>
  );
}

export function StaffBasketSummary({
  basketLines,
  productsById,
  lang,
  t,
  isSale,
  isCancellation,
  basketLogRef,
  saleDateHint,
  editingQtyId,
  saleDate,
  notes,
  submitting,
  editingId,
  setEditingQtyId,
  setLineQty,
  removeLine,
  setSaleDate,
  setNotes,
  resetForm,
  handleSubmit,
}: {
  basketLines: StaffBasketLine[];
  productsById: Map<string, OrderProduct>;
  lang: string;
  t: Translate;
  isSale: boolean;
  isCancellation: boolean;
  basketLogRef: string | null;
  saleDateHint?: string;
  editingQtyId: string | null;
  saleDate: string;
  notes: string;
  submitting: boolean;
  editingId: string | null;
  setEditingQtyId: (id: string | null) => void;
  setLineQty: (lineId: string, qty: number) => void;
  removeLine: (lineId: string) => void;
  setSaleDate: (value: string) => void;
  setNotes: (value: string) => void;
  resetForm: () => void;
  handleSubmit: () => void;
}) {
  if (basketLines.length === 0) return null;

  return (
    <div className="flex flex-col gap-3 border-t border-noorix-border pt-4">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <div className="flex items-center gap-2 min-w-0">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-noorix-blue shrink-0">
            <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
          </svg>
          <span className="text-[14px] font-bold">
            {isCancellation
              ? t('staffCancellationBasket')
              : isSale
                ? t('staffSaleBasket')
                : t('staffOrderBasket')} ({basketLines.length})
          </span>
        </div>
        {isSale && basketLogRef ? (
          <span className="text-[11px] text-noorix-muted whitespace-nowrap">
            {t('staffSaleLogRef')}:{' '}
            <span className="font-bold text-noorix-blue ltr">{basketLogRef}</span>
          </span>
        ) : null}
      </div>

      <div className="overflow-x-auto -mx-0.5 px-0.5">
        <StaffBasketTable
          basketLines={basketLines}
          productsById={productsById}
          lang={lang}
          t={t}
          showPrices={false}
          editingQtyId={editingQtyId}
          setEditingQtyId={setEditingQtyId}
          setLineQty={setLineQty}
          removeLine={removeLine}
          isCancellation={isCancellation}
        />
      </div>

      <div className="flex flex-col gap-2">
        {isSale && (
          <div className="flex flex-col gap-1.5">
            <TransactionDatePicker
              label={t('staffSaleDate')}
              value={saleDate}
              onValueChange={setSaleDate}
            />
            {saleDateHint ? (
              <div className="rounded-lg border border-noorix-blue/20 bg-noorix-blue/5 px-3 py-2 text-[11px] leading-relaxed text-noorix-muted">
                {saleDateHint}
              </div>
            ) : null}
          </div>
        )}
        <Input label={t('notes')} value={notes} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNotes(e.target.value)} placeholder={t('optional')} />
      </div>

      <div className={cn('gap-2', isSale ? 'flex flex-col' : 'grid grid-cols-2')}>
        {!isSale && (
          <Button variant="ghost" size="md" onClick={resetForm} disabled={submitting}>{t('cancel')}</Button>
        )}
        <Button
          variant={isCancellation ? 'danger' : isSale ? 'success' : 'primary'}
          size="md"
          className={isSale ? 'min-h-[44px] w-full' : undefined}
          onClick={handleSubmit}
          disabled={submitting}
        >
          {submitting
            ? (isSale ? t('staffSaleSaving') : t('saving'))
            : isSale
              ? t(isCancellation ? 'staffCancellationSave' : 'staffSaleSave')
              : editingId
                ? t('staffOrderUpdate')
                : t('staffOrderSubmit')}
        </Button>
        {isSale && (
          <Button variant="ghost" size="sm" className="w-full" onClick={resetForm} disabled={submitting}>
            {t('cancel')}
          </Button>
        )}
      </div>
    </div>
  );
}

export function StaffSentOrdersSection({
  isSale,
  sentOrders,
  sentSaleGroups,
  sentSalesSummary,
  lang,
  t,
  handleResendOrder,
  loadForEdit,
  handleDelete,
  canMutateOrder,
}: {
  isSale: boolean;
  sentOrders: StaffOrder[];
  sentSaleGroups: StaffOrder[][];
  sentSalesSummary: {
    totalQty: number;
    totalAmount: Decimal;
    avgPerOrder: Decimal;
  };
  lang: string;
  t: Translate;
  handleResendOrder: (order: StaffOrder) => void;
  loadForEdit: (order: StaffOrder) => void;
  handleDelete: (order: StaffOrder) => void;
  canMutateOrder?: (order: StaffOrder) => boolean;
}) {
  if (sentOrders.length === 0) return null;

  return (
    <section className="flex flex-col gap-3 pt-4 border-t border-noorix-border">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[14px] font-bold text-noorix-text">
          {isSale ? t('staffSaleMySent') : t('staffOrderMySent')}
        </span>
        <Badge color="green" size="sm">{isSale ? sentSaleGroups.length : sentOrders.length}</Badge>
      </div>
      {isSale && sentSaleGroups.length > 1 && sentSalesSummary.totalQty > 0 ? (
        <StaffSaleLogMetrics
          totalQty={sentSalesSummary.totalQty}
          t={t}
          showDivider={false}
        />
      ) : null}
      {isSale ? (
        <div className="noorix-surface-card overflow-hidden divide-y divide-noorix-border">
          {sentSaleGroups.map((group) => (
            <StaffSentSaleGroup
              key={group[0].logRef || group[0].id}
              orders={group}
              lang={lang}
              t={t}
              onResend={handleResendOrder}
              onEdit={loadForEdit}
              onDelete={handleDelete}
              canMutateOrder={canMutateOrder}
            />
          ))}
        </div>
      ) : sentOrders.map((order) => (
        <StaffSentOrderRow
          key={order.id}
          order={order}
          isSale={isSale}
          lang={lang}
          t={t}
          onResend={handleResendOrder}
          onEdit={undefined}
          onDelete={undefined}
        />
      ))}
    </section>
  );
}

export function StaffOrderPanelDialogs({
  deleteTarget,
  isSale,
  t,
  lang,
  deleteBusy,
  sendWhatsAppPrompt,
  qtyModal,
  variantModal,
  isCancellation,
  setDeleteTarget,
  confirmDelete,
  setSendWhatsAppPrompt,
  openWhatsApp,
  showToast,
  setQtyModal,
  confirmQtyModal,
  setVariantModal,
  confirmVariantModal,
}: {
  deleteTarget: StaffOrder | null;
  isSale: boolean;
  t: Translate;
  lang: string;
  deleteBusy: boolean;
  sendWhatsAppPrompt: string | null;
  qtyModal: StaffQtyModalState | null;
  variantModal: ReturnType<typeof defaultVariantModalState> | null;
  isCancellation: boolean;
  setDeleteTarget: (order: StaffOrder | null) => void;
  confirmDelete: () => void;
  setSendWhatsAppPrompt: (text: string | null) => void;
  openWhatsApp: (text: string) => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
  setQtyModal: (value: StaffQtyModalState | null) => void;
  confirmQtyModal: () => void;
  setVariantModal: (value: ReturnType<typeof defaultVariantModalState> | null) => void;
  confirmVariantModal: () => void;
}) {
  return (
    <>
      <OrderConfirmModal
        open={!!deleteTarget}
        title={t('confirmDelete')}
        message={t(isSale ? 'staffSaleDeleteConfirm' : 'staffOrderDeleteConfirm')}
        confirmLabel={t('delete')}
        cancelLabel={t('cancel')}
        busy={deleteBusy}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
      <StaffWhatsAppPromptModal
        text={sendWhatsAppPrompt}
        isSale={isSale}
        t={t}
        onClose={() => setSendWhatsAppPrompt(null)}
        onConfirm={(text) => {
          openWhatsApp(text);
          setSendWhatsAppPrompt(null);
          showToast(t('staffSaleResent'), 'success');
        }}
      />
      <StaffQtyModal
        qtyModal={qtyModal}
        lang={lang}
        t={t}
        onChange={setQtyModal}
        onClose={() => setQtyModal(null)}
        onConfirm={confirmQtyModal}
        isCancellation={isCancellation}
      />
      {variantModal && (
        <VariantPickModal
          variantModal={variantModal}
          lang={lang}
          t={t}
          onClose={() => setVariantModal(null)}
          onChange={setVariantModal}
          onConfirm={confirmVariantModal}
          isCancellation={isCancellation}
        />
      )}
    </>
  );
}
