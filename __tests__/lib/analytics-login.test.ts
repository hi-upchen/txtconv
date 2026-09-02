import {
  trackLoginStarted,
  trackLoginSucceeded,
  trackLoginFailed,
  isLoginMethod,
} from '@/lib/analytics';

describe('login analytics events', () => {
  beforeEach(() => {
    window.dataLayer = [];
  });

  it('pushes login_started with method and source path', () => {
    trackLoginStarted('google', '/novel');
    expect(window.dataLayer).toEqual([
      { event: 'login_started', method: 'google', source_path: '/novel' },
    ]);
  });

  it('pushes login_succeeded with method and source path', () => {
    trackLoginSucceeded('email_code', '/');
    expect(window.dataLayer).toEqual([
      { event: 'login_succeeded', method: 'email_code', source_path: '/' },
    ]);
  });

  it('pushes login_failed with method and reason', () => {
    trackLoginFailed('magic_link', 'link_invalid_or_expired');
    expect(window.dataLayer).toEqual([
      { event: 'login_failed', method: 'magic_link', reason: 'link_invalid_or_expired' },
    ]);
  });

  it('creates the dataLayer when a page has not defined it yet', () => {
    // @ts-expect-error simulate a page where GTM has not run
    delete window.dataLayer;
    trackLoginStarted('google', '/');
    expect(window.dataLayer).toHaveLength(1);
  });

  it.each(['google', 'email_code', 'magic_link'])('accepts %s as a login method', (value) => {
    expect(isLoginMethod(value)).toBe(true);
  });

  it.each(['', 'facebook', null, undefined, 42])('rejects %p as a login method', (value) => {
    expect(isLoginMethod(value)).toBe(false);
  });
});
