import React, { useEffect } from 'react';

/**
 * رسالة طافية: نجاح (أخضر) أو خطأ (أحمر). تختفي تلقائياً بعد 4 ثوانٍ.
 */
export default function Toast({ message, type = 'success', visible, onDismiss }) {
  useEffect(() => {
    if (!visible || !message) return;
    const t = setTimeout(() => onDismiss?.(), 4000);
    return () => clearTimeout(t);
  }, [visible, message, onDismiss]);

  if (!visible || !message) return null;

  const isSuccess = type === 'success';
  return (
    <div
      role="alert"
      aria-live="polite"
      style={{
        position: 'fixed',
        top: 16,
        right: 16,
        left: 'auto',
        maxWidth: 360,
        padding: '12px 16px',
        borderRadius: 8,
        background: isSuccess ? 'var(--noorix-accent-green)' : 'var(--noorix-accent-red, #ef4444)',
        color: '#fff',
        fontWeight: 600,
        fontSize: 14,
        fontFamily: 'var(--noorix-font-primary)',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        zIndex: 9999,
        direction: 'rtl',
      }}
    >
      {message}
    </div>
  );
}
