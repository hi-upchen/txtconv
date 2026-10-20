/**
 * @jest-environment node
 */
const mockLimit = jest.fn();
const mockSelect = jest.fn(() => ({ limit: mockLimit }));
const mockFrom = jest.fn(() => ({ select: mockSelect }));
const mockList = jest.fn();

jest.mock('@/lib/supabase/server', () => ({
  createServiceClient: () => ({ from: (...a: unknown[]) => (mockFrom as any)(...a) }),
}));
jest.mock('@vercel/blob', () => ({
  list: (...args: unknown[]) => mockList(...args),
}));

import { checkDatabase, checkAuth, checkDictionaryStore } from '@/lib/health/checks';

const mockFetch = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = mockFetch as unknown as typeof fetch;
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://proj.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-secret';
});

describe('checkDatabase', () => {
  it('passes when profiles select returns no error', async () => {
    mockLimit.mockResolvedValue({ error: null });
    expect(await checkDatabase()).toEqual({ status: 'pass' });
    expect(mockFrom).toHaveBeenCalledWith('profiles');
    expect(mockSelect).toHaveBeenCalledWith('id');
    expect(mockLimit).toHaveBeenCalledWith(1);
  });

  it('throws the database error message', async () => {
    mockLimit.mockResolvedValue({ error: { message: 'denied' } });
    await expect(checkDatabase()).rejects.toThrow('denied');
  });
});

describe('checkAuth', () => {
  const settings = (google: boolean, email: boolean) => ({
    status: 200,
    json: async () => ({ external: { google, email } }),
  });

  it('passes when settings return 200 with google and email on', async () => {
    mockFetch.mockResolvedValue(settings(true, true));
    expect(await checkAuth()).toEqual({ status: 'pass' });
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('https://proj.supabase.co/auth/v1/settings');
    expect(init.headers.apikey).toBe('anon-key');
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('fails on non-200', async () => {
    mockFetch.mockResolvedValue({ status: 503, json: async () => ({}) });
    expect(await checkAuth()).toEqual({ status: 'fail', output: 'Supabase 登入服務回應 HTTP 503' });
  });

  it('fails and names the provider when google is off', async () => {
    mockFetch.mockResolvedValue(settings(false, true));
    expect(await checkAuth()).toEqual({ status: 'fail', output: 'Supabase 未開啟 Google 登入' });
  });

  it('fails and names the provider when email is off', async () => {
    mockFetch.mockResolvedValue(settings(true, false));
    expect(await checkAuth()).toEqual({ status: 'fail', output: 'Supabase 未開啟 Email 登入' });
  });
});

describe('checkDictionaryStore', () => {
  it('passes when the store is empty', async () => {
    mockList.mockResolvedValue({ blobs: [] });
    expect(await checkDictionaryStore()).toEqual({ status: 'pass' });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('passes when one blob exists and a HEAD request for it returns 200', async () => {
    mockList.mockResolvedValue({ blobs: [{ url: 'https://blob.example/d.csv' }] });
    mockFetch.mockResolvedValue({ ok: true, status: 200 });
    expect(await checkDictionaryStore()).toEqual({ status: 'pass' });
    expect(mockList).toHaveBeenCalledWith({ limit: 1, prefix: 'dictionaries/' });
    expect(mockFetch).toHaveBeenCalledWith('https://blob.example/d.csv', {
      method: 'HEAD',
      cache: 'no-store',
      signal: expect.any(AbortSignal),
    });
  });

  it('throws when list throws', async () => {
    mockList.mockRejectedValue(new Error('store gone'));
    await expect(checkDictionaryStore()).rejects.toThrow('store gone');
  });

  it('fails when the fetch is not ok', async () => {
    mockList.mockResolvedValue({ blobs: [{ url: 'https://blob.example/d.csv' }] });
    mockFetch.mockResolvedValue({ ok: false, status: 403 });
    expect(await checkDictionaryStore()).toEqual({ status: 'fail', output: '字典儲存空間回應 HTTP 403' });
  });
});
