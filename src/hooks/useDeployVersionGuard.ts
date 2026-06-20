import { useEffect } from 'react';
import { checkAndReloadIfStale } from '../utils/deployVersionGuard';

const CHECK_INTERVAL_MS = 5 * 60 * 1000;

/**
 * يكتشف نشراً جديداً ويعيد تحميل الصفحة مرة واحدة — عند الفتح، عند العودة للتبويب، وكل 5 دقائق.
 */
export function useDeployVersionGuard(enabled = true): void {
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    const run = () => {
      void checkAndReloadIfStale();
    };

    run();

    const onVisibility = () => {
      if (document.visibilityState === 'visible') run();
    };

    document.addEventListener('visibilitychange', onVisibility);
    const intervalId = window.setInterval(run, CHECK_INTERVAL_MS);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.clearInterval(intervalId);
    };
  }, [enabled]);
}
