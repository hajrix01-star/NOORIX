/**
 * LoadingFallback — مؤشر التحميل للـ Suspense وصفحات الانتظار
 * - يتمركز عمودياً وأفقياً في المساحة المتاحة
 * - يدعم prop fullScreen لملء الشاشة كاملاً
 * - يدعم dark mode عبر CSS variables
 * - spinner بحجم 44px مناسب للجوال
 */
import React from 'react';
import { useTranslation } from '../i18n/useTranslation';
import Spinner from '../ui/Spinner';

export default function LoadingFallback({ fullScreen = false }: any) {
  const { t } = useTranslation();

  return (
    <div className={`flex w-full flex-col items-center justify-center gap-4 p-6 text-noorix-muted ${fullScreen ? 'min-h-screen' : 'min-h-[280px]'}`}>
      <Spinner size="lg" aria-hidden="true" />
      <span className="text-[14px] opacity-80 tracking-[0.01em]">
        {t('loading') || 'جاري التحميل...'}
      </span>
    </div>
  );
}
