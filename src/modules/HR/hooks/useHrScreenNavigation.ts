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

  /** Prefer this for sub-tabs — pass the visible section so URL stays in sync with the main tab strip. */
  const setSubTab = useCallback(
    (tab: HrSubTabId, section: HrSectionId) => {
      setSearchParams(
        (prev) => writeHrScreenToSearchParams(prev, { section, tab }),
        { replace: true },
      );
    },
    [setSearchParams],
  );

  /** @deprecated Use setSubTab(tab, section) or navigateHrScreen — kept for callers that only have tab id */
  const setTab = useCallback(
    (tab: HrSubTabId) => {
      setSearchParams(
        (prev) => {
          const { section } = resolveHrScreenFromSearchParams(prev);
          return writeHrScreenToSearchParams(prev, { section, tab });
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const navigateHrScreen = useCallback(
    (next: HrScreenLocation) => {
      applyLocation(next);
    },
    [applyLocation],
  );

  return {
    section: location.section,
    tab: location.tab,
    setSection,
    setSubTab,
    setTab,
    navigateHrScreen,
  };
}
