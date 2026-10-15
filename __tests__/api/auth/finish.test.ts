/**
 * @jest-environment node
 */
import { GET } from '@/app/auth/finish/route';

const mockCookieStore = { get: jest.fn(), set: jest.fn(), delete: jest.fn() };
jest.mock('next/headers', () => ({
  cookies: () => Promise.resolve(mockCookieStore),
}));

const mockGetUser = jest.fn();
jest.mock('@/lib/supabase/server', () => ({
  createClient: () => Promise.resolve({ auth: { getUser: mockGetUser } }),
}));

const mockEnsureProfileLinked = jest.fn();
jest.mock('@/lib/actions/auth', () => ({
  ensureProfileLinked: (...args: unknown[]) => mockEnsureProfileLinked(...args),
}));

const BASE = 'https://txtconv.test';

async function finish() {
  return GET(new Request(`${BASE}/auth/finish`));
}

describe('GET /auth/finish', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = BASE;
    mockCookieStore.get.mockImplementation((name: string) =>
      name === 'login_return_to' ? { name, value: '/srt' } : undefined
    );
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1', email: 'me@example.com' } } });
    mockEnsureProfileLinked.mockResolvedValue(undefined);
  });

  it('links the profile and returns to the remembered page', async () => {
    const res = await finish();

    expect(mockEnsureProfileLinked).toHaveBeenCalledWith('u1', 'me@example.com');
    expect(res.headers.get('location')).toBe(`${BASE}/srt`);
    expect(mockCookieStore.delete).toHaveBeenCalledWith('login_return_to');
  });

  it('records email_code as the login method', async () => {
    await finish();

    expect(mockCookieStore.set).toHaveBeenCalledWith('login_just_succeeded', 'email_code', expect.anything());
  });

  it('sends a visitor without a session home and touches nothing', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const res = await finish();

    expect(res.headers.get('location')).toBe(`${BASE}/`);
    expect(mockEnsureProfileLinked).not.toHaveBeenCalled();
    expect(mockCookieStore.set).not.toHaveBeenCalled();
  });
});
