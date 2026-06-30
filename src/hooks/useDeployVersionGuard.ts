import { useCallback, useEffect, useState } from 'react';
import {
  checkForAvailableDeployUpdate,
  getLocalAppVersion,
  reloadToDeployUpdate,
  type DeployVersionInfo,
} from '../utils/deployVersionGuard';

const CHECK_INTERVAL_MS = 5 * 60 * 1000;

export type DeployVersionGuardState = {
  localVersion: number | null;
  update: DeployVersionInfo | null;
  refreshNow: () => void;
  checkNow: () => Promise<void>;
};

export function useDeployVersionGuard(enabled = true): DeployVersionGuardState {
  const [update, setUpdate] = useState<DeployVersionInfo | null>(null);
  const [localVersion] = useState(() => getLocalAppVersion());

  const checkNow = useCallback(async () => {
    if (!enabled || typeof window === 'undefined') return;
    const nextUpdate = await checkForAvailableDeployUpdate();
    if (nextUpdate) setUpdate(nextUpdate);
  }, [enabled]);

  const refreshNow = useCallback(() => {
    if (!update?.buildId) return;
    reloadToDeployUpdate(update.buildId);
  }, [update?.buildId]);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    void checkNow();

    const onVisibility = () => {
      if (document.visibilityState === 'visible') void checkNow();
    };

    document.addEventListener('visibilitychange', onVisibility);
    const intervalId = window.setInterval(() => void checkNow(), CHECK_INTERVAL_MS);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.clearInterval(intervalId);
    };
  }, [checkNow, enabled]);

  return {
    localVersion,
    update,
    refreshNow,
    checkNow,
  };
}
