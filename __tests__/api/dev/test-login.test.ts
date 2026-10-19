/**
 * @jest-environment node
 */
import { GET } from '@/app/api/dev/test-login/route';
import { NextRequest } from 'next/server';

function req(query = '') {
  return new NextRequest(`http://localhost:3000/api/dev/test-login${query}`);
}

// Mock next/headers
const mockCookieSet = jest.fn();
jest.mock('next/headers', () => ({
  cookies: () => Promise.resolve({
    set: mockCookieSet,
  }),
}));

describe('/api/dev/test-login', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    mockCookieSet.mockClear();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should return 403 in production', async () => {
    process.env.NODE_ENV = 'production';
    process.env.ENABLE_TEST_LOGIN = 'true';

    const response = await GET(req());

    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.error).toContain('production');
  });

  it('should return 403 when ENABLE_TEST_LOGIN is not set', async () => {
    process.env.NODE_ENV = 'development';
    process.env.ENABLE_TEST_LOGIN = undefined;

    const response = await GET(req());

    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.error).toContain('ENABLE_TEST_LOGIN');
  });

  it('should set session cookie and redirect when enabled', async () => {
    process.env.NODE_ENV = 'development';
    process.env.ENABLE_TEST_LOGIN = 'true';
    process.env.NEXT_PUBLIC_SITE_URL = 'http://localhost:3000';

    const response = await GET(req());

    expect(response.status).toBe(307); // redirect
    expect(mockCookieSet).toHaveBeenCalledWith(
      'test-session',
      expect.any(String),
      expect.objectContaining({
        path: '/',
      })
    );
    const cookieValue = JSON.parse(mockCookieSet.mock.calls[0][1] as string);
    expect(cookieValue.license).toBe('lifetime');
  });

  it('stores license=free in the session cookie when asked', async () => {
    process.env.NODE_ENV = 'development';
    process.env.ENABLE_TEST_LOGIN = 'true';

    const response = await GET(req('?license=free'));

    expect(response.status).toBe(307);
    const cookieValue = JSON.parse(mockCookieSet.mock.calls[0][1] as string);
    expect(cookieValue.license).toBe('free');
    expect(cookieValue.user.id).toBeDefined();
  });

  it('falls back to lifetime for unknown license values', async () => {
    process.env.NODE_ENV = 'development';
    process.env.ENABLE_TEST_LOGIN = 'true';

    await GET(req('?license=platinum'));

    const cookieValue = JSON.parse(mockCookieSet.mock.calls[0][1] as string);
    expect(cookieValue.license).toBe('lifetime');
  });

  it('accepts license=lifetime explicitly', async () => {
    process.env.NODE_ENV = 'development';
    process.env.ENABLE_TEST_LOGIN = 'true';

    await GET(req('?license=lifetime'));

    const cookieValue = JSON.parse(mockCookieSet.mock.calls[0][1] as string);
    expect(cookieValue.license).toBe('lifetime');
  });
});
