/**
 * Modal — مكوّن النافذة المنبثقة الموحّد لنظام نووريكس
 *
 * المزايا:
 * ─ خلفية معتمة إجبارية مع backdrop-filter blur لعزل بصري كامل
 * ─ z-index system متدرّج (var(--nx-z-backdrop) = 2000)
 * ─ أحجام Responsive بالكامل (CSS classes — لا maxWidth inline)
 * ─ Focus-trap يحبس التنقل بـ Tab داخل النافذة
 * ─ إغلاق بـ Escape أو النقر خارج النافذة
 * ─ منع تمرير الصفحة الخلفية عند الفتح
 * ─ ARIA كاملة (role=dialog, aria-modal, aria-labelledby)
 *
 * الأحجام:
 *   sm (400px) | md (560px) | lg (720px) | xl (920px) | 2xl (1100px) | full (1200px)
 *
 * الأنماط:
 *   default | danger | flush
 *
 * مثال:
 *   <Modal open={open} onClose={onClose} title="تعديل الموظف">
 *     <p>محتوى النموذج</p>
 *   </Modal>
 *
 *   <Modal open={open} onClose={onClose} title="حذف؟" size="sm" variant="danger"
 *     footer={<><Button variant="ghost" onClick={onClose}>إلغاء</Button>
 *               <Button variant="danger" onClick={onConfirm}>حذف</Button></>}
 *   >
 *     هل أنت متأكد؟
 *   </Modal>
 */
import React, { useEffect, useCallback, useRef, useId } from 'react';
import { createPortal } from 'react-dom';
import Button from './Button';

/**
 * @param {object}  props
 * @param {boolean} props.open
 * @param {()=>void} props.onClose
 * @param {string}  [props.title]
 * @param {'sm'|'md'|'lg'|'xl'|'2xl'|'full'} [props.size='md']
 * @param {'default'|'danger'} [props.variant='default']
 * @param {React.ReactNode} [props.footer]
 * @param {boolean} [props.closeOnBackdrop=true]
 * @param {boolean} [props.hideClose=false]
 * @param {string}  [props.className]
 * @param {React.ReactNode} props.children
 */
export default function Modal({
  open,
  onClose,
  title,
  size            = 'md',
  variant         = 'default',
  footer,
  closeOnBackdrop = true,
  hideClose       = false,
  className       = '',
  children,
}) {
  const dialogRef = useRef(null);
  const titleId   = useId();

  /* ── Escape key ── */
  const handleEscape = useCallback((e) => {
    if (e.key === 'Escape') onClose?.();
  }, [onClose]);

  /* ── Focus Trap ── */
  const trapFocus = useCallback((e) => {
    if (!dialogRef.current) return;
    const focusable = dialogRef.current.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusable[0];
    const last  = focusable[focusable.length - 1];
    if (!first) return;
    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last?.focus(); }
    } else {
      if (document.activeElement === last)  { e.preventDefault(); first?.focus(); }
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';

    /* إعطاء focus للحوار عند الفتح */
    const id = requestAnimationFrame(() => dialogRef.current?.focus());

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
      cancelAnimationFrame(id);
    };
  }, [open, handleEscape]);

  if (!open) return null;

  const sizeClass    = `nx-modal--${size}`;
  const variantClass = variant !== 'default' ? `nx-modal--${variant}` : '';

  return createPortal(
    <div
      className="nx-modal-backdrop"
      role="presentation"
      onClick={closeOnBackdrop ? onClose : undefined}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        className={[
          'nx-modal',
          sizeClass,
          variantClass,
          className,
        ].filter(Boolean).join(' ')}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => { if (e.key === 'Tab') trapFocus(e); }}
      >
        {/* ── رأس النافذة ── */}
        {(title || !hideClose) && (
          <div className="nx-modal__header">
            {title && (
              <h2 id={titleId} className="nx-modal__title">
                {title}
              </h2>
            )}
            {!hideClose && (
              <Button
                variant="raw"
                className="nx-modal__close"
                onClick={onClose}
                aria-label="إغلاق"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </Button>
            )}
          </div>
        )}

        {/* ── المحتوى ── */}
        <div className="nx-modal__body">
          {children}
        </div>

        {/* ── التذييل ── */}
        {footer && (
          <div className="nx-modal__footer">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
