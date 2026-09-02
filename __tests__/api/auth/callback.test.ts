/**
 * @jest-environment node
 */
import { GET } from '@/app/auth/callback/route';

const mockCookieStore = { get: jest.fn(), set: jest.fn(), delete: jest.fn() };
jest.mock('next/headers', () => ({
  cookies: () => Promise.resolve(mockCookieStore),
}));

const mockExchangeCodeForSession = jest.fn();
jest.mock('@/lib/supabase/server', () => ({
  createClient: () => Promise.resolve({
    auth: { exchangeCodeForSession: mockExchangeCodeForSession },
  }),
}));

const mockEnsureProfileLinked = jest.fn();
jest.mock('@/lib/actions/auth', () => ({
  ensureProfileLinked: (...args: unknown[]) => mockEnsureProfileLinked(...args),
}));

const BASE = 'https://txtconv.test';

function authUser() {
  return { id: 'u1', email: 'me@example.com' };
}

/** Makes cookieStore.get(name) return a value only for the names given here. */
function setCookies(values: Record<string, string>) {
  mockCookieStore.get.mockImplementation((name: string) =>
    name in values ? { name, value: values[name] } : undefined
  );
}

async function callbackWith(query: string) {
  return GET(new Request(`${BASE}/auth/callback${query}`));
}

describe('GET /auth/callback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = BASE;
    mockCookieStore.get.mockReturnValue(undefined);
    mockExchangeCodeForSession.mockResolvedValue({ data: { user: authUser() }, error: null });
    mockEnsureProfileLinked.mockResolvedValue(undefined);
  });

  it('prefers the next query parameter', async () => {
    setCookies({ login_return_to: '/srt' });

    const res = await callbackWith('?code=abc&next=/checkout');

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe(`${BASE}/checkout`);
  });

  it('falls back to the login_return_to cookie when next is absent', async () => {
    setCookies({ login_return_to: '/novel?x=1' });

    const res = await callbackWith('?code=abc');

    expect(mockCookieStore.get).toHaveBeenCalledWith('login_return_to');
    expect(res.headers.get('location')).toBe(`${BASE}/novel?x=1`);
  });

  it('falls back to / when neither next nor cookie exists', async () => {
    const res = await callbackWith('?code=abc');
    expect(res.headers.get('location')).toBe(`${BASE}/`);
  });

  it('sanitizes an unsafe cookie value to /', async () => {
    setCookies({ login_return_to: '//evil.com' });

    const res = await callbackWith('?code=abc');

    expect(res.headers.get('location')).toBe(`${BASE}/`);
  });

  it('sanitizes an unsafe next value to / without falling back to the cookie', async () => {
    setCookies({ login_return_to: '/srt' });

    const res = await callbackWith('?code=abc&next=https://evil.com');

    expect(res.headers.get('location')).toBe(`${BASE}/`);
  });

  it('records google when the login_method_hint cookie says so', async () => {
    setCookies({ login_method_hint: 'google' });

    await callbackWith('?code=abc');

    expect(mockCookieStore.get).toHaveBeenCalledWith('login_method_hint');
    expect(mockCookieStore.set).toHaveBeenCalledWith(
      'login_just_succeeded',
      'google',
      expect.objectContaining({ maxAge: 60, path: '/', sameSite: 'lax' })
    );
    expect(mockCookieStore.set.mock.calls[0][2].httpOnly).toBeFalsy();
  });

  it('records magic_link when there is no login_method_hint cookie', async () => {
    await callbackWith('?code=abc');

    expect(mockCookieStore.set).toHaveBeenCalledWith('login_just_succeeded', 'magic_link', expect.anything());
  });

  it('clears login_return_to and login_method_hint on success', async () => {
    setCookies({ login_method_hint: 'google' });

    await callbackWith('?code=abc');

    expect(mockCookieStore.delete).toHaveBeenCalledWith('login_return_to');
    expect(mockCookieStore.delete).toHaveBeenCalledWith('login_method_hint');
  });

  it('still links the profile', async () => {
    await callbackWith('?code=abc');
    expect(mockEnsureProfileLinked).toHaveBeenCalledWith('u1', 'me@example.com');
  });

  it('redirects to the error page and touches no cookies when the exchange fails', async () => {
    mockExchangeCodeForSession.mockResolvedValue({ data: { user: null }, error: { message: 'bad code' } });

    const res = await callbackWith('?code=bad');

    expect(res.headers.get('location')).toBe(`${BASE}/auth/auth-code-error`);
    expect(mockCookieStore.set).not.toHaveBeenCalled();
    expect(mockCookieStore.delete).not.toHaveBeenCalled();
  });

  it('redirects to the error page when there is no code', async () => {
    const res = await callbackWith('');
    expect(res.headers.get('location')).toBe(`${BASE}/auth/auth-code-error`);
    expect(mockExchangeCodeForSession).not.toHaveBeenCalled();
  });
});
