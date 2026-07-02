import React, { useEffect } from 'react';
import { Button } from '../ui';

const TYPE_STYLES = {
  success: {
    background: 'var(--noorix-accent-green, #16a34a)',
    icon: '✓',
  },
  error: {
    background: 'var(--noorix-accent-red, #ef4444)',
    icon: '✕',
  },
  warning: {
    background: 'var(--noorix-accent-amber, #d97706)',
    icon: '⚠',
  },
  info: {
    background: 'var(--noorix-accent-blue, #2563eb)',
    icon: 'ℹ',
  },
};

/**
 * Toast — إشعار طافٍ يدعم: نجاح / خطأ / تحذير / معلومة.
 * يختفي تلقائياً بعد 4 ثوانٍ، وقابل للإغلاق يدوياً.
 * يظهر في الزاوية الصحيحة حسب اتجاه المستند (RTL/LTR).
 */
export default function Toast({ message, type = 'success', visible, onDismiss }: any) {
  useEffect(() => {
    if (!visible || !message) return;
    const timer = setTimeout(() => onDismiss?.(), 4000);
    return () => clearTimeout(timer);
  }, [visible, message, onDismiss]);

  if (!visible || !message) return null;

  const style = TYPE_STYLES[type as keyof typeof TYPE_STYLES] ?? TYPE_STYLES.info;

  return (
    <div
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      className="fixed top-4 end-4 z-[9999] max-w-[min(360px,calc(100vw-32px))] py-[10px] px-[14px] rounded-[10px] font-semibold text-[14px] flex items-start gap-[10px] break-words text-white shadow-[0_4px_16px_rgba(0,0,0,0.18)]"
      style={{
        background: style.background,
      }}
    >
      <span
        aria-hidden="true"
        className="shrink-0 w-[22px] h-[22px] rounded-full flex items-center justify-center text-[12px] font-extrabold mt-px bg-white/20"
      >
        {style.icon}
      </span>

      <span className="flex-1 leading-[1.5]">{message}</span>

      <Button
        className="nx-shell-icon-btn"
        onClick={() => onDismiss?.()}
        aria-label="إغلاق"
      >
        ✕
      </Button>
    </div>
  );
}
