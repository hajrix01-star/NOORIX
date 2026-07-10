/**
 * تسجيل Service Worker مع إعادة تحميل تلقائية عند تفعيل نسخة جديدة.
 */
import { registerSW } from 'virtual:pwa-register';

let refreshingForNewSw = false;

async function clearDevelopmentServiceWorkers(): Promise<void> {
  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
  }

  if (typeof caches !== 'undefined') {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
  }
}

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
  if (import.meta.env.DEV) {
    void clearDevelopmentServiceWorkers();
    return;
  }

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
