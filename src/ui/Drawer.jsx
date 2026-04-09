/**
 * Drawer — لوح جانبي بـ Tailwind
 * sizes: sm | md | lg | xl | full
 * side: start | end (RTL-aware)
 */
import React, { useEffect, useCallback, useRef, useId } from 'react';
import { createPortal } from 'react-dom';
import { cn } from './cn';

const SIZE_WIDTH = {
  sm:   'w-[min(100vw,320px)]',
  md:   'w-[min(100vw,400px)]',
  lg:   'w-[min(100vw,560px)]',
  xl:   'w-[min(100vw,920px)]',
  full: 'w-screen',
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

export default function Drawer({
  open,
  onClose,
  title,
  size            = 'md',
  side            = 'start',
  footer,
  closeOnBackdrop = true,
  hideClose       = false,
  className       = '',
  children,
}) {
  const panelRef = useRef(null);
  const titleId  = useId();

  const handleEscape = useCallback((e) => {
    if (e.key === 'Escape') onClose?.();
  }, [onClose]);

  /* 1) إدارة overflow + initial focus */
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    const rafId = requestAnimationFrame(() => {
      if (panelRef.current && !panelRef.current.contains(document.activeElement)) {
        panelRef.current.focus();
      }
    });
    return () => {
      document.body.style.overflow = '';
      cancelAnimationFrame(rafId);
    };
  }, [open]);

  /* 2) مفتاح Escape فقط */
  useEffect(() => {
    if (!open) return;
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open, handleEscape]);

  if (!open) return null;

  const slideClass = side === 'start' ? 'nx-drawer-slide-start' : 'nx-drawer-slide-end';
  const posClass   = side === 'start' ? 'inset-y-0 start-0' : 'inset-y-0 end-0';

  return createPortal(
    <div
      className="fixed inset-0 z-[2000] bg-[rgba(8,16,32,0.5)] backdrop-blur-sm"
      style={{ animation: 'nx-backdrop-in 0.12s ease' }}
      role="presentation"
      onClick={closeOnBackdrop ? onClose : undefined}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        className={cn(
          'absolute flex flex-col h-full',
          'bg-white border border-noorix-border',
          'shadow-[0_0_40px_rgba(10,31,68,0.2)]',
          'focus:outline-none',
          SIZE_WIDTH[size] ?? SIZE_WIDTH.md,
          posClass,
          slideClass,
          'nx-drawer-panel',
          className,
        )}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => { if (e.key === 'Tab') trapFocusIn(panelRef.current, e); }}
      >
        {/* رأس اللوح */}
        {(title || !hideClose) && (
          <div className="flex items-center justify-between gap-3 px-4 py-4 shrink-0 border-b border-noorix-border">
            {title && (
              <h2 id={titleId} className="m-0 text-[16px] font-bold text-noorix-text flex-1 min-w-0">
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
                  <path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            )}
          </div>
        )}

        {/* المحتوى */}
        <div className="flex-1 overflow-y-auto p-4 min-h-0 scrollbar-thin">
          {children}
        </div>

        {/* التذييل */}
        {footer && (
          <div className="flex items-center justify-end gap-2.5 flex-wrap px-4 py-3 shrink-0 border-t border-noorix-border bg-noorix-bg-muted">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
