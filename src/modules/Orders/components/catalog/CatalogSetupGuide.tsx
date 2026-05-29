import React from 'react';
import { Button } from '../../../../ui';

type CatalogSetupGuideProps = {
  t: (key: string, ...args: unknown[]) => string;
  sectionsCount: number;
  categoriesCount: number;
  productsCount: number;
  onGoSections: () => void;
  onGoCategories: () => void;
  onImport: () => void;
  onAddProduct: () => void;
};

export function CatalogSetupGuide({
  t,
  sectionsCount,
  categoriesCount,
  productsCount,
  onGoSections,
  onGoCategories,
  onImport,
  onAddProduct,
}: CatalogSetupGuideProps) {
  const needsSections = sectionsCount === 0;
  const needsCategories = categoriesCount === 0;
  const needsProducts = productsCount === 0;

  if (!needsSections && !needsCategories && !needsProducts) return null;

  const steps = [
    {
      key: 'sections',
      done: !needsSections,
      label: t('ordersSetupStepSections'),
      action: needsSections ? (
        <Button size="sm" variant="primary" onClick={onGoSections}>{t('ordersSetupGoSections')}</Button>
      ) : (
        <span className="text-noorix-green text-[12px] font-semibold">✓</span>
      ),
    },
    {
      key: 'categories',
      done: !needsCategories,
      label: t('ordersSetupStepCategories'),
      action: needsCategories ? (
        <Button size="sm" variant="primary" onClick={onGoCategories} disabled={needsSections}>
          {t('ordersSetupGoCategories')}
        </Button>
      ) : (
        <span className="text-noorix-green text-[12px] font-semibold">✓</span>
      ),
    },
    {
      key: 'products',
      done: !needsProducts,
      label: t('ordersSetupStepProducts'),
      action: needsProducts ? (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="primary" onClick={onAddProduct} disabled={needsSections || needsCategories}>
            + {t('ordersAddProduct')}
          </Button>
          <Button size="sm" variant="ghost" onClick={onImport} disabled={needsSections}>
            {t('import')}
          </Button>
        </div>
      ) : (
        <span className="text-noorix-green text-[12px] font-semibold">✓</span>
      ),
    },
  ];

  return (
    <div className="noorix-surface-card p-4 border-dashed border-noorix-border">
      <h4 className="m-0 mb-1 text-[15px] font-bold text-noorix-text">{t('ordersSetupTitle')}</h4>
      <p className="m-0 mb-4 text-[12px] text-noorix-muted leading-relaxed">{t('ordersSetupHint')}</p>
      <ol className="m-0 p-0 list-none flex flex-col gap-3">
        {steps.map((step, i) => (
          <li
            key={step.key}
            className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg px-3 py-2.5 border ${
              step.done ? 'border-noorix-green/30 bg-noorix-green/5' : 'border-noorix-border bg-noorix-bg-muted/30'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="shrink-0 w-6 h-6 rounded-full bg-noorix-blue/10 text-noorix-blue text-[12px] font-bold flex items-center justify-center">
                {i + 1}
              </span>
              <span className="text-[13px] font-medium text-noorix-text">{step.label}</span>
            </div>
            <div className="shrink-0">{step.action}</div>
          </li>
        ))}
      </ol>
    </div>
  );
}
