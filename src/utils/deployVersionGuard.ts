declare const __BUILD_ID__: string;
declare const __APP_VERSION__: number;

export const DEPLOY_RELOAD_SESSION_KEY = 'nxDeployReloadFor';

const BUILD_META_RE = /name=["']noorix-build["']\s+content=["']([^"']+)["']/i;
const VERSION_META_RE = /name=["']noorix-version["']\s+content=["']([^"']+)["']/i;

export type DeployVersionInfo = {
  buildId: string;
  version: number | null;
};

export function getLocalBuildId(): string {
  if (typeof __BUILD_ID__ === 'string' && __BUILD_ID__) return __BUILD_ID__;
  if (typeof document !== 'undefined') {
    const meta = document.querySelector('meta[name="noorix-build"]');
    const content = meta?.getAttribute('content');
    if (content) return content;
  }
  return '';
}

export function getLocalAppVersion(): number | null {
  if (typeof __APP_VERSION__ === 'number' && Number.isFinite(__APP_VERSION__)) return __APP_VERSION__;
  if (typeof document !== 'undefined') {
    const meta = document.querySelector('meta[name="noorix-version"]');
    const parsed = Number(meta?.getAttribute('content'));
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

export function parseRemoteBuildIdFromHtml(html: string): string | null {
  const m = html.match(BUILD_META_RE);
  return m?.[1]?.trim() || null;
}

export function parseRemoteVersionFromHtml(html: string): number | null {
  const m = html.match(VERSION_META_RE);
  const parsed = Number(m?.[1]?.trim());
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseRemoteDeployInfoFromHtml(html: string): DeployVersionInfo | null {
  const buildId = parseRemoteBuildIdFromHtml(html);
  if (!buildId) return null;
  return {
    buildId,
    version: parseRemoteVersionFromHtml(html),
  };
}

export async function fetchRemoteDeployInfo(origin = ''): Promise<DeployVersionInfo | null> {
  if (typeof window === 'undefined') return null;
  const base = origin || window.location.origin;
  const url = `${base}/?_nxBuildProbe=${Date.now()}`;
  try {
    const res = await fetch(url, {
      cache: 'no-store',
      credentials: 'same-origin',
      headers: { Accept: 'text/html' },
    });
    if (!res.ok) return null;
    const html = await res.text();
    return parseRemoteDeployInfoFromHtml(html);
  } catch {
    return null;
  }
}

export async function fetchRemoteBuildId(origin = ''): Promise<string | null> {
  return (await fetchRemoteDeployInfo(origin))?.buildId ?? null;
}

export function shouldReloadForNewBuild(localId: string, remoteId: string): boolean {
  if (!localId || !remoteId) return false;
  if (localId === remoteId) return false;
  try {
    if (sessionStorage.getItem(DEPLOY_RELOAD_SESSION_KEY) === remoteId) return false;
  } catch {
    // private mode
  }
  return true;
}

export function markReloadAttemptedForBuild(remoteId: string): void {
  try {
    sessionStorage.setItem(DEPLOY_RELOAD_SESSION_KEY, remoteId);
  } catch {
    // ignore
  }
}

export async function checkForAvailableDeployUpdate(): Promise<DeployVersionInfo | null> {
  if (typeof window === 'undefined') return null;
  const localId = getLocalBuildId();
  if (!localId) return null;

  const remote = await fetchRemoteDeployInfo();
  if (!shouldReloadForNewBuild(localId, remote?.buildId ?? '')) return null;
  return remote;
}

export function reloadToDeployUpdate(remoteId: string): void {
  markReloadAttemptedForBuild(remoteId);
  window.location.reload();
}
