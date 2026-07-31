import React, { type ChangeEvent } from 'react';
import { Button, Input } from '../../../ui';
import type { ItemsManageTabController } from '../hooks/useItemsManageTab';
import type { OrderProductUnitConversion } from '../../../types/api';

const unitKindOptions = [
  { value: 'unit', label: 'وحدة' },
  { value: 'package', label: 'تغليف' },
];

function unitLabel(code: string, units: ItemsManageTabController['catalogUnits']) {
  return units.find((unit) => unit.code === code)?.nameAr || code;
}

export function ItemsManageTabConversionsSection({ ctrl }: { ctrl: ItemsManageTabController }) {
  const {
    catalogUnits,
    conversionTemplates,
    newCatalogUnit,
    setNewCatalogUnit,
    newConversionTemplate,
    setNewConversionTemplate,
    handleCreateCatalogUnit,
    handleCreateConversionTemplate,
    addConversionTemplateRow,
    updateConversionTemplateRow,
    removeConversionTemplateRow,
    deleteCatalogUnit,
    deleteConversionTemplate,
  } = ctrl;

  const activeUnits = catalogUnits.filter((unit) => unit.isActive !== false);
  const activeTemplates = conversionTemplates.filter((template) => template.isActive !== false);

  function updateTemplateField<K extends keyof typeof newConversionTemplate>(
    key: K,
    value: typeof newConversionTemplate[K],
  ) {
    setNewConversionTemplate((current) => ({ ...current, [key]: value }));
  }

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[0.9fr_1.1fr]">
      <section className="rounded-xl border border-noorix-border bg-noorix-surface p-4 shadow-sm">
        <div className="mb-4">
          <h3 className="text-[16px] font-bold text-noorix-text">وحدات وتغليف المطاعم</h3>
          <p className="mt-1 text-[13px] text-noorix-muted">
            مصدر واحد للوحدات المستخدمة في الأصناف والرسبي والتحويلات.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_120px_120px_auto]">
          <Input
            value={newCatalogUnit.nameAr}
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              setNewCatalogUnit((current) => ({ ...current, nameAr: event.target.value }))
            }
            placeholder="اسم الوحدة"
          />
          <Input
            value={newCatalogUnit.code || ''}
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              setNewCatalogUnit((current) => ({ ...current, code: event.target.value }))
            }
            placeholder="الكود"
          />
          <Input
            type="select"
            value={newCatalogUnit.kind || 'package'}
            onChange={(event: ChangeEvent<HTMLSelectElement>) =>
              setNewCatalogUnit((current) => ({ ...current, kind: event.target.value }))
            }
          >
            {unitKindOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </Input>
          <Button type="button" size="sm" onClick={() => handleCreateCatalogUnit()}>
            إضافة
          </Button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {activeUnits.map((unit) => (
            <div key={unit.id} className="flex items-center justify-between gap-3 rounded-lg border border-noorix-border bg-noorix-bg-muted/40 px-3 py-2">
              <div className="min-w-0">
                <div className="truncate text-[14px] font-bold text-noorix-text">{unit.nameAr}</div>
                <div className="text-[12px] text-noorix-muted">{unit.code} · {unit.kind === 'unit' ? 'وحدة' : 'تغليف'}</div>
              </div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={unit.isDefault || deleteCatalogUnit.isPending}
                onClick={() => deleteCatalogUnit.mutate(unit.id)}
              >
                حذف
              </Button>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-noorix-border bg-noorix-surface p-4 shadow-sm">
        <div className="mb-4">
          <h3 className="text-[16px] font-bold text-noorix-text">قوالب التحويل</h3>
          <p className="mt-1 text-[13px] text-noorix-muted">
            تحويلات جاهزة قابلة لإعادة الاستخدام، مثل كرتون يساوي 10 علب.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_120px]">
          <Input
            value={newConversionTemplate.nameAr}
            onChange={(event: ChangeEvent<HTMLInputElement>) => updateTemplateField('nameAr', event.target.value)}
            placeholder="اسم القالب"
          />
          <Input
            value={newConversionTemplate.code || ''}
            onChange={(event: ChangeEvent<HTMLInputElement>) => updateTemplateField('code', event.target.value)}
            placeholder="الكود"
          />
        </div>
        <Input
          className="mt-2"
          value={newConversionTemplate.description || ''}
          onChange={(event: ChangeEvent<HTMLInputElement>) => updateTemplateField('description', event.target.value)}
          placeholder="وصف مختصر"
        />

        <div className="mt-3 flex flex-col gap-2">
          {(newConversionTemplate.conversions || []).map((row, index) => (
            <div key={`${index}-${row.fromUnit}-${row.toUnit}`} className="grid grid-cols-1 gap-2 rounded-lg border border-noorix-border bg-noorix-bg-muted/40 p-2 md:grid-cols-[1fr_1fr_120px_44px]">
              <Input
                type="select"
                value={row.fromUnit}
                onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                  updateConversionTemplateRow(index, { fromUnit: event.target.value })
                }
              >
                {activeUnits.map((unit) => (
                  <option key={unit.id} value={unit.code}>{unit.nameAr}</option>
                ))}
              </Input>
              <Input
                type="select"
                value={row.toUnit}
                onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                  updateConversionTemplateRow(index, { toUnit: event.target.value })
                }
              >
                {activeUnits.map((unit) => (
                  <option key={unit.id} value={unit.code}>{unit.nameAr}</option>
                ))}
              </Input>
              <Input
                type="number"
                min="0"
                step="0.001"
                value={String(row.multiplier ?? '')}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  updateConversionTemplateRow(index, { multiplier: event.target.value })
                }
                placeholder="المعامل"
              />
              <Button type="button" size="sm" variant="danger" onClick={() => removeConversionTemplateRow(index)}>
                x
              </Button>
            </div>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="ghost" onClick={addConversionTemplateRow}>
            + معادلة
          </Button>
          <Button type="button" size="sm" onClick={() => handleCreateConversionTemplate()}>
            حفظ القالب
          </Button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-2">
          {activeTemplates.map((template) => {
            const rows = Array.isArray(template.conversions)
              ? template.conversions as OrderProductUnitConversion[]
              : [];
            return (
              <div key={template.id} className="rounded-lg border border-noorix-border bg-noorix-bg-muted/40 px-3 py-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-[14px] font-bold text-noorix-text">{template.nameAr}</div>
                    <div className="text-[12px] text-noorix-muted">{template.code}</div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={template.isDefault || deleteConversionTemplate.isPending}
                    onClick={() => deleteConversionTemplate.mutate(template.id)}
                  >
                    حذف
                  </Button>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5 text-[12px] text-noorix-muted">
                  {rows.map((row, index) => (
                    <span key={`${template.id}-${index}`} className="rounded-full border border-noorix-border bg-white px-2 py-1">
                      {unitLabel(row.fromUnit, activeUnits)} = {row.multiplier} {unitLabel(row.toUnit, activeUnits)}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
