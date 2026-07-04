import { useSyncExternalStore } from 'react';

export const NOORIX_BREAKPOINTS = {
  mobile: 640,
  compactTable: 700,
  tablet: 768,
  adaptiveSheet: 900,
} as const;

function subscribeMediaQuery(query: string, onChange: () => void) {
  const mq = window.matchMedia(query);
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}

function getMediaQuerySnapshot(query: string) {
  return window.matchMedia(query).matches;
}

export function maxWidthQuery(widthPx: number) {
  return `(max-width: ${widthPx}px)`;
}

export function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (cb) => subscribeMediaQuery(query, cb),
    () => getMediaQuerySnapshot(query),
    () => false,
  );
}

export function useMaxWidth(widthPx: number) {
  return useMediaQuery(maxWidthQuery(widthPx));
}

export function useIsMobile640() {
  return useMaxWidth(NOORIX_BREAKPOINTS.mobile);
}

export function useIsNarrow700() {
  return useMaxWidth(NOORIX_BREAKPOINTS.compactTable);
}

export function useIsNarrow768() {
  return useMaxWidth(NOORIX_BREAKPOINTS.tablet);
}

export function useAdaptiveSheetNarrow(breakpointPx: number = NOORIX_BREAKPOINTS.adaptiveSheet) {
  return useMaxWidth(breakpointPx);
}
