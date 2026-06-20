/**
 * تسجيل Service Worker مع إعادة تحميل تلقائية عند تفعيل نسخة جديدة.
 */
import { registerSW } from 'virtual:pwa-register';

let refreshingForNewSw = false;

function listenForServiceWorkerRefresh(): void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshingForNewSw) return;
    refreshingForNewSw = true;
    window.location.reload();
  });
}

export function registerPwa(): void {
  if (typeof window === 'undefined') return;
  listenForServiceWorkerRefresh();

  registerSW({
    immediate: true,
    onRegisterError(error) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('[Noorix PWA] service worker registration failed', error);
      }
    },
  });
}
