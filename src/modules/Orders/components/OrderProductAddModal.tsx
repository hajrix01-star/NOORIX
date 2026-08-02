import React from 'react';
import { fmt } from '../../../utils/format';
import { Button, EditableNumberCell, Input, Modal } from '../../../ui';
import type { OrderProduct } from '../../../types/api';
import type { ProductPricedUnitChoice } from '../utils/productUnitConversionModel';

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
  choices,
  t,
  setAddModal,
  onConfirm,
}: {
  addModal: AddModalState;
  productName: string;
  choices: ProductPricedUnitChoice[];
  t: Translation;
  setAddModal: React.Dispatch<React.SetStateAction<AddModalState | null>>;
  onConfirm: () => void;
}) {
  return (
    <Modal open onClose={() => setAddModal(null)} title={productName} size="sm">
      <div className="flex flex-col gap-4 p-1">
        {choices.length > 0 && (
          <Input
            type="select"
            label={t('ordersProductVariants')}
            value={addModal.variantKey}
            onChange={(event: React.ChangeEvent<HTMLSelectElement>) => {
              const key = event.target.value;
              const choice = choices.find((value) => value.key === key);
              if (!choice) return;
              setAddModal((modal) => modal ? {
                ...modal,
                variantKey: key,
                size: choice.size,
                packaging: choice.packaging,
                unit: choice.unit,
                unitPrice: choice.unitPrice,
              } : modal);
            }}
          >
            {choices.map((choice) => (
              <option key={choice.key} value={choice.key}>
                {[choice.size, choice.packaging, choice.unit].filter(Boolean).join(' / ') || choice.unit}
                {choice.unitPrice ? ` - ${fmt(choice.unitPrice)} SR` : ''}
              </option>
            ))}
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
