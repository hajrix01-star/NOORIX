import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  DEPLOY_RELOAD_SESSION_KEY,
  fetchRemoteBuildId,
  getLocalBuildId,
  parseRemoteBuildIdFromHtml,
  shouldReloadForNewBuild,
} from './deployVersionGuard';

describe('deployVersionGuard', () => {
  beforeEach(() => {
    vi.stubGlobal('__BUILD_ID__', 'abc123');
    document.head.innerHTML = '<meta name="noorix-build" content="abc123" />';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    sessionStorage.clear();
  });

  it('reads local build id from __BUILD_ID__', () => {
    expect(getLocalBuildId()).toBe('abc123');
  });

  it('parses remote build id from html', () => {
    const html = '<meta name="noorix-build" content="def456" />';
    expect(parseRemoteBuildIdFromHtml(html)).toBe('def456');
  });

  it('shouldReload when ids differ and not yet reloaded for remote', () => {
    expect(shouldReloadForNewBuild('abc', 'def')).toBe(true);
    sessionStorage.setItem(DEPLOY_RELOAD_SESSION_KEY, 'def');
    expect(shouldReloadForNewBuild('abc', 'def')).toBe(false);
  });

  it('fetchRemoteBuildId uses network with no-store', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => '<meta name="noorix-build" content="remote999" />',
    });
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('window', {
      location: { origin: 'https://hajrix.com' },
    });

    const id = await fetchRemoteBuildId();
    expect(id).toBe('remote999');
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('_nxBuildProbe='),
      expect.objectContaining({ cache: 'no-store' }),
    );
  });
});
