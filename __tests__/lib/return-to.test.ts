import {
  LOGIN_RETURN_TO_COOKIE,
  LOGIN_JUST_SUCCEEDED_COOKIE,
  LOGIN_METHOD_HINT_COOKIE,
  LOGIN_RETURN_TO_MAX_AGE_SECONDS,
  LOGIN_JUST_SUCCEEDED_MAX_AGE_SECONDS,
  LOGIN_METHOD_HINT_MAX_AGE_SECONDS,
  sanitizeReturnTo,
} from '@/lib/auth/return-to';

describe('return-to cookie constants', () => {
  it('uses the names and lifetimes the callback routes and the panel agree on', () => {
    expect(LOGIN_RETURN_TO_COOKIE).toBe('login_return_to');
    expect(LOGIN_JUST_SUCCEEDED_COOKIE).toBe('login_just_succeeded');
    expect(LOGIN_RETURN_TO_MAX_AGE_SECONDS).toBe(600);
    expect(LOGIN_JUST_SUCCEEDED_MAX_AGE_SECONDS).toBe(60);
  });

  it('adds a login method hint cookie with a ten-minute lifetime', () => {
    expect(LOGIN_METHOD_HINT_COOKIE).toBe('login_method_hint');
    expect(LOGIN_METHOD_HINT_MAX_AGE_SECONDS).toBe(600);
  });
});

describe('sanitizeReturnTo', () => {
  it.each([
    ['/', '/'],
    ['/checkout', '/checkout'],
    ['/novel?x=1&y=2', '/novel?x=1&y=2'],
    ['/srt#dictionary', '/srt#dictionary'],
  ])('keeps the in-site path %p', (input, expected) => {
    expect(sanitizeReturnTo(input)).toBe(expected);
  });

  it.each([
    ['protocol-relative URL', '//evil.com'],
    ['backslash disguised protocol-relative URL', '/\\evil.com'],
    ['absolute https URL', 'https://x'],
    ['absolute http URL', 'http://evil.com/'],
    ['scheme hidden inside the path', '/redirect?to=https://evil.com'],
    ['javascript scheme', 'javascript:alert(1)'],
    ['relative path without leading slash', 'checkout'],
    ['path with whitespace', '/check out'],
    ['path with a newline', '/checkout\nSet-Cookie: a=b'],
    ['auth route', '/auth/auth-code-error'],
    ['api route', '/api/dictionary'],
    ['empty string', ''],
    ['null', null],
    ['undefined', undefined],
  ])('falls back to "/" for %s', (_label, input) => {
    expect(sanitizeReturnTo(input)).toBe('/');
  });
});
