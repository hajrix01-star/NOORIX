import React, { useEffect, useMemo, useState } from 'react';
import type { OrdersV4Item, OrdersV4Section } from '../../../types/api';
import { Button, Input } from '../../../ui';
import { useTranslation } from '../../../i18n/useTranslation';
import { OrdersV4Select, v4Number } from '../OrdersV4Shared';
import { ordersV4LocalizedName } from '../ordersV4Localization';

export function filterOrdersV4DocumentItems(
  items: OrdersV4Item[],
  sectionId: string,
  search: string,
  categoryId = '',
): OrdersV4Item[] {
  const query = search.trim().toLocaleLowerCase('ar');
  return items.filter((item) => {
    if (sectionId && !item.sections.some(({ section }) => section.id === sectionId)) return false;
    if (categoryId && item.categoryId !== categoryId) return false;
    if (!query) return true;
    return [item.nameAr, item.nameEn, item.sku, item.category?.nameAr, item.category?.nameEn]
      .some((value) => String(value ?? '').toLocaleLowerCase('ar').includes(query));
  });
}

export function OrdersV4DocumentItemPicker({
  items,
  sections,
  sectionId,
  onSectionChange,
  selectedQuantities,
  onSelect,
  onRemove,
  sectionLocked = false,
}: {
  items: OrdersV4Item[];
  sections: OrdersV4Section[];
  sectionId: string;
  onSectionChange: (sectionId: string) => void;
  selectedQuantities: Map<string, number>;
  onSelect: (item: OrdersV4Item) => void;
  onRemove: (itemId: string) => void;
  sectionLocked?: boolean;
}) {
  const { t, lang } = useTranslation();
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const visibleSections = useMemo(
    () => sections.filter((section) => items.some((item) => item.sections.some((entry) => entry.section.id === section.id))),
    [items, sections],
  );
  const filteredItems = useMemo(
    () => filterOrdersV4DocumentItems(items, sectionId, search, categoryId),
    [categoryId, items, search, sectionId],
  );
  const categories = useMemo(() => [...new Map(items
    .filter((item) => item.category && (!sectionId || item.sections.some((entry) => entry.section.id === sectionId)))
    .map((item) => [item.category!.id, item.category!])).values()].sort((a, b) => ordersV4LocalizedName(a, lang).localeCompare(ordersV4LocalizedName(b, lang), lang)), [items, lang, sectionId]);
  useEffect(() => {
    if (categoryId && !categories.some((category) => category.id === categoryId)) setCategoryId('');
  }, [categories, categoryId]);

  if (items.length === 0) {
    return <div className="rounded-xl border-2 border-dashed border-noorix-border p-5 text-center text-[13px] text-noorix-muted">{t('ordersV4NoEligibleItems')}</div>;
  }

  return (
    <div className="flex flex-col gap-3">
      {visibleSections.length > 0 && (
        <div className="flex flex-wrap gap-1.5" aria-label={t('ordersV4FilterItemsBySection')}>
          <Button
            variant="raw"
            type="button"
            aria-pressed={!sectionId}
            disabled={sectionLocked}
            onClick={() => onSectionChange('')}
            className={`rounded-xl border px-3 py-1 text-[12px] font-semibold transition-all ${!sectionId ? 'border-noorix-blue bg-noorix-blue text-white shadow-sm' : 'border-noorix-border bg-noorix-surface text-noorix-text hover:border-noorix-blue/50'}`}
          >
            {t('ordersV4AllSections')}
          </Button>
          {visibleSections.map((section) => {
            const selected = section.id === sectionId;
            return (
              <Button
                key={section.id}
                variant="raw"
                type="button"
                aria-pressed={selected}
                disabled={sectionLocked && !selected}
                onClick={() => onSectionChange(selected ? '' : section.id)}
                className={`rounded-xl border px-3 py-1 text-[12px] font-semibold transition-all ${selected ? 'border-noorix-blue bg-noorix-blue text-white shadow-sm' : 'border-noorix-border bg-noorix-surface text-noorix-text hover:border-noorix-blue/50'}`}
              >
                {ordersV4LocalizedName(section, lang)}
              </Button>
            );
          })}
        </div>
      )}

      {sectionLocked && <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-[11px] text-blue-800">{t('ordersV4SectionLockedHint')}</div>}

      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_220px]">
        <Input
          type="search"
          value={search}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => setSearch(event.target.value)}
          placeholder={t('ordersV4ItemSearchPlaceholder')}
          prefix="⌕"
          className="rounded-xl"
        />
        <OrdersV4Select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} aria-label={t('ordersV4CategoryFilter')}><option value="">{t('ordersV4AllCategories')}</option>{categories.map((category) => <option key={category.id} value={category.id}>{ordersV4LocalizedName(category, lang)}</option>)}</OrdersV4Select>
      </div>

      {filteredItems.length > 0 ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {filteredItems.map((item) => {
            const selectedQuantity = selectedQuantities.get(item.id) ?? 0;
            const selected = selectedQuantity > 0;
            return (
              <div key={item.id} className="relative">
                <Button
                  variant="raw"
                  type="button"
                  aria-label={ordersV4LocalizedName(item, lang)}
                  aria-pressed={selected}
                  onClick={() => onSelect(item)}
                  className={`relative min-h-[72px] w-full select-none flex-col justify-center gap-1 rounded-xl border p-2 text-center transition-all ${selected ? 'border-noorix-blue bg-blue-50 shadow-md ring-1 ring-noorix-blue/30' : 'border-noorix-border bg-noorix-surface hover:border-noorix-blue/40 hover:shadow-sm'}`}
                >
                  {selected && (
                    <span className="absolute start-1 top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-noorix-green px-1 text-[10px] font-bold leading-none text-white">
                      {v4Number(selectedQuantity, 3)}
                    </span>
                  )}
                  <span className="px-6 text-[12px] font-semibold leading-snug text-noorix-text">{ordersV4LocalizedName(item, lang)}</span>
                  <span className="text-[10px] text-noorix-muted">{item.category ? ordersV4LocalizedName(item.category, lang) : t('ordersV4NoCategory')} · {ordersV4LocalizedName(item.inventoryUnit, lang)}</span>
                </Button>
                {selected && (
                  <Button
                    variant="raw"
                    type="button"
                    aria-label={t('ordersV4RemoveItem', ordersV4LocalizedName(item, lang))}
                    title={t('ordersV4RemoveItem', ordersV4LocalizedName(item, lang))}
                    onClick={() => onRemove(item.id)}
                    className="absolute end-1 top-1 z-10 flex h-5 min-w-5 items-center justify-center rounded-full bg-noorix-red px-1 text-[11px] font-extrabold leading-none text-white hover:opacity-80"
                  >
                    X
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="py-4 text-center text-[13px] text-noorix-muted">{t('ordersV4NoMatchingItems')}</div>
      )}
    </div>
  );
}
