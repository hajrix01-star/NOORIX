import React, { useMemo, useState } from 'react';
import type { OrdersV4Item, OrdersV4Section } from '../../../types/api';
import { Button, Input } from '../../../ui';
import { v4Number } from '../OrdersV4Shared';

export function filterOrdersV4DocumentItems(
  items: OrdersV4Item[],
  sectionId: string,
  search: string,
): OrdersV4Item[] {
  const query = search.trim().toLocaleLowerCase('ar');
  return items.filter((item) => {
    if (sectionId && !item.sections.some(({ section }) => section.id === sectionId)) return false;
    if (!query) return true;
    return [item.nameAr, item.nameEn, item.sku, item.category?.nameAr, item.category?.nameEn]
      .some((value) => String(value ?? '').toLocaleLowerCase('ar').includes(query));
  });
}

export function OrdersV4DocumentItemPicker({
  items,
  sections,
  selectedQuantities,
  onSelect,
}: {
  items: OrdersV4Item[];
  sections: OrdersV4Section[];
  selectedQuantities: Map<string, number>;
  onSelect: (item: OrdersV4Item) => void;
}) {
  const [sectionId, setSectionId] = useState('');
  const [search, setSearch] = useState('');
  const visibleSections = useMemo(
    () => sections.filter((section) => items.some((item) => item.sections.some((entry) => entry.section.id === section.id))),
    [items, sections],
  );
  const filteredItems = useMemo(
    () => filterOrdersV4DocumentItems(items, sectionId, search),
    [items, search, sectionId],
  );

  if (items.length === 0) {
    return <div className="rounded-xl border-2 border-dashed border-noorix-border p-5 text-center text-[13px] text-noorix-muted">لا توجد أصناف مؤهلة لهذا المستند.</div>;
  }

  return (
    <div className="flex flex-col gap-3">
      {visibleSections.length > 0 && (
        <div className="flex flex-wrap gap-1.5" aria-label="تصفية الأصناف حسب القسم">
          <Button
            variant="raw"
            type="button"
            aria-pressed={!sectionId}
            onClick={() => setSectionId('')}
            className={`rounded-xl border px-3 py-1 text-[12px] font-semibold transition-all ${!sectionId ? 'border-noorix-blue bg-noorix-blue text-white shadow-sm' : 'border-noorix-border bg-noorix-surface text-noorix-text hover:border-noorix-blue/50'}`}
          >
            كل الأقسام
          </Button>
          {visibleSections.map((section) => {
            const selected = section.id === sectionId;
            return (
              <Button
                key={section.id}
                variant="raw"
                type="button"
                aria-pressed={selected}
                onClick={() => setSectionId(selected ? '' : section.id)}
                className={`rounded-xl border px-3 py-1 text-[12px] font-semibold transition-all ${selected ? 'border-noorix-blue bg-noorix-blue text-white shadow-sm' : 'border-noorix-border bg-noorix-surface text-noorix-text hover:border-noorix-blue/50'}`}
              >
                {section.nameAr}
              </Button>
            );
          })}
        </div>
      )}

      <Input
        type="search"
        value={search}
        onChange={(event: React.ChangeEvent<HTMLInputElement>) => setSearch(event.target.value)}
        placeholder="ابحث باسم الصنف أو الكود أو الفئة…"
        prefix="⌕"
        className="rounded-xl"
      />

      {filteredItems.length > 0 ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {filteredItems.map((item) => {
            const selectedQuantity = selectedQuantities.get(item.id) ?? 0;
            const selected = selectedQuantity > 0;
            return (
              <Button
                key={item.id}
                variant="raw"
                type="button"
                aria-pressed={selected}
                onClick={() => onSelect(item)}
                className={`relative min-h-[72px] w-full select-none flex-col justify-center gap-1 rounded-xl border p-2 text-center transition-all ${selected ? 'border-noorix-blue bg-blue-50 shadow-md ring-1 ring-noorix-blue/30' : 'border-noorix-border bg-noorix-surface hover:border-noorix-blue/40 hover:shadow-sm'}`}
              >
                {selected && (
                  <span className="absolute start-1 top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-noorix-blue px-1 text-[10px] font-bold leading-none text-white">
                    {v4Number(selectedQuantity, 3)}
                  </span>
                )}
                <span className="px-1 text-[12px] font-semibold leading-snug text-noorix-text">{item.nameAr}</span>
                <span className="text-[10px] text-noorix-muted">{item.category?.nameAr || 'بدون فئة'} · {item.inventoryUnit.nameAr}</span>
              </Button>
            );
          })}
        </div>
      ) : (
        <div className="py-4 text-center text-[13px] text-noorix-muted">لا توجد أصناف مطابقة للبحث.</div>
      )}
    </div>
  );
}
