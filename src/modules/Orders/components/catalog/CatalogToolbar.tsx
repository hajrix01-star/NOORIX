import React from 'react';
import { useTranslation } from '../../../../i18n/useTranslation';
import { Button, Input, KebabMenu } from '../../../../ui';

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

      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 min-w-0 max-w-full">
        <Input
          type="search"
          value={productSearchQuery}
          onChange={(e: any) => setProductSearchQuery(e.target.value)}
          placeholder={t('ordersSearchProducts')}
          aria-label={t('ordersSearchProducts')}
          className="w-full min-w-0 sm:flex-1 sm:max-w-[280px]"
        />
        <Input
          type="select"
          value={productFilterSection}
          onChange={(e: any) => setProductFilterSection(e.target.value)}
          className="w-full min-w-0 sm:w-auto sm:min-w-[140px]"
          aria-label={t('productSections')}
        >
          <option value="">{t('filterAllSections')}</option>
          <option value="__none__">{t('filterNoSection')}</option>
          {(sections as any[]).map((s: any) => (
            <option key={s.id} value={s.nameAr}>
              {s.nameAr}{s.nameEn ? ` / ${s.nameEn}` : ''}
            </option>
          ))}
        </Input>
        <Input
          type="select"
          value={productFilterCategory}
          onChange={(e: any) => setProductFilterCategory(e.target.value)}
          className="w-full min-w-0 sm:w-auto sm:min-w-[140px]"
          aria-label={t('category')}
        >
          <option value="">{t('filterAllCategories')}</option>
          {(categories as any[]).map((c: any) => (
            <option key={c.id} value={c.id}>{c.nameAr || c.nameEn}</option>
          ))}
        </Input>
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
      </div>
    </div>
  );
}
