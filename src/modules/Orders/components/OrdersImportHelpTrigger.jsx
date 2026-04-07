import React, { useState, useRef, useEffect } from 'react';
import { Button } from '../../../ui';

/** علامة ⓘ: التمرير يعرض التعليمات؛ الضغط يثبتها حتى النقر خارجها */
export function OrdersImportHelpTrigger({ t, variant }) {
  const [hover, setHover] = useState(false);
  const [pinned, setPinned] = useState(false);
  const wrapRef = useRef(null);
  const visible = hover || pinned;

  useEffect(() => {
    if (!pinned) return undefined;
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setPinned(false);
    };
    const t = setTimeout(() => document.addEventListener('mousedown', onDoc), 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener('mousedown', onDoc);
    };
  }, [pinned]);

  const title = variant === 'products' ? t('ordersImportGuideProductsTitle') : t('ordersImportGuideCategoriesTitle');

  return (
    <div
      ref={wrapRef}
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <Button
        type="button"
        aria-expanded={visible}
        aria-haspopup="dialog"
        title={t('ordersImportHelpTooltip')}
        onClick={(e) => {
          e.stopPropagation();
          setPinned((p) => !p);
        }}
        className="text-[12px] font-semibold"
        style={{
          padding: '6px 12px',
          borderRadius: 999,
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
          className="noorix-print-hide text-[12px] text-noorix-text bg-noorix-surface rounded-xl"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            insetInlineEnd: 0,
            width: 'min(420px, calc(100vw - 24px))',
            maxHeight: 'min(440px, 72vh)',
            overflowY: 'auto',
            zIndex: 50,
            padding: '14px 16px',
            border: '1px solid var(--noorix-border)',
            boxShadow: '0 12px 40px rgba(0,0,0,0.15)',
            lineHeight: 1.65,
            textAlign: 'start',
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="font-extrabold text-[13px]" style={{ marginBottom: 10 }}>{title}</div>
          <p className="text-[11px] text-noorix-muted" style={{ margin: '0 0 8px' }}>{t('ordersImportHelpHoverHint')}</p>
          {variant === 'products' ? (
            <>
              <p style={{ margin: '0 0 10px' }}>{t('ordersImportWorkbookNote')}</p>
              <p style={{ margin: '0 0 10px' }}>{t('ordersImportTemplateHintProducts')}</p>
              <ul className="m-0" style={{ paddingInlineStart: 18 }}>
                <li style={{ marginBottom: 6 }}>{t('ordersImportProductsStep1')}</li>
                <li style={{ marginBottom: 6 }}>{t('ordersImportProductsStep2')}</li>
                <li style={{ marginBottom: 6 }}>{t('ordersImportProductsStep3')}</li>
              </ul>
              <p className="text-[11px] text-noorix-muted" style={{ margin: '10px 0 0' }}>{t('ordersPresetCatalogHint')}</p>
            </>
          ) : (
            <>
              <p style={{ margin: '0 0 10px' }}>{t('ordersImportWorkbookNote')}</p>
              <p style={{ margin: '0 0 10px' }}>{t('ordersImportTemplateHintCategories')}</p>
              <ul className="m-0" style={{ paddingInlineStart: 18 }}>
                <li style={{ marginBottom: 6 }}>{t('ordersImportCategoriesStep1')}</li>
                <li>{t('ordersImportCategoriesStep2')}</li>
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
