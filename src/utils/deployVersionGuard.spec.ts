import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  DEPLOY_RELOAD_SESSION_KEY,
  fetchRemoteBuildId,
  fetchRemoteDeployInfo,
  getLocalBuildId,
  getLocalAppVersion,
  parseRemoteDeployInfoFromHtml,
  parseRemoteBuildIdFromHtml,
  parseRemoteVersionFromHtml,
  shouldReloadForNewBuild,
} from './deployVersionGuard';

describe('deployVersionGuard', () => {
  beforeEach(() => {
    vi.stubGlobal('__BUILD_ID__', 'abc123');
    vi.stubGlobal('__APP_VERSION__', 1);
    document.head.innerHTML = '<meta name="noorix-build" content="abc123" /><meta name="noorix-version" content="1" />';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    sessionStorage.clear();
  });

  it('reads local build id from __BUILD_ID__', () => {
    expect(getLocalBuildId()).toBe('abc123');
  });

  it('reads local app version from __APP_VERSION__', () => {
    expect(getLocalAppVersion()).toBe(1);
  });

  it('parses remote build id from html', () => {
    const html = '<meta name="noorix-build" content="def456" /><meta name="noorix-version" content="2" />';
    expect(parseRemoteBuildIdFromHtml(html)).toBe('def456');
    expect(parseRemoteVersionFromHtml(html)).toBe(2);
    expect(parseRemoteDeployInfoFromHtml(html)).toEqual({ buildId: 'def456', version: 2 });
  });

  it('shouldReload when ids differ and not yet reloaded for remote', () => {
    expect(shouldReloadForNewBuild('abc', 'def')).toBe(true);
    sessionStorage.setItem(DEPLOY_RELOAD_SESSION_KEY, 'def');
    expect(shouldReloadForNewBuild('abc', 'def')).toBe(false);
  });

  it('fetchRemoteDeployInfo uses network with no-store', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => '<meta name="noorix-build" content="remote999" /><meta name="noorix-version" content="3" />',
    });
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('window', {
      location: { origin: 'https://hajrix.com' },
    });

    const info = await fetchRemoteDeployInfo();
    expect(info).toEqual({ buildId: 'remote999', version: 3 });
    await expect(fetchRemoteBuildId()).resolves.toBe('remote999');
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('_nxBuildProbe='),
      expect.objectContaining({ cache: 'no-store' }),
    );
  });
});
