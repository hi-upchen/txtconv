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

  describe('isInAppBrowser', () => {
    const inApp = {
      LINE: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Line/14.8.0',
      Facebook: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/460.0.0.0;FBBV/1;FBDV/iPhone14,2]',
      Instagram: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 330.0.0.0',
      Threads: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Barcelona 330.0.0.0',
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
