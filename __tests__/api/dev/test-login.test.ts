/**
 * @jest-environment node
 */
import { GET } from '@/app/api/dev/test-login/route';

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

    const response = await GET();

    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.error).toContain('production');
  });

  it('should return 403 when ENABLE_TEST_LOGIN is not set', async () => {
    process.env.NODE_ENV = 'development';
    process.env.ENABLE_TEST_LOGIN = undefined;

    const response = await GET();

    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.error).toContain('ENABLE_TEST_LOGIN');
  });

  it('should set session cookie and redirect when enabled', async () => {
    process.env.NODE_ENV = 'development';
    process.env.ENABLE_TEST_LOGIN = 'true';
    process.env.NEXT_PUBLIC_SITE_URL = 'http://localhost:3000';

    const response = await GET();

    expect(response.status).toBe(307); // redirect
    expect(mockCookieSet).toHaveBeenCalledWith(
      'test-session',
      expect.any(String),
      expect.objectContaining({
        path: '/',
      })
    );
  });
});
