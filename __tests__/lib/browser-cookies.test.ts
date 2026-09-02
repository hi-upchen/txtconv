import { readCookie, writeCookie, deleteCookie } from '@/lib/auth/browser-cookies';

describe('browser cookies', () => {
  beforeEach(() => {
    // Expire anything a previous test wrote.
    for (const name of ['login_return_to', 'login_just_succeeded', 'other']) {
      document.cookie = `${name}=; Max-Age=0; Path=/`;
    }
  });

  it('returns null when the cookie is absent', () => {
    expect(readCookie('login_return_to')).toBeNull();
  });

  it('writes and reads back a value, URL-encoding it', () => {
    writeCookie('login_return_to', '/novel?x=1&y=2', 600);
    expect(document.cookie).toContain('login_return_to=%2Fnovel%3Fx%3D1%26y%3D2');
    expect(readCookie('login_return_to')).toBe('/novel?x=1&y=2');
  });

  it('reads the right cookie when several exist', () => {
    document.cookie = 'other=1; Path=/';
    writeCookie('login_just_succeeded', 'google', 60);
    expect(readCookie('login_just_succeeded')).toBe('google');
    expect(readCookie('other')).toBe('1');
  });

  it('does not confuse a cookie whose name ends with the requested name', () => {
    document.cookie = 'xlogin_return_to=wrong; Path=/';
    expect(readCookie('login_return_to')).toBeNull();
  });

  it('deletes a cookie', () => {
    writeCookie('login_return_to', '/checkout', 600);
    deleteCookie('login_return_to');
    expect(readCookie('login_return_to')).toBeNull();
  });

  it('returns null instead of throwing when the raw value is malformed', () => {
    document.cookie = 'login_return_to=%; Path=/';
    expect(readCookie('login_return_to')).toBeNull();
  });
});
