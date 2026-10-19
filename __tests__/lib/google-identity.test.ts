/**
 * @jest-environment jsdom
 */
import { webcrypto, createHash } from 'crypto';

describe('google-identity', () => {
  beforeEach(() => {
    jest.resetModules();
    document.head.innerHTML = '';
    Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
  });

  it('exposes the public client id', async () => {
    const { GOOGLE_CLIENT_ID } = await import('@/lib/auth/google-identity');
    expect(GOOGLE_CLIENT_ID).toBe('797135189931-45aim2iq1khsikfv7gu9jvdjknh623sa.apps.googleusercontent.com');
  });

  it('creates a raw nonce and its SHA-256 hex hash', async () => {
    const { createNonce } = await import('@/lib/auth/google-identity');
    const { raw, hashed } = await createNonce();
    expect(raw).toMatch(/^[0-9a-f]{64}$/);
    expect(hashed).toBe(createHash('sha256').update(raw).digest('hex'));
  });

  it('appends the script once and resolves when it loads', async () => {
    const { loadGoogleIdentity } = await import('@/lib/auth/google-identity');
    const first = loadGoogleIdentity();
    const second = loadGoogleIdentity();
    const scripts = document.head.querySelectorAll('script[src="https://accounts.google.com/gsi/client"]');
    expect(scripts).toHaveLength(1);
    scripts[0].dispatchEvent(new Event('load'));
    await expect(first).resolves.toBeUndefined();
    await expect(second).resolves.toBeUndefined();
  });

  it('rejects when the script fails, and a later call tries again', async () => {
    const { loadGoogleIdentity } = await import('@/lib/auth/google-identity');
    const failed = loadGoogleIdentity();
    document.head.querySelector('script')!.dispatchEvent(new Event('error'));
    await expect(failed).rejects.toThrow('Google Identity script failed to load');

    loadGoogleIdentity();
    expect(document.head.querySelectorAll('script')).toHaveLength(1);
  });

  describe('script load timeout', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it('rejects after 8 seconds, removes the script and lets a later call retry', async () => {
      const { loadGoogleIdentity } = await import('@/lib/auth/google-identity');
      const stalled = loadGoogleIdentity();
      const settled = expect(stalled).rejects.toThrow('Google Identity script timed out');

      jest.advanceTimersByTime(7999);
      expect(document.head.querySelectorAll('script')).toHaveLength(1);
      jest.advanceTimersByTime(1);
      await settled;
      expect(document.head.querySelectorAll('script')).toHaveLength(0);

      loadGoogleIdentity();
      expect(document.head.querySelectorAll('script')).toHaveLength(1);
    });

    it('does not time out once the script has loaded', async () => {
      const { loadGoogleIdentity } = await import('@/lib/auth/google-identity');
      const loaded = loadGoogleIdentity();
      document.head.querySelector('script')!.dispatchEvent(new Event('load'));
      await expect(loaded).resolves.toBeUndefined();

      jest.advanceTimersByTime(20000);
      expect(document.head.querySelectorAll('script')).toHaveLength(1);
    });
  });

  describe('shared Google setup', () => {
    const initialize = jest.fn();

    beforeEach(() => {
      initialize.mockClear();
      window.google = { accounts: { id: { initialize, renderButton: jest.fn() } } };
    });
    afterEach(() => {
      window.google = undefined;
    });

    async function setUp() {
      const mod = await import('@/lib/auth/google-identity');
      const ready = mod.ensureGoogleInitialized();
      await Promise.resolve();
      document.head.querySelector('script')!.dispatchEvent(new Event('load'));
      await ready;
      const callback = initialize.mock.calls[0][0].callback as (r: { credential: string }) => void;
      return { mod, callback };
    }

    it('initializes once however many callers ask', async () => {
      const mod = await import('@/lib/auth/google-identity');
      const first = mod.ensureGoogleInitialized();
      const second = mod.ensureGoogleInitialized();
      await Promise.resolve();
      document.head.querySelector('script')!.dispatchEvent(new Event('load'));
      await Promise.all([first, second]);
      await mod.ensureGoogleInitialized();

      expect(initialize).toHaveBeenCalledTimes(1);
    });

    it('sends a credential to the latest handler, then falls back when it unregisters', async () => {
      const { mod, callback } = await setUp();
      const earlier = jest.fn();
      const later = jest.fn();
      mod.registerGoogleCredentialHandler(earlier);
      const unregisterLater = mod.registerGoogleCredentialHandler(later);

      callback({ credential: 'token-1' });
      expect(later).toHaveBeenCalledWith('token-1', expect.stringMatching(/^[0-9a-f]{64}$/));
      expect(earlier).not.toHaveBeenCalled();

      unregisterLater();
      callback({ credential: 'token-2' });
      expect(earlier).toHaveBeenCalledWith('token-2', expect.any(String));
      expect(later).toHaveBeenCalledTimes(1);
    });

    it('passes the same raw nonce that Google was given a hash of', async () => {
      const { mod, callback } = await setUp();
      const handler = jest.fn();
      mod.registerGoogleCredentialHandler(handler);

      callback({ credential: 'a' });
      callback({ credential: 'b' });

      const [, nonceA] = handler.mock.calls[0];
      const [, nonceB] = handler.mock.calls[1];
      expect(nonceA).toBe(nonceB);
      expect(initialize.mock.calls[0][0].nonce).toBe(createHash('sha256').update(nonceA).digest('hex'));
    });

    it('ignores a credential when no handler is registered', async () => {
      const { callback } = await setUp();
      expect(() => callback({ credential: 'orphan' })).not.toThrow();
    });

    it('retries after a failed setup', async () => {
      window.google = undefined;
      const mod = await import('@/lib/auth/google-identity');
      const failed = mod.ensureGoogleInitialized();
      await Promise.resolve();
      document.head.querySelector('script')!.dispatchEvent(new Event('load'));
      await expect(failed).rejects.toThrow('missing after load');

      window.google = { accounts: { id: { initialize, renderButton: jest.fn() } } };
      const retry = mod.ensureGoogleInitialized();
      await Promise.resolve();
      document.head.querySelector('script')!.dispatchEvent(new Event('load'));
      await retry;
      expect(initialize).toHaveBeenCalledTimes(1);
    });
  });

  describe('isInAppBrowser', () => {
    const inApp = {
      LINE: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Line/14.8.0',
      Facebook: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/460.0.0.0;FBBV/1;FBDV/iPhone14,2]',
      Instagram: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 330.0.0.0',
      Threads: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Barcelona 330.0.0.0',
      WeChat: 'Mozilla/5.0 (Linux; Android 13; Pixel 7 Build/TQ3A.230805.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/116.0.0.0 Mobile Safari/537.36 MicroMessenger/8.0.43.2460',
      KakaoTalk: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KAKAOTALK 10.4.0',
      'TikTok (musical_ly)': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 musical_ly_33.0.0 JsSdk/2.0',
      'TikTok (BytedanceWebview)': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 BytedanceWebview/d8a21c6',
      'X app': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Twitter for iPhone/10.40',
      'Android WebView': 'Mozilla/5.0 (Linux; Android 13; Pixel 7 Build/TQ3A.230805.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/116.0.0.0 Mobile Safari/537.36',
    };
    const regular = {
      'desktop Chrome': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      'mobile Safari': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
      'Android Chrome': 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
    };

    it.each(Object.entries(inApp))('detects %s', async (_name, ua) => {
      const { isInAppBrowser } = await import('@/lib/auth/google-identity');
      expect(isInAppBrowser(ua)).toBe(true);
    });

    it.each(Object.entries(regular))('does not match %s', async (_name, ua) => {
      const { isInAppBrowser } = await import('@/lib/auth/google-identity');
      expect(isInAppBrowser(ua)).toBe(false);
    });
  });
});
