/**
 * Orders — manage catalog: products (variants, import/export, preset) and categories.
 */
import React from 'react';
import { AddSizeModal } from './AddSizeModal';
import { AddPackagingModal } from './AddPackagingModal';
import { Button } from '../../../ui';
import { useItemsManageTab } from '../hooks/useItemsManageTab';
import { ItemsManageTabProductsSection } from './ItemsManageTabProductsSection';
import { ItemsManageTabCategoriesSection } from './ItemsManageTabCategoriesSection';
import { ItemsManageTabSectionsSection } from './ItemsManageTabSectionsSection';

export function ItemsManageTab({ companyId }: any) {
  const ctrl = useItemsManageTab(companyId);
  const { t, activeSubTab, setActiveSubTab, addSizeModal, setAddSizeModal, newSize, setNewSize, handleAddSize, addPackagingModal, setAddPackagingModal, newPackaging, setNewPackaging, handleAddPackaging } = ctrl;

  return (
    <div className="flex flex-col gap-4">
      <AddSizeModal visible={addSizeModal} onClose={() => setAddSizeModal(false)} value={newSize} onChange={setNewSize} onAdd={handleAddSize} />
      <AddPackagingModal visible={addPackagingModal} onClose={() => setAddPackagingModal(false)} value={newPackaging} onChange={setNewPackaging} onAdd={handleAddPackaging} />

      <div
        className="inline-flex flex-wrap p-1 gap-0.5 rounded-xl border border-noorix-border bg-noorix-bg-muted/50"
        role="tablist"
      >
        {([
          { id: 'products',       label: t('ordersProducts') },
          { id: 'sales-products', label: t('salesProducts') },
          { id: 'categories',     label: t('ordersCategories') },
          { id: 'sections',       label: t('ordersSections') },
        ] as const).map(({ id, label }) => (
          <Button
            key={id}
            type="button"
            variant="raw"
            size="auto"
            role="tab"
            aria-selected={activeSubTab === id}
            onClick={() => setActiveSubTab(id)}
            className={`rounded-lg px-4 py-2 text-sm transition-colors ${
              activeSubTab === id
                ? 'bg-noorix-surface font-bold text-noorix-text shadow-sm ring-1 ring-noorix-border'
                : 'font-medium text-noorix-muted hover:text-noorix-text hover:bg-noorix-bg-surface/60'
            }`}
          >
            {label}
          </Button>
        ))}
      </div>

      {activeSubTab === 'products' && (
        <ItemsManageTabProductsSection ctrl={ctrl} productTypeFilter="order" />
      )}
      {activeSubTab === 'sales-products' && (
        <ItemsManageTabProductsSection ctrl={ctrl} productTypeFilter="sale" />
      )}
      {activeSubTab === 'categories' && <ItemsManageTabCategoriesSection ctrl={ctrl} />}
      {activeSubTab === 'sections' && <ItemsManageTabSectionsSection ctrl={ctrl} />}
    </div>
  );
}
