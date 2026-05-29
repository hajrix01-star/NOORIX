import React, { useEffect, useState } from 'react';
import { useTranslation } from '../../../../i18n/useTranslation';
import { AdaptiveSheet, Button, Input } from '../../../../ui';
import { productHasAdvancedVariants } from './catalogProductUtils';

type FormState = {
  id?: string;
  nameAr: string;
  nameEn: string;
  categoryId: string;
  sectionIds: string[];
  productType: 'order' | 'sale';
  simpleLastPrice: string;
  variants: Array<{ size: string; packaging: string; unit: string; lastPrice: string }>;
  _advanced?: boolean;
};

type CatalogProductFormSheetProps = {
  open: boolean;
  mode: 'create' | 'edit';
  productType: 'order' | 'sale';
  form: FormState | null;
  setForm: React.Dispatch<React.SetStateAction<any>>;
  categories: any[];
  sections: any[];
  sizesOptions: any[];
  packagingOptions: any[];
  saving: boolean;
  onClose: () => void;
  onSave: () => void;
  onAddSize: () => void;
  onAddPackaging: () => void;
  addVariant: () => void;
  updateVariant: (idx: number, field: string, value: string) => void;
  removeVariant: (idx: number) => void;
};

function VariantsTable({
  t,
  variants,
  sizesOptions,
  packagingOptions,
  updateVariant,
  removeVariant,
  onAddSize,
  onAddPackaging,
  addVariant,
}: any) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-[12px] text-noorix-muted">{t('ordersProductVariants')}</label>
        <Button size="sm" onClick={addVariant}>+ {t('ordersAddVariant')}</Button>
      </div>
      <div className="rounded-lg border border-noorix-border overflow-x-auto">
        <table className="w-full text-[12px] border-collapse" style={{ minWidth: '400px' }}>
          <thead>
            <tr className="bg-noorix-bg-muted border-b border-noorix-border">
              <th className="font-semibold text-right py-2 px-2.5">{t('ordersProductSize')}</th>
              <th className="font-semibold text-right py-2 px-2.5">{t('ordersProductPackaging')}</th>
              <th className="font-semibold text-right py-2 px-2.5">{t('unit')}</th>
              <th className="font-semibold text-right py-2 px-2.5">{t('ordersVariantPrice')}</th>
              <th className="w-10 py-2 px-1" />
            </tr>
          </thead>
          <tbody>
            {(variants || []).map((v: any, idx: number) => (
              <tr key={idx} className="border-b border-noorix-border">
                <td className="py-1.5 px-2">
                  <div className="flex gap-1">
                    <Input type="select" value={v.size} onChange={(e: any) => updateVariant(idx, 'size', e.target.value)} className="flex-1 min-w-0">
                      <option value="">—</option>
                      {sizesOptions.map((s: any) => (
                        <option key={s.ar} value={s.ar}>{s.ar}</option>
                      ))}
                    </Input>
                    <Button size="sm" onClick={onAddSize} title={t('add')}>+</Button>
                  </div>
                </td>
                <td className="py-1.5 px-2">
                  <div className="flex gap-1">
                    <Input type="select" value={v.packaging} onChange={(e: any) => updateVariant(idx, 'packaging', e.target.value)} className="flex-1 min-w-0">
                      <option value="">—</option>
                      {packagingOptions.map((s: any) => (
                        <option key={s.ar} value={s.ar}>{s.ar}</option>
                      ))}
                    </Input>
                    <Button size="sm" onClick={onAddPackaging} title={t('add')}>+</Button>
                  </div>
                </td>
                <td className="py-1.5 px-2">
                  <Input type="select" value={v.unit} onChange={(e: any) => updateVariant(idx, 'unit', e.target.value)}>
                    <option value="piece">{t('ordersUnitPiece')}</option>
                    <option value="kg">{t('ordersUnitKg')}</option>
                    <option value="box">{t('ordersUnitBox')}</option>
                    <option value="dozen">{t('ordersUnitDozen')}</option>
                  </Input>
                </td>
                <td className="py-1.5 px-2">
                  <Input type="number" min="0" step="0.01" value={v.lastPrice} onChange={(e: any) => updateVariant(idx, 'lastPrice', e.target.value)} className="w-20" />
                </td>
                <td className="py-1.5 px-1">
                  <Button size="sm" variant="danger" onClick={() => removeVariant(idx)}>×</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function CatalogProductFormSheet(props: CatalogProductFormSheetProps) {
  const { t } = useTranslation();
  const {
    open,
    mode,
    productType,
    form,
    setForm,
    categories,
    sections,
    sizesOptions,
    packagingOptions,
    saving,
    onClose,
    onSave,
    onAddSize,
    onAddPackaging,
    addVariant,
    updateVariant,
    removeVariant,
  } = props;

  const [advanced, setAdvanced] = useState(false);

  useEffect(() => {
    if (!open || !form) return;
    setAdvanced(!!form._advanced || productHasAdvancedVariants(form));
  }, [open, form?.id, form?._advanced]);

  if (!form) return null;

  const title = mode === 'edit' ? t('ordersEditProduct') : t('ordersAddProduct');

  function toggleSection(sectionId: string, checked: boolean) {
    setForm((f: FormState) => {
      const cur = Array.isArray(f.sectionIds) ? [...f.sectionIds] : [];
      const next = checked ? [...new Set([...cur, sectionId])] : cur.filter((id) => id !== sectionId);
      return { ...f, sectionIds: next };
    });
  }

  return (
    <AdaptiveSheet
      open={open}
      onClose={onClose}
      title={title}
      size="lg"
      side="start"
      footer={
        <div className="grid grid-cols-2 gap-2 w-full">
          <Button variant="ghost" size="md" onClick={onClose} disabled={saving}>{t('cancel')}</Button>
          <Button variant="primary" size="md" onClick={onSave} loading={saving} disabled={saving}>{t('save')}</Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <Input
          label={`${t('productNameAr')} *`}
          value={form.nameAr}
          onChange={(e: any) => setForm((f: FormState) => ({ ...f, nameAr: e.target.value }))}
        />
        <Input
          label={t('productNameEn')}
          value={form.nameEn}
          onChange={(e: any) => setForm((f: FormState) => ({ ...f, nameEn: e.target.value }))}
        />
        <Input
          type="select"
          label={t('category')}
          value={form.categoryId}
          onChange={(e: any) => setForm((f: FormState) => ({ ...f, categoryId: e.target.value }))}
        >
          <option value="">—</option>
          {categories.map((c: any) => (
            <option key={c.id} value={c.id}>{c.nameAr || c.nameEn}</option>
          ))}
        </Input>

        {(sections as any[]).length > 0 && (
          <div>
            <div className="text-[12px] text-noorix-muted mb-2">{t('productSections')}</div>
            <div className="flex flex-wrap gap-x-3 gap-y-2">
              {(sections as any[]).map((s: any) => (
                <label key={s.id} className="flex items-center gap-1.5 text-[13px] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={(form.sectionIds || []).includes(s.id)}
                    onChange={(e) => toggleSection(s.id, e.target.checked)}
                    className="cursor-pointer"
                  />
                  {s.nameAr}
                </label>
              ))}
            </div>
          </div>
        )}

        {!advanced ? (
          <>
            <Input
              type="number"
              min="0"
              step="0.01"
              label={t('ordersProductSimplePrice')}
              value={form.simpleLastPrice}
              onChange={(e: any) => setForm((f: FormState) => ({ ...f, simpleLastPrice: e.target.value }))}
            />
            <Button size="sm" variant="ghost" onClick={() => setAdvanced(true)}>
              {t('ordersProductAdvanced')}
            </Button>
          </>
        ) : (
          <>
            <VariantsTable
              t={t}
              variants={form.variants}
              sizesOptions={sizesOptions}
              packagingOptions={packagingOptions}
              updateVariant={updateVariant}
              removeVariant={removeVariant}
              onAddSize={onAddSize}
              onAddPackaging={onAddPackaging}
              addVariant={addVariant}
            />
            <Button size="sm" variant="ghost" onClick={() => setAdvanced(false)}>
              {t('ordersProductSimplePrice')}
            </Button>
          </>
        )}
      </div>
    </AdaptiveSheet>
  );
}
