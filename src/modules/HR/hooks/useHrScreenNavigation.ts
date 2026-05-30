import { useCallback, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  defaultTabForHrSection,
  type HrScreenLocation,
  type HrSectionId,
  type HrSubTabId,
  hrScreenUrlNeedsNormalization,
  resolveHrScreenFromSearchParams,
  writeHrScreenToSearchParams,
} from '../hrScreenNavigation';

export function useHrScreenNavigation() {
  const [searchParams, setSearchParams] = useSearchParams();

  const location = useMemo(
    () => resolveHrScreenFromSearchParams(searchParams),
    [searchParams],
  );

  useEffect(() => {
    if (!hrScreenUrlNeedsNormalization(searchParams)) return;
    const resolved = resolveHrScreenFromSearchParams(searchParams);
    setSearchParams(
      (prev) => writeHrScreenToSearchParams(prev, resolved),
      { replace: true },
    );
  }, [searchParams, setSearchParams]);

  const applyLocation = useCallback(
    (next: HrScreenLocation) => {
      setSearchParams(
        (prev) => writeHrScreenToSearchParams(prev, next),
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const setSection = useCallback(
    (section: HrSectionId) => {
      applyLocation({ section, tab: defaultTabForHrSection(section) });
    },
    [applyLocation],
  );

  const setTab = useCallback(
    (tab: HrSubTabId) => {
      applyLocation({ section: location.section, tab });
    },
    [applyLocation, location.section],
  );

  return {
    section: location.section,
    tab: location.tab,
    setSection,
    setTab,
  };
}
