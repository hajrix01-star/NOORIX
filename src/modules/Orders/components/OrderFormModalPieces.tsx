import React from 'react';
import Decimal from 'decimal.js';
import { ProductSearchInput, type ProductSearchItem } from '../../../components/common/ProductSearchInput';
import { fmt } from '../../../utils/format';
import { AdaptiveSheet, Button, FmtNum, Input } from '../../../ui';
import type { CreateOrderLinePayload, OrderProduct, OrderRecord } from '../../../types/api';

type OrderDraftLine = CreateOrderLinePayload;
type Translation = (key: string) => string;
type OrderSectionOption = {
  id: string;
  nameAr: string;
  nameEn?: string | null;
};

export function PosProductCard({
  product,
  lang,
  qtyInList,
  onTap,
  onRemove,
}: {
  product: OrderProduct;
  lang: string;
  qtyInList: number;
  onTap: () => void;
  onRemove: () => void;
}) {
  const name = lang === 'en' ? (product.nameEn || product.nameAr) : (product.nameAr || product.nameEn);
  const selected = qtyInList > 0;
  const lastPrice = Number(product.lastPrice ?? 0);
  return (
    <div
      onClick={onTap}
      className={`relative rounded-xl border cursor-pointer select-none transition-all p-2 flex flex-col gap-1 min-h-[64px] justify-center
        ${selected
          ? 'border-noorix-blue bg-blue-50 shadow-md ring-1 ring-noorix-blue/30'
          : 'border-noorix-border bg-noorix-surface hover:border-noorix-blue/40 hover:shadow-sm'
        }`}
    >
      {selected && (
        <Button
          variant="raw"
          type="button"
          onClick={(event) => { event.stopPropagation(); onRemove(); }}
          className="absolute top-1 end-1 w-5 h-5 rounded-full bg-noorix-red text-white text-[12px] font-bold flex items-center justify-center leading-none hover:opacity-75 transition-opacity"
          tabIndex={-1}
        >
          x
        </Button>
      )}
      {selected && (
        <span className="absolute top-1 start-1 bg-noorix-blue text-white text-[11px] font-bold rounded-full w-5 h-5 flex items-center justify-center leading-none">
          {qtyInList}
        </span>
      )}
      <div className="text-[12px] font-semibold text-noorix-text leading-snug text-center px-1">{name}</div>
      {lastPrice > 0 && (
        <div className="text-[11px] text-noorix-muted text-center ltr">{fmt(lastPrice)} SR</div>
      )}
    </div>
  );
}

export function OrderSavedSuccess({
  order,
  t,
  onAddNew,
  onClose,
  onWhatsApp,
}: {
  order: OrderRecord;
  t: Translation;
  onAddNew: () => void;
  onClose: () => void;
  onWhatsApp?: (order: OrderRecord) => void;
}) {
  return (
    <AdaptiveSheet open onClose={onClose} size="sm" side="start" hideClose={false}>
      <div className="text-center py-2">
        <div className="mb-3 text-[48px]">✓</div>
        <h3 className="text-[18px] mb-1.5">{t('orderSaved')}</h3>
        <p className="text-[14px] text-noorix-muted mb-4">
          {t('orderNumber')}: <strong className="text-noorix-blue">{order.orderNumber}</strong>
        </p>
        <div className="flex items-center flex-wrap gap-4 justify-center mb-5">
          <div className="text-center">
            <div className="text-[11px] text-noorix-muted">{t('total')}</div>
            <div dir="ltr" className="text-[18px] nx-font-numbers text-noorix-green font-[900]"><FmtNum n={order.totalAmount ?? 0} /> SR</div>
          </div>
        </div>
        <div className="flex flex-col gap-2.5 items-center">
          <Button variant="success" fullWidth onClick={() => onWhatsApp?.(order)}>
            {t('sendWhatsApp')} ← {t('order')}
          </Button>
          <div className="flex gap-2">
            <Button size="sm" onClick={onAddNew}>{t('ordersAddNewOrder')}</Button>
            <Button size="sm" onClick={onClose}>{t('close')}</Button>
          </div>
        </div>
      </div>
    </AdaptiveSheet>
  );
}

export function OrderProductPicker({
  products,
  sections,
  filteredProducts,
  lang,
  sectionFilter,
  productSearch,
  qtyMap,
  t,
  onSectionFilterChange,
  onProductSearchChange,
  onProductTap,
  onProductRemove,
}: {
  products: OrderProduct[];
  sections: OrderSectionOption[];
  filteredProducts: OrderProduct[];
  lang: string;
  sectionFilter: string;
  productSearch: string;
  qtyMap: Map<string, number>;
  t: Translation;
  onSectionFilterChange: (value: string) => void;
  onProductSearchChange: (value: string) => void;
  onProductTap: (product: OrderProduct) => void;
  onProductRemove: (productId: string) => void;
}) {
  return (
    <div className="mb-4">
      <label className="text-[13px] font-bold block mb-2">{t('orderItems')}</label>

      {products.length === 0 ? (
        <div className="p-5 text-center text-noorix-muted text-[13px] border-2 border-dashed border-noorix-border rounded-xl">
          {t('ordersNoProducts')}
        </div>
      ) : (
        <>
          {sections.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              <Button
                variant="raw"
                type="button"
                onClick={() => onSectionFilterChange('')}
                className={`px-3 py-1 rounded-xl text-[12px] font-semibold border transition-all
                  ${!sectionFilter
                    ? 'bg-noorix-blue text-white border-noorix-blue shadow-sm'
                    : 'bg-noorix-surface text-noorix-text border-noorix-border hover:border-noorix-blue/50'}`}
              >
                {t('allSections')}
              </Button>
              {sections.map((section) => {
                const label = lang === 'en' ? (section.nameEn || section.nameAr) : (section.nameAr || section.nameEn);
                return (
                  <Button
                    variant="raw"
                    key={section.id}
                    type="button"
                    onClick={() => onSectionFilterChange(sectionFilter === section.nameAr ? '' : section.nameAr)}
                    className={`px-3 py-1 rounded-xl text-[12px] font-semibold border transition-all
                      ${sectionFilter === section.nameAr
                        ? 'bg-noorix-blue text-white border-noorix-blue shadow-sm'
                        : 'bg-noorix-surface text-noorix-text border-noorix-border hover:border-noorix-blue/50'}`}
                  >
                    {label}
                  </Button>
                );
              })}
            </div>
          )}

          <div className="relative mb-3">
            <Input
              type="search"
              value={productSearch}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) => onProductSearchChange(event.target.value)}
              placeholder={t('staffOrderSearchPlaceholder')}
              prefix="🔍"
              className="rounded-xl ps-9"
            />
          </div>

          {filteredProducts.length > 0 ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-4">
              {filteredProducts.map((product) => (
                <PosProductCard
                  key={product.id}
                  product={product}
                  lang={lang}
                  qtyInList={Math.round(qtyMap.get(product.id) ?? 0)}
                  onTap={() => onProductTap(product)}
                  onRemove={() => onProductRemove(product.id)}
                />
              ))}
            </div>
          ) : (
            <div className="text-center text-noorix-muted text-[13px] py-4">{t('ordersNoSearchResults')}</div>
          )}
        </>
      )}
    </div>
  );
}

export function OrderDraftItemsTable({
  items,
  enrichedItems,
  productsById,
  searchProducts,
  searchProductsById,
  t,
  updateItem,
  updateItems,
  removeItem,
}: {
  items: OrderDraftLine[];
  enrichedItems: Array<OrderDraftLine & { amount: Decimal; product?: OrderProduct }>;
  productsById: Map<string, OrderProduct>;
  searchProducts: ProductSearchItem[];
  searchProductsById: Map<string, ProductSearchItem>;
  t: Translation;
  updateItem: (idx: number, field: keyof OrderDraftLine, value: string) => void;
  updateItems: React.Dispatch<React.SetStateAction<OrderDraftLine[]>>;
  removeItem: (idx: number) => void;
}) {
  if (items.length === 0) return null;

  return (
    <div className="mb-4 overflow-x-auto border border-noorix-border rounded-xl">
      <table className="w-full border-collapse text-[14px]">
        <thead>
          <tr className="bg-noorix-bg-muted border-b-2 border-noorix-border">
            <th className="text-end font-bold py-3 px-3">{t('product')}</th>
            <th className="text-end font-bold py-3 px-3">{t('ordersProductSize')} / {t('ordersProductPackaging')}</th>
            <th className="text-end font-bold py-3 px-3">{t('quantity')}</th>
            <th className="text-end font-bold py-3 px-3">{t('unitPrice')}</th>
            <th className="text-end font-bold py-3 px-3">{t('total')}</th>
            <th className="w-12 py-3 px-1" />
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => (
            <OrderDraftItemRow
              key={idx}
              item={item}
              idx={idx}
              amount={enrichedItems[idx]?.amount ?? new Decimal(0)}
              product={productsById.get(item.productId)}
              searchProducts={searchProducts}
              searchProductsById={searchProductsById}
              t={t}
              updateItem={updateItem}
              updateItems={updateItems}
              removeItem={removeItem}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OrderDraftItemRow({
  item,
  idx,
  amount,
  product,
  searchProducts,
  searchProductsById,
  t,
  updateItem,
  updateItems,
  removeItem,
}: {
  item: OrderDraftLine;
  idx: number;
  amount: Decimal;
  product: OrderProduct | undefined;
  searchProducts: ProductSearchItem[];
  searchProductsById: Map<string, ProductSearchItem>;
  t: Translation;
  updateItem: (idx: number, field: keyof OrderDraftLine, value: string) => void;
  updateItems: React.Dispatch<React.SetStateAction<OrderDraftLine[]>>;
  removeItem: (idx: number) => void;
}) {
  const variantsArr = Array.isArray(product?.variants) ? product.variants : [];
  const sizesArr = product?.sizes ? String(product.sizes).split(/[,،]/).map((value) => value.trim()).filter(Boolean) : [];
  const variantLabel = [item.size, item.packaging, item.unit].filter(Boolean).join(' / ') || '-';

  return (
    <tr className="border-b border-noorix-border hover:bg-noorix-bg-muted/30 transition-colors">
      <td className="py-3 px-3 min-w-[160px]">
        <ProductSearchInput
          products={searchProducts}
          productsById={searchProductsById}
          value={item.productId}
          onChange={(pid: string) => updateItem(idx, 'productId', pid)}
          onSelectProduct={(selection) => {
            updateItems((prev) => {
              const next = [...prev];
              next[idx] = {
                ...next[idx],
                productId: selection.productId,
                size: selection.size || '',
                packaging: selection.packaging || '',
                unit: selection.unit || 'piece',
                unitPrice: selection.unitPrice || next[idx].unitPrice,
              };
              return next;
            });
          }}
          placeholder={t('selectProduct')}
          compact
        />
      </td>
      <td className="py-3 px-3 min-w-[120px]">
        {variantsArr.length > 0 ? (
          <Input
            type="select"
            value={`${item.size || ''}|${item.packaging || ''}|${item.unit || ''}`}
            onChange={(event: React.ChangeEvent<HTMLSelectElement>) => {
              const variant = variantsArr.find((value) => `${value.size || ''}|${value.packaging || ''}|${value.unit || ''}` === event.target.value);
              if (!variant) return;
              updateItems((prev) => {
                const next = [...prev];
                next[idx] = {
                  ...next[idx],
                  size: variant.size || '',
                  packaging: variant.packaging || '',
                  unit: variant.unit || 'piece',
                  unitPrice: variant.lastPrice ? String(variant.lastPrice) : next[idx].unitPrice,
                };
                return next;
              });
            }}
          >
            {variantsArr.map((variant) => (
              <option key={`${variant.size}|${variant.packaging}|${variant.unit}`} value={`${variant.size || ''}|${variant.packaging || ''}|${variant.unit || ''}`}>
                {[variant.size, variant.packaging, variant.unit].filter(Boolean).join(' / ') || '-'}
              </option>
            ))}
          </Input>
        ) : sizesArr.length > 0 ? (
          <Input type="select" value={item.size} onChange={(event: React.ChangeEvent<HTMLSelectElement>) => updateItem(idx, 'size', event.target.value)}>
            <option value="">-</option>
            {sizesArr.map((size) => <option key={size} value={size}>{size}</option>)}
          </Input>
        ) : (
          <span className="text-noorix-muted text-[13px]">{variantLabel}</span>
        )}
      </td>
      <td className="py-3 px-3">
        <Input type="number" min="0" step="0.01" value={item.quantity} onChange={(event: React.ChangeEvent<HTMLInputElement>) => updateItem(idx, 'quantity', event.target.value)} className="w-[80px]" />
      </td>
      <td className="py-3 px-3">
        <Input type="number" min="0" step="0.01" value={item.unitPrice} onChange={(event: React.ChangeEvent<HTMLInputElement>) => updateItem(idx, 'unitPrice', event.target.value)} className="w-[90px]" />
      </td>
      <td className="nx-cell-num font-bold text-noorix-green py-3 px-3 whitespace-nowrap"><FmtNum n={amount} /> SR</td>
      <td className="py-3 px-1">
        <Button size="sm" variant="danger" onClick={() => removeItem(idx)}>x</Button>
      </td>
    </tr>
  );
}
