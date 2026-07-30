import React, { type ChangeEvent, useMemo, useState } from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { useApp } from '../../../context/AppContext';
import { useToast } from '../../../context/ToastContext';
import { Button, Input, Modal, usePrintPreview } from '../../../ui';
import {
  buildItemsCatalogDocumentHtml,
  filterProductsForCatalogPrint,
  type ItemsCatalogPrintFilters,
} from '../utils/itemsCatalogPrint';
import type { OrderCategory, OrderProduct, OrderProductType, OrderSection } from '../../../types/api';

type Props = {
  open: boolean;
  onClose: () => void;
  companyId: string;
  products: OrderProduct[];
  categories: OrderCategory[];
  sections: OrderSection[];
  productTypeFilter: OrderProductType;
  initialSection?: string;
  initialCategoryId?: string;
  initialSearch?: string;
};

export function ItemsCatalogPrintModal({
  open,
  onClose,
  companyId,
  products,
  categories,
  sections,
  productTypeFilter,
  initialSection = '',
  initialCategoryId = '',
  initialSearch = '',
}: Props) {
  const { t, lang } = useTranslation();
  const { companies = [] } = useApp();
  const { showToast } = useToast();
  const { openPrintPreview, printPreviewModal } = usePrintPreview({
    title: t('ordersPrintCatalog'),
    closeLabel: t('close') || 'Close',
    printLabel: `${t('print')} / PDF`,
  });

  const [printSection, setPrintSection] = useState(initialSection);
  const [printCategory, setPrintCategory] = useState(initialCategoryId);
  const [printSearch, setPrintSearch] = useState(initialSearch);

  React.useEffect(() => {
    if (open) {
      setPrintSection(initialSection);
      setPrintCategory(initialCategoryId);
      setPrintSearch(initialSearch);
    }
  }, [open, initialSection, initialCategoryId, initialSearch]);

  const filters: ItemsCatalogPrintFilters = useMemo(
    () => ({
      section: printSection,
      categoryId: printCategory,
      productType: productTypeFilter,
      search: printSearch,
    }),
    [printSection, printCategory, productTypeFilter, printSearch],
  );

  const matchingProducts = useMemo(
    () => filterProductsForCatalogPrint(products, filters),
    [products, filters],
  );
  const matchCount = matchingProducts.length;
  const reportCoverage = useMemo(() => {
    const variants = matchingProducts.reduce((total, product) => (
      total + (Array.isArray(product.variants) && product.variants.length > 0 ? product.variants.length : 1)
    ), 0);
    const missingCategory = matchingProducts.filter((product) => !product.categoryId).length;
    const missingSection = matchingProducts.filter((product) => !product.sections?.length).length;
    const missingPrice = matchingProducts.filter((product) => {
      const productVariants = Array.isArray(product.variants) ? product.variants : [];
      return productVariants.length > 0
        ? productVariants.every((variant) => Number(variant.lastPrice || 0) <= 0)
        : Number(product.lastPrice || 0) <= 0;
    }).length;
    return { variants, missingCategory, missingSection, missingPrice };
  }, [matchingProducts]);

  const company = useMemo(() => {
    return companies.find((item) => item.id === companyId);
  }, [companies, companyId]);

  const companyName = useMemo(() => {
    const c = company;
    return c?.nameAr || c?.nameEn || '';
  }, [company]);

  const companyLogoUrl = useMemo(() => {
    return String(company?.logoUrl || '').trim();
  }, [company]);

  const unitLabel = (u: string) => {
    const map: Record<string, string> = {
      piece: t('ordersUnitPiece'),
      kg: t('ordersUnitKg'),
      box: t('ordersUnitBox'),
      pack: t('ordersUnitPack'),
      half_pack: t('ordersUnitHalfPack'),
      carton: t('ordersUnitCarton'),
      dozen: t('ordersUnitDozen'),
    };
    return map[u] || u;
  };

  const productTypeLabel =
    productTypeFilter === 'sale' ? t('salesProducts') : t('ordersProducts');

  const catalogOpts = {
    products,
    filters,
    categories,
    sections,
    companyName,
    logoUrl: companyLogoUrl,
    productTypeLabel,
    t,
    unitLabel,
    lang,
  };

  function handlePrintPdf() {
    const result = buildItemsCatalogDocumentHtml(catalogOpts, 'pdf');
    if (result.empty) {
      showToast(t('ordersPrintCatalogEmpty'), 'error');
      return;
    }
    openPrintPreview({ title: result.title, html: result.html });
  }

  return (
    <Modal open={open} onClose={onClose} title={t('ordersItemsReport')} size="md">
      {printPreviewModal}
      <div className="flex flex-col gap-4">
        <p className="m-0 text-[13px] text-noorix-muted leading-[1.5]">
          {t('ordersPrintCatalogHint')}
        </p>

        <Input
          type="search"
          label={t('ordersPrintCatalogSearch')}
          value={printSearch}
          placeholder={t('ordersPrintCatalogSearchPlaceholder')}
          onChange={(event: ChangeEvent<HTMLInputElement>) => setPrintSearch(event.target.value)}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            type="select"
            label={t('ordersPrintCatalogSection')}
            value={printSection}
            onChange={(event: ChangeEvent<HTMLSelectElement>) => setPrintSection(event.target.value)}
          >
            <option value="">{t('filterAllSections')}</option>
            <option value="__none__">{t('filterNoSection')}</option>
            {sections.map((s) => (
              <option key={s.id} value={s.nameAr}>
                {s.nameAr}
                {s.nameEn ? ` / ${s.nameEn}` : ''}
              </option>
            ))}
          </Input>

          <Input
            type="select"
            label={t('category')}
            value={printCategory}
            onChange={(event: ChangeEvent<HTMLSelectElement>) => setPrintCategory(event.target.value)}
          >
            <option value="">{t('filterAllCategories')}</option>
            <option value="__none__">{t('ordersPrintCatalogNoCategory')}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nameAr || c.nameEn}
              </option>
            ))}
          </Input>
        </div>

        <div className="rounded-xl border border-noorix-border bg-noorix-bg-muted p-3">
          <div className="mb-2 text-[12px] font-semibold text-noorix-text">
            {t('ordersPrintCatalogMatchCount').replace('{0}', String(matchCount))}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-noorix-muted">
            <span>{t('ordersPrintCatalogVariantsCount')}: <b className="text-noorix-text">{reportCoverage.variants}</b></span>
            <span>{t('ordersPrintCatalogMissingCategory')}: <b className="text-noorix-text">{reportCoverage.missingCategory}</b></span>
            <span>{t('ordersPrintCatalogMissingSection')}: <b className="text-noorix-text">{reportCoverage.missingSection}</b></span>
            <span>{t('ordersPrintCatalogMissingPrice')}: <b className="text-noorix-text">{reportCoverage.missingPrice}</b></span>
          </div>
        </div>
        <p className="m-0 text-[11px] text-noorix-muted">{t('ordersPrintCatalogPdfHint')}</p>

        <div className="flex gap-2 flex-wrap">
          <Button variant="primary" size="sm" onClick={handlePrintPdf} disabled={matchCount === 0}>
            {t('print')} / PDF
          </Button>
          <Button size="sm" variant="ghost" onClick={onClose}>
            {t('cancel')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
