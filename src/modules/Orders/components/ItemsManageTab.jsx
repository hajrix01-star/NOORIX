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

      <div className="flex gap-2 border-b border-noorix-border">
        <Button
          type="button"
          onClick={() => setActiveSubTab('products')}
          style={{
            borderBottom: activeSubTab === 'products' ? '2px solid var(--noorix-accent-green)' : '2px solid transparent',
            background: activeSubTab === 'products' ? 'var(--noorix-green-7)' : 'transparent',
            fontWeight: activeSubTab === 'products' ? 700 : 500,
            padding: '8px 16px',
            borderRadius: 0,
          }}
        >
          {t('ordersProducts')}
        </Button>
        <Button
          type="button"
          onClick={() => setActiveSubTab('categories')}
          style={{
            borderBottom: activeSubTab === 'categories' ? '2px solid var(--noorix-accent-green)' : '2px solid transparent',
            background: activeSubTab === 'categories' ? 'var(--noorix-green-7)' : 'transparent',
            fontWeight: activeSubTab === 'categories' ? 700 : 500,
            padding: '8px 16px',
            borderRadius: 0,
          }}
        >
          {t('ordersCategories')}
        </Button>
      </div>

      {activeSubTab === 'products' && <ItemsManageTabProductsSection ctrl={ctrl} />}
      {activeSubTab === 'categories' && <ItemsManageTabCategoriesSection ctrl={ctrl} />}
    </div>
  );
}
