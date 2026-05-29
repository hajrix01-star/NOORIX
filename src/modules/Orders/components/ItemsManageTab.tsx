/**
 * Orders — manage catalog: sections, categories, products (catalog v2).
 */
import React, { useMemo } from 'react';
import { AddSizeModal } from './AddSizeModal';
import { AddPackagingModal } from './AddPackagingModal';
import { ScreenTabs } from '../../../ui';
import { useItemsManageTab } from '../hooks/useItemsManageTab';
import { ItemsManageTabCategoriesSection } from './ItemsManageTabCategoriesSection';
import { ItemsManageTabSectionsSection } from './ItemsManageTabSectionsSection';
import { CatalogProductsPanel } from './catalog/CatalogProductsPanel';

export function ItemsManageTab({ companyId }: { companyId: string }) {
  const ctrl = useItemsManageTab(companyId);
  const {
    t,
    activeSubTab,
    setActiveSubTab,
    addSizeModal,
    setAddSizeModal,
    newSize,
    setNewSize,
    handleAddSize,
    addPackagingModal,
    setAddPackagingModal,
    newPackaging,
    setNewPackaging,
    handleAddPackaging,
  } = ctrl;

  const subTabs = useMemo(() => [
    { id: 'sections', label: t('ordersSections') },
    { id: 'categories', label: t('ordersCategories') },
    { id: 'catalog', label: t('ordersCatalogTab') },
  ], [t]);

  return (
    <div className="flex flex-col gap-4">
      <AddSizeModal visible={addSizeModal} onClose={() => setAddSizeModal(false)} value={newSize} onChange={setNewSize} onAdd={handleAddSize} />
      <AddPackagingModal visible={addPackagingModal} onClose={() => setAddPackagingModal(false)} value={newPackaging} onChange={setNewPackaging} onAdd={handleAddPackaging} />

      <ScreenTabs
        items={subTabs}
        value={activeSubTab}
        onChange={setActiveSubTab}
        shellClassName="nx-items-manage-subtabs"
        contentClassName="nx-tab-content nx-items-manage-subtabs__content pt-3 min-h-[200px] max-sm:px-0 max-sm:pt-2"
      >
        {activeSubTab === 'sections' && <ItemsManageTabSectionsSection ctrl={ctrl} />}
        {activeSubTab === 'categories' && <ItemsManageTabCategoriesSection ctrl={ctrl} />}
        {activeSubTab === 'catalog' && <CatalogProductsPanel ctrl={ctrl} />}
      </ScreenTabs>
    </div>
  );
}
