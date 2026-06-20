/**
 * بعد نشر إصدار جديد قد يبقى المستخدم على حزمة JS قديمة بينما السيرفر يخدم build جديد.
 * نقارن معرّف البناء المحلي (__BUILD_ID__) مع وسم noorix-build في index.html من الشبكة.
 */
declare const __BUILD_ID__: string;

export const DEPLOY_RELOAD_SESSION_KEY = 'nxDeployReloadFor';

const BUILD_META_RE = /name=["']noorix-build["']\s+content=["']([^"']+)["']/i;

export function getLocalBuildId(): string {
  if (typeof __BUILD_ID__ === 'string' && __BUILD_ID__) return __BUILD_ID__;
  if (typeof document !== 'undefined') {
    const meta = document.querySelector('meta[name="noorix-build"]');
    const content = meta?.getAttribute('content');
    if (content) return content;
  }
  return '';
}

export function parseRemoteBuildIdFromHtml(html: string): string | null {
  const m = html.match(BUILD_META_RE);
  return m?.[1]?.trim() || null;
}

export async function fetchRemoteBuildId(origin = ''): Promise<string | null> {
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
    return parseRemoteBuildIdFromHtml(html);
  } catch {
    return null;
  }
}

export function shouldReloadForNewBuild(localId: string, remoteId: string): boolean {
  if (!localId || !remoteId) return false;
  if (localId === remoteId) return false;
  try {
    if (sessionStorage.getItem(DEPLOY_RELOAD_SESSION_KEY) === remoteId) return false;
  } catch {
    /* private mode */
  }
  return true;
}

export function markReloadAttemptedForBuild(remoteId: string): void {
  try {
    sessionStorage.setItem(DEPLOY_RELOAD_SESSION_KEY, remoteId);
  } catch {
    /* ignore */
  }
}

/** يُرجع true إذا طُلبت إعادة تحميل الصفحة. */
export async function checkAndReloadIfStale(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  const localId = getLocalBuildId();
  if (!localId) return false;

  const remoteId = await fetchRemoteBuildId();
  if (!shouldReloadForNewBuild(localId, remoteId ?? '')) return false;

  markReloadAttemptedForBuild(remoteId!);
  window.location.reload();
  return true;
}
