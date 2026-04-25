import { useCallback, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

/** منطق اختيار التبويب — قابل للاختبار بدون React Router */
export function pickTabFromSearchParams(searchParams, allowedIds, defaultId, paramName, legacyParamName) {
  const get = (k) => searchParams.get(k)?.trim();
  const primary = get(paramName);
  if (primary && allowedIds.includes(primary)) return primary;
  if (legacyParamName) {
    const leg = get(legacyParamName);
    if (leg && allowedIds.includes(leg)) return leg;
  }
  if (allowedIds.includes(defaultId)) return defaultId;
  return allowedIds[0] ?? defaultId;
}

/**
 * Persist the active ScreenTabs tab in the URL as ?{paramName}=… so refresh and shared links keep the tab.
 * The default tab is omitted from the query string for a cleaner URL.
 *
 * @param {readonly string[]} allowedIds
 * @param {string} defaultId
 * @param {string} [paramName='tab'] — use a **screen-specific** name (e.g. `ocrTab`) when `tab` is shared across
 *   the app and other routes may leave `?tab=history` etc.; those values are ignored unless in `allowedIds`.
 * @param {string} [legacyParamName] — optional second key to read (e.g. `tab`) only if its value is in `allowedIds`;
 *   on write, `setTab` always removes `legacyParamName` so stale query keys do not hijack this screen.
 * @returns {[string, (id: string) => void]}
 */
export function useTabSearchParam(allowedIds, defaultId, paramName = 'tab', legacyParamName) {
  const [searchParams, setSearchParams] = useSearchParams();
  const allowedKey = allowedIds.join('\0');

  const resolved = useMemo(
    () => pickTabFromSearchParams(searchParams, allowedIds, defaultId, paramName, legacyParamName),
    [searchParams, paramName, legacyParamName, allowedKey, defaultId, allowedIds],
  );

  const setTab = useCallback(
    (id) => {
      const nextId = allowedIds.includes(id)
        ? id
        : (allowedIds.includes(defaultId) ? defaultId : allowedIds[0]);
      if (!nextId) return;
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (legacyParamName) next.delete(legacyParamName);
          if (nextId === defaultId) next.delete(paramName);
          else next.set(paramName, nextId);
          return next;
        },
        { replace: true },
      );
    },
    [allowedIds, allowedKey, defaultId, paramName, legacyParamName, setSearchParams],
  );

  useEffect(() => {
    const prim = searchParams.get(paramName)?.trim();
    const badPrimary = prim != null && prim !== '' && !allowedIds.includes(prim);
    const leg = legacyParamName ? searchParams.get(legacyParamName)?.trim() : undefined;
    const badLegacy =
      legacyParamName != null &&
      leg != null &&
      leg !== '' &&
      !allowedIds.includes(leg);
    if (!badPrimary && !badLegacy) return;
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (badPrimary) next.delete(paramName);
        if (badLegacy) next.delete(legacyParamName);
        return next;
      },
      { replace: true },
    );
  }, [allowedIds, allowedKey, paramName, legacyParamName, searchParams, setSearchParams]);

  return [resolved, setTab];
}
