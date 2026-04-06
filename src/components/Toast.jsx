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
export default function Toast({ message, type = 'success', visible, onDismiss }) {
  useEffect(() => {
    if (!visible || !message) return;
    const timer = setTimeout(() => onDismiss?.(), 4000);
    return () => clearTimeout(timer);
  }, [visible, message, onDismiss]);

  if (!visible || !message) return null;

  const style = TYPE_STYLES[type] ?? TYPE_STYLES.info;

  return (
    <div
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      style={{
        position: 'fixed',
        top: 16,
        insetInlineEnd: 16,
        maxWidth: 'min(360px, calc(100vw - 32px))',
        padding: '10px 14px',
        borderRadius: 10,
        background: style.background,
        color: '#fff',
        fontWeight: 600,
        fontSize: 14,
        fontFamily: 'var(--noorix-font-primary)',
        boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        direction: 'inherit',
        wordBreak: 'break-word',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          flexShrink: 0,
          width: 22,
          height: 22,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 12,
          fontWeight: 800,
          marginTop: 1,
        }}
      >
        {style.icon}
      </span>

      <span style={{ flex: 1, lineHeight: 1.5 }}>{message}</span>

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
