import React, { useState } from 'react';
import type { OrdersV4Bootstrap, OrdersV4Item } from '../../../types/api';
import { ScreenTabs } from '../../../ui';
import { OrdersV4Kpi } from '../OrdersV4Shared';
import { useOrdersV4CatalogMutations } from '../useOrdersV4';
import { OrdersV4CatalogItems } from './OrdersV4CatalogItems';
import { OrdersV4CatalogReferences } from './OrdersV4CatalogReferences';
import { OrdersV4ItemCard } from './OrdersV4ItemCard';
import type { OrdersV4CatalogItemKind } from './ordersV4Catalog.utils';

type CatalogTab = 'sections' | 'categories' | 'units' | 'items' | 'recipes' | 'locations';

export function OrdersV4CatalogTab({
  companyId,
  bootstrap,
  canDelete = false,
}: {
  companyId: string;
  bootstrap?: OrdersV4Bootstrap;
  canDelete?: boolean;
}) {
  const [tab, setTab] = useState<CatalogTab>('sections');
  const [activeItem, setActiveItem] = useState<OrdersV4Item | null | undefined>(undefined);
  const [newItemKind, setNewItemKind] = useState<OrdersV4CatalogItemKind>('purchased');
  const mutations = useOrdersV4CatalogMutations(companyId);
  const data = bootstrap;

  if (!data) return null;

  function openItem(id: string) {
    const item = data?.items.find((row) => row.id === id);
    if (item) setActiveItem(item);
  }

  return <div className="flex min-w-0 flex-col gap-4">
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <OrdersV4Kpi label="الأصناف" value={data.items.filter((row) => row.isActive).length} />
      <OrdersV4Kpi label="الوحدات المركزية" value={data.units.filter((row) => row.isActive).length} />
      <OrdersV4Kpi label="نسخ التحويل المنشورة" value={data.conversions.length} tone="green" />
      <OrdersV4Kpi label="الوصفات المنشورة" value={data.recipes.length} tone="amber" />
    </div>

    <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-[12px] leading-6 text-blue-900">
      <b>كتالوج V4 التشغيلي:</b> تجربة إدارة الأصناف المباشرة مع بقاء الوحدات والتحويلات والوصفات والمخزون في النواة المركزية ذات النسخ التاريخية.
    </div>

    <ScreenTabs
      items={[
        { id: 'sections', label: 'الأقسام' },
        { id: 'categories', label: 'الفئات' },
        { id: 'units', label: 'الوحدات والتحويلات' },
        { id: 'items', label: 'الأصناف' },
        { id: 'recipes', label: 'الرسبي' },
        { id: 'locations', label: 'المواقع' },
      ]}
      value={tab}
      onChange={(value) => setTab(value as CatalogTab)}
      variant="segmented"
      segmentedFlat
      contentClassName="pt-3"
    >
      {tab === 'items' ? (
        <OrdersV4CatalogItems
          data={data}
          canDelete={canDelete}
          onAdd={(kind) => { setNewItemKind(kind); setActiveItem(null); }}
          onEdit={setActiveItem}
          onDeactivate={(id) => mutations.deactivate.mutateAsync({ entity: 'item', id })}
        />
      ) : (
        <OrdersV4CatalogReferences
          tab={tab}
          data={data}
          canDelete={canDelete}
          mutations={mutations}
          onOpenItem={openItem}
        />
      )}
    </ScreenTabs>

    {activeItem !== undefined && (
      <OrdersV4ItemCard
        item={activeItem}
        initialKind={activeItem?.itemType ?? newItemKind}
        data={data}
        mutations={mutations}
        onManageCategories={() => { setActiveItem(undefined); setTab('categories'); }}
        onManageUnits={() => { setActiveItem(undefined); setTab('units'); }}
        onClose={() => setActiveItem(undefined)}
      />
    )}
  </div>;
}
