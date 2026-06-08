import { useCallback, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

function resolveTabId(
  raw: string | undefined | null,
  allowedIds: readonly string[],
  aliases?: Record<string, string>,
): string | null {
  if (!raw) return null;
  if (allowedIds.includes(raw)) return raw;
  const mapped = aliases?.[raw];
  if (mapped && allowedIds.includes(mapped)) return mapped;
  return null;
}

/** منطق اختيار التبويب — قابل للاختبار بدون React Router */
export function pickTabFromSearchParams(
  searchParams: URLSearchParams,
  allowedIds: readonly string[],
  defaultId: string,
  paramName: any = 'tab',
  legacyParamName?: string | null,
  aliases?: Record<string, string>,
) {
  const get = (k: string) => searchParams.get(k)?.trim();
  const primary = resolveTabId(get(paramName), allowedIds, aliases);
  if (primary) return primary;
  if (legacyParamName) {
    const leg = resolveTabId(get(legacyParamName), allowedIds, aliases);
    if (leg) return leg;
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
 * @param {Record<string, string>} [aliases] — short URL keys mapped to allowed tab ids (e.g. `sales` → `sales-report`)
 * @param {{ persistDefault?: boolean }} [options] — when true, keep default tab in the URL too (refresh-safe)
 * @returns {[string, (id: string) => void]}
 */
export function useTabSearchParam(
  allowedIds: readonly string[],
  defaultId: string,
  paramName: any = 'tab',
  legacyParamName?: string | null,
  aliases?: Record<string, string>,
  options?: { persistDefault?: boolean },
) {
  const persistDefault = options?.persistDefault ?? false;
  const [searchParams, setSearchParams] = useSearchParams();
  const allowedKey = allowedIds.join('\0');
  const aliasKey = aliases ? JSON.stringify(aliases) : '';

  const resolved = useMemo(
    () => pickTabFromSearchParams(searchParams, allowedIds, defaultId, paramName, legacyParamName, aliases),
    [searchParams, paramName, legacyParamName, aliasKey, allowedKey, defaultId, allowedIds, aliases],
  );

  const setTab = useCallback(
    (id: string) => {
      const nextId = allowedIds.includes(id)
        ? id
        : (allowedIds.includes(defaultId) ? defaultId : allowedIds[0]);
      if (!nextId) return;
      setSearchParams(
        (prev: any) => {
          const next = new URLSearchParams(prev);
          if (legacyParamName) next.delete(legacyParamName);
          if (nextId === defaultId && !persistDefault) next.delete(paramName);
          else next.set(paramName, nextId);
          return next;
        },
        { replace: true },
      );
    },
    [allowedIds, allowedKey, defaultId, paramName, legacyParamName, persistDefault, setSearchParams],
  );

  useEffect(() => {
    if (!persistDefault) return;
    const prim = searchParams.get(paramName)?.trim();
    if (prim === resolved) return;
    setSearchParams(
      (prev: any) => {
        const next = new URLSearchParams(prev);
        if (legacyParamName) next.delete(legacyParamName);
        next.set(paramName, resolved);
        return next;
      },
      { replace: true },
    );
  }, [persistDefault, resolved, paramName, legacyParamName, searchParams, setSearchParams]);

  useEffect(() => {
    const prim = searchParams.get(paramName)?.trim();
    const badPrimary = prim != null && prim !== '' && !resolveTabId(prim, allowedIds, aliases);
    const leg = legacyParamName ? searchParams.get(legacyParamName)?.trim() : undefined;
    const badLegacy =
      legacyParamName != null &&
      leg != null &&
      leg !== '' &&
      !resolveTabId(leg, allowedIds, aliases);
    if (!badPrimary && !badLegacy) return;
    setSearchParams(
      (prev: any) => {
        const next = new URLSearchParams(prev);
        if (badPrimary) next.delete(paramName);
        if (badLegacy) next.delete(legacyParamName);
        return next;
      },
      { replace: true },
    );
  }, [allowedIds, allowedKey, aliasKey, paramName, legacyParamName, searchParams, setSearchParams, aliases]);

  return [resolved, setTab] as [string, (id: string) => void];
}
