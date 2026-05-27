import React, { useState, useRef, useEffect } from 'react';
import { Button } from '../../../ui';

/** علامة ⓘ: التمرير يعرض التعليمات؛ الضغط يثبتها حتى النقر خارجها */
export function OrdersImportHelpTrigger({ t, variant, productType = 'order' }: any) {
  const [hover, setHover] = useState(false);
  const [pinned, setPinned] = useState(false);
  const wrapRef = useRef<any>(null);
  const visible = hover || pinned;

  useEffect(() => {
    if (!pinned) return undefined;
    const onDoc = (e: any) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setPinned(false);
    };
    const t = setTimeout(() => document.addEventListener('mousedown', onDoc), 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener('mousedown', onDoc);
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
        onClick={(e: any) => {
          e.stopPropagation();
          setPinned((p: any) => !p);
        }}
        className="text-[12px] font-semibold py-1.5 px-3 rounded-full"
        style={{
          border: '1px solid var(--noorix-border)',
          background: pinned ? 'var(--noorix-green-12)' : 'var(--noorix-bg-muted)',
        }}
      >
        ⓘ {t('ordersImportHelpBadge')}
      </Button>
      {visible && (
        <div
          role="region"
          aria-label={title}
          className="noorix-print-hide text-[12px] text-noorix-text bg-noorix-surface rounded-xl absolute overflow-y-auto py-[14px] px-4 leading-[1.65] text-start"
          style={{
            top: 'calc(100% + 8px)',
            insetInlineEnd: 0,
            width: 'min(420px, calc(100vw - 24px))',
            maxHeight: 'min(440px, 72vh)',
            zIndex: 50,
            border: '1px solid var(--noorix-border)',
            boxShadow: '0 12px 40px rgba(0,0,0,0.15)',
          }}
          onMouseDown={(e: any) => e.stopPropagation()}
        >
          <div className="font-extrabold text-[13px] mb-[10px]">{title}</div>
          <p className="text-[11px] text-noorix-muted m-0 mb-2">{t('ordersImportHelpHoverHint')}</p>
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
              <p className="text-[11px] text-noorix-muted mt-[10px] mb-0">{t('ordersPresetCatalogHint')}</p>
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
