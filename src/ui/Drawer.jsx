/**
 * Drawer — لوح جانبي موحّد (تفاصيل، معاينة، سجل نشاط)
 *
 * يستخدم نفس منظومة z-index مثل Modal (backdrop / لوحة).
 * الافتراضي `side="start"`: في RTL يفتح من يمين الشاشة (بداية السطر المنطقية).
 */
import React, { useEffect, useCallback, useRef, useId } from 'react';
import { createPortal } from 'react-dom';
import Button from './Button';

/**
 * @param {object} props
 * @param {boolean} props.open
 * @param {()=>void} props.onClose
 * @param {string} [props.title]
 * @param {'sm'|'md'|'lg'|'xl'|'full'} [props.size='md'] — xl يوازي عرض المودال الكبير (تقارير/جداول)
 * @param {'start'|'end'} [props.side='start'] — بداية/نهاية السطر (مناسب لـ RTL)
 * @param {React.ReactNode} [props.footer]
 * @param {boolean} [props.closeOnBackdrop=true]
 * @param {boolean} [props.hideClose=false]
 * @param {string} [props.className] — على لوحة الـ drawer
 * @param {React.ReactNode} props.children
 */
export default function Drawer({
  open,
  onClose,
  title,
  size = 'md',
  side = 'start',
  footer,
  closeOnBackdrop = true,
  hideClose = false,
  className = '',
  children,
}) {
  const panelRef = useRef(null);
  const titleId = useId();

  const handleEscape = useCallback((e) => {
    if (e.key === 'Escape') onClose?.();
  }, [onClose]);

  const trapFocus = useCallback((e) => {
    if (!panelRef.current) return;
    const focusable = panelRef.current.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first) return;
    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last?.focus(); }
    } else {
      if (document.activeElement === last) { e.preventDefault(); first?.focus(); }
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';
    const id = requestAnimationFrame(() => panelRef.current?.focus());
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
      cancelAnimationFrame(id);
    };
  }, [open, handleEscape]);

  if (!open) return null;

  const sizeClass = `nx-drawer--${size}`;
  const sideClass = side === 'end' ? 'nx-drawer-panel--end' : 'nx-drawer-panel--start';

  return createPortal(
    <div
      className="nx-drawer-backdrop"
      role="presentation"
      onClick={closeOnBackdrop ? onClose : undefined}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        className={['nx-drawer-panel', sizeClass, sideClass, className].filter(Boolean).join(' ')}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => { if (e.key === 'Tab') trapFocus(e); }}
      >
        {(title || !hideClose) && (
          <div className="nx-drawer__header">
            {title && (
              <h2 id={titleId} className="nx-drawer__title">
                {title}
              </h2>
            )}
            {!hideClose && (
              <Button
                variant="raw"
                className="nx-drawer__close"
                onClick={onClose}
                aria-label="إغلاق"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </Button>
            )}
          </div>
        )}
        <div className="nx-drawer__body">
          {children}
        </div>
        {footer && (
          <div className="nx-drawer__footer">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
