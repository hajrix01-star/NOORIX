import React, { type ChangeEvent, useMemo, useState } from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { useApp } from '../../../context/AppContext';
import { useToast } from '../../../context/ToastContext';
import { Button, Input, Modal, usePrintPreview } from '../../../ui';
import { filterProductsForCatalogPrint, type ItemsCatalogPrintFilters } from '../utils/itemsCatalogPrint';
import {
  buildItemsCatalogWeeklyDocumentHtml,
} from '../utils/itemsCatalogWeeklyPrint';
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
};

export function ItemsCatalogWeeklyPrintModal({
  open,
  onClose,
  companyId,
  products,
  categories,
  sections,
  productTypeFilter,
  initialSection = '',
  initialCategoryId = '',
}: Props) {
  const { t, lang } = useTranslation();
  const { companies = [] } = useApp();
  const { showToast } = useToast();
  const { openPrintPreview, printPreviewModal } = usePrintPreview({
    title: t('ordersPrintWeeklySheet'),
    closeLabel: t('close') || 'Close',
    printLabel: `${t('print')} / PDF`,
  });

  const [printSection, setPrintSection] = useState(initialSection);
  const [printCategory, setPrintCategory] = useState(initialCategoryId);

  React.useEffect(() => {
    if (open) {
      setPrintSection(initialSection);
      setPrintCategory(initialCategoryId);
    }
  }, [open, initialSection, initialCategoryId]);

  const filters: ItemsCatalogPrintFilters = useMemo(
    () => ({
      section: printSection,
      categoryId: printCategory,
      productType: productTypeFilter,
    }),
    [printSection, printCategory, productTypeFilter],
  );

  const matchCount = useMemo(
    () => filterProductsForCatalogPrint(products, filters).length,
    [products, filters],
  );

  const company = useMemo(() => {
    return companies.find((item) => item.id === companyId);
  }, [companies, companyId]);

  const companyName = useMemo(() => company?.nameAr || company?.nameEn || '', [company]);
  const companyLogoUrl = useMemo(() => String(company?.logoUrl || '').trim(), [company]);

  const unitLabel = (u: string) => {
    const map: Record<string, string> = {
      piece: t('ordersUnitPiece'),
      kg: t('ordersUnitKg'),
      box: t('ordersUnitBox'),
      pack: t('ordersUnitPack'),
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
    const result = buildItemsCatalogWeeklyDocumentHtml(catalogOpts, 'pdf');
    if (result.empty) {
      showToast(t('ordersPrintCatalogEmpty'), 'error');
      return;
    }
    openPrintPreview({ title: result.title, html: result.html });
  }

  return (
    <Modal open={open} onClose={onClose} title={t('ordersPrintWeeklySheet')} size="sm">
      {printPreviewModal}
      <div className="flex flex-col gap-4">
        <p className="m-0 text-[13px] text-noorix-muted leading-[1.5]">
          {t('ordersPrintWeeklySheetHint')}
        </p>

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
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nameAr || c.nameEn}
            </option>
          ))}
        </Input>

        <div className="text-[12px] text-noorix-muted">
          {t('ordersPrintCatalogMatchCount').replace('{0}', String(matchCount))}
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
