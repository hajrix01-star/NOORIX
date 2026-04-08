import { useSyncExternalStore } from 'react';

function subscribeMediaQuery(query, onChange) {
  const mq = window.matchMedia(query);
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}

function getMediaQuerySnapshot(query) {
  return window.matchMedia(query).matches;
}

/**
 * @param {string} query استعلام CSS كامل، مثل '(max-width: 700px)'
 */
export function useMediaQuery(query) {
  return useSyncExternalStore(
    (cb) => subscribeMediaQuery(query, cb),
    () => getMediaQuerySnapshot(query),
    () => false,
  );
}

/** محاذاة مع Tailwind: جوال حتى 640px */
export function useIsMobile640() {
  return useMediaQuery('(max-width: 640px)');
}

/** مطابقة SmartTable / SupplierTable السابقة */
export function useIsNarrow700() {
  return useMediaQuery('(max-width: 700px)');
}

/** مطابقة UserMenu السابقة (تابلت صغير) */
export function useIsNarrow768() {
  return useMediaQuery('(max-width: 768px)');
}
