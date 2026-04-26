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

export function ItemsManageTab({ companyId }) {
  const ctrl = useItemsManageTab(companyId);
  const { t, activeSubTab, setActiveSubTab, addSizeModal, setAddSizeModal, newSize, setNewSize, handleAddSize, addPackagingModal, setAddPackagingModal, newPackaging, setNewPackaging, handleAddPackaging } = ctrl;

  return (
    <div className="flex flex-col gap-4">
      <AddSizeModal visible={addSizeModal} onClose={() => setAddSizeModal(false)} value={newSize} onChange={setNewSize} onAdd={handleAddSize} />
      <AddPackagingModal visible={addPackagingModal} onClose={() => setAddPackagingModal(false)} value={newPackaging} onChange={setNewPackaging} onAdd={handleAddPackaging} />

      <div
        className="inline-flex p-1 gap-0.5 rounded-xl border border-noorix-border bg-noorix-bg-muted/50"
        role="tablist"
        aria-label={`${t('ordersProducts')} · ${t('ordersCategories')}`}
      >
        <Button
          type="button"
          variant="raw"
          size="auto"
          role="tab"
          aria-selected={activeSubTab === 'products'}
          onClick={() => setActiveSubTab('products')}
          className={`rounded-lg px-4 py-2 text-sm transition-colors ${
            activeSubTab === 'products'
              ? 'bg-noorix-surface font-bold text-noorix-text shadow-sm ring-1 ring-noorix-border'
              : 'font-medium text-noorix-muted hover:text-noorix-text hover:bg-noorix-bg-surface/60'
          }`}
        >
          {t('ordersProducts')}
        </Button>
        <Button
          type="button"
          variant="raw"
          size="auto"
          role="tab"
          aria-selected={activeSubTab === 'categories'}
          onClick={() => setActiveSubTab('categories')}
          className={`rounded-lg px-4 py-2 text-sm transition-colors ${
            activeSubTab === 'categories'
              ? 'bg-noorix-surface font-bold text-noorix-text shadow-sm ring-1 ring-noorix-border'
              : 'font-medium text-noorix-muted hover:text-noorix-text hover:bg-noorix-bg-surface/60'
          }`}
        >
          {t('ordersCategories')}
        </Button>
      </div>

      {activeSubTab === 'products' && <ItemsManageTabProductsSection ctrl={ctrl} />}
      {activeSubTab === 'categories' && <ItemsManageTabCategoriesSection ctrl={ctrl} />}
    </div>
  );
}
