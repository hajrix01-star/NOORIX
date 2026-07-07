import React, { type MouseEvent, useEffect, useRef, useState } from 'react';
import { Button } from '../../../ui';
import type { OrderProductType } from '../../../types/api';

export function OrdersImportHelpTrigger({
  t,
  variant,
  productType = 'order',
}: {
  t: (key: string) => string;
  variant: 'products' | 'categories';
  productType?: OrderProductType;
}) {
  const [hover, setHover] = useState(false);
  const [pinned, setPinned] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const visible = hover || pinned;

  useEffect(() => {
    if (!pinned) return undefined;
    const onDocumentMouseDown = (event: globalThis.MouseEvent) => {
      if (wrapRef.current && event.target instanceof Node && !wrapRef.current.contains(event.target)) {
        setPinned(false);
      }
    };
    const timer = window.setTimeout(() => document.addEventListener('mousedown', onDocumentMouseDown), 0);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('mousedown', onDocumentMouseDown);
    };
  }, [pinned]);

  const title =
    variant === 'products'
      ? productType === 'sale'
        ? t('ordersImportGuideSaleProductsTitle')
        : t('ordersImportGuideProductsTitle')
      : t('ordersImportGuideCategoriesTitle');

  return (
    <div
      ref={wrapRef}
      className="relative inline-flex items-center"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <Button
        type="button"
        aria-expanded={visible}
        aria-haspopup="dialog"
        title={t('ordersImportHelpTooltip')}
        onClick={(event: MouseEvent<HTMLButtonElement>) => {
          event.stopPropagation();
          setPinned((current) => !current);
        }}
        className={`rounded-full border border-noorix-border px-3 py-1.5 text-[12px] font-semibold ${pinned ? 'bg-[var(--noorix-green-12)]' : 'bg-noorix-bg-muted'}`}
      >
        i {t('ordersImportHelpBadge')}
      </Button>
      {visible && (
        <div
          role="region"
          aria-label={title}
          className="noorix-print-hide absolute end-0 top-[calc(100%+8px)] z-50 max-h-[min(440px,72vh)] w-[min(420px,calc(100vw-24px))] overflow-y-auto rounded-xl border border-noorix-border bg-noorix-surface px-4 py-[14px] text-start text-[12px] leading-[1.65] text-noorix-text shadow-[0_12px_40px_rgba(0,0,0,0.15)]"
          onMouseDown={(event: MouseEvent<HTMLDivElement>) => event.stopPropagation()}
        >
          <div className="mb-[10px] text-[13px] font-extrabold">{title}</div>
          <p className="m-0 mb-2 text-[11px] text-noorix-muted">{t('ordersImportHelpHoverHint')}</p>
          {variant === 'products' ? (
            <>
              <p className="m-0 mb-[10px]">{t('ordersImportWorkbookNote')}</p>
              <p className="m-0 mb-[10px]">
                {productType === 'sale' ? t('ordersImportTemplateHintSaleProducts') : t('ordersImportTemplateHintProducts')}
              </p>
              <ul className="m-0 ps-[18px]">
                <li className="mb-1.5">{t('ordersImportProductsStep1')}</li>
                <li className="mb-1.5">{t('ordersImportProductsStep2')}</li>
                <li className="mb-1.5">{t('ordersImportProductsStep3')}</li>
              </ul>
              <p className="mb-0 mt-[10px] text-[11px] text-noorix-muted">{t('ordersPresetCatalogHint')}</p>
            </>
          ) : (
            <>
              <p className="m-0 mb-[10px]">{t('ordersImportWorkbookNote')}</p>
              <p className="m-0 mb-[10px]">{t('ordersImportTemplateHintCategories')}</p>
              <ul className="m-0 ps-[18px]">
                <li className="mb-1.5">{t('ordersImportCategoriesStep1')}</li>
                <li>{t('ordersImportCategoriesStep2')}</li>
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
