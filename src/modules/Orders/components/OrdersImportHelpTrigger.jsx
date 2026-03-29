import React, { useState, useRef, useEffect } from 'react';

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
      <button
        type="button"
        className="noorix-btn-nav"
        aria-expanded={visible}
        aria-haspopup="dialog"
        title={t('ordersImportHelpTooltip')}
        onClick={(e) => {
          e.stopPropagation();
          setPinned((p) => !p);
        }}
        style={{
          padding: '6px 12px',
          fontSize: 12,
          borderRadius: 999,
          border: '1px solid var(--noorix-border)',
          background: pinned ? 'rgba(22,163,74,0.12)' : 'var(--noorix-bg-muted)',
          fontWeight: 600,
        }}
      >
        ⓘ {t('ordersImportHelpBadge')}
      </button>
      {visible && (
        <div
          role="dialog"
          aria-label={title}
          className="noorix-print-hide"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            insetInlineEnd: 0,
            width: 'min(420px, calc(100vw - 24px))',
            maxHeight: 'min(440px, 72vh)',
            overflowY: 'auto',
            zIndex: 50,
            padding: '14px 16px',
            borderRadius: 12,
            border: '1px solid var(--noorix-border)',
            background: 'var(--noorix-bg-surface)',
            boxShadow: '0 12px 40px rgba(0,0,0,0.15)',
            fontSize: 12,
            lineHeight: 1.65,
            color: 'var(--noorix-text)',
            textAlign: 'start',
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div style={{ fontWeight: 800, marginBottom: 10, fontSize: 13 }}>{title}</div>
          <p style={{ margin: '0 0 8px', color: 'var(--noorix-text-muted)', fontSize: 11 }}>{t('ordersImportHelpHoverHint')}</p>
          {variant === 'products' ? (
            <>
              <p style={{ margin: '0 0 10px' }}>{t('ordersImportWorkbookNote')}</p>
              <p style={{ margin: '0 0 10px' }}>{t('ordersImportTemplateHintProducts')}</p>
              <ul style={{ margin: 0, paddingInlineStart: 18 }}>
                <li style={{ marginBottom: 6 }}>{t('ordersImportProductsStep1')}</li>
                <li style={{ marginBottom: 6 }}>{t('ordersImportProductsStep2')}</li>
                <li style={{ marginBottom: 6 }}>{t('ordersImportProductsStep3')}</li>
              </ul>
              <p style={{ margin: '10px 0 0', fontSize: 11, color: 'var(--noorix-text-muted)' }}>{t('ordersPresetCatalogHint')}</p>
            </>
          ) : (
            <>
              <p style={{ margin: '0 0 10px' }}>{t('ordersImportWorkbookNote')}</p>
              <p style={{ margin: '0 0 10px' }}>{t('ordersImportTemplateHintCategories')}</p>
              <ul style={{ margin: 0, paddingInlineStart: 18 }}>
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
