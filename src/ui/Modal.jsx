/**
 * Modal — مكوّن النافذة المنبثقة الموحّد لنظام نووريكس
 *
 * يُرسَل عبر createPortal → document.body تلقائياً.
 * يدعم: العنوان، الـ footer، الإغلاق بالنقر خارجاً أو Escape.
 *
 * sizes: sm (400px) | md (560px) | lg (720px) | xl (900px) | full
 *
 * الاستخدام:
 *   <Modal open={open} onClose={onClose} title="تعديل الموظف">
 *     <p>محتوى النموذج</p>
 *   </Modal>
 *
 *   <Modal open={open} onClose={onClose} title="حذف؟" size="sm"
 *     footer={
 *       <>
 *         <Button variant="ghost" onClick={onClose}>إلغاء</Button>
 *         <Button variant="danger" onClick={onConfirm}>حذف</Button>
 *       </>
 *     }
 *   >
 *     هل أنت متأكد؟
 *   </Modal>
 */
import React, { useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Button from './Button';

const SIZE_WIDTH = {
  sm:   400,
  md:   560,
  lg:   720,
  xl:   900,
  full: '95vw',
};

/**
 * @param {object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {string} [props.title]
 * @param {'sm'|'md'|'lg'|'xl'|'full'} [props.size='md']
 * @param {React.ReactNode} [props.footer]
 * @param {boolean} [props.closeOnBackdrop=true]
 * @param {boolean} [props.hideClose=false]
 * @param {string} [props.className]
 * @param {React.ReactNode} props.children
 */
export default function Modal({
  open,
  onClose,
  title,
  size            = 'md',
  footer,
  closeOnBackdrop = true,
  hideClose       = false,
  className       = '',
  children,
}) {
  const maxWidth = SIZE_WIDTH[size] ?? SIZE_WIDTH.md;

  const handleEscape = useCallback((e) => {
    if (e.key === 'Escape') onClose?.();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [open, handleEscape]);

  if (!open) return null;

  return createPortal(
    <div
      className="nx-modal-backdrop"
      role="presentation"
      onClick={closeOnBackdrop ? onClose : undefined}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={['nx-modal', className].filter(Boolean).join(' ')}
        style={{ maxWidth: typeof maxWidth === 'number' ? maxWidth : maxWidth }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── رأس النافذة ── */}
        {(title || !hideClose) && (
          <div className="nx-modal__header">
            {title && <h2 className="nx-modal__title">{title}</h2>}
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
