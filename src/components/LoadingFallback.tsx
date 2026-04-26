/**
 * LoadingFallback — مؤشر التحميل للـ Suspense وصفحات الانتظار
 * - يتمركز عمودياً وأفقياً في المساحة المتاحة
 * - يدعم prop fullScreen لملء الشاشة كاملاً
 * - يدعم dark mode عبر CSS variables
 * - spinner بحجم 44px مناسب للجوال
 */
import React from 'react';
import { useTranslation } from '../i18n/useTranslation';

export default function LoadingFallback({ fullScreen = false }) {
  const { t } = useTranslation();

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: fullScreen ? '100vh' : 280,
        gap: 16,
        color: 'var(--noorix-text-muted)',
        fontFamily: 'var(--noorix-font-primary)',
        padding: 24,
        boxSizing: 'border-box',
        width: '100%',
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          border: '3px solid var(--noorix-border)',
          borderTopColor: 'var(--noorix-accent-blue)',
          borderRadius: '50%',
          animation: 'noorix-spin 0.8s linear infinite',
          flexShrink: 0,
        }}
      />
      <span
        style={{
          fontSize: 14,
          letterSpacing: '0.01em',
          opacity: 0.8,
        }}
      >
        {t('loading') || 'جاري التحميل...'}
      </span>
    </div>
  );
}
