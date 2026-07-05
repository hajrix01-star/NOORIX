import React from 'react';
import { useTranslation } from '../../../../i18n/useTranslation';
import { Button, FilterToolbar, Input, KebabMenu, SearchableOptionsPicker } from '../../../../ui';

type CatalogToolbarProps = {
  productType: 'order' | 'sale';
  productSearchQuery: string;
  setProductSearchQuery: (v: string) => void;
  productFilterSection: string;
  setProductFilterSection: (v: string) => void;
  productFilterCategory: string;
  setProductFilterCategory: (v: string) => void;
  sections: any[];
  categories: any[];
  filteredCount: number;
  totalCount: number;
  selectedCount: number;
  onAddProduct: () => void;
  onBulkSections: () => void;
  onDeactivateSelected: () => void;
  deactivatePending: boolean;
  onDownloadTemplate: () => void;
  onImport: () => void;
  onExport: () => void;
  onPrintCatalog: () => void;
  onPrintWeekly: () => void;
  onPreset?: () => void;
  presetBusy?: boolean;
  importPending?: boolean;
  exportDisabled?: boolean;
  printDisabled?: boolean;
};

export function CatalogToolbar(props: CatalogToolbarProps) {
  const { t } = useTranslation();
  const {
    productType,
    productSearchQuery,
    setProductSearchQuery,
    productFilterSection,
    setProductFilterSection,
    productFilterCategory,
    setProductFilterCategory,
    sections,
    categories,
    filteredCount,
    totalCount,
    selectedCount,
    onAddProduct,
    onBulkSections,
    onDeactivateSelected,
    deactivatePending,
    onDownloadTemplate,
    onImport,
    onExport,
    onPrintCatalog,
    onPrintWeekly,
    onPreset,
    presetBusy,
    importPending,
    exportDisabled,
    printDisabled,
  } = props;

  const menuItems = [
    { key: 'template', label: t('ordersDownloadImportTemplate'), onClick: onDownloadTemplate },
    { key: 'import', label: t('import'), onClick: onImport, disabled: importPending },
    { key: 'export', label: t('exportExcel'), onClick: onExport, hidden: exportDisabled },
    { key: 'print', label: t('ordersPrintCatalog'), onClick: onPrintCatalog, hidden: printDisabled },
    { key: 'weekly', label: t('ordersPrintWeeklySheet'), onClick: onPrintWeekly, hidden: printDisabled },
    ...(productType === 'order' && onPreset
      ? [{ key: 'preset', label: presetBusy ? t('saving') : t('ordersPresetCatalogButton'), onClick: onPreset, disabled: presetBusy }]
      : []),
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="primary" size="sm" onClick={onAddProduct}>
          + {t('ordersAddProduct')}
        </Button>
        <div className="flex items-center gap-2 flex-wrap">
          {selectedCount > 0 && (
            <>
              <Button size="sm" variant="ghost" onClick={onBulkSections}>
                {t('bulkAssignSections')} ({selectedCount})
              </Button>
              <Button size="sm" variant="danger" onClick={onDeactivateSelected} disabled={deactivatePending}>
                {deactivatePending ? t('saving') : `${t('ordersDeleteSelected')} (${selectedCount})`}
              </Button>
            </>
          )}
          <KebabMenu ariaLabel={t('ordersCatalogTools')} items={menuItems} />
        </div>
      </div>

      <FilterToolbar filtersClassName="gap-2" className="min-w-0 max-w-full">
        <Input
          type="search"
          value={productSearchQuery}
          onChange={(e: any) => setProductSearchQuery(e.target.value)}
          placeholder={t('ordersSearchProducts')}
          aria-label={t('ordersSearchProducts')}
          className="w-full min-w-0 sm:flex-1 sm:max-w-[280px]"
        />
        <div className="w-full min-w-0 sm:w-[min(100%,12rem)]">
          <SearchableOptionsPicker
            allowEmpty
            emptyValue=""
            emptyLabel={t('filterAllSections')}
            value={productFilterSection}
            onChange={setProductFilterSection}
            options={[
              { value: '__none__', label: t('filterNoSection') },
              ...(sections as any[]).map((s: any) => ({
                value: s.nameAr,
                label: `${s.nameAr}${s.nameEn ? ` / ${s.nameEn}` : ''}`,
              })),
            ]}
            aria-label={t('productSections')}
          />
        </div>
        <div className="w-full min-w-0 sm:w-[min(100%,12rem)]">
          <SearchableOptionsPicker
            allowEmpty
            emptyValue=""
            emptyLabel={t('filterAllCategories')}
            value={productFilterCategory}
            onChange={setProductFilterCategory}
            options={(categories as any[]).map((c: any) => ({
              value: c.id,
              label: c.nameAr || c.nameEn || c.id,
            }))}
            aria-label={t('category')}
          />
        </div>
        {(productFilterSection || productFilterCategory) && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => { setProductFilterSection(''); setProductFilterCategory(''); }}
          >
            ✕ {t('clearFilters')}
          </Button>
        )}
        <span className="text-[12px] text-noorix-muted shrink-0 sm:ms-auto">
          {filteredCount} / {totalCount}
        </span>
      </FilterToolbar>
    </div>
  );
}
