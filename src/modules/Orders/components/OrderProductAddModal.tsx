import React from 'react';
import { fmt } from '../../../utils/format';
import { Button, EditableNumberCell, Input, Modal } from '../../../ui';
import type { OrderProduct, OrderProductVariant } from '../../../types/api';
import { charcoalVariantLabel, isCharcoalCatalogProduct } from '../utils/charcoalPackaging';

type SelectableOrderVariant = OrderProductVariant & { _key: string };
type Translation = (key: string) => string;
type AddModalState = {
  product: OrderProduct;
  variantKey: string;
  size: string;
  packaging: string;
  unit: string;
  quantity: string;
  unitPrice: string;
};

export function OrderProductAddModal({
  addModal,
  productName,
  variants,
  sizes,
  t,
  setAddModal,
  onConfirm,
}: {
  addModal: AddModalState;
  productName: string;
  variants: SelectableOrderVariant[];
  sizes: string[];
  t: Translation;
  setAddModal: React.Dispatch<React.SetStateAction<AddModalState | null>>;
  onConfirm: () => void;
}) {
  const charcoalProduct = isCharcoalCatalogProduct(addModal.product);
  return (
    <Modal open onClose={() => setAddModal(null)} title={productName} size="sm">
      <div className="flex flex-col gap-4 p-1">
        {variants.length > 0 && (
          <Input
            type="select"
            label={t('ordersProductVariants')}
            value={addModal.variantKey}
            onChange={(event: React.ChangeEvent<HTMLSelectElement>) => {
              const key = event.target.value;
              const variant = variants.find((value) => value._key === key);
              setAddModal((modal) => modal ? {
                ...modal,
                variantKey: key,
                size: variant?.size || '',
                packaging: variant?.packaging || '',
                unit: variant?.unit || 'piece',
                unitPrice: variant?.lastPrice ? String(variant.lastPrice) : modal.unitPrice,
              } : modal);
            }}
          >
            {variants.map((variant) => (
              <option key={variant._key} value={variant._key}>
                {charcoalProduct
                  ? charcoalVariantLabel(variant)
                  : ([variant.size, variant.packaging, variant.unit].filter(Boolean).join(' / ') || '-')}
                {variant.lastPrice ? ` - ${fmt(variant.lastPrice)} SR` : ''}
              </option>
            ))}
          </Input>
        )}
        {variants.length === 0 && sizes.length > 0 && (
          <Input
            type="select"
            label={t('ordersProductSize')}
            value={addModal.size}
            onChange={(event: React.ChangeEvent<HTMLSelectElement>) => setAddModal((modal) => modal ? { ...modal, size: event.target.value } : modal)}
          >
            <option value="">-</option>
            {sizes.map((size) => <option key={size} value={size}>{size}</option>)}
          </Input>
        )}
        <div className="flex flex-col gap-1">
          <label className="text-[12px] text-noorix-muted">{t('quantity')}</label>
          <div className="flex items-center gap-3 justify-center">
            <Button
              variant="raw"
              type="button"
              onClick={() => setAddModal((modal) => modal ? { ...modal, quantity: String(Math.max(1, Number.parseFloat(modal.quantity || '1') - 1)) } : modal)}
              className="w-9 h-9 rounded-full border-2 border-noorix-border text-[20px] flex items-center justify-center hover:border-noorix-blue"
            >
              -
            </Button>
            <EditableNumberCell
              min="1"
              align="start"
              className="w-16 h-10 text-center text-[18px] font-bold border-2 border-noorix-border rounded-xl bg-noorix-bg focus:outline-none focus:border-noorix-blue"
              value={addModal.quantity}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) => setAddModal((modal) => modal ? { ...modal, quantity: event.target.value } : modal)}
            />
            <Button
              variant="raw"
              type="button"
              onClick={() => setAddModal((modal) => modal ? { ...modal, quantity: String(Number.parseFloat(modal.quantity || '0') + 1) } : modal)}
              className="w-9 h-9 rounded-full border-2 border-noorix-border text-[20px] flex items-center justify-center hover:border-noorix-blue"
            >
              +
            </Button>
          </div>
        </div>
        <Input
          type="number"
          min="0"
          step="0.01"
          label={`${t('unitPrice')} SR`}
          value={addModal.unitPrice}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => setAddModal((modal) => modal ? { ...modal, unitPrice: event.target.value } : modal)}
          placeholder="0.00"
        />
        <div className="grid grid-cols-2 gap-2 pt-1">
          <Button variant="ghost" size="md" onClick={() => setAddModal(null)}>{t('cancel')}</Button>
          <Button variant="success" size="md" onClick={onConfirm}>{t('add')}</Button>
        </div>
      </div>
    </Modal>
  );
}
