/**
 * LoadingFallback — مؤشر التحميل للـ Suspense
 */
import React from 'react';
import { useTranslation } from '../i18n/useTranslation';

export default function LoadingFallback() {
  const { t } = useTranslation();
  return (
    <div style={{
      padding: 24,
      textAlign: 'center',
      color: 'var(--noorix-text-muted)',
      fontFamily: 'var(--noorix-font-primary)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 12,
    }}>
      <div style={{ width: 32, height: 32, border: '3px solid var(--noorix-border)', borderTopColor: 'var(--noorix-accent-blue)', borderRadius: '50%', animation: 'noorix-spin 0.8s linear infinite' }} />
      <span>{t('loading')}</span>
    </div>
  );
}
