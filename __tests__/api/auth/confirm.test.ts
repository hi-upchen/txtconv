/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { GET } from '@/app/auth/confirm/route';

const mockCookieStore = { get: jest.fn(), set: jest.fn(), delete: jest.fn() };
jest.mock('next/headers', () => ({
  cookies: () => Promise.resolve(mockCookieStore),
}));

const mockVerifyOtp = jest.fn();
const mockGetUser = jest.fn();
jest.mock('@/lib/supabase/server', () => ({
  createClient: () => Promise.resolve({
    auth: { verifyOtp: mockVerifyOtp, getUser: mockGetUser },
  }),
}));

const mockEnsureProfileLinked = jest.fn();
jest.mock('@/lib/actions/auth', () => ({
  ensureProfileLinked: (...args: unknown[]) => mockEnsureProfileLinked(...args),
}));

const BASE = 'https://txtconv.test';

async function confirmWith(query: string) {
  return GET(new NextRequest(`${BASE}/auth/confirm${query}`));
}

describe('GET /auth/confirm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = BASE;
    mockCookieStore.get.mockReturnValue(undefined);
    mockVerifyOtp.mockResolvedValue({ data: {}, error: null });
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1', email: 'me@example.com' } } });
    mockEnsureProfileLinked.mockResolvedValue(undefined);
  });

  it('verifies the token hash with the given type', async () => {
    await confirmWith('?token_hash=h1&type=magiclink');
    expect(mockVerifyOtp).toHaveBeenCalledWith({ type: 'magiclink', token_hash: 'h1' });
  });

  it('prefers next, then the cookie, then /', async () => {
    mockCookieStore.get.mockReturnValue({ name: 'login_return_to', value: '/srt' });
    expect((await confirmWith('?token_hash=h1&type=magiclink&next=/checkout')).headers.get('location'))
      .toBe(`${BASE}/checkout`);
    expect((await confirmWith('?token_hash=h1&type=magiclink')).headers.get('location'))
      .toBe(`${BASE}/srt`);

    mockCookieStore.get.mockReturnValue(undefined);
    expect((await confirmWith('?token_hash=h1&type=magiclink')).headers.get('location'))
      .toBe(`${BASE}/`);
  });

  it('always records magic_link and clears the return cookie', async () => {
    await confirmWith('?token_hash=h1&type=magiclink');

    expect(mockCookieStore.delete).toHaveBeenCalledWith('login_return_to');
    expect(mockCookieStore.set).toHaveBeenCalledWith(
      'login_just_succeeded',
      'magic_link',
      expect.objectContaining({ maxAge: 60, path: '/', sameSite: 'lax', secure: false })
    );
  });

  it('ignores a login_method_hint cookie and still writes magic_link', async () => {
    mockCookieStore.get.mockImplementation((name: string) =>
      name === 'login_method_hint' ? { name, value: 'google' } : undefined
    );

    await confirmWith('?token_hash=h1&type=magiclink');

    expect(mockCookieStore.set).toHaveBeenCalledWith('login_just_succeeded', 'magic_link', expect.anything());
  });

  it('redirects to the error page when verification fails', async () => {
    mockVerifyOtp.mockResolvedValue({ data: {}, error: { message: 'expired' } });

    const res = await confirmWith('?token_hash=h1&type=magiclink');

    expect(res.headers.get('location')).toBe(`${BASE}/auth/auth-code-error`);
    expect(mockCookieStore.set).not.toHaveBeenCalled();
  });

  it('redirects to the error page when token_hash or type is missing', async () => {
    expect((await confirmWith('?type=magiclink')).headers.get('location')).toBe(`${BASE}/auth/auth-code-error`);
    expect((await confirmWith('?token_hash=h1')).headers.get('location')).toBe(`${BASE}/auth/auth-code-error`);
    expect(mockVerifyOtp).not.toHaveBeenCalled();
  });
});
