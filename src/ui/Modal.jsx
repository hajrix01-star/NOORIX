/**
 * Modal — نافذة منبثقة مركزية بـ Tailwind
 * sizes: sm | md | lg | xl | 2xl | full
 * variants: default | danger
 */
import React, { useEffect, useCallback, useRef, useId } from 'react';
import { createPortal } from 'react-dom';
import { cn } from './cn';
import Button from './Button';

const SIZE_MAX = {
  sm:   'max-w-[min(95vw,400px)]',
  md:   'max-w-[min(95vw,560px)]',
  lg:   'max-w-[min(95vw,720px)]',
  xl:   'max-w-[min(95vw,920px)]',
  '2xl':'max-w-[min(95vw,1100px)]',
  full: 'max-w-[min(95vw,1200px)]',
};

function trapFocusIn(panelEl, e) {
  const focusable = panelEl.querySelectorAll(
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
}

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

  const handleEscape = useCallback((e) => {
    if (e.key === 'Escape') onClose?.();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';
    const rafId = requestAnimationFrame(() => dialogRef.current?.focus());
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
      cancelAnimationFrame(rafId);
    };
  }, [open, handleEscape]);

  if (!open) return null;

  const isDanger = variant === 'danger';

  return createPortal(
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-[rgba(8,16,32,0.55)] backdrop-blur-sm"
      style={{ animation: 'nx-backdrop-in 0.2s ease' }}
      role="presentation"
      onClick={closeOnBackdrop ? onClose : undefined}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        className={cn(
          'relative z-[2001] w-full flex flex-col overflow-hidden',
          'bg-white border border-[rgba(200,215,235,0.8)] rounded-[18px]',
          'shadow-[0_0_0_1px_rgba(200,215,235,0.7),0_4px_16px_rgba(10,31,68,0.08),0_20px_60px_rgba(10,31,68,0.18)]',
          'max-h-[min(92vh,860px)]',
          'nx-modal-animate',
          'focus:outline-none',
          SIZE_MAX[size] ?? SIZE_MAX.md,
          className,
        )}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => { if (e.key === 'Tab') trapFocusIn(dialogRef.current, e); }}
      >
        {/* رأس النافذة */}
        {(title || !hideClose) && (
          <div className={cn(
            'flex items-center justify-between gap-3 px-5 py-4 shrink-0 border-b border-[rgba(200,215,235,0.6)]',
            isDanger && 'bg-red-50 border-b-red-100',
          )}>
            {title && (
              <h2
                id={titleId}
                className={cn('m-0 text-[16px] font-bold flex-1 min-w-0', isDanger ? 'text-noorix-red' : 'text-noorix-text')}
              >
                {title}
              </h2>
            )}
            {!hideClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label="إغلاق"
                className="flex items-center justify-center w-8 h-8 rounded-lg text-noorix-muted hover:bg-noorix-bg-muted hover:text-noorix-text transition-colors shrink-0"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
            )}
          </div>
        )}

        {/* المحتوى */}
        <div className="flex-1 overflow-y-auto p-5 min-h-0 scrollbar-thin">
          {children}
        </div>

        {/* التذييل */}
        {footer && (
          <div className="flex items-center justify-end gap-2.5 flex-wrap px-5 py-3 shrink-0 border-t border-[rgba(200,215,235,0.6)] bg-[#f8fafc]">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
