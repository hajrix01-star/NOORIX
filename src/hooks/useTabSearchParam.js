import { useCallback, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Persist the active ScreenTabs tab in the URL as ?tab=… so refresh and shared links keep the tab.
 * The default tab is omitted from the query string for a cleaner URL.
 *
 * @param {readonly string[]} allowedIds
 * @param {string} defaultId
 * @param {string} [paramName='tab']
 * @returns {[string, (id: string) => void]}
 */
export function useTabSearchParam(allowedIds, defaultId, paramName = 'tab') {
  const [searchParams, setSearchParams] = useSearchParams();
  const allowedKey = allowedIds.join('\0');

  const resolved = useMemo(() => {
    const raw = searchParams.get(paramName);
    if (raw && allowedIds.includes(raw)) return raw;
    if (allowedIds.includes(defaultId)) return defaultId;
    return allowedIds[0] ?? defaultId;
  }, [searchParams, paramName, allowedKey, defaultId, allowedIds]);

  const setTab = useCallback(
    (id) => {
      const nextId = allowedIds.includes(id)
        ? id
        : (allowedIds.includes(defaultId) ? defaultId : allowedIds[0]);
      if (!nextId) return;
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (nextId === defaultId) next.delete(paramName);
          else next.set(paramName, nextId);
          return next;
        },
        { replace: true },
      );
    },
    [allowedIds, allowedKey, defaultId, paramName, setSearchParams],
  );

  useEffect(() => {
    const raw = searchParams.get(paramName);
    if (!raw) return;
    if (allowedIds.includes(raw)) return;
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete(paramName);
        return next;
      },
      { replace: true },
    );
  }, [allowedIds, allowedKey, paramName, searchParams, setSearchParams]);

  return [resolved, setTab];
}
